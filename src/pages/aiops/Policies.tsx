import { useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { useAiPolicies, useKillSwitch } from "@/hooks/useAiOps";
import type { AssetPolicy, RemediationPolicy } from "@/types/aiops";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { Plus, ShieldOff, ShieldCheck, Trash2 } from "lucide-react";

const POLICIES: { v: RemediationPolicy; label: string; desc: string }[] = [
  { v: "off", label: "Off", desc: "AI disabled for this asset" },
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

const AIPolicies = () => {
  const { policies, setPolicy } = useAiPolicies();
  const { killed, setKilled } = useKillSwitch();
  const { hasRole } = useAuth();
  const isAdmin = hasRole("admin", "super_admin");
  const [draft, setDraft] = useState({ label: "", scope: "server" as AssetPolicy["scope"], policy: "suggest" as RemediationPolicy });

  const list = useMemo(() => Object.values(policies).sort((a, b) => a.label.localeCompare(b.label)), [policies]);

  const add = () => {
    if (!draft.label.trim()) return;
    setPolicy(draft.label.trim(), draft.label.trim(), draft.scope, draft.policy);
    setDraft({ label: "", scope: "server", policy: "suggest" });
  };

  const remove = (key: string) => {
    // soft-delete: set to off and let it stay
    const p = policies[key];
    if (p) setPolicy(key, p.label, p.scope, "off");
  };

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader
        title="AI Policies"
        subtitle="Govern where AI may suggest, approve, or autonomously remediate."
      />
      <div className="flex-1 space-y-4 p-4 sm:p-6">
        {/* Kill switch */}
        <div className={cn("flex items-center justify-between rounded-xl border p-4", killed ? "border-destructive/40 bg-destructive/10" : "border-border bg-card")}>
          <div className="flex items-center gap-3">
            {killed ? <ShieldOff className="h-5 w-5 text-destructive" /> : <ShieldCheck className="h-5 w-5 text-success" />}
            <div>
              <p className="text-sm font-semibold text-foreground">Global Kill Switch</p>
              <p className="text-xs text-muted-foreground">
                {killed ? "All AI remediation suspended platform-wide." : "AI remediation operational under per-asset policy."}
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

        {/* Add */}
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Register asset policy</p>
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

        {/* List */}
        <div className="rounded-xl border border-border bg-card">
          <div className="grid grid-cols-[1fr_120px_140px_160px_60px] gap-2 border-b border-border bg-muted/30 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <span>Asset</span>
            <span>Scope</span>
            <span>Policy</span>
            <span>Updated</span>
            <span />
          </div>
          {list.length === 0 ? (
            <p className="p-6 text-center text-xs text-muted-foreground">No policies yet. Register one above.</p>
          ) : (
            <ul className="divide-y divide-border">
              {list.map((p) => (
                <li key={p.assetKey} className="grid grid-cols-[1fr_120px_140px_160px_60px] items-center gap-2 px-4 py-3">
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
          Trust tiers: <strong className="text-foreground">Off</strong> · <strong className="text-foreground">Suggest</strong> · <strong className="text-foreground">Approval</strong> · <strong className="text-foreground">Autonomous</strong>. Higher tiers require admin role.
        </div>
      </div>
    </div>
  );
};

export default AIPolicies;
