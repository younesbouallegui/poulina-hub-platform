// zabbix-users: write-through CRUD for Zabbix users. Every action calls the
// Zabbix API first, then mirrors into Postgres, then writes identity_audit.
// Requires the caller to be a platform admin (super_admin or admin) — derived
// from the linked zbx_users row via has_role().
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const ZBX_URL = Deno.env.get("ZABBIX_URL")!;
const ZBX_TOKEN = Deno.env.get("ZABBIX_TOKEN")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

function endpoint(b: string) {
  const t = b.replace(/\/+$/, "");
  return t.endsWith("api_jsonrpc.php") ? t : `${t}/api_jsonrpc.php`;
}
async function zbx(method: string, params: unknown) {
  const r = await fetch(endpoint(ZBX_URL), {
    method: "POST",
    headers: { "Content-Type": "application/json-rpc", Authorization: `Bearer ${ZBX_TOKEN}` },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error.data || j.error.message || "Zabbix error");
  return j.result;
}

async function fetchAndMirror(admin: any, userid: string) {
  const users = await zbx("user.get", {
    output: "extend",
    selectRole: "extend",
    selectUsrgrps: ["usrgrpid", "name", "gui_access", "users_status"],
    userids: [userid],
  }) as any[];
  const u = users?.[0];
  if (!u) return null;
  const role = Array.isArray(u.role) ? u.role[0] : u.role;
  await admin.from("zbx_users").upsert({
    zabbix_userid: u.userid,
    username: u.username,
    name: u.name ?? null,
    surname: u.surname ?? null,
    email: u.email ?? null,
    roleid: u.roleid ?? role?.roleid ?? null,
    type: role?.type ? Number(role.type) : null,
    status: Number(u.users_status ?? 0),
    last_synced_at: new Date().toISOString(),
  }, { onConflict: "zabbix_userid" });
  await admin.from("zbx_user_group_members").delete().eq("zabbix_userid", u.userid);
  const grps = (u.usrgrps ?? []) as any[];
  if (grps.length) {
    await admin.from("zbx_user_groups").upsert(grps.map((g) => ({
      usrgrpid: g.usrgrpid, name: g.name,
      gui_access: g.gui_access != null ? Number(g.gui_access) : null,
      users_status: g.users_status != null ? Number(g.users_status) : null,
      last_synced_at: new Date().toISOString(),
    })), { onConflict: "usrgrpid" });
    await admin.from("zbx_user_group_members").insert(
      grps.map((g) => ({ usrgrpid: g.usrgrpid, zabbix_userid: u.userid })),
    );
  }
  return u;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!jwt) return new Response(JSON.stringify({ error: "Not authenticated" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const { data: claims, error: cErr } = await userClient.auth.getClaims(jwt);
    if (cErr || !claims?.claims?.sub) return new Response(JSON.stringify({ error: "Not authenticated" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const actorAuthId = claims.claims.sub as string;

    const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
    const { data: actorRows } = await admin.from("zbx_users").select("zabbix_userid, username").eq("auth_user_id", actorAuthId).maybeSingle();

    // Authorization check via has_role
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: actorAuthId, _role: "admin" });
    const { data: isSuper } = await admin.rpc("has_role", { _user_id: actorAuthId, _role: "super_admin" });
    if (!isAdmin && !isSuper) {
      return new Response(JSON.stringify({ error: "Forbidden: admin role required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const url = new URL(req.url);
    const action = url.pathname.split("/").pop() || "";
    const body = await req.json().catch(() => ({}));

    const writeAudit = async (a: string, target: any, before: any, after: any, metadata: any = null) => {
      await admin.from("identity_audit").insert({
        actor_auth_user_id: actorAuthId,
        actor_zabbix_userid: actorRows?.zabbix_userid ?? null,
        actor_username: actorRows?.username ?? null,
        action: a,
        target_zabbix_userid: target?.zabbix_userid ?? target?.userid ?? null,
        target_username: target?.username ?? null,
        before, after, metadata, source: "platform",
      });
    };

    if (action === "create") {
      const { username, name, surname, email, password, roleid, usrgrps } = body;
      if (!username || !password || !roleid || !Array.isArray(usrgrps) || !usrgrps.length) {
        return new Response(JSON.stringify({ error: "username, password, roleid, usrgrps[] are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const res = await zbx("user.create", {
        username, name, surname, passwd: password, roleid,
        usrgrps: usrgrps.map((id: string) => ({ usrgrpid: id })),
        ...(email ? { medias: [{ mediatypeid: "1", sendto: email, active: 0, severity: 63, period: "1-7,00:00-24:00" }] } : {}),
      }) as { userids: string[] };
      const created = await fetchAndMirror(admin, res.userids[0]);
      await writeAudit("user.create", created, null, { username, roleid, usrgrps }, null);
      return new Response(JSON.stringify({ ok: true, user: created }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "update") {
      const { userid, ...patch } = body;
      if (!userid) return new Response(JSON.stringify({ error: "userid required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const { data: before } = await admin.from("zbx_users").select("*").eq("zabbix_userid", userid).maybeSingle();
      const params: any = { userid };
      if (patch.username !== undefined) params.username = patch.username;
      if (patch.name !== undefined) params.name = patch.name;
      if (patch.surname !== undefined) params.surname = patch.surname;
      if (patch.roleid !== undefined) params.roleid = patch.roleid;
      if (patch.usrgrps !== undefined) params.usrgrps = patch.usrgrps.map((id: string) => ({ usrgrpid: id }));
      await zbx("user.update", params);
      const after = await fetchAndMirror(admin, userid);
      await writeAudit("user.update", after, before, after, { changed: Object.keys(patch) });
      return new Response(JSON.stringify({ ok: true, user: after }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "disable" || action === "enable") {
      const { userid } = body;
      if (!userid) return new Response(JSON.stringify({ error: "userid required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      // Disable in Zabbix means putting the user in the "Disabled" usrgrp (gid 9 by default) — but the
      // cleanest cross-version way is to set users_status on every group. We instead use Disabled group
      // when present, otherwise toggle users_status via usrgrp.update on all the user's groups.
      const users = await zbx("user.get", { output: ["userid"], selectUsrgrps: ["usrgrpid", "name", "users_status"], userids: [userid] }) as any[];
      const u = users?.[0];
      if (!u) return new Response(JSON.stringify({ error: "user not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      // Toggle the user's group memberships: move into / out of "Disabled" group if it exists; else flip groups.
      const allGroups = await zbx("usergroup.get", { output: ["usrgrpid", "name", "users_status"] }) as any[];
      const disabled = allGroups.find((g) => /disabled/i.test(g.name));
      const before = await admin.from("zbx_users").select("*").eq("zabbix_userid", userid).maybeSingle();
      if (action === "disable" && disabled) {
        await zbx("user.update", { userid, usrgrps: [{ usrgrpid: disabled.usrgrpid }] });
      } else if (action === "enable" && disabled) {
        // Re-add the user's original groups minus Disabled (if cached). Fallback: put in default "Guests"/"No access" remains user choice.
        const original = (u.usrgrps as any[]).filter((g) => g.usrgrpid !== disabled.usrgrpid);
        const target = original.length ? original.map((g) => ({ usrgrpid: g.usrgrpid })) : [{ usrgrpid: allGroups.find((g) => /zabbix admins/i.test(g.name))?.usrgrpid ?? allGroups[0].usrgrpid }];
        await zbx("user.update", { userid, usrgrps: target });
      } else {
        // No Disabled group — set users_status on all the user's groups
        for (const g of u.usrgrps as any[]) {
          await zbx("usergroup.update", { usrgrpid: g.usrgrpid, users_status: action === "disable" ? 1 : 0 });
        }
      }
      const after = await fetchAndMirror(admin, userid);
      await writeAudit(action === "disable" ? "user.disable" : "user.enable", after, before.data, after, null);
      return new Response(JSON.stringify({ ok: true, user: after }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "reset-password") {
      const { userid, password } = body;
      if (!userid || !password) return new Response(JSON.stringify({ error: "userid and password required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      await zbx("user.update", { userid, passwd: password });
      const after = await fetchAndMirror(admin, userid);
      await writeAudit("password.reset", after, null, { redacted: true }, null);
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "delete") {
      const { userid } = body;
      if (!userid) return new Response(JSON.stringify({ error: "userid required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const { data: before } = await admin.from("zbx_users").select("*").eq("zabbix_userid", userid).maybeSingle();
      await zbx("user.delete", [userid]);
      await admin.from("zbx_users").delete().eq("zabbix_userid", userid);
      await writeAudit("user.delete", before, before, null, null);
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ============================================================
    // USER GROUP ACTIONS
    // ============================================================
    if (action === "group-list") {
      const groups = await zbx("usergroup.get", {
        output: "extend",
        selectUsers: ["userid", "username"],
        selectHostGroupRights: "extend",
      }) as any[];
      // best-effort mirror
      if (Array.isArray(groups)) {
        await admin.from("zbx_user_groups").upsert(
          groups.map((g: any) => ({
            usrgrpid: g.usrgrpid,
            name: g.name,
            gui_access: g.gui_access != null ? Number(g.gui_access) : null,
            users_status: g.users_status != null ? Number(g.users_status) : null,
            last_synced_at: new Date().toISOString(),
          })),
          { onConflict: "usrgrpid" },
        );
      }
      return new Response(JSON.stringify({ ok: true, groups }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "group-create") {
      const { name, gui_access = 0, users_status = 0, userids = [] } = body;
      if (!name) return new Response(JSON.stringify({ error: "name required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const res = await zbx("usergroup.create", {
        name,
        gui_access: String(gui_access),
        users_status: String(users_status),
        ...(userids.length ? { userids } : {}),
      }) as { usrgrpids: string[] };
      await writeAudit("usergroup.create", { username: name }, null, { name, gui_access, users_status, userids }, { usrgrpid: res.usrgrpids?.[0] });
      return new Response(JSON.stringify({ ok: true, usrgrpid: res.usrgrpids?.[0] }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "group-update") {
      const { usrgrpid, ...patch } = body;
      if (!usrgrpid) return new Response(JSON.stringify({ error: "usrgrpid required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const params: any = { usrgrpid };
      if (patch.name !== undefined) params.name = patch.name;
      if (patch.gui_access !== undefined) params.gui_access = String(patch.gui_access);
      if (patch.users_status !== undefined) params.users_status = String(patch.users_status);
      if (Array.isArray(patch.userids)) params.userids = patch.userids;
      await zbx("usergroup.update", params);
      await writeAudit("usergroup.update", { username: patch.name ?? usrgrpid }, null, patch, { usrgrpid });
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "group-delete") {
      const { usrgrpid } = body;
      if (!usrgrpid) return new Response(JSON.stringify({ error: "usrgrpid required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      await zbx("usergroup.delete", [usrgrpid]);
      await admin.from("zbx_user_groups").delete().eq("usrgrpid", usrgrpid);
      await writeAudit("usergroup.delete", { username: usrgrpid }, { usrgrpid }, null, null);
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "roles-list") {
      const roles = await zbx("role.get", { output: "extend" });
      return new Response(JSON.stringify({ ok: true, roles }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "mediatypes-list") {
      const mediatypes = await zbx("mediatype.get", { output: ["mediatypeid", "name", "type", "status"] });
      return new Response(JSON.stringify({ ok: true, mediatypes }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: `Unknown action '${action}'` }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("zabbix-users error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
