// Enterprise Infrastructure Operations data model.

export type InfraEnvironment = "prod" | "uat" | "dev" | "dr";
export type InfraCriticality = "T0" | "T1" | "T2" | "T3";
export type InfraStatus = "healthy" | "warning" | "degraded" | "critical" | "maintenance" | "unknown";
export type InfraRegion = "EMEA" | "Americas" | "APAC" | "Africa";

export type ServerKind =
  | "linux" | "windows" | "vmware-vm" | "hyperv-vm"
  | "cloud-vm" | "bare-metal" | "k8s-node" | "docker-host";

export type AgentType = "zabbix-agent" | "telegraf" | "snmp" | "agentless" | "ssm" | "ossec";
export type AuthMethod = "ssh-key" | "ssh-password" | "winrm" | "iam-role" | "none";

export interface MonitoringTemplate {
  zabbix: boolean;
  logs: boolean;
  process: boolean;
  application: boolean;
  database: boolean;
  containers: boolean;
  network: boolean;
  ssl: boolean;
  security: boolean;
}

export const DEFAULT_MONITORING: MonitoringTemplate = {
  zabbix: true, logs: true, process: true, application: false,
  database: false, containers: false, network: true, ssl: false, security: false,
};

export interface ServerCredentials {
  username?: string;
  authMethod: AuthMethod;
  port?: number;
  keyRef?: string;        // pointer to vault entry
  domain?: string;        // for WinRM
}

export interface DiskMetric {
  mount: string;
  totalGb: number;
  usedGb: number;
}

export interface NicMetric {
  name: string;
  ipv4?: string;
  speedMbps: number;
  rxMbps: number;
  txMbps: number;
}

export interface ProcessInfo {
  pid: number;
  user: string;
  command: string;
  cpu: number;
  mem: number;
}

export interface ServiceInfo {
  name: string;
  state: "running" | "stopped" | "failed";
  enabled: boolean;
  uptimeSec?: number;
}

export interface InstalledApp {
  name: string;
  version: string;
  vendor?: string;
}

export interface ChangeEvent {
  id: string;
  ts: string;
  actor: string;
  kind: "config" | "patch" | "restart" | "maintenance" | "decommission" | "tag" | "ownership";
  summary: string;
}

export interface InfraLog {
  ts: string;
  level: "debug" | "info" | "warn" | "error" | "fatal";
  source: string;
  message: string;
}

export interface ServerHardware {
  cpuModel: string;
  cores: number;
  sockets: number;
  ramGb: number;
  diskGb: number;
  vendor?: string;
  model?: string;
  serial?: string;
}

export interface Server {
  id: string;
  hostname: string;
  fqdn?: string;
  ip: string;
  kind: ServerKind;
  os: string;
  osVersion: string;
  environment: InfraEnvironment;
  region: InfraRegion;
  siteId: string;
  rack?: string;
  rackUnit?: number;
  hypervisorId?: string;
  clusterId?: string;
  criticality: InfraCriticality;
  status: InfraStatus;
  uptimeSec: number;
  availability: number;   // %
  slaTarget: number;      // %
  slaActual: number;      // %
  riskScore: number;      // 0-100
  healthScore: number;    // 0-100
  cpuPct: number;
  ramPct: number;
  diskPct: number;
  ioWaitPct: number;
  loadAvg: [number, number, number];
  netRxMbps: number;
  netTxMbps: number;
  activeIncidents: number;
  businessOwner: string;
  technicalOwner: string;
  team: string;
  department: string;
  tags: string[];
  agent: AgentType;
  credentials: ServerCredentials;
  monitoring: MonitoringTemplate;
  hardware: ServerHardware;
  disks: DiskMetric[];
  nics: NicMetric[];
  services: ServiceInfo[];
  processes: ProcessInfo[];
  installed: InstalledApp[];
  linkedApps: string[];   // Application ids
  containers: { id: string; image: string; state: string }[];
  recentLogs: InfraLog[];
  changes: ChangeEvent[];
  lastSeen: string;       // ISO
  createdAt: string;
  updatedAt: string;
}

// ---- Other infra entities -------------------------------------------------

export interface Site {
  id: string;
  name: string;
  code: string;
  region: InfraRegion;
  country: string;
  city: string;
  lat: number;
  lng: number;
  tier: "Tier I" | "Tier II" | "Tier III" | "Tier IV";
  racks: number;
  servers: number;
  powerKw: number;
  status: InfraStatus;
}

