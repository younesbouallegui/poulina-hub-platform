import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CircleDot,
  GaugeCircle,
  Globe2,
  Server,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/contexts/I18nContext";
import {
  ALL_ALERTS,
  ALL_SERVERS,
  generateTimeSeries,
  getAlertsForUser,
  getServersForUser,
} from "@/data/mockData";
import { cn } from "@/lib/utils";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

const sevColor: Record<string, string> = {
  critical: "text-destructive",
  high: "text-orange-500",
  medium: "text-warning",
  low: "text-muted-foreground",
  info: "text-muted-foreground",
};

const Executive = () => {
  const { user } = useAuth();
  const { t } = useI18n();

  const servers = user ? getServersForUser(user.assignedServers) : [];
  const alerts = user ? getAlertsForUser(user.assignedServers) : [];
  const firing = alerts.filter((a) => a.status === "firing");
  const critical = firing.filter((a) => a.severity === "critical").length;
  const high = firing.filter((a) => a.severity === "high").length;

  const healthy = servers.filter((s) => s.status === "healthy").length;
  const warning = servers.filter((s) => s.status === "warning").length;
  const critServers = servers.filter((s) => s.status === "critical").length;
  const avgUptime =
    servers.length > 0
      ? servers.reduce((acc, s) => acc + s.uptime, 0) / servers.length
      : 100;

  // Global health score: weighted composite
  const healthScore = useMemo(() => {
    if (servers.length === 0) return 100;
    const base = (healthy / servers.length) * 100;
    const penalty = critical * 8 + high * 4 + warning * 2 + critServers * 6;
    return Math.max(0, Math.min(100, Math.round(base - penalty + (avgUptime - 99) * 5)));
  }, [servers.length, healthy, warning, critServers, critical, high, avgUptime]);

  const trend = useMemo(() => generateTimeSeries(7, healthScore, 6), [healthScore]);
  const slaTrend = useMemo(() => generateTimeSeries(11, avgUptime, 0.4), [avgUptime]);

  // Aggregate by region
  const byRegion = useMemo(() => {
    const map = new Map<string, { total: number; healthy: number; warning: number; critical: number }>();
    for (const s of servers) {
      const cur = map.get(s.region) ?? { total: 0, healthy: 0, warning: 0, critical: 0 };
      cur.total += 1;
      cur[s.status] += 1;
      map.set(s.region, cur);
    }
    return Array.from(map.entries()).map(([region, v]) => ({ region, ...v }));
  }, [servers]);

  const recommendations = useMemo(() => {
    const items: { id: string; severity: "critical" | "high" | "medium"; title: string; detail: string }[] = [];
    if (critical > 0) {
      items.push({
        id: "rec-1",
        severity: "critical",
        title: "Stabilize payment service",
        detail:
          "Connection pool exhaustion is the dominant root cause. Restart payment-svc workers and increase pool size to 256.",
      });
    }
    if (critServers > 0) {
      items.push({
        id: "rec-2",
        severity: "high",
        title: "Scale database primary",
        detail:
          "db-cluster-primary sustained CPU >85%. Plan a controlled failover and increase instance class.",
      });
    }
    if (avgUptime < 99.9) {
      items.push({
        id: "rec-3",
        severity: "medium",
        title: "SLA at risk this period",
        detail:
          "Aggregate uptime trending below 99.9%. Review last 7 incidents for recurring root causes.",
      });
    }
    if (items.length === 0) {
      items.push({
        id: "rec-ok",
        severity: "medium",
        title: "Operations nominal",
        detail: "No critical recommendations. Continue routine capacity reviews.",
      });
    }
    return items;
  }, [critical, critServers, avgUptime]);

  const score = healthScore;
  const scoreTone =
    score >= 90
      ? "text-success"
      : score >= 75
        ? "text-warning"
        : "text-destructive";

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader
        title={t("exec.title")}
        subtitle={t("exec.subtitle")}
        actions={
          <span className="inline-flex items-center gap-2 rounded-full border border-success/30 bg-success/10 px-3 py-1 text-xs font-medium text-success">
            <CircleDot className="h-3 w-3 animate-pulse" />
            {t("exec.live")}
          </span>
        }
      />

      <div className="grid gap-4 p-4 sm:p-6 lg:grid-cols-3">
        {/* Health Score */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-card transition hover:shadow-elevated lg:col-span-1">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {t("exec.healthScore")}
            </p>
            <GaugeCircle className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="mt-4 flex items-end gap-3">
            <span className={cn("text-5xl font-bold tracking-tight tabular-nums", scoreTone)}>
              {score}
            </span>
            <span className="mb-2 text-sm text-muted-foreground">/ 100</span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {score >= 90
              ? t("exec.healthGood")
              : score >= 75
                ? t("exec.healthWarn")
                : t("exec.healthBad")}
          </p>
          <div className="mt-4 h-24">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend}>
                <defs>
                  <linearGradient id="hg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  fill="url(#hg)"
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid gap-3 sm:grid-cols-2 lg:col-span-2">
          <KpiCard
            label={t("exec.activeIncidents")}
            value={firing.length}
            icon={AlertTriangle}
            tone={firing.length > 0 ? "danger" : "ok"}
            sub={`${critical} ${t("common.critical").toLowerCase()} · ${high} ${t("alerts.firing").toLowerCase()}`}
          />
          <KpiCard
            label={t("dash.servicesHealthy")}
            value={`${healthy}/${servers.length}`}
            icon={Server}
            tone={critServers > 0 ? "danger" : warning > 0 ? "warn" : "ok"}
            sub={`${warning} ${t("common.warning").toLowerCase()} · ${critServers} ${t("common.critical").toLowerCase()}`}
          />
          <KpiCard
            label={t("exec.slaPeriod")}
            value={`${avgUptime.toFixed(2)}%`}
            icon={GaugeCircle}
            tone={avgUptime >= 99.9 ? "ok" : avgUptime >= 99.5 ? "warn" : "danger"}
            sub={t("exec.target") + " 99.9%"}
            trend={slaTrend}
          />
          <KpiCard
            label={t("exec.mttr")}
            value="34m"
            icon={Activity}
            tone="ok"
            sub={t("exec.last7d")}
            delta={-12}
          />
        </div>

        {/* Regional view */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-card lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {t("exec.regional")}
              </p>
              <h3 className="mt-1 text-base font-semibold text-foreground">
                {t("exec.regionalSubtitle")}
              </h3>
            </div>
            <Globe2 className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="space-y-3">
            {byRegion.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("infra.noServers")}</p>
            ) : (
              byRegion.map((r) => {
                const okPct = (r.healthy / r.total) * 100;
                const warnPct = (r.warning / r.total) * 100;
                const critPct = (r.critical / r.total) * 100;
                return (
                  <div key={r.region} className="rounded-lg border border-border/60 p-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-foreground">{r.region}</span>
                      <span className="text-xs text-muted-foreground">
                        {r.total} {t("exec.services").toLowerCase()}
                      </span>
                    </div>
                    <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-muted">
                      <div className="bg-success transition-all" style={{ width: `${okPct}%` }} />
                      <div className="bg-warning transition-all" style={{ width: `${warnPct}%` }} />
                      <div className="bg-destructive transition-all" style={{ width: `${critPct}%` }} />
                    </div>
                    <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-success" />
                        {r.healthy} {t("common.healthy").toLowerCase()}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-warning" />
                        {r.warning} {t("common.warning").toLowerCase()}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-destructive" />
                        {r.critical} {t("common.critical").toLowerCase()}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* AI recommendations */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-card lg:col-span-1">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {t("exec.aiRecs")}
              </p>
              <h3 className="mt-1 text-base font-semibold text-foreground">
                {t("exec.aiRecsSubtitle")}
              </h3>
            </div>
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <ul className="space-y-3">
            {recommendations.map((r) => (
              <li
                key={r.id}
                className="rounded-lg border border-border/60 p-3 transition hover:border-primary/40 hover:bg-accent/40"
              >
                <div className="flex items-start gap-2">
                  <AlertTriangle className={cn("mt-0.5 h-4 w-4 shrink-0", sevColor[r.severity])} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{r.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{r.detail}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <Link
            to="/ai"
            className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
          >
            {t("exec.askAI")} <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {/* Top firing alerts */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-card lg:col-span-3">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {t("exec.topAlerts")}
              </p>
              <h3 className="mt-1 text-base font-semibold text-foreground">
                {t("exec.topAlertsSubtitle")}
              </h3>
            </div>
            <Link
              to="/alerts"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
            >
              {t("dash.viewAll")} <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {firing.length === 0 ? (
            <div className="flex items-center gap-2 rounded-lg border border-success/20 bg-success/5 p-4 text-sm text-success">
              <CheckCircle2 className="h-4 w-4" />
              {t("dash.noIncidents")}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="py-2 pr-4 font-medium">{t("common.severity")}</th>
                    <th className="py-2 pr-4 font-medium">{t("alerts.title")}</th>
                    <th className="py-2 pr-4 font-medium">{t("alerts.trigger")}</th>
                    <th className="py-2 pr-4 font-medium">{t("alerts.firedAt")}</th>
                    <th className="py-2 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {firing.slice(0, 6).map((a) => (
                    <tr
                      key={a.id}
                      className="border-b border-border/60 transition hover:bg-accent/40"
                    >
                      <td className="py-2.5 pr-4">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium capitalize",
                            a.severity === "critical" &&
                              "bg-destructive/10 text-destructive ring-1 ring-destructive/30",
                            a.severity === "high" &&
                              "bg-orange-500/10 text-orange-500 ring-1 ring-orange-500/30",
                            a.severity === "medium" &&
                              "bg-warning/10 text-warning ring-1 ring-warning/30",
                            a.severity === "low" &&
                              "bg-muted text-muted-foreground ring-1 ring-border",
                          )}
                        >
                          {a.severity}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4 font-medium text-foreground">{a.title}</td>
                      <td className="py-2.5 pr-4 font-mono text-xs text-muted-foreground">
                        {a.trigger}
                      </td>
                      <td className="py-2.5 pr-4 text-xs text-muted-foreground">
                        {new Date(a.firedAt).toLocaleTimeString()}
                      </td>
                      <td className="py-2.5 text-right">
                        <Link
                          to={`/s/${a.externalId}`}
                          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                        >
                          {t("alerts.openRoom")} <ArrowRight className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface KpiCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "ok" | "warn" | "danger";
  trend?: { t: string; value: number }[];
  delta?: number;
}

const KpiCard = ({ label, value, sub, icon: Icon, tone, trend, delta }: KpiCardProps) => {
  const toneRing =
    tone === "ok"
      ? "ring-success/20"
      : tone === "warn"
        ? "ring-warning/30"
        : "ring-destructive/30";
  const toneText =
    tone === "ok" ? "text-success" : tone === "warn" ? "text-warning" : "text-destructive";
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-4 shadow-card transition duration-200 hover:-translate-y-0.5 hover:shadow-elevated",
        "ring-1",
        toneRing,
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </p>
        <Icon className={cn("h-4 w-4", toneText)} />
      </div>
      <div className="mt-3 flex items-end gap-2">
        <span className="text-3xl font-bold tracking-tight tabular-nums text-foreground">
          {value}
        </span>
        {delta !== undefined && (
          <span
            className={cn(
              "mb-1 inline-flex items-center gap-0.5 text-xs font-medium",
              delta < 0 ? "text-success" : "text-destructive",
            )}
          >
            {delta < 0 ? (
              <TrendingDown className="h-3 w-3" />
            ) : (
              <TrendingUp className="h-3 w-3" />
            )}
            {Math.abs(delta)}%
          </span>
        )}
      </div>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
      {trend && (
        <div className="mt-3 h-10">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trend}>
              <Area
                type="monotone"
                dataKey="value"
                stroke="hsl(var(--primary))"
                strokeWidth={1.5}
                fill="hsl(var(--primary) / 0.15)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

export default Executive;
