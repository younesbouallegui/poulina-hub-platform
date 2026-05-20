import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity, AlertTriangle, ArrowUpRight, Boxes, Globe2, Maximize2,
  Minimize2, RadioTower, ShieldCheck, Timer, TrendingDown, TrendingUp, Zap,
  LayoutGrid, Map as MapIcon, GaugeCircle, Users as UsersIcon,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip as RTooltip,
  PieChart, Pie, Cell, BarChart, Bar, RadialBarChart, RadialBar, PolarAngleAxis,
} from "recharts";
import { PageHeader } from "@/components/layout/PageHeader";
import { MapView } from "@/components/MapView";
import { useI18n } from "@/contexts/I18nContext";
import {
  hostCoords, severityColor, severityTier,
  useZabbixEvents, useZabbixHosts, useZabbixProblems,
  useZabbixServices, useZabbixSLAs, useZabbixUsers, useZabbixUserGroups, useZabbixRoles,
} from "@/lib/zabbix";
import { cn } from "@/lib/utils";
import { AppOpsCenter } from "@/components/executive/AppOpsCenter";
import { InfraOpsCenter } from "@/components/executive/InfraOpsCenter";

const SEV_ORDER = ["disaster", "high", "average", "warning", "info"] as const;
const SEV_COLORS: Record<string, string> = {
  disaster: "#dc2626", high: "#ea580c", average: "#eab308",
  warning: "#3b82f6", info: "#22c55e",
};

type Tab = "overview" | "map" | "incidents" | "sla" | "governance";

