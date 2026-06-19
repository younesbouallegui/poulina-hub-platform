import { useState } from "react";
import {
  Bot, CheckCircle2, ChevronDown, ChevronRight, ShieldOff, ToggleRight,
  UserCheck, Wand2, Zap, Settings2, BookOpen, Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuditLog } from "@/hooks/useAiOps";
import type { AuditEntry } from "@/types/aiops";

const KIND_META: Record<AuditEntry["kind"], { Icon: React.ComponentType<{ className?: string }>; cls: string; label: string }> = {
  ack:                    { Icon: CheckCircle2, cls: "text-info",       label: "Acknowledged" },
  "ai-analysis":          { Icon: Search,       cls: "text-primary",    label: "AI Analysis Started" },
  "ai-explain":           { Icon: Bot,          cls: "text-primary",    label: "AI Explanation Requested" },
  "ai-remediate-plan":    { Icon: Wand2,        cls: "text-primary",    label: "Remediation Plan Built" },
  "ai-remediate-execute": { Icon: Zap,          cls: "text-success",    label: "Remediation Executed" },
  "ai-verify":            { Icon: CheckCircle2, cls: "text-success",    label: "Health Verification" },
  approval:               { Icon: UserCheck,    cls: "text-warning",    label: "Approval" },
  rollback:               { Icon: ShieldOff,    cls: "text-destructive",label: "Rollback" },
  "kill-switch":          { Icon: ShieldOff,    cls: "text-destructive",label: "Kill Switch" },
  "policy-change":        { Icon: Settings2,    cls: "text-info",       label: "Policy Change" },
  override:               { Icon: ToggleRight,  cls: "text-warning",    label: "Per-Incident Override" },
  "knowledge-write":      { Icon: BookOpen,     cls: "text-success",    label: "Knowledge Base Updated" },
};

export { KIND_META };

const Field = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex items-start gap-2 text-[11px]">
    <span className="w-28 shrink-0 text-muted-foreground">{label}</span>
    <span className="flex-1 break-words text-foreground">{value}</span>
  </div>
);

const StatusPill = ({ status }: { status?: "success" | "partial" | "failed" }) => {
  if (!status) return null;
  const cls =
    status === "success" ? "bg-success/15 text-success" :
    status === "failed"  ? "bg-destructive/15 text-destructive" :
                           "bg-warning/15 text-warning";
  return <span className={cn("rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase", cls)}>{status}</span>;
};

export const ExpandableAuditEntry = ({ e, defaultOpen = false }: { e: AuditEntry; defaultOpen?: boolean }) => {
  const meta = KIND_META[e.kind];
  const Icon = meta.Icon;
  const [open, setOpen] = useState(defaultOpen);
  const m = e.meta ?? {};
  const hasDetail =
    !!(m.reasoning?.length || m.decisionPath?.length || m.commands?.length ||
       m.verifications?.length || m.metricsChecked?.length || m.relatedServices?.length ||
       m.dependencies?.length || m.action || m.service || m.confidence != null ||
       m.fromPolicy || m.toPolicy || m.reason || m.durationMs);

  return (
    <li className="rounded-xl border border-border bg-card">
      <button
        type="button"
        onClick={() => hasDetail && setOpen((v) => !v)}
        className={cn(
          "flex w-full items-start gap-3 px-3 py-2 text-left",
          hasDetail && "hover:bg-muted/40",
        )}
      >
        <span className={cn("mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted", meta.cls)}>
          <Icon className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
            {hasDetail && (open
              ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />)}
            {meta.label}
            <StatusPill status={m.status as "success" | "partial" | "failed" | undefined} />
            {m.confidence != null && (
              <span className="rounded-md bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] text-primary">
                {m.confidence}% conf
              </span>
            )}
            <span className="ml-auto font-mono text-[10px] text-muted-foreground">
              {new Date(e.ts).toLocaleTimeString()}
            </span>
          </p>
          <p className="text-[11px] text-muted-foreground">{e.message} · {e.actor}</p>
        </div>
      </button>

      {open && hasDetail && (
        <div className="space-y-1.5 border-t border-border bg-background-elevated/30 px-3 py-3">
          {m.action && <Field label="Action" value={<span className="font-mono">{m.action}</span>} />}
          {m.service && <Field label="Service" value={<span className="font-mono">{m.service}</span>} />}
          {m.host && <Field label="Host" value={<span className="font-mono">{m.host}</span>} />}
          {m.durationMs != null && <Field label="Duration" value={`${(m.durationMs / 1000).toFixed(1)}s`} />}
          {m.fromPolicy && m.toPolicy && (
            <Field label="Policy" value={<><span className="font-mono">{m.fromPolicy}</span> → <span className="font-mono">{m.toPolicy}</span></>} />
          )}
          {m.reason && <Field label="Reason" value={m.reason} />}

          {!!m.reasoning?.length && (
            <Field label="Reasoning" value={
              <ul className="space-y-0.5">
                {m.reasoning.map((r, i) => <li key={i} className="list-inside list-disc">{r}</li>)}
              </ul>
            } />
          )}
          {!!m.decisionPath?.length && (
            <Field label="Decision path" value={
              <ol className="space-y-0.5">
                {m.decisionPath.map((d, i) => <li key={i}><span className="font-mono text-muted-foreground">{i + 1}.</span> {d}</li>)}
              </ol>
            } />
          )}
          {!!m.historicalMatches && <Field label="History matched" value={`${m.historicalMatches} similar incidents`} />}
          {!!m.relatedServices?.length && (
            <Field label="Related" value={m.relatedServices.join(", ")} />
          )}
          {!!m.dependencies?.length && (
            <Field label="Dependencies" value={m.dependencies.join(" → ")} />
          )}
          {!!m.commands?.length && (
            <Field label="Commands" value={
              <pre className="rounded-md border border-border bg-background p-2 font-mono text-[10px] leading-snug text-foreground">
{m.commands.join("\n")}
              </pre>
            } />
          )}
          {!!m.metricsChecked?.length && (
            <Field label="Metrics checked" value={
              <div className="flex flex-wrap gap-1">
                {m.metricsChecked.map((mc) => (
                  <span key={mc} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">{mc}</span>
                ))}
              </div>
            } />
          )}
          {!!m.verifications?.length && (
            <Field label="Verifications" value={
              <ul className="space-y-0.5">
                {m.verifications.map((v, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className={v.result === "pass" ? "text-success" : "text-destructive"}>
                      {v.result === "pass" ? "✓" : "✗"}
                    </span>
                    <span className="font-mono text-[11px]">{v.name}</span>
                    {v.detail && <span className="text-muted-foreground">— {v.detail}</span>}
                  </li>
                ))}
              </ul>
            } />
          )}
        </div>
      )}
    </li>
  );
};

export const IncidentAuditTimeline = ({ eventId }: { eventId: string }) => {
  const { forIncident } = useAuditLog();
  const entries = forIncident(eventId);

  if (entries.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No actions yet. Every step — analysis, plan, execution, verification — will appear here with full detail.
      </p>
    );
  }

  return (
    <ol className="space-y-2">
      {[...entries].reverse().map((e) => <ExpandableAuditEntry key={e.id} e={e} />)}
    </ol>
  );
};
