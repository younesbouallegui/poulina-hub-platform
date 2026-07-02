import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import {
  Users as UsersIcon, Loader2, Shield, Search, ShieldCheck, KeyRound, Lock,
  RefreshCw, Plus, MoreHorizontal, UserX, UserCheck, Trash2, KeyRound as KeyIcon, Pencil,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

type ZUserRow = {
  zabbix_userid: string;
  username: string;
  name: string | null;
  surname: string | null;
  email: string | null;
  roleid: string | null;
  type: number | null;
  status: number;
  auth_user_id: string | null;
  last_synced_at: string;
};
type ZRoleRow = { roleid: string; name: string; type: number; readonly: number };
type ZGroupRow = { usrgrpid: string; name: string; gui_access: number | null; users_status: number | null };
type Member = { usrgrpid: string; zabbix_userid: string };

const ROLE_TYPE_LABEL: Record<number, string> = { 1: "User", 2: "Admin", 3: "Super Admin" };
const ROLE_TYPE_BADGE: Record<number, string> = {
  3: "bg-destructive/15 text-destructive ring-destructive/30",
  2: "bg-warning/15 text-warning ring-warning/30",
  1: "bg-primary/15 text-primary ring-primary/30",
};

const Users = () => {
  const { toast } = useToast();
  const { hasRole } = useAuth();
  const canEdit = hasRole("super_admin", "admin");

  const [users, setUsers] = useState<ZUserRow[]>([]);
  const [roles, setRoles] = useState<ZRoleRow[]>([]);
  const [groups, setGroups] = useState<ZGroupRow[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ZUserRow | null>(null);
  const [resetTarget, setResetTarget] = useState<ZUserRow | null>(null);
  const [removeTarget, setRemoveTarget] = useState<ZUserRow | null>(null);
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "enabled" | "disabled">("all");
  const [page, setPage] = useState(1);
  const pageSize = 25;


  const load = async () => {
    const [u, r, g, m] = await Promise.all([
      (supabase as any).from("zbx_users").select("*").order("username"),
      (supabase as any).from("zbx_roles").select("*"),
      (supabase as any).from("zbx_user_groups").select("*").order("name"),
      (supabase as any).from("zbx_user_group_members").select("*"),
    ]);
    setUsers(u.data ?? []);
    setRoles(r.data ?? []);
    setGroups(g.data ?? []);
    setMembers(m.data ?? []);
  };

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  const sync = async () => {
    setSyncing(true);
    try {
      const { error } = await supabase.functions.invoke("zabbix-sync", { body: {} });
      if (error) throw error;
      await load();
      toast({ title: "Synced with Zabbix" });
    } catch (e) {
      toast({ title: "Sync failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  const callUserAction = async (path: string, payload: any, successMsg: string) => {
    setBusyId(payload.userid ?? "create");
    try {
      const { data, error } = await supabase.functions.invoke(`zabbix-users/${path}`, { body: payload });
      if (error) throw new Error(error.message);
      if ((data as any)?.error) throw new Error((data as any).error);
      await load();
      toast({ title: successMsg });
      return data;
    } catch (e) {
      toast({ title: "Action failed", description: (e as Error).message, variant: "destructive" });
      throw e;
    } finally {
      setBusyId(null);
    }
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return users.filter((u) => {
      if (q && !(u.username.toLowerCase().includes(q) ||
        (u.name ?? "").toLowerCase().includes(q) ||
        (u.surname ?? "").toLowerCase().includes(q) ||
        (u.email ?? "").toLowerCase().includes(q))) return false;
      if (roleFilter !== "all" && u.roleid !== roleFilter) return false;
      if (statusFilter !== "all") {
        const isDisabled = u.status === 1;
        if (statusFilter === "enabled" && isDisabled) return false;
        if (statusFilter === "disabled" && !isDisabled) return false;
      }
      return true;
    });
  }, [users, search, roleFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);
  useEffect(() => { setPage(1); }, [search, roleFilter, statusFilter]);

  const exportCsv = () => {
    const header = "username,name,surname,email,role,status";
    const rows = filtered.map((u) => {
      const r = roles.find((x) => x.roleid === u.roleid);
      return [u.username, u.name ?? "", u.surname ?? "", u.email ?? "", r?.name ?? "", u.status === 1 ? "disabled" : "enabled"].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",");
    });
    const blob = new Blob([header + "\n" + rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `zabbix-users-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };


  const groupNamesFor = (userid: string) =>
    members.filter((m) => m.zabbix_userid === userid)
      .map((m) => groups.find((g) => g.usrgrpid === m.usrgrpid)?.name)
      .filter(Boolean) as string[];

  const roleFor = (u: ZUserRow) => roles.find((r) => r.roleid === u.roleid);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title="Identity & Access (Zabbix)"
        subtitle="Zabbix is the source of truth. All changes here write through to Zabbix and are audited."
        icon={ShieldCheck}
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={sync}
              disabled={syncing}
              className="inline-flex items-center gap-1.5 rounded-lg border border-input px-3 py-1.5 text-xs font-medium text-muted-foreground transition-all hover:border-primary/40 hover:text-primary disabled:opacity-60"
            >
              {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Sync now
            </button>
            {canEdit && (
              <button
                onClick={() => setCreateOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-glow transition-all hover:bg-primary-glow"
              >
                <Plus className="h-3.5 w-3.5" /> Create user
              </button>
            )}
          </div>
        }
      />

      <div className="grid gap-3 px-4 sm:px-6 lg:grid-cols-4">
        <Kpi icon={UsersIcon} label="Zabbix users" value={users.length} />
        <Kpi icon={Shield} label="User groups" value={groups.length} />
        <Kpi icon={KeyRound} label="Roles" value={roles.length} />
        <Kpi
          icon={Lock}
          label="Super admins"
          value={users.filter((u) => roleFor(u)?.type === 3).length}
          accent
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-b border-border px-4 sm:px-6">
        <p className="py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Users</p>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search users..."
              className="h-8 w-56 rounded-md border border-border bg-card pl-7 pr-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}
            className="h-8 rounded-md border border-border bg-card px-2 text-xs">
            <option value="all">All roles</option>
            {roles.map((r) => <option key={r.roleid} value={r.roleid}>{r.name}</option>)}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}
            className="h-8 rounded-md border border-border bg-card px-2 text-xs">
            <option value="all">All statuses</option>
            <option value="enabled">Enabled</option>
            <option value="disabled">Disabled</option>
          </select>
          <button onClick={exportCsv} className="inline-flex h-8 items-center gap-1 rounded-md border border-input px-2 text-xs text-muted-foreground hover:text-primary hover:border-primary/40">
            Export CSV
          </button>
        </div>
      </div>


      <div className="flex-1 p-4 sm:p-6">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
            <p className="font-medium text-foreground">No users yet</p>
            <p className="mt-1">Click <strong>Sync now</strong> to pull users from Zabbix.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Groups</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right w-12"></th>
                </tr>
              </thead>
              <tbody>
                {paged.map((u) => {
                  const role = roleFor(u);
                  const userGroups = groupNamesFor(u.zabbix_userid);
                  const isBusy = busyId === u.zabbix_userid;
                  const isDisabled =
                    userGroups.some((n) => /disabled/i.test(n)) || u.status === 1;
                  return (
                    <tr key={u.zabbix_userid} className="border-b border-border/60 last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary ring-1 ring-primary/20">
                            {(u.name || u.username).split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase()}
                          </span>
                          <div>
                            <p className="font-medium text-foreground">{[u.name, u.surname].filter(Boolean).join(" ") || u.username}</p>
                            <p className="text-xs text-muted-foreground">{u.username}{u.email ? ` · ${u.email}` : ""}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {role ? (
                          <span className={cn(
                            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1",
                            ROLE_TYPE_BADGE[role.type] ?? "bg-muted text-muted-foreground ring-border",
                          )}>
                            <Shield className="h-3 w-3" /> {role.name}
                          </span>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {userGroups.slice(0, 3).map((n) => (
                            <span key={n} className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{n}</span>
                          ))}
                          {userGroups.length > 3 && <span className="text-[10px] text-muted-foreground">+{userGroups.length - 3}</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          "rounded px-1.5 py-0.5 text-[10px] font-semibold",
                          isDisabled ? "bg-muted text-muted-foreground" : "bg-success/15 text-success",
                        )}>
                          {isDisabled ? "Disabled" : "Enabled"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {canEdit && (
                          <DropdownMenu>
                            <DropdownMenuTrigger className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
                              {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              <DropdownMenuItem onClick={() => setEditTarget(u)}>
                                <Pencil className="mr-2 h-3.5 w-3.5" /> Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setResetTarget(u)}>
                                <KeyIcon className="mr-2 h-3.5 w-3.5" /> Reset password
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => callUserAction(isDisabled ? "enable" : "disable", { userid: u.zabbix_userid }, isDisabled ? "User enabled" : "User disabled")}
                              >
                                {isDisabled
                                  ? <><UserCheck className="mr-2 h-3.5 w-3.5" /> Enable</>
                                  : <><UserX className="mr-2 h-3.5 w-3.5" /> Disable</>}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => setRemoveTarget(u)}
                              >
                                <Trash2 className="mr-2 h-3.5 w-3.5" /> Remove…
                              </DropdownMenuItem>

                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {filtered.length > pageSize && (
          <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
            <span>Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} of {filtered.length}</span>
            <div className="flex items-center gap-2">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded border border-input px-2 py-1 disabled:opacity-40">Prev</button>
              <span>Page {page} / {totalPages}</span>
              <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="rounded border border-input px-2 py-1 disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </div>


      <CreateUserDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        roles={roles}
        groups={groups}
        onSubmit={async (payload) => {
          await callUserAction("create", payload, "User created in Zabbix");
          setCreateOpen(false);
        }}
      />
      <EditUserDialog
        target={editTarget}
        onClose={() => setEditTarget(null)}
        roles={roles}
        groups={groups}
        members={members}
        onSubmit={async (payload) => {
          await callUserAction("update", payload, "User updated");
          setEditTarget(null);
        }}
      />
      <ResetPasswordDialog
        target={resetTarget}
        onClose={() => setResetTarget(null)}
        onSubmit={async (payload) => {
          await callUserAction("reset-password", payload, "Password reset");
          setResetTarget(null);
        }}
      />
      <RemoveUserDialog
        target={removeTarget}
        onClose={() => setRemoveTarget(null)}
        onDisable={async () => { if (!removeTarget) return; await callUserAction("disable", { userid: removeTarget.zabbix_userid }, "User disabled"); setRemoveTarget(null); }}
        onDelete={async () => { if (!removeTarget) return; await callUserAction("delete", { userid: removeTarget.zabbix_userid }, "User deleted"); setRemoveTarget(null); }}
      />
    </div>
  );

};

const Kpi = ({ icon: Icon, label, value, accent }: { icon: any; label: string; value: number; accent?: boolean }) => (
  <div className="rounded-xl border border-border bg-card p-4">
    <div className={cn("inline-flex h-9 w-9 items-center justify-center rounded-lg",
      accent ? "bg-destructive/15 text-destructive" : "bg-muted/60")}>
      <Icon className="h-4 w-4" />
    </div>
    <p className="mt-3 text-2xl font-semibold tracking-tight">{value}</p>
    <p className="mt-0.5 text-[11px] text-muted-foreground">{label}</p>
  </div>
);

const CreateUserDialog = ({
  open, onOpenChange, roles, groups, onSubmit,
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  roles: ZRoleRow[]; groups: ZGroupRow[];
  onSubmit: (payload: any) => Promise<void>;
}) => {
  const [form, setForm] = useState({ username: "", name: "", surname: "", email: "", password: "", confirm: "", roleid: "", usrgrps: [] as string[], status: 0 });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm({ username: "", name: "", surname: "", email: "", password: "", confirm: "", roleid: roles[0]?.roleid ?? "", usrgrps: [], status: 0 });
  }, [open, roles]);


  const toggleGroup = (id: string) =>
    setForm((f) => ({ ...f, usrgrps: f.usrgrps.includes(id) ? f.usrgrps.filter((g) => g !== id) : [...f.usrgrps, id] }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Zabbix user</DialogTitle>
          <DialogDescription>The user is created in Zabbix and mirrored locally. They can log in immediately using these credentials.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Field label="Username" required value={form.username} onChange={(v) => setForm({ ...form, username: v })} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="First name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
            <Field label="Last name" value={form.surname} onChange={(v) => setForm({ ...form, surname: v })} />
          </div>
          <Field label="Email" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Password" type="password" required value={form.password} onChange={(v) => setForm({ ...form, password: v })} />
            <Field label="Confirm password" type="password" required value={form.confirm} onChange={(v) => setForm({ ...form, confirm: v })} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Status</label>
            <select value={form.status} onChange={(e) => setForm({ ...form, status: Number(e.target.value) })}
              className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm">
              <option value={0}>Enabled</option>
              <option value={1}>Disabled</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium">Role</label>
            <select
              value={form.roleid}
              onChange={(e) => setForm({ ...form, roleid: e.target.value })}
              className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
            >
              {roles.map((r) => <option key={r.roleid} value={r.roleid}>{r.name} ({ROLE_TYPE_LABEL[r.type] ?? "—"})</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">User groups</label>
            <div className="max-h-40 overflow-y-auto rounded-md border border-border p-2 space-y-1">
              {groups.map((g) => (
                <label key={g.usrgrpid} className="flex cursor-pointer items-center gap-2 text-xs">
                  <input type="checkbox" checked={form.usrgrps.includes(g.usrgrpid)} onChange={() => toggleGroup(g.usrgrpid)} />
                  {g.name}
                </label>
              ))}
              {groups.length === 0 && <p className="text-xs text-muted-foreground">No groups synced yet — run Sync first.</p>}
            </div>
          </div>
        </div>
        <DialogFooter>
          <button onClick={() => onOpenChange(false)} className="rounded-md border border-input px-3 py-1.5 text-xs">Cancel</button>
          <button
            disabled={saving || !form.username || !form.password || form.password !== form.confirm || !form.roleid || form.usrgrps.length === 0}
            onClick={async () => { setSaving(true); try { const { confirm, ...payload } = form; await onSubmit(payload); } finally { setSaving(false); } }}

            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-60"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Create
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const EditUserDialog = ({
  target, onClose, roles, groups, members, onSubmit,
}: {
  target: ZUserRow | null; onClose: () => void;
  roles: ZRoleRow[]; groups: ZGroupRow[]; members: Member[];
  onSubmit: (payload: any) => Promise<void>;
}) => {
  const [form, setForm] = useState({ name: "", surname: "", roleid: "", usrgrps: [] as string[] });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (target) {
      setForm({
        name: target.name ?? "",
        surname: target.surname ?? "",
        roleid: target.roleid ?? "",
        usrgrps: members.filter((m) => m.zabbix_userid === target.zabbix_userid).map((m) => m.usrgrpid),
      });
    }
  }, [target, members]);

  if (!target) return null;
  const toggleGroup = (id: string) =>
    setForm((f) => ({ ...f, usrgrps: f.usrgrps.includes(id) ? f.usrgrps.filter((g) => g !== id) : [...f.usrgrps, id] }));

  return (
    <Dialog open={!!target} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit {target.username}</DialogTitle>
          <DialogDescription>Changes write through to Zabbix immediately.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="First name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
            <Field label="Last name" value={form.surname} onChange={(v) => setForm({ ...form, surname: v })} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Role</label>
            <select
              value={form.roleid}
              onChange={(e) => setForm({ ...form, roleid: e.target.value })}
              className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
            >
              {roles.map((r) => <option key={r.roleid} value={r.roleid}>{r.name} ({ROLE_TYPE_LABEL[r.type] ?? "—"})</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">User groups</label>
            <div className="max-h-40 overflow-y-auto rounded-md border border-border p-2 space-y-1">
              {groups.map((g) => (
                <label key={g.usrgrpid} className="flex cursor-pointer items-center gap-2 text-xs">
                  <input type="checkbox" checked={form.usrgrps.includes(g.usrgrpid)} onChange={() => toggleGroup(g.usrgrpid)} />
                  {g.name}
                </label>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <button onClick={onClose} className="rounded-md border border-input px-3 py-1.5 text-xs">Cancel</button>
          <button
            disabled={saving || form.usrgrps.length === 0}
            onClick={async () => { setSaving(true); try { await onSubmit({ userid: target.zabbix_userid, ...form }); } finally { setSaving(false); } }}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-60"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const ResetPasswordDialog = ({ target, onClose, onSubmit }: {
  target: ZUserRow | null; onClose: () => void;
  onSubmit: (payload: { userid: string; password: string }) => Promise<void>;
}) => {
  const [pw, setPw] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (target) setPw(""); }, [target]);
  if (!target) return null;
  return (
    <Dialog open={!!target} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Reset password</DialogTitle>
          <DialogDescription>Set a new Zabbix password for <strong>{target.username}</strong>. The user should change it after next login.</DialogDescription>
        </DialogHeader>
        <Field label="New password" type="password" value={pw} onChange={setPw} />
        <DialogFooter>
          <button onClick={onClose} className="rounded-md border border-input px-3 py-1.5 text-xs">Cancel</button>
          <button
            disabled={saving || pw.length < 6}
            onClick={async () => { setSaving(true); try { await onSubmit({ userid: target.zabbix_userid, password: pw }); } finally { setSaving(false); } }}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-60"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Reset
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const RemoveUserDialog = ({ target, onClose, onDisable, onDelete }: {
  target: ZUserRow | null; onClose: () => void; onDisable: () => Promise<void>; onDelete: () => Promise<void>;
}) => {
  const [busy, setBusy] = useState<"disable" | "delete" | null>(null);
  if (!target) return null;
  return (
    <Dialog open={!!target} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Remove {target.username}</DialogTitle>
          <DialogDescription>
            Choose how to remove this Zabbix user. Disable is reversible; Delete calls <span className="font-mono">user.delete</span> and cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex gap-2 sm:justify-between">
          <button onClick={onClose} className="rounded-md border border-input px-3 py-1.5 text-xs">Cancel</button>
          <div className="flex gap-2">
            <button disabled={!!busy}
              onClick={async () => { setBusy("disable"); try { await onDisable(); } finally { setBusy(null); } }}
              className="inline-flex items-center gap-1.5 rounded-md border border-warning/40 bg-warning/10 px-3 py-1.5 text-xs font-semibold text-warning disabled:opacity-60">
              {busy === "disable" && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Disable
            </button>
            <button disabled={!!busy}
              onClick={async () => { if (confirm(`Permanently delete '${target.username}' from Zabbix?`)) { setBusy("delete"); try { await onDelete(); } finally { setBusy(null); } } }}
              className="inline-flex items-center gap-1.5 rounded-md bg-destructive px-3 py-1.5 text-xs font-semibold text-destructive-foreground disabled:opacity-60">
              {busy === "delete" && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Delete
            </button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};


const Field = ({ label, value, onChange, type = "text", required }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean;
}) => (
  <div>
    <label className="mb-1 block text-xs font-medium">
      {label}{required && <span className="text-destructive"> *</span>}
    </label>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
    />
  </div>
);

export default Users;
