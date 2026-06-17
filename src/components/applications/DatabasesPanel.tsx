import { useMemo, useState } from "react";
import { ArrowLeft, Database as DbIcon, ShieldCheck, AlertTriangle, Activity, HardDrive, Network, Server, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Application, AppDbHealth, AppStatus } from "@/types/applications";
import { aggregateDbMetrics, generateDbInsights, getAppDatabases } from "@/lib/appDatabases";
import { cn } from "@/lib/utils";

function statusTone(s?: AppStatus) {
  return s === "critical" ? "text-destructive"
    : s === "degraded" ? "text-destructive"
    : s === "warning" ? "text-warning"
    : s === "healthy" ? "text-success" : "text-muted-foreground";
}

function StatusDot({ s }: { s?: AppStatus }) {
  const color = s === "critical" || s === "degraded" ? "bg-destructive"
    : s === "warning" ? "bg-warning"
    : s === "healthy" ? "bg-success" : "bg-muted-foreground";
  return <span className={cn("inline-block h-2 w-2 rounded-full", color)} />;
}

function Mini({ label, value, hint, tone }: { label: string; value: React.ReactNode; hint?: string; tone?: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-card p-2.5">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn("mt-0.5 text-base font-bold tabular-nums", tone)}>{value}</div>
      {hint && <div className="text-[10px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

export default function DatabasesPanel({ app }: { app: Application }) {
  const dbs = useMemo(() => getAppDatabases(app), [app]);
  const agg = useMemo(() => aggregateDbMetrics(dbs), [dbs]);
  const [selected, setSelected] = useState<string | null>(null);
  const current = dbs.find((d) => d.id === selected) ?? null;

  if (!dbs.length) {
    return (
      <section className="rounded-xl border border-border bg-card p-8 text-center">
        <DbIcon className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
        <p className="text-sm font-medium">No direct database attached</p>
        <p className="mt-1 text-xs text-muted-foreground">This application has 0 databases. Application metrics continue to be monitored normally.</p>
      </section>
    );
  }

  if (current) {
    return <DatabaseDetail db={current} onBack={() => setSelected(null)} />;
  }

  const isSingle = dbs.length === 1;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-5">
        <Mini label="Databases" value={agg.count} />
        <Mini label="Avg latency" value={`${agg.avgLatencyMs}ms`} />
        <Mini label="Total connections" value={agg.totalConnections} />
        <Mini label="Total QPS" value={agg.totalQps.toLocaleString()} />
        <Mini label="Error rate" value={`${agg.avgErrorRate}%`} tone={statusTone(agg.worstStatus)} />
      </div>

      <div className={cn("grid gap-3", isSingle ? "grid-cols-1" : "md:grid-cols-2 xl:grid-cols-3")}>
        {dbs.map((d) => (
          <button
            key={d.id}
            onClick={() => setSelected(d.id ?? null)}
            className="group rounded-xl border border-border bg-card p-4 text-left transition hover:border-primary/50 hover:shadow-elevated"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="rounded-md bg-muted p-2"><DbIcon className="h-4 w-4" /></div>
                <div>
                  <div className="text-sm font-semibold group-hover:text-primary">{d.name}</div>
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{d.engine} · {d.role ?? "primary"}</div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] font-medium">
                <StatusDot s={d.status} />
                <span className={statusTone(d.status)}>{d.status ?? "healthy"}</span>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
              <Mini label="CPU" value={`${d.cpuPct ?? 0}%`} />
              <Mini label="Mem" value={`${d.memoryPct ?? 0}%`} />
              <Mini label="Conn" value={`${d.connections}/${d.maxConnections}`} />
              <Mini label="Latency" value={`${d.latencyMs ?? 0}ms`} />
              <Mini label="QPS" value={(d.qps ?? 0).toLocaleString()} />
              <Mini label="Storage" value={`${d.storageUsedPct.toFixed(0)}%`} />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function DatabaseDetail({ db, onBack }: { db: AppDbHealth; onBack: () => void }) {
  const insights = useMemo(() => generateDbInsights(db), [db]);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button size="sm" variant="outline" onClick={onBack}><ArrowLeft className="mr-1 h-3.5 w-3.5" />All databases</Button>
          <div>
            <div className="flex items-center gap-2 text-base font-semibold"><DbIcon className="h-4 w-4" />{db.name}</div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{db.engine} · {db.role ?? "primary"} · uptime {db.uptimeDays}d</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-xs"><StatusDot s={db.status} /><span className={statusTone(db.status)}>{db.status ?? "healthy"}</span></div>
      </div>

      <Tabs defaultValue="infra">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="infra"><Server className="mr-1 h-3.5 w-3.5" />Infrastructure</TabsTrigger>
          <TabsTrigger value="perf"><Activity className="mr-1 h-3.5 w-3.5" />Performance</TabsTrigger>
          <TabsTrigger value="conn"><Network className="mr-1 h-3.5 w-3.5" />Connections</TabsTrigger>
          <TabsTrigger value="query">Queries</TabsTrigger>
          <TabsTrigger value="locks">Locks</TabsTrigger>
          <TabsTrigger value="storage"><HardDrive className="mr-1 h-3.5 w-3.5" />Storage</TabsTrigger>
          <TabsTrigger value="errors"><AlertTriangle className="mr-1 h-3.5 w-3.5" />Errors</TabsTrigger>
          <TabsTrigger value="repl">Replication</TabsTrigger>
          <TabsTrigger value="backup"><ShieldCheck className="mr-1 h-3.5 w-3.5" />Backup</TabsTrigger>
          <TabsTrigger value="ai"><Sparkles className="mr-1 h-3.5 w-3.5" />AI Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="infra" className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
          <Mini label="CPU" value={`${db.cpuPct ?? 0}%`} />
          <Mini label="Memory" value={`${db.memoryPct ?? 0}%`} />
          <Mini label="Disk IOPS" value={(db.diskIops ?? 0).toLocaleString()} />
          <Mini label="Latency" value={`${db.latencyMs ?? 0}ms`} />
          <Mini label="Network" value="ok" />
          <Mini label="Uptime" value={`${db.uptimeDays}d`} />
        </TabsContent>

        <TabsContent value="perf" className="grid gap-3 md:grid-cols-3 lg:grid-cols-5">
          <Mini label="QPS" value={(db.qps ?? 0).toLocaleString()} />
          <Mini label="TPS" value={(db.tps ?? 0).toLocaleString()} />
          <Mini label="P95" value={`${db.p95Ms ?? 0}ms`} />
          <Mini label="P99" value={`${db.p99Ms ?? 0}ms`} />
          <Mini label="Slow queries" value={db.slowQueries} tone={db.slowQueries > 50 ? "text-destructive" : ""} />
        </TabsContent>

        <TabsContent value="conn" className="grid gap-3 md:grid-cols-4">
          <Mini label="Active" value={db.activeConnections ?? 0} />
          <Mini label="Idle" value={db.idleConnections ?? 0} />
          <Mini label="Failed" value={db.failedConnections ?? 0} tone={(db.failedConnections ?? 0) > 5 ? "text-destructive" : ""} />
          <Mini label="Max" value={db.maxConnections} />
        </TabsContent>

        <TabsContent value="query">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr><th className="px-2 py-2">Query</th><th className="px-2 py-2">Avg</th><th className="px-2 py-2">Calls</th><th className="px-2 py-2">Last seen</th></tr>
            </thead>
            <tbody>
              {(db.slowQueryList ?? []).map((q) => (
                <tr key={q.id} className="border-t border-border/40">
                  <td className="px-2 py-2 font-mono">{q.sql}</td>
                  <td className="px-2 py-2 font-mono">{q.avgMs}ms</td>
                  <td className="px-2 py-2 font-mono">{q.calls.toLocaleString()}</td>
                  <td className="px-2 py-2">{new Date(q.lastSeen).toLocaleTimeString()}</td>
                </tr>
              ))}
              {!(db.slowQueryList ?? []).length && <tr><td colSpan={4} className="py-6 text-center text-muted-foreground">No slow queries recorded</td></tr>}
            </tbody>
          </table>
        </TabsContent>

        <TabsContent value="locks" className="grid gap-3 md:grid-cols-3">
          <Mini label="Deadlocks" value={db.deadlocks ?? 0} tone={(db.deadlocks ?? 0) > 2 ? "text-destructive" : ""} />
          <Mini label="Lock waits" value={db.lockWaits ?? 0} />
          <Mini label="Locks held" value={db.locks} />
        </TabsContent>

        <TabsContent value="storage" className="grid gap-3 md:grid-cols-5">
          <Mini label="DB size" value={`${db.dbSizeGb ?? 0} GB`} />
          <Mini label="Used" value={`${db.storageUsedPct.toFixed(0)}%`} tone={db.storageUsedPct > 85 ? "text-warning" : ""} />
          <Mini label="Tables" value={db.tables ?? 0} />
          <Mini label="Indexes" value={db.indexes ?? 0} />
          <Mini label="Growth" value={`${db.growthGbPerDay ?? 0} GB/d`} />
        </TabsContent>

        <TabsContent value="errors" className="grid gap-3 md:grid-cols-3">
          <Mini label="Query errors" value={db.queryErrors ?? 0} tone={(db.queryErrors ?? 0) > 20 ? "text-destructive" : ""} />
          <Mini label="Failed conns" value={db.failedConnections ?? 0} />
          <Mini label="Error rate" value={`${(db.errorRate ?? 0).toFixed(2)}%`} />
        </TabsContent>

        <TabsContent value="repl" className="grid gap-3 md:grid-cols-3">
          <Mini label="Lag" value={`${db.replicationLagMs}ms`} tone={db.replicationLagMs > 5000 ? "text-destructive" : ""} />
          <Mini label="Sync status" value={db.replicaStatus ?? "n/a"} />
          <Mini label="Role" value={db.role ?? "primary"} />
        </TabsContent>

        <TabsContent value="backup">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr><th className="px-2 py-2">Started</th><th className="px-2 py-2">Type</th><th className="px-2 py-2">Duration</th><th className="px-2 py-2">Size</th><th className="px-2 py-2">Status</th><th className="px-2 py-2">Restore test</th></tr>
            </thead>
            <tbody>
              {(db.backups ?? []).map((b) => (
                <tr key={b.id} className="border-t border-border/40">
                  <td className="px-2 py-2">{new Date(b.startedAt).toLocaleString()}</td>
                  <td className="px-2 py-2"><Badge variant="secondary">{b.type}</Badge></td>
                  <td className="px-2 py-2 font-mono">{Math.round(b.durationMs / 1000)}s</td>
                  <td className="px-2 py-2 font-mono">{b.sizeMb} MB</td>
                  <td className="px-2 py-2"><Badge variant={b.status === "failed" ? "destructive" : "secondary"}>{b.status}</Badge></td>
                  <td className="px-2 py-2">{b.restoreTested === undefined ? "—" : b.restoreTested ? "passed" : "failed"}</td>
                </tr>
              ))}
              {!(db.backups ?? []).length && <tr><td colSpan={6} className="py-6 text-center text-muted-foreground">No backups recorded</td></tr>}
            </tbody>
          </table>
        </TabsContent>

        <TabsContent value="ai" className="space-y-2">
          {insights.map((i) => (
            <div key={i.id} className="rounded-lg border border-border bg-card p-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Sparkles className={cn("h-3.5 w-3.5",
                  i.severity === "critical" ? "text-destructive" : i.severity === "warning" ? "text-warning" : "text-primary")} />
                {i.title}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{i.detail}</p>
              <p className="mt-1 text-xs"><span className="font-semibold">Recommendation: </span>{i.recommendation}</p>
            </div>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
