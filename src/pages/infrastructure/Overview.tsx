import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Activity, AlertTriangle, Boxes, Cpu, Database, HardDrive, MemoryStick, Network, Server as ServerIcon, ShieldCheck, Wifi } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip as RTooltip, PieChart, Pie, Cell, BarChart, Bar } from "recharts";
import { PageHeader } from "@/components/layout/PageHeader";
import { InfraStatusBadge, ResourceBar } from "@/components/infrastructure/InfraStatusBadge";
import {
  useServers, useSites, useHypervisors, useK8sClusters, useNetworkDevices,
  useStorageArrays, useDatabaseServers, useCapacityForecasts,
} from "@/hooks/useInfrastructure";

export default function InfrastructureOverview() {
  const { data: servers = [] } = useServers();
  const { data: sites = [] } = useSites();
  const { data: hvs = [] } = useHypervisors();
  const { data: clusters = [] } = useK8sClusters();
  const { data: net = [] } = useNetworkDevices();
  const { data: storage = [] } = useStorageArrays();
  const { data: dbs = [] } = useDatabaseServers();
  const { data: capacity = [] } = useCapacityForecasts();

  const totals = useMemo(() => {
    const healthy = servers.filter((s) => s.status === "healthy").length;
    const warning = servers.filter((s) => s.status === "warning").length;
    const degraded = servers.filter((s) => s.status === "degraded").length;
    const critical = servers.filter((s) => s.status === "critical").length;
    const maint = servers.filter((s) => s.status === "maintenance").length;
    const cpu = avg(servers.map((s) => s.cpuPct));
    const ram = avg(servers.map((s) => s.ramPct));
    const disk = avg(servers.map((s) => s.diskPct));
    const sla = avg(servers.map((s) => s.slaActual));
    const risk = Math.round(avg(servers.map((s) => s.riskScore)));
    const avail = avg(servers.map((s) => s.availability));
    return { healthy, warning, degraded, critical, maint, cpu, ram, disk, sla, risk, avail };
  }, [servers]);

  const statusDist = [
    { name: "Healthy", value: totals.healthy, fill: "#10b981" },
    { name: "Warning", value: totals.warning, fill: "#eab308" },
    { name: "Degraded", value: totals.degraded, fill: "#f97316" },
    { name: "Critical", value: totals.critical, fill: "#dc2626" },
    { name: "Maintenance", value: totals.maint, fill: "#3b82f6" },
  ];

  const trend = useMemo(() => Array.from({ length: 24 }, (_, h) => ({
    h: `${h}h`, cpu: clamp(totals.cpu + Math.sin(h / 3) * 8 + (Math.random() - 0.5) * 4),
    ram: clamp(totals.ram + Math.cos(h / 4) * 6 + (Math.random() - 0.5) * 3),
  })), [totals.cpu, totals.ram]);

  const topFailing = [...servers].sort((a, b) => b.riskScore - a.riskScore).slice(0, 6);
  const capRisks = capacity.filter((c) => c.risk !== "low");

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader title="Infrastructure Operations" subtitle="Global posture · health · capacity · governance" icon={Activity} />
      <div className="grid gap-3 p-4 sm:p-6 lg:grid-cols-4">
        <Kpi icon={ServerIcon} label="Servers" value={String(servers.length)} hint={`${totals.healthy} healthy`} />
        <Kpi icon={ShieldCheck} label="SLA actual" value={`${totals.sla.toFixed(2)}%`} hint="vs target" />
        <Kpi icon={AlertTriangle} label="At risk" value={String(totals.warning + totals.degraded + totals.critical)} hint={`${totals.critical} critical`} />
        <Kpi icon={Activity} label="Risk score" value={String(totals.risk)} hint="0=safe · 100=high" />

        <Panel className="lg:col-span-2" title="Resource pressure (global)" subtitle="Average across fleet">
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={trend} margin={{ top: 5, right: 8, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="ic" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.5} /><stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} /></linearGradient>
                <linearGradient id="ir" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f97316" stopOpacity={0.5} /><stop offset="100%" stopColor="#f97316" stopOpacity={0} /></linearGradient>
              </defs>
              <XAxis dataKey="h" stroke="hsl(var(--muted-foreground))" fontSize={10} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} />
              <RTooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 12 }} />
              <Area type="monotone" dataKey="cpu" stroke="hsl(var(--primary))" fill="url(#ic)" strokeWidth={2} name="CPU %" />
              <Area type="monotone" dataKey="ram" stroke="#f97316" fill="url(#ir)" strokeWidth={2} name="RAM %" />
            </AreaChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Server status mix">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={statusDist} dataKey="value" nameKey="name" innerRadius={48} outerRadius={78} paddingAngle={2}>
                {statusDist.map((s) => <Cell key={s.name} fill={s.fill} />)}
              </Pie>
              <RTooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Fleet resource posture">
          <div className="space-y-3 pt-2">
            <Row icon={Cpu} label="CPU"><ResourceBar value={totals.cpu} /></Row>
            <Row icon={MemoryStick} label="RAM"><ResourceBar value={totals.ram} /></Row>
            <Row icon={HardDrive} label="Disk"><ResourceBar value={totals.disk} /></Row>
            <Row icon={Wifi} label="Avail"><ResourceBar value={totals.avail} /></Row>
          </div>
        </Panel>

        <Panel title="Sites & datacenters" subtitle={`${sites.length} sites · ${sites.reduce((a, s) => a + s.servers, 0)} servers`}>
          <div className="space-y-1.5">
            {sites.map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-md border border-border bg-background px-2.5 py-1.5 text-xs">
                <div>
                  <div className="font-medium">{s.name}</div>
                  <div className="text-[10px] text-muted-foreground">{s.tier} · {s.region} · {s.servers} hosts</div>
                </div>
                <InfraStatusBadge status={s.status} />
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Capacity risks" subtitle={`${capRisks.length} risks`}>
          <div className="space-y-1.5">
            {capRisks.length === 0 && <p className="text-xs text-muted-foreground">No capacity risks detected.</p>}
            {capRisks.map((c, i) => (
              <div key={i} className="flex items-center justify-between rounded-md border border-border bg-background px-2.5 py-1.5 text-xs">
                <div>
                  <div className="font-medium capitalize">{c.resource} · {c.scopeValue ?? c.scope}</div>
                  <div className="text-[10px] text-muted-foreground">90d forecast: {c.forecast90dPct}% {c.exhaustionDays ? `· exhaust in ${c.exhaustionDays}d` : ""}</div>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ring-1 ${c.risk === "high" ? "bg-destructive/10 text-destructive ring-destructive/30" : "bg-yellow-500/10 text-yellow-600 ring-yellow-500/30"}`}>{c.risk}</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Top failing servers" subtitle="Highest risk score" className="lg:col-span-2">
          <div className="divide-y divide-border">
            {topFailing.map((s) => (
              <Link key={s.id} to={`/infrastructure/servers/${s.id}`} className="flex items-center gap-3 py-2 text-xs hover:bg-muted/40">
                <InfraStatusBadge status={s.status} pulse />
                <div className="flex-1">
                  <div className="font-medium">{s.hostname}</div>
                  <div className="text-[10px] text-muted-foreground">{s.ip} · {s.os} {s.osVersion} · {s.environment}</div>
                </div>
                <div className="hidden gap-3 sm:flex">
                  <Metric label="CPU" value={`${s.cpuPct.toFixed(0)}%`} />
                  <Metric label="RAM" value={`${s.ramPct.toFixed(0)}%`} />
                  <Metric label="Risk" value={String(s.riskScore)} />
                </div>
              </Link>
            ))}
          </div>
        </Panel>

        <Panel title="Hypervisor posture" subtitle={`${hvs.length} hosts`}>
          <div className="space-y-1.5">
            {hvs.map((h) => (
              <div key={h.id} className="rounded-md border border-border bg-background p-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{h.name}</span>
                  <InfraStatusBadge status={h.status} />
                </div>
                <div className="mt-1 text-[10px] text-muted-foreground">{h.type} {h.version} · {h.vmCount} VMs</div>
                <div className="mt-1.5 grid grid-cols-2 gap-2">
                  <ResourceBar value={h.cpuPct} label="CPU" />
                  <ResourceBar value={h.ramPct} label="RAM" />
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="K8s clusters" subtitle={`${clusters.length} clusters`}>
          <div className="space-y-1.5">
            {clusters.map((c) => (
              <div key={c.id} className="rounded-md border border-border bg-background p-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{c.name}</span>
                  <InfraStatusBadge status={c.status} />
                </div>
                <div className="text-[10px] text-muted-foreground">{c.provider} · v{c.version} · {c.nodeCount} nodes · {c.podCount} pods</div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Network spine" subtitle={`${net.length} devices`}>
          <div className="space-y-1.5">
            {net.map((n) => (
              <div key={n.id} className="flex items-center justify-between rounded-md border border-border bg-background px-2 py-1.5 text-xs">
                <div>
                  <div className="font-medium">{n.hostname}</div>
                  <div className="text-[10px] text-muted-foreground">{n.vendor} {n.model} · {n.throughputMbps} Mbps</div>
                </div>
                <InfraStatusBadge status={n.status} />
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Storage arrays">
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={storage.map((s) => ({ n: s.name, used: s.usedTb, free: s.capacityTb - s.usedTb }))} margin={{ top: 5, right: 8, left: -20, bottom: 0 }}>
              <XAxis dataKey="n" stroke="hsl(var(--muted-foreground))" fontSize={10} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} />
              <RTooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 12 }} />
              <Bar dataKey="used" stackId="a" fill="hsl(var(--primary))" />
              <Bar dataKey="free" stackId="a" fill="hsl(var(--muted))" />
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Databases" subtitle={`${dbs.length} engines`}>
          <div className="space-y-1.5">
            {dbs.map((d) => (
              <div key={d.id} className="flex items-center justify-between rounded-md border border-border bg-background px-2 py-1.5 text-xs">
                <div>
                  <div className="font-medium">{d.name}</div>
                  <div className="text-[10px] text-muted-foreground capitalize">{d.engine} {d.version} · {d.role} · {d.qps.toLocaleString()} qps</div>
                </div>
                <InfraStatusBadge status={d.status} />
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const clamp = (n: number, min = 0, max = 100) => Math.max(min, Math.min(max, n));

const Panel = ({ title, subtitle, children, className = "" }: { title: string; subtitle?: string; children: React.ReactNode; className?: string }) => (
  <div className={`rounded-xl border border-border bg-card p-4 ${className}`}>
    <div className="mb-2 flex items-baseline justify-between">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{title}</p>
      {subtitle && <p className="text-[10px] text-muted-foreground">{subtitle}</p>}
    </div>
    {children}
  </div>
);
const Kpi = ({ icon: Icon, label, value, hint }: { icon: any; label: string; value: string; hint?: string }) => (
  <div className="rounded-xl border border-border bg-card p-4">
    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted/60"><Icon className="h-4 w-4" /></div>
    <p className="mt-3 text-2xl font-semibold tracking-tight">{value}</p>
    <p className="mt-0.5 text-[11px] text-muted-foreground">{label}{hint ? ` · ${hint}` : ""}</p>
  </div>
);
const Row = ({ icon: Icon, label, children }: { icon: any; label: string; children: React.ReactNode }) => (
  <div className="flex items-center gap-2">
    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
    <span className="w-10 text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
    <div className="flex-1">{children}</div>
  </div>
);
const Metric = ({ label, value }: { label: string; value: string }) => (
  <div className="text-right">
    <div className="font-mono text-xs">{value}</div>
    <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
  </div>
);
