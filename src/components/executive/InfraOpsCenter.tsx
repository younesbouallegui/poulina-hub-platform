import { Link } from "react-router-dom";
import { Server as ServerIcon, AlertTriangle } from "lucide-react";
import { useServers, useSites, useCapacityForecasts } from "@/hooks/useInfrastructure";

export function InfraOpsCenter() {
  const { data: servers = [] } = useServers();
  const { data: sites = [] } = useSites();
  const { data: caps = [] } = useCapacityForecasts();

  const healthy = servers.filter((s) => s.status === "healthy").length;
  const critical = servers.filter((s) => s.status === "critical" || s.status === "degraded").length;
  const avgSla = servers.length ? (servers.reduce((a, s) => a + s.slaActual, 0) / servers.length) : 100;
  const risk = Math.round(servers.length ? (servers.reduce((a, s) => a + s.riskScore, 0) / servers.length) : 0);
  const highRiskCap = caps.filter((c) => c.risk === "high").length;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-3 flex items-baseline justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Infrastructure Operations Center</p>
        <Link to="/infrastructure" className="text-[11px] font-medium text-primary hover:underline">Open control plane →</Link>
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        <Kpi label="Servers" value={String(servers.length)} hint={`${healthy} healthy`} />
        <Kpi label="At risk" value={String(critical)} hint="critical + degraded" intent={critical > 0 ? "warn" : "ok"} />
        <Kpi label="Fleet SLA" value={`${avgSla.toFixed(2)}%`} />
        <Kpi label="Risk score" value={String(risk)} intent={risk > 60 ? "warn" : "ok"} />
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div>
          <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Sites posture</p>
          <div className="space-y-1.5">
            {sites.map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-md border border-border bg-background px-2.5 py-1.5 text-xs">
                <span>{s.name} <span className="text-[10px] text-muted-foreground">· {s.servers} hosts</span></span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ring-1 ${s.status === "healthy" ? "bg-success/10 text-success ring-success/30" : "bg-yellow-500/10 text-yellow-600 ring-yellow-500/30"}`}>{s.status}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Capacity risks · {highRiskCap} high</p>
          <div className="space-y-1.5">
            {caps.filter((c) => c.risk !== "low").slice(0, 5).map((c, i) => (
              <div key={i} className="flex items-center justify-between rounded-md border border-border bg-background px-2.5 py-1.5 text-xs">
                <span className="capitalize">{c.resource} · {c.scopeValue ?? c.scope}</span>
                <span className="font-mono text-[10px] text-muted-foreground">+90d: {c.forecast90dPct}%</span>
              </div>
            ))}
            {caps.filter((c) => c.risk !== "low").length === 0 && <p className="text-xs text-muted-foreground">No capacity risks.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, hint, intent }: { label: string; value: string; hint?: string; intent?: "ok" | "warn" }) {
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-1 text-xl font-semibold ${intent === "warn" ? "text-orange-500" : ""}`}>{value}</p>
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
