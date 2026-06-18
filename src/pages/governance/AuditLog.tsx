import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { useI18n } from "@/contexts/I18nContext";
import { ScrollText, Loader2, Search, Download, ChevronRight, RefreshCw } from "lucide-react";
import { zabbixRpc } from "@/lib/zabbixApi";
import { cn } from "@/lib/utils";

type AuditRow = {
  id: string;
  created_at: string;
  actor_username: string | null;
  actor_zabbix_userid: string | null;
  action: string;
  target_username: string | null;
  target_zabbix_userid: string | null;
  before: any;
  after: any;
  metadata: any;
  source: string | null;
};

type Tab = "platform" | "zabbix";

const ACTION_BADGE: Record<string, string> = {
  login: "bg-primary/15 text-primary ring-primary/30",
  "user.create": "bg-success/15 text-success ring-success/30",
  "user.update": "bg-primary/15 text-primary ring-primary/30",
  "user.disable": "bg-warning/15 text-warning ring-warning/30",
  "user.enable": "bg-success/15 text-success ring-success/30",
  "user.delete": "bg-destructive/15 text-destructive ring-destructive/30",
  "password.reset": "bg-warning/15 text-warning ring-warning/30",
};

const AuditLog = () => {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>("platform");
  const [items, setItems] = useState<AuditRow[]>([]);
  const [zbxItems, setZbxItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [zbxLoading, setZbxLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await (supabase as any)
        .from("identity_audit")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (mounted) { setItems(data ?? []); setLoading(false); }
    })();
    return () => { mounted = false; };
  }, []);

  const loadZbxAudit = async () => {
    setZbxLoading(true);
    try {
      const rows = await zabbixRpc<any[]>("auditlog.get", {
        output: "extend",
        sortfield: ["clock"],
        sortorder: "DESC",
        limit: 200,
      });
      setZbxItems(rows ?? []);
    } catch (e) {
      setZbxItems([]);
    } finally {
      setZbxLoading(false);
    }
  };

  useEffect(() => { if (tab === "zabbix" && zbxItems.length === 0) void loadZbxAudit(); }, [tab]);

  const actions = useMemo(() => Array.from(new Set(items.map((i) => i.action))).sort(), [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((i) => {
      if (actionFilter !== "all" && i.action !== actionFilter) return false;
      if (!q) return true;
      return [i.action, i.actor_username, i.target_username, i.actor_zabbix_userid, i.target_zabbix_userid]
        .filter(Boolean).some((v) => String(v).toLowerCase().includes(q));
    });
  }, [items, search, actionFilter]);

  const exportCsv = () => {
    const header = "timestamp,actor,action,target,zabbix_userid";
    const rows = filtered.map((i) =>
      [i.created_at, i.actor_username ?? "", i.action, i.target_username ?? "", i.target_zabbix_userid ?? ""].join(","),
    );
    const blob = new Blob([header + "\n" + rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `identity-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Audit Log"
        subtitle="Every identity action — login, user changes, role/group assignments, password resets — with before/after diffs."
        icon={ScrollText}
        action={
          <button
            onClick={exportCsv}
            className="inline-flex items-center gap-1.5 rounded-lg border border-input px-3 py-1.5 text-xs font-medium text-muted-foreground transition-all hover:border-primary/40 hover:text-primary"
          >
            <Download className="h-3.5 w-3.5" /> Export CSV
          </button>
        }
      />

      <div className="flex items-center gap-1 border-b border-border px-4 sm:px-6">
        {([["platform", "Platform audit"], ["zabbix", "Zabbix audit"]] as const).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={cn(
              "border-b-2 px-3 py-2 text-xs font-medium -mb-px",
              tab === k ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
        {tab === "zabbix" && (
          <button
            onClick={loadZbxAudit}
            disabled={zbxLoading}
            className="ml-auto inline-flex items-center gap-1 rounded-md border border-input px-2 py-1 text-[11px] text-muted-foreground hover:text-primary"
          >
            {zbxLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />} Refresh
          </button>
        )}
      </div>

      {tab === "platform" && (
        <>
          <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:px-6">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by actor, target, action..."
                className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
              />
            </div>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="h-10 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
            >
              <option value="all">All actions</option>
              {actions.map((e) => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>

          <div className="px-4 pb-8 sm:px-6">
            {loading ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
            ) : filtered.length === 0 ? (
              <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">No audit entries yet.</div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-border bg-card">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-border bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 w-8"></th>
                      <th className="px-4 py-3">When</th>
                      <th className="px-4 py-3">Actor</th>
                      <th className="px-4 py-3">Action</th>
                      <th className="px-4 py-3">Target</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((i) => {
                      const isOpen = openId === i.id;
                      return (
                        <>
                          <tr
                            key={i.id}
                            onClick={() => setOpenId(isOpen ? null : i.id)}
                            className="cursor-pointer border-b border-border/60 last:border-0 hover:bg-muted/30"
                          >
                            <td className="px-4 py-3"><ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform", isOpen && "rotate-90")} /></td>
                            <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{new Date(i.created_at).toLocaleString()}</td>
                            <td className="px-4 py-3 text-foreground">{i.actor_username ?? <span className="italic text-muted-foreground">system</span>}</td>
                            <td className="px-4 py-3">
                              <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1",
                                ACTION_BADGE[i.action] ?? "bg-muted text-muted-foreground ring-border")}>
                                {i.action}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs text-foreground">{i.target_username ?? "—"}</td>
                          </tr>
                          {isOpen && (
                            <tr key={`${i.id}-d`}><td colSpan={5} className="bg-muted/20 px-4 py-3">
                              <DiffView before={i.before} after={i.after} metadata={i.metadata} />
                            </td></tr>
                          )}
                        </>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {tab === "zabbix" && (
        <div className="px-4 pb-8 sm:px-6">
          {zbxLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : zbxItems.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">No Zabbix audit entries returned.</div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">When</th>
                    <th className="px-4 py-3">User ID</th>
                    <th className="px-4 py-3">Action</th>
                    <th className="px-4 py-3">Resource</th>
                    <th className="px-4 py-3">Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {zbxItems.map((r) => (
                    <tr key={r.auditid} className="border-b border-border/60 last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{new Date(Number(r.clock) * 1000).toLocaleString()}</td>
                      <td className="px-4 py-3 font-mono text-xs">{r.userid}</td>
                      <td className="px-4 py-3 text-xs">{r.action}</td>
                      <td className="px-4 py-3 text-xs">{r.resourcetype}</td>
                      <td className="px-4 py-3 truncate text-xs text-muted-foreground" title={r.details ?? ""}>{r.note ?? r.details ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const DiffView = ({ before, after, metadata }: { before: any; after: any; metadata: any }) => (
  <div className="grid gap-3 sm:grid-cols-3">
    <Block title="Before" data={before} />
    <Block title="After" data={after} />
    <Block title="Metadata" data={metadata} />
  </div>
);

const Block = ({ title, data }: { title: string; data: any }) => (
  <div>
    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
    <pre className="max-h-48 overflow-auto rounded-md border border-border bg-background p-2 text-[11px] font-mono leading-relaxed text-foreground">
      {data ? JSON.stringify(data, null, 2) : "—"}
    </pre>
  </div>
);

export default AuditLog;
