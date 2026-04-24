/**
 * Mock data for the Poulina ChatOps platform.
 * In production this would be served by the backend, scoped to the
 * authenticated user via RBAC checks.
 */

export type ServerStatus = "healthy" | "warning" | "critical";

export interface ServerInfo {
  id: string;
  name: string;
  type: string;
  region: string;
  status: ServerStatus;
  cpu: number; // 0-100
  memory: number; // 0-100
  disk: number; // 0-100
  uptime: number; // %
  ipAddress: string;
  os: string;
  lastDeployment: string;
}

export const ALL_SERVERS: ServerInfo[] = [
  {
    id: "srv-001",
    name: "api-gateway-prod",
    type: "API Gateway",
    region: "eu-west-1",
    status: "healthy",
    cpu: 38,
    memory: 52,
    disk: 41,
    uptime: 99.98,
    ipAddress: "10.0.1.21",
    os: "Ubuntu 22.04",
    lastDeployment: "2h ago",
  },
  {
    id: "srv-002",
    name: "payment-svc",
    type: "Microservice",
    region: "eu-west-1",
    status: "warning",
    cpu: 72,
    memory: 81,
    disk: 55,
    uptime: 99.82,
    ipAddress: "10.0.1.34",
    os: "Ubuntu 22.04",
    lastDeployment: "6h ago",
  },
  {
    id: "srv-003",
    name: "checkout-api",
    type: "Microservice",
    region: "eu-west-1",
    status: "healthy",
    cpu: 44,
    memory: 60,
    disk: 38,
    uptime: 99.95,
    ipAddress: "10.0.1.45",
    os: "Ubuntu 22.04",
    lastDeployment: "1d ago",
  },
  {
    id: "srv-004",
    name: "db-cluster-primary",
    type: "PostgreSQL",
    region: "eu-central-1",
    status: "critical",
    cpu: 89,
    memory: 92,
    disk: 71,
    uptime: 99.61,
    ipAddress: "10.0.2.10",
    os: "Debian 12",
    lastDeployment: "12h ago",
  },
  {
    id: "srv-005",
    name: "cache-redis-01",
    type: "Cache",
    region: "eu-west-1",
    status: "healthy",
    cpu: 22,
    memory: 48,
    disk: 18,
    uptime: 99.99,
    ipAddress: "10.0.3.5",
    os: "Alpine 3.18",
    lastDeployment: "3d ago",
  },
  {
    id: "srv-006",
    name: "ml-inference-gpu",
    type: "ML Inference",
    region: "us-east-1",
    status: "warning",
    cpu: 68,
    memory: 74,
    disk: 60,
    uptime: 99.78,
    ipAddress: "10.0.4.8",
    os: "Ubuntu 22.04 + CUDA",
    lastDeployment: "5h ago",
  },
];

export type IncidentSeverity = "critical" | "high" | "medium" | "low";
export type IncidentStatus = "open" | "acknowledged" | "resolved";

export interface Incident {
  id: string;
  title: string;
  description: string;
  serverId: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  createdAt: string; // ISO
  affectedComponent: string;
}

export const ALL_INCIDENTS: Incident[] = [
  {
    id: "INC-1042",
    title: "Connection pool exhaustion",
    description:
      "payment-svc-7d4 is holding 98% of available sockets. Stale TLS sessions bypassing keepalive recycler.",
    serverId: "srv-002",
    severity: "critical",
    status: "open",
    createdAt: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    affectedComponent: "payment-svc / connection-pool",
  },
  {
    id: "INC-1041",
    title: "DB cluster CPU saturation",
    description:
      "Primary node sustained CPU >85% for 22 minutes. Slow query backlog increasing.",
    serverId: "srv-004",
    severity: "high",
    status: "acknowledged",
    createdAt: new Date(Date.now() - 1000 * 60 * 47).toISOString(),
    affectedComponent: "db-cluster-primary / query-planner",
  },
  {
    id: "INC-1040",
    title: "Latency drift on checkout-api",
    description: "P99 latency drifted from 180ms to 410ms over the last hour.",
    serverId: "srv-003",
    severity: "medium",
    status: "open",
    createdAt: new Date(Date.now() - 1000 * 60 * 95).toISOString(),
    affectedComponent: "checkout-api / order-flow",
  },
  {
    id: "INC-1039",
    title: "Cache miss ratio elevated",
    description: "Redis cluster hit ratio dropped from 96% to 74%.",
    serverId: "srv-005",
    severity: "low",
    status: "resolved",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    affectedComponent: "cache-redis-01 / eviction-policy",
  },
  {
    id: "INC-1038",
    title: "Inference latency spike",
    description: "ML inference p95 latency exceeded 800ms threshold for 9 minutes.",
    serverId: "srv-006",
    severity: "high",
    status: "open",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 9).toISOString(),
    affectedComponent: "ml-inference-gpu / batch-runner",
  },
  {
    id: "INC-1037",
    title: "API gateway 5xx burst",
    description: "Brief spike of 5xx responses on api-gateway-prod (resolved automatically).",
    serverId: "srv-001",
    severity: "medium",
    status: "resolved",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 22).toISOString(),
    affectedComponent: "api-gateway-prod / upstream-healthcheck",
  },
];

/** Generate a deterministic 24h time-series for charts. */
export const generateTimeSeries = (seed: number, base: number, variance: number) => {
  const data: { t: string; value: number }[] = [];
  let v = base;
  for (let i = 0; i < 24; i++) {
    const r = Math.sin(seed + i * 0.7) * variance + (Math.cos(seed * 0.3 + i) * variance) / 2;
    v = Math.max(5, Math.min(98, base + r));
    data.push({ t: `${String(i).padStart(2, "0")}:00`, value: Math.round(v) });
  }
  return data;
};

/** Filter helpers — apply RBAC by accepted server IDs. */
export const getServersForUser = (assignedServerIds: string[]) =>
  ALL_SERVERS.filter((s) => assignedServerIds.includes(s.id));

export const getIncidentsForUser = (assignedServerIds: string[]) =>
  ALL_INCIDENTS.filter((i) => assignedServerIds.includes(i.serverId));
