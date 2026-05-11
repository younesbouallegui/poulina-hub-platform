// Zabbix connector — secure server-side proxy + sync engine.
// Uses ZABBIX_URL and ZABBIX_API_TOKEN secrets. Token never leaves the server.
// Actions:
//   test        -> validate connection, return version + latency (admin only)
//   sync        -> pull host_groups, hosts, problems → upsert into monitoring_* tables (admin only)
//   query       -> whitelisted read-only Zabbix JSON-RPC proxy (authenticated users)
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
const CONNECTOR_VERSION = "2026-05-11-query-router-v1";

interface ZabbixRpcOpts {
  url: string;
  token: string;
  method: string;
  params?: unknown;
}

interface ZabbixHost {
  hostid: string;
  host: string;
  name?: string;
  status?: string;
  available?: string | number;
  interfaces?: Array<{ ip?: string }>;
  tags?: Array<{ tag: string; value: string }>;
}

interface ZabbixHostGroup {
  groupid: string;
  name: string;
}

interface ZabbixTrigger {
  triggerid: string;
  hosts?: Array<{ hostid: string }>;
}

interface ZabbixProblem {
  eventid: string;
  objectid: string;
  severity: string;
  acknowledged?: string;
  name?: string;
  opdata?: string;
  clock: string;
}

interface HostRow {
  id: string;
  external_id: string;
}

interface CallerContext {
  ok: true;
  userId: string;
  roles: string[];
}

const QUERY_METHODS = new Set([
  "host.get",
  "hostgroup.get",
  "problem.get",
  "trigger.get",
  "item.get",
  "history.get",
  "event.get",
  "service.get",
  "sla.get",
  "map.get",
  "dashboard.get",
]);

const rpcErrorKind = (message: string) => {
  if (/timeout|aborted|timed out/i.test(message)) return { code: "network_timeout", status: 504 };
  if (/auth|token|session terminated|not authorized|permission denied|no permissions/i.test(message)) {
    return { code: "zabbix_auth_failure", status: 401 };
  }
  if (/fetch failed|network|econn|enotfound|tls|certificate/i.test(message)) return { code: "zabbix_network_error", status: 502 };
  return { code: "zabbix_rpc_error", status: 502 };
};

function logEvent(event: string, payload: Record<string, unknown>) {
  console.log(JSON.stringify({ event, ts: new Date().toISOString(), ...payload }));
}

