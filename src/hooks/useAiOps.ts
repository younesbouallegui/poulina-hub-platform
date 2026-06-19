// Local-first AIOps state: per-asset trust policies, audit log, knowledge base,
// incident-type policies, per-incident overrides, trust learning.
// Persists to localStorage; ready to swap to Supabase tables later.

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_INCIDENT_TYPE_POLICIES,
  classifyIncident,
  decideAutonomy,
  type AssetPolicy,
  type AuditEntry,
  type IncidentOverride,
  type IncidentType,
  type IncidentTypePolicy,
  type KnowledgeRecord,
  type RemediationPolicy,
  type ApprovedAction,
  type ConfidenceTier,
} from "@/types/aiops";

const POLICY_KEY = "aiops.policies.v1";
const AUDIT_KEY = "aiops.audit.v1";
const KB_KEY = "aiops.kb.v1";
const KILL_KEY = "aiops.killswitch.v1";
const TYPE_POLICY_KEY = "aiops.typepolicies.v1";
const OVERRIDE_KEY = "aiops.overrides.v1";

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new StorageEvent("storage", { key }));
  } catch {
    /* ignore quota */
  }
}

function useLocal<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(() => read<T>(key, fallback));
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === key) setValue(read<T>(key, fallback));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const update = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const v = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
        write(key, v);
        return v;
      });
    },
    [key],
  );
  return [value, update] as const;
}

// ────────────────────────────────────────────────────────────────────────────
// Per-asset policies
// ────────────────────────────────────────────────────────────────────────────

export function useAiPolicies() {
  const [policies, setPolicies] = useLocal<Record<string, AssetPolicy>>(POLICY_KEY, {});

  const getPolicy = useCallback(
    (assetKey: string): AssetPolicy | undefined => policies[assetKey],
    [policies],
  );

  const setPolicy = useCallback(
    (assetKey: string, label: string, scope: AssetPolicy["scope"], policy: RemediationPolicy, approvedActions: ApprovedAction[] = []) => {
      setPolicies((prev) => ({
        ...prev,
        [assetKey]: {
          assetKey,
          label,
          scope,
          policy,
          approvedActions,
          updatedAt: new Date().toISOString(),
        },
      }));
    },
    [setPolicies],
  );

  return { policies, getPolicy, setPolicy };
}

// ────────────────────────────────────────────────────────────────────────────
// Incident-type policies (governance grid)
// ────────────────────────────────────────────────────────────────────────────

export function useIncidentTypePolicies() {
  const [list, setList] = useLocal<IncidentTypePolicy[]>(TYPE_POLICY_KEY, DEFAULT_INCIDENT_TYPE_POLICIES);

  const byType = useMemo(() => {
    const m = new Map<IncidentType, IncidentTypePolicy>();
    list.forEach((p) => m.set(p.type, p));
    // Backfill any new defaults missing from older persisted state.
    DEFAULT_INCIDENT_TYPE_POLICIES.forEach((d) => { if (!m.has(d.type)) m.set(d.type, d); });
    return m;
  }, [list]);

  const setTypePolicy = useCallback(
    (type: IncidentType, patch: Partial<IncidentTypePolicy>) => {
      setList((prev) => {
        const next = [...prev];
        const idx = next.findIndex((p) => p.type === type);
        const base = idx >= 0 ? next[idx] : (DEFAULT_INCIDENT_TYPE_POLICIES.find((d) => d.type === type)!);
        const updated = { ...base, ...patch, updatedAt: new Date().toISOString() };
        if (idx >= 0) next[idx] = updated; else next.push(updated);
        return next;
      });
    },
    [setList],
  );

  const resolveForTrigger = useCallback(
    (trigger: string): IncidentTypePolicy => {
      const type = classifyIncident(trigger);
      return byType.get(type) ?? DEFAULT_INCIDENT_TYPE_POLICIES.find((d) => d.type === "other")!;
    },
    [byType],
  );

  return { typePolicies: list, byType, setTypePolicy, resolveForTrigger };
}

// ────────────────────────────────────────────────────────────────────────────
// Per-incident overrides
// ────────────────────────────────────────────────────────────────────────────

export function useIncidentOverrides() {
  const [map, setMap] = useLocal<Record<string, IncidentOverride>>(OVERRIDE_KEY, {});

  const get = useCallback((eventId: string) => map[eventId], [map]);

  const set = useCallback(
    (eventId: string, enabled: boolean, actor: string, reason?: string) => {
      setMap((prev) => ({
        ...prev,
        [eventId]: { eventId, enabled, updatedAt: new Date().toISOString(), updatedBy: actor, reason },
      }));
    },
    [setMap],
  );

  const clear = useCallback(
    (eventId: string) => setMap((prev) => {
      const next = { ...prev };
      delete next[eventId];
      return next;
    }),
    [setMap],
  );

  return { overrides: map, get, set, clear };
}

