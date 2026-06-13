import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, RefreshCw, Search, ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
// useToast no longer needed at this level — drawer owns ack feedback
import { cn } from "@/lib/utils";
import { IncidentDrawer } from "@/components/incidents/IncidentDrawer";
import {
  getProblems,
  getTriggerHosts,
  type ZabbixProblem,
  type ZabbixSeverity,
} from "@/lib/zabbixApi";

const REFRESH_MS = 30_000;

const SEVERITY_META: Record<ZabbixSeverity, { label: string; cls: string; dot: string }> = {
  "5": { label: "Disaster", cls: "bg-red-500/15 text-red-500 ring-red-500/30", dot: "bg-red-500" },
  "4": { label: "High", cls: "bg-orange-500/15 text-orange-500 ring-orange-500/30", dot: "bg-orange-500" },
  "3": { label: "Average", cls: "bg-yellow-500/15 text-yellow-600 ring-yellow-500/30", dot: "bg-yellow-500" },
  "2": { label: "Warning", cls: "bg-blue-500/15 text-blue-500 ring-blue-500/30", dot: "bg-blue-500" },
  "1": { label: "Info", cls: "bg-slate-400/15 text-slate-400 ring-slate-400/30", dot: "bg-slate-400" },
  "0": { label: "Not classified", cls: "bg-muted text-muted-foreground ring-border", dot: "bg-muted-foreground" },
};

