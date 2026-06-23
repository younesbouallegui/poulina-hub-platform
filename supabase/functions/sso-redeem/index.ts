// sso-redeem (Hub side): receives a signed SSO token issued by Poulina AI
// Knowledge, verifies the HMAC + nonce, and mints a Hub Supabase session
// for the Zabbix identity carried by the token.
//
// Trust model:
//   - The Zabbix directory is the source of truth. We do NOT sync Supabase
//     users between Hub and Knowledge.
//   - We do create a *local* Hub auth row the first time a Zabbix user
//     arrives, purely so the Hub frontend (which uses Supabase Auth as its
//     local session store) can issue a session keyed by the Zabbix user.
//   - Nonces are single-use and recorded in `sso_nonces` to block replay.

import { createClient } from "npm:@supabase/supabase-js@2";
import { SSO_VERSION, verifySsoToken } from "../_shared/sso.ts";

const FUNCTION_NAME = "sso-redeem";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SSO_SHARED_SECRET = Deno.env.get("SSO_SHARED_SECRET") ?? "";

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
});

const emailFor = (zabbixUserId: string) => `zbx-${zabbixUserId}@zabbix.local`;

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
    if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE_KEY) {
      return json({ error: "Supabase env is incomplete", request_id: requestId }, 500);
    }

    const body = await req.json().catch(() => ({}));
    const code = String(body?.code ?? "").trim();
    if (!code) return json({ error: "Missing SSO code", request_id: requestId }, 400);

    const payload = await verifySsoToken(code, SSO_SHARED_SECRET, {
      expectedAudience: "hub",
      expectedIssuer: "knowledge",
    });

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

    // Replay protection: insert nonce; conflict means token has already been redeemed.
    const { error: nonceErr } = await admin
      .from("sso_nonces")
      .insert({ nonce: payload.nonce, issuer: payload.iss, audience: payload.aud, subject: payload.sub });
    if (nonceErr) {
      const reason = nonceErr.message || "";
      if (/duplicate|unique/i.test(reason)) {
        return json({ error: "SSO token has already been used", request_id: requestId }, 409);
      }
      return json({ error: `Nonce store unavailable: ${reason}`, request_id: requestId }, 500);
    }

    // Provision a local Hub Supabase auth row so the frontend session works.
    // This is local provisioning (not cross-project sync) — equivalent to what
    // happens when a Zabbix user logs in with password for the first time.
    const email = emailFor(payload.sub);
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    let authUserId: string | null =
      list?.users?.find((u) => u.email?.toLowerCase() === email)?.id ?? null;

    if (!authUserId) {
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password: crypto.randomUUID() + crypto.randomUUID(),
        email_confirm: true,
        user_metadata: {
          zabbix_userid: payload.sub,
          zabbix_username: payload.username,
          full_name: payload.name,
        },
      });
      if (createErr || !created?.user) throw createErr || new Error("Failed to create local Hub auth row");
      authUserId = created.user.id;
    } else {
      await admin.auth.admin.updateUserById(authUserId, {
        user_metadata: {
          zabbix_userid: payload.sub,
          zabbix_username: payload.username,
          full_name: payload.name,
        },
      });
    }

    // Mint a Hub session via a magic-link token-hash exchange.
    const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    if (linkErr || !link?.properties?.hashed_token) {
      throw linkErr || new Error("Failed to generate Hub sign-in link");
    }
    const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
    const { data: sess, error: vErr } = await anon.auth.verifyOtp({
      type: "magiclink",
      token_hash: link.properties.hashed_token,
    });
    if (vErr || !sess?.session) throw vErr || new Error("Failed to mint Hub session");

    // Audit (best-effort).
    admin.from("sso_audit").insert({
      direction: "knowledge->hub",
      actor_zabbix_userid: payload.sub,
      actor_username: payload.username,
      nonce: payload.nonce,
      outcome: "redeemed",
      request_id: requestId,
    }).then(({ error }) => {
      if (error) console.warn("[sso-redeem] audit insert failed", error.message);
    });

    console.log("[sso-redeem] success", { requestId, sub: payload.sub, username: payload.username });
    return json({
      session: {
        access_token: sess.session.access_token,
        refresh_token: sess.session.refresh_token,
        expires_in: sess.session.expires_in,
        expires_at: sess.session.expires_at,
        token_type: sess.session.token_type,
      },
      identity: {
        zabbix_userid: payload.sub,
        username: payload.username,
        name: payload.name,
        roles: payload.roles,
      },
      version: SSO_VERSION,
      request_id: requestId,
    });
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    console.warn("[sso-redeem] rejected", { requestId, reason });
    const status = /expired|signature|audience|issuer|malformed|missing|not yet valid/i.test(reason) ? 401 : 500;
    return json({ error: reason, request_id: requestId }, status);
  }
});
