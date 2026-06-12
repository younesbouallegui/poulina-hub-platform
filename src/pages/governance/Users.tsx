import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { useI18n } from "@/contexts/I18nContext";
import { useToast } from "@/hooks/use-toast";
import {
  Users as UsersIcon, Loader2, Shield, Search, Filter, Database,
  KeyRound, ShieldCheck, Lock, ChevronRight, Server,
} from "lucide-react";
import type { Database as DB } from "@/integrations/supabase/types";
import { useZabbixUsers, useZabbixUserGroups, useZabbixRoles, type ZUser } from "@/lib/zabbix";
import { cn } from "@/lib/utils";

type Profile = DB["public"]["Tables"]["profiles"]["Row"];
type RoleRow = DB["public"]["Tables"]["user_roles"]["Row"];
type Role = "admin" | "operator" | "auditor" | "viewer";
const ALL_ROLES: Role[] = ["admin", "operator", "auditor", "viewer"];

const ROLE_BADGE: Record<Role, string> = {
  admin: "bg-destructive/15 text-destructive ring-destructive/30",
  operator: "bg-warning/15 text-warning ring-warning/30",
  auditor: "bg-primary/15 text-primary ring-primary/30",
  viewer: "bg-muted text-muted-foreground ring-border",
};

type Tab = "platform" | "zabbix" | "groups" | "roles" | "sso";

