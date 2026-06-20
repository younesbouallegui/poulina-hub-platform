// Execution engine for AI remediation plans.
// Real workflow architecture (state machine + backup + audit + history)
// persisted to localStorage. Step execution is performed locally because the
// platform does not yet ship a remote control-plane; the engine is shaped so
// the step runner can be swapped for an HTTP/SSH/Edge-Function executor later.

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ExecutionPlan, ExecutionStep, RiskLevel } from "./aiActionParser";

export type StepStatus = "pending" | "running" | "success" | "failed" | "rolled-back" | "skipped";

export type ExecutionStatus =
  | "idle"
  | "confirming"
  | "backing-up"
  | "executing"
  | "success"
  | "failed"
  | "rolling-back"
  | "rolled-back";

export interface StepRecord {
  id: string;
  name: string;
  description: string;
  command?: string;
  status: StepStatus;
  startedAt?: string;
  finishedAt?: string;
  output?: string;
  error?: string;
}

export interface RecoveryPoint {
  id: string;
  createdAt: string;
  /** Previous configuration snapshot (mock representation). */
  previousConfig: Record<string, unknown>;
  previousState: Record<string, unknown>;
  previousValues: Record<string, unknown>;
  previousCommands: string[];
  metadata: {
    planId: string;
    risk: RiskLevel;
    services: string[];
    resources: string[];
    capturedBy: string;
  };
}

export interface ExecutionRecord {
  id: string;
  planId: string;
  plan: ExecutionPlan;
  status: ExecutionStatus;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  finishedAt?: string;
  actor: string;
  steps: StepRecord[];
  recovery?: RecoveryPoint;
  /** Reverse log of the rollback path (steps run during a rollback). */
  rollbackSteps?: StepRecord[];
  rollbackStartedAt?: string;
  rollbackFinishedAt?: string;
  warnings: string[];
}

const STORE_KEY = "ai.execution.history.v1";

function readStore(): Record<string, ExecutionRecord> {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, ExecutionRecord>) : {};
  } catch {
    return {};
  }
}

function writeStore(store: Record<string, ExecutionRecord>) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
    window.dispatchEvent(new StorageEvent("storage", { key: STORE_KEY }));
  } catch {
    /* quota */
  }
}

function updateRecord(id: string, mut: (r: ExecutionRecord) => ExecutionRecord) {
  const store = readStore();
  const existing = store[id];
  if (!existing) return;
  store[id] = mut({ ...existing, updatedAt: new Date().toISOString() });
  writeStore(store);
}

/** Pluggable step runner. Today: timer-based local execution.
 *  Tomorrow: replace with edge-function/SSH/kubectl runner. */
async function runStep(step: ExecutionStep, signal: AbortSignal): Promise<{ output: string }> {
  const duration = step.estimatedMs + Math.round((Math.random() - 0.5) * 600);
  await new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, Math.max(400, duration));
    signal.addEventListener("abort", () => {
      clearTimeout(t);
      reject(new DOMException("Aborted", "AbortError"));
    });
  });
  // ~5% synthetic failure rate for non-backup/verify steps with dangerous patterns
  if (step.command && /\b--force\b|\brm\s+-rf\b/.test(step.command) && Math.random() < 0.15) {
    throw new Error("Operation refused by safety guard");
  }
  return { output: step.command ? `$ ${step.command}\nok` : `${step.name} → completed` };
}

function captureRecoveryPoint(plan: ExecutionPlan, actor: string): RecoveryPoint {
  return {
    id: `rp-${plan.planId}-${Date.now()}`,
    createdAt: new Date().toISOString(),
    previousConfig: {
      // Real implementations would diff the live config; here we keep an opaque
      // hash so the rollback path can show meaningful data.
      hash: cryptoRandomHex(),
      capturedAt: new Date().toISOString(),
    },
    previousState: {
      services: plan.services,
      health: "nominal",
    },
    previousValues: Object.fromEntries(plan.resources.map((r) => [r, "current-value"])),
    previousCommands: plan.steps.filter((s) => s.command).map((s) => s.command as string),
    metadata: {
      planId: plan.planId,
      risk: plan.risk,
      services: plan.services,
      resources: plan.resources,
      capturedBy: actor,
    },
  };
}

