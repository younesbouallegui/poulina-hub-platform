import { useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Clock,
  Cpu,
  Database,
  GaugeCircle,
  HardDrive,
  LayoutGrid,
  MemoryStick,
  Monitor,
  Plus,
  Save,
  Server,
  Trash2,
  Wifi,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/contexts/I18nContext";
import {
  ALL_ALERTS,
  generateTimeSeries,
  getAlertsForUser,
  getServersForUser,
} from "@/data/mockData";
import { cn } from "@/lib/utils";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Line,
  LineChart,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  CartesianGrid,
} from "recharts";
import { toast } from "sonner";

type WidgetKind =
  | "cpu"
  | "memory"
  | "disk"
  | "net"
  | "sla"
  | "alerts"
  | "incidents"
  | "uptime"
  | "logs";

interface Widget {
  id: string;
  kind: WidgetKind;
  title: string;
  span: 1 | 2; // grid columns spanned
}

interface DashboardLayout {
  id: string;
  name: string;
  widgets: Widget[];
}

const WIDGET_CATALOG: { kind: WidgetKind; title: string; icon: React.ComponentType<{ className?: string }>; span: 1 | 2 }[] = [
  { kind: "cpu", title: "CPU load", icon: Cpu, span: 2 },
  { kind: "memory", title: "Memory", icon: MemoryStick, span: 1 },
  { kind: "disk", title: "Disk usage", icon: HardDrive, span: 1 },
  { kind: "net", title: "Network throughput", icon: Wifi, span: 2 },
  { kind: "sla", title: "SLA compliance", icon: GaugeCircle, span: 1 },
  { kind: "alerts", title: "Active alerts", icon: AlertTriangle, span: 1 },
  { kind: "incidents", title: "Incidents (7d)", icon: Activity, span: 2 },
  { kind: "uptime", title: "Uptime per service", icon: Server, span: 2 },
  { kind: "logs", title: "Log throughput", icon: Database, span: 1 },
];

const TEMPLATES: DashboardLayout[] = [
  {
    id: "tpl-ops",
    name: "Operations overview",
    widgets: [
      { id: "w1", kind: "cpu", title: "CPU load", span: 2 },
      { id: "w2", kind: "memory", title: "Memory", span: 1 },
      { id: "w3", kind: "disk", title: "Disk usage", span: 1 },
      { id: "w4", kind: "alerts", title: "Active alerts", span: 1 },
      { id: "w5", kind: "uptime", title: "Uptime per service", span: 2 },
    ],
  },
  {
    id: "tpl-sla",
    name: "SLA & reliability",
    widgets: [
      { id: "w1", kind: "sla", title: "SLA compliance", span: 1 },
      { id: "w2", kind: "uptime", title: "Uptime per service", span: 2 },
      { id: "w3", kind: "incidents", title: "Incidents (7d)", span: 2 },
      { id: "w4", kind: "alerts", title: "Active alerts", span: 1 },
    ],
  },
  {
    id: "tpl-noc",
    name: "NOC wallboard",
    widgets: [
      { id: "w1", kind: "cpu", title: "CPU load", span: 2 },
      { id: "w2", kind: "net", title: "Network throughput", span: 2 },
      { id: "w3", kind: "alerts", title: "Active alerts", span: 1 },
      { id: "w4", kind: "incidents", title: "Incidents (7d)", span: 1 },
      { id: "w5", kind: "logs", title: "Log throughput", span: 1 },
    ],
  },
];

