import { TrendingUp } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, Cell } from "recharts";
import { PageHeader } from "@/components/layout/PageHeader";
import { useCapacityForecasts } from "@/hooks/useInfrastructure";

const RISK_COLOR = { low: "#10b981", medium: "#eab308", high: "#dc2626" } as const;

export default function CapacityPlanning() {
  const { data: caps = [] } = useCapacityForecasts();
  const chartData = caps.map((c) => ({ name: `${c.resource}·${c.scopeValue ?? c.scope}`, current: c.currentPct, "30d": c.forecast30dPct, "90d": c.forecast90dPct, risk: c.risk }));
  return (
    <div className="flex min-h-full flex-col">
      <PageHeader title="Capacity Planning" subtitle="Predictive resource forecasts · exhaustion analysis · regional saturation" icon={TrendingUp} />
      <div className="grid gap-3 p-4 sm:p-6 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4 lg:col-span-2">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Forecast horizon (current / +30d / +90d)</p>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 40 }}>
              <XAxis dataKey="name" angle={-25} textAnchor="end" stroke="hsl(var(--muted-foreground))" fontSize={10} interval={0} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} />
              <RTooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 12 }} />
              <Bar dataKey="current" fill="hsl(var(--primary))" />
              <Bar dataKey="30d" fill="#f97316" />
              <Bar dataKey="90d" fill="#dc2626" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Risks</p>
          <div className="space-y-1.5">
            {caps.map((c, i) => (
              <div key={i} className="rounded-md border border-border bg-background p-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-medium capitalize">{c.resource} · {c.scopeValue ?? c.scope}</span>
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase text-white" style={{ background: RISK_COLOR[c.risk] }}>{c.risk}</span>
                </div>
                <p className="mt-0.5 text-[10px] text-muted-foreground">+90d: {c.forecast90dPct}% {c.exhaustionDays ? `· exhaust ~${c.exhaustionDays}d` : ""}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
