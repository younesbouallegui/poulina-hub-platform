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

/* ============================================================
 * UNIFIED ALERT CENTER — enterprise alert entities
 * Sourced (mock) from Zabbix; normalized into platform model.
 * ============================================================ */

export type AlertSeverity = "critical" | "high" | "medium" | "low" | "info";
export type AlertStatus = "firing" | "acknowledged" | "muted" | "resolved";
export type AlertSource = "zabbix" | "platform" | "synthetic";

export interface Alert {
  id: string;
  /** External ID from upstream system (e.g. Zabbix eventid) */
  externalId: string;
  source: AlertSource;
  title: string;
  description: string;
  serverId: string;
  /** Trigger / metric path */
  trigger: string;
  severity: AlertSeverity;
  status: AlertStatus;
  /** ISO timestamp */
  firedAt: string;
  /** ISO timestamp, optional */
  resolvedAt?: string;
  ackBy?: string;
  /** Correlation group id, if part of one */
  groupId?: string;
  /** Number of times this alert has fired in the last 24h (dedup count) */
  count: number;
  tags: string[];
}

export interface AlertGroup {
  id: string;
  title: string;
  rootCause: string;
  serverIds: string[];
  alertIds: string[];
  severity: AlertSeverity;
  firstSeen: string;
}

export interface OnCallShift {
  id: string;
  team: string;
  user: string;
  initials: string;
  startsAt: string;
  endsAt: string;
  primary: boolean;
}

export interface AuditEntry {
  id: string;
  at: string;
  actor: string;
  action: string;
  target: string;
}

const minsAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

export const ALL_ALERTS: Alert[] = [
  {
    id: "ALR-9001",
    externalId: "zbx-58812",
    source: "zabbix",
    title: "Connection pool exhaustion",
    description: "payment-svc-7d4 holding 98% of available sockets.",
    serverId: "srv-002",
    trigger: "net.tcp.listen[pool] > 95%",
    severity: "critical",
    status: "firing",
    firedAt: minsAgo(4),
    groupId: "GRP-301",
    count: 12,
    tags: ["prod", "payments", "network"],
  },
  {
    id: "ALR-9002",
    externalId: "zbx-58813",
    source: "zabbix",
    title: "Upstream timeouts on payment-svc",
    description: "Gateway recording 5xx burst from payment-svc upstream.",
    serverId: "srv-001",
    trigger: "http.5xx_rate > 2%",
    severity: "high",
    status: "firing",
    firedAt: minsAgo(3),
    groupId: "GRP-301",
    count: 7,
    tags: ["prod", "gateway"],
  },
  {
    id: "ALR-9003",
    externalId: "zbx-58801",
    source: "zabbix",
    title: "DB primary CPU saturation",
    description: "Primary node sustained CPU >85% for 22 minutes.",
    serverId: "srv-004",
    trigger: "system.cpu.util > 85%",
    severity: "high",
    status: "acknowledged",
    firedAt: minsAgo(47),
    ackBy: "operator@poulina.com",
    count: 1,
    tags: ["prod", "database"],
  },
  {
    id: "ALR-9004",
    externalId: "zbx-58790",
    source: "zabbix",
    title: "Latency drift on checkout-api",
    description: "P99 latency drifted from 180ms to 410ms.",
    serverId: "srv-003",
    trigger: "http.latency.p99 > 400ms",
    severity: "medium",
    status: "firing",
    firedAt: minsAgo(95),
    count: 3,
    tags: ["prod", "checkout"],
  },
  {
    id: "ALR-9005",
    externalId: "zbx-58772",
    source: "zabbix",
    title: "Inference latency spike",
    description: "ML inference p95 exceeded 800ms threshold.",
    serverId: "srv-006",
    trigger: "ml.latency.p95 > 800ms",
    severity: "high",
    status: "firing",
    firedAt: minsAgo(160),
    count: 5,
    tags: ["ml", "gpu"],
  },
  {
    id: "ALR-9006",
    externalId: "zbx-58755",
    source: "zabbix",
    title: "Cache miss ratio elevated",
    description: "Redis cluster hit ratio dropped from 96% to 74%.",
    serverId: "srv-005",
    trigger: "cache.hit_ratio < 80%",
    severity: "low",
    status: "muted",
    firedAt: minsAgo(310),
    count: 2,
    tags: ["cache"],
  },
  {
    id: "ALR-9007",
    externalId: "zbx-58740",
    source: "zabbix",
    title: "API gateway 5xx burst",
    description: "Brief spike of 5xx responses on api-gateway-prod.",
    serverId: "srv-001",
    trigger: "http.5xx_rate > 1%",
    severity: "medium",
    status: "resolved",
    firedAt: minsAgo(1320),
    resolvedAt: minsAgo(1280),
    count: 1,
    tags: ["gateway"],
  },
  {
    id: "ALR-9008",
    externalId: "zbx-58821",
    source: "platform",
    title: "Disk pressure on db-cluster-primary",
    description: "Disk utilization trending toward 80%.",
    serverId: "srv-004",
    trigger: "vfs.fs.used > 75%",
    severity: "medium",
    status: "firing",
    firedAt: minsAgo(22),
    count: 1,
    tags: ["prod", "database", "capacity"],
  },
];

export const ALL_ALERT_GROUPS: AlertGroup[] = [
  {
    id: "GRP-301",
    title: "Payment service degradation",
    rootCause:
      "Connection pool exhaustion on payment-svc cascading into upstream timeouts at api-gateway-prod.",
    serverIds: ["srv-002", "srv-001"],
    alertIds: ["ALR-9001", "ALR-9002"],
    severity: "critical",
    firstSeen: minsAgo(5),
  },
];

export const ALL_ONCALL: OnCallShift[] = [
  {
    id: "OC-1",
    team: "Platform · Primary",
    user: "Sami Ben Ali",
    initials: "SB",
    startsAt: minsAgo(120),
    endsAt: new Date(Date.now() + 1000 * 60 * 60 * 6).toISOString(),
    primary: true,
  },
  {
    id: "OC-2",
    team: "Platform · Secondary",
    user: "Leïla Trabelsi",
    initials: "LT",
    startsAt: minsAgo(120),
    endsAt: new Date(Date.now() + 1000 * 60 * 60 * 6).toISOString(),
    primary: false,
  },
  {
    id: "OC-3",
    team: "Database",
    user: "Mehdi Khelifi",
    initials: "MK",
    startsAt: minsAgo(60),
    endsAt: new Date(Date.now() + 1000 * 60 * 60 * 11).toISOString(),
    primary: true,
  },
];

export const ALL_AUDIT: AuditEntry[] = [
  { id: "A-1", at: minsAgo(2), actor: "operator@poulina.com", action: "acknowledged", target: "ALR-9003" },
  { id: "A-2", at: minsAgo(14), actor: "system", action: "deduplicated", target: "ALR-9001 ×12" },
  { id: "A-3", at: minsAgo(40), actor: "admin@poulina.com", action: "muted", target: "ALR-9006" },
  { id: "A-4", at: minsAgo(180), actor: "system", action: "auto-resolved", target: "ALR-9007" },
];

export const getAlertsForUser = (assignedServerIds: string[]) =>
  ALL_ALERTS.filter((a) => assignedServerIds.includes(a.serverId));

export const getAlertGroupsForUser = (assignedServerIds: string[]) =>
  ALL_ALERT_GROUPS.filter((g) => g.serverIds.some((s) => assignedServerIds.includes(s)));
