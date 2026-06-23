// zabbix-auth: validates a Zabbix username/password, mirrors the user into
// Postgres, ensures a matching Supabase auth user exists, and returns a
// Supabase session so the browser can sign in. The Zabbix admin bearer
// token (ZABBIX_TOKEN) is used only for the post-login user.get / role.get
// / usergroup.get calls — the user's own password is never persisted.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-authorization",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
import { createClient } from "npm:@supabase/supabase-js@2";

const FUNCTION_VERSION = "zabbix-auth-sso-token-mint-v3";

const ZBX_URL = Deno.env.get("ZABBIX_URL");
const ZBX_TOKEN = Deno.env.get("ZABBIX_TOKEN");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function rpcEndpoint(base: string) {
  const t = base.replace(/\/+$/, "");
  return t.endsWith("api_jsonrpc.php") ? t : `${t}/api_jsonrpc.php`;
}

async function zbx(method: string, params: unknown, auth?: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json-rpc" };
  if (auth) headers.Authorization = `Bearer ${auth}`;
  const r = await fetch(rpcEndpoint(ZBX_URL!), {
    method: "POST",
    headers,
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error.data || j.error.message || "Zabbix error");
  return j.result;
}

const deterministicEmail = (userid: string, real?: string | null) =>
  real && real.includes("@") ? real.toLowerCase() : `zbx-${userid}@zabbix.local`;

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const envStatus = () => ({
  SUPABASE_URL: Boolean(SUPABASE_URL),
  SUPABASE_ANON_KEY: Boolean(Deno.env.get("SUPABASE_ANON_KEY")),
  SUPABASE_SERVICE_ROLE_KEY: Boolean(SERVICE_KEY),
  ZABBIX_URL: Boolean(ZBX_URL),
  ZABBIX_TOKEN: Boolean(ZBX_TOKEN),
});

// build: sso-token-mint v3
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    if (req.method === "GET" && url.searchParams.get("health") === "1") {
      return json({ status: "ok", function: "zabbix-auth", version: FUNCTION_VERSION, env: envStatus() });
    }

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "").trim();

    if (action === "__version") {
      return json({ status: "ok", function: "zabbix-auth", version: FUNCTION_VERSION, env: envStatus() });
    }

    if (action === "sso-token-mint") {
      const requestId = crypto.randomUUID();
      if (!ZBX_URL || !ZBX_TOKEN) {
        return json({ error: "Zabbix is not configured", action, version: FUNCTION_VERSION, request_id: requestId }, 500);
      }
      const authHeader = req.headers.get("Authorization") ?? "";
      if (!authHeader.startsWith("Bearer ")) {
        await createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
          .from("identity_audit")
          .insert({ action: "sso_failed", actor_username: "unknown", metadata: { request_id: requestId, reason: "missing_bearer" }, source: "sso" });
        return json({ error: "Unauthorized", request_id: requestId }, 401);
      }

      const anon = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false },
      });
      const { data: userData, error: userErr } = await anon.auth.getUser();
      if (userErr || !userData?.user) {
        return json({ error: "Unauthorized", request_id: requestId }, 401);
      }

      const meta = (userData.user.user_metadata ?? {}) as Record<string, unknown>;
      const zabbixUserId = String(meta.zabbix_userid ?? body?.zabbix_userid ?? "");
      const zabbixUsername = String(meta.zabbix_username ?? body?.zabbix_username ?? userData.user.email ?? "");
      const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
      await admin.from("identity_audit").insert({
        actor_auth_user_id: userData.user.id,
        actor_zabbix_userid: zabbixUserId || null,
        actor_username: zabbixUsername,
        action: "sso_initiated",
        target_zabbix_userid: zabbixUserId || null,
        target_username: zabbixUsername,
        metadata: { request_id: requestId, destination: body?.redirect_url ?? "poulina-ai-knowledge" },
        source: "sso",
      });
      if (!zabbixUserId) {
        await admin.from("identity_audit").insert({
          actor_auth_user_id: userData.user.id,
          actor_username: zabbixUsername,
          action: "sso_failed",
          metadata: { request_id: requestId, reason: "missing_zabbix_userid" },
          source: "sso",
        });
        return json({ error: "User is not linked to a Zabbix account", request_id: requestId }, 400);
      }

      const expires = Math.floor(Date.now() / 1000) + 120;
      const tokenName = `sso-handoff-${userData.user.id}-${Date.now()}`;
      const created = await zbx("token.create", [{
        name: tokenName,
        userid: zabbixUserId,
        expires_at: expires,
        status: "0",
        description: "One-time SSO handoff token (Poulina AI Hub → Knowledge)",
      }], ZBX_TOKEN) as { tokenids?: string[] };
      const tokenid = created?.tokenids?.[0];
      if (!tokenid) throw new Error("token.create did not return a tokenid");
      const generated = await zbx("token.generate", [tokenid], ZBX_TOKEN) as Array<{ token?: string }>;
      const zabbix_token = generated?.[0]?.token;
      if (!zabbix_token) throw new Error("token.generate did not return a token");

      return json({
        zabbix_token,
        zabbix_userid: zabbixUserId,
        zabbix_username: zabbixUsername,
        expires_at: expires,
        request_id: requestId,
      });
    }

    if (!ZBX_URL || !ZBX_TOKEN) {
      return json({ error: "Zabbix is not configured", action, version: FUNCTION_VERSION }, 500);
    }

    const username = String(body?.username || "").trim();
    const password = String(body?.password || "");
    if (!username || !password) {
      return json({ error: "username and password are required", action: action || "login", version: FUNCTION_VERSION }, 400);
    }

    // 1) Validate against Zabbix (user.login also returns a session token we discard)
    try {
      await zbx("user.login", { username, password });
    } catch (e) {
      return new Response(JSON.stringify({ error: "Invalid Zabbix credentials", detail: String((e as Error).message) }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 2) Fetch the canonical profile via the admin token
    const users = await zbx("user.get", {
      output: "extend",
      selectRole: "extend",
      selectUsrgrps: ["usrgrpid", "name", "gui_access", "users_status"],
      filter: { username: [username] },
    }, ZBX_TOKEN) as any[];
    const zUser = users?.[0];
    if (!zUser) {
      return new Response(JSON.stringify({ error: "User not found in Zabbix after login" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const email = deterministicEmail(zUser.userid, zUser.email);
    const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

    // 3) Ensure a Supabase auth user exists for this Zabbix user (idempotent)
    let authUserId: string | null = null;
    {
      // Try to find existing
      const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
      const existing = list?.users?.find((u: any) => u.email?.toLowerCase() === email);
      if (existing) {
        authUserId = existing.id;
      } else {
        // Create with a high-entropy random password we throw away (we use OTP / magic link to sign in)
        const rand = crypto.randomUUID() + crypto.randomUUID();
        const { data: created, error: cErr } = await admin.auth.admin.createUser({
          email,
          password: rand,
          email_confirm: true,
          user_metadata: {
            zabbix_userid: zUser.userid,
            zabbix_username: zUser.username,
            full_name: `${zUser.name ?? ""} ${zUser.surname ?? ""}`.trim() || zUser.username,
          },
        });
        if (cErr || !created?.user) throw cErr || new Error("Failed to create auth user");
        authUserId = created.user.id;
      }
    }

    // 4) Mirror into zbx_users + group membership
    const role = Array.isArray(zUser.role) ? zUser.role[0] : zUser.role;
    await admin.from("zbx_users").upsert({
      zabbix_userid: zUser.userid,
      username: zUser.username,
      name: zUser.name ?? null,
      surname: zUser.surname ?? null,
      email: zUser.email ?? null,
      roleid: zUser.roleid ?? role?.roleid ?? null,
      type: role?.type ? Number(role.type) : (zUser.type ? Number(zUser.type) : null),
      status: Number(zUser.users_status ?? 0),
      auth_user_id: authUserId,
      last_synced_at: new Date().toISOString(),
    }, { onConflict: "zabbix_userid" });

    if (role?.roleid) {
      await admin.from("zbx_roles").upsert({
        roleid: role.roleid,
        name: role.name ?? "Role",
        type: Number(role.type ?? 1),
        readonly: Number(role.readonly ?? 0),
        last_synced_at: new Date().toISOString(),
      }, { onConflict: "roleid" });
    }
    const grps = (zUser.usrgrps ?? []) as any[];
    if (grps.length) {
      await admin.from("zbx_user_groups").upsert(
        grps.map((g) => ({
          usrgrpid: g.usrgrpid,
          name: g.name,
          gui_access: g.gui_access != null ? Number(g.gui_access) : null,
          users_status: g.users_status != null ? Number(g.users_status) : null,
          last_synced_at: new Date().toISOString(),
        })),
        { onConflict: "usrgrpid" },
      );
      // Reset membership for this user
      await admin.from("zbx_user_group_members").delete().eq("zabbix_userid", zUser.userid);
      await admin.from("zbx_user_group_members").insert(
        grps.map((g) => ({ usrgrpid: g.usrgrpid, zabbix_userid: zUser.userid })),
      );
    }

    // 5) Sign the user in: generate a magic link, exchange the token for a session
    const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    if (linkErr || !link?.properties?.hashed_token) {
      throw linkErr || new Error("Failed to generate sign-in link");
    }
    // Use anon client to convert the token_hash into a real session
    const anon = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      auth: { persistSession: false },
    });
    const { data: sess, error: vErr } = await anon.auth.verifyOtp({
      type: "magiclink",
      token_hash: link.properties.hashed_token,
    });
    if (vErr || !sess?.session) throw vErr || new Error("Failed to mint session");

    // 6) Audit
    await admin.from("identity_audit").insert({
      actor_auth_user_id: authUserId,
      actor_zabbix_userid: zUser.userid,
      actor_username: zUser.username,
      action: "login",
      target_zabbix_userid: zUser.userid,
      target_username: zUser.username,
      metadata: { roleid: zUser.roleid ?? role?.roleid ?? null, groups: grps.map((g) => g.usrgrpid) },
      source: "platform",
    });

    return new Response(JSON.stringify({
      session: {
        access_token: sess.session.access_token,
        refresh_token: sess.session.refresh_token,
        expires_in: sess.session.expires_in,
        expires_at: sess.session.expires_at,
        token_type: sess.session.token_type,
      },
      user: {
        zabbix_userid: zUser.userid,
        username: zUser.username,
        email,
        name: `${zUser.name ?? ""} ${zUser.surname ?? ""}`.trim() || zUser.username,
      },
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("zabbix-auth error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