// ────────────────────────────────────────────────────────────────────────────
// Effective policy resolution (incident-type + per-asset + per-incident override)
// ────────────────────────────────────────────────────────────────────────────

export interface EffectivePolicy {
  effective: RemediationPolicy;
  tier: ConfidenceTier;
  minConfidence: number;
  source: "override-disabled" | "override-enabled" | "asset" | "incident-type" | "default";
  incidentType: IncidentType;
  reasons: string[];
}

export function useEffectivePolicy(args: {
  eventId: string;
  hostKey: string;
  trigger: string;
  confidence: number;
}): EffectivePolicy {
  const { getPolicy } = useAiPolicies();
  const { resolveForTrigger } = useIncidentTypePolicies();
  const { get: getOverride } = useIncidentOverrides();

  return useMemo(() => {
    const typePol = resolveForTrigger(args.trigger);
    const asset = getPolicy(args.hostKey);
    const override = getOverride(args.eventId);
    const reasons: string[] = [];
    reasons.push(`Incident classified as "${typePol.type}" → ${typePol.policy}`);
    if (asset) reasons.push(`Asset ${args.hostKey} policy: ${asset.policy}`);

    let effective: RemediationPolicy = typePol.policy;
    let source: EffectivePolicy["source"] = "incident-type";
    if (asset) { effective = asset.policy; source = "asset"; }
    if (override) {
      if (!override.enabled) {
        effective = "off";
        source = "override-disabled";
        reasons.push(`Per-incident override: DISABLED${override.reason ? ` (${override.reason})` : ""}`);
      } else {
        // promote at most to approval — explicit per-incident enable
        if (effective === "off") effective = "approval";
        source = "override-enabled";
        reasons.push(`Per-incident override: ENABLED`);
      }
    }
    const tier = decideAutonomy(args.confidence);
    reasons.push(`Confidence ${args.confidence}% → ${tier}`);

    // Confidence gate downgrades autonomous if below threshold
    if (effective === "autonomous" && args.confidence < typePol.minConfidence) {
      reasons.push(`Below min confidence (${typePol.minConfidence}%) → downgraded to approval`);
      effective = "approval";
    }
    if (tier === "investigate" && (effective === "autonomous" || effective === "approval")) {
      reasons.push(`Confidence below 70% → suggest only`);
      effective = "suggest";
    }

    return { effective, tier, minConfidence: typePol.minConfidence, source, incidentType: typePol.type, reasons };
  }, [args.confidence, args.eventId, args.hostKey, args.trigger, getAsset, getOverride, resolveForTrigger]);
}

// ────────────────────────────────────────────────────────────────────────────
// Audit trail
// ────────────────────────────────────────────────────────────────────────────

export function useAuditLog() {
  const [entries, setEntries] = useLocal<AuditEntry[]>(AUDIT_KEY, []);
  const append = useCallback(
    (entry: Omit<AuditEntry, "id" | "ts">) => {
      const full: AuditEntry = {
        ...entry,
        id: crypto.randomUUID(),
        ts: new Date().toISOString(),
      };
      setEntries((prev) => [full, ...prev].slice(0, 1000));
      return full;
    },
    [setEntries],
  );
  const forIncident = useCallback(
    (eventId: string) => entries.filter((e) => e.meta?.eventId === eventId),
    [entries],
  );
  return { entries, append, forIncident };
}

// ────────────────────────────────────────────────────────────────────────────
// Knowledge base
// ────────────────────────────────────────────────────────────────────────────

export function useIncidentKnowledge() {
  const [records, setRecords] = useLocal<KnowledgeRecord[]>(KB_KEY, []);

  const upsert = useCallback(
    (rec: Omit<KnowledgeRecord, "id" | "createdAt">) => {
      const full: KnowledgeRecord = {
        ...rec,
        incidentType: rec.incidentType ?? classifyIncident(rec.trigger),
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
      };
      setRecords((prev) => [full, ...prev].slice(0, 500));
      return full;
    },
    [setRecords],
  );

  const findSimilar = useCallback(
    (signal: { trigger: string; host?: string; symptoms?: string[] }, limit = 3) => {
      const tokens = new Set(
        [signal.trigger, signal.host ?? "", ...(signal.symptoms ?? [])]
          .join(" ")
          .toLowerCase()
          .split(/\W+/)
          .filter(Boolean),
      );
      return records
        .map((r) => {
          const rt = new Set(
            [r.trigger, r.host, ...(r.symptoms ?? [])]
              .join(" ")
              .toLowerCase()
              .split(/\W+/)
              .filter(Boolean),
          );
          let hits = 0;
          tokens.forEach((t) => rt.has(t) && hits++);
          const sim = Math.round((hits / Math.max(1, tokens.size)) * 100);
          return { record: r, similarity: sim };
        })
        .filter((m) => m.similarity > 0)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);
    },
    [records],
  );

  return { records, upsert, findSimilar };
}