export interface Hypervisor {
  id: string;
  name: string;
  type: "vmware-esxi" | "hyperv" | "kvm" | "xen";
  version: string;
  siteId: string;
  clusterId?: string;
  cpuPct: number;
  ramPct: number;
  vmCount: number;
  status: InfraStatus;
}

export interface VirtualMachine {
  id: string;
  name: string;
  hypervisorId: string;
  guestOs: string;
  vcpu: number;
  ramGb: number;
  diskGb: number;
  state: "running" | "stopped" | "suspended";
  ip?: string;
  serverId?: string;     // linked Server record
  cpuPct: number;
  ramPct: number;
}

export interface Container {
  id: string;
  name: string;
  image: string;
  hostId: string;        // serverId
  state: "running" | "exited" | "paused" | "restarting";
  cpuPct: number;
  ramMb: number;
  restartCount: number;
  createdAt: string;
}

export interface K8sCluster {
  id: string;
  name: string;
  version: string;
  provider: "eks" | "aks" | "gke" | "openshift" | "self-managed";
  nodeCount: number;
  podCount: number;
  cpuPct: number;
  ramPct: number;
  status: InfraStatus;
  region: InfraRegion;
}

export interface NetworkDevice {
  id: string;
  hostname: string;
  ip: string;
  kind: "router" | "switch" | "firewall" | "load-balancer" | "ap" | "gateway";
  vendor: string;
  model: string;
  siteId: string;
  uptimeSec: number;
  cpuPct: number;
  throughputMbps: number;
  status: InfraStatus;
}

export interface StorageArray {
  id: string;
  name: string;
  kind: "san" | "nas" | "object" | "ceph" | "filer";
  vendor: string;
  capacityTb: number;
  usedTb: number;
  iops: number;
  latencyMs: number;
  siteId: string;
  status: InfraStatus;
}

export interface DatabaseServer {
  id: string;
  name: string;
  engine: "postgres" | "mysql" | "mongodb" | "oracle" | "mssql" | "redis";
  version: string;
  serverId: string;
  port: number;
  role: "primary" | "replica" | "standalone";
  connections: number;
  qps: number;
  replicationLagMs: number;
  status: InfraStatus;
}

export interface LoadBalancer {
  id: string;
  name: string;
  kind: "haproxy" | "nginx" | "f5" | "alb" | "nlb" | "azure-lb";
  vip: string;
  backends: number;
  healthyBackends: number;
  rps: number;
  status: InfraStatus;
}

export interface CloudResource {
  id: string;
  provider: "aws" | "azure" | "gcp" | "oci";
  service: string;        // e.g. "EC2", "RDS", "S3"
  name: string;
  region: string;
  accountId: string;
  monthlyCostUsd: number;
  status: InfraStatus;
  tags: Record<string, string>;
}

export interface MaintenanceWindow {
  id: string;
  title: string;
  description: string;
  targets: string[];      // server ids
  startsAt: string;
  endsAt: string;
  state: "scheduled" | "in_progress" | "completed" | "cancelled";
  approver?: string;
  createdBy: string;
  changeTicket?: string;
}

export interface DiscoveryJob {
  id: string;
  name: string;
  kind: "ip-range" | "snmp" | "vmware" | "kubernetes" | "cloud" | "agent";
  target: string;
  schedule: string;       // cron
  lastRunAt?: string;
  lastDurationSec?: number;
  discovered: number;
  enabled: boolean;
  status: "idle" | "running" | "failed" | "ok";
}

export interface InfraPolicy {
  id: string;
  name: string;
  category: "tagging" | "monitoring" | "naming" | "patching" | "backup" | "security";
  scope: "global" | "region" | "environment" | "tier";
  scopeValue?: string;
  enforced: boolean;
  compliancePct: number;
  description: string;
}

export interface CapacityForecast {
  resource: "cpu" | "ram" | "disk" | "network";
  scope: "global" | "region" | "site" | "cluster";
  scopeValue?: string;
  currentPct: number;
  forecast30dPct: number;
  forecast90dPct: number;
  exhaustionDays?: number;
  risk: "low" | "medium" | "high";
}

export interface ServerFilters {
  search: string;
  environments: InfraEnvironment[];
  criticalities: InfraCriticality[];
  statuses: InfraStatus[];
  kinds: ServerKind[];
  regions: InfraRegion[];
  sites: string[];
  tags: string[];
}
