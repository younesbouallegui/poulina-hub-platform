// Local-first AIOps state: per-asset trust policies, audit log, knowledge base.
// Persists to localStorage; ready to swap to Supabase tables later.

import { useCallback, useEffect, useState } from "react";
import type {
  AssetPolicy,
  AuditEntry,
  KnowledgeRecord,
  RemediationPolicy,
  ApprovedAction,
} from "@/types/aiops";

const POLICY_KEY = "aiops.policies.v1";
const AUDIT_KEY = "aiops.audit.v1";
const KB_KEY = "aiops.kb.v1";
const KILL_KEY = "aiops.killswitch.v1";

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
// Policies
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
      setEntries((prev) => [full, ...prev].slice(0, 500));
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
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
      };
      setRecords((prev) => [full, ...prev].slice(0, 500));
      return full;
    },
    [setRecords],
  );

  /** Naive lexical similarity over trigger + host + symptoms */
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
// Kill switch (enterprise safety)
// ────────────────────────────────────────────────────────────────────────────

export function useKillSwitch() {
  const [killed, setKilled] = useLocal<boolean>(KILL_KEY, false);
  return { killed, setKilled };
}

// ────────────────────────────────────────────────────────────────────────────
// AIOps KPIs (derived from audit + KB)
// ────────────────────────────────────────────────────────────────────────────

export function useAiOpsMetrics() {
  const { entries } = useAuditLog();
  const { records } = useIncidentKnowledge();

  const aiResolved = records.filter((r) => r.source === "ai" && r.outcome === "resolved").length;
  const totalResolved = records.filter((r) => r.outcome === "resolved").length;
  const autonomousRuns = entries.filter((e) => e.kind === "ai-remediate-execute").length;
  const approvals = entries.filter((e) => e.kind === "approval").length;
  const explainCount = entries.filter((e) => e.kind === "ai-explain").length;
  const successRate = totalResolved > 0 ? Math.round((aiResolved / totalResolved) * 100) : 0;
  const avgConfidence =
    records.length === 0
      ? 0
      : Math.round(records.reduce((s, r) => s + r.confidence, 0) / records.length);

  return {
    aiResolved,
    totalResolved,
    autonomousRuns,
    approvals,
    explainCount,
    successRate,
    avgConfidence,
  };
}
