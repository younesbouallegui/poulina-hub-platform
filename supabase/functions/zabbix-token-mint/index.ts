// zabbix-token-mint: mints a short-lived Zabbix API token for the currently
// authenticated Hub user, so it can be handed off to Poulina AI Knowledge for
// SSO. Uses the admin ZABBIX_TOKEN to call token.create / token.generate on
// behalf of the user identified by their Supabase session metadata.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const ZBX_URL = Deno.env.get("ZABBIX_URL");
const ZBX_TOKEN = Deno.env.get("ZABBIX_TOKEN");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

function rpcEndpoint(base: string) {
  const t = base.replace(/\/+$/, "");
  return t.endsWith("api_jsonrpc.php") ? t : `${t}/api_jsonrpc.php`;
}

async function zbx(method: string, params: unknown, auth: string) {
  const r = await fetch(rpcEndpoint(ZBX_URL!), {
    method: "POST",
    headers: {
      "Content-Type": "application/json-rpc",
      Authorization: `Bearer ${auth}`,
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error.data || j.error.message || "Zabbix error");
  return j.result;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    if (!ZBX_URL || !ZBX_TOKEN) {
      return new Response(JSON.stringify({ error: "Zabbix is not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const meta = (userData.user.user_metadata ?? {}) as Record<string, unknown>;
    const zabbixUserId = String(meta.zabbix_userid ?? "");
    const zabbixUsername = String(meta.zabbix_username ?? "");
    if (!zabbixUserId) {
      return new Response(JSON.stringify({ error: "User is not linked to a Zabbix account" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1) Create a fresh token bound to this user, expiring in 2 minutes.
    const expires = Math.floor(Date.now() / 1000) + 120;
    const created = await zbx(
      "token.create",
      [{
        name: `sso-handoff-${userData.user.id}-${Date.now()}`,
        userid: zabbixUserId,
        expires_at: expires,
        status: "0",
        description: "One-time SSO handoff token (Poulina AI Hub → Knowledge)",
      }],
      ZBX_TOKEN,
    ) as { tokenids: string[] };

    const tokenid = created?.tokenids?.[0];
    if (!tokenid) throw new Error("token.create did not return a tokenid");

    // 2) Generate the actual secret string for the token.
    const generated = await zbx("token.generate", [tokenid], ZBX_TOKEN) as Array<{ token: string }>;
    const zabbix_token = generated?.[0]?.token;
    if (!zabbix_token) throw new Error("token.generate did not return a token");

    return new Response(
      JSON.stringify({
        zabbix_token,
        zabbix_userid: zabbixUserId,
        zabbix_username: zabbixUsername,
        expires_at: expires,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
