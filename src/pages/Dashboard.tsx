import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  Server,
  Activity,
  ShieldCheck,
  TrendingUp,
  ArrowRight,
  Cpu,
  HardDrive,
} from "lucide-react";
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { PageHeader } from "@/components/layout/PageHeader";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/contexts/I18nContext";
import {
  generateTimeSeries,
  getIncidentsForUser,
  getServersForUser,
} from "@/data/mockData";
import { cn } from "@/lib/utils";

const Dashboard = () => {
  const { user } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();

  const servers = useMemo(
    () => (user ? getServersForUser(user.assignedServers) : []),
    [user],
  );
  const incidents = useMemo(
    () => (user ? getIncidentsForUser(user.assignedServers) : []),
    [user],
  );

  const healthy = servers.filter((s) => s.status === "healthy").length;
  const openIncidents = incidents.filter((i) => i.status !== "resolved").length;
  const avgUptime =
    servers.length > 0
      ? servers.reduce((acc, s) => acc + s.uptime, 0) / servers.length
      : 0;

  const cpuSeries = generateTimeSeries(1, 55, 18);
  const memSeries = generateTimeSeries(7, 64, 14);

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader title={t("dash.title")} subtitle={t("dash.subtitle")} />

      <div className="flex-1 space-y-6 p-4 sm:p-6">
        {/* Welcome / scope */}
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-card lg:col-span-2">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
              {t("dash.welcome")}
            </p>
            <h2 className="mt-1 text-xl font-semibold text-foreground">{user?.name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{user?.email}</p>

            <div className="mt-4 flex flex-wrap gap-2">
              <Badge label={t("common.role")} value={user?.role ?? ""} tone="primary" />
              <Badge
                label={t("common.assignedServers")}
                value={String(user?.assignedServers.length ?? 0)}
                tone="muted"
              />
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {t("dash.yourScope")}
            </p>
            <div className="mt-3 space-y-2">
              {servers.slice(0, 3).map((s) => (
                <div key={s.id} className="flex items-center justify-between text-sm">
                  <span className="truncate font-medium text-foreground">{s.name}</span>
                  <StatusDot status={s.status} />
                </div>
              ))}
              {servers.length === 0 && (
                <p className="text-xs text-muted-foreground">{t("infra.noServers")}</p>
              )}
            </div>
          </div>
        </section>

        {/* KPI row */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            icon={ShieldCheck}
            label={t("dash.servicesHealthy")}
            value={`${healthy}/${servers.length}`}
            tone="success"
          />
          <KpiCard
            icon={AlertTriangle}
            label={t("dash.openIncidents")}
            value={String(openIncidents)}
            tone={openIncidents > 0 ? "destructive" : "muted"}
          />
          <KpiCard
            icon={TrendingUp}
            label={t("dash.avgUptime")}
            value={`${avgUptime.toFixed(2)}%`}
            tone="primary"
          />
          <KpiCard
            icon={Server}
            label={t("common.assignedServers")}
            value={String(servers.length)}
            tone="muted"
          />
        </section>

        {/* Charts */}
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ChartCard title={t("dash.cpuLoad")} icon={Cpu} data={cpuSeries} color="hsl(var(--primary))" />
          <ChartCard title={t("dash.memoryLoad")} icon={Activity} data={memSeries} color="hsl(var(--info))" />
        </section>

        {/* Servers + Incidents */}
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Servers list */}
          <div className="rounded-2xl border border-border bg-card shadow-card">
            <div className="flex items-center justify-between border-b border-border p-4">
              <h3 className="text-sm font-semibold text-foreground">{t("dash.servers")}</h3>
              <button
                onClick={() => navigate("/infrastructure")}
                className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                {t("dash.viewAll")}
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>
            <ul className="divide-y divide-border">
              {servers.map((s) => (
                <li key={s.id} className="flex items-center justify-between px-4 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{s.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {s.type} · {s.region}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="hidden font-mono text-xs text-muted-foreground sm:inline">
                      {s.cpu}% <Cpu className="inline h-3 w-3" />
                    </span>
                    <span className="hidden font-mono text-xs text-muted-foreground sm:inline">
                      {s.disk}% <HardDrive className="inline h-3 w-3" />
                    </span>
                    <StatusDot status={s.status} />
                  </div>
                </li>
              ))}
              {servers.length === 0 && (
                <li className="px-4 py-6 text-center text-sm text-muted-foreground">
                  {t("infra.noServers")}
                </li>
              )}
            </ul>
          </div>

          {/* Incidents */}
          <div className="rounded-2xl border border-border bg-card shadow-card">
            <div className="flex items-center justify-between border-b border-border p-4">
              <h3 className="text-sm font-semibold text-foreground">{t("dash.recentIncidents")}</h3>
              <button
                onClick={() => navigate("/incidents")}
                className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                {t("dash.viewAll")}
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>
            <ul className="divide-y divide-border">
              {incidents.slice(0, 5).map((i) => (
                <li
                  key={i.id}
                  className="flex items-start gap-3 px-4 py-3 text-sm transition-colors hover:bg-muted/40"
                >
                  <span
                    className={cn(
                      "mt-1 h-2 w-2 shrink-0 rounded-full",
                      i.severity === "critical" && "bg-destructive",
                      i.severity === "high" && "bg-warning",
                      i.severity === "medium" && "bg-info",
                      i.severity === "low" && "bg-muted-foreground",
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground">{i.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {i.id} · {i.affectedComponent}
                    </p>
                  </div>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    {i.status}
                  </span>
                </li>
              ))}
              {incidents.length === 0 && (
                <li className="px-4 py-6 text-center text-sm text-muted-foreground">
                  {t("dash.noIncidents")}
                </li>
              )}
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
};

const Badge = ({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "primary" | "muted";
}) => (
  <div
    className={cn(
      "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs",
      tone === "primary"
        ? "border-primary/20 bg-primary/5 text-primary"
        : "border-border bg-muted text-foreground",
    )}
  >
    <span className="text-muted-foreground">{label}:</span>
    <span className="font-semibold capitalize">{value}</span>
  </div>
);

const StatusDot = ({ status }: { status: "healthy" | "warning" | "critical" }) => {
  const cls =
    status === "healthy"
      ? "bg-success"
      : status === "warning"
        ? "bg-warning"
        : "bg-destructive";
  return (
    <span className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
      <span className={cn("h-2 w-2 rounded-full", cls)} />
      <span className="hidden capitalize sm:inline">{status}</span>
    </span>
  );
};

const KpiCard = ({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone: "primary" | "success" | "destructive" | "muted";
}) => {
  const toneCls =
    tone === "success"
      ? "text-success bg-success/10"
      : tone === "destructive"
        ? "text-destructive bg-destructive/10"
        : tone === "primary"
          ? "text-primary bg-primary/10"
          : "text-muted-foreground bg-muted";
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-card transition-all hover-lift">
      <div className="flex items-center gap-3">
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", toneCls)}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <p className="font-mono text-xl font-semibold tabular-nums text-foreground">{value}</p>
        </div>
      </div>
    </div>
  );
};

const ChartCard = ({
  title,
  icon: Icon,
  data,
  color,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  data: { t: string; value: number }[];
  color: string;
}) => (
  <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
    <div className="mb-3 flex items-center gap-2">
      <Icon className="h-4 w-4 text-primary" />
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
    </div>
    <div className="h-44">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 5, right: 8, bottom: 0, left: -20 }}>
          <defs>
            <linearGradient id={`g-${title}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="t"
            stroke="hsl(var(--muted-foreground))"
            tick={{ fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            interval={3}
          />
          <YAxis
            stroke="hsl(var(--muted-foreground))"
            tick={{ fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            domain={[0, 100]}
          />
          <Tooltip
            contentStyle={{
              background: "hsl(var(--popover))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2} fill={`url(#g-${title})`} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  </div>
);

export default Dashboard;
