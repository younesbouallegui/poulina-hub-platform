import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useEffect } from "react";
import type {
  Server, Site, Hypervisor, VirtualMachine, Container, K8sCluster,
  NetworkDevice, StorageArray, DatabaseServer, LoadBalancer, CloudResource,
  MaintenanceWindow, DiscoveryJob, InfraPolicy, CapacityForecast, ChangeEvent,
} from "@/types/infrastructure";
import {
  SEED_SERVERS, SEED_SITES, SEED_HYPERVISORS, SEED_VMS, SEED_CONTAINERS,
  SEED_K8S, SEED_NETWORK, SEED_STORAGE, SEED_DATABASES, SEED_LBS, SEED_CLOUD,
  SEED_MAINTENANCE, SEED_DISCOVERY, SEED_POLICIES, SEED_CAPACITY,
} from "@/data/infrastructureMock";

const SK = {
  servers: "poulina.infra.servers.v1",
  maintenance: "poulina.infra.maintenance.v1",
  discovery: "poulina.infra.discovery.v1",
  policies: "poulina.infra.policies.v1",
};

function load<T>(k: string, seed: T): T {
  try {
    const raw = localStorage.getItem(k);
    if (!raw) return seed;
    const parsed = JSON.parse(raw);
    return parsed && (Array.isArray(parsed) ? parsed.length : true) ? parsed : seed;
  } catch { return seed; }
}
function save<T>(k: string, v: T) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* noop */ } }

function drift(srv: Server[]): Server[] {
  return srv.map((s) => {
    if (s.status === "maintenance") return s;
    const jitter = (n: number, amp: number, min = 0, max = 100) =>
      Math.max(min, Math.min(max, Math.round((n + (Math.random() - 0.5) * amp) * 10) / 10));
    const cpu = jitter(s.cpuPct, 4);
    const ram = jitter(s.ramPct, 2);
    const disk = jitter(s.diskPct, 0.2);
    const io = jitter(s.ioWaitPct, 0.6, 0, 30);
    const rx = jitter(s.netRxMbps, 8, 0, 10_000);
    const tx = jitter(s.netTxMbps, 8, 0, 10_000);
    const worst = Math.max(cpu, ram, disk);
    const status: Server["status"] = worst > 92 ? "critical" : worst > 85 ? "degraded" : worst > 75 ? "warning" : "healthy";
    const healthScore = Math.round(100 - worst * 0.6 - io * 0.8 - s.activeIncidents * 4);
    const riskScore = Math.round(Math.min(100, worst * 0.5 + io + s.activeIncidents * 6));
    return { ...s, cpuPct: cpu, ramPct: ram, diskPct: disk, ioWaitPct: io, netRxMbps: rx, netTxMbps: tx, status, healthScore: Math.max(0, healthScore), riskScore, uptimeSec: s.uptimeSec + 5, lastSeen: new Date().toISOString(), updatedAt: new Date().toISOString() };
  });
}

// ---- Servers --------------------------------------------------------------

export function useServers() {
  const qc = useQueryClient();
  const q = useQuery<Server[]>({
    queryKey: ["infra-servers"],
    queryFn: async () => load<Server[]>(SK.servers, SEED_SERVERS),
    staleTime: Infinity,
  });
  useEffect(() => {
    const t = setInterval(() => {
      qc.setQueryData<Server[]>(["infra-servers"], (cur) => {
        const next = drift(cur ?? SEED_SERVERS);
        save(SK.servers, next);
        return next;
      });
    }, 5000);
    return () => clearInterval(t);
  }, [qc]);
  return q;
}

export function useServer(id: string | undefined) {
  const { data } = useServers();
  return (data ?? []).find((s) => s.id === id);
}

export function useUpsertServer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (srv: Server) => srv,
    onSuccess: (srv) => {
      qc.setQueryData<Server[]>(["infra-servers"], (cur) => {
        const list = cur ?? SEED_SERVERS;
        const exists = list.some((s) => s.id === srv.id);
        const next = exists ? list.map((s) => (s.id === srv.id ? srv : s)) : [srv, ...list];
        save(SK.servers, next);
        return next;
      });
    },
  });
}

export function useDeleteServer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => id,
    onSuccess: (id) => {
      qc.setQueryData<Server[]>(["infra-servers"], (cur) => {
        const next = (cur ?? []).filter((s) => s.id !== id);
        save(SK.servers, next);
        return next;
      });
    },
  });
}

export function useAppendChange() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, change }: { id: string; change: ChangeEvent }) => ({ id, change }),
    onSuccess: ({ id, change }) => {
      qc.setQueryData<Server[]>(["infra-servers"], (cur) => {
        const next = (cur ?? []).map((s) => (s.id === id ? { ...s, changes: [change, ...s.changes].slice(0, 50) } : s));
        save(SK.servers, next);
        return next;
      });
    },
  });
}

