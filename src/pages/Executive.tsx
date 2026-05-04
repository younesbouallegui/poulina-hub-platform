import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Boxes,
  Cpu,
  Database,
  Gauge,
  HardDrive,
  Network,
  ShieldCheck,
  Timer,
  TrendingDown,
  TrendingUp,
  Wifi,
  Zap,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader } from "@/components/layout/PageHeader";
import { useI18n } from "@/contexts/I18nContext";
import {
  ALERT_TREND_24H,
  ALL_ALERTS,
  ALL_INCIDENTS,
  ALL_SERVERS,
  CAPACITY,
  GLOBAL_KPIS,
  SERVICES,
  SITES,
  computeHealthScore,
} from "@/data/mockData";
import { cn } from "@/lib/utils";

const SEVERITY_ORDER = ["critical", "high", "medium", "low"] as const;

const Card = ({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) => (
  <div
    className={cn(
      "rounded-xl border border-border bg-card shadow-card transition-all hover:shadow-elevated",
      className,
    )}
  >
    {children}
  </div>
);

const CardHeader = ({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) => (
  <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
    <div className="min-w-0">
      <h3 className="truncate text-sm font-semibold text-foreground">{title}</h3>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
    {action}
  </div>
);

const StatusDot = ({ status }: { status: "healthy" | "warning" | "critical" }) => (
  <span
    className={cn(
      "inline-block h-2 w-2 rounded-full",
      status === "healthy" && "bg-success",
      status === "warning" && "bg-warning",
      status === "critical" && "bg-destructive",
    )}
  />
);

const Kpi = ({
  icon: Icon,
  label,
  value,
  delta,
  trend,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  delta?: string;
  trend?: "up" | "down" | "flat";
}) => (
  <Card className="p-5">
    <div className="flex items-start justify-between">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted/60 text-foreground">
        <Icon className="h-5 w-5" />
      </div>
      {delta && (
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium",
            trend === "up" && "bg-success/10 text-success",
            trend === "down" && "bg-destructive/10 text-destructive",
            trend === "flat" && "bg-muted text-muted-foreground",
          )}
        >
          {trend === "up" && <TrendingUp className="h-3 w-3" />}
          {trend === "down" && <TrendingDown className="h-3 w-3" />}
          {delta}
        </span>
      )}
    </div>
    <p className="mt-4 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
    <p className="mt-1 text-xs text-muted-foreground">{label}</p>
  </Card>
);

