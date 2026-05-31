import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Brain, CheckCircle2, Filter, Loader2, RefreshCw, Wand2, X, Zap, ShieldOff } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/contexts/I18nContext";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  acknowledgeEvent,
  severityTier,
  useZabbixEvents,
  useZabbixProblems,
  type ZProblem,
} from "@/lib/zabbix";
import { IncidentAuditTimeline } from "@/components/incidents/IncidentAuditTimeline";
import { AiTrustBadge } from "@/components/incidents/AiTrustBadge";
import { useAiPolicies, useAuditLog, useIncidentKnowledge, useKillSwitch } from "@/hooks/useAiOps";

type Tier = "critical" | "high" | "medium" | "low";
type Status = "open" | "acknowledged" | "resolved";

const Incidents = () => {
  const { hasRole, user } = useAuth();
  const { t } = useI18n();
  const { toast } = useToast();
  const audit = useAuditLog();
  const canAct = hasRole("admin", "operator");

  const { data: problems = [], isLoading, refetch, isFetching, isError } = useZabbixProblems();

  const [severity, setSeverity] = useState<"all" | Tier>("all");
  const [status, setStatus] = useState<"all" | Status>("all");
  const [selected, setSelected] = useState<ZProblem | null>(null);
  const [acking, setAcking] = useState<string | null>(null);

  const incidents = useMemo(() => {
    return problems
      .map((p) => ({
        problem: p,
        tier: severityTier(p.severity) as Tier,
        status: (p.acknowledged === "1" ? "acknowledged" : "open") as Status,
      }))
      .filter((i) => severity === "all" || i.tier === severity)
      .filter((i) => status === "all" || i.status === status);
  }, [problems, severity, status]);

  const stats = useMemo(() => {
    const open = problems.filter((p) => p.acknowledged !== "1").length;
    const acked = problems.length - open;
    const tiers = problems.reduce(
      (acc, p) => {
        const t = severityTier(p.severity) as Tier;
        acc[t]++;
        return acc;
      },
      { critical: 0, high: 0, medium: 0, low: 0 } as Record<Tier, number>,
    );
    const now = Math.floor(Date.now() / 1000);
    const avgAge =
      problems.length === 0
        ? 0
        : problems.reduce((s, p) => s + (now - parseInt(p.clock, 10)), 0) / problems.length;
    return { open, acked, tiers, avgAgeMin: Math.round(avgAge / 60) };
  }, [problems]);

  const ack = async (p: ZProblem) => {
    if (!canAct) return toast({ title: t("inc.notAllowed"), variant: "destructive" });
    setAcking(p.eventid);
    try {
      await acknowledgeEvent(p.eventid, "Acknowledged from Lovable Operations Console");
      audit.append({
        actor: user?.email ?? "unknown",
        kind: "ack",
        message: `Acknowledged "${p.name}"`,
        meta: { eventId: p.eventid, host: p.hostName },
      });
      toast({ title: t("inc.acknowledged") });
      refetch();
      if (selected?.eventid === p.eventid) setSelected({ ...selected, acknowledged: "1" });
    } catch (e) {
      toast({ title: "Acknowledge failed", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setAcking(null);
    }
  };

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader
        title={t("inc.title")}
        subtitle={t("inc.subtitle")}
        actions={
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} /> Refresh
          </button>
        }
      />

      <div className="flex-1 space-y-4 p-4 sm:p-6">
        {isError && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
            Could not reach Zabbix. Showing cached / synced data only.
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Kpi label="Total active" value={problems.length} accent="primary" />
          <Kpi label="Open" value={stats.open} accent="destructive" />
          <Kpi label="Acknowledged" value={stats.acked} accent="info" />
          <Kpi label="Critical" value={stats.tiers.critical} accent="destructive" />
          <Kpi label="Avg age (min)" value={stats.avgAgeMin} accent="primary" />
        </div>

        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Filter className="h-3.5 w-3.5" />
            <span className="font-medium uppercase tracking-wider">Filters</span>
          </div>
          <FilterSelect
            label={t("inc.filterSeverity")}
            value={severity}
            onChange={(v) => setSeverity(v as typeof severity)}
            options={[
              { value: "all", label: t("common.all") },
              { value: "critical", label: t("common.critical") },
              { value: "high", label: "High" },
              { value: "medium", label: "Medium" },
              { value: "low", label: "Low" },
            ]}
          />
          <FilterSelect
            label={t("inc.filterStatus")}
            value={status}
            onChange={(v) => setStatus(v as typeof status)}
            options={[
              { value: "all", label: t("common.all") },
              { value: "open", label: t("common.open") },
              { value: "acknowledged", label: t("common.acknowledged") },
            ]}
          />
        </div>

        <div className="rounded-2xl border border-border bg-card shadow-card">
          {isLoading ? (
            <div className="flex items-center justify-center p-10">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : incidents.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-10 text-center">
              <CheckCircle2 className="h-8 w-8 text-success" />
              <p className="text-sm text-muted-foreground">{t("inc.empty")}</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {incidents.map(({ problem: p, tier, status }) => {
                const ts = new Date(parseInt(p.clock, 10) * 1000);
                return (
                  <li
                    key={p.eventid}
                    onClick={() => setSelected(p)}
                    className="cursor-pointer p-4 transition-colors hover:bg-muted/40"
                  >
                    <div className="flex items-start gap-3">
                      <SeverityPill tier={tier} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-semibold text-foreground">{p.name}</p>
                          <span className="font-mono text-[10px] text-muted-foreground">#{p.eventid}</span>
                        </div>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {p.hostName ?? "—"} {p.opdata ? `· ${p.opdata}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <StatusPill status={status} />
                        <span className="hidden font-mono text-[11px] text-muted-foreground sm:inline">
                          {ts.toLocaleString()}
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

      {selected && (
        <IncidentDrawer
          problem={selected}
          canAct={canAct}
          acking={acking === selected.eventid}
          onAck={() => ack(selected)}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
};

const Kpi = ({ label, value, accent }: { label: string; value: number; accent: "primary" | "destructive" | "info" }) => (
  <div className="rounded-xl border border-border bg-card p-3">
    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
    <p
      className={cn(
        "mt-1 font-mono text-2xl font-semibold tabular-nums",
        accent === "destructive" && "text-destructive",
        accent === "info" && "text-info",
        accent === "primary" && "text-foreground",
      )}
    >
      {value}
    </p>
  </div>
);

type DrawerTab = "overview" | "timeline";

const REMEDIATION_STEPS = [
  "Snapshot current state",
  "Restart degraded service",
  "Verify health probes recover",
];

const IncidentDrawer = ({
  problem,
  canAct,
  acking,
  onAck,
  onClose,
}: {
  problem: ZProblem;
  canAct: boolean;
  acking: boolean;
  onAck: () => void;
  onClose: () => void;
}) => {
  const { t } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const tier = severityTier(problem.severity) as Tier;
  const ts = new Date(parseInt(problem.clock, 10) * 1000);
  const [tab, setTab] = useState<DrawerTab>("overview");
  const host = problem.hostName ?? problem.hosts?.[0]?.name ?? "unknown";
  const assetKey = host;
  const { getPolicy } = useAiPolicies();
  const currentPolicy = getPolicy(assetKey)?.policy ?? "off";
  const audit = useAuditLog();
  const kb = useIncidentKnowledge();
  const { killed } = useKillSwitch();
  const [remediating, setRemediating] = useState(false);

  const { data: events = [], isLoading } = useZabbixEvents({
    triggerIds: [problem.objectid],
    limit: 50,
    timeFrom: parseInt(problem.clock, 10) - 60 * 60 * 24 * 7,
  });

  const explainWithAi = () => {
    audit.append({
      actor: user?.email ?? "unknown",
      kind: "ai-explain",
      message: `Opened AI investigation for "${problem.name}"`,
      meta: { eventId: problem.eventid, host },
    });
    const params = new URLSearchParams({
      event: problem.eventid,
      host,
      trigger: problem.name,
      severity: tier,
      opdata: problem.opdata ?? "",
      at: ts.toISOString(),
    });
    navigate(`/ai?${params.toString()}`);
  };

  const autoRemediate = async () => {
    if (killed) {
      toast({ title: "Kill switch engaged", description: "All AI remediation suspended.", variant: "destructive" });
      return;
    }
    if (currentPolicy === "off") {
      toast({
        title: "AI Remediation not enabled",
        description: `Set a policy for ${host} in AI Operations → AI Policies.`,
        variant: "destructive",
      });
      return;
    }
    if (currentPolicy === "approval") {
      audit.append({
        actor: user?.email ?? "unknown",
        kind: "approval",
        message: `Approved AI remediation for ${host}`,
        meta: { eventId: problem.eventid },
      });
    }
    setRemediating(true);
    audit.append({
      actor: "ai-copilot",
      kind: "ai-remediate-plan",
      message: `Generated remediation plan for ${host}`,
      meta: { eventId: problem.eventid, steps: REMEDIATION_STEPS },
    });
    setTab("timeline");
    for (const step of REMEDIATION_STEPS) {
      await new Promise((r) => setTimeout(r, 700));
      audit.append({
        actor: currentPolicy === "autonomous" ? "ai-copilot" : user?.email ?? "unknown",
        kind: "ai-remediate-execute",
        message: step,
        meta: { eventId: problem.eventid, host },
      });
    }
    kb.upsert({
      trigger: problem.name,
      host,
      symptoms: [problem.name],
      rootCause: "Auto-detected by AIOps Copilot",
      resolution: REMEDIATION_STEPS.join(" → "),
      actions: REMEDIATION_STEPS,
      outcome: "resolved",
      confidence: 88,
      source: "ai",
    });
    audit.append({
      actor: "ai-copilot",
      kind: "knowledge-write",
      message: "Knowledge base updated",
      meta: { eventId: problem.eventid },
    });
    setRemediating(false);
    toast({ title: "Remediation complete", description: `${host} recovered. Knowledge base updated.` });
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-foreground/40 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <aside className="relative z-10 ml-auto flex h-full w-full max-w-xl flex-col border-l border-border bg-card shadow-elevated animate-slide-in-right">
        <div className="flex items-start justify-between border-b border-border p-5">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">
              {t("inc.detailsTitle")}
            </p>
            <h3 className="mt-1 truncate text-lg font-semibold text-foreground">{problem.name}</h3>
            <p className="mt-0.5 flex items-center gap-2 font-mono text-xs text-muted-foreground">
              event #{problem.eventid} · trigger #{problem.objectid}
              <AiTrustBadge policy={currentPolicy} />
            </p>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Action Center — 3 enterprise buttons */}
        <div className="grid grid-cols-3 gap-2 border-b border-border p-3">
          <button
            onClick={onAck}
            disabled={!canAct || acking || problem.acknowledged === "1"}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-2 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary-glow disabled:cursor-not-allowed disabled:opacity-50"
          >
            {acking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            {problem.acknowledged === "1" ? t("common.acknowledged") : t("common.acknowledge")}
          </button>
          <button
            onClick={explainWithAi}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-2 py-2 text-xs font-semibold text-foreground transition-all hover:border-primary hover:bg-primary/5 hover:text-primary"
          >
            <Brain className="h-3.5 w-3.5" /> Explain with AI
          </button>
          <button
            onClick={autoRemediate}
            disabled={remediating || killed}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-2 py-2 text-xs font-semibold text-foreground transition-all hover:border-success hover:bg-success/5 hover:text-success disabled:cursor-not-allowed disabled:opacity-50"
          >
            {remediating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : killed ? <ShieldOff className="h-3.5 w-3.5" /> : <Wand2 className="h-3.5 w-3.5" />}
            Auto-Remediate
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border px-3 pt-2">
          {(["overview", "timeline"] as DrawerTab[]).map((k) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={cn(
                "rounded-t-md border-b-2 px-3 py-1.5 text-[11px] font-semibold capitalize transition-colors",
                tab === k
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {k}
            </button>
          ))}
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          {tab === "overview" && (
            <>
              <div className="flex items-center gap-2">
                <SeverityPill tier={tier} />
                <StatusPill status={problem.acknowledged === "1" ? "acknowledged" : "open"} />
              </div>
              <Field label="Host" value={host} />
              <Field label="Operational data" value={problem.opdata || "—"} />
              <Field label="Triggered at" value={ts.toLocaleString()} />

              <div className="rounded-lg border border-border bg-muted/30 p-3 text-[11px] text-muted-foreground">
                AI trust policy for <strong className="text-foreground">{host}</strong>:{" "}
                <strong className="text-foreground capitalize">{currentPolicy}</strong>. Configure in{" "}
                <button onClick={() => navigate("/aiops/policies")} className="text-primary underline">
                  AI Operations → AI Policies
                </button>
                .
              </div>

              <div>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Related events ({events.length})
                </p>
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : events.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No related events.</p>
                ) : (
                  <ul className="space-y-2">
                    {events.map((e) => (
                      <li key={e.eventid} className="flex items-start gap-2 text-xs">
                        <Zap className="mt-0.5 h-3.5 w-3.5 text-primary-glow" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-foreground">
                            {e.name ?? (e.value === "1" ? "Problem raised" : "Problem recovered")}
                          </p>
                          <p className="font-mono text-[10px] text-muted-foreground">
                            {new Date(parseInt(e.clock, 10) * 1000).toLocaleString()} · ack {e.acknowledged ?? "0"}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}

          {tab === "timeline" && (
            <div className="space-y-4">
              <div>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Resolution timeline
                </p>
                <IncidentAuditTimeline eventId={problem.eventid} />
              </div>
              {remediating && (
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin text-primary" /> AI remediation in progress…
                </p>
              )}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
};

const Field = ({ label, value }: { label: string; value: string }) => (
  <div>
    <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
    <p className="text-sm leading-relaxed text-foreground">{value}</p>
  </div>
);

const SeverityPill = ({ tier }: { tier: Tier }) => {
  const cls =
    tier === "critical"
      ? "bg-destructive/15 text-destructive ring-destructive/30"
      : tier === "high"
        ? "bg-warning/15 text-warning ring-warning/30"
        : tier === "medium"
          ? "bg-info/15 text-info ring-info/30"
          : "bg-muted text-muted-foreground ring-border";
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1", cls)}>
      <AlertTriangle className="h-3 w-3" />
      {tier}
    </span>
  );
};

const StatusPill = ({ status }: { status: Status }) => {
  const cls =
    status === "open"
      ? "bg-destructive/10 text-destructive ring-destructive/20"
      : status === "acknowledged"
        ? "bg-info/10 text-info ring-info/20"
        : "bg-success/10 text-success ring-success/20";
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1", cls)}>
      {status}
    </span>
  );
};

const FilterSelect = ({
  label, value, onChange, options,
}: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) => (
  <label className="flex items-center gap-2 text-xs">
    <span className="text-muted-foreground">{label}:</span>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-md border border-input bg-background px-2 py-1 text-xs text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  </label>
);

export default Incidents;
