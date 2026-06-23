// sso-token-mint (Hub side): mints a signed SSO token for the currently
// authenticated Zabbix user on Poulina AI Hub, then returns a redirect URL
// to the Poulina AI Knowledge SSO receiver.
//
// Trust model:
//   - The caller MUST present a valid Hub Supabase session (Bearer token).
//   - We derive the Zabbix identity from that user's metadata.
//   - We sign a short-lived JWS with SSO_SHARED_SECRET; Knowledge verifies it
//     and trusts the embedded Zabbix identity directly. No cross-project user
//     sync.

import { createClient } from "npm:@supabase/supabase-js@2";
import { signSsoToken, SSO_TTL_SECONDS, SSO_VERSION, type SsoPayload } from "../_shared/sso.ts";

const FUNCTION_NAME = "sso-token-mint";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SSO_SHARED_SECRET = Deno.env.get("SSO_SHARED_SECRET") ?? "";
const KNOWLEDGE_SSO_RECEIVER =
  Deno.env.get("KNOWLEDGE_SSO_RECEIVER_URL") ?? "https://aiknowledge.younesblg.com/auth/sso";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "authorization,apikey,content-type,x-client-info",
  "Access-Control-Max-Age": "86400",
  Vary: "Origin",
  "Content-Type": "application/json",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders });

const envStatus = () => ({
  SUPABASE_URL: Boolean(SUPABASE_URL),
  SUPABASE_ANON_KEY: Boolean(ANON_KEY),
  SUPABASE_SERVICE_ROLE_KEY: Boolean(SERVICE_ROLE_KEY),
  SSO_SHARED_SECRET: Boolean(SSO_SHARED_SECRET),
  KNOWLEDGE_SSO_RECEIVER: Boolean(KNOWLEDGE_SSO_RECEIVER),
});

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const requestId = crypto.randomUUID();

  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (url.searchParams.get("health") === "1") {
    return json({
      status: "ok",
      function: FUNCTION_NAME,
      version: SSO_VERSION,
      env: envStatus(),
      request_id: requestId,
    });
  }

  if (req.method !== "POST") return json({ error: "Method not allowed", request_id: requestId }, 405);

  try {
    if (!SSO_SHARED_SECRET) return json({ error: "SSO_SHARED_SECRET is not configured on Hub", request_id: requestId }, 500);
    if (!SUPABASE_URL || !ANON_KEY) return json({ error: "Supabase env is incomplete", request_id: requestId }, 500);

    const authHeader = req.headers.get("authorization") ?? "";
    const bearer = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7) : "";
    if (!bearer) return json({ error: "Missing caller session", request_id: requestId }, 401);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${bearer}` } },
      auth: { persistSession: false },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return json({ error: "Invalid or expired Hub session", request_id: requestId }, 401);
    }
    const sbUser = userData.user;
    const meta = (sbUser.user_metadata ?? {}) as Record<string, unknown>;

    const zabbixUserId = String(meta.zabbix_userid ?? "");
    const zabbixUsername = String(meta.zabbix_username ?? sbUser.email?.split("@")[0] ?? "");
    if (!zabbixUserId || !zabbixUsername) {
      return json({ error: "Caller is not linked to a Zabbix identity", request_id: requestId }, 422);
    }
    const name = String(meta.full_name ?? zabbixUsername);

    // Pull roles from platform_roles (best-effort; SSO does not depend on it).
    let roles: string[] = [];
    if (SERVICE_ROLE_KEY) {
      const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
      const { data: roleRows } = await admin
        .from("platform_roles")
        .select("role")
        .eq("auth_user_id", sbUser.id);
      if (Array.isArray(roleRows)) roles = roleRows.map((r: { role: string }) => r.role);
    }

    const body = await req.json().catch(() => ({}));
    const target = (body?.target ?? "knowledge") as "knowledge";
    if (target !== "knowledge") {
      return json({ error: `Unsupported SSO target: ${target}`, request_id: requestId }, 400);
    }

    const now = Math.floor(Date.now() / 1000);
    const payload: SsoPayload = {
      iss: "hub",
      aud: "knowledge",
      sub: zabbixUserId,
      username: zabbixUsername,
      name,
      roles,
      iat: now,
      exp: now + SSO_TTL_SECONDS,
      nonce: crypto.randomUUID(),
    };
    const code = await signSsoToken(payload, SSO_SHARED_SECRET);
    const redirect_url = `${KNOWLEDGE_SSO_RECEIVER}?code=${encodeURIComponent(code)}&from=hub`;

    // Best-effort audit (non-blocking).
    if (SERVICE_ROLE_KEY) {
      const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
      admin.from("sso_audit").insert({
        direction: "hub->knowledge",
        actor_zabbix_userid: zabbixUserId,
        actor_username: zabbixUsername,
        nonce: payload.nonce,
        outcome: "minted",
        request_id: requestId,
      }).then(({ error }) => {
        if (error) console.warn("[sso-token-mint] audit insert failed", error.message);
      });
    }

    console.log("[sso-token-mint] minted", { requestId, sub: zabbixUserId, username: zabbixUsername });
    return json({ redirect_url, expires_in: SSO_TTL_SECONDS, version: SSO_VERSION, request_id: requestId });
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    console.error("[sso-token-mint] failure", { requestId, reason });
    return json({ error: reason, request_id: requestId }, 500);
  }
});
