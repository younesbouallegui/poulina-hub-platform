import { Bot, CheckCircle2, ShieldOff, UserCheck, Wand2, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuditLog } from "@/hooks/useAiOps";
import type { AuditEntry } from "@/types/aiops";

const KIND_META: Record<AuditEntry["kind"], { Icon: React.ComponentType<{ className?: string }>; cls: string; label: string }> = {
  ack: { Icon: CheckCircle2, cls: "text-info", label: "Acknowledged" },
  "ai-explain": { Icon: Bot, cls: "text-primary", label: "AI analysis" },
  "ai-remediate-plan": { Icon: Wand2, cls: "text-primary", label: "Remediation plan" },
  "ai-remediate-execute": { Icon: Zap, cls: "text-success", label: "Remediation executed" },
  approval: { Icon: UserCheck, cls: "text-warning", label: "Approval" },
  rollback: { Icon: ShieldOff, cls: "text-destructive", label: "Rollback" },
  "kill-switch": { Icon: ShieldOff, cls: "text-destructive", label: "Kill switch" },
  "knowledge-write": { Icon: CheckCircle2, cls: "text-success", label: "Knowledge updated" },
};

export const IncidentAuditTimeline = ({ eventId }: { eventId: string }) => {
  const { forIncident } = useAuditLog();
  const entries = forIncident(eventId);

  if (entries.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No actions yet. Operational timeline will populate as you Acknowledge, Explain, or Remediate.
      </p>
    );
  }

  return (
    <ol className="space-y-2">
      {[...entries].reverse().map((e) => {
        const meta = KIND_META[e.kind];
        const Icon = meta.Icon;
        return (
          <li key={e.id} className="flex items-start gap-2 text-xs">
            <span className={cn("mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-muted", meta.cls)}>
              <Icon className="h-3 w-3" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 font-medium text-foreground">
                <span>{meta.label}</span>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {new Date(e.ts).toLocaleTimeString()}
                </span>
              </p>
              <p className="text-[11px] text-muted-foreground">{e.message} · {e.actor}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
};
