import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useEffect } from "react";
import type { Application, AppAlertRule } from "@/types/applications";
import { SEED_APPLICATIONS, SEED_ALERT_RULES } from "@/data/applicationsMock";

const STORAGE_KEY = "poulina.apps.v1";
const RULES_KEY = "poulina.app-alerts.v1";

// ---- Persistence ----------------------------------------------------------

function loadApps(): Application[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return SEED_APPLICATIONS;
    const parsed = JSON.parse(raw) as Application[];
    return Array.isArray(parsed) && parsed.length ? parsed : SEED_APPLICATIONS;
  } catch { return SEED_APPLICATIONS; }
}
function saveApps(apps: Application[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(apps)); } catch { /* noop */ }
}
function loadRules(): AppAlertRule[] {
  try {
    const raw = localStorage.getItem(RULES_KEY);
    if (!raw) return SEED_ALERT_RULES;
    return JSON.parse(raw) as AppAlertRule[];
  } catch { return SEED_ALERT_RULES; }
}
function saveRules(r: AppAlertRule[]) {
  try { localStorage.setItem(RULES_KEY, JSON.stringify(r)); } catch { /* noop */ }
}

// ---- Live drift ----------------------------------------------------------
// Simulate real-time metrics fluctuation.
function drift(apps: Application[]): Application[] {
  return apps.map((a) => {
    const jitter = (n: number, amp: number, min = 0, max = 100) =>
      Math.max(min, Math.min(max, Math.round((n + (Math.random() - 0.5) * amp) * 100) / 100));
    const newErr = jitter(a.errorRate, 0.6, 0, 20);
    const newLat = Math.max(5, Math.round(a.latencyP95Ms + (Math.random() - 0.5) * 40));
    const newAvail = jitter(a.availability, 0.05, 90, 100);
    let healthScore = a.healthScore + Math.round((Math.random() - 0.5) * 3);
    healthScore = Math.max(0, Math.min(100, healthScore));
    let status = a.status;
    if (newErr > 4 || healthScore < 65) status = "critical";
    else if (newErr > 2 || healthScore < 80) status = "degraded";
    else if (newErr > 1 || healthScore < 90) status = "warning";
    else status = "healthy";
    return {
      ...a,
      errorRate: newErr,
      latencyP95Ms: newLat,
      availability: newAvail,
      healthScore,
      riskScore: Math.max(0, 100 - healthScore),
      status,
      updatedAt: new Date().toISOString(),
    };
  });
}

// ---- Queries --------------------------------------------------------------

export function useApplications() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["applications"],
    queryFn: () => loadApps(),
    staleTime: 0,
    refetchInterval: 5000,
  });

  // Drift on each refetch tick
  useEffect(() => {
    const id = setInterval(() => {
      qc.setQueryData<Application[]>(["applications"], (prev) => {
        const next = drift(prev ?? loadApps());
        saveApps(next);
        return next;
      });
    }, 5000);
    return () => clearInterval(id);
  }, [qc]);

  return q;
}

export function useApplication(id: string | undefined) {
  const { data } = useApplications();
  return (data ?? []).find((a) => a.id === id);
}

export function useUpsertApplication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (app: Application) => {
      const cur = loadApps();
      const i = cur.findIndex((a) => a.id === app.id);
      const next = i >= 0
        ? cur.map((a) => (a.id === app.id ? { ...app, updatedAt: new Date().toISOString() } : a))
        : [...cur, { ...app, updatedAt: new Date().toISOString() }];
      saveApps(next);
      return next;
    },
    onSuccess: (next) => qc.setQueryData(["applications"], next),
  });
}

export function useDeleteApplication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const next = loadApps().filter((a) => a.id !== id);
      saveApps(next);
      return next;
    },
    onSuccess: (next) => qc.setQueryData(["applications"], next),
  });
}

export function useAlertRules() {
  return useQuery({
    queryKey: ["app-alert-rules"],
    queryFn: () => loadRules(),
    staleTime: 5000,
  });
}

export function useUpsertAlertRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rule: AppAlertRule) => {
      const cur = loadRules();
      const i = cur.findIndex((r) => r.id === rule.id);
      const next = i >= 0
        ? cur.map((r) => (r.id === rule.id ? rule : r))
        : [...cur, rule];
      saveRules(next);
      return next;
    },
    onSuccess: (next) => qc.setQueryData(["app-alert-rules"], next),
  });
}

export function useDeleteAlertRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const next = loadRules().filter((r) => r.id !== id);
      saveRules(next);
      return next;
    },
    onSuccess: (next) => qc.setQueryData(["app-alert-rules"], next),
  });
}
