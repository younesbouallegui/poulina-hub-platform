import { useEffect, useMemo, useRef, useState, KeyboardEvent } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ArrowUp,
  Brain,
  Loader2,
  Sparkles,
  ShieldCheck,
  Square,
  Database,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { streamIncidentAi } from "@/lib/aiStream";
import { useIncidentKnowledge, useAuditLog } from "@/hooks/useAiOps";
import { parseAiPlan } from "@/lib/aiActionParser";
import { ExecutionActionPanel } from "@/components/ai-execution/ExecutionActionPanel";

export interface IncidentContext {
  eventId: string;
  trigger: string;
  host: string;
  severity: string;
  opdata?: string;
  triggeredAt?: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
}

interface ChatInterfaceProps {
  autoMessage?: string;
  autoMessageKey?: string;
  incidentContext?: IncidentContext;
}

const defaultSuggestions = [
  "Why is api-gateway-3 lagging?",
  "Show open incidents in eu-west-1",
  "Run health check on payment-svc",
  "Summarize last 24h SLA performance",
];

const incidentSuggestions = [
  "What happened?",
  "Why did this happen?",
  "How do I fix it?",
  "Show similar past incidents",
  "What changed before the incident?",
  "Which services are impacted?",
];

export const ChatInterface = ({
  autoMessage,
  autoMessageKey,
  incidentContext,
}: ChatInterfaceProps = {}) => {
  const { user } = useAuth();
  const kb = useIncidentKnowledge();
  const audit = useAuditLog();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const autoSentRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const pendingRef = useRef<Map<string, string>>(new Map());
  const rafRef = useRef<number | null>(null);

  const scheduleDrain = () => {
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const updates: Array<[string, string]> = [];
      pendingRef.current.forEach((buf, id) => {
        if (!buf) return;
        const take = Math.max(1, Math.ceil(buf.length / 8));
        const chunk = buf.slice(0, take);
        pendingRef.current.set(id, buf.slice(take));
        updates.push([id, chunk]);
      });
      if (updates.length) {
        setMessages((prev) =>
          prev.map((m) => {
            const u = updates.find(([id]) => id === m.id);
            return u ? { ...m, content: m.content + u[1] } : m;
          }),
        );
      }
      // Keep draining while data remains.
      let hasMore = false;
      pendingRef.current.forEach((buf) => { if (buf) hasMore = true; });
      if (hasMore) scheduleDrain();
    });
  };

  const flushPending = (id: string) => {
    const remaining = pendingRef.current.get(id) ?? "";
    pendingRef.current.delete(id);
    if (remaining) {
      setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, content: m.content + remaining } : m)),
      );
    }
  };


  // RAG: similar past incidents
  const similar = useMemo(() => {
    if (!incidentContext) return [];
    return kb.findSimilar(
      {
        trigger: incidentContext.trigger,
        host: incidentContext.host,
        symptoms: incidentContext.opdata ? [incidentContext.opdata] : [],
      },
      3,
    );
  }, [incidentContext, kb]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`;
  }, [input]);

  const stop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setSending(false);
    setMessages((m) =>
      m.map((msg) => (msg.streaming ? { ...msg, streaming: false } : msg)),
    );
  };

  const send = (override?: string) => {
    const text = (override ?? input).trim();
    if (!text || sending) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
    };
    const assistantId = crypto.randomUUID();
    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      streaming: true,
    };

    const nextMessages = [...messages, userMsg, assistantMsg];
    setMessages(nextMessages);
    if (override === undefined) setInput("");
    setSending(true);

    const controller = new AbortController();
    abortRef.current = controller;

    // First call with an incident context → explain mode for structured RCA.
    // Follow-ups → chat mode with full history.
    const isFirstWithIncident = incidentContext && messages.length === 0;

    const incidentPayload = incidentContext
      ? {
          eventId: incidentContext.eventId,
          trigger: incidentContext.trigger,
          host: incidentContext.host,
          severity: incidentContext.severity,
          opdata: incidentContext.opdata,
          triggeredAt: incidentContext.triggeredAt,
          relatedIncidents: similar.map((s) => ({
            id: s.record.id.slice(0, 6),
            name: s.record.trigger,
            resolution: s.record.resolution,
            similarity: s.similarity,
          })),
        }
      : undefined;

    const history = nextMessages
      .filter((m) => m.id !== assistantId)
      .map((m) => ({
        role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
        content: m.content,
      }));

    streamIncidentAi({
      mode: isFirstWithIncident ? "explain" : "chat",
      incident: incidentPayload,
      messages: isFirstWithIncident ? undefined : history,
      signal: controller.signal,
      onDelta: (delta) => {
        const prev = pendingRef.current.get(assistantId) ?? "";
        pendingRef.current.set(assistantId, prev + delta);
        scheduleDrain();
      },
      onDone: () => {
        flushPending(assistantId);
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, streaming: false } : m)),
        );
        setSending(false);
        abortRef.current = null;
        if (incidentContext) {
          audit.append({
            actor: user?.name ?? "user",
            kind: "ai-explain",
            message: "AI Insights chat response",
            meta: { eventId: incidentContext.eventId },
          });
        }
      },
      onError: (err) => {
        flushPending(assistantId);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  streaming: false,
                  content:
                    m.content +
                    `\n\n> ⚠️ ${err.status === 429 ? "Rate limit reached — try again shortly." : err.status === 402 ? "AI credits exhausted." : err.message}`,
                }
              : m,
          ),
        );
        setSending(false);
        abortRef.current = null;
      },
    });
  };


  // Auto-send on deep-link
  useEffect(() => {
    if (!autoMessage) return;
    const key = autoMessageKey ?? autoMessage;
    if (autoSentRef.current === key) return;
    autoSentRef.current = key;
    setMessages([]);
    const t = setTimeout(() => send(autoMessage), 50);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoMessage, autoMessageKey]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const isEmpty = messages.length === 0;
  const suggestions = incidentContext ? incidentSuggestions : defaultSuggestions;

  return (
    <div className="flex h-full w-full flex-col">
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
          {incidentContext && (
            <IncidentBanner ctx={incidentContext} similar={similar.length} />
          )}

          {isEmpty ? (
            <EmptyState
              onPick={(s) => send(s)}
              userName={user?.name?.split(" ")[0] ?? "there"}
              suggestions={suggestions}
              incidentMode={!!incidentContext}
            />
          ) : (
            <div className="space-y-6">
              {messages.map((m) =>
                m.role === "user" ? (
                  <UserMessage key={m.id} text={m.content} initials={user?.initials ?? "U"} />
                ) : (
                  <AiMessage key={m.id} msg={m} />
                ),
              )}
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto w-full max-w-3xl px-4 py-4 sm:px-6">
          <div
            className={cn(
              "group relative flex items-end gap-2 rounded-2xl border border-input bg-card px-3 py-2.5 shadow-card transition-all duration-200",
              "focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/15 focus-within:shadow-glow",
            )}
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              rows={1}
              placeholder={
                incidentContext
                  ? `Ask about incident #${incidentContext.eventId}…`
                  : "Ask AI about your infrastructure…"
              }
              className="max-h-[200px] min-h-[28px] flex-1 resize-none bg-transparent px-1 py-1 text-sm text-foreground outline-none placeholder:text-muted-foreground/70"
              disabled={sending}
            />
            <button
              onClick={() => (sending ? stop() : send())}
              disabled={!sending && !input.trim()}
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-all",
                "hover:bg-primary-glow hover:shadow-glow active:scale-95",
                "disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none",
              )}
              aria-label={sending ? "Stop generation" : "Send message"}
            >
              {sending ? <Square className="h-3.5 w-3.5 fill-current" /> : <ArrowUp className="h-4 w-4" />}
            </button>
          </div>
          <p className="mt-2 flex items-center justify-center gap-1.5 text-center text-[11px] text-muted-foreground">
            <ShieldCheck className="h-3 w-3 text-success" />
            Streaming via Lovable AI · Gemini free tier · Responses are AI-generated.
          </p>
        </div>
      </div>
    </div>
  );
};