const Dashboards = () => {
  const { user } = useAuth();
  const { t } = useI18n();
  const [layout, setLayout] = useState<DashboardLayout>(TEMPLATES[0]);
  const [wallboard, setWallboard] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const servers = user ? getServersForUser(user.assignedServers) : [];
  const alerts = user ? getAlertsForUser(user.assignedServers) : [];

  const addWidget = (kind: WidgetKind, title: string, span: 1 | 2) => {
    setLayout((l) => ({
      ...l,
      widgets: [
        ...l.widgets,
        { id: `w-${Date.now()}`, kind, title, span },
      ],
    }));
    setPickerOpen(false);
    toast.success(t("dashboards.added"));
  };

  const removeWidget = (id: string) => {
    setLayout((l) => ({ ...l, widgets: l.widgets.filter((w) => w.id !== id) }));
  };

  const applyTemplate = (tpl: DashboardLayout) => {
    setLayout({ ...tpl, widgets: tpl.widgets.map((w) => ({ ...w, id: `w-${Math.random()}` })) });
    toast.success(t("dashboards.templateApplied"));
  };

  const saveLayout = () => {
    try {
      localStorage.setItem(`poulina-dashboard-${user?.email ?? "anon"}`, JSON.stringify(layout));
      toast.success(t("dashboards.saved"));
    } catch {
      toast.error("Save failed");
    }
  };

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader
        title={t("dashboards.title")}
        subtitle={t("dashboards.subtitle")}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setWallboard((w) => !w)}
              className="gap-1.5"
            >
              <Monitor className="h-4 w-4" />
              {wallboard ? t("dashboards.exitWallboard") : t("dashboards.wallboard")}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPickerOpen(true)} className="gap-1.5">
              <Plus className="h-4 w-4" />
              {t("dashboards.addWidget")}
            </Button>
            <Button size="sm" onClick={saveLayout} className="gap-1.5">
              <Save className="h-4 w-4" />
              {t("common.save")}
            </Button>
          </div>
        }
      />

      <div className="flex-1 p-4 sm:p-6">
        {/* Templates row */}
        {!wallboard && (
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {t("dashboards.templates")}:
            </span>
            {TEMPLATES.map((tpl) => (
              <button
                key={tpl.id}
                onClick={() => applyTemplate(tpl)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition",
                  "border-border bg-card text-foreground hover:border-primary/40 hover:bg-accent/40",
                )}
              >
                <LayoutGrid className="mr-1.5 inline h-3 w-3" />
                {tpl.name}
              </button>
            ))}
          </div>
        )}

        {/* Grid */}
        <div
          className={cn(
            "grid gap-4",
            wallboard ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-1 md:grid-cols-2 xl:grid-cols-3",
          )}
        >
          {layout.widgets.map((w) => (
            <WidgetCard
              key={w.id}
              widget={w}
              wallboard={wallboard}
              servers={servers}
              alertsCount={alerts.filter((a) => a.status === "firing").length}
              criticalCount={alerts.filter((a) => a.status === "firing" && a.severity === "critical").length}
              onRemove={() => removeWidget(w.id)}
            />
          ))}
          {layout.widgets.length === 0 && (
            <div className="col-span-full rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              {t("dashboards.empty")}
            </div>
          )}
        </div>
      </div>

      {/* Picker modal */}
      {pickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-foreground/40 backdrop-blur-sm animate-fade-in"
            onClick={() => setPickerOpen(false)}
          />
          <div className="relative z-10 w-full max-w-2xl rounded-xl border border-border bg-card shadow-elevated animate-scale-in">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h3 className="text-base font-semibold text-foreground">{t("dashboards.addWidget")}</h3>
              <button
                onClick={() => setPickerOpen(false)}
                className="rounded-md p-1.5 text-muted-foreground transition hover:bg-accent"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid gap-3 p-5 sm:grid-cols-2 md:grid-cols-3">
              {WIDGET_CATALOG.map((c) => {
                const Icon = c.icon;
                return (
                  <button
                    key={c.kind}
                    onClick={() => addWidget(c.kind, c.title, c.span)}
                    className="group flex flex-col items-start gap-2 rounded-lg border border-border bg-background p-4 text-left transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-card"
                  >
                    <Icon className="h-5 w-5 text-primary" />
                    <span className="text-sm font-medium text-foreground">{c.title}</span>
                    <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      {c.span === 2 ? "Wide" : "Compact"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface WidgetCardProps {
  widget: Widget;
  servers: ReturnType<typeof getServersForUser>;
  alertsCount: number;
  criticalCount: number;
  wallboard: boolean;
  onRemove: () => void;
}

const WidgetCard = ({ widget, servers, alertsCount, criticalCount, wallboard, onRemove }: WidgetCardProps) => {
  const { t } = useI18n();

  const cpuAvg = servers.length ? servers.reduce((a, s) => a + s.cpu, 0) / servers.length : 0;
  const memAvg = servers.length ? servers.reduce((a, s) => a + s.memory, 0) / servers.length : 0;
  const diskAvg = servers.length ? servers.reduce((a, s) => a + s.disk, 0) / servers.length : 0;
  const uptimeAvg = servers.length ? servers.reduce((a, s) => a + s.uptime, 0) / servers.length : 100;

  const cpuSeries = useMemo(() => generateTimeSeries(3, cpuAvg, 12), [cpuAvg]);
  const memSeries = useMemo(() => generateTimeSeries(5, memAvg, 8), [memAvg]);
  const netSeries = useMemo(() => generateTimeSeries(8, 60, 25), []);
  const incSeries = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => ({
        t: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i],
        value: Math.round(2 + Math.abs(Math.sin(i * 1.3) * 6)),
      })),
    [],
  );

  const span = widget.span === 2 ? "md:col-span-2" : "";

  const renderBody = () => {
    switch (widget.kind) {
      case "cpu":
        return (
          <Chart series={cpuSeries} color="hsl(var(--primary))" suffix="%" />
        );
      case "memory":
        return <Chart series={memSeries} color="hsl(var(--warning))" suffix="%" />;
      case "disk":
        return (
          <BigStat value={`${diskAvg.toFixed(0)}%`} sub={t("common.disk")} tone={diskAvg > 80 ? "danger" : diskAvg > 65 ? "warn" : "ok"} />
        );
      case "net":
        return <Chart series={netSeries} color="hsl(var(--success))" suffix=" Mbps" />;
      case "sla":
        return (
          <BigStat
            value={`${uptimeAvg.toFixed(2)}%`}
            sub={t("sla.compliance")}
            tone={uptimeAvg >= 99.9 ? "ok" : uptimeAvg >= 99.5 ? "warn" : "danger"}
          />
        );
      case "alerts":
        return (
          <div className="flex h-full flex-col justify-center">
            <span
              className={cn(
                "text-4xl font-bold tabular-nums",
                criticalCount > 0 ? "text-destructive" : alertsCount > 0 ? "text-warning" : "text-success",
              )}
            >
              {alertsCount}
            </span>
            <p className="mt-1 text-xs text-muted-foreground">
              {criticalCount} {t("common.critical").toLowerCase()}
            </p>
          </div>
        );
      case "incidents":
        return (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={incSeries}>
              <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="t" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        );
      case "uptime":
        return (
          <div className="space-y-2">
            {servers.slice(0, 5).map((s) => (
              <div key={s.id} className="flex items-center gap-3 text-xs">
                <span className="w-32 truncate font-medium text-foreground">{s.name}</span>
                <div className="flex h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "transition-all",
                      s.uptime >= 99.9 ? "bg-success" : s.uptime >= 99.5 ? "bg-warning" : "bg-destructive",
                    )}
                    style={{ width: `${Math.min(100, (s.uptime - 95) * 20)}%` }}
                  />
                </div>
                <span className="w-14 text-right tabular-nums text-muted-foreground">
                  {s.uptime.toFixed(2)}%
                </span>
              </div>
            ))}
            {servers.length === 0 && (
              <p className="text-sm text-muted-foreground">{t("infra.noServers")}</p>
            )}
          </div>
        );
      case "logs":
        return <Chart series={generateTimeSeries(13, 420, 80)} color="hsl(var(--accent-foreground))" suffix=" /s" />;
      default:
        return null;
    }
  };

  return (
    <div
      className={cn(
        "group relative flex flex-col rounded-xl border border-border bg-card p-4 shadow-card transition duration-200 hover:-translate-y-0.5 hover:shadow-elevated",
        span,
        wallboard && "p-3",
      )}
      style={{ minHeight: wallboard ? 160 : 200 }}
    >
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {widget.title}
        </p>
        {!wallboard && (
          <button
            onClick={onRemove}
            className="rounded-md p-1 text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:bg-accent hover:text-destructive"
            aria-label="Remove"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <div className="flex-1">{renderBody()}</div>
    </div>
  );
};

const Chart = ({ series, color, suffix }: { series: { t: string; value: number }[]; color: string; suffix?: string }) => (
  <ResponsiveContainer width="100%" height="100%">
    <AreaChart data={series} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
      <defs>
        <linearGradient id={`g-${color}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.35} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <XAxis dataKey="t" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
      <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
      <Tooltip
        contentStyle={{
          background: "hsl(var(--popover))",
          border: "1px solid hsl(var(--border))",
          borderRadius: 8,
          fontSize: 12,
        }}
        formatter={(v: number) => [`${v}${suffix ?? ""}`, ""]}
      />
      <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2} fill={`url(#g-${color})`} />
    </AreaChart>
  </ResponsiveContainer>
);

const BigStat = ({ value, sub, tone }: { value: string; sub: string; tone: "ok" | "warn" | "danger" }) => (
  <div className="flex h-full flex-col justify-center">
    <span
      className={cn(
        "text-4xl font-bold tabular-nums",
        tone === "ok" ? "text-success" : tone === "warn" ? "text-warning" : "text-destructive",
      )}
    >
      {value}
    </span>
    <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
  </div>
);

export default Dashboards;