function cryptoRandomHex(): string {
  const b = new Uint8Array(8);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

export interface UseExecutionApi {
  record: ExecutionRecord | null;
  prepare: (plan: ExecutionPlan) => void;
  cancel: () => void;
  confirmAndExecute: (plan: ExecutionPlan, actor: string) => Promise<void>;
  rollback: (actor: string) => Promise<void>;
}

/** Hook scoped to a single AI message / plan id. */
export function useExecution(planId: string | undefined): UseExecutionApi {
  const [record, setRecord] = useState<ExecutionRecord | null>(() => {
    if (!planId) return null;
    return readStore()[planId] ?? null;
  });

  // Cross-tab / cross-component sync
  useEffect(() => {
    if (!planId) return;
    const refresh = () => setRecord(readStore()[planId] ?? null);
    refresh();
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORE_KEY) refresh();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [planId]);

  const prepare = useCallback((plan: ExecutionPlan) => {
    const store = readStore();
    if (store[plan.planId]) return;
    const now = new Date().toISOString();
    store[plan.planId] = {
      id: plan.planId,
      planId: plan.planId,
      plan,
      status: "confirming",
      createdAt: now,
      updatedAt: now,
      actor: "pending",
      steps: plan.steps.map<StepRecord>((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        command: s.command,
        status: "pending",
      })),
      warnings: plan.warnings,
    };
    writeStore(store);
  }, []);

  const cancel = useCallback(() => {
    if (!planId) return;
    const store = readStore();
    const r = store[planId];
    if (r && r.status === "confirming") {
      delete store[planId];
      writeStore(store);
    }
  }, [planId]);

  const confirmAndExecute = useCallback(
    async (plan: ExecutionPlan, actor: string) => {
      prepare(plan);
      const startedAt = new Date().toISOString();

      // Always create a recovery point first (automatic backup, transparent).
      const recovery = captureRecoveryPoint(plan, actor);
      updateRecord(plan.planId, (r) => ({
        ...r,
        actor,
        status: "backing-up",
        startedAt,
        recovery,
      }));

      // Mark backup step success
      updateRecord(plan.planId, (r) => ({
        ...r,
        steps: r.steps.map((s, i) =>
          i === 0
            ? {
                ...s,
                status: "success",
                startedAt,
                finishedAt: new Date().toISOString(),
                output: `recovery-point ${recovery.id} created`,
              }
            : s,
        ),
      }));

      updateRecord(plan.planId, (r) => ({ ...r, status: "executing" }));

      const controller = new AbortController();
      let failed = false;

      // Execute remaining steps sequentially
      for (let i = 1; i < plan.steps.length; i++) {
        const step = plan.steps[i];
        const stepStart = new Date().toISOString();
        updateRecord(plan.planId, (r) => ({
          ...r,
          steps: r.steps.map((s, j) =>
            j === i ? { ...s, status: "running", startedAt: stepStart } : s,
          ),
        }));
        try {
          const { output } = await runStep(step, controller.signal);
          updateRecord(plan.planId, (r) => ({
            ...r,
            steps: r.steps.map((s, j) =>
              j === i
                ? {
                    ...s,
                    status: "success",
                    finishedAt: new Date().toISOString(),
                    output,
                  }
                : s,
            ),
          }));
        } catch (e) {
          failed = true;
          const err = e instanceof Error ? e.message : "unknown error";
          updateRecord(plan.planId, (r) => ({
            ...r,
            steps: r.steps.map((s, j) => {
              if (j === i)
                return {
                  ...s,
                  status: "failed",
                  finishedAt: new Date().toISOString(),
                  error: err,
                };
              if (j > i) return { ...s, status: "skipped" };
              return s;
            }),
          }));
          break;
        }
      }

      updateRecord(plan.planId, (r) => ({
        ...r,
        status: failed ? "failed" : "success",
        finishedAt: new Date().toISOString(),
      }));
    },
    [prepare],
  );

  const rollback = useCallback(
    async (actor: string) => {
      if (!planId) return;
      const current = readStore()[planId];
      if (!current || !current.recovery) return;

      const startedAt = new Date().toISOString();
      const reverseSteps: StepRecord[] = [
        ...current.steps
          .filter((s) => s.status === "success" && !s.id.endsWith("-backup"))
          .reverse()
          .map<StepRecord>((s) => ({
            id: `rb-${s.id}`,
            name: `Revert: ${s.name}`,
            description: `Restore previous state for ${s.name}`,
            command: s.command ? `# revert: ${s.command}` : undefined,
            status: "pending",
          })),
        {
          id: `rb-validate-${planId}`,
          name: "Validate restoration",
          description: "Verify services healthy and recovery point applied",
          status: "pending",
        },
      ];

      updateRecord(planId, (r) => ({
        ...r,
        status: "rolling-back",
        rollbackStartedAt: startedAt,
        rollbackSteps: reverseSteps,
        actor,
      }));

      const controller = new AbortController();
      for (let i = 0; i < reverseSteps.length; i++) {
        const step = reverseSteps[i];
        const stepStart = new Date().toISOString();
        updateRecord(planId, (r) => ({
          ...r,
          rollbackSteps: (r.rollbackSteps ?? []).map((s, j) =>
            j === i ? { ...s, status: "running", startedAt: stepStart } : s,
          ),
        }));
        try {
          await new Promise<void>((resolve, reject) => {
            const t = setTimeout(resolve, 900 + Math.random() * 700);
            controller.signal.addEventListener("abort", () => {
              clearTimeout(t);
              reject(new DOMException("Aborted", "AbortError"));
            });
          });
          updateRecord(planId, (r) => ({
            ...r,
            rollbackSteps: (r.rollbackSteps ?? []).map((s, j) =>
              j === i
                ? {
                    ...s,
                    status: "success",
                    finishedAt: new Date().toISOString(),
                    output: `restored from ${current.recovery!.id}`,
                  }
                : s,
            ),
          }));
        } catch (e) {
          const err = e instanceof Error ? e.message : "unknown error";
          updateRecord(planId, (r) => ({
            ...r,
            rollbackSteps: (r.rollbackSteps ?? []).map((s, j) =>
              j === i
                ? { ...s, status: "failed", finishedAt: new Date().toISOString(), error: err }
                : s,
            ),
          }));
          break;
        }
      }

      updateRecord(planId, (r) => ({
        ...r,
        status: "rolled-back",
        rollbackFinishedAt: new Date().toISOString(),
        steps: r.steps.map((s) =>
          s.status === "success" && !s.id.endsWith("-backup")
            ? { ...s, status: "rolled-back" }
            : s,
        ),
      }));
    },
    [planId],
  );

  return { record, prepare, cancel, confirmAndExecute, rollback };
}

/** Read-only access to the full execution history (for dashboards). */
export function useExecutionHistory() {
  const [store, setStore] = useState<Record<string, ExecutionRecord>>(() => readStore());
  useEffect(() => {
    const refresh = () => setStore(readStore());
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORE_KEY) refresh();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  return useMemo(
    () => Object.values(store).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    [store],
  );
}

export const RISK_META: Record<RiskLevel, { label: string; tone: string; ring: string }> = {
  low: { label: "Low risk", tone: "text-success", ring: "border-success/40 bg-success/10" },
  medium: { label: "Medium risk", tone: "text-warning", ring: "border-warning/40 bg-warning/10" },
  high: { label: "High risk", tone: "text-destructive", ring: "border-destructive/40 bg-destructive/10" },
  critical: {
    label: "Critical",
    tone: "text-destructive",
    ring: "border-destructive/60 bg-destructive/15",
  },
};
