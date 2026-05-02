import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  Filter,
  Layers,
  MessageSquare,
  Radio,
  Search,
  Siren,
  VolumeX,
  Volume2,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/contexts/I18nContext";
import {
  ALL_ALERT_GROUPS,
  ALL_AUDIT,
  ALL_ONCALL,
  ALL_SERVERS,
  Alert,
  AlertSeverity,
  AlertStatus,
  getAlertGroupsForUser,
  getAlertsForUser,
} from "@/data/mockData";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type SeverityFilter = "all" | AlertSeverity;
type StatusFilter = "all" | AlertStatus;

const Alerts = () => {
  const { user, hasRole } = useAuth();
  const { t } = useI18n();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [severity, setSeverity] = useState<SeverityFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Alert | null>(null);
  const [overrides, setOverrides] = useState<
    Record<string, { status?: AlertStatus }>
  >({});
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [tick, setTick] = useState(0);

  // Live indicator pulse — recompute relative timestamps periodically
  useEffect(() => {
    const i = setInterval(() => setTick((x) => x + 1), 30_000);
    return () => clearInterval(i);
  }, []);

  const baseAlerts = useMemo(
    () => (user ? getAlertsForUser(user.assignedServers) : []),
    [user],
  );
  const groups = useMemo(
    () => (user ? getAlertGroupsForUser(user.assignedServers) : []),
    [user],
  );

  const alerts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return baseAlerts
      .map((a) => ({ ...a, status: overrides[a.id]?.status ?? a.status }))
      .filter((a) => severity === "all" || a.severity === severity)
      .filter((a) => status === "all" || a.status === status)
      .filter((a) => {
        if (!q) return true;
        const server = ALL_SERVERS.find((s) => s.id === a.serverId);
        return (
          a.title.toLowerCase().includes(q) ||
          a.id.toLowerCase().includes(q) ||
          a.trigger.toLowerCase().includes(q) ||
          a.tags.some((tg) => tg.toLowerCase().includes(q)) ||
          (server?.name ?? "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => +new Date(b.firedAt) - +new Date(a.firedAt));
  }, [baseAlerts, severity, status, query, overrides]);

  const counts = useMemo(() => {
    const merged = baseAlerts.map((a) => ({
      ...a,
      status: overrides[a.id]?.status ?? a.status,
    }));
    return {
      total: merged.length,
      firing: merged.filter((a) => a.status === "firing").length,
      acknowledged: merged.filter((a) => a.status === "acknowledged").length,
      muted: merged.filter((a) => a.status === "muted").length,
      resolved: merged.filter((a) => a.status === "resolved").length,
    };
  }, [baseAlerts, overrides]);

  const canAct = hasRole("admin", "operator");

  const setStatusFor = (id: string, next: AlertStatus, msgKey: string) => {
    if (!canAct) {
      toast({ title: t("alerts.notAllowed"), variant: "destructive" });
      return;
    }
    setOverrides((o) => ({ ...o, [id]: { status: next } }));
    toast({ title: t(msgKey) });
    if (selected?.id === id) setSelected({ ...selected, status: next });
  };

  const acknowledge = (id: string) => setStatusFor(id, "acknowledged", "alerts.acked");
  const mute = (id: string) => setStatusFor(id, "muted", "alerts.muted_done");
  const unmute = (id: string) => setStatusFor(id, "firing", "alerts.unmuted_done");
  const resolve = (id: string) => setStatusFor(id, "resolved", "alerts.closed");
  const escalate = (id: string) => {
    if (!canAct) return toast({ title: t("alerts.notAllowed"), variant: "destructive" });
    toast({ title: t("alerts.escalated") });
  };

  const openRoom = (a: Alert) => navigate(`/s/${a.externalId}`);

  const toggleCheck = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const clearChecked = () => setChecked(new Set());
  const bulk = (action: "ack" | "mute") => {
    if (!canAct) {
      toast({ title: t("alerts.notAllowed"), variant: "destructive" });
      return;
    }
    setOverrides((o) => {
      const next = { ...o };
      checked.forEach((id) => {
        next[id] = { status: action === "ack" ? "acknowledged" : "muted" };
      });
      return next;
    });
    toast({
      title: action === "ack" ? t("alerts.acked") : t("alerts.muted_done"),
    });
    clearChecked();
  };

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader
        title={t("alerts.title")}
        subtitle={t("alerts.subtitle")}
        actions={
          <div className="flex items-center gap-2 rounded-full border border-success/30 bg-success/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-success">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
            </span>
            {t("alerts.live")}
          </div>
        }
      />

      <div className="flex-1 space-y-4 p-4 sm:p-6">
        {/* Stat strip */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <StatTile label={t("alerts.total")} value={counts.total} icon={BellRing} />
          <StatTile
            label={t("alerts.firing")}
            value={counts.firing}
            icon={Siren}
            tone="critical"
          />
          <StatTile
            label={t("alerts.acknowledged")}
            value={counts.acknowledged}
            icon={CheckCircle2}
            tone="info"
          />
          <StatTile label={t("alerts.muted")} value={counts.muted} icon={VolumeX} />
          <StatTile
            label={t("alerts.resolved")}
            value={counts.resolved}
            icon={CheckCircle2}
            tone="success"
          />
        </div>

        {/* Correlated groups */}
        {groups.length > 0 && (
          <div className="rounded-2xl border border-border bg-card shadow-card">
            <div className="flex items-center gap-2 border-b border-border px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              <Layers className="h-3.5 w-3.5" />
              {t("alerts.correlated")}
            </div>
            <ul className="divide-y divide-border">
              {groups.map((g) => (
                <li key={g.id} className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <SeverityPill severity={g.severity} />
                        <p className="truncate text-sm font-semibold text-foreground">
                          {g.title}
                        </p>
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {g.id}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{g.rootCause}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {g.alertIds.map((aid) => (
                          <span
                            key={aid}
                            className="rounded-md border border-border bg-muted/40 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
                          >
                            {aid}
                          </span>
                        ))}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        const first = baseAlerts.find((a) => a.id === g.alertIds[0]);
                        if (first) openRoom(first);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-all hover:border-primary/40 hover:text-primary active:scale-[0.98]"
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                      {t("alerts.openRoom")}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
          {/* Main column */}
          <div className="space-y-3">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-card">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Filter className="h-3.5 w-3.5" />
                <span className="font-medium uppercase tracking-wider">Filters</span>
              </div>
              <FilterSelect
                label={t("common.severity")}
                value={severity}
                onChange={(v) => setSeverity(v as SeverityFilter)}
                options={[
                  { value: "all", label: t("common.all") },
                  { value: "critical", label: t("common.critical") },
                  { value: "high", label: "High" },
                  { value: "medium", label: "Medium" },
                  { value: "low", label: "Low" },
                  { value: "info", label: "Info" },
                ]}
              />
              <FilterSelect
                label={t("common.status")}
                value={status}
                onChange={(v) => setStatus(v as StatusFilter)}
                options={[
                  { value: "all", label: t("common.all") },
                  { value: "firing", label: t("alerts.firing") },
                  { value: "acknowledged", label: t("alerts.acknowledged") },
                  { value: "muted", label: t("alerts.muted") },
                  { value: "resolved", label: t("alerts.resolved") },
                ]}
              />
              <div className="ml-auto flex w-full items-center gap-2 rounded-md border border-input bg-background px-2 py-1 sm:w-72">
                <Search className="h-3.5 w-3.5 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t("alerts.search")}
                  className="w-full bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
                />
              </div>
            </div>

            {/* Bulk bar */}
            {checked.size > 0 && (
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 shadow-card animate-fade-in">
                <Radio className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-semibold text-foreground">
                  {t("alerts.bulk").replace("{n}", String(checked.size))}
                </span>
                <div className="ml-auto flex items-center gap-2">
                  <button
                    onClick={() => bulk("ack")}
                    className="rounded-md border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-foreground transition-colors hover:border-primary/40 hover:text-primary"
                  >
                    {t("alerts.bulkAck")}
                  </button>
                  <button
                    onClick={() => bulk("mute")}
                    className="rounded-md border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-foreground transition-colors hover:border-primary/40 hover:text-primary"
                  >
                    {t("alerts.bulkMute")}
                  </button>
                  <button
                    onClick={clearChecked}
                    className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label="Clear selection"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* List */}
            <div className="rounded-2xl border border-border bg-card shadow-card">
              {alerts.length === 0 ? (
                <div className="flex flex-col items-center gap-2 p-10 text-center">
                  <CheckCircle2 className="h-8 w-8 text-success" />
                  <p className="text-sm text-muted-foreground">{t("alerts.empty")}</p>
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {alerts.map((a) => {
                    const server = ALL_SERVERS.find((s) => s.id === a.serverId);
                    const isChecked = checked.has(a.id);
                    return (
                      <li
                        key={a.id}
                        className={cn(
                          "group cursor-pointer p-4 transition-colors hover:bg-muted/40",
                          isChecked && "bg-primary/[0.04]",
                        )}
                        onClick={() => setSelected(a)}
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleCheck(a.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="mt-1 h-3.5 w-3.5 cursor-pointer rounded border-border accent-primary"
                            aria-label={`Select ${a.id}`}
                          />
                          <SeverityPill severity={a.severity} />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate text-sm font-semibold text-foreground">
                                {a.title}
                              </p>
                              <span className="font-mono text-[10px] text-muted-foreground">
                                {a.id}
                              </span>
                              {a.groupId && (
                                <span className="inline-flex items-center gap-1 rounded-md border border-primary/20 bg-primary/5 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                                  <Layers className="h-2.5 w-2.5" />
                                  {a.groupId}
                                </span>
                              )}
                              {a.count > 1 && (
                                <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                                  ×{a.count}
                                </span>
                              )}
                            </div>
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">
                              {server?.name} · <span className="font-mono">{a.trigger}</span>
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <StatusPill status={a.status} />
                            <span
                              className="hidden font-mono text-[11px] text-muted-foreground sm:inline"
                              data-tick={tick}
                            >
                              {relativeTime(a.firedAt)}
                            </span>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          {/* Right rail */}
          <aside className="space-y-4">
            <div className="rounded-2xl border border-border bg-card shadow-card">
              <div className="border-b border-border px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {t("alerts.onCall")}
              </div>
              <ul className="divide-y divide-border">
                {ALL_ONCALL.map((s) => (
                  <li key={s.id} className="flex items-center gap-3 p-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary ring-1 ring-primary/20">
                      {s.initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {s.user}
                      </p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {s.team}
                      </p>
                    </div>
                    {s.primary && (
                      <span className="rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-success ring-1 ring-success/20">
                        Primary
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-border bg-card shadow-card">
              <div className="border-b border-border px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {t("alerts.audit")}
              </div>
              <ul className="divide-y divide-border">
                {ALL_AUDIT.map((a) => (
                  <li key={a.id} className="p-3">
                    <p className="text-xs text-foreground">
                      <span className="font-medium">{a.actor}</span>{" "}
                      <span className="text-muted-foreground">{a.action}</span>{" "}
                      <span className="font-mono text-[11px]">{a.target}</span>
                    </p>
                    <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                      {relativeTime(a.at)}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      </div>

      {/* Detail drawer */}
      {selected && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-foreground/40 backdrop-blur-sm animate-fade-in"
            onClick={() => setSelected(null)}
          />
          <aside className="relative z-10 ml-auto flex h-full w-full max-w-md flex-col border-l border-border bg-card shadow-elevated animate-slide-in-right">
            <div className="flex items-start justify-between border-b border-border p-5">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">
                  {t("alerts.title")}
                </p>
                <h3 className="mt-1 truncate text-lg font-semibold text-foreground">
                  {selected.title}
                </h3>
                <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                  {selected.id} · {selected.externalId}
                </p>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              <div className="flex flex-wrap items-center gap-2">
                <SeverityPill severity={selected.severity} />
                <StatusPill status={selected.status} />
                {selected.count > 1 && (
                  <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                    {t("alerts.count")}: ×{selected.count}
                  </span>
                )}
              </div>
              <Field label={t("common.details")} value={selected.description} />
              <Field label={t("alerts.trigger")} value={selected.trigger} mono />
              <Field
                label={t("alerts.firedAt")}
                value={new Date(selected.firedAt).toLocaleString()}
              />
              <Field
                label={t("alerts.affected")}
                value={
                  ALL_SERVERS.find((s) => s.id === selected.serverId)?.name ?? "—"
                }
              />
              {selected.groupId && (
                <Field
                  label={t("alerts.rootCause")}
                  value={
                    ALL_ALERT_GROUPS.find((g) => g.id === selected.groupId)?.rootCause ??
                    "—"
                  }
                />
              )}
              {selected.tags.length > 0 && (
                <div>
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    {t("alerts.tags")}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {selected.tags.map((tg) => (
                      <span
                        key={tg}
                        className="rounded-md border border-border bg-muted/40 px-1.5 py-0.5 text-[11px] text-muted-foreground"
                      >
                        {tg}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 border-t border-border p-4 sm:grid-cols-4">
              <button
                onClick={() => acknowledge(selected.id)}
                disabled={!canAct || selected.status === "acknowledged" || selected.status === "resolved"}
                className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground transition-all hover:border-primary/40 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t("alerts.acknowledge")}
              </button>
              <button
                onClick={() => escalate(selected.id)}
                disabled={!canAct || selected.status === "resolved"}
                className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground transition-all hover:border-primary/40 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t("alerts.escalate")}
              </button>
              {selected.status === "muted" ? (
                <button
                  onClick={() => unmute(selected.id)}
                  disabled={!canAct}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground transition-all hover:border-primary/40 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Volume2 className="h-3.5 w-3.5" />
                  {t("alerts.unmute")}
                </button>
              ) : (
                <button
                  onClick={() => mute(selected.id)}
                  disabled={!canAct || selected.status === "resolved"}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground transition-all hover:border-primary/40 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <VolumeX className="h-3.5 w-3.5" />
                  {t("alerts.mute")}
                </button>
              )}
              <button
                onClick={() => openRoom(selected)}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-all hover:bg-primary-glow active:scale-[0.98]"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                {t("alerts.openRoom")}
              </button>
              <button
                onClick={() => resolve(selected.id)}
                disabled={!canAct || selected.status === "resolved"}
                className="col-span-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground transition-all hover:border-primary/40 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 sm:col-span-4"
              >
                {t("alerts.close")}
              </button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
};

const StatTile = ({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "critical" | "info" | "success";
}) => {
  const toneCls =
    tone === "critical"
      ? "text-destructive"
      : tone === "info"
        ? "text-info"
        : tone === "success"
          ? "text-success"
          : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-card p-3 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-elevated">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {label}
        </p>
        <Icon className={cn("h-3.5 w-3.5", toneCls)} />
      </div>
      <p className={cn("mt-1.5 text-2xl font-semibold tabular-nums", toneCls)}>
        {value}
      </p>
    </div>
  );
};

const Field = ({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) => (
  <div>
    <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
      {label}
    </p>
    <p
      className={cn(
        "text-sm leading-relaxed text-foreground",
        mono && "font-mono text-xs",
      )}
    >
      {value}
    </p>
  </div>
);

const SeverityPill = ({ severity }: { severity: AlertSeverity }) => {
  const cls =
    severity === "critical"
      ? "bg-destructive/15 text-destructive ring-destructive/30"
      : severity === "high"
        ? "bg-warning/15 text-warning ring-warning/30"
        : severity === "medium"
          ? "bg-info/15 text-info ring-info/30"
          : severity === "low"
            ? "bg-muted text-muted-foreground ring-border"
            : "bg-muted/60 text-muted-foreground ring-border";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1",
        cls,
      )}
    >
      <AlertTriangle className="h-3 w-3" />
      {severity}
    </span>
  );
};

const StatusPill = ({ status }: { status: AlertStatus }) => {
  const cls =
    status === "firing"
      ? "bg-destructive/10 text-destructive ring-destructive/20"
      : status === "acknowledged"
        ? "bg-info/10 text-info ring-info/20"
        : status === "muted"
          ? "bg-muted text-muted-foreground ring-border"
          : "bg-success/10 text-success ring-success/20";
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1",
        cls,
      )}
    >
      {status}
    </span>
  );
};

const FilterSelect = ({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) => (
  <label className="flex items-center gap-2 text-xs">
    <span className="text-muted-foreground">{label}:</span>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-md border border-input bg-background px-2 py-1 text-xs text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  </label>
);

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

export default Alerts;
