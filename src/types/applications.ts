// Enterprise Application Monitoring data model.
export type AppEnvironment = "prod" | "uat" | "dev";
export type AppType =
  | "web" | "api" | "database" | "batch" | "worker"
  | "scheduler" | "middleware" | "kubernetes" | "vm";
export type AppCriticality = "T0" | "T1" | "T2" | "T3";
export type AppStatus = "healthy" | "warning" | "degraded" | "critical" | "unknown";
export type AppRegion = "EMEA" | "Americas" | "APAC" | "Africa";

export interface MonitoringScope {
  infrastructure: boolean;
  cpu: boolean;
  memory: boolean;
  disk: boolean;
  network: boolean;
  availability: boolean;
  logs: boolean;
  database: boolean;
  apiLatency: boolean;
  httpStatus: boolean;
  sslExpiration: boolean;
  jobs: boolean;
  cronJobs: boolean;
  queueDepth: boolean;
  containers: boolean;
  k8sPods: boolean;
  jvm: boolean;
  processHealth: boolean;
  servicePorts: boolean;
  errorRate: boolean;
  responseTime: boolean;
  businessKpis: boolean;
}

export const DEFAULT_SCOPE: MonitoringScope = {
  infrastructure: true, cpu: true, memory: true, disk: true, network: true,
  availability: true, logs: true, database: false, apiLatency: false,
  httpStatus: false, sslExpiration: false, jobs: false, cronJobs: false,
  queueDepth: false, containers: false, k8sPods: false, jvm: false,
  processHealth: true, servicePorts: false, errorRate: true, responseTime: false,
  businessKpis: false,
};

export interface AppJob {
  id: string;
  name: string;
  schedule: string; // cron expr
  lastRun?: string;
  nextRun?: string;
  lastDurationMs?: number;
  lastStatus: "ok" | "failed" | "running" | "pending";
  retries: number;
}

export interface AppEndpoint {
  id: string;
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  path: string;
  rpm: number;
  errorRate: number;
  p95Ms: number;
  p99Ms: number;
  statusDist: { code: number; count: number }[];
}

export interface AppDbBackup {
  id: string;
  type: "full" | "incremental" | "differential";
  startedAt: string;
  durationMs: number;
  sizeMb: number;
  status: "success" | "failed" | "running";
  restoreTested?: boolean;
  restoreTestedAt?: string;
}

export interface AppDbSlowQuery {
  id: string;
  sql: string;
  avgMs: number;
  calls: number;
  lastSeen: string;
}

export interface AppDbHealth {
  id?: string;
  name: string;
  engine: "postgres" | "mysql" | "mongodb" | "oracle" | "mssql" | "redis" | "openedge";
  role?: "primary" | "replica" | "cache" | "analytics";
  uptimeDays: number;
  connections: number;
  maxConnections: number;
  slowQueries: number;
  locks: number;
  replicationLagMs: number;
  storageUsedPct: number;
  // ---- optional extended observability (back-compat) ----
  status?: AppStatus;
  cpuPct?: number;
  memoryPct?: number;
  diskIops?: number;
  latencyMs?: number;
  qps?: number;
  tps?: number;
  p95Ms?: number;
  p99Ms?: number;
  errorRate?: number;
  activeConnections?: number;
  idleConnections?: number;
  failedConnections?: number;
  deadlocks?: number;
  lockWaits?: number;
  queryErrors?: number;
  dbSizeGb?: number;
  tables?: number;
  indexes?: number;
  growthGbPerDay?: number;
  replicaStatus?: "in-sync" | "lagging" | "broken" | "n/a";
  backups?: AppDbBackup[];
  slowQueryList?: AppDbSlowQuery[];
}

export interface AppLog {
  ts: string;
  level: "debug" | "info" | "warn" | "error" | "fatal";
  source: string;
  message: string;
}

export interface AppDependency {
  appId: string;
  kind: "api" | "db" | "queue" | "service" | "infra";
  direction: "upstream" | "downstream";
}

export type AlertChannel = "email" | "slack" | "teams" | "webhook" | "zabbix";

export interface AppAlertRule {
  id: string;
  appId: string;
  name: string;
  condition: string; // human-readable e.g. "error_rate > 5% for 5m"
  severity: "info" | "warning" | "critical";
  channels: AlertChannel[];
  enabled: boolean;
  lastTriggered?: string;
}

export interface Application {
  id: string;
  name: string;
  type: AppType;
  environment: AppEnvironment;
  criticality: AppCriticality;
  status: AppStatus;
  description?: string;
  businessOwner: string;
  technicalOwner: string;
  team: string;
  department: string;
  region: AppRegion;
  slaTarget: number;       // %
  slaActual: number;       // %
  healthScore: number;     // 0-100
  riskScore: number;       // 0-100
  errorRate: number;       // %
  availability: number;    // %
  latencyP95Ms: number;
  activeIncidents: number;
  lastDeployment: string;  // ISO
  hostIds: string[];       // server / host references
  tags: string[];
  scope: MonitoringScope;
  jobs: AppJob[];
  endpoints: AppEndpoint[];
  db?: AppDbHealth;
  recentLogs: AppLog[];
  dependencies: AppDependency[];
  updatedAt: string;
}

export interface AppFilters {
  search: string;
  environments: AppEnvironment[];
  criticalities: AppCriticality[];
  statuses: AppStatus[];
  departments: string[];
  regions: AppRegion[];
  types: AppType[];
}