function formatDuration(fromUnix: number): string {
  const seconds = Math.max(0, Math.floor(Date.now() / 1000) - fromUnix);
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${s}s`;
  return `${s}s`;
}

interface Row {
  problem: ZabbixProblem;
  hostName: string;
}

const Incidents = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState(REFRESH_MS / 1000);
  const [severityFilter, setSeverityFilter] = useState<ZabbixSeverity | "all">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "ack">("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Row | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const timerRef = useRef<number | null>(null);

  const fetchData = useCallback(async (initial = false) => {
    if (initial) setLoading(true);
    else setRefreshing(true);
    try {
      const problems = await getProblems();
      const triggerIds = Array.from(new Set(problems.map((p) => p.objectid).filter(Boolean)));
      const hostsByTrigger = await getTriggerHosts(triggerIds).catch(() => ({}));
      const built: Row[] = problems.map((p) => {
        const hosts = hostsByTrigger[p.objectid] || [];
        return { problem: p, hostName: hosts[0]?.name || hosts[0]?.host || "—" };
      });
      setRows(built);
      setError(null);
      setLastUpdated(new Date());
      setCountdown(REFRESH_MS / 1000);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setError(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData(true);
  }, [fetchData]);

  // Auto-refresh + countdown
  useEffect(() => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = window.setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          fetchData(false);
          return REFRESH_MS / 1000;
        }
        return c - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [fetchData]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (severityFilter !== "all" && r.problem.severity !== severityFilter) return false;
      if (statusFilter === "open" && r.problem.acknowledged === "1") return false;
      if (statusFilter === "ack" && r.problem.acknowledged !== "1") return false;
      if (query) {
        const q = query.toLowerCase();
        if (
          !r.problem.name.toLowerCase().includes(q) &&
          !r.hostName.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [rows, severityFilter, statusFilter, query]);

  const counts = useMemo(() => {
    const c = { total: rows.length, "5": 0, "4": 0, "3": 0 };
    for (const r of rows) {
      const s = r.problem.severity;
      if (s === "5" || s === "4" || s === "3") c[s]++;
    }
    return c;
  }, [rows]);

  const openIncident = (row: Row) => {
    setSelected(row);
    setDrawerOpen(true);
  };


  return (
    <div className="flex min-h-full flex-col">
      <PageHeader
        title="Incidents"
        subtitle="Live problems from Zabbix"
        actions={
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : "—"}
            </span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-mono text-muted-foreground">
              Refreshing in {countdown}s
            </span>
            <button
              onClick={() => fetchData(false)}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
              Refresh
            </button>
          </div>
        }
      />

      <div className="flex-1 space-y-4 p-4 sm:p-6">
        {/* Summary cards */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard label="Total problems" value={counts.total} tone="default" Icon={ShieldAlert} />
          <SummaryCard label="Disaster" value={counts["5"]} tone="red" Icon={AlertTriangle} />
          <SummaryCard label="High" value={counts["4"]} tone="orange" Icon={AlertTriangle} />
          <SummaryCard label="Average" value={counts["3"]} tone="yellow" Icon={AlertTriangle} />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by host or problem…"
              className="w-full rounded-md border border-input bg-background py-1.5 pl-8 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
          </div>
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value as ZabbixSeverity | "all")}
            className="rounded-md border border-input bg-background px-2 py-1.5 text-xs"
          >
            <option value="all">All severities</option>
            {(Object.keys(SEVERITY_META) as ZabbixSeverity[])
              .sort((a, b) => Number(b) - Number(a))
              .map((s) => (
                <option key={s} value={s}>
                  {SEVERITY_META[s].label}
                </option>
              ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "all" | "open" | "ack")}
            className="rounded-md border border-input bg-background px-2 py-1.5 text-xs"
          >
            <option value="all">All status</option>
            <option value="open">Open</option>
            <option value="ack">Acknowledged</option>
          </select>
        </div>

        {/* Body */}
        {error && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            <p className="font-semibold">Failed to load problems from Zabbix.</p>
            <p className="mt-1 text-xs opacity-80">{error}</p>
            <button
              onClick={() => fetchData(true)}
              className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-destructive px-3 py-1.5 text-xs font-semibold text-destructive-foreground"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Retry
            </button>
          </div>
        )}

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        ) : filtered.length === 0 && !error ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/20 p-10 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-success" />
            <p className="mt-3 text-sm font-semibold text-foreground">No active problems</p>
            <p className="text-xs text-muted-foreground">Everything looks healthy.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="grid grid-cols-[110px_180px_1fr_120px_120px_120px] gap-2 border-b border-border bg-muted/30 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <span>Severity</span>
              <span>Host</span>
              <span>Problem</span>
              <span>Duration</span>
              <span>Status</span>
              <span className="text-right">Actions</span>
            </div>
            <ul className="divide-y divide-border">
              {filtered.map(({ problem, hostName }) => {
                const meta = SEVERITY_META[problem.severity];
                const isAck = problem.acknowledged === "1";
                return (
                  <li
                    key={problem.eventid}
                    onClick={() => openIncident({ problem, hostName })}
                    className="grid cursor-pointer grid-cols-[110px_180px_1fr_120px_120px_120px] items-center gap-2 px-4 py-3 text-sm transition-colors hover:bg-muted/40"
                  >
                    <span
                      className={cn(
                        "inline-flex w-fit items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1",
                        meta.cls,
                      )}
                    >
                      <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
                      {meta.label}
                    </span>
                    <span className="truncate font-mono text-xs text-foreground" title={hostName}>
                      {hostName}
                    </span>
                    <span className="truncate text-foreground" title={problem.name}>
                      {problem.name}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {formatDuration(Number(problem.clock))}
                    </span>
                    <span
                      className={cn(
                        "inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1",
                        isAck
                          ? "bg-success/15 text-success ring-success/30"
                          : "bg-warning/15 text-warning ring-warning/30",
                      )}
                    >
                      {isAck ? "Acknowledged" : "Open"}
                    </span>
                    <div className="flex justify-end">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openIncident({ problem, hostName });
                        }}
                        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-[11px] font-medium hover:bg-muted"
                      >
                        Open
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      <IncidentDrawer
        problem={selected?.problem ?? null}
        hostName={selected?.hostName ?? "—"}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onAcknowledged={() => fetchData(false)}
      />
    </div>
  );
};

function SummaryCard({
  label,
  value,
  tone,
  Icon,
}: {
  label: string;
  value: number;
  tone: "default" | "red" | "orange" | "yellow";
  Icon: React.ComponentType<{ className?: string }>;
}) {
  const toneCls =
    tone === "red"
      ? "border-red-500/30 bg-red-500/5 text-red-500"
      : tone === "orange"
        ? "border-orange-500/30 bg-orange-500/5 text-orange-500"
        : tone === "yellow"
          ? "border-yellow-500/30 bg-yellow-500/5 text-yellow-600"
          : "border-border bg-card text-foreground";
  return (
    <div className={cn("flex items-center justify-between rounded-xl border p-4", toneCls)}>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-70">{label}</p>
        <p className="mt-1 text-3xl font-bold tabular-nums">{value}</p>
      </div>
      <Icon className="h-6 w-6 opacity-60" />
    </div>
  );
}

export default Incidents;
