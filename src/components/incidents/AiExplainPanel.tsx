import { useEffect, useRef, useState } from "react";
import { Brain, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { streamIncidentAi } from "@/lib/aiStream";
import { useAuditLog, useIncidentKnowledge } from "@/hooks/useAiOps";

interface Props {
  eventId: string;
  trigger: string;
  host: string;
  severity: string;
  opdata?: string;
  triggeredAt: string;
  actor: string;
  /** Optional: chat-mode follow-up after the explain finishes */
  enableChat?: boolean;
}

export const AiExplainPanel = ({
  eventId,
  trigger,
  host,
  severity,
  opdata,
  triggeredAt,
  actor,
  enableChat = true,
}: Props) => {
  const [text, setText] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const audit = useAuditLog();
  const kb = useIncidentKnowledge();

  const similar = kb.findSimilar({ trigger, host, symptoms: opdata ? [opdata] : [] }, 3);

  const run = (mode: "explain" | "chat" | "remediate", userMsg?: string) => {
    setErr(null);
    if (mode === "explain" || mode === "remediate") setText("");
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setStreaming(true);

    const incident = {
      eventId,
      trigger,
      host,
      severity,
      opdata,
      triggeredAt,
      relatedIncidents: similar.map((s) => ({
        id: s.record.id.slice(0, 6),
        name: s.record.trigger,
        resolution: s.record.resolution,
        similarity: s.similarity,
      })),
    };

    const messages =
      mode === "chat" && userMsg
        ? [{ role: "user" as const, content: userMsg }]
        : undefined;

    streamIncidentAi({
      mode,
      incident,
      messages,
      signal: controller.signal,
      onDelta: (d) => setText((prev) => prev + d),
      onDone: () => {
        setStreaming(false);
        audit.append({
          actor,
          kind: mode === "remediate" ? "ai-remediate-plan" : "ai-explain",
          message: mode === "remediate" ? "AI generated remediation plan" : "AI explained incident",
          meta: { eventId, mode },
        });
      },
      onError: (e) => {
        setStreaming(false);
        setErr(e.message);
      },
    });
  };

  // Auto-run explain on mount
  useEffect(() => {
    run("explain");
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  return (
    <div className="space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-primary shadow-glow">
            <Brain className="h-4 w-4 text-primary-foreground" />
          </div>
          <div>
            <p className="text-xs font-semibold text-foreground">AIOps Copilot</p>
            <p className="text-[10px] text-muted-foreground">
              {streaming ? "Analyzing incident…" : "Grounded analysis ready"}
            </p>
          </div>
        </div>
        <button
          onClick={() => run("explain")}
          disabled={streaming}
          className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-[10px] font-medium hover:bg-muted disabled:opacity-50"
        >
          <RefreshCw className={cn("h-3 w-3", streaming && "animate-spin")} />
          Re-analyze
        </button>
      </div>

      {similar.length > 0 && (
        <div className="rounded-md border border-border bg-card px-2 py-1.5 text-[10px] text-muted-foreground">
          <Sparkles className="mr-1 inline h-3 w-3 text-primary" />
          {similar[0].similarity}% similar to past incident — {similar[0].record.trigger}
        </div>
      )}

      {err && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-[11px] text-destructive">
          {err}
        </div>
      )}

      <article
        className={cn(
          "prose prose-sm max-w-none whitespace-pre-wrap rounded-md bg-card p-3 font-sans text-[12.5px] leading-relaxed text-foreground",
          "max-h-[420px] overflow-y-auto",
        )}
      >
        {text || (
          <span className="inline-flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> Gathering context…
          </span>
        )}
      </article>

      {enableChat && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!question.trim() || streaming) return;
            const q = question.trim();
            setText((prev) => prev + `\n\n---\n**You:** ${q}\n\n**Copilot:** `);
            setQuestion("");
            run("chat", q);
          }}
          className="flex items-center gap-2"
        >
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask follow-up: why is this host critical? what changed?"
            className="flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-xs outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
          <button
            type="submit"
            disabled={!question.trim() || streaming}
            className="rounded-md bg-primary px-2.5 py-1.5 text-[11px] font-semibold text-primary-foreground hover:bg-primary-glow disabled:opacity-50"
          >
            Ask
          </button>
        </form>
      )}
    </div>
  );
};