// ────────────────────────────────────────────────────────────────────────────
// Kill switch
// ────────────────────────────────────────────────────────────────────────────

export function useKillSwitch() {
  const [killed, setKilled] = useLocal<boolean>(KILL_KEY, false);
  return { killed, setKilled };
}

// ────────────────────────────────────────────────────────────────────────────
// Trust learning — success rates per incident type
// ────────────────────────────────────────────────────────────────────────────

export interface TrustScore {
  type: IncidentType;
  label: string;
  attempts: number;
  successes: number;
  successRate: number;
  trust: "high" | "medium" | "low";
}

export function useTrustScores(): TrustScore[] {
  const { records } = useIncidentKnowledge();
  return useMemo(() => {
    const labels: Record<IncidentType, string> = DEFAULT_INCIDENT_TYPE_POLICIES.reduce(
      (acc, p) => ({ ...acc, [p.type]: p.label }),
      {} as Record<IncidentType, string>,
    );
    const acc = new Map<IncidentType, { attempts: number; successes: number }>();
    records.filter((r) => r.source === "ai").forEach((r) => {
      const t = r.incidentType ?? classifyIncident(r.trigger);
      const cur = acc.get(t) ?? { attempts: 0, successes: 0 };
      cur.attempts += 1;
      if (r.outcome === "resolved") cur.successes += 1;
      acc.set(t, cur);
    });
    return Array.from(acc.entries()).map(([type, v]) => {
      const successRate = v.attempts ? Math.round((v.successes / v.attempts) * 100) : 0;
      const trust: TrustScore["trust"] = successRate >= 85 ? "high" : successRate >= 60 ? "medium" : "low";
      return { type, label: labels[type] ?? type, attempts: v.attempts, successes: v.successes, successRate, trust };
    }).sort((a, b) => b.successRate - a.successRate);
  }, [records]);
}

// ────────────────────────────────────────────────────────────────────────────
// AIOps metrics — fleet-wide governance dashboard
// ────────────────────────────────────────────────────────────────────────────

export function useAiOpsMetrics() {
  const { entries } = useAuditLog();
  const { records } = useIncidentKnowledge();
  const { typePolicies } = useIncidentTypePolicies();
  const trustScores = useTrustScores();

  const aiResolved   = records.filter((r) => r.source === "ai" && r.outcome === "resolved").length;
  const totalResolved = records.filter((r) => r.outcome === "resolved").length;
  const autonomousRuns = entries.filter((e) => e.kind === "ai-remediate-execute").length;
  const failedRuns = entries.filter((e) => e.kind === "ai-remediate-execute" && e.meta?.status === "failed").length;
  const approvals = entries.filter((e) => e.kind === "approval").length;
  const explainCount = entries.filter((e) => e.kind === "ai-explain" || e.kind === "ai-analysis").length;
  const successRate = autonomousRuns ? Math.round(((autonomousRuns - failedRuns) / autonomousRuns) * 100) : 0;
  const avgConfidence = records.length === 0
    ? 0
    : Math.round(records.reduce((s, r) => s + r.confidence, 0) / records.length);

  const automationCoverage = typePolicies.length
    ? Math.round((typePolicies.filter((p) => p.policy !== "off").length / typePolicies.length) * 100)
    : 0;

  const confidenceBuckets = { investigate: 0, approve: 0, auto: 0 };
  records.forEach((r) => { confidenceBuckets[decideAutonomy(r.confidence)] += 1; });

  const aiTrustScore = trustScores.length
    ? Math.round(trustScores.reduce((s, t) => s + t.successRate, 0) / trustScores.length)
    : 0;

  return {
    aiResolved,
    totalResolved,
    autonomousRuns,
    failedRuns,
    approvals,
    explainCount,
    successRate,
    avgConfidence,
    automationCoverage,
    confidenceBuckets,
    aiTrustScore,
    trustScores,
  };
}
