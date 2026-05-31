import { PageHeader } from "@/components/layout/PageHeader";
import { useAuditLog } from "@/hooks/useAiOps";
import { Bot, CheckCircle2, ShieldOff, UserCheck, Wand2, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AuditEntry } from "@/types/aiops";

const META: Record<AuditEntry["kind"], { Icon: React.ComponentType<{ className?: string }>; cls: string; label: string }> = {
  ack: { Icon: CheckCircle2, cls: "text-info", label: "Acknowledged" },
  "ai-explain": { Icon: Bot, cls: "text-primary", label: "AI analysis" },
  "ai-remediate-plan": { Icon: Wand2, cls: "text-primary", label: "Remediation plan" },
  "ai-remediate-execute": { Icon: Zap, cls: "text-success", label: "Remediation executed" },
  approval: { Icon: UserCheck, cls: "text-warning", label: "Approval" },
  rollback: { Icon: ShieldOff, cls: "text-destructive", label: "Rollback" },
  "kill-switch": { Icon: ShieldOff, cls: "text-destructive", label: "Kill switch" },
  "knowledge-write": { Icon: CheckCircle2, cls: "text-success", label: "Knowledge updated" },
};

const AutomationHistory = () => {
  const { entries } = useAuditLog();

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader title="Automation History" subtitle="Every AI suggestion, approval, execution and rollback — fully auditable." />
      <div className="flex-1 space-y-3 p-4 sm:p-6">
        {entries.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/20 p-10 text-center text-sm text-muted-foreground">
            No automation activity yet.
          </div>
        ) : (
          <ol className="space-y-2">
            {entries.map((e) => {
              const meta = META[e.kind];
              const Icon = meta.Icon;
              return (
                <li key={e.id} className="flex items-start gap-3 rounded-xl border border-border bg-card p-3">
                  <span className={cn("mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-muted", meta.cls)}>
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                      {meta.label}
                      <span className="font-mono text-[10px] text-muted-foreground">{new Date(e.ts).toLocaleString()}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">{e.message}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">actor: {e.actor}{e.meta?.eventId ? ` · event #${String(e.meta.eventId)}` : ""}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
};

export default AutomationHistory;
