import { useMemo } from "react";
import {
  ResponsiveContainer, LineChart, Line, AreaChart, Area, BarChart, Bar,
  PieChart, Pie, Cell, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";
import { cn } from "@/lib/utils";
import { Bell, AlertTriangle, ShieldCheck, Activity } from "lucide-react";
import type { DashboardPanel, VizKind } from "@/types/monitoring";

const SEVERITY_COLOR: Record<string, string> = {
  ok: "hsl(142 71% 45%)",
  info: "hsl(var(--primary))",
  warning: "hsl(38 92% 50%)",
  critical: "hsl(var(--destructive))",
};

const series = (n = 48, base = 50, amp = 25) =>
  Array.from({ length: n }, (_, i) => ({
    t: `${String(Math.floor(i / 4)).padStart(2, "0")}:${String((i % 4) * 15).padStart(2, "0")}`,
    a: Math.max(0, Math.round(base + Math.sin(i / 4) * amp + Math.random() * 8)),
    b: Math.max(0, Math.round(base * 0.9 + Math.cos(i / 5) * amp * 0.8 + Math.random() * 6)),
    c: Math.max(0, Math.round(base * 0.7 + Math.sin(i / 6) * amp * 0.6 + Math.random() * 5)),
  }));

const sevPie = [
  { name: "Critical", value: 4, color: SEVERITY_COLOR.critical },
  { name: "Warning", value: 12, color: SEVERITY_COLOR.warning },
  { name: "Info", value: 27, color: SEVERITY_COLOR.info },
  { name: "OK", value: 156, color: SEVERITY_COLOR.ok },
];

const tableRows = ["web-01", "web-02", "db-01", "db-02", "cache-01", "edge-01"].map((h, i) => ({
  host: h,
  cpu: 30 + i * 11,
  mem: 45 + i * 6,
  status: i === 3 ? "critical" : i === 1 ? "warning" : "ok",
}));

interface Props {
  panel: DashboardPanel;
}

export const PanelRenderer = ({ panel }: Props) => {
  const data = useMemo(() => series(48, 50, 25), []);
  const kind: VizKind = panel.viz;
  const thresholds = panel.config.thresholds;

  const tooltip = {
    contentStyle: {
      background: "hsl(var(--popover))",
      border: "1px solid hsl(var(--border))",
      borderRadius: 8,
      fontSize: 12,
    },
    labelStyle: { color: "hsl(var(--muted-foreground))" },
  };

  if (kind === "stat") {
    const v = data.at(-1)?.a ?? 0;
    return (
      <div className="flex h-full flex-col items-center justify-center">
        <p className="text-4xl font-bold tracking-tight text-foreground">{v}</p>
        <p className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground">last value</p>
        <p className={cn("mt-2 text-xs", v > 70 ? "text-destructive" : "text-success")}>
          {v > 70 ? "↑ trending up" : "↓ within range"}
        </p>
      </div>
    );
  }

  if (kind === "gauge" || kind === "sla_meter") {
    const v = 87;
    const angle = (v / 100) * 180;
    const x = 50 + 40 * Math.cos((180 - angle) * Math.PI / 180);
    const y = 55 - 40 * Math.sin((180 - angle) * Math.PI / 180);
    const color = v >= 99 ? SEVERITY_COLOR.ok : v >= 95 ? SEVERITY_COLOR.warning : SEVERITY_COLOR.critical;
    return (
      <div className="flex h-full flex-col items-center justify-center">
        <svg viewBox="0 0 100 60" className="h-full w-full max-h-40">
          <path d="M10,55 A40,40 0 0 1 90,55" stroke="hsl(var(--muted))" strokeWidth="8" fill="none" strokeLinecap="round" />
          <path d={`M10,55 A40,40 0 0 1 ${x},${y}`} stroke={color} strokeWidth="8" fill="none" strokeLinecap="round" />
        </svg>
        <p className="mt-2 text-2xl font-bold text-foreground">{v}%</p>
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
          {kind === "sla_meter" ? "SLA" : "current"}
        </p>
      </div>
    );
  }

  if (kind === "table") {
    return (
      <div className="h-full overflow-auto text-xs">
        <table className="w-full">
          <thead className="sticky top-0 bg-card text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr><th className="px-2 py-1.5 text-left">Host</th><th className="px-2 py-1.5 text-right">CPU</th><th className="px-2 py-1.5 text-right">Mem</th><th className="px-2 py-1.5 text-right">Status</th></tr>
          </thead>
          <tbody>
            {tableRows.map((r) => (
              <tr key={r.host} className="border-t border-border">
                <td className="px-2 py-1.5 font-mono">{r.host}</td>
                <td className="px-2 py-1.5 text-right">{r.cpu}%</td>
                <td className="px-2 py-1.5 text-right">{r.mem}%</td>
                <td className="px-2 py-1.5 text-right">
                  <span className="inline-block h-2 w-2 rounded-full" style={{ background: SEVERITY_COLOR[r.status] }} /> {r.status}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (kind === "alert_stream") {
    const items = [
      { sev: "critical", msg: "db-replica-02: replication lag 124s", t: "2m" },
      { sev: "warning", msg: "linux-server-02: CPU 91%", t: "5m" },
      { sev: "info", msg: "core-switch-01: config change", t: "12m" },
      { sev: "warning", msg: "edge-switch-02: packet loss 2.4%", t: "18m" },
      { sev: "ok", msg: "k8s-master-01: deploy succeeded", t: "27m" },
    ];
    return (
      <div className="h-full space-y-1.5 overflow-auto">
        {items.map((it, i) => (
          <div key={i} className="flex items-start gap-2 rounded-md border border-border bg-background/50 p-2">
            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: SEVERITY_COLOR[it.sev] }} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs text-foreground">{it.msg}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{it.sev} · {it.t} ago</p>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (kind === "timeline") {
    return (
      <div className="relative h-full p-2">
        <div className="absolute inset-x-2 top-1/2 h-px bg-border" />
        {[10, 30, 55, 78].map((p, i) => (
          <div key={i} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${p}%`, top: "50%" }}>
            <div className="h-3 w-3 rounded-full ring-2 ring-card" style={{ background: SEVERITY_COLOR[["ok", "warning", "critical", "info"][i]] }} />
          </div>
        ))}
      </div>
    );
  }

  if (kind === "topology") {
    return (
      <div className="flex h-full items-center justify-center">
        <svg viewBox="0 0 200 100" className="h-full w-full">
          {[[40, 30], [100, 20], [160, 30], [40, 70], [100, 80], [160, 70]].map(([cx, cy], i) => (
            <g key={i}>
              <line x1={100} y1={50} x2={cx} y2={cy} stroke="hsl(var(--border))" />
              <circle cx={cx} cy={cy} r={6} fill={SEVERITY_COLOR[["ok", "ok", "warning", "ok", "critical", "ok"][i]]} />
            </g>
          ))}
          <circle cx={100} cy={50} r={10} fill="hsl(var(--primary))" />
        </svg>
      </div>
    );
  }

  if (kind === "heatmap") {
    return (
      <div className="grid h-full grid-cols-12 grid-rows-6 gap-0.5 p-1">
        {Array.from({ length: 72 }).map((_, i) => {
          const v = Math.random();
          const c = v < 0.4 ? SEVERITY_COLOR.ok : v < 0.7 ? SEVERITY_COLOR.info : v < 0.9 ? SEVERITY_COLOR.warning : SEVERITY_COLOR.critical;
          return <div key={i} className="rounded-sm" style={{ background: c, opacity: 0.3 + v * 0.7 }} />;
        })}
      </div>
    );
  }

  if (kind === "pie" || kind === "donut") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={sevPie} dataKey="value" nameKey="name" innerRadius={kind === "donut" ? 40 : 0} outerRadius={70} paddingAngle={2}>
            {sevPie.map((s) => <Cell key={s.name} fill={s.color} />)}
          </Pie>
          <Tooltip {...tooltip} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  if (kind === "bar") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data.slice(-12)} margin={{ top: 5, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="t" stroke="hsl(var(--muted-foreground))" fontSize={10} />
          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} />
          <Tooltip {...tooltip} />
          <Bar dataKey="a" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  // line / area / stacked_area (default time-series)
  const Chart = kind === "line" ? LineChart : AreaChart;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <Chart data={data} margin={{ top: 5, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="t" stroke="hsl(var(--muted-foreground))" fontSize={10} interval={7} />
        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} />
        <Tooltip {...tooltip} />
        {thresholds.map((th, i) => (
          <line key={i} />
        ))}
        {kind === "line" ? (
          <>
            <Line type="monotone" dataKey="a" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="b" stroke={SEVERITY_COLOR.ok} strokeWidth={2} dot={false} />
          </>
        ) : kind === "stacked_area" ? (
          <>
            <Area type="monotone" dataKey="a" stackId="1" stroke="hsl(var(--primary))" fill="hsl(var(--primary)/.4)" />
            <Area type="monotone" dataKey="b" stackId="1" stroke={SEVERITY_COLOR.ok} fill={SEVERITY_COLOR.ok + "55"} />
            <Area type="monotone" dataKey="c" stackId="1" stroke={SEVERITY_COLOR.warning} fill={SEVERITY_COLOR.warning + "55"} />
          </>
        ) : (
          <Area type="monotone" dataKey="a" stroke="hsl(var(--primary))" fill="hsl(var(--primary)/.25)" strokeWidth={2} />
        )}
      </Chart>
    </ResponsiveContainer>
  );
};