async function zabbixRpc<T = unknown>({ url, token, method, params }: ZabbixRpcOpts): Promise<T> {
  const endpoint = url.replace(/\/+$/, "") + "/api_jsonrpc.php";
  // Zabbix 7.2+ rejects "auth" in body — use Bearer header only.
  // apiinfo.version must NOT include auth at all.
  const body: Record<string, unknown> = {
    jsonrpc: "2.0",
    method,
    params: params ?? {},
    id: 1,
  };
  const headers: Record<string, string> = {
    "Content-Type": "application/json-rpc",
  };
  // apiinfo.version must be called WITHOUT any authorization
  if (method !== "apiinfo.version") {
    headers.Authorization = `Bearer ${token}`;
  }
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort("network_timeout"), 15_000);
  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (controller.signal.aborted) throw new Error("Zabbix network timeout after 15000ms");
    throw new Error(`Zabbix network error: ${msg}`);
  } finally {
    clearTimeout(timeoutId);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Zabbix HTTP ${res.status} at ${endpoint}${text ? `: ${text.slice(0, 200)}` : ""}`);
  }
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

async function handleQuery(
  input: { method?: unknown; params?: unknown },
  caller: CallerContext,
  credentials: { url: string; token: string },
) {
  if (!caller?.userId) {
    return json({ ok: false, code: "unauthorized", error: "Unauthorized" }, 401);
  }

  const method = typeof input.method === "string" ? input.method.trim() : "";
  if (!method) {
    logEvent("zabbix.query.rejected", { userId: caller.userId, code: "invalid_method" });
    return json({ ok: false, code: "invalid_method", error: "Invalid method", detail: "method required" }, 400);
  }
  if (!QUERY_METHODS.has(method)) {
    logEvent("zabbix.query.rejected", { userId: caller.userId, method, code: "permission_denied" });
    return json({ ok: false, code: "permission_denied", error: "Permission denied", detail: `Method '${method}' is not allowed via query` }, 403);
  }

  const started = Date.now();
  logEvent("zabbix.query.start", { userId: caller.userId, method });
  try {
    const result = await zabbixRpc({
      url: credentials.url,
      token: credentials.token,
      method,
      params: input.params ?? {},
    });
    logEvent("zabbix.query.success", { userId: caller.userId, method, duration_ms: Date.now() - started });
    return json({ ok: true, action: "query", method, connectorVersion: CONNECTOR_VERSION, result });
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    const kind = rpcErrorKind(detail);
    logEvent("zabbix.query.failure", { userId: caller.userId, method, code: kind.code, detail, duration_ms: Date.now() - started });
    return json({ ok: false, code: kind.code, error: humanError(kind.code), detail }, kind.status);
  }
}

function humanError(code: string) {
  if (code === "zabbix_auth_failure") return "Zabbix authentication failed";
  if (code === "permission_denied") return "Permission denied";
  if (code === "invalid_method") return "Invalid method";
  if (code === "network_timeout") return "Zabbix network timeout";
  if (code === "zabbix_network_error") return "Could not reach Zabbix API";
  return "Zabbix request failed";
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

    const body = await req.json().catch(() => ({}));
    const { action, providerId, method, params } = body;
    if (!action) return json({ error: "Missing action" }, 400);

    if (!["test", "sync", "query", "call"].includes(action)) {
      return json({ error: `Unknown action: ${action}` }, 400);
    }

    // Only `test`, `sync`, `call` require admin. Read-only `query` is open to any auth user.
    if (action !== "query" && !isAdmin) {
      return json({ error: "Forbidden — admin only" }, 403);
    }

    const url = Deno.env.get("ZABBIX_URL");
    const token = Deno.env.get("ZABBIX_API_TOKEN");
    if (!url || !token) {
      return json(
        { error: "Zabbix credentials not configured. Add ZABBIX_URL and ZABBIX_API_TOKEN secrets." },
        400,
      );
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    switch (action) {
      case "query":
        return await handleQuery({ method, params }, caller, { url, token });
      case "test":
      case "sync":
      case "call":
        break;
      default:
        return json({ error: `Unknown action: ${action}` }, 400);
    }

    if (action === "test") {
      // Multi-step real validation: reachability → version → token (host.get) → data sample
      const start = Date.now();
      const checks: Record<string, { ok: boolean; detail?: string }> = {};
      let version = "unknown";
      let derivedStatus: "connected" | "authentication_failed" | "api_unreachable" | "no_data" = "api_unreachable";
      try {
        version = await zabbixRpc<string>({ url, token, method: "apiinfo.version" });
        checks.reachable = { ok: true, detail: `v${version}` };
      } catch (e) {
        checks.reachable = { ok: false, detail: e instanceof Error ? e.message : String(e) };
        return json({ ok: false, status: "api_unreachable", checks, version, connectorVersion: CONNECTOR_VERSION, latency_ms: Date.now() - start }, 200);
      }
      try {
        const probe = await zabbixRpc<ZabbixHost[]>({
          url, token, method: "host.get",
          params: { output: ["hostid"], limit: 1 },
        });
        checks.auth = { ok: true };
        checks.hosts = { ok: Array.isArray(probe) && probe.length > 0, detail: `${probe?.length ?? 0} sampled` };
        derivedStatus = checks.hosts.ok ? "connected" : "no_data";
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        checks.auth = { ok: false, detail: msg };
        derivedStatus = /auth|token|permission|not authori/i.test(msg) ? "authentication_failed" : "api_unreachable";
      }
      const latency_ms = Date.now() - start;
      return json({ ok: derivedStatus === "connected", status: derivedStatus, checks, version, connectorVersion: CONNECTOR_VERSION, latency_ms });
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

      type GranularStatus =
        | "connected" | "partial" | "no_data"
        | "sync_failed" | "authentication_failed" | "api_unreachable";
      const toDbStatus = (s: GranularStatus): "connected" | "degraded" | "error" => {
        if (s === "connected") return "connected";
        if (s === "partial" || s === "no_data") return "degraded";
        return "error";
      };

      const finalize = async (
        status: GranularStatus,
        msg: string,
        counts: { groups: number; hosts: number; alerts: number },
        healthScore: number,
        result: "ok" | "error" | "partial",
      ) => {
        const duration = Date.now() - t0;
        const dbStatus = toDbStatus(status);
        const annotated = `[${status}] ${msg}`;
        await admin.from("monitoring_sync_logs").update({
          finished_at: new Date().toISOString(),
          result,
          duration_ms: duration,
          records_ingested: counts.groups + counts.hosts + counts.alerts,
          message: annotated,
        }).eq("id", log!.id);
        await admin.from("monitoring_providers").update({
          status: dbStatus,
          last_sync_at: new Date().toISOString(),
          last_error: status === "connected" ? null : annotated,
          health_score: healthScore,
        }).eq("id", providerId);
        await admin.from("provider_health").insert({
          provider_id: providerId,
          health_score: healthScore,
          latency_ms: duration,
          status: dbStatus,
          message: annotated,
        });
        return duration;
      };

      try {
        // 1. host groups
        let groups: ZabbixHostGroup[] = [];
        try {
          groups = await zabbixRpc<ZabbixHostGroup[]>({
            url, token, method: "hostgroup.get",
            params: { output: ["groupid", "name"] },
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          const status = /auth|token|permission/i.test(msg) ? "authentication_failed" : "api_unreachable";
          const duration = await finalize(status, msg, { groups: 0, hosts: 0, alerts: 0 }, 0, "error");
          return json({ ok: false, status, error: msg, duration_ms: duration }, 502);
        }
        if (groups.length) {
          const { error: gErr } = await admin.from("monitoring_host_groups").upsert(
            groups.map((g) => ({
              provider_id: providerId,
              external_id: g.groupid,
              name: g.name,
            })),
            { onConflict: "provider_id,external_id" },
          );
          if (gErr) {
            const duration = await finalize("sync_failed", `host_groups upsert: ${gErr.message}`, { groups: 0, hosts: 0, alerts: 0 }, 20, "error");
            return json({ ok: false, status: "sync_failed", error: gErr.message, duration_ms: duration }, 500);
          }
        }

        // 2. hosts
        const hosts = await zabbixRpc<ZabbixHost[]>({
          url, token, method: "host.get",
          params: {
            output: ["hostid", "host", "name", "status", "available"],
            selectInterfaces: ["ip"],
            selectTags: "extend",
          },
        });
        if (!Array.isArray(hosts) || hosts.length === 0) {
          const duration = await finalize("no_data", "host.get returned no hosts", { groups: groups.length, hosts: 0, alerts: 0 }, 40, "partial");
          return json({ ok: false, status: "no_data", groups: groups.length, hosts: 0, alerts: 0, duration_ms: duration }, 200);
        }
        const { error: hErr } = await admin.from("monitoring_hosts").upsert(
          hosts.map((h) => ({
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
        if (hErr) {
          const duration = await finalize("sync_failed", `hosts upsert: ${hErr.message}`, { groups: groups.length, hosts: 0, alerts: 0 }, 30, "error");
          return json({ ok: false, status: "sync_failed", error: hErr.message, duration_ms: duration }, 500);
        }

        // 3. active problems
        const problems = await zabbixRpc<ZabbixProblem[]>({
          url, token, method: "problem.get",
          params: { output: "extend", recent: false, sortfield: ["eventid"], sortorder: "DESC", limit: 500 },
        });

        let alertCount = 0;
        if (Array.isArray(problems) && problems.length) {
          const { data: hostRows } = await admin
            .from("monitoring_hosts")
            .select("id, external_id")
            .eq("provider_id", providerId);
          const hostMap = new Map<string, string>(
            ((hostRows ?? []) as HostRow[]).map((h) => [h.external_id, h.id]),
          );

          const triggerIds = problems.map((p) => p.objectid).filter(Boolean);
          const triggerHostMap = new Map<string, string>();
          if (triggerIds.length) {
            const triggers = await zabbixRpc<ZabbixTrigger[]>({
              url, token, method: "trigger.get",
              params: { triggerids: triggerIds, selectHosts: ["hostid"], output: ["triggerid"] },
            });
            if (Array.isArray(triggers)) {
              for (const t of triggers) {
                const hid = t.hosts?.[0]?.hostid;
                if (hid) triggerHostMap.set(t.triggerid, hid);
              }
            }
          }

          const rows = problems.map((p) => {
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
          const { error: aErr } = await admin
            .from("monitoring_alerts")
            .upsert(rows, { onConflict: "provider_id,external_id" });
          if (aErr) {
            const duration = await finalize("partial", `alerts upsert: ${aErr.message}`, { groups: groups.length, hosts: hosts.length, alerts: 0 }, 60, "partial");
            return json({ ok: false, status: "partial", error: aErr.message, duration_ms: duration }, 200);
          }
          alertCount = rows.length;
        }

        const finalStatus = "connected";
        const msg = `Synced ${groups.length} groups, ${hosts.length} hosts, ${alertCount} alerts`;
        const duration = await finalize(finalStatus, msg, { groups: groups.length, hosts: hosts.length, alerts: alertCount }, 100, "ok");

        return json({
          ok: true,
          status: finalStatus,
          groups: groups.length,
          hosts: hosts.length,
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