const IncidentBanner = ({
  ctx,
  similar,
}: {
  ctx: IncidentContext;
  similar: number;
}) => (
  <div className="mb-4 flex items-start gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3">
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-primary shadow-glow">
      <Database className="h-4 w-4 text-primary-foreground" />
    </div>
    <div className="min-w-0 flex-1 text-xs">
      <p className="font-semibold text-foreground">
        Incident #{ctx.eventId} · {ctx.severity}
      </p>
      <p className="truncate text-muted-foreground">
        {ctx.host} — {ctx.trigger}
      </p>
      {similar > 0 && (
        <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-primary">
          <Sparkles className="h-3 w-3" /> {similar} similar past incident{similar > 1 ? "s" : ""} found in knowledge base
        </p>
      )}
    </div>
  </div>
);

const EmptyState = ({
  onPick,
  userName,
  suggestions,
  incidentMode,
}: {
  onPick: (s: string) => void;
  userName: string;
  suggestions: string[];
  incidentMode: boolean;
}) => (
  <div className="flex min-h-[60vh] flex-col items-center justify-center text-center animate-fade-in">
    <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-primary shadow-glow">
      <Brain className="h-7 w-7 text-primary-foreground" />
    </div>
    <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
      {incidentMode ? "Investigate this incident" : `Hello ${userName}, how can I help?`}
    </h2>
    <p className="mt-2 max-w-md text-sm text-muted-foreground">
      {incidentMode
        ? "Ask anything about this incident — RCA, remediation, history, blast radius."
        : "Ask anything about your infrastructure — incidents, metrics, runbooks, or remediation steps."}
    </p>

    <div className="mt-8 grid w-full max-w-2xl grid-cols-1 gap-2 sm:grid-cols-2">
      {suggestions.map((s) => (
        <button
          key={s}
          onClick={() => onPick(s)}
          className="group flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-left text-sm text-foreground transition-all hover-lift hover:border-primary/40"
        >
          <Sparkles className="h-4 w-4 shrink-0 text-primary transition-transform group-hover:scale-110" />
          <span className="flex-1 truncate">{s}</span>
        </button>
      ))}
    </div>
  </div>
);

