// sso-redeem: Hub-side SSO receiver. Redeems a one-time code issued by
// Poulina AI Knowledge, then returns a session that is valid for Poulina AI Hub.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const KNOWLEDGE_REDEEM_URL = Deno.env.get("KNOWLEDGE_SSO_REDEEM_URL") ??
  "https://yweknqfqvjkxepivuufc.supabase.co/functions/v1/sso-redeem";
const SSO_SHARED_SECRET = Deno.env.get("SSO_SHARED_SECRET") ?? "";

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
    KNOWLEDGE_SSO_REDEEM_URL: Boolean(KNOWLEDGE_REDEEM_URL),
    SSO_SHARED_SECRET: Boolean(SSO_SHARED_SECRET),
  };
}

function missingRequiredEnv() {
  const status = envStatus();
  return Object.entries(status)
    .filter(([key, exists]) => key !== "SSO_SHARED_SECRET" && !exists)
    .map(([key]) => key);
}

const deterministicEmail = (userid: string, real?: string | null) =>
  real && real.includes("@") ? real.toLowerCase() : `zbx-${userid}@zabbix.local`;

function extractSession(payload: Record<string, unknown>) {
  const session = (payload.session && typeof payload.session === "object" ? payload.session : payload) as Record<string, unknown>;
  const access_token = typeof session.access_token === "string" ? session.access_token : "";
  const refresh_token = typeof session.refresh_token === "string" ? session.refresh_token : "";
  return access_token && refresh_token ? { access_token, refresh_token } : null;
}