// ---- Read-only catalogs (mock) -------------------------------------------

export const useSites = () => useQuery<Site[]>({ queryKey: ["infra-sites"], queryFn: async () => SEED_SITES, staleTime: Infinity });
export const useHypervisors = () => useQuery<Hypervisor[]>({ queryKey: ["infra-hv"], queryFn: async () => SEED_HYPERVISORS, staleTime: Infinity });
export const useVMs = () => useQuery<VirtualMachine[]>({ queryKey: ["infra-vms"], queryFn: async () => SEED_VMS, staleTime: Infinity });
export const useContainers = () => useQuery<Container[]>({ queryKey: ["infra-containers"], queryFn: async () => SEED_CONTAINERS, staleTime: Infinity });
export const useK8sClusters = () => useQuery<K8sCluster[]>({ queryKey: ["infra-k8s"], queryFn: async () => SEED_K8S, staleTime: Infinity });
export const useNetworkDevices = () => useQuery<NetworkDevice[]>({ queryKey: ["infra-net"], queryFn: async () => SEED_NETWORK, staleTime: Infinity });
export const useStorageArrays = () => useQuery<StorageArray[]>({ queryKey: ["infra-storage"], queryFn: async () => SEED_STORAGE, staleTime: Infinity });
export const useDatabaseServers = () => useQuery<DatabaseServer[]>({ queryKey: ["infra-db"], queryFn: async () => SEED_DATABASES, staleTime: Infinity });
export const useLoadBalancers = () => useQuery<LoadBalancer[]>({ queryKey: ["infra-lb"], queryFn: async () => SEED_LBS, staleTime: Infinity });
export const useCloudResources = () => useQuery<CloudResource[]>({ queryKey: ["infra-cloud"], queryFn: async () => SEED_CLOUD, staleTime: Infinity });
export const useCapacityForecasts = () => useQuery<CapacityForecast[]>({ queryKey: ["infra-cap"], queryFn: async () => SEED_CAPACITY, staleTime: Infinity });

// ---- Maintenance windows --------------------------------------------------

export function useMaintenanceWindows() {
  const qc = useQueryClient();
  const q = useQuery<MaintenanceWindow[]>({
    queryKey: ["infra-mw"],
    queryFn: async () => load<MaintenanceWindow[]>(SK.maintenance, SEED_MAINTENANCE),
    staleTime: Infinity,
  });
  return q;
}
export function useUpsertMaintenance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (mw: MaintenanceWindow) => mw,
    onSuccess: (mw) => {
      qc.setQueryData<MaintenanceWindow[]>(["infra-mw"], (cur) => {
        const list = cur ?? SEED_MAINTENANCE;
        const exists = list.some((m) => m.id === mw.id);
        const next = exists ? list.map((m) => (m.id === mw.id ? mw : m)) : [mw, ...list];
        save(SK.maintenance, next);
        return next;
      });
    },
  });
}

// ---- Discovery ------------------------------------------------------------

export function useDiscoveryJobs() {
  return useQuery<DiscoveryJob[]>({
    queryKey: ["infra-disc"],
    queryFn: async () => load<DiscoveryJob[]>(SK.discovery, SEED_DISCOVERY),
    staleTime: Infinity,
  });
}
export function useUpsertDiscovery() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (d: DiscoveryJob) => d,
    onSuccess: (d) => {
      qc.setQueryData<DiscoveryJob[]>(["infra-disc"], (cur) => {
        const list = cur ?? SEED_DISCOVERY;
        const exists = list.some((x) => x.id === d.id);
        const next = exists ? list.map((x) => (x.id === d.id ? d : x)) : [d, ...list];
        save(SK.discovery, next);
        return next;
      });
    },
  });
}

// ---- Policies -------------------------------------------------------------

export function usePolicies() {
  return useQuery<InfraPolicy[]>({
    queryKey: ["infra-pol"],
    queryFn: async () => load<InfraPolicy[]>(SK.policies, SEED_POLICIES),
    staleTime: Infinity,
  });
}
export function useUpsertPolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: InfraPolicy) => p,
    onSuccess: (p) => {
      qc.setQueryData<InfraPolicy[]>(["infra-pol"], (cur) => {
        const list = cur ?? SEED_POLICIES;
        const exists = list.some((x) => x.id === p.id);
        const next = exists ? list.map((x) => (x.id === p.id ? p : x)) : [p, ...list];
        save(SK.policies, next);
        return next;
      });
    },
  });
}
