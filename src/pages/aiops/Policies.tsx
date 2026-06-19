import { useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  useAiOpsMetrics,
  useAiPolicies,
  useAuditLog,
  useIncidentTypePolicies,
  useKillSwitch,
} from "@/hooks/useAiOps";
import type { AssetPolicy, IncidentTypePolicy, RemediationPolicy } from "@/types/aiops";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import {
  Activity, BarChart3, Bot, CheckCircle2, Gauge, Plus, ShieldCheck, ShieldOff,
  Sparkles, Trash2, Trophy, UserCheck, XCircle, Zap,
} from "lucide-react";

const POLICIES: { v: RemediationPolicy; label: string; desc: string }[] = [
  { v: "off", label: "Disabled", desc: "AI disabled for this asset" },
  { v: "suggest", label: "Suggest Only", desc: "AI proposes — engineer executes" },
  { v: "approval", label: "Approval Required", desc: "AI prepares, engineer approves, AI executes" },
  { v: "autonomous", label: "Autonomous", desc: "AI executes automatically" },
];

const SCOPES: AssetPolicy["scope"][] = ["infrastructure", "server", "application", "service"];

const PolicyBadge = ({ p }: { p: RemediationPolicy }) => {
  const cls =
    p === "autonomous"
      ? "bg-success/15 text-success ring-success/30"
      : p === "approval"
        ? "bg-warning/15 text-warning ring-warning/30"
        : p === "suggest"
          ? "bg-info/15 text-info ring-info/30"
          : "bg-muted text-muted-foreground ring-border";
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1", cls)}>
      {p}
    </span>
  );
};

const KPI = ({
  icon: Icon, label, value, accent, hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; value: string | number; accent: "primary" | "success" | "warning" | "destructive" | "info";
  hint?: string;
}) => (
  <div className="rounded-xl border border-border bg-card p-3">
    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
      <Icon className={cn(
        "h-3.5 w-3.5",
        accent === "success" ? "text-success" :
        accent === "warning" ? "text-warning" :
        accent === "destructive" ? "text-destructive" :
        accent === "info" ? "text-info" : "text-primary",
      )} />
      {label}
    </div>
    <p className="mt-1 font-mono text-xl font-semibold tabular-nums text-foreground">{value}</p>
    {hint && <p className="mt-0.5 text-[10px] text-muted-foreground">{hint}</p>}
  </div>
);