function extractIdentity(payload: Record<string, unknown>) {
  const user = (payload.user && typeof payload.user === "object" ? payload.user : {}) as Record<string, unknown>;
  const zabbixUserId = String(user.zabbix_userid ?? user.zabbixUserId ?? payload.zabbix_userid ?? payload.zabbixUserId ?? "");
  const zabbixUsername = String(user.username ?? user.zabbix_username ?? payload.username ?? payload.zabbix_username ?? "");
  const emailRaw = String(user.email ?? payload.email ?? "");
  const email = emailRaw.includes("@") ? emailRaw.toLowerCase() : deterministicEmail(zabbixUserId, null);
  const name = String(user.name ?? user.full_name ?? payload.name ?? payload.full_name ?? zabbixUsername ?? email.split("@")[0]);
  return { email, name, zabbixUserId, zabbixUsername };
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const requestId = crypto.randomUUID();
  const origin = req.headers.get("Origin") ?? "none";

  console.log("[hub-sso-redeem] incoming request", {
    requestId,
    method: req.method,
    path: url.pathname,
    origin,
    env: envStatus(),
  });

  if (req.method === "OPTIONS") {
    if (!isAllowedOrigin(origin)) {
      console.warn("[hub-sso-redeem] preflight rejected", { requestId, origin });
      return new Response(JSON.stringify({ error: "Origin not allowed" }), { status: 403, headers: requestCorsHeaders(req) });
    }
    console.log("[hub-sso-redeem] preflight accepted", { requestId, origin });
    return new Response(JSON.stringify({ status: "ok" }), { status: 200, headers: requestCorsHeaders(req) });
  }

  if (!isAllowedOrigin(origin)) {
    console.warn("[hub-sso-redeem] request rejected by CORS policy", { requestId, origin });
    return json(req, { error: "Origin not allowed", request_id: requestId }, 403);
  }

  if (req.method === "GET" && url.pathname.endsWith("/sso/health")) {
    console.log("[hub-sso-redeem] health check ok", { requestId, origin, env: envStatus() });
    return json(req, { status: "ok" });
  }

  try {
    if (req.method !== "POST") return json(req, { error: "Method not allowed", request_id: requestId }, 405);

    const missing = missingRequiredEnv();
    if (missing.length) {
      console.error("[hub-sso-redeem] missing required environment", { requestId, missing, env: envStatus() });
      return json(req, { error: "Hub SSO receiver is not fully configured", missing_env: missing, request_id: requestId }, 500);
    }

    const body = await req.json().catch(() => ({}));
    const code = String(body?.code ?? "").trim();
    const next = String(body?.next ?? "/");
    console.log("[hub-sso-redeem] redeem attempt", { requestId, body: { code_present: Boolean(code), next } });
    if (!code) return json(req, { error: "Missing SSO code", request_id: requestId }, 400);

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (SSO_SHARED_SECRET) headers.Authorization = `Bearer ${SSO_SHARED_SECRET}`;
    const upstream = await fetch(KNOWLEDGE_REDEEM_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({ code, source: "poulina-ai-hub" }),
    });
    const upstreamText = await upstream.text();
    let payload: Record<string, unknown> = {};
    try {
      payload = upstreamText ? JSON.parse(upstreamText) : {};
    } catch {
      payload = { raw: upstreamText.slice(0, 500) };
    }
    console.log("[hub-sso-redeem] upstream redeem response", {
      requestId,
      status: upstream.status,
      has_session: Boolean(extractSession(payload)),
      has_user: Boolean(payload.user),
    });
    if (!upstream.ok) {
      console.warn("[hub-sso-redeem] failed: upstream rejected code", { requestId, status: upstream.status, payload });
      return json(req, { error: String(payload.error ?? `Knowledge redeem failed (${upstream.status})`), request_id: requestId }, upstream.status);
    }

    const upstreamSession = extractSession(payload);
    if (upstreamSession) {
      const hubAnon = createClient(SUPABASE_URL!, ANON_KEY!, {
        global: { headers: { Authorization: `Bearer ${upstreamSession.access_token}` } },
        auth: { persistSession: false },
      });
      const { data } = await hubAnon.auth.getUser();
      if (data?.user) {
        console.log("[hub-sso-redeem] success: upstream session is valid for Hub", { requestId, user_id: data.user.id });
        return json(req, { session: upstreamSession, user: { email: data.user.email }, request_id: requestId });
      }
      console.log("[hub-sso-redeem] upstream session is not a Hub session; minting Hub session from identity", { requestId });
    }

    const identity = extractIdentity(payload);
    if (!identity.email || !identity.email.includes("@")) {
      console.warn("[hub-sso-redeem] failed: no redeemable identity", { requestId, payload });
      return json(req, { error: "SSO redeem response did not include enough user information to create a Hub session", request_id: requestId }, 422);
    }

    const admin = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    let authUserId: string | null = null;
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const existing = list?.users?.find((u) => u.email?.toLowerCase() === identity.email);
    if (existing) {
      authUserId = existing.id;
      await admin.auth.admin.updateUserById(existing.id, {
        email_confirm: true,
        user_metadata: {
          ...(existing.user_metadata ?? {}),
          zabbix_userid: identity.zabbixUserId || existing.user_metadata?.zabbix_userid,
          zabbix_username: identity.zabbixUsername || existing.user_metadata?.zabbix_username,
          full_name: identity.name,
        },
      });
    } else {
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: identity.email,
        password: crypto.randomUUID() + crypto.randomUUID(),
        email_confirm: true,
        user_metadata: {
          zabbix_userid: identity.zabbixUserId,
          zabbix_username: identity.zabbixUsername,
          full_name: identity.name,
        },
      });
      if (createErr || !created?.user) throw createErr || new Error("Failed to create Hub auth user");
      authUserId = created.user.id;
    }

    const { data: link, error: linkErr } = await admin.auth.admin.generateLink({ type: "magiclink", email: identity.email });
    if (linkErr || !link?.properties?.hashed_token) throw linkErr || new Error("Failed to generate Hub sign-in link");
    const anon = createClient(SUPABASE_URL!, ANON_KEY!, { auth: { persistSession: false } });
    const { data: sess, error: vErr } = await anon.auth.verifyOtp({ type: "magiclink", token_hash: link.properties.hashed_token });
    if (vErr || !sess?.session) throw vErr || new Error("Failed to mint Hub session");

    await admin.from("identity_audit").insert({
      actor_auth_user_id: authUserId,
      actor_zabbix_userid: identity.zabbixUserId || null,
      actor_username: identity.zabbixUsername || identity.email,
      action: "sso_redeemed",
      target_zabbix_userid: identity.zabbixUserId || null,
      target_username: identity.zabbixUsername || identity.email,
      metadata: { source: "poulina-ai-knowledge", request_id: requestId, next },
      source: "sso",
    }).then(({ error }) => {
      if (error) console.warn("[hub-sso-redeem] audit insert failed", { requestId, reason: error.message });
    });

    console.log("[hub-sso-redeem] success: Hub session created", { requestId, authUserId, email: identity.email });
    return json(req, {
      session: {
        access_token: sess.session.access_token,
        refresh_token: sess.session.refresh_token,
        expires_in: sess.session.expires_in,
        expires_at: sess.session.expires_at,
        token_type: sess.session.token_type,
      },
      user: identity,
      request_id: requestId,
    });
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    console.error("[hub-sso-redeem] failure", { requestId, reason });
    return json(req, { error: reason, request_id: requestId }, 500);
  }
});