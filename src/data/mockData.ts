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

// ============================================================
// Executive / NOC dashboard data
// ============================================================

export interface SiteHealth {
  id: string;
  name: string;
  region: string;
  hosts: number;
  health: number; // 0-100
  status: ServerStatus;
}

export const SITES: SiteHealth[] = [
  { id: "tn-tunis", name: "Tunis HQ", region: "TN-North", hosts: 142, health: 97, status: "healthy" },
  { id: "tn-sfax", name: "Sfax Plant", region: "TN-Center", hosts: 86, health: 88, status: "warning" },
  { id: "tn-sousse", name: "Sousse DC", region: "TN-Coast", hosts: 64, health: 99, status: "healthy" },
  { id: "tn-bizerte", name: "Bizerte Site", region: "TN-North", hosts: 38, health: 71, status: "critical" },
  { id: "fr-paris", name: "Paris Edge", region: "EU-West", hosts: 22, health: 96, status: "healthy" },
];

export interface ServiceHealth {
  id: string;
  name: string;
  category: "network" | "compute" | "storage" | "application" | "database";
  health: number;
  status: ServerStatus;
}

export const SERVICES: ServiceHealth[] = [
  { id: "svc-net-core", name: "Core Network", category: "network", health: 99, status: "healthy" },
  { id: "svc-net-edge", name: "Edge / WAN", category: "network", health: 92, status: "warning" },
  { id: "svc-erp", name: "ERP (SAP)", category: "application", health: 98, status: "healthy" },
  { id: "svc-mail", name: "Mail Platform", category: "application", health: 95, status: "healthy" },
  { id: "svc-db", name: "Database Cluster", category: "database", health: 78, status: "critical" },
  { id: "svc-storage", name: "Storage Arrays", category: "storage", health: 94, status: "healthy" },
  { id: "svc-vdi", name: "VDI Farm", category: "compute", health: 88, status: "warning" },
];

/** 24-point alert trend (per-hour count by severity) */
export const ALERT_TREND_24H = Array.from({ length: 24 }, (_, i) => {
  const noise = (s: number) => Math.max(0, Math.round(Math.sin(i * 0.6 + s) * 3 + Math.cos(i * 0.3) * 2 + s));
  return {
    t: `${String(i).padStart(2, "0")}:00`,
    critical: noise(2),
    high: noise(4),
    medium: noise(6),
    low: noise(7),
  };
});

export const CAPACITY = {
  cpu: { used: 62, total: 100 },
  memory: { used: 71, total: 100 },
  storage: { used: 58, total: 100 },
  network: { used: 44, total: 100 },
};

export const GLOBAL_KPIS = {
  totalAssets: 352,
  monitoredHosts: 308,
  monitoredServices: 124,
  activeAlerts: 17,
  slaCompliance: 99.42,
  availability: 99.87,
  mttrMinutes: 23,
  changesToday: 8,
};

/** Computes 0-100 health score from incidents + service health */
export const computeHealthScore = () => {
  const open = ALL_INCIDENTS.filter((i) => i.status !== "resolved");
  const sevPenalty: Record<IncidentSeverity, number> = { critical: 9, high: 5, medium: 2, low: 1 };
  const penalty = open.reduce((s, i) => s + sevPenalty[i.severity], 0);
  const svcAvg = SERVICES.reduce((s, x) => s + x.health, 0) / SERVICES.length;
  return Math.max(0, Math.min(100, Math.round(svcAvg - penalty)));
};

// ============================================================
// Alert Hub — extended alert model
// ============================================================

export type AlertChannel = "zabbix" | "synthetic" | "log" | "metric";

export interface AlertEvent {
  id: string;
  type: "created" | "acknowledged" | "assigned" | "escalated" | "note" | "resolved";
  at: string; // ISO
  actor: string;
  message: string;
}

export interface Alert {
  id: string;
  title: string;
  description: string;
  source: AlertChannel;
  host: string;
  service: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  assignee?: string;
  escalated: boolean;
  createdAt: string;
  updatedAt: string;
  rootCause?: string;
  timeline: AlertEvent[];
  notificationsSent: number;
}

const now = Date.now();
const iso = (mAgo: number) => new Date(now - mAgo * 60_000).toISOString();

export const ALL_ALERTS: Alert[] = [
  {
    id: "ALR-2041",
    title: "DB cluster CPU saturation",
    description: "Primary node sustained CPU >85% for 22 minutes. Slow query backlog increasing.",
    source: "zabbix",
    host: "db-cluster-primary",
    service: "Database Cluster",
    severity: "critical",
    status: "open",
    escalated: true,
    createdAt: iso(47),
    updatedAt: iso(4),
    rootCause: "Long-running analytics query on orders table holding shared locks.",
    notificationsSent: 6,
    timeline: [
      { id: "e1", type: "created", at: iso(47), actor: "Zabbix", message: "Trigger fired: CPU > 85% for 5m" },
      { id: "e2", type: "escalated", at: iso(30), actor: "policy:db-tier-1", message: "Escalated to DB on-call" },
      { id: "e3", type: "note", at: iso(12), actor: "system", message: "Slow query detected on orders.created_at index" },
    ],
  },
  {
    id: "ALR-2040",
    title: "Connection pool exhaustion",
    description: "payment-svc-7d4 holding 98% of available sockets.",
    source: "metric",
    host: "payment-svc",
    service: "ERP (SAP)",
    severity: "critical",
    status: "acknowledged",
    assignee: "K. Ben Salem",
    escalated: false,
    createdAt: iso(62),
    updatedAt: iso(18),
    notificationsSent: 3,
    timeline: [
      { id: "e1", type: "created", at: iso(62), actor: "Prometheus", message: "Pool usage above 95%" },
      { id: "e2", type: "acknowledged", at: iso(40), actor: "K. Ben Salem", message: "Investigating" },
      { id: "e3", type: "assigned", at: iso(38), actor: "K. Ben Salem", message: "Assigned to self" },
    ],
  },
  {
    id: "ALR-2039",
    title: "Edge link packet loss",
    description: "WAN link bizerte-tunis showing 3.2% packet loss.",
    source: "synthetic",
    host: "wan-bizerte-01",
    service: "Edge / WAN",
    severity: "high",
    status: "open",
    escalated: false,
    createdAt: iso(95),
    updatedAt: iso(20),
    notificationsSent: 2,
    timeline: [{ id: "e1", type: "created", at: iso(95), actor: "Smokeping", message: "Loss > 2% on 5m window" }],
  },
  {
    id: "ALR-2038",
    title: "VDI logon storm",
    description: "Logon duration p95 exceeded 14s during morning ramp.",
    source: "log",
    host: "vdi-broker-02",
    service: "VDI Farm",
    severity: "medium",
    status: "open",
    escalated: false,
    createdAt: iso(140),
    updatedAt: iso(140),
    notificationsSent: 1,
    timeline: [{ id: "e1", type: "created", at: iso(140), actor: "Citrix Director", message: "Threshold breached" }],
  },
  {
    id: "ALR-2037",
    title: "Backup job failure",
    description: "Nightly backup job FS-WAREHOUSE failed with rc=12.",
    source: "log",
    host: "backup-master",
    service: "Storage Arrays",
    severity: "high",
    status: "acknowledged",
    assignee: "M. Trabelsi",
    escalated: false,
    createdAt: iso(220),
    updatedAt: iso(180),
    notificationsSent: 2,
    timeline: [
      { id: "e1", type: "created", at: iso(220), actor: "Veeam", message: "Job FS-WAREHOUSE failed" },
      { id: "e2", type: "acknowledged", at: iso(200), actor: "M. Trabelsi", message: "Re-running with verbose" },
    ],
  },
  {
    id: "ALR-2036",
    title: "Inference latency spike",
    description: "ML inference p95 latency exceeded 800ms threshold for 9 minutes.",
    source: "metric",
    host: "ml-inference-gpu",
    service: "VDI Farm",
    severity: "medium",
    status: "open",
    escalated: false,
    createdAt: iso(540),
    updatedAt: iso(500),
    notificationsSent: 1,
    timeline: [{ id: "e1", type: "created", at: iso(540), actor: "Prometheus", message: "Latency SLO breach" }],
  },
  {
    id: "ALR-2035",
    title: "Cache miss ratio elevated",
    description: "Redis cluster hit ratio dropped from 96% to 74%.",
    source: "metric",
    host: "cache-redis-01",
    service: "Database Cluster",
    severity: "low",
    status: "resolved",
    escalated: false,
    createdAt: iso(720),
    updatedAt: iso(560),
    notificationsSent: 1,
    timeline: [
      { id: "e1", type: "created", at: iso(720), actor: "Redis Exporter", message: "Hit ratio under 80%" },
      { id: "e2", type: "resolved", at: iso(560), actor: "system", message: "Auto-resolved after warmup" },
    ],
  },
];
