import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  MinusCircle,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ExecutionRecord, StepRecord, StepStatus } from "@/lib/executionEngine";

interface Props {
  record: ExecutionRecord;
  compact?: boolean;
}

const STATUS_META: Record<StepStatus, { icon: typeof Clock; tone: string; label: string }> = {
  pending: { icon: Clock, tone: "text-muted-foreground", label: "Pending" },
  running: { icon: Loader2, tone: "text-primary-glow animate-spin", label: "Running" },
  success: { icon: CheckCircle2, tone: "text-success", label: "Success" },
  failed: { icon: AlertCircle, tone: "text-destructive", label: "Failed" },
  "rolled-back": { icon: RotateCcw, tone: "text-warning", label: "Rolled back" },
  skipped: { icon: MinusCircle, tone: "text-muted-foreground/60", label: "Skipped" },
};

function durationOf(s: StepRecord) {
  if (!s.startedAt || !s.finishedAt) return null;
  const ms = new Date(s.finishedAt).getTime() - new Date(s.startedAt).getTime();
  return `${(ms / 1000).toFixed(1)}s`;
}

export const ExecutionTimeline = ({ record, compact = false }: Props) => {
  const totalDone = record.steps.filter((s) => s.status === "success").length;
  const progress = Math.round((totalDone / record.steps.length) * 100);

  return (
    <div className="space-y-4">
      {/* Progress + recovery point */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-background-elevated/40 px-3 py-2 text-[11px]">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-3.5 w-3.5 text-success" />
          <span className="text-muted-foreground">Recovery point:</span>
          <span className="font-mono text-foreground">{record.recovery?.id ?? "pending"}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Progress</span>
          <div className="h-1.5 w-32 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-gradient-to-r from-primary to-primary-glow transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="font-mono text-foreground">{progress}%</span>
        </div>
      </div>

      <StepList title="Execution timeline" steps={record.steps} compact={compact} />

      {record.rollbackSteps && record.rollbackSteps.length > 0 && (
        <StepList
          title="Rollback timeline"
          steps={record.rollbackSteps}
          compact={compact}
          accent="warning"
        />
      )}
    </div>
  );
};

const StepList = ({
  title,
  steps,
  compact,
  accent = "primary",
}: {
  title: string;
  steps: StepRecord[];
  compact: boolean;
  accent?: "primary" | "warning";
}) => (
  <div>
    <p
      className={cn(
        "mb-2 text-[10px] font-semibold uppercase tracking-[0.14em]",
        accent === "warning" ? "text-warning" : "text-primary-glow",
      )}
    >
      {title}
    </p>
    <ol className="relative space-y-2 border-l border-border pl-4">
      {steps.map((s) => {
        const meta = STATUS_META[s.status];
        const Icon = meta.icon;
        const dur = durationOf(s);
        return (
          <li key={s.id} className="relative">
            <span
              className={cn(
                "absolute -left-[22px] top-1 flex h-4 w-4 items-center justify-center rounded-full bg-card ring-2",
                s.status === "running"
                  ? "ring-primary/50"
                  : s.status === "success"
                  ? "ring-success/40"
                  : s.status === "failed"
                  ? "ring-destructive/50"
                  : "ring-border",
              )}
            >
              <Icon className={cn("h-2.5 w-2.5", meta.tone)} />
            </span>
            <div className="rounded-md border border-border bg-background-elevated/30 p-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold text-foreground">{s.name}</p>
                <span className={cn("font-mono text-[10px]", meta.tone)}>
                  {meta.label}
                  {dur && ` · ${dur}`}
                </span>
              </div>
              {!compact && (
                <p className="mt-0.5 text-[11px] text-muted-foreground">{s.description}</p>
              )}
              {s.command && !compact && (
                <pre className="mt-1.5 overflow-auto rounded bg-muted px-2 py-1 font-mono text-[10.5px] text-foreground">
                  {s.command}
                </pre>
              )}
              {s.output && !compact && (
                <pre className="mt-1 overflow-auto rounded bg-card/60 px-2 py-1 font-mono text-[10.5px] text-success">
                  {s.output}
                </pre>
              )}
              {s.error && (
                <p className="mt-1 font-mono text-[10.5px] text-destructive">{s.error}</p>
              )}
              {(s.startedAt || s.finishedAt) && !compact && (
                <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                  {s.startedAt && `start ${new Date(s.startedAt).toLocaleTimeString()}`}
                  {s.finishedAt && ` · end ${new Date(s.finishedAt).toLocaleTimeString()}`}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  </div>
);
