import { useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { useIncidentKnowledge } from "@/hooks/useAiOps";
import { BookOpen, Search } from "lucide-react";
import { cn } from "@/lib/utils";

const KnowledgeBase = () => {
  const { records } = useIncidentKnowledge();
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return records;
    return records.filter((r) =>
      [r.trigger, r.host, r.rootCause ?? "", r.resolution ?? "", ...(r.symptoms ?? [])]
        .join(" ")
        .toLowerCase()
        .includes(term),
    );
  }, [records, q]);

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader title="Knowledge Base" subtitle="Resolutions captured by AI and engineers, ready for reuse." />
      <div className="flex-1 space-y-4 p-4 sm:p-6">
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by trigger, host, root cause…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <span className="font-mono text-[10px] text-muted-foreground">{filtered.length} / {records.length}</span>
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/20 p-10 text-center">
            <BookOpen className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">No knowledge entries yet.</p>
            <p className="text-xs text-muted-foreground">AI remediations and resolved incidents will appear here.</p>
          </div>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {filtered.map((r) => (
              <li key={r.id} className="rounded-xl border border-border bg-card p-4 shadow-card">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{r.trigger}</p>
                    <p className="font-mono text-[10px] text-muted-foreground">{r.host}</p>
                  </div>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ring-1",
                      r.outcome === "resolved" && "bg-success/15 text-success ring-success/30",
                      r.outcome === "mitigated" && "bg-info/15 text-info ring-info/30",
                      r.outcome === "escalated" && "bg-destructive/15 text-destructive ring-destructive/30",
                    )}
                  >
                    {r.outcome}
                  </span>
                </div>
                {r.rootCause && (
                  <p className="mt-2 text-xs text-muted-foreground"><strong className="text-foreground">RCA:</strong> {r.rootCause}</p>
                )}
                {r.resolution && (
                  <p className="mt-1 text-xs text-muted-foreground"><strong className="text-foreground">Fix:</strong> {r.resolution}</p>
                )}
                <div className="mt-3 flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>source: {r.source} · confidence {r.confidence}%</span>
                  <span className="font-mono">{new Date(r.createdAt).toLocaleString()}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default KnowledgeBase;
