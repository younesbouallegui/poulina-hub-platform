import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ChevronRight,
  Loader2,
  PlayCircle,
  RotateCcw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { useAuditLog } from "@/hooks/useAiOps";
import type { ExecutionPlan } from "@/lib/aiActionParser";
import { RISK_META, useExecution } from "@/lib/executionEngine";
import { ExecutionTimeline } from "./ExecutionTimeline";

interface Props {
  plan: ExecutionPlan;
}

const STATUS_COPY = {
  idle: "Ready to execute",
  confirming: "Awaiting confirmation",
  "backing-up": "Creating recovery point…",
  executing: "Executing plan…",
  success: "Executed successfully",
  failed: "Execution failed",
  "rolling-back": "Rollback in progress…",
  "rolled-back": "Rolled back to recovery point",
} as const;

export const ExecutionActionPanel = ({ plan }: Props) => {
  const { user } = useAuth();
  const audit = useAuditLog();
  const { record, prepare, cancel, confirmAndExecute, rollback } = useExecution(plan.planId);
  const [open, setOpen] = useState(false);
  const [criticalAck, setCriticalAck] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);

  const risk = RISK_META[plan.risk];
  const status = record?.status ?? "idle";
  const running =
    status === "backing-up" ||
    status === "executing" ||
    status === "rolling-back";
  const finished = status === "success" || status === "failed" || status === "rolled-back";

  const heroLabel = useMemo(() => {
    if (status === "idle" || status === "confirming") return "Execute Solution";
    if (status === "success") return "Rollback Changes";
    if (status === "failed") return "Rollback Changes";
    if (status === "rolled-back") return "Rolled back";
    return STATUS_COPY[status];
  }, [status]);

  const onExecuteClick = () => {
    prepare(plan);
    setOpen(true);
  };

  const onConfirm = async () => {
    setOpen(false);
    setCriticalAck(false);
    setTimelineOpen(true);
    audit.append({
      actor: user?.name ?? "user",
      kind: "ai-remediate-execute",
      message: `Executing AI plan (${plan.risk})`,
      meta: {
        action: plan.summary.slice(0, 80),
        commands: plan.steps.map((s) => s.command).filter(Boolean) as string[],
        reason: "User confirmed AI remediation",
      },
    });
    await confirmAndExecute(plan, user?.name ?? "user");
    audit.append({
      actor: user?.name ?? "user",
      kind: "ai-verify",
      message: "AI plan execution completed",
      meta: { action: plan.summary.slice(0, 80) },
    });
  };

  const onRollback = async () => {
    setTimelineOpen(true);
    audit.append({
      actor: user?.name ?? "user",
      kind: "rollback",
      message: "Rollback initiated by user",
      meta: { action: plan.summary.slice(0, 80) },
    });
    await rollback(user?.name ?? "user");
  };

  const onCancelDialog = () => {
    setOpen(false);
    setCriticalAck(false);
    cancel();
  };

  return (
    <aside className="mt-4 rounded-xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card p-4 shadow-card animate-fade-in">
      {/* Header strip */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-primary shadow-glow">
            <Sparkles className="h-4 w-4 text-primary-foreground" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary-glow">
              AI Action Panel
            </p>
            <p className="line-clamp-2 max-w-md text-sm font-medium text-foreground">
              {plan.summary}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-semibold",
                  risk.ring,
                  risk.tone,
                )}
              >
                <AlertTriangle className="h-3 w-3" />
                {risk.label}
              </span>
              <span>· ETA ~{plan.etaSeconds}s</span>
              <span>· {plan.steps.length} steps</span>
              {plan.services.length > 0 && <span>· {plan.services.length} services</span>}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {finished && (
            <button
              onClick={() => setTimelineOpen(true)}
              className="rounded-lg border border-border bg-card px-3 py-1.5 text-[11px] font-semibold text-foreground hover:bg-muted"
            >
              View timeline
            </button>
          )}
          {running ? (
            <button
              disabled
              className="inline-flex items-center gap-2 rounded-lg bg-muted px-4 py-2 text-xs font-semibold text-muted-foreground"
            >
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> {STATUS_COPY[status]}
            </button>
          ) : status === "success" || status === "failed" ? (
            <button
              onClick={onRollback}
              className="group inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-destructive to-destructive/80 px-4 py-2 text-xs font-semibold text-destructive-foreground shadow-glow transition-all hover:scale-[1.02]"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Rollback Changes
              <ChevronRight className="h-3 w-3 opacity-70 transition-transform group-hover:translate-x-0.5" />
            </button>
          ) : status === "rolled-back" ? (
            <span className="inline-flex items-center gap-2 rounded-lg border border-success/40 bg-success/10 px-4 py-2 text-xs font-semibold text-success">
              <ShieldCheck className="h-3.5 w-3.5" />
              Rolled back
            </span>
          ) : (
            <button
              onClick={onExecuteClick}
              className="group inline-flex items-center gap-2 rounded-lg bg-gradient-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-glow transition-all hover:scale-[1.02]"
            >
              <PlayCircle className="h-3.5 w-3.5" />
              {heroLabel}
              <ChevronRight className="h-3 w-3 opacity-70 transition-transform group-hover:translate-x-0.5" />
            </button>
          )}
        </div>
      </div>

      {/* Inline mini-progress when running or finished */}
      {(running || finished) && record && (
        <div className="mt-4">
          <ExecutionTimeline record={record} compact />
        </div>
      )}

      {/* Confirmation dialog */}
      <Dialog open={open} onOpenChange={(o) => (!o ? onCancelDialog() : setOpen(o))}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto border-primary/30 bg-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary-glow" />
              Confirm AI Remediation
            </DialogTitle>
            <DialogDescription>
              An automatic recovery point will be captured before any change is applied.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
              <Stat label="Risk" value={risk.label} valueClass={risk.tone} />
              <Stat label="ETA" value={`~${plan.etaSeconds}s`} />
              <Stat label="Steps" value={`${plan.steps.length}`} />
              <Stat label="Services" value={`${plan.services.length || "—"}`} />
            </div>

            {plan.warnings.length > 0 && (
              <div className="space-y-1 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-[11px] text-destructive">
                <p className="flex items-center gap-1.5 font-semibold">
                  <AlertTriangle className="h-3 w-3" /> Safety Layer warnings
                </p>
                {plan.warnings.map((w, i) => (
                  <p key={i} className="opacity-90">• {w}</p>
                ))}
              </div>
            )}

            <Tabs defaultValue="summary">
              <TabsList className="grid grid-cols-4">
                <TabsTrigger value="summary">Summary</TabsTrigger>
                <TabsTrigger value="commands">Commands</TabsTrigger>
                <TabsTrigger value="impact">Impact</TabsTrigger>
                <TabsTrigger value="outcome">Outcome</TabsTrigger>
              </TabsList>

              <TabsContent value="summary" className="space-y-2 pt-3 text-xs">
                <p className="text-foreground">{plan.summary}</p>
                <ol className="ml-4 list-decimal space-y-1 text-muted-foreground">
                  {plan.steps.map((s) => (
                    <li key={s.id}>
                      <span className="text-foreground">{s.name}</span>
                      <span className="ml-1 text-[10px]">— {s.description}</span>
                    </li>
                  ))}
                </ol>
              </TabsContent>

              <TabsContent value="commands" className="pt-3">
                <pre className="max-h-60 overflow-auto rounded-md bg-muted p-3 font-mono text-[11px] leading-relaxed text-foreground">
                  {plan.steps
                    .filter((s) => s.command)
                    .map((s) => `# ${s.name}\n${s.command}`)
                    .join("\n\n") || "# No raw commands — orchestrated operations"}
                </pre>
              </TabsContent>

              <TabsContent value="impact" className="space-y-2 pt-3 text-xs">
                <Group title="Services affected" items={plan.services} empty="No services detected" />
                <Group title="Resources affected" items={plan.resources} empty="No resources detected" />
              </TabsContent>

              <TabsContent value="outcome" className="pt-3 text-xs text-foreground">
                {plan.expectedOutcome}
              </TabsContent>
            </Tabs>

            {plan.critical && (
              <label className="flex cursor-pointer items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-[11px] text-destructive">
                <input
                  type="checkbox"
                  checked={criticalAck}
                  onChange={(e) => setCriticalAck(e.target.checked)}
                  className="mt-0.5 h-3.5 w-3.5"
                />
                <span>
                  I understand this is a <strong>critical</strong> operation that may impact
                  production. I have reviewed the commands and accept responsibility.
                </span>
              </label>
            )}
          </div>

          <DialogFooter>
            <button
              onClick={onCancelDialog}
              className="rounded-lg border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={plan.critical && !criticalAck}
              className="rounded-lg bg-gradient-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-glow transition-all hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
            >
              Confirm Execution
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Full live timeline dialog */}
      <Dialog open={timelineOpen} onOpenChange={setTimelineOpen}>
        <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto border-primary/30 bg-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PlayCircle className="h-5 w-5 text-primary-glow" />
              Live execution
            </DialogTitle>
            <DialogDescription>
              Real-time progress, recovery point & rollback history.
            </DialogDescription>
          </DialogHeader>
          {record && <ExecutionTimeline record={record} />}
        </DialogContent>
      </Dialog>
    </aside>
  );
};

const Stat = ({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) => (
  <div className="rounded-md border border-border bg-background-elevated/40 p-2">
    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
    <p className={cn("font-mono text-sm font-semibold text-foreground", valueClass)}>{value}</p>
  </div>
);

const Group = ({ title, items, empty }: { title: string; items: string[]; empty: string }) => (
  <div>
    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
      {title}
    </p>
    {items.length ? (
      <div className="flex flex-wrap gap-1">
        {items.map((i) => (
          <span
            key={i}
            className="rounded-md border border-border bg-background-elevated/40 px-2 py-0.5 font-mono text-[10px] text-foreground"
          >
            {i}
          </span>
        ))}
      </div>
    ) : (
      <p className="text-[11px] text-muted-foreground">{empty}</p>
    )}
  </div>
);
