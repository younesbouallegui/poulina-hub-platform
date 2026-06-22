// zabbix-token-mint: mints a short-lived Zabbix API token for the currently
// authenticated Hub user, so it can be handed off to Poulina AI Knowledge for
// SSO. Uses the admin ZABBIX_TOKEN to call token.create / token.generate on
// behalf of the user identified by their Supabase session metadata.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const ZBX_URL = Deno.env.get("ZABBIX_URL");
const ZBX_TOKEN = Deno.env.get("ZABBIX_TOKEN");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const ALLOWED_ORIGINS = new Set([
  "https://aiknowledge.younesblg.com",
  "https://poulina-hub-spark.lovable.app",
  "https://poulinaihub.younesblg.com",
]);

const isAllowedLocalhost = (origin: string) => /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
const isAllowedLovablePreview = (origin: string) => /^https:\/\/id-preview--[a-z0-9-]+\.lovable\.app$/.test(origin);
const isAllowedOrigin = (origin: string) => !origin || ALLOWED_ORIGINS.has(origin) || isAllowedLocalhost(origin) || isAllowedLovablePreview(origin);

function requestCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") ?? "";
  const allowOrigin = origin ? (isAllowedOrigin(origin) ? origin : "null") : "*";

  return {
    ...corsHeaders,
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "authorization,apikey,content-type,x-client-info,x-supabase-authorization",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
    "Content-Type": "application/json",
  };
}

function json(req: Request, body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: requestCorsHeaders(req) });
}

function envStatus() {
  return {
    SUPABASE_URL: Boolean(SUPABASE_URL),
    SUPABASE_ANON_KEY: Boolean(ANON_KEY),
    SUPABASE_SERVICE_ROLE_KEY: Boolean(SERVICE_ROLE_KEY),
    ZABBIX_URL: Boolean(ZBX_URL),
    ZABBIX_TOKEN: Boolean(ZBX_TOKEN),
  };
}

function missingRequiredEnv() {
  const status = envStatus();
  return Object.entries(status)
    .filter(([key, exists]) => key !== "SUPABASE_SERVICE_ROLE_KEY" && !exists)
    .map(([key]) => key);
}

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
  const text = await r.text();
  let j: { error?: { data?: string; message?: string }; result?: unknown } = {};
  try {
    j = JSON.parse(text);
  } catch {
    throw new Error(`Zabbix returned non-JSON response (${r.status})`);
  }
  if (!r.ok || j.error) throw new Error(j.error?.data || j.error?.message || `Zabbix HTTP ${r.status}`);
  return j.result;
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const requestId = crypto.randomUUID();
  const origin = req.headers.get("Origin") ?? "none";

  console.log("[zabbix-token-mint] incoming request", {
    requestId,
    method: req.method,
    path: url.pathname,
    origin,
    env: envStatus(),
  });

  if (req.method === "OPTIONS") {
    if (!isAllowedOrigin(origin)) {
      console.warn("[zabbix-token-mint] preflight rejected", { requestId, origin });
      return new Response(JSON.stringify({ error: "Origin not allowed" }), { status: 403, headers: requestCorsHeaders(req) });
    }
    console.log("[zabbix-token-mint] preflight accepted", { requestId, origin });
    return new Response(JSON.stringify({ status: "ok" }), { status: 200, headers: requestCorsHeaders(req) });
  }

  if (!isAllowedOrigin(origin)) {
    console.warn("[zabbix-token-mint] request rejected by CORS policy", { requestId, origin });
    return json(req, { error: "Origin not allowed", request_id: requestId }, 403);
  }

  if (req.method === "GET" && url.pathname.endsWith("/sso/health")) {
    console.log("[zabbix-token-mint] health check ok", { requestId, origin, env: envStatus() });
    return json(req, { status: "ok" });
  }

  try {
    if (req.method !== "POST") {
      return json(req, { error: "Method not allowed", request_id: requestId }, 405);
    }

    const missing = missingRequiredEnv();
    if (missing.length) {
      console.error("[zabbix-token-mint] missing required environment", { requestId, missing, env: envStatus() });
      return json(req, {
        error: "Hub SSO edge function is not fully configured",
        missing_env: missing,
        request_id: requestId,
      }, 500);
    }

    let requestBody: Record<string, unknown> = {};
    try {
      requestBody = await req.json();
    } catch {
      requestBody = {};
    }
    console.log("[zabbix-token-mint] request body", { requestId, body: requestBody });

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      console.warn("[zabbix-token-mint] failed: missing bearer token", { requestId, origin });
      return json(req, { error: "Unauthorized", request_id: requestId }, 401);
    }
    const userClient = createClient(SUPABASE_URL!, ANON_KEY!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      console.warn("[zabbix-token-mint] failed: auth.getUser rejected token", { requestId, reason: userErr?.message });
      return json(req, { error: "Unauthorized", request_id: requestId }, 401);
    }
    const meta = (userData.user.user_metadata ?? {}) as Record<string, unknown>;
    const zabbixUserId = String(meta.zabbix_userid ?? requestBody.zabbix_userid ?? "");
    const zabbixUsername = String(meta.zabbix_username ?? requestBody.zabbix_username ?? "");
    console.log("[zabbix-token-mint] authenticated caller", {
      requestId,
      user_id: userData.user.id,
      email: userData.user.email,
      zabbixUserId,
      zabbixUsername,
    });
    if (!zabbixUserId) {
      console.warn("[zabbix-token-mint] failed: no Zabbix user link", { requestId, user_id: userData.user.id });
      return json(req, { error: "User is not linked to a Zabbix account", request_id: requestId }, 400);
    }

    const expires = Math.floor(Date.now() / 1000) + 120;
    const tokenName = `sso-handoff-${userData.user.id}-${Date.now()}`;
    const created = await zbx(
      "token.create",
      [{
        name: tokenName,
        userid: zabbixUserId,
        expires_at: expires,
        status: "0",
        description: "One-time SSO handoff token (Poulina AI Hub → Knowledge)",
      }],
      ZBX_TOKEN!,
    ) as { tokenids?: string[] };

    const tokenid = created?.tokenids?.[0];
    if (!tokenid) throw new Error("token.create did not return a tokenid");
    console.log("[zabbix-token-mint] generated SSO handoff token record", {
      requestId,
      tokenid,
      tokenName,
      expires_at: expires,
    });

    const generated = await zbx("token.generate", [tokenid], ZBX_TOKEN!) as Array<{ token?: string }>;
    const zabbix_token = generated?.[0]?.token;
    if (!zabbix_token) throw new Error("token.generate did not return a token");

    console.log("[zabbix-token-mint] success", { requestId, tokenid, zabbixUserId, expires_at: expires });
    return json(req, {
      zabbix_token,
      zabbix_userid: zabbixUserId,
      zabbix_username: zabbixUsername,
      expires_at: expires,
      request_id: requestId,
    });
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    console.error("[zabbix-token-mint] failure", { requestId, reason });
    return json(req, { error: reason, request_id: requestId }, 500);
  }
});
