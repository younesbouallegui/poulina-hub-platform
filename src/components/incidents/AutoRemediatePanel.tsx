import { useState } from "react";
import { CheckCircle2, Loader2, ShieldAlert, ShieldOff, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAiPolicies, useAuditLog, useIncidentKnowledge, useKillSwitch } from "@/hooks/useAiOps";
import { AiTrustBadge } from "./AiTrustBadge";
import type { RemediationPolicy } from "@/types/aiops";

interface Props {
  assetKey: string;       // typically host name
  eventId: string;
  trigger: string;
  host: string;
  actor: string;
}

const SAMPLE_STEPS = [
  { action: "Snapshot current state", risk: "low" as const, reversible: true },
  { action: "Restart degraded service", risk: "medium" as const, reversible: true },
  { action: "Verify health probes recover", risk: "low" as const, reversible: true },
];

export const AutoRemediatePanel = ({ assetKey, eventId, trigger, host, actor }: Props) => {
  const { getPolicy } = useAiPolicies();
  const policy = getPolicy(assetKey)?.policy ?? "off";
  const audit = useAuditLog();
  const kb = useIncidentKnowledge();
  const { killed } = useKillSwitch();
  const [approved, setApproved] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [done, setDone] = useState(false);

  const needsApproval: RemediationPolicy[] = ["approval"];
  const canRun = policy === "autonomous" || (policy === "approval" && approved);

  const execute = () => {
    if (killed || !canRun) return;
    setExecuting(true);
    audit.append({
      actor: policy === "autonomous" ? "ai-copilot" : actor,
      kind: "ai-remediate-execute",
      message: `Executed remediation plan for ${host}`,
      meta: { eventId, host, steps: SAMPLE_STEPS.map((s) => s.action) },
    });
    setTimeout(() => {
      kb.upsert({
        trigger,
        host,
        symptoms: [trigger],
        rootCause: "Auto-detected by AIOps Copilot",
        resolution: SAMPLE_STEPS.map((s) => s.action).join(" → "),
        actions: SAMPLE_STEPS.map((s) => s.action),
        outcome: "resolved",
        confidence: 88,
        source: "ai",
      });
      audit.append({
        actor: "ai-copilot",
        kind: "knowledge-write",
        message: "Knowledge base updated",
        meta: { eventId },
      });
      setExecuting(false);
      setDone(true);
    }, 1400);
  };

  if (killed) {
    return (
      <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
        <ShieldOff className="mr-1 inline h-3.5 w-3.5" />
        Kill-switch active. All AI remediation suspended platform-wide.
      </div>
    );
  }

  if (policy === "off") {
    return (
      <div className="rounded-xl border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
        <ShieldAlert className="mr-1 inline h-3.5 w-3.5" />
        AI Auto Remediation is not enabled for <strong>{host}</strong>.
        Set a policy in Infrastructure → Policies to enable.
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-success/30 bg-success/5 p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-success" />
          <span className="text-xs font-semibold text-foreground">Remediation Plan</span>
        </div>
        <AiTrustBadge policy={policy} />
      </div>

      <ol className="space-y-1.5 text-xs">
        {SAMPLE_STEPS.map((s, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/15 font-mono text-[10px] text-primary">
              {i + 1}
            </span>
            <div className="flex-1">
              <p className="text-foreground">{s.action}</p>
              <p className="text-[10px] text-muted-foreground">
                risk: {s.risk} · reversible: {s.reversible ? "yes" : "no"}
              </p>
            </div>
          </li>
        ))}
      </ol>

      {done ? (
        <div className="flex items-center gap-2 rounded-md bg-success/15 px-2 py-1.5 text-xs font-semibold text-success">
          <CheckCircle2 className="h-3.5 w-3.5" /> Remediation complete · knowledge base updated
        </div>
      ) : (
        <div className="flex items-center gap-2">
          {needsApproval.includes(policy) && (
            <label className="flex items-center gap-1.5 text-[11px] text-foreground">
              <input
                type="checkbox"
                checked={approved}
                onChange={(e) => {
                  setApproved(e.target.checked);
                  if (e.target.checked) {
                    audit.append({
                      actor,
                      kind: "approval",
                      message: `Approved AI remediation for ${host}`,
                      meta: { eventId },
                    });
                  }
                }}
                className="h-3 w-3"
              />
              I approve this plan
            </label>
          )}
          <button
            onClick={execute}
            disabled={!canRun || executing}
            className={cn(
              "ml-auto inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-[11px] font-semibold transition-all",
              canRun
                ? "bg-success text-success-foreground hover:opacity-90"
                : "bg-muted text-muted-foreground",
            )}
          >
            {executing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
            {policy === "autonomous" ? "Execute" : "Approve & Execute"}
          </button>
        </div>
      )}
    </div>
  );
};
