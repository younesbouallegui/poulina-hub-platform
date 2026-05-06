// Zabbix connector — secure server-side proxy + sync engine.
// Uses ZABBIX_URL and ZABBIX_API_TOKEN secrets. Token never leaves the server.
// Actions:
//   test        -> validate connection, return version + latency
//   sync        -> pull host_groups, hosts, problems → upsert into monitoring_* tables
//   call        -> generic Zabbix JSON-RPC pass-through (admin only)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface ZabbixRpcOpts {
  url: string;
  token: string;
  method: string;
  params?: unknown;
}

async function zabbixRpc({ url, token, method, params }: ZabbixRpcOpts) {
  const endpoint = url.replace(/\/+$/, "") + "/api_jsonrpc.php";
  const body = {
    jsonrpc: "2.0",
    method,
    params: params ?? {},
    id: 1,
    auth: token, // older Zabbix
  };
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json-rpc",
      // Zabbix 6.4+ supports bearer auth too
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Zabbix HTTP ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(`Zabbix RPC: ${json.error.data || json.error.message}`);
  return json.result;
}

function severityFromZabbix(p: number): string {
  // Zabbix priorities: 0..5 -> not_classified..disaster
  return ["not_classified", "info", "warning", "average", "high", "disaster"][p] ?? "warning";
}