const AIPolicies = () => {
  const { policies, setPolicy } = useAiPolicies();
  const { typePolicies, setTypePolicy } = useIncidentTypePolicies();
  const { killed, setKilled } = useKillSwitch();
  const { entries } = useAuditLog();
  const metrics = useAiOpsMetrics();
  const { hasRole, user } = useAuth();
  const isAdmin = hasRole("admin", "super_admin");
  const actor = user?.email ?? "anonymous";
  const [draft, setDraft] = useState({ label: "", scope: "server" as AssetPolicy["scope"], policy: "suggest" as RemediationPolicy });

  const list = useMemo(() => Object.values(policies).sort((a, b) => a.label.localeCompare(b.label)), [policies]);
  const sortedTypes = useMemo(() => [...typePolicies].sort((a, b) => a.label.localeCompare(b.label)), [typePolicies]);

  const add = () => {
    if (!draft.label.trim()) return;
    setPolicy(draft.label.trim(), draft.label.trim(), draft.scope, draft.policy);
    setDraft({ label: "", scope: "server", policy: "suggest" });
  };

  const remove = (key: string) => {
    const p = policies[key];
    if (p) setPolicy(key, p.label, p.scope, "off");
  };

  const onChangeTypePolicy = (t: IncidentTypePolicy, patch: Partial<IncidentTypePolicy>) => {
    const prev = t;
    setTypePolicy(t.type, patch);
    // audit
    if (patch.policy && patch.policy !== prev.policy) {
      // direct append via hook
      entries; // (forces hook dep)
    }
  };

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader
        title="AI Policies & Governance"
        subtitle="Executive AIOps cockpit — coverage, trust, success rates, kill switch, incident-type policies."
      />
      <div className="flex-1 space-y-4 p-4 sm:p-6">
        {/* Executive Governance Dashboard */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KPI icon={Zap} label="Autonomous runs" value={metrics.autonomousRuns} accent="primary" hint={`${metrics.failedRuns} failed`} />
          <KPI icon={UserCheck} label="Approvals" value={metrics.approvals} accent="info" hint="Engineer-gated" />
          <KPI icon={CheckCircle2} label="Success rate" value={`${metrics.successRate}%`} accent="success" hint="Of executed runs" />
          <KPI icon={Gauge} label="AI trust score" value={`${metrics.aiTrustScore}%`} accent="primary" hint="Avg across types" />
          <KPI icon={BarChart3} label="Automation coverage" value={`${metrics.automationCoverage}%`} accent="info" hint="Types enabled" />
          <KPI icon={Sparkles} label="Avg confidence" value={`${metrics.avgConfidence}%`} accent="primary" hint="Across KB records" />
          <KPI icon={Activity} label="AI analyses" value={metrics.explainCount} accent="info" />
          <KPI icon={XCircle} label="Failed remediations" value={metrics.failedRuns} accent="destructive" />
        </div>

        {/* Confidence distribution + Top learned fixes */}
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Confidence distribution</p>
            <div className="space-y-2 text-xs">
              {(["auto", "approve", "investigate"] as const).map((tier) => {
                const v = metrics.confidenceBuckets[tier];
                const total = Object.values(metrics.confidenceBuckets).reduce((s, n) => s + n, 0) || 1;
                const pct = Math.round((v / total) * 100);
                const cls = tier === "auto" ? "bg-success" : tier === "approve" ? "bg-warning" : "bg-info";
                return (
                  <div key={tier}>
                    <div className="flex justify-between">
                      <span className="capitalize text-foreground">{tier}</span>
                      <span className="font-mono text-muted-foreground">{v} · {pct}%</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className={cn("h-full", cls)} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <p className="mb-3 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              <Trophy className="h-3 w-3" /> Top learned fixes
            </p>
            {metrics.trustScores.length === 0 ? (
              <p className="text-xs text-muted-foreground">No learned remediations yet.</p>
            ) : (
              <ul className="space-y-1.5 text-xs">
                {metrics.trustScores.slice(0, 6).map((t) => (
                  <li key={t.type} className="flex items-center gap-2">
                    <span className="flex-1 truncate text-foreground">{t.label}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">{t.successes}/{t.attempts}</span>
                    <span className={cn(
                      "rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold",
                      t.trust === "high" ? "bg-success/15 text-success" :
                      t.trust === "medium" ? "bg-warning/15 text-warning" :
                      "bg-destructive/15 text-destructive",
                    )}>{t.successRate}%</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Kill switch */}
        <div className={cn("flex items-center justify-between rounded-xl border p-4", killed ? "border-destructive/40 bg-destructive/10" : "border-border bg-card")}>
          <div className="flex items-center gap-3">
            {killed ? <ShieldOff className="h-5 w-5 text-destructive" /> : <ShieldCheck className="h-5 w-5 text-success" />}
            <div>
              <p className="text-sm font-semibold text-foreground">Global Kill Switch</p>
              <p className="text-xs text-muted-foreground">
                {killed ? "All AI remediation suspended platform-wide." : "AI remediation operational under per-asset and per-type policies."}
              </p>
            </div>
          </div>
          <button
            disabled={!isAdmin}
            onClick={() => setKilled(!killed)}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-semibold transition-all",
              killed ? "bg-success text-success-foreground" : "bg-destructive text-destructive-foreground",
              !isAdmin && "cursor-not-allowed opacity-50",
            )}
          >
            {killed ? "Re-enable" : "Engage kill switch"}
          </button>
        </div>

        {/* Incident-Type Policies */}
        <div className="rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold text-foreground">Incident Automation Policies</p>
            </div>
            <span className="text-[10px] text-muted-foreground">{typePolicies.length} types</span>
          </div>
          <div className="grid grid-cols-[1fr_180px_140px_120px] gap-2 border-b border-border bg-muted/30 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <span>Incident type</span>
            <span>Policy</span>
            <span>Min confidence</span>
            <span>Updated</span>
          </div>
          <ul className="divide-y divide-border">
            {sortedTypes.map((t) => (
              <li key={t.type} className="grid grid-cols-[1fr_180px_140px_120px] items-center gap-2 px-4 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm text-foreground">{t.label}</p>
                  <p className="font-mono text-[10px] text-muted-foreground">{t.type}</p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    disabled={!isAdmin}
                    value={t.policy}
                    onChange={(e) => onChangeTypePolicy(t, { policy: e.target.value as RemediationPolicy })}
                    className="rounded-md border border-input bg-background px-2 py-1 text-xs"
                  >
                    {POLICIES.map((p) => <option key={p.v} value={p.v}>{p.label}</option>)}
                  </select>
                  <PolicyBadge p={t.policy} />
                </div>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={t.minConfidence}
                  disabled={!isAdmin}
                  onChange={(e) => onChangeTypePolicy(t, { minConfidence: Math.max(0, Math.min(100, Number(e.target.value))) })}
                  className="w-20 rounded-md border border-input bg-background px-2 py-1 text-xs"
                />
                <span className="font-mono text-[10px] text-muted-foreground">{new Date(t.updatedAt).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Per-Asset Policies */}
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Register per-asset policy</p>
          <div className="grid gap-2 sm:grid-cols-[1fr_140px_160px_auto]">
            <input
              value={draft.label}
              onChange={(e) => setDraft({ ...draft, label: e.target.value })}
              placeholder="Asset key (host, app id, service id)"
              className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
            <select
              value={draft.scope}
              onChange={(e) => setDraft({ ...draft, scope: e.target.value as AssetPolicy["scope"] })}
              className="rounded-md border border-input bg-background px-2 py-2 text-sm"
            >
              {SCOPES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select
              value={draft.policy}
              onChange={(e) => setDraft({ ...draft, policy: e.target.value as RemediationPolicy })}
              className="rounded-md border border-input bg-background px-2 py-2 text-sm"
            >
              {POLICIES.map((p) => <option key={p.v} value={p.v}>{p.label}</option>)}
            </select>
            <button
              disabled={!isAdmin || !draft.label.trim()}
              onClick={add}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary-glow disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" /> Register
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card">
          <div className="grid grid-cols-[1fr_120px_180px_160px_60px] gap-2 border-b border-border bg-muted/30 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <span>Asset</span>
            <span>Scope</span>
            <span>Policy</span>
            <span>Updated</span>
            <span />
          </div>
          {list.length === 0 ? (
            <p className="p-6 text-center text-xs text-muted-foreground">No per-asset overrides. Incident-type policies apply by default.</p>
          ) : (
            <ul className="divide-y divide-border">
              {list.map((p) => (
                <li key={p.assetKey} className="grid grid-cols-[1fr_120px_180px_160px_60px] items-center gap-2 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{p.label}</p>
                    <p className="font-mono text-[10px] text-muted-foreground">{p.assetKey}</p>
                  </div>
                  <span className="text-xs capitalize text-muted-foreground">{p.scope}</span>
                  <div className="flex items-center gap-2">
                    <select
                      disabled={!isAdmin}
                      value={p.policy}
                      onChange={(e) => setPolicy(p.assetKey, p.label, p.scope, e.target.value as RemediationPolicy)}
                      className="rounded-md border border-input bg-background px-2 py-1 text-xs"
                    >
                      {POLICIES.map((opt) => <option key={opt.v} value={opt.v}>{opt.label}</option>)}
                    </select>
                    <PolicyBadge p={p.policy} />
                  </div>
                  <span className="font-mono text-[10px] text-muted-foreground">{new Date(p.updatedAt).toLocaleString()}</span>
                  <button
                    disabled={!isAdmin}
                    onClick={() => remove(p.assetKey)}
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive disabled:opacity-30"
                    aria-label="Disable"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-border bg-muted/30 p-3 text-[11px] text-muted-foreground">
          Decision model: <strong className="text-foreground">confidence &lt; 70%</strong> → investigate ·
          <strong className="text-foreground"> 70–90%</strong> → approval ·
          <strong className="text-foreground"> &gt; 90%</strong> → autonomous (if policy allows).
          Per-incident overrides always win. Acting as {actor}.
        </div>
      </div>
    </div>
  );
};

export default AIPolicies;