export default function Executive() {
  const { t } = useI18n();
  const { data: hosts = [] } = useZabbixHosts();
  const { data: problems = [] } = useZabbixProblems();
  const { data: services = [] } = useZabbixServices();
  const { data: slas = [] } = useZabbixSLAs();
  const { data: events = [] } = useZabbixEvents({
    limit: 500,
    timeFrom: Math.floor(Date.now() / 1000) - 24 * 3600,
  });
  const { data: zUsers = [] } = useZabbixUsers();
  const { data: zGroups = [] } = useZabbixUserGroups();
  const { data: zRoles = [] } = useZabbixRoles();
  const [nocWall, setNocWall] = useState(false);
  const [tab, setTab] = useState<Tab>("overview");

  // ---- KPIs ----------------------------------------------------------------
  const onlineHosts = hosts.filter((h) => h.available === "1").length;
  const offlineHosts = hosts.filter((h) => h.available === "2").length;
  const unknownHosts = hosts.length - onlineHosts - offlineHosts;
  const enabled = hosts.filter((h) => h.status === "0").length;

  const sevDist = useMemo(() => {
    const acc = { disaster: 0, high: 0, average: 0, warning: 0, info: 0 };
    for (const p of problems) {
      const name = ["info","info","warning","average","high","disaster"][parseInt(p.severity,10)] ?? "info";
      acc[name as keyof typeof acc]++;
    }
    return acc;
  }, [problems]);

  const sevPie = SEV_ORDER.map((k) => ({ name: k, value: sevDist[k], fill: SEV_COLORS[k] }));

  // Risk = weighted severity / hosts
  const risk = Math.min(100, Math.round(
    (sevDist.disaster * 25 + sevDist.high * 12 + sevDist.average * 4 + sevDist.warning * 1) /
    Math.max(1, hosts.length / 10)
  ));
  const health = Math.max(0, 100 - risk);

  const okServices = services.filter((s) => s.status === "0" || s.status === "-1").length;
  const slaPosture = services.length ? (okServices / services.length) * 100 : 100;

  // MTTD = avg seconds from problem.clock to ack/now
  const now = Math.floor(Date.now() / 1000);
  const ackedEvents = events.filter((e) => e.acknowledges && e.acknowledges.length > 0);
  const mttdSec = ackedEvents.length
    ? ackedEvents.reduce((s, e) => {
        const ack = e.acknowledges![0];
        return s + Math.max(0, parseInt(ack.clock, 10) - parseInt(e.clock, 10));
      }, 0) / ackedEvents.length
    : 0;
  const recoveredEvents = events.filter((e) => e.r_eventid && e.r_eventid !== "0");
  const mttrSec = recoveredEvents.length
    ? recoveredEvents.reduce((s, e) => s + Math.max(0, now - parseInt(e.clock, 10)), 0) / recoveredEvents.length
    : 0;

  const fmtDur = (sec: number) => {
    if (!sec) return "—";
    const m = Math.round(sec / 60);
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    return `${h}h ${m % 60}m`;
  };

  // ---- 24h timeline (per hour bucket) -------------------------------------
  const timeline = useMemo(() => {
    const buckets = Array.from({ length: 24 }, (_, i) => ({
      hour: `${i.toString().padStart(2, "0")}h`, count: 0, critical: 0,
    }));
    const start = now - 24 * 3600;
    for (const e of events) {
      const t = parseInt(e.clock, 10);
      if (t < start) continue;
      const idx = Math.floor((t - start) / 3600);
      if (idx < 0 || idx >= 24) continue;
      buckets[idx].count++;
      if (parseInt(e.severity ?? "0", 10) >= 4) buckets[idx].critical++;
    }
    return buckets;
  }, [events, now]);

  // ---- Geographic posture --------------------------------------------------
  const geoPosture = useMemo(() => {
    const byRegion = new Map<string, { hosts: number; alerts: number }>();
    for (const h of hosts) {
      const c = hostCoords(h);
      const region = c
        ? c.lon < -30 ? "Americas" : c.lon < 60 ? "EMEA" : "APAC"
        : "Unmapped";
      const cur = byRegion.get(region) ?? { hosts: 0, alerts: 0 };
      cur.hosts++;
      byRegion.set(region, cur);
    }
    const sevByHost = new Map<string, number>();
    for (const p of problems) {
      const hid = p.hosts?.[0]?.hostid;
      if (!hid) continue;
      sevByHost.set(hid, (sevByHost.get(hid) ?? 0) + 1);
    }
    for (const h of hosts) {
      const c = hostCoords(h);
      const region = c
        ? c.lon < -30 ? "Americas" : c.lon < 60 ? "EMEA" : "APAC"
        : "Unmapped";
      const cur = byRegion.get(region)!;
      cur.alerts += sevByHost.get(h.hostid) ?? 0;
    }
    return Array.from(byRegion.entries()).map(([region, v]) => ({ region, ...v }));
  }, [hosts, problems]);

  // ---- Top failing services ------------------------------------------------
  const topServices = useMemo(() =>
    services
      .filter((s) => s.status !== "0" && s.status !== "-1")
      .slice(0, 6)
      .map((s) => ({ name: s.name, status: parseInt(s.status, 10) || 0 }))
  , [services]);

  // ---- Top noisy hosts -----------------------------------------------------
  const topHosts = useMemo(() => {
    const counts = new Map<string, { name: string; count: number; max: number }>();
    for (const p of problems) {
      const h = p.hosts?.[0];
      if (!h) continue;
      const cur = counts.get(h.hostid) ?? { name: h.name, count: 0, max: 0 };
      cur.count++;
      cur.max = Math.max(cur.max, parseInt(p.severity, 10) || 0);
      counts.set(h.hostid, cur);
    }
    return Array.from(counts.values()).sort((a, b) => b.count - a.count).slice(0, 6);
  }, [problems]);

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", nocWall && "bg-black text-white")}>
      <PageHeader
        title="Global Operations Command Center"
        subtitle={`Live posture · ${hosts.length} hosts · ${problems.length} active problems`}
        icon={Globe2}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setNocWall((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted"
            >
              {nocWall ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
              NOC Wall
            </button>
            <Link to="/alerts" className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90">
              Alerts <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        }
      />

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-1 border-b border-border px-4 sm:px-6">
        {([
          ["overview", "Overview", LayoutGrid],
          ["map", "Global Map", MapIcon],
          ["incidents", "Incidents", AlertTriangle],
          ["sla", "SLA & Services", GaugeCircle],
          ["governance", "Governance", UsersIcon],
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
      </div>

      {tab === "map" && (
        <div className="flex-1 p-4">
          <MapView height="calc(100vh - 14rem)" />
        </div>
      )}

      {tab === "incidents" && (
        <div className="p-4 sm:p-6">
          <Panel title="Most recent problems" subtitle={`${problems.length} active`}>
            <div className="overflow-hidden rounded-lg border border-border/60">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
                  <tr><th className="px-3 py-2">Severity</th><th className="px-3 py-2">Problem</th><th className="px-3 py-2">Host</th><th className="px-3 py-2">Ack</th><th className="px-3 py-2 text-right">When</th></tr>
                </thead>
                <tbody>
                  {problems.slice(0, 30).map((p) => (
                    <tr key={p.eventid} className="border-t border-border/40 hover:bg-muted/30">
                      <td className="px-3 py-2"><span className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase text-white" style={{ background: severityColor(p.severity) }}>{severityTier(p.severity)}</span></td>
                      <td className="px-3 py-2 font-medium"><Link to={`/s/${p.eventid}`} className="hover:underline">{p.name}</Link></td>
                      <td className="px-3 py-2 text-muted-foreground">{p.hostName ?? "—"}</td>
                      <td className="px-3 py-2 text-xs">{p.acknowledged === "1" ? "Yes" : "No"}</td>
                      <td className="px-3 py-2 text-right font-mono text-xs text-muted-foreground">{new Date(parseInt(p.clock, 10) * 1000).toLocaleString()}</td>
                    </tr>
                  ))}
                  {problems.length === 0 && <tr><td colSpan={5} className="px-3 py-10 text-center text-muted-foreground">No active problems</td></tr>}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      )}

      {tab === "sla" && (
        <div className="grid gap-4 p-4 sm:p-6 lg:grid-cols-2">
          <Panel title="SLA targets" subtitle={`${slas.length} configured`}>
            {slas.length === 0 ? <p className="py-8 text-center text-xs text-muted-foreground">No SLAs configured in Zabbix</p> : (
              <ul className="space-y-2">{slas.map((s) => (
                <li key={s.slaid} className="flex items-center justify-between rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-sm">
                  <span className="truncate">{s.name}</span>
                  <span className="font-mono text-xs">{s.slo}%</span>
                </li>
              ))}</ul>
            )}
          </Panel>
          <Panel title="Business services posture" subtitle={`${services.length} services`}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={[{ n: "OK", v: okServices }, { n: "Degraded", v: services.length - okServices }]}>
                <XAxis dataKey="n" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} />
                <RTooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 12 }} />
                <Bar dataKey="v" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Panel>
        </div>
      )}

      {tab === "governance" && (
        <div className="grid gap-4 p-4 sm:p-6 lg:grid-cols-3">
          <Kpi icon={UsersIcon} label="Zabbix users" value={String(zUsers.length)} hint="directory" />
          <Kpi icon={ShieldCheck} label="User groups" value={String(zGroups.length)} hint="permission scopes" />
          <Kpi icon={ShieldCheck} label="Roles" value={String(zRoles.length)} hint="RBAC roles" />
          <Panel className="lg:col-span-3" title="IAM quick view" subtitle="Live mirror of Zabbix identity">
            <Link to="/governance/users" className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline">Open full IAM Console <ArrowUpRight className="h-3.5 w-3.5" /></Link>
            <ul className="mt-3 grid gap-1 text-sm sm:grid-cols-2">
              {zUsers.slice(0, 8).map((u) => (
                <li key={u.userid} className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2">
                  <span className="font-medium">{u.username}</span>
                  <span className="text-xs text-muted-foreground">{[u.name, u.surname].filter(Boolean).join(" ") || "—"}</span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      )}

      {tab === "overview" && (
      <div className={cn("grid gap-4 p-4 sm:p-6", nocWall ? "lg:grid-cols-6" : "lg:grid-cols-4")}>
        {/* Hero KPIs */}
        <ScoreGauge title="Service Health" value={health} good />
        <ScoreGauge title="Risk Score" value={risk} good={false} />
        <Kpi icon={Boxes} label="Total Hosts" value={String(hosts.length)} hint={`${enabled} enabled`} />
        <Kpi icon={RadioTower} label="Online" value={String(onlineHosts)} hint={`${offlineHosts} offline`} trend={onlineHosts >= offlineHosts} />
        <Kpi icon={AlertTriangle} label="Active Problems" value={String(problems.length)} hint={`${sevDist.disaster + sevDist.high} critical`} />
        <Kpi icon={ShieldCheck} label="SLA Posture" value={`${slaPosture.toFixed(1)}%`} hint={`${slas.length} SLAs`} />
        <Kpi icon={Timer} label="MTTD" value={fmtDur(mttdSec)} hint="time to detect" />
        <Kpi icon={Zap} label="MTTR" value={fmtDur(mttrSec)} hint="time to recover" />

        {/* 24h activity */}
        <Panel className="lg:col-span-4" title="Incident velocity · last 24h" subtitle={`${events.length} events`}>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={timeline} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.6} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#dc2626" stopOpacity={0.6} />
                  <stop offset="100%" stopColor="#dc2626" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="hour" stroke="hsl(var(--muted-foreground))" fontSize={10} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} />
              <RTooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 12 }} />
              <Area type="monotone" dataKey="count" stroke="hsl(var(--primary))" fill="url(#g1)" strokeWidth={2} name="All" />
              <Area type="monotone" dataKey="critical" stroke="#dc2626" fill="url(#g2)" strokeWidth={2} name="Critical" />
            </AreaChart>
          </ResponsiveContainer>
        </Panel>

        {/* Severity distribution */}
        <Panel className="lg:col-span-2" title="Severity distribution" subtitle={`${problems.length} problems`}>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={sevPie} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={2}>
                {sevPie.map((s) => <Cell key={s.name} fill={s.fill} />)}
              </Pie>
              <RTooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-2 grid grid-cols-5 gap-1 text-[10px]">
            {SEV_ORDER.map((k) => (
              <div key={k} className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full" style={{ background: SEV_COLORS[k] }} />
                <span className="capitalize text-muted-foreground">{k}</span>
                <span className="ml-auto font-mono">{sevDist[k]}</span>
              </div>
            ))}
          </div>
        </Panel>

        {/* Geographic posture */}
        <Panel className="lg:col-span-3" title="Cross-region posture" subtitle="Hosts and active alerts by region">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={geoPosture} layout="vertical" margin={{ left: 10, right: 10 }}>
              <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={10} />
              <YAxis dataKey="region" type="category" stroke="hsl(var(--muted-foreground))" fontSize={11} width={80} />
              <RTooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 12 }} />
              <Bar dataKey="hosts" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} name="Hosts" />
              <Bar dataKey="alerts" fill="#dc2626" radius={[0, 4, 4, 0]} name="Alerts" />
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        {/* Top failing services */}
        <Panel title="Business service impact" subtitle={`${services.length - okServices} of ${services.length} degraded`}>
          {topServices.length === 0 ? (
            <p className="py-8 text-center text-xs text-muted-foreground">All services nominal</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {topServices.map((s) => (
                <li key={s.name} className="flex items-center justify-between rounded-md border border-border/60 bg-muted/30 px-3 py-2">
                  <span className="truncate">{s.name}</span>
                  <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase" style={{ background: severityColor(s.status), color: "white" }}>
                    {severityTier(s.status)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* Noisiest hosts */}
        <Panel className="lg:col-span-2" title="Top hosts by alert volume" subtitle="Last 24h">
          {topHosts.length === 0 ? (
            <p className="py-8 text-center text-xs text-muted-foreground">No active alerts</p>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {topHosts.map((h) => (
                  <tr key={h.name} className="border-b border-border/40 last:border-0">
                    <td className="py-2 font-medium">{h.name}</td>
                    <td className="py-2">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                          <div className="h-full" style={{ width: `${Math.min(100, h.count * 10)}%`, background: severityColor(h.max) }} />
                        </div>
                        <span className="font-mono text-xs tabular-nums text-muted-foreground">{h.count}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        {/* Posture summary */}
        <Panel className="lg:col-span-2" title="Operational scorecard">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Score label="Availability" value={hosts.length ? (onlineHosts / hosts.length) * 100 : 100} suffix="%" />
            <Score label="Coverage" value={hosts.length ? (enabled / hosts.length) * 100 : 100} suffix="%" />
            <Score label="Ack rate" value={problems.length ? (problems.filter((p) => p.acknowledged === "1").length / problems.length) * 100 : 100} suffix="%" />
            <Score label="Unknown" value={hosts.length ? (unknownHosts / hosts.length) * 100 : 0} suffix="%" inverse />
          </div>
        </Panel>

        {/* Application Operations Center */}
        <div className="lg:col-span-4">
          <AppOpsCenter />
        </div>
        <div className="lg:col-span-4">
          <InfraOpsCenter />
        </div>
      </div>
      )}
    </div>
  );
}

const Panel = ({ title, subtitle, children, className }: { title: string; subtitle?: string; children: React.ReactNode; className?: string }) => (
  <div className={cn("rounded-xl border border-border bg-card p-5", className)}>
    <div className="mb-3 flex items-baseline justify-between">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{title}</p>
      {subtitle && <p className="text-[10px] text-muted-foreground">{subtitle}</p>}
    </div>
    {children}
  </div>
);

const Kpi = ({ icon: Icon, label, value, hint, trend }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; hint?: string; trend?: boolean }) => (
  <div className="rounded-xl border border-border bg-card p-4">
    <div className="flex items-center justify-between">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted/60"><Icon className="h-4 w-4" /></div>
      {trend !== undefined && (trend ? <TrendingUp className="h-3.5 w-3.5 text-success" /> : <TrendingDown className="h-3.5 w-3.5 text-destructive" />)}
    </div>
    <p className="mt-3 text-2xl font-semibold tracking-tight">{value}</p>
    <p className="mt-0.5 text-[11px] text-muted-foreground">{label}{hint ? ` · ${hint}` : ""}</p>
  </div>
);

const ScoreGauge = ({ title, value, good }: { title: string; value: number; good: boolean }) => {
  const color = good
    ? value >= 80 ? "#22c55e" : value >= 60 ? "#eab308" : "#dc2626"
    : value <= 20 ? "#22c55e" : value <= 50 ? "#eab308" : "#dc2626";
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{title}</p>
      <div className="relative h-[110px]">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart innerRadius="65%" outerRadius="100%" data={[{ v: value }]} startAngle={90} endAngle={-270}>
            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
            <RadialBar background={{ fill: "hsl(var(--muted))" }} dataKey="v" cornerRadius={6} fill={color} />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold tabular-nums" style={{ color }}>{value}</span>
          <span className="text-[10px] text-muted-foreground">/100</span>
        </div>
      </div>
    </div>
  );
};

const Score = ({ label, value, suffix, inverse }: { label: string; value: number; suffix: string; inverse?: boolean }) => {
  const ok = inverse ? value < 20 : value >= 80;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[11px]">
        <span className="text-muted-foreground">{label}</span>
        <span className={cn("font-mono font-semibold tabular-nums", ok ? "text-success" : "text-warning")}>
          {value.toFixed(1)}{suffix}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full", ok ? "bg-success" : "bg-warning")} style={{ width: `${Math.min(100, value)}%` }} />
      </div>
    </div>
  );
};
