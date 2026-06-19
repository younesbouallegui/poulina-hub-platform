import { Bot, CheckCircle2, Gauge, Shield, Sparkles, Zap } from "lucide-react";
import { useAiOpsMetrics, useKillSwitch } from "@/hooks/useAiOps";
import { cn } from "@/lib/utils";

export const AiOpsCenter = () => {
  const m = useAiOpsMetrics();
  const { killed, setKilled } = useKillSwitch();

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-primary shadow-glow">
            <Bot className="h-4 w-4 text-primary-foreground" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">AIOps Command</p>
            <p className="text-[10px] text-muted-foreground">Autonomous operations governance</p>
          </div>
        </div>
        <button
          onClick={() => setKilled(!killed)}
          className={`rounded-md px-2 py-1 text-[10px] font-semibold transition-colors ${
            killed
              ? "bg-destructive text-destructive-foreground"
              : "border border-border bg-card text-muted-foreground hover:bg-muted"
          }`}
        >
          {killed ? "Kill-switch ON" : "Kill-switch"}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Stat icon={Gauge} label="AI trust score" value={`${m.aiTrustScore}%`} accent="primary" />
        <Stat icon={CheckCircle2} label="Success rate" value={`${m.successRate}%`} accent="success" />
        <Stat icon={Zap} label="Autonomous runs" value={m.autonomousRuns} accent="info" />
        <Stat icon={Shield} label="Coverage" value={`${m.automationCoverage}%`} accent="primary" />
        <Stat icon={Sparkles} label="Avg confidence" value={`${m.avgConfidence}%`} accent="primary" />
        <Stat icon={Bot} label="AI resolved" value={m.aiResolved} accent="success" />
      </div>

      <div className="mt-3 space-y-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Confidence distribution</p>
        <div className="flex h-1.5 overflow-hidden rounded-full bg-muted">
          {(["auto", "approve", "investigate"] as const).map((t) => {
            const v = m.confidenceBuckets[t];
            const total = Object.values(m.confidenceBuckets).reduce((s, n) => s + n, 0) || 1;
            const pct = (v / total) * 100;
            const cls = t === "auto" ? "bg-success" : t === "approve" ? "bg-warning" : "bg-info";
            return <div key={t} className={cn("h-full", cls)} style={{ width: `${pct}%` }} />;
          })}
        </div>
      </div>

      <p className="mt-3 text-[10px] text-muted-foreground">
        {m.explainCount} analyses · {m.approvals} approvals · {m.failedRuns} failed · {m.totalResolved} resolved
      </p>
    </div>
  );
};

const Stat = ({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  accent: "primary" | "success" | "info";
}) => (
  <div className="rounded-lg border border-border bg-background-elevated/40 p-2">
    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
      <Icon
        className={`h-3 w-3 ${
          accent === "success" ? "text-success" : accent === "info" ? "text-info" : "text-primary"
        }`}
      />
      {label}
    </div>
    <p className="mt-0.5 font-mono text-lg font-semibold tabular-nums text-foreground">{value}</p>
  </div>
);