const UserMessage = ({ text, initials }: { text: string; initials: string }) => (
  <div className="flex items-start justify-end gap-3 animate-fade-up">
    <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-tr-md bg-primary px-4 py-2.5 text-sm text-primary-foreground shadow-card">
      {text}
    </div>
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-[11px] font-semibold text-secondary-foreground ring-1 ring-border">
      {initials}
    </div>
  </div>
);

const AiMessage = ({ msg }: { msg: ChatMessage }) => {
  const plan = !msg.streaming && msg.content ? parseAiPlan(msg.id, msg.content) : null;
  return (
    <div className="flex items-start gap-3 animate-fade-up">
      <div
        className={cn(
          "relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-primary",
          msg.streaming && "ai-pulse",
        )}
      >
        <Brain className="h-4 w-4 text-primary-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-card sm:p-5">
          {msg.content ? (
            msg.streaming ? (
              <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                {msg.content}
                <span className="ml-0.5 inline-block h-3 w-1.5 animate-pulse-soft bg-primary align-middle" />
              </div>
            ) : (
              <article
                className={cn(
                  "prose prose-sm max-w-none text-sm leading-relaxed text-foreground",
                  "prose-headings:text-foreground prose-headings:font-semibold prose-headings:mt-3 prose-headings:mb-2 prose-headings:first:mt-0",
                  "prose-h2:text-[13px] prose-h2:uppercase prose-h2:tracking-[0.14em] prose-h2:text-primary",
                  "prose-h3:text-sm",
                  "prose-p:my-1.5 prose-li:my-0.5 prose-strong:text-foreground",
                  "prose-code:rounded prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:text-xs prose-code:before:content-none prose-code:after:content-none",
                  "prose-pre:bg-muted prose-pre:text-foreground",
                  "prose-a:text-primary",
                )}
              >
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
              </article>
            )
          ) : (
            <div className="inline-flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">Analyzing incident…</span>
            </div>
          )}
          {plan && <ExecutionActionPanel plan={plan} />}
        </div>
      </div>
    </div>
  );
};
