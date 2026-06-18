// zabbix-sync: reconcile zbx_users / zbx_roles / zbx_user_groups with the
// authoritative Zabbix server. Triggered on demand from the Users page and
// optionally via pg_cron. Service-role only writes; reads any authenticated
// user (the function itself requires a valid JWT).
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!jwt) return new Response(JSON.stringify({ error: "Not authenticated" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: `Bearer ${jwt}` } } });
    const { data: claims, error: cErr } = await userClient.auth.getClaims(jwt);
    if (cErr || !claims?.claims?.sub) return new Response(JSON.stringify({ error: "Not authenticated" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
    const ts = new Date().toISOString();

    const [roles, groups, users] = await Promise.all([
      zbx("role.get", { output: "extend" }) as Promise<any[]>,
      zbx("usergroup.get", { output: "extend" }) as Promise<any[]>,
      zbx("user.get", { output: "extend", selectRole: "extend", selectUsrgrps: ["usrgrpid"] }) as Promise<any[]>,
    ]);

    if (roles.length) {
      await admin.from("zbx_roles").upsert(roles.map((r: any) => ({
        roleid: r.roleid, name: r.name, type: Number(r.type ?? 1),
        readonly: Number(r.readonly ?? 0), last_synced_at: ts,
      })), { onConflict: "roleid" });
    }
    if (groups.length) {
      await admin.from("zbx_user_groups").upsert(groups.map((g: any) => ({
        usrgrpid: g.usrgrpid, name: g.name,
        gui_access: g.gui_access != null ? Number(g.gui_access) : null,
        users_status: g.users_status != null ? Number(g.users_status) : null,
        last_synced_at: ts,
      })), { onConflict: "usrgrpid" });
    }
    if (users.length) {
      await admin.from("zbx_users").upsert(users.map((u: any) => {
        const role = Array.isArray(u.role) ? u.role[0] : u.role;
        return {
          zabbix_userid: u.userid,
          username: u.username,
          name: u.name ?? null,
          surname: u.surname ?? null,
          email: u.email ?? null,
          roleid: u.roleid ?? role?.roleid ?? null,
          type: role?.type ? Number(role.type) : (u.type ? Number(u.type) : null),
          status: Number(u.users_status ?? 0),
          last_synced_at: ts,
        };
      }), { onConflict: "zabbix_userid" });

      // Replace membership rows for known users
      const ids = users.map((u: any) => u.userid);
      await admin.from("zbx_user_group_members").delete().in("zabbix_userid", ids);
      const rows: any[] = [];
      for (const u of users) {
        for (const g of (u.usrgrps ?? []) as any[]) {
          rows.push({ zabbix_userid: u.userid, usrgrpid: g.usrgrpid });
        }
      }
      if (rows.length) await admin.from("zbx_user_group_members").insert(rows);
    }

    return new Response(JSON.stringify({ ok: true, counts: { roles: roles.length, groups: groups.length, users: users.length } }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("zabbix-sync error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