const Users = () => {
  const { t } = useI18n();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("platform");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const { data: zUsers = [], isLoading: zUsersLoading } = useZabbixUsers();
  const { data: zGroups = [], isLoading: zGroupsLoading } = useZabbixUserGroups();
  const { data: zRoles = [], isLoading: zRolesLoading } = useZabbixRoles();

  const load = async () => {
    const [p, r] = await Promise.all([
      (supabase as any).from("profiles").select("*").order("created_at", { ascending: false }),
      (supabase as any).from("user_roles").select("*"),
    ]);
    setProfiles(p.data ?? []);
    setRoles(r.data ?? []);
  };

  useEffect(() => { load().finally(() => setLoading(false)); }, []);

  const rolesByUser = useMemo(() => {
    const out: Record<string, Role[]> = {};
    for (const r of roles) (out[r.user_id] ??= []).push(r.role as Role);
    return out;
  }, [roles]);

  const toggleRole = async (userId: string, role: Role) => {
    setSavingId(userId);
    const has = rolesByUser[userId]?.includes(role);
    if (has) {
      const { error } = await (supabase as any).from("user_roles").delete().eq("user_id", userId).eq("role", role);
      if (error) toast({ title: "Failed", description: error.message, variant: "destructive" });
    } else {
      const { error } = await (supabase as any).from("user_roles").insert({ user_id: userId, role });
      if (error) toast({ title: "Failed", description: error.message, variant: "destructive" });
    }
    await load();
    setSavingId(null);
  };

  const filteredZUsers = useMemo(() => {
    const q = search.toLowerCase();
    return zUsers.filter((u) =>
      !q || u.username.toLowerCase().includes(q) ||
      (u.name ?? "").toLowerCase().includes(q) ||
      (u.surname ?? "").toLowerCase().includes(q)
    );
  }, [zUsers, search]);

  const filteredProfiles = useMemo(() => {
    const q = search.toLowerCase();
    return profiles.filter((p) =>
      !q || (p.full_name ?? "").toLowerCase().includes(q) || p.email.toLowerCase().includes(q)
    );
  }, [profiles, search]);

  // counts
  const stats = {
    platform: profiles.length,
    zabbix: zUsers.length,
    groups: zGroups.length,
    roles: zRoles.length,
    admins: roles.filter((r) => r.role === "admin").length,
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title="Identity & Access Management"
        subtitle="Unified governance · platform users, Zabbix directory, RBAC, SSO"
        icon={ShieldCheck}
      />

      {/* KPI strip */}
      <div className="grid gap-3 px-4 sm:px-6 lg:grid-cols-5">
        <KpiCard icon={UsersIcon} label="Platform users" value={stats.platform} />
        <KpiCard icon={Database} label="Zabbix users" value={stats.zabbix} />
        <KpiCard icon={Shield} label="User groups" value={stats.groups} />
        <KpiCard icon={KeyRound} label="Roles" value={stats.roles} />
        <KpiCard icon={Lock} label="Admin grants" value={stats.admins} accent />
      </div>

      {/* Tabs */}
      <div className="mt-4 flex flex-wrap items-center gap-1 border-b border-border px-4 sm:px-6">
        {([
          ["platform", "Platform Users", UsersIcon],
          ["zabbix", "Zabbix Directory", Database],
          ["groups", "User Groups", Shield],
          ["roles", "Roles", KeyRound],
          ["sso", "SSO & Identity", Server],
        ] as const).map(([k, label, Icon]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={cn(
              "inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium transition-colors -mb-px",
              tab === k ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="h-3.5 w-3.5" /> {label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="h-8 w-48 rounded-md border border-border bg-card pl-7 pr-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>
      </div>

      <div className="flex-1 p-4 sm:p-6">
        {tab === "platform" && (
          loading ? <Loading /> : <PlatformUsers profiles={filteredProfiles} rolesByUser={rolesByUser} savingId={savingId} toggleRole={toggleRole} />
        )}
        {tab === "zabbix" && (zUsersLoading ? <Loading /> : <ZabbixUsersTable users={filteredZUsers} groups={zGroups} roles={zRoles} />)}
        {tab === "groups" && (zGroupsLoading ? <Loading /> : <GroupsTable groups={zGroups} users={zUsers} />)}
        {tab === "roles" && (zRolesLoading ? <Loading /> : <RolesTable roles={zRoles} users={zUsers} />)}
        {tab === "sso" && <SSOPanel />}
      </div>
    </div>
  );
};

const Loading = () => (
  <div className="flex items-center justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
);

const KpiCard = ({ icon: Icon, label, value, accent }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number; accent?: boolean }) => (
  <div className="rounded-xl border border-border bg-card p-4">
    <div className="flex items-center justify-between">
      <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", accent ? "bg-destructive/15 text-destructive" : "bg-muted/60")}>
        <Icon className="h-4 w-4" />
      </div>
    </div>
    <p className="mt-3 text-2xl font-semibold tracking-tight">{value}</p>
    <p className="mt-0.5 text-[11px] text-muted-foreground">{label}</p>
  </div>
);

const PlatformUsers = ({ profiles, rolesByUser, savingId, toggleRole }: {
  profiles: Profile[];
  rolesByUser: Record<string, Role[]>;
  savingId: string | null;
  toggleRole: (id: string, role: Role) => void;
}) => {
  if (profiles.length === 0) {
    return <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">No platform users found.</div>;
  }
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-border bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-4 py-3">User</th>
            <th className="px-4 py-3">Email</th>
            <th className="px-4 py-3">RBAC Roles</th>
          </tr>
        </thead>
        <tbody>
          {profiles.map((p) => {
            const userRoles = rolesByUser[p.user_id] ?? [];
            const isSaving = savingId === p.user_id;
            return (
              <tr key={p.id} className="border-b border-border/60 last:border-0 hover:bg-muted/30">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary ring-1 ring-primary/20">
                      {(p.full_name ?? p.email).split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase()}
                    </span>
                    <div>
                      <p className="font-medium text-foreground">{p.full_name ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">{userRoles.length} role{userRoles.length === 1 ? "" : "s"}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.email}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {ALL_ROLES.map((r) => {
                      const active = userRoles.includes(r);
                      return (
                        <button
                          key={r}
                          disabled={isSaving}
                          onClick={() => toggleRole(p.user_id, r)}
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ring-1 transition-all ${
                            active ? ROLE_BADGE[r] : "bg-background text-muted-foreground ring-border opacity-50 hover:opacity-100"
                          } disabled:cursor-not-allowed`}
                        >
                          <Shield className="h-3 w-3" />{r}
                        </button>
                      );
                    })}
                    {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

const ZabbixUsersTable = ({ users, groups, roles }: { users: ZUser[]; groups: { usrgrpid: string; name: string }[]; roles: { roleid: string; name: string }[] }) => {
  const groupName = (id: string) => groups.find((g) => g.usrgrpid === id)?.name ?? id;
  const roleName = (id?: string) => id ? roles.find((r) => r.roleid === id)?.name ?? id : "—";
  if (users.length === 0) {
    return <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">No Zabbix users returned. Check token permissions.</div>;
  }
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-border bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-4 py-3">Username</th>
            <th className="px-4 py-3">Name</th>
            <th className="px-4 py-3">Role</th>
            <th className="px-4 py-3">Groups</th>
            <th className="px-4 py-3 text-right">ID</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.userid} className="border-b border-border/60 last:border-0 hover:bg-muted/30">
              <td className="px-4 py-3 font-medium">{u.username}</td>
              <td className="px-4 py-3 text-muted-foreground">{[u.name, u.surname].filter(Boolean).join(" ") || "—"}</td>
              <td className="px-4 py-3">
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary ring-1 ring-primary/20">
                  <KeyRound className="h-3 w-3" /> {roleName(u.roleid)}
                </span>
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1">
                  {(u.usrgrps ?? []).slice(0, 3).map((g) => (
                    <span key={g.usrgrpid} className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      {g.name ?? groupName(g.usrgrpid)}
                    </span>
                  ))}
                  {(u.usrgrps ?? []).length > 3 && <span className="text-[10px] text-muted-foreground">+{(u.usrgrps ?? []).length - 3}</span>}
                </div>
              </td>
              <td className="px-4 py-3 text-right font-mono text-[10px] text-muted-foreground">#{u.userid}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const GroupsTable = ({ groups, users }: { groups: { usrgrpid: string; name: string; users_status?: string; gui_access?: string }[]; users: ZUser[] }) => {
  const memberCount = (id: string) => users.filter((u) => u.usrgrps?.some((g) => g.usrgrpid === id)).length;
  if (groups.length === 0) return <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">No user groups.</div>;
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-border bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-4 py-3">Group</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">GUI Access</th>
            <th className="px-4 py-3 text-right">Members</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            <tr key={g.usrgrpid} className="border-b border-border/60 last:border-0 hover:bg-muted/30">
              <td className="px-4 py-3 font-medium">{g.name}</td>
              <td className="px-4 py-3">
                <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold", g.users_status === "0" ? "bg-success/15 text-success" : "bg-muted text-muted-foreground")}>
                  {g.users_status === "0" ? "Enabled" : "Disabled"}
                </span>
              </td>
              <td className="px-4 py-3 text-xs text-muted-foreground">
                {g.gui_access === "0" ? "System default" : g.gui_access === "1" ? "Internal" : g.gui_access === "2" ? "LDAP" : g.gui_access === "3" ? "Disabled" : "—"}
              </td>
              <td className="px-4 py-3 text-right font-mono">{memberCount(g.usrgrpid)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const RolesTable = ({ roles, users }: { roles: { roleid: string; name: string; type?: string; readonly?: string }[]; users: ZUser[] }) => {
  const ROLE_TYPE: Record<string, string> = { "1": "User", "2": "Admin", "3": "Super Admin" };
  const usersInRole = (id: string) => users.filter((u) => u.roleid === id).length;
  if (roles.length === 0) return <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">No roles.</div>;
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-border bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-4 py-3">Role</th>
            <th className="px-4 py-3">Type</th>
            <th className="px-4 py-3">Built-in</th>
            <th className="px-4 py-3 text-right">Users</th>
          </tr>
        </thead>
        <tbody>
          {roles.map((r) => (
            <tr key={r.roleid} className="border-b border-border/60 last:border-0 hover:bg-muted/30">
              <td className="px-4 py-3 font-medium">{r.name}</td>
              <td className="px-4 py-3">
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary ring-1 ring-primary/20">
                  <Shield className="h-3 w-3" /> {ROLE_TYPE[r.type ?? ""] ?? "—"}
                </span>
              </td>
              <td className="px-4 py-3 text-xs text-muted-foreground">{r.readonly === "1" ? "Yes" : "No"}</td>
              <td className="px-4 py-3 text-right font-mono">{usersInRole(r.roleid)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const SSOPanel = () => {
  const providers = [
    { id: "ldap", name: "LDAP / Active Directory", status: "configurable", description: "Bind to enterprise directory for user federation. Configured per usergroup via gui_access=2." },
    { id: "saml", name: "SAML 2.0", status: "supported", description: "Zabbix natively supports SAML 2.0 SSO. Configure under Administration → Authentication." },
    { id: "oidc", name: "OpenID Connect (OIDC)", status: "via-saml", description: "Use SAML bridge or HTTP authentication for OIDC providers (Auth0, Okta, Keycloak)." },
    { id: "azure", name: "Microsoft Entra ID (Azure AD)", status: "via-saml", description: "Bridge through SAML or LDAPS. Map Zabbix usergroups to Azure AD groups." },
    { id: "mfa", name: "Multi-Factor Authentication", status: "supported", description: "Zabbix 6.4+ supports TOTP and Duo. Enforce per usergroup." },
  ];
  const STATUS_STYLE: Record<string, string> = {
    supported: "bg-success/15 text-success ring-success/30",
    configurable: "bg-primary/15 text-primary ring-primary/30",
    "via-saml": "bg-warning/15 text-warning ring-warning/30",
  };
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Server className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold">Enterprise Identity Federation</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              SSO is enforced server-side at the Zabbix backend. The UI surfaces the supported strategies; configuration lives in
              Zabbix Admin → Authentication. Group mappings synchronize automatically on login.
            </p>
          </div>
        </div>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {providers.map((p) => (
          <div key={p.id} className="rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted/30">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold">{p.name}</h4>
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ring-1", STATUS_STYLE[p.status])}>
                    {p.status === "via-saml" ? "via SAML" : p.status}
                  </span>
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">{p.description}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-warning/30 bg-warning/5 p-4 text-sm">
        <div className="flex items-start gap-2">
          <Filter className="mt-0.5 h-4 w-4 text-warning" />
          <div>
            <p className="font-semibold text-warning">Privileged Access Boundaries</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Write operations against the Zabbix API (user.create, user.update, host.update, event.acknowledge) require platform
              role <code className="rounded bg-muted px-1">admin</code>. All privileged calls are recorded in the audit log.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Users;
