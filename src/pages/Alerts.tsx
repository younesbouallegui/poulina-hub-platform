import { useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  ArrowUpCircle,
  Bell,
  CheckCircle2,
  ChevronRight,
  Clock,
  Filter,
  Search,
  ShieldAlert,
  Tag,
  UserPlus,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { useI18n } from "@/contexts/I18nContext";
import { useAuth } from "@/contexts/AuthContext";
import { Alert, ALL_ALERTS, AlertEvent } from "@/data/mockData";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const SEV_LIST = ["all", "critical", "high", "medium", "low"] as const;
const STATUS_LIST = ["all", "open", "acknowledged", "resolved"] as const;
type Sev = (typeof SEV_LIST)[number];
type Status = (typeof STATUS_LIST)[number];

const SEVERITY_RANK: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

const sevClasses = (s: string) =>
  s === "critical"
    ? "bg-destructive/10 text-destructive ring-1 ring-destructive/30"
    : s === "high"
      ? "bg-destructive/5 text-destructive ring-1 ring-destructive/20"
      : s === "medium"
        ? "bg-warning/10 text-warning ring-1 ring-warning/30"
        : "bg-muted text-muted-foreground ring-1 ring-border";

const statusClasses = (s: string) =>
  s === "open"
    ? "bg-destructive/10 text-destructive"
    : s === "acknowledged"
      ? "bg-warning/10 text-warning"
      : "bg-success/10 text-success";

const formatRelative = (iso: string) => {
  const diff = Math.floor((Date.now() - +new Date(iso)) / 60000);
  if (diff < 1) return "just now";
  if (diff < 60) return `${diff}m ago`;
  const h = Math.floor(diff / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

const eventIcon = (t: AlertEvent["type"]) => {
  switch (t) {
    case "created":
      return AlertCircle;
    case "acknowledged":
      return CheckCircle2;
    case "assigned":
      return UserPlus;
    case "escalated":
      return ArrowUpCircle;
    case "resolved":
      return CheckCircle2;
    default:
      return Tag;
  }
};

export default function Alerts() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<Alert[]>(ALL_ALERTS);
  const [sev, setSev] = useState<Sev>("all");
  const [status, setStatus] = useState<Status>("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(ALL_ALERTS[0]?.id ?? null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return alerts
      .filter((a) => (sev === "all" ? true : a.severity === sev))
      .filter((a) => (status === "all" ? true : a.status === status))
      .filter((a) =>
        q
          ? [a.title, a.host, a.service, a.id, a.description].some((f) => f.toLowerCase().includes(q))
          : true,
      )
      .sort(
        (a, b) =>
          SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
          +new Date(b.createdAt) - +new Date(a.createdAt),
      );
  }, [alerts, sev, status, query]);

  const selected = alerts.find((a) => a.id === selectedId) ?? filtered[0];

  const counts = useMemo(() => {
    const open = alerts.filter((a) => a.status === "open").length;
    const ack = alerts.filter((a) => a.status === "acknowledged").length;
    const resolved = alerts.filter((a) => a.status === "resolved").length;
    const escalated = alerts.filter((a) => a.escalated).length;
    return { open, ack, resolved, escalated };
  }, [alerts]);

  const updateAlert = (id: string, patch: Partial<Alert>, evt?: Omit<AlertEvent, "id" | "at">) => {
    setAlerts((prev) =>
      prev.map((a) =>
        a.id === id
          ? {
              ...a,
              ...patch,
              updatedAt: new Date().toISOString(),
              timeline: evt
                ? [
                    ...a.timeline,
                    {
                      id: `e${a.timeline.length + 1}`,
                      at: new Date().toISOString(),
                      ...evt,
                    },
                  ]
                : a.timeline,
            }
          : a,
      ),
    );
    toast.success(t("alerts.actionDone"));
  };

  const onAck = (a: Alert) =>
    updateAlert(a.id, { status: "acknowledged" }, { type: "acknowledged", actor: user?.name ?? "user", message: "Acknowledged" });

  const onAssign = (a: Alert) =>
    updateAlert(
      a.id,
      { assignee: user?.name ?? "me" },
      { type: "assigned", actor: user?.name ?? "user", message: `Assigned to ${user?.name ?? "me"}` },
    );

  const onEscalate = (a: Alert) =>
    updateAlert(a.id, { escalated: true }, { type: "escalated", actor: user?.name ?? "user", message: "Escalated to next tier" });

  const onResolve = (a: Alert) =>
    updateAlert(a.id, { status: "resolved" }, { type: "resolved", actor: user?.name ?? "user", message: "Marked as resolved" });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title={t("alerts.title")}
        subtitle={t("alerts.subtitle")}
        actions={
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-destructive/10 px-2 py-1 font-medium text-destructive">
              <span className="h-1.5 w-1.5 rounded-full bg-destructive" /> {counts.open} open
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-md bg-warning/10 px-2 py-1 font-medium text-warning">
              <span className="h-1.5 w-1.5 rounded-full bg-warning" /> {counts.ack} ack
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-md bg-success/10 px-2 py-1 font-medium text-success">
              <span className="h-1.5 w-1.5 rounded-full bg-success" /> {counts.resolved} resolved
            </span>
          </div>
        }
      />

      {/* Filter bar */}
      <div className="flex flex-col gap-3 border-b border-border bg-card/50 px-4 py-3 sm:px-6 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("alerts.search")}
            className="w-full rounded-md border border-border bg-background py-2 pl-9 pr-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1 rounded-md border border-border bg-background p-1">
            {STATUS_LIST.map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={cn(
                  "rounded px-2.5 py-1 text-xs font-medium capitalize transition-colors",
                  status === s ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {s === "all" ? t("alerts.all") : s === "open" ? t("alerts.open") : s === "acknowledged" ? t("alerts.ack") : t("alerts.resolved")}
              </button>
            ))}
          </div>
          <div className="inline-flex items-center gap-1 rounded-md border border-border bg-background p-1">
            <Filter className="ml-1.5 h-3.5 w-3.5 text-muted-foreground" />
            {SEV_LIST.map((s) => (
              <button
                key={s}
                onClick={() => setSev(s)}
                className={cn(
                  "rounded px-2.5 py-1 text-xs font-medium capitalize transition-colors",
                  sev === s ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {s === "all" ? t("alerts.all") : s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Two-pane layout */}
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        {/* List */}
        <div className="min-h-0 overflow-y-auto border-b border-border lg:border-b-0 lg:border-r">
          {filtered.length === 0 ? (
            <div className="flex h-full items-center justify-center p-10 text-sm text-muted-foreground">
              {t("alerts.empty")}
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map((a) => {
                const isActive = selected?.id === a.id;
                return (
                  <li key={a.id}>
                    <button
                      onClick={() => setSelectedId(a.id)}
                      className={cn(
                        "group block w-full px-4 py-3.5 text-left transition-colors hover:bg-muted/40 sm:px-6",
                        isActive && "bg-muted/60",
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className={cn(
                            "mt-1 inline-block h-2 w-2 shrink-0 rounded-full",
                            a.severity === "critical" && "bg-destructive animate-pulse",
                            a.severity === "high" && "bg-destructive",
                            a.severity === "medium" && "bg-warning",
                            a.severity === "low" && "bg-muted-foreground",
                          )}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-medium text-foreground">{a.title}</p>
                            {a.escalated && (
                              <span className="inline-flex items-center gap-1 rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-destructive">
                                <ShieldAlert className="h-2.5 w-2.5" /> esc
                              </span>
                            )}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                            <span className="font-mono">{a.id}</span>
                            <span>· {a.host}</span>
                            <span>· {a.service}</span>
                            <span className="inline-flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatRelative(a.createdAt)}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1.5">
                          <span className={cn("rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider", sevClasses(a.severity))}>
                            {a.severity}
                          </span>
                          <span className={cn("rounded-md px-1.5 py-0.5 text-[10px] font-medium capitalize", statusClasses(a.status))}>
                            {a.status}
                          </span>
                        </div>
                        <ChevronRight className={cn("mt-2 h-4 w-4 shrink-0 text-muted-foreground transition-transform", isActive && "translate-x-0.5 text-foreground")} />
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Details */}
        <div className="min-h-0 overflow-y-auto bg-background-elevated">
          {!selected ? (
            <div className="flex h-full items-center justify-center p-10 text-sm text-muted-foreground">
              {t("alerts.selectOne")}
            </div>
          ) : (
            <div className="space-y-5 p-5 sm:p-6">
              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn("rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider", sevClasses(selected.severity))}>
                      {selected.severity}
                    </span>
                    <span className={cn("rounded-md px-1.5 py-0.5 text-[10px] font-medium capitalize", statusClasses(selected.status))}>
                      {selected.status}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">{selected.id}</span>
                  </div>
                  <h2 className="mt-2 text-lg font-semibold tracking-tight text-foreground">{selected.title}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{selected.description}</p>
                </div>
              </div>

              {/* Action bar */}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => onAck(selected)}
                  disabled={selected.status !== "open"}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-all hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" /> {t("alerts.ackBtn")}
                </button>
                <button
                  onClick={() => onAssign(selected)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-all hover:border-primary/40 hover:text-primary active:scale-[0.98]"
                >
                  <UserPlus className="h-3.5 w-3.5" /> {t("alerts.assign")}
                </button>
                <button
                  onClick={() => onEscalate(selected)}
                  disabled={selected.escalated}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-all hover:border-destructive/40 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]"
                >
                  <ArrowUpCircle className="h-3.5 w-3.5" /> {t("alerts.escalate")}
                </button>
                <button
                  onClick={() => onResolve(selected)}
                  disabled={selected.status === "resolved"}
                  className="inline-flex items-center gap-1.5 rounded-md bg-success/10 px-3 py-1.5 text-xs font-medium text-success transition-all hover:bg-success/15 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]"
                >
                  <X className="h-3.5 w-3.5" /> {t("alerts.resolve")}
                </button>
              </div>

              {/* Meta grid */}
              <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-4">
                <Meta icon={Tag} label={t("alerts.source")} value={selected.source} />
                <Meta icon={Activity} label={t("alerts.host")} value={selected.host} mono />
                <Meta icon={ShieldAlert} label={t("alerts.service")} value={selected.service} />
                <Meta
                  icon={UserPlus}
                  label={t("alerts.assignee")}
                  value={selected.assignee ?? t("alerts.unassigned")}
                />
                <Meta icon={Clock} label="Created" value={formatRelative(selected.createdAt)} />
                <Meta icon={Clock} label="Updated" value={formatRelative(selected.updatedAt)} />
                <Meta icon={Bell} label={t("alerts.notifications")} value={String(selected.notificationsSent)} />
                <Meta
                  icon={ShieldAlert}
                  label="Escalation"
                  value={selected.escalated ? "Yes" : "No"}
                />
              </div>

              {/* Root cause */}
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("alerts.rootCause")}
                </p>
                <p className="mt-2 text-sm text-foreground">
                  {selected.rootCause ?? "—"}
                </p>
              </div>

              {/* Timeline */}
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("alerts.timeline")}
                </p>
                <ol className="mt-3 space-y-3">
                  {selected.timeline
                    .slice()
                    .reverse()
                    .map((evt) => {
                      const Icon = eventIcon(evt.type);
                      return (
                        <li key={evt.id} className="flex gap-3">
                          <div className="flex flex-col items-center">
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-foreground">
                              <Icon className="h-3.5 w-3.5" />
                            </div>
                          </div>
                          <div className="min-w-0 flex-1 pb-1">
                            <div className="flex flex-wrap items-baseline gap-2">
                              <p className="text-sm font-medium capitalize text-foreground">{evt.type}</p>
                              <p className="text-[11px] text-muted-foreground">
                                {evt.actor} · {formatRelative(evt.at)}
                              </p>
                            </div>
                            <p className="mt-0.5 text-xs text-muted-foreground">{evt.message}</p>
                          </div>
                        </li>
                      );
                    })}
                </ol>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const Meta = ({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  mono?: boolean;
}) => (
  <div className="min-w-0">
    <p className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
      <Icon className="h-3 w-3" /> {label}
    </p>
    <p className={cn("mt-1 truncate text-sm capitalize text-foreground", mono && "font-mono normal-case")}>
      {value}
    </p>
  </div>
);