const HealthRing = ({ score }: { score: number }) => {
  const r = 52;
  const c = 2 * Math.PI * r;
  const offset = c - (score / 100) * c;
  const tone =
    score >= 90
      ? "text-success"
      : score >= 75
        ? "text-warning"
        : "text-destructive";
  return (
    <div className="relative flex h-36 w-36 items-center justify-center">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="10" />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className={cn("transition-all duration-700 ease-out", tone)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-semibold tracking-tight text-foreground">{score}</span>
        <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">/ 100</span>
      </div>
    </div>
  );
};

const Bar = ({ value, tone = "primary" }: { value: number; tone?: "primary" | "warning" | "destructive" }) => (
  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
    <div
      className={cn(
        "h-full rounded-full transition-all",
        tone === "primary" && "bg-primary",
        tone === "warning" && "bg-warning",
        tone === "destructive" && "bg-destructive",
      )}
      style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
    />
  </div>
);

export default function Executive() {
  const { t } = useI18n();
  const score = computeHealthScore();

  const sevCounts = useMemo(() => {
    const open = ALL_ALERTS.filter((a) => a.status !== "resolved");
    return SEVERITY_ORDER.reduce(
      (acc, s) => {
        acc[s] = open.filter((a) => a.severity === s).length;
        return acc;
      },
      { critical: 0, high: 0, medium: 0, low: 0 } as Record<(typeof SEVERITY_ORDER)[number], number>,
    );
  }, []);

  const topFailing = useMemo(
    () =>
      [...ALL_SERVERS]
        .sort((a, b) => b.cpu + b.memory - (a.cpu + a.memory))
        .slice(0, 5),
    [],
  );

  const recent = useMemo(
    () => [...ALL_INCIDENTS].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).slice(0, 5),
    [],
  );

  const sevTone = (s: string): "warning" | "destructive" | "primary" =>
    s === "critical" ? "destructive" : s === "high" ? "destructive" : s === "medium" ? "warning" : "primary";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title={t("exec.title")}
        subtitle={t("exec.subtitle")}
        actions={
          <>
            <span className="hidden items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground sm:inline-flex">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
              {t("exec.synced")} · {t("exec.lastSync")} 14s
            </span>
            <Link
              to="/alerts"
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-all hover:opacity-90 active:scale-[0.98]"
            >
              {t("exec.viewAlerts")} <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </>
        }
      />

      <div className="grid gap-4 p-4 sm:p-6">
        {/* Top row: health + KPIs */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
          <Card className="lg:col-span-1">
            <div className="flex h-full flex-col items-center justify-center p-6">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                {t("exec.healthScore")}
              </p>
              <div className="mt-3">
                <HealthRing score={score} />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {GLOBAL_KPIS.monitoredHosts} {t("exec.hosts")} · {GLOBAL_KPIS.monitoredServices} services
              </p>
            </div>
          </Card>

          <div className="grid grid-cols-2 gap-4 lg:col-span-3 lg:grid-cols-3">
            <Kpi icon={Boxes} label={t("exec.assets")} value={GLOBAL_KPIS.totalAssets.toString()} delta="+4" trend="up" />
            <Kpi
              icon={AlertTriangle}
              label={t("exec.activeAlerts")}
              value={GLOBAL_KPIS.activeAlerts.toString()}
              delta="+2"
              trend="down"
            />
            <Kpi icon={ShieldCheck} label={t("exec.sla")} value={`${GLOBAL_KPIS.slaCompliance}%`} delta="+0.04%" trend="up" />
            <Kpi icon={Activity} label={t("exec.availability")} value={`${GLOBAL_KPIS.availability}%`} delta="stable" trend="flat" />
            <Kpi icon={Timer} label={t("exec.mttr")} value={`${GLOBAL_KPIS.mttrMinutes}m`} delta="-3m" trend="up" />
            <Kpi icon={Zap} label={t("exec.changes")} value={GLOBAL_KPIS.changesToday.toString()} delta="2 pending" trend="flat" />
          </div>
        </div>

        {/* Mid row: alert trends + severity */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader title={t("exec.alertTrends")} hint="critical · high · medium · low" />
            <div className="h-64 px-2 pb-2 pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={ALERT_TREND_24H} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="gC" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--destructive))" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gM" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--warning))" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="hsl(var(--warning))" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gL" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 6" vertical={false} />
                  <XAxis dataKey="t" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} interval={3} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} width={28} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Area type="monotone" dataKey="low" stroke="hsl(var(--primary))" fill="url(#gL)" strokeWidth={1.5} />
                  <Area type="monotone" dataKey="medium" stroke="hsl(var(--warning))" fill="url(#gM)" strokeWidth={1.5} />
                  <Area type="monotone" dataKey="high" stroke="hsl(var(--destructive))" fill="url(#gC)" strokeWidth={1.5} />
                  <Area type="monotone" dataKey="critical" stroke="hsl(var(--destructive))" fill="url(#gC)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card>
            <CardHeader title={t("exec.severityBreakdown")} />
            <div className="space-y-4 p-5">
              {SEVERITY_ORDER.map((s) => {
                const total = Object.values(sevCounts).reduce((a, b) => a + b, 0) || 1;
                const pct = (sevCounts[s] / total) * 100;
                return (
                  <div key={s}>
                    <div className="mb-1.5 flex items-center justify-between text-xs">
                      <span className="capitalize text-foreground">{s}</span>
                      <span className="font-mono text-muted-foreground">{sevCounts[s]}</span>
                    </div>
                    <Bar value={pct} tone={sevTone(s)} />
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Map + capacity */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader title={t("exec.infraMap")} hint="Sites & data centers" />
            <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2 xl:grid-cols-3">
              {SITES.map((site) => (
                <div
                  key={site.id}
                  className="group rounded-lg border border-border bg-background-elevated p-4 transition-all hover-lift"
                >
                  <div className="flex items-start justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <StatusDot status={site.status} />
                        <p className="truncate text-sm font-medium text-foreground">{site.name}</p>
                      </div>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{site.region}</p>
                    </div>
                    <span className="font-mono text-xs text-muted-foreground">{site.health}%</span>
                  </div>
                  <div className="mt-3">
                    <Bar
                      value={site.health}
                      tone={site.status === "critical" ? "destructive" : site.status === "warning" ? "warning" : "primary"}
                    />
                  </div>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    {site.hosts} {t("exec.hosts")}
                  </p>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title={t("exec.capacity")} />
            <div className="space-y-5 p-5">
              {[
                { icon: Cpu, label: "CPU", v: CAPACITY.cpu.used },
                { icon: Database, label: "Memory", v: CAPACITY.memory.used },
                { icon: HardDrive, label: "Storage", v: CAPACITY.storage.used },
                { icon: Network, label: "Network", v: CAPACITY.network.used },
              ].map((row) => {
                const tone = row.v >= 80 ? "destructive" : row.v >= 65 ? "warning" : "primary";
                return (
                  <div key={row.label}>
                    <div className="mb-1.5 flex items-center justify-between text-xs">
                      <span className="inline-flex items-center gap-2 text-foreground">
                        <row.icon className="h-3.5 w-3.5 text-muted-foreground" />
                        {row.label}
                      </span>
                      <span className="font-mono text-muted-foreground">{row.v}%</span>
                    </div>
                    <Bar value={row.v} tone={tone} />
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Bottom: top failing + service health + recent */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader title={t("exec.topFailing")} />
            <ul className="divide-y divide-border">
              {topFailing.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <StatusDot status={s.status} />
                      <p className="truncate text-sm font-medium text-foreground">{s.name}</p>
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{s.region} · {s.type}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-xs text-foreground">{s.cpu}% / {s.memory}%</p>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">cpu / mem</p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardHeader title={t("exec.serviceHealth")} />
            <div className="space-y-3 p-5">
              {SERVICES.map((svc) => {
                const tone = svc.status === "critical" ? "destructive" : svc.status === "warning" ? "warning" : "primary";
                return (
                  <div key={svc.id}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="inline-flex items-center gap-2 text-foreground">
                        {svc.category === "network" ? (
                          <Wifi className="h-3.5 w-3.5 text-muted-foreground" />
                        ) : (
                          <Gauge className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                        {svc.name}
                      </span>
                      <span className="font-mono text-muted-foreground">{svc.health}%</span>
                    </div>
                    <Bar value={svc.health} tone={tone} />
                  </div>
                );
              })}
            </div>
          </Card>

          <Card>
            <CardHeader
              title={t("exec.recentIncidents")}
              action={
                <Link to="/alerts" className="text-xs font-medium text-primary hover:underline">
                  {t("exec.viewAlerts")}
                </Link>
              }
            />
            <ul className="divide-y divide-border">
              {recent.map((i) => (
                <li key={i.id} className="px-5 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{i.title}</p>
                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{i.affectedComponent}</p>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                        i.severity === "critical" && "bg-destructive/10 text-destructive",
                        i.severity === "high" && "bg-destructive/10 text-destructive",
                        i.severity === "medium" && "bg-warning/10 text-warning",
                        i.severity === "low" && "bg-muted text-muted-foreground",
                      )}
                    >
                      {i.severity}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
