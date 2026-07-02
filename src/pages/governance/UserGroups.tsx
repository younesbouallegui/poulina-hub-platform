import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Shield, Loader2, Plus, Search, MoreHorizontal, Pencil, Trash2, RefreshCw, Users as UsersIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

type ZGroup = {
  usrgrpid: string;
  name: string;
  gui_access: string | number;
  users_status: string | number;
  users?: Array<{ userid: string; username: string }>;
};
type ZUserLite = { zabbix_userid: string; username: string; name: string | null; surname: string | null };

const GUI_ACCESS_LABEL: Record<string, string> = { "0": "System default", "1": "Internal", "2": "LDAP", "3": "Disabled" };

const UserGroups = () => {
  const { toast } = useToast();
  const { hasRole } = useAuth();
  const canEdit = hasRole("super_admin", "admin");

  const [groups, setGroups] = useState<ZGroup[]>([]);
  const [users, setUsers] = useState<ZUserLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ZGroup | null>(null);
  const [drawerTarget, setDrawerTarget] = useState<ZGroup | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("zabbix-users/group-list", { body: {} });
      if (error) throw new Error(error.message);
      if ((data as any)?.error) throw new Error((data as any).error);
      setGroups(((data as any)?.groups ?? []) as ZGroup[]);
      const u = await (supabase as any).from("zbx_users").select("zabbix_userid, username, name, surname").order("username");
      setUsers(u.data ?? []);
    } catch (e) {
      toast({ title: "Failed to load groups", description: (e as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const call = async (path: string, payload: any, msg: string) => {
    setBusy(payload.usrgrpid ?? "create");
    try {
      const { data, error } = await supabase.functions.invoke(`zabbix-users/${path}`, { body: payload });
      if (error) throw new Error(error.message);
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({ title: msg });
      await load();
    } catch (e) {
      toast({ title: "Action failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return groups.filter((g) => !q || g.name.toLowerCase().includes(q));
  }, [groups, search]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title="User Groups"
        subtitle="Zabbix user groups — live source of truth. Membership and access changes write through immediately."
        icon={Shield}
        action={
          <div className="flex items-center gap-2">
            <button onClick={load} disabled={loading} className="inline-flex items-center gap-1.5 rounded-lg border border-input px-3 py-1.5 text-xs font-medium text-muted-foreground hover:border-primary/40 hover:text-primary disabled:opacity-60">
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Refresh
            </button>
            {canEdit && (
              <button onClick={() => setCreateOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-glow hover:bg-primary-glow">
                <Plus className="h-3.5 w-3.5" /> New group
              </button>
            )}
          </div>
        }
      />

      <div className="grid gap-3 px-4 sm:px-6 lg:grid-cols-4">
        <Kpi icon={Shield} label="Total groups" value={groups.length} />
        <Kpi icon={UsersIcon} label="Members mapped" value={groups.reduce((a, g) => a + (g.users?.length ?? 0), 0)} />
        <Kpi icon={Shield} label="Disabled GUI" value={groups.filter((g) => String(g.gui_access) === "3").length} />
        <Kpi icon={Shield} label="Disabled status" value={groups.filter((g) => String(g.users_status) === "1").length} accent />
      </div>

      <div className="mt-4 flex items-center gap-2 border-b border-border px-4 sm:px-6">
        <p className="py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Groups</p>
        <div className="ml-auto relative">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search groups..."
            className="h-8 w-64 rounded-md border border-border bg-card pl-7 pr-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
      </div>

      <div className="flex-1 p-4 sm:p-6">
        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">No groups found.</div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">GUI Access</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Members</th>
                  <th className="px-4 py-3 w-12 text-right"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((g) => {
                  const isBusy = busy === g.usrgrpid;
                  const disabled = String(g.users_status) === "1";
                  return (
                    <tr key={g.usrgrpid} onClick={() => setDrawerTarget(g)} className="cursor-pointer border-b border-border/60 last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary"><Shield className="h-4 w-4" /></span>
                          <div>
                            <p className="font-medium text-foreground">{g.name}</p>
                            <p className="font-mono text-[10px] text-muted-foreground">id: {g.usrgrpid}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs">{GUI_ACCESS_LABEL[String(g.gui_access)] ?? String(g.gui_access)}</td>
                      <td className="px-4 py-3">
                        <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold", disabled ? "bg-muted text-muted-foreground" : "bg-success/15 text-success")}>
                          {disabled ? "Disabled" : "Enabled"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{g.users?.length ?? 0} member{(g.users?.length ?? 0) === 1 ? "" : "s"}</td>
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        {canEdit && (
                          <DropdownMenu>
                            <DropdownMenuTrigger className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
                              {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              <DropdownMenuItem onClick={() => setEditTarget(g)}><Pencil className="mr-2 h-3.5 w-3.5" /> Edit</DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-destructive focus:text-destructive"
                                onClick={() => { if (confirm(`Delete Zabbix user group '${g.name}'? This cannot be undone.`)) call("group-delete", { usrgrpid: g.usrgrpid }, "Group deleted"); }}>
                                <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
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
      </div>

      <GroupDialog
        open={createOpen} onOpenChange={setCreateOpen} users={users}
        onSubmit={async (p) => { await call("group-create", p, "Group created in Zabbix"); setCreateOpen(false); }}
      />
      <GroupDialog
        target={editTarget} open={!!editTarget} onOpenChange={(v) => !v && setEditTarget(null)} users={users}
        onSubmit={async (p) => { await call("group-update", { usrgrpid: editTarget!.usrgrpid, ...p }, "Group updated"); setEditTarget(null); }}
      />

      {drawerTarget && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-foreground/30 backdrop-blur-sm" onClick={() => setDrawerTarget(null)} />
          <aside className="relative flex h-full w-[420px] flex-col border-l border-border bg-card shadow-elevated animate-slide-in-right">
            <div className="flex items-center justify-between border-b border-border p-4">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">User group</p>
                <h2 className="text-lg font-semibold">{drawerTarget.name}</h2>
              </div>
              <button onClick={() => setDrawerTarget(null)} className="rounded p-1 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <Meta label="GUI access" value={GUI_ACCESS_LABEL[String(drawerTarget.gui_access)] ?? String(drawerTarget.gui_access)} />
                <Meta label="Status" value={String(drawerTarget.users_status) === "1" ? "Disabled" : "Enabled"} />
                <Meta label="usrgrpid" value={drawerTarget.usrgrpid} mono />
                <Meta label="Members" value={String(drawerTarget.users?.length ?? 0)} />
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Members</p>
                <div className="space-y-1 rounded-lg border border-border">
                  {(drawerTarget.users ?? []).length === 0 && <p className="p-3 text-xs text-muted-foreground">No members.</p>}
                  {(drawerTarget.users ?? []).map((u) => (
                    <div key={u.userid} className="flex items-center gap-2 border-b border-border/60 px-3 py-2 last:border-0">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">{u.username.slice(0, 2).toUpperCase()}</span>
                      <span className="text-xs">{u.username}</span>
                      <span className="ml-auto font-mono text-[10px] text-muted-foreground">{u.userid}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
};

const Kpi = ({ icon: Icon, label, value, accent }: { icon: any; label: string; value: number; accent?: boolean }) => (
  <div className="rounded-xl border border-border bg-card p-4">
    <div className={cn("inline-flex h-9 w-9 items-center justify-center rounded-lg", accent ? "bg-destructive/15 text-destructive" : "bg-muted/60")}>
      <Icon className="h-4 w-4" />
    </div>
    <p className="mt-3 text-2xl font-semibold tracking-tight">{value}</p>
    <p className="mt-0.5 text-[11px] text-muted-foreground">{label}</p>
  </div>
);

const Meta = ({ label, value, mono }: { label: string; value: string; mono?: boolean }) => (
  <div>
    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
    <p className={cn("text-sm", mono && "font-mono text-xs")}>{value}</p>
  </div>
);

const GroupDialog = ({ open, onOpenChange, target, users, onSubmit }: {
  open: boolean; onOpenChange: (v: boolean) => void; target?: ZGroup | null; users: ZUserLite[];
  onSubmit: (payload: { name: string; gui_access: number; users_status: number; userids: string[] }) => Promise<void>;
}) => {
  const [name, setName] = useState("");
  const [gui, setGui] = useState(0);
  const [status, setStatus] = useState(0);
  const [members, setMembers] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(target?.name ?? "");
      setGui(Number(target?.gui_access ?? 0));
      setStatus(Number(target?.users_status ?? 0));
      setMembers((target?.users ?? []).map((u) => u.userid));
    }
  }, [open, target]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{target ? `Edit ${target.name}` : "New user group"}</DialogTitle>
          <DialogDescription>Writes through to Zabbix via usergroup.{target ? "update" : "create"}.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium">Name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium">GUI access</label>
              <select value={gui} onChange={(e) => setGui(Number(e.target.value))} className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm">
                <option value={0}>System default</option>
                <option value={1}>Internal</option>
                <option value={2}>LDAP</option>
                <option value={3}>Disabled</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Status</label>
              <select value={status} onChange={(e) => setStatus(Number(e.target.value))} className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm">
                <option value={0}>Enabled</option>
                <option value={1}>Disabled</option>
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Members</label>
            <div className="max-h-48 overflow-y-auto rounded-md border border-border p-2 space-y-1">
              {users.map((u) => (
                <label key={u.zabbix_userid} className="flex cursor-pointer items-center gap-2 text-xs">
                  <input type="checkbox" checked={members.includes(u.zabbix_userid)}
                    onChange={() => setMembers((m) => m.includes(u.zabbix_userid) ? m.filter((x) => x !== u.zabbix_userid) : [...m, u.zabbix_userid])} />
                  {u.username}{u.name ? ` — ${u.name} ${u.surname ?? ""}` : ""}
                </label>
              ))}
              {users.length === 0 && <p className="text-xs text-muted-foreground">No users synced yet.</p>}
            </div>
          </div>
        </div>
        <DialogFooter>
          <button onClick={() => onOpenChange(false)} className="rounded-md border border-input px-3 py-1.5 text-xs">Cancel</button>
          <button disabled={saving || !name}
            onClick={async () => { setSaving(true); try { await onSubmit({ name, gui_access: gui, users_status: status, userids: members }); } finally { setSaving(false); } }}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-60">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} {target ? "Save" : "Create"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default UserGroups;
