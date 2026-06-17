import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Activity, AlertTriangle, Bell, Boxes, Code2, Database, GitBranch, ListChecks, Network, ScrollText, ShieldCheck, Sparkles, Workflow } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useApplication, useApplications, useAlertRules } from "@/hooks/useApplications";
import { AppStatusBadge, HealthBar } from "@/components/applications/AppStatusBadge";
import DatabasesPanel from "@/components/applications/DatabasesPanel";
import { aggregateDbMetrics, generateAppInsights, generateTraces, getAppDatabases } from "@/lib/appDatabases";
import { HOSTS } from "@/data/monitoringMock";
import { cn } from "@/lib/utils";

export default function ApplicationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const app = useApplication(id);
  const { data: all = [] } = useApplications();
  const { data: rules = [] } = useAlertRules();

  if (!app) {
    return (
      <div className="p-8">
        <p className="text-sm text-muted-foreground">Application not found.</p>
        <Button variant="link" onClick={() => navigate("/applications")}>← Back</Button>
      </div>
    );
  }

  const hosts = HOSTS.filter((h) => app.hostIds.includes(h.id));
  const appRules = rules.filter((r) => r.appId === app.id);
  const linkedApps = (id?: string) => all.find((a) => a.id === id);
  const dbs = useMemo(() => getAppDatabases(app), [app]);
  const dbAgg = useMemo(() => aggregateDbMetrics(dbs), [dbs]);
  const insights = useMemo(() => generateAppInsights(app), [app]);
  const traces = useMemo(() => generateTraces(app, dbs), [app, dbs]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title={app.name}
        subtitle={`${app.type} · ${app.environment.toUpperCase()} · ${app.criticality} · ${app.team}`}
        icon={Activity}
        actions={
          <div className="flex items-center gap-2">
            <AppStatusBadge status={app.status} />
            <Link to="/applications"><Button size="sm" variant="outline"><ArrowLeft className="mr-1 h-3.5 w-3.5" />All apps</Button></Link>
          </div>
        }
      />

      <div className="space-y-4 p-4 sm:p-6">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-6">
          <Stat label="Health" value={`${app.healthScore}`} bar={app.healthScore} />
          <Stat label="Risk" value={`${app.riskScore}`} tone={app.riskScore > 50 ? "critical" : app.riskScore > 25 ? "warning" : "success"} />
          <Stat label="SLA" value={`${app.slaActual.toFixed(2)}%`} hint={`target ${app.slaTarget}%`} />
          <Stat label="Availability" value={`${app.availability.toFixed(2)}%`} />
          <Stat label="Error rate" value={`${app.errorRate.toFixed(2)}%`} tone={app.errorRate > 3 ? "critical" : app.errorRate > 1 ? "warning" : "success"} />
          <Stat label="P95 latency" value={`${app.latencyP95Ms}ms`} />
        </div>

        <Tabs defaultValue="overview">
          <TabsList className="flex flex-wrap">
            <TabsTrigger value="overview"><Activity className="mr-1 h-3.5 w-3.5" />Overview</TabsTrigger>
            <TabsTrigger value="logs"><ScrollText className="mr-1 h-3.5 w-3.5" />Logs</TabsTrigger>
            <TabsTrigger value="db"><Database className="mr-1 h-3.5 w-3.5" />Databases{dbs.length ? ` (${dbs.length})` : ""}</TabsTrigger>
            <TabsTrigger value="jobs"><ListChecks className="mr-1 h-3.5 w-3.5" />Jobs</TabsTrigger>
            <TabsTrigger value="api"><Code2 className="mr-1 h-3.5 w-3.5" />API</TabsTrigger>
            <TabsTrigger value="infra"><Boxes className="mr-1 h-3.5 w-3.5" />Infrastructure</TabsTrigger>
            <TabsTrigger value="traces"><Workflow className="mr-1 h-3.5 w-3.5" />Traces</TabsTrigger>
            <TabsTrigger value="ai"><Sparkles className="mr-1 h-3.5 w-3.5" />AI Insights</TabsTrigger>
            <TabsTrigger value="incidents"><AlertTriangle className="mr-1 h-3.5 w-3.5" />Incidents</TabsTrigger>
            <TabsTrigger value="deps"><Network className="mr-1 h-3.5 w-3.5" />Dependencies</TabsTrigger>
            <TabsTrigger value="alerts"><Bell className="mr-1 h-3.5 w-3.5" />Alerts</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="grid gap-4 lg:grid-cols-3">
            <Card title="Identity">
              <Row k="Business owner" v={app.businessOwner} />
              <Row k="Technical owner" v={app.technicalOwner} />
              <Row k="Team" v={app.team} />
              <Row k="Department" v={app.department} />
              <Row k="Region" v={app.region} />
              <Row k="Last deployment" v={new Date(app.lastDeployment).toLocaleString()} />
            </Card>
            <Card title="Monitoring scope">
              <div className="flex flex-wrap gap-1">
                {Object.entries(app.scope).filter(([, v]) => v).map(([k]) => (
                  <Badge key={k} variant="secondary" className="text-[10px]">{k}</Badge>
                ))}
              </div>
            </Card>
            <Card title="Tags & servers">
              <div className="mb-2 flex flex-wrap gap-1">
                {app.tags.map((t) => <Badge key={t} className="text-[10px]">{t}</Badge>)}
              </div>
              <div className="flex flex-wrap gap-1">
                {hosts.map((h) => <Badge key={h.id} variant="outline" className="text-[10px]">{h.name}</Badge>)}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="logs">
            <Card title="Recent log stream">
              <ul className="space-y-1 font-mono text-[11px]">
                {app.recentLogs.map((l, i) => (
                  <li key={i} className="flex gap-2 border-b border-border/40 py-1">
                    <span className="w-32 shrink-0 text-muted-foreground">{new Date(l.ts).toLocaleTimeString()}</span>
                    <span className={cn("w-12 shrink-0 font-semibold uppercase",
                      l.level === "error" || l.level === "fatal" ? "text-destructive" :
                      l.level === "warn" ? "text-warning" :
                      l.level === "debug" ? "text-muted-foreground" : "text-success"
                    )}>{l.level}</span>
                    <span className="w-32 shrink-0 truncate text-muted-foreground">{l.source}</span>
                    <span className="flex-1">{l.message}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </TabsContent>

          <TabsContent value="db">
            <DatabasesPanel app={app} />
          </TabsContent>


          <TabsContent value="jobs">
            <Card title="Scheduled jobs / scripts">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <tr><th className="px-2 py-2">Job</th><th className="px-2 py-2">Schedule</th><th className="px-2 py-2">Last run</th><th className="px-2 py-2">Duration</th><th className="px-2 py-2">Status</th><th className="px-2 py-2">Retries</th></tr>
                </thead>
                <tbody>
                  {app.jobs.map((j) => (
                    <tr key={j.id} className="border-t border-border/40">
                      <td className="px-2 py-2 font-medium">{j.name}</td>
                      <td className="px-2 py-2 font-mono text-[11px]">{j.schedule}</td>
                      <td className="px-2 py-2 text-[11px]">{j.lastRun ? new Date(j.lastRun).toLocaleString() : "—"}</td>
                      <td className="px-2 py-2 font-mono text-[11px]">{j.lastDurationMs}ms</td>
                      <td className="px-2 py-2"><Badge variant={j.lastStatus === "failed" ? "destructive" : "secondary"}>{j.lastStatus}</Badge></td>
                      <td className="px-2 py-2 font-mono text-[11px]">{j.retries}</td>
                    </tr>
                  ))}
                  {!app.jobs.length && <tr><td colSpan={6} className="py-6 text-center text-xs text-muted-foreground">No jobs configured</td></tr>}
                </tbody>
              </table>
            </Card>
          </TabsContent>

          <TabsContent value="api">
            <Card title="API endpoints">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <tr><th className="px-2 py-2">Endpoint</th><th className="px-2 py-2">RPM</th><th className="px-2 py-2">Error %</th><th className="px-2 py-2">P95</th><th className="px-2 py-2">P99</th></tr>
                </thead>
                <tbody>
                  {app.endpoints.map((e) => (
                    <tr key={e.id} className="border-t border-border/40">
                      <td className="px-2 py-2"><span className="mr-2 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">{e.method}</span><span className="font-mono text-[12px]">{e.path}</span></td>
                      <td className="px-2 py-2 font-mono text-[11px]">{e.rpm}</td>
                      <td className={cn("px-2 py-2 font-mono text-[11px]", e.errorRate > 3 && "text-destructive")}>{e.errorRate.toFixed(2)}%</td>
                      <td className="px-2 py-2 font-mono text-[11px]">{e.p95Ms}ms</td>
                      <td className="px-2 py-2 font-mono text-[11px]">{e.p99Ms}ms</td>
                    </tr>
                  ))}
                  {!app.endpoints.length && <tr><td colSpan={5} className="py-6 text-center text-xs text-muted-foreground">No API endpoints</td></tr>}
                </tbody>
              </table>
            </Card>
          </TabsContent>

          <TabsContent value="infra">
            <Card title="Linked servers">
              <ul className="space-y-2">
                {hosts.map((h) => (
                  <li key={h.id} className="flex items-center justify-between rounded-md border border-border/60 p-3">
                    <div>
                      <div className="font-medium">{h.name}</div>
                      <div className="text-[11px] text-muted-foreground">{h.fqdn} · {h.department}</div>
                    </div>
                    <Badge variant={h.status === "ok" ? "secondary" : h.status === "critical" ? "destructive" : "default"}>{h.status}</Badge>
                  </li>
                ))}
              </ul>
            </Card>
          </TabsContent>

          <TabsContent value="traces">
            <Card title="Request traces (sampled)">
              <ul className="space-y-3">
                {traces.map((t) => (
                  <li key={t.id} className="rounded-lg border border-border/60 p-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-mono">{t.endpoint}</span>
                      <span className="text-muted-foreground text-[11px]">{new Date(t.sampledAt).toLocaleTimeString()} · total <span className="font-semibold text-foreground">{t.totalMs}ms</span></span>
                    </div>
                    <div className="mt-2 flex h-6 w-full overflow-hidden rounded bg-muted/40">
                      {t.spans.map((s, i) => {
                        const color = s.kind === "db" ? "bg-primary/70" : s.kind === "cache" ? "bg-secondary/70" : s.kind === "ext" ? "bg-warning/70" : "bg-success/70";
                        const pct = (s.ms / t.totalMs) * 100;
                        return <div key={i} className={cn(color, "flex items-center justify-center text-[10px] text-white")} style={{ width: `${pct}%` }} title={`${s.service} · ${s.ms}ms`}>{pct > 10 ? `${s.ms}ms` : ""}</div>;
                      })}
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1 text-[10px]">
                      {t.spans.map((s, i) => <Badge key={i} variant="outline">{s.service} · {s.kind} · {s.ms}ms</Badge>)}
                      <Badge variant="secondary">bottleneck: {t.bottleneck}</Badge>
                    </div>
                  </li>
                ))}
                {!traces.length && <li className="py-6 text-center text-xs text-muted-foreground">No traces sampled</li>}
              </ul>
            </Card>
          </TabsContent>

          <TabsContent value="ai">
            <Card title="AI insights">
              <ul className="space-y-2">
                {insights.map((i) => (
                  <li key={i.id} className="rounded-lg border border-border/60 p-3">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <Sparkles className={cn("h-3.5 w-3.5",
                        i.severity === "critical" ? "text-destructive" :
                        i.severity === "warning" ? "text-warning" : "text-primary")} />
                      {i.title}
                      <Badge variant={i.severity === "critical" ? "destructive" : "secondary"} className="ml-auto text-[10px]">{i.severity}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{i.detail}</p>
                    <p className="mt-1 text-xs"><span className="font-semibold">Recommendation: </span>{i.recommendation}</p>
                  </li>
                ))}
              </ul>
            </Card>
          </TabsContent>



          <TabsContent value="incidents">
            <Card title="Application incidents">
              {app.activeIncidents > 0 ? (
                <p className="text-sm">{app.activeIncidents} active incidents linked to this application. <Link to="/incidents" className="text-primary hover:underline">Open incident timeline →</Link></p>
              ) : <p className="py-6 text-center text-xs text-muted-foreground">No active incidents</p>}
            </Card>
          </TabsContent>

          <TabsContent value="deps">
            <Card title="Dependencies">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Downstream (this app calls)</h4>
                  <ul className="space-y-1">
                    {app.dependencies.filter((d) => d.direction === "downstream").map((d) => {
                      const o = linkedApps(d.appId);
                      return (
                        <li key={d.appId} className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2 text-sm">
                          <Link to={`/applications/${d.appId}`} className="hover:text-primary">{o?.name ?? d.appId}</Link>
                          <Badge variant="outline" className="text-[10px]">{d.kind}</Badge>
                        </li>
                      );
                    })}
                  </ul>
                </div>
                <div>
                  <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Upstream (calls this app)</h4>
                  <ul className="space-y-1">
                    {app.dependencies.filter((d) => d.direction === "upstream").map((d) => {
                      const o = linkedApps(d.appId);
                      return (
                        <li key={d.appId} className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2 text-sm">
                          <Link to={`/applications/${d.appId}`} className="hover:text-primary">{o?.name ?? d.appId}</Link>
                          <Badge variant="outline" className="text-[10px]">{d.kind}</Badge>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="alerts">
            <Card title="Alert rules">
              <ul className="space-y-2">
                {appRules.map((r) => (
                  <li key={r.id} className="flex items-center justify-between rounded-md border border-border/60 p-3 text-sm">
                    <div>
                      <div className="font-medium">{r.name}</div>
                      <div className="font-mono text-[11px] text-muted-foreground">{r.condition}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={r.severity === "critical" ? "destructive" : "secondary"}>{r.severity}</Badge>
                      {r.channels.map((c) => <Badge key={c} variant="outline" className="text-[10px]">{c}</Badge>)}
                    </div>
                  </li>
                ))}
                {!appRules.length && <li className="py-6 text-center text-xs text-muted-foreground">No alert rules. <Link to="/applications/alerts" className="text-primary hover:underline">Create one →</Link></li>}
              </ul>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function Stat({ label, value, hint, tone, bar }: { label: string; value: React.ReactNode; hint?: string; tone?: "success"|"warning"|"critical"; bar?: number }) {
  const toneCls = tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : tone === "critical" ? "text-destructive" : "";
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn("mt-0.5 text-xl font-bold tabular-nums", toneCls)}>{value}</div>
      {hint && <div className="text-[10px] text-muted-foreground">{hint}</div>}
      {typeof bar === "number" && <HealthBar value={bar} className="mt-1.5" />}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      {children}
    </section>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-start justify-between gap-2 border-b border-border/40 py-1.5 text-sm last:border-0">
      <span className="text-muted-foreground">{k}</span>
      <span className="text-right font-medium">{v || "—"}</span>
    </div>
  );
}
