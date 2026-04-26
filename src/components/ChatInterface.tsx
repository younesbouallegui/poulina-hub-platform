import { useEffect, useRef, useState, KeyboardEvent } from "react";
import {
  ArrowUp,
  Brain,
  CheckCircle2,
  Loader2,
  Sparkles,
  ShieldCheck,
  User as UserIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

interface AiResponse {
  rootCause: string;
  suggestion: string;
  confidence: number;
}

interface ChatMessage {
  id: number;
  role: "user" | "ai";
  content?: string;
  ai?: AiResponse;
  thinking?: boolean;
}

const suggestions = [
  "Why is api-gateway-3 lagging?",
  "Show open incidents in eu-west-1",
  "Run health check on payment-svc",
  "Summarize last 24h SLA performance",
];

const sampleResponses: AiResponse[] = [
  {
    rootCause:
      "Connection pool exhaustion on stripe-webhook.eu-west-1. Pod payment-svc-7d4 is holding 98% of available sockets due to a stale TLS session bypassing the keepalive recycler.",
    suggestion:
      "Restart pod payment-svc-7d4 (rolling, zero-downtime) and reduce idle-socket TTL from 300s to 60s.",
    confidence: 96.4,
  },
  {
    rootCause:
      "Node-level memory pressure on worker-eu-04 affecting co-located pods. Kernel slab cache growth detected over the last 40 minutes.",
    suggestion:
      "Cordon worker-eu-04, drain workloads, and investigate slab cache growth pattern.",
    confidence: 89.2,
  },
  {
    rootCause:
      "Latency drift on checkout-api matches a noisy-neighbor signature. Co-tenant pod is consuming abnormal IOPS on the shared volume.",
    suggestion:
      "Migrate checkout-api to a dedicated node pool and enable QoS guarantees for critical workloads.",
    confidence: 91.7,
  },
];

interface ChatInterfaceProps {
  /** When provided, this message is sent to the AI automatically on mount. */
  autoMessage?: string;
  /** Stable key — when changed, retrigger the auto-send (e.g. eventId). */
  autoMessageKey?: string;
}

export const ChatInterface = ({ autoMessage, autoMessageKey }: ChatInterfaceProps = {}) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const autoSentRef = useRef<string | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`;
  }, [input]);

  const send = (override?: string) => {
    const text = (override ?? input).trim();
    if (!text || sending) return;
    const id = Date.now();
    const aiId = id + 1;
    setMessages((m) => [
      ...m,
      { id, role: "user", content: text },
      { id: aiId, role: "ai", thinking: true },
    ]);
    if (override === undefined) setInput("");
    setSending(true);

    setTimeout(() => {
      const sample = sampleResponses[Math.floor(Math.random() * sampleResponses.length)];
      setMessages((m) =>
        m.map((msg) =>
          msg.id === aiId ? { ...msg, thinking: false, ai: sample } : msg,
        ),
      );
      setSending(false);
    }, 1600);
  };

  // Auto-send a pre-filled message when arriving from a deep link (e.g. /s/:eventId)
  useEffect(() => {
    if (!autoMessage) return;
    const key = autoMessageKey ?? autoMessage;
    if (autoSentRef.current === key) return;
    autoSentRef.current = key;
    // Reset any prior conversation so the deep-link context is the entry point
    setMessages([]);
    // Defer slightly so the empty-state unmounts cleanly before the message renders
    const t = setTimeout(() => send(autoMessage), 50);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoMessage, autoMessageKey]);

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="flex h-full w-full flex-col">
      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
          {isEmpty ? (
            <EmptyState onPick={(s) => setInput(s)} userName={user?.name?.split(" ")[0] ?? "there"} />
          ) : (
            <div className="space-y-6">
              {messages.map((m) =>
                m.role === "user" ? (
                  <UserMessage key={m.id} text={m.content!} initials={user?.initials ?? "U"} />
                ) : (
                  <AiMessage key={m.id} msg={m} />
                ),
              )}
            </div>
          )}
        </div>
      </div>

      {/* Input area — sticky bottom, ChatGPT style */}
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
              placeholder="Ask AI about your infrastructure…"
              className="max-h-[200px] min-h-[28px] flex-1 resize-none bg-transparent px-1 py-1 text-sm text-foreground outline-none placeholder:text-muted-foreground/70"
              disabled={sending}
            />
            <button
              onClick={() => send()}
              disabled={!input.trim() || sending}
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-all",
                "hover:bg-primary-glow hover:shadow-glow active:scale-95",
                "disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none",
              )}
              aria-label="Send message"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
            </button>
          </div>
          <p className="mt-2 flex items-center justify-center gap-1.5 text-center text-[11px] text-muted-foreground">
            <ShieldCheck className="h-3 w-3 text-success" />
            Responses are AI-generated. Verify critical actions before applying.
          </p>
        </div>
      </div>
    </div>
  );
};

const EmptyState = ({ onPick, userName }: { onPick: (s: string) => void; userName: string }) => (
  <div className="flex min-h-[60vh] flex-col items-center justify-center text-center animate-fade-in">
    <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-primary shadow-glow">
      <Brain className="h-7 w-7 text-primary-foreground" />
    </div>
    <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
      Hello {userName}, how can I help?
    </h2>
    <p className="mt-2 max-w-md text-sm text-muted-foreground">
      Ask anything about your infrastructure — incidents, metrics, runbooks, or remediation steps.
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
    <div className="max-w-[85%] rounded-2xl rounded-tr-md bg-primary px-4 py-2.5 text-sm text-primary-foreground shadow-card">
      {text}
    </div>
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-[11px] font-semibold text-secondary-foreground ring-1 ring-border">
      {initials}
    </div>
  </div>
);

const AiMessage = ({ msg }: { msg: ChatMessage }) => (
  <div className="flex items-start gap-3 animate-fade-up">
    <div
      className={cn(
        "relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-primary",
        msg.thinking && "ai-pulse",
      )}
    >
      <Brain className="h-4 w-4 text-primary-foreground" />
    </div>
    <div className="min-w-0 flex-1">
      {msg.thinking ? (
        <div className="inline-flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-2.5 shadow-card">
          <span className="text-sm text-muted-foreground">Analyzing</span>
          <span className="flex gap-1">
            <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-primary [animation-delay:0ms]" />
            <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-primary [animation-delay:200ms]" />
            <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-primary [animation-delay:400ms]" />
          </span>
        </div>
      ) : msg.ai ? (
        <div className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-card sm:p-5">
          {/* Root Cause */}
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">
              Root Cause
            </p>
            <p className="text-sm leading-relaxed text-foreground">{msg.ai.rootCause}</p>
          </div>

          {/* Suggestion */}
          <div className="border-t border-border pt-3">
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">
              Suggestion
            </p>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
              <p className="text-sm leading-relaxed text-foreground">{msg.ai.suggestion}</p>
            </div>
          </div>

          {/* Confidence */}
          <div className="flex items-center justify-between border-t border-border pt-3">
            <span className="text-[11px] font-medium text-muted-foreground">Confidence</span>
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-gradient-primary transition-all duration-1000 ease-out"
                  style={{ width: `${msg.ai.confidence}%` }}
                />
              </div>
              <span className="font-mono text-xs font-semibold tabular-nums text-primary">
                {msg.ai.confidence.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  </div>
);