async function getCallerRoles(authHeader: string) {
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await sb.auth.getClaims(token);
  if (error || !data?.claims) return { ok: false as const };
  const userId = data.claims.sub;
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", userId);
  return { ok: true as const, userId, roles: (roles ?? []).map((r) => r.role as string) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }
    const caller = await getCallerRoles(auth);
    if (!caller.ok) return json({ error: "Unauthorized" }, 401);

    const isAdmin = caller.roles.includes("super_admin") || caller.roles.includes("admin");
    if (!isAdmin) return json({ error: "Forbidden — admin only" }, 403);

    const { action, providerId } = await req.json().catch(() => ({}));
    if (!action) return json({ error: "Missing action" }, 400);

    const url = Deno.env.get("ZABBIX_URL");
    const token = Deno.env.get("ZABBIX_API_TOKEN");
    if (!url || !token) {
      return json(
        { error: "Zabbix credentials not configured. Add ZABBIX_URL and ZABBIX_API_TOKEN secrets." },
        400,
      );
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    if (action === "test") {
      const start = Date.now();
      const version = await zabbixRpc({ url, token, method: "apiinfo.version" });
      const latency = Date.now() - start;
      return json({ ok: true, version, latency_ms: latency });
    }

    if (action === "sync") {
      if (!providerId) return json({ error: "providerId required" }, 400);
      const startedAt = new Date().toISOString();
      const t0 = Date.now();
      const { data: log } = await admin
        .from("monitoring_sync_logs")
        .insert({ provider_id: providerId, started_at: startedAt, result: "running" })
        .select("id")
        .single();

      try {
        // 1. host groups
        const groups = await zabbixRpc({
          url,
          token,
          method: "hostgroup.get",
          params: { output: ["groupid", "name"] },
        });
        if (Array.isArray(groups) && groups.length) {
          await admin.from("monitoring_host_groups").upsert(
            groups.map((g: { groupid: string; name: string }) => ({
              provider_id: providerId,
              external_id: g.groupid,
              name: g.name,
            })),
            { onConflict: "provider_id,external_id" },
          );
        }

        // 2. hosts
        const hosts = await zabbixRpc({
          url,
          token,
          method: "host.get",
          params: {
            output: ["hostid", "host", "name", "status", "available"],
            selectInterfaces: ["ip"],
            selectTags: "extend",
          },
        });
        if (Array.isArray(hosts) && hosts.length) {
          await admin.from("monitoring_hosts").upsert(
            hosts.map((h: any) => ({
              provider_id: providerId,
              external_id: h.hostid,
              name: h.name ?? h.host,
              hostname: h.host,
              ip_address: h.interfaces?.[0]?.ip ?? null,
              available: h.available === "1" || h.available === 1,
              status: h.status === "0" ? "enabled" : "disabled",
              tags: h.tags ?? [],
              last_seen: new Date().toISOString(),
              raw: h,
            })),
            { onConflict: "provider_id,external_id" },
          );
        }

        // 3. active problems
        const problems = await zabbixRpc({
          url,
          token,
          method: "problem.get",
          params: {
            output: "extend",
            recent: false,
            sortfield: ["eventid"],
            sortorder: "DESC",
            limit: 500,
          },
        });

        let alertCount = 0;
        if (Array.isArray(problems) && problems.length) {
          // build host map
          const { data: hostRows } = await admin
            .from("monitoring_hosts")
            .select("id, external_id")
            .eq("provider_id", providerId);
          const hostMap = new Map<string, string>(
            (hostRows ?? []).map((h: any) => [h.external_id, h.id]),
          );

          // need triggers to map to host
          const triggerIds = problems.map((p: any) => p.objectid).filter(Boolean);
          let triggerHostMap = new Map<string, string>();
          if (triggerIds.length) {
            const triggers = await zabbixRpc({
              url,
              token,
              method: "trigger.get",
              params: {
                triggerids: triggerIds,
                selectHosts: ["hostid"],
                output: ["triggerid"],
              },
            });
            if (Array.isArray(triggers)) {
              for (const t of triggers) {
                triggerHostMap.set(t.triggerid, t.hosts?.[0]?.hostid);
              }
            }
          }

          const rows = problems.map((p: any) => {
            const zHost = triggerHostMap.get(p.objectid);
            return {
              provider_id: providerId,
              external_id: p.eventid,
              host_id: zHost ? hostMap.get(zHost) ?? null : null,
              severity: severityFromZabbix(parseInt(p.severity, 10)),
              status: p.acknowledged === "1" ? "acknowledged" : "open",
              title: p.name ?? "Zabbix problem",
              description: p.opdata ?? null,
              triggered_at: new Date(parseInt(p.clock, 10) * 1000).toISOString(),
              raw: p,
            };
          });
          await admin
            .from("monitoring_alerts")
            .upsert(rows, { onConflict: "provider_id,external_id" });
          alertCount = rows.length;
        }

        const duration = Date.now() - t0;
        await admin
          .from("monitoring_sync_logs")
          .update({
            finished_at: new Date().toISOString(),
            result: "ok",
            duration_ms: duration,
            records_ingested: (hosts?.length ?? 0) + alertCount + (groups?.length ?? 0),
            message: `Synced ${groups?.length ?? 0} groups, ${hosts?.length ?? 0} hosts, ${alertCount} alerts`,
          })
          .eq("id", log!.id);

        await admin
          .from("monitoring_providers")
          .update({
            status: "connected",
            last_sync_at: new Date().toISOString(),
            last_error: null,
            health_score: 100,
          })
          .eq("id", providerId);

        await admin.from("provider_health").insert({
          provider_id: providerId,
          health_score: 100,
          latency_ms: duration,
          status: "connected",
          message: "Sync ok",
        });

        return json({
          ok: true,
          groups: groups?.length ?? 0,
          hosts: hosts?.length ?? 0,
          alerts: alertCount,
          duration_ms: duration,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await admin
          .from("monitoring_sync_logs")
          .update({
            finished_at: new Date().toISOString(),
            result: "error",
            duration_ms: Date.now() - t0,
            message: msg,
          })
          .eq("id", log!.id);
        await admin
          .from("monitoring_providers")
          .update({ status: "error", last_error: msg, health_score: 20 })
          .eq("id", providerId);
        await admin.from("provider_health").insert({
          provider_id: providerId,
          health_score: 20,
          status: "error",
          message: msg,
        });
        return json({ error: msg }, 500);
      }
    }

    if (action === "call") {
      const { method, params } = await req.json().catch(() => ({}));
      if (!method) return json({ error: "method required" }, 400);
      const result = await zabbixRpc({ url, token, method, params });
      return json({ ok: true, result });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json({ error: msg }, 500);
  }
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
