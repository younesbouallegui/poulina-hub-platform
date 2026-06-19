import { useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { useAuditLog } from "@/hooks/useAiOps";
import { ExpandableAuditEntry } from "@/components/incidents/IncidentAuditTimeline";
import type { AuditEntry } from "@/types/aiops";

const KINDS: { v: AuditEntry["kind"] | "all"; label: string }[] = [
  { v: "all", label: "All" },
  { v: "ai-analysis", label: "Analysis" },
  { v: "ai-remediate-plan", label: "Plan" },
  { v: "ai-remediate-execute", label: "Execute" },
  { v: "ai-verify", label: "Verify" },
  { v: "approval", label: "Approval" },
  { v: "override", label: "Override" },
  { v: "policy-change", label: "Policy" },
  { v: "knowledge-write", label: "Knowledge" },
  { v: "rollback", label: "Rollback" },
];

const AutomationHistory = () => {
  const { entries } = useAuditLog();
  const [filter, setFilter] = useState<(typeof KINDS)[number]["v"]>("all");
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (filter !== "all" && e.kind !== filter) return false;
      if (q && !`${e.message} ${e.actor} ${e.meta?.host ?? ""}`.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [entries, filter, q]);

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader title="Automation History" subtitle="Every AI suggestion, approval, execution, verification, and rollback — fully auditable." />
      <div className="flex-1 space-y-3 p-4 sm:p-6">
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search message, actor, host…"
            className="min-w-[200px] flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-xs outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
          <div className="flex flex-wrap gap-1">
            {KINDS.map((k) => (
              <button
                key={k.v}
                onClick={() => setFilter(k.v)}
                className={
                  "rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-wider transition-colors " +
                  (filter === k.v ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70")
                }
              >
                {k.label}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/20 p-10 text-center text-sm text-muted-foreground">
            No automation activity matches the current filter.
          </div>
        ) : (
          <ol className="space-y-2">
            {filtered.map((e) => <ExpandableAuditEntry key={e.id} e={e} />)}
          </ol>
        )}
      </div>
    </div>
  );
};

export default AutomationHistory;
