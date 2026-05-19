import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity, AlertTriangle, ArrowUpRight, Boxes, Download, Maximize2, Minimize2, Plus, Search, ShieldCheck, TrendingDown,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { useApplications } from "@/hooks/useApplications";
import { AppFiltersBar, useAppFilters } from "@/components/applications/AppFilters";
import { AppStatusBadge, HealthBar } from "@/components/applications/AppStatusBadge";
import { AppCreateDialog } from "@/components/applications/AppCreateDialog";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export default function ApplicationsCommand() {
  const { data: apps = [] } = useApplications();
  const { filters, setFilters, filtered } = useAppFilters(apps);
  const [noc, setNoc] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const stats = useMemo(() => {
    const counts = { healthy: 0, warning: 0, degraded: 0, critical: 0, unknown: 0 };
    let sla = 0, incidents = 0, errorSum = 0, healthSum = 0;
    apps.forEach((a) => {
      counts[a.status]++;
      sla += a.slaActual;
      incidents += a.activeIncidents;
      errorSum += a.errorRate;
      healthSum += a.healthScore;
    });
    return {
      counts,
      avgSla: apps.length ? sla / apps.length : 100,
      incidents,
      avgError: apps.length ? errorSum / apps.length : 0,
      avgHealth: apps.length ? healthSum / apps.length : 100,
    };
  }, [apps]);

  const topFailing = useMemo(() =>
    [...apps].sort((a, b) => b.errorRate - a.errorRate).slice(0, 5)
  , [apps]);
  const topNoisy = useMemo(() =>
    [...apps].sort((a, b) => b.activeIncidents - a.activeIncidents).slice(0, 5)
  , [apps]);
  const businessCritical = useMemo(() =>
    apps.filter((a) => a.criticality === "T0").sort((a, b) => a.healthScore - b.healthScore)
  , [apps]);

  const exportCsv = () => {
    const header = ["name","env","tier","status","health","risk","sla","availability","error%","p95ms","incidents","owner","team","dept","region"];
    const rows = filtered.map((a) => [
      a.name, a.environment, a.criticality, a.status, a.healthScore, a.riskScore,
      a.slaActual, a.availability, a.errorRate, a.latencyP95Ms, a.activeIncidents,
      a.businessOwner, a.team, a.department, a.region,
    ]);
    const csv = [header, ...rows].map((r) => r.map((v) => `"${String(v).split('"').join('""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "applications.csv"; a.click();
  };

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", noc && "bg-black text-white")}>
      <PageHeader
        title="Application Operations Command"
        subtitle={`${apps.length} applications · ${stats.incidents} active incidents · avg health ${stats.avgHealth.toFixed(0)}%`}
        icon={Activity}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={exportCsv}><Download className="mr-1.5 h-3.5 w-3.5" />Export</Button>
            <Button variant="outline" size="sm" onClick={() => setNoc((v) => !v)}>
              {noc ? <Minimize2 className="mr-1.5 h-3.5 w-3.5" /> : <Maximize2 className="mr-1.5 h-3.5 w-3.5" />}
              NOC Wall
            </Button>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />Register app
            </Button>
          </div>
        }
      />

      <div className="space-y-4 p-4 sm:p-6">
        {/* KPI strip */}
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-6">
          <Kpi label="Total apps" value={apps.length} hint={`${apps.filter(a => a.environment === "prod").length} in prod`} icon={Boxes} />
          <Kpi label="Healthy" value={stats.counts.healthy} hint="green" tone="success" />
          <Kpi label="Warning" value={stats.counts.warning} hint="amber" tone="warning" />
          <Kpi label="Degraded" value={stats.counts.degraded} hint="orange" tone="orange" />
          <Kpi label="Critical" value={stats.counts.critical} hint="red" tone="critical" />
          <Kpi label="Avg SLA" value={`${stats.avgSla.toFixed(2)}%`} hint="last 30d" icon={ShieldCheck} />
        </div>

        <AppFiltersBar apps={apps} filters={filters} setFilters={setFilters} />

        {/* Status grid table */}
        <section className="rounded-xl border border-border bg-card">
          <header className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <h2 className="text-sm font-semibold">Application status grid</h2>
            <span className="text-xs text-muted-foreground">{filtered.length} of {apps.length}</span>
          </header>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Application</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Env</th>
                  <th className="px-3 py-2">Tier</th>
                  <th className="px-3 py-2">Health</th>
                  <th className="px-3 py-2">SLA</th>
                  <th className="px-3 py-2">Avail</th>
                  <th className="px-3 py-2">Err %</th>
                  <th className="px-3 py-2">P95</th>
                  <th className="px-3 py-2">Incidents</th>
                  <th className="px-3 py-2">Owner</th>
                  <th className="px-3 py-2">Region</th>
                  <th className="px-3 py-2 text-right">Deploy</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => (
                  <tr key={a.id} className="border-t border-border/60 hover:bg-muted/30">
                    <td className="px-3 py-2">
                      <Link to={`/applications/${a.id}`} className="font-medium hover:text-primary hover:underline">{a.name}</Link>
                      <div className="text-[10px] text-muted-foreground">{a.team} · {a.department}</div>
                    </td>
                    <td className="px-3 py-2"><AppStatusBadge status={a.status} /></td>
                    <td className="px-3 py-2 text-xs uppercase">{a.environment}</td>
                    <td className="px-3 py-2 text-xs font-semibold">{a.criticality}</td>
                    <td className="px-3 py-2">
                      <div className="flex w-24 items-center gap-2">
                        <span className="w-8 text-xs font-mono">{a.healthScore}</span>
                        <HealthBar value={a.healthScore} />
                      </div>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{a.slaActual.toFixed(2)}%</td>
                    <td className="px-3 py-2 font-mono text-xs">{a.availability.toFixed(2)}%</td>
                    <td className={cn("px-3 py-2 font-mono text-xs", a.errorRate > 3 ? "text-destructive" : a.errorRate > 1 ? "text-warning" : "")}>{a.errorRate.toFixed(2)}</td>
                    <td className="px-3 py-2 font-mono text-xs">{a.latencyP95Ms}ms</td>
                    <td className="px-3 py-2 text-xs">{a.activeIncidents > 0 ? <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-destructive">{a.activeIncidents}</span> : "—"}</td>
                    <td className="px-3 py-2 text-xs">{a.businessOwner}</td>
                    <td className="px-3 py-2 text-xs">{a.region}</td>
                    <td className="px-3 py-2 text-right text-[10px] text-muted-foreground">{relTime(a.lastDeployment)}</td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={13} className="px-3 py-12 text-center text-sm text-muted-foreground">
                    <Search className="mx-auto mb-2 h-5 w-5" />No applications match these filters
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Panels row */}
        <div className="grid gap-4 lg:grid-cols-3">
          <Panel title="Top failing applications" subtitle="By error rate">
            <ul className="space-y-2">
              {topFailing.map((a) => (
                <li key={a.id} className="flex items-center justify-between rounded-md border border-border/60 bg-muted/30 px-3 py-2">
                  <Link to={`/applications/${a.id}`} className="flex items-center gap-2 text-sm hover:text-primary">
                    <AppStatusBadge status={a.status} withDot={false} />
                    {a.name}
                  </Link>
                  <span className="font-mono text-xs text-destructive">{a.errorRate.toFixed(2)}%</span>
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title="Noisy applications" subtitle="Most active incidents">
            <ul className="space-y-2">
              {topNoisy.map((a) => (
                <li key={a.id} className="flex items-center justify-between rounded-md border border-border/60 bg-muted/30 px-3 py-2">
                  <Link to={`/applications/${a.id}`} className="flex items-center gap-2 text-sm hover:text-primary">
                    <AlertTriangle className="h-3.5 w-3.5 text-warning" />{a.name}
                  </Link>
                  <span className="font-mono text-xs">{a.activeIncidents}</span>
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title="Business-critical (T0)" subtitle={`${businessCritical.length} apps`}>
            <ul className="space-y-2">
              {businessCritical.map((a) => (
                <li key={a.id} className="flex items-center justify-between rounded-md border border-border/60 bg-muted/30 px-3 py-2">
                  <Link to={`/applications/${a.id}`} className="text-sm font-medium hover:text-primary">{a.name}</Link>
                  <div className="flex w-32 items-center gap-2">
                    <HealthBar value={a.healthScore} />
                    <span className="w-8 text-right font-mono text-[10px]">{a.healthScore}</span>
                  </div>
                </li>
              ))}
              {!businessCritical.length && <li className="py-6 text-center text-xs text-muted-foreground">No T0 apps</li>}
            </ul>
          </Panel>
        </div>

        {/* Severity heatmap */}
        <Panel title="Severity heatmap" subtitle="Each tile = one application">
          <div className="flex flex-wrap gap-1.5">
            {filtered.map((a) => (
              <Link key={a.id} to={`/applications/${a.id}`}
                title={`${a.name} · ${a.status} · ${a.healthScore}/100`}
                className={cn(
                  "h-10 w-10 rounded-md transition-transform hover:scale-110",
                  a.status === "healthy" && "bg-success",
                  a.status === "warning" && "bg-warning",
                  a.status === "degraded" && "bg-orange-500",
                  a.status === "critical" && "bg-destructive",
                  a.status === "unknown" && "bg-muted",
                )}
              />
            ))}
          </div>
        </Panel>
      </div>

      <AppCreateDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

function Kpi({ label, value, hint, icon: Icon, tone }: {
  label: string; value: React.ReactNode; hint?: string; icon?: React.ComponentType<{ className?: string }>; tone?: "success"|"warning"|"orange"|"critical";
}) {
  const toneCls = tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : tone === "orange" ? "text-orange-500" : tone === "critical" ? "text-destructive" : "";
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
        {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
      </div>
      <div className={cn("mt-1 text-2xl font-bold tabular-nums", toneCls)}>{value}</div>
      {hint && <div className="text-[10px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <header className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        {subtitle && <span className="text-[10px] text-muted-foreground">{subtitle}</span>}
      </header>
      {children}
    </section>
  );
}

function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}
