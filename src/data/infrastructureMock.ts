import type {
  Server, Site, Hypervisor, VirtualMachine, Container, K8sCluster,
  NetworkDevice, StorageArray, DatabaseServer, LoadBalancer, CloudResource,
  MaintenanceWindow, DiscoveryJob, InfraPolicy, CapacityForecast,
} from "@/types/infrastructure";

const now = Date.now();
const iso = (offsetMs = 0) => new Date(now + offsetMs).toISOString();

export const SEED_SITES: Site[] = [
  { id: "site-tun", name: "Tunis Datacenter", code: "TUN-DC1", region: "Africa", country: "TN", city: "Tunis", lat: 36.81, lng: 10.18, tier: "Tier III", racks: 24, servers: 86, powerKw: 320, status: "healthy" },
  { id: "site-par", name: "Paris Edge", code: "PAR-EDGE", region: "EMEA", country: "FR", city: "Paris", lat: 48.85, lng: 2.35, tier: "Tier III", racks: 6, servers: 18, powerKw: 60, status: "healthy" },
  { id: "site-fra", name: "Frankfurt DR", code: "FRA-DR", region: "EMEA", country: "DE", city: "Frankfurt", lat: 50.11, lng: 8.68, tier: "Tier IV", racks: 12, servers: 42, powerKw: 180, status: "warning" },
  { id: "site-dub", name: "Dubai POP", code: "DXB-POP", region: "APAC", country: "AE", city: "Dubai", lat: 25.20, lng: 55.27, tier: "Tier II", racks: 3, servers: 9, powerKw: 28, status: "healthy" },
];

export const SEED_HYPERVISORS: Hypervisor[] = [
  { id: "esxi-01", name: "esxi-tun-01", type: "vmware-esxi", version: "8.0u2", siteId: "site-tun", clusterId: "cluster-prod", cpuPct: 62, ramPct: 71, vmCount: 28, status: "healthy" },
  { id: "esxi-02", name: "esxi-tun-02", type: "vmware-esxi", version: "8.0u2", siteId: "site-tun", clusterId: "cluster-prod", cpuPct: 81, ramPct: 88, vmCount: 32, status: "warning" },
  { id: "hv-fra-01", name: "hyperv-fra-01", type: "hyperv", version: "2022", siteId: "site-fra", cpuPct: 44, ramPct: 52, vmCount: 12, status: "healthy" },
];

const baseMonitoring = { zabbix: true, logs: true, process: true, application: false, database: false, containers: false, network: true, ssl: false, security: false };

function mkServer(p: Partial<Server> & Pick<Server, "id" | "hostname" | "ip" | "kind" | "os" | "siteId">): Server {
  return {
    fqdn: `${p.hostname}.poulina.tn`,
    osVersion: "—",
    environment: "prod",
    region: "Africa",
    rack: "R-01",
    rackUnit: 12,
    criticality: "T1",
    status: "healthy",
    uptimeSec: 60 * 60 * 24 * 45,
    availability: 99.94,
    slaTarget: 99.9,
    slaActual: 99.93,
    riskScore: 18,
    healthScore: 92,
    cpuPct: 32,
    ramPct: 58,
    diskPct: 47,
    ioWaitPct: 2.1,
    loadAvg: [0.42, 0.51, 0.48],
    netRxMbps: 38,
    netTxMbps: 22,
    activeIncidents: 0,
    businessOwner: "CIO Office",
    technicalOwner: "Infra Team",
    team: "Platform",
    department: "IT",
    tags: ["prod", "core"],
    agent: "zabbix-agent",
    credentials: { authMethod: "ssh-key", username: "ansible", port: 22, keyRef: "vault://infra/ssh/ansible" },
    monitoring: baseMonitoring,
    hardware: { cpuModel: "Intel Xeon Gold 6338", cores: 32, sockets: 2, ramGb: 256, diskGb: 2000, vendor: "Dell", model: "PowerEdge R750", serial: "—" },
    disks: [
      { mount: "/", totalGb: 100, usedGb: 47 },
      { mount: "/data", totalGb: 1000, usedGb: 612 },
    ],
    nics: [
      { name: "eth0", ipv4: p.ip, speedMbps: 10000, rxMbps: 38, txMbps: 22 },
    ],
    services: [
      { name: "sshd", state: "running", enabled: true, uptimeSec: 3_888_000 },
      { name: "zabbix-agent2", state: "running", enabled: true, uptimeSec: 3_888_000 },
    ],
    processes: [
      { pid: 1, user: "root", command: "/sbin/init", cpu: 0.1, mem: 0.3 },
      { pid: 1234, user: "postgres", command: "postgres -D /data", cpu: 12.4, mem: 22.1 },
    ],
    installed: [
      { name: "openssh-server", version: "9.6p1", vendor: "OpenBSD" },
      { name: "zabbix-agent2", version: "7.0.4", vendor: "Zabbix" },
    ],
    linkedApps: [],
    containers: [],
    recentLogs: [
      { ts: iso(-60_000), level: "info", source: "systemd", message: "Started Cleanup of Temporary Directories." },
      { ts: iso(-300_000), level: "warn", source: "kernel", message: "TCP: request_sock_TCP: Possible SYN flooding on port 443." },
    ],
    changes: [
      { id: "ch-001", ts: iso(-86_400_000 * 2), actor: "ali.b", kind: "patch", summary: "Applied security patches (kernel 5.15.0-118)." },
    ],
    lastSeen: iso(-30_000),
    createdAt: iso(-86_400_000 * 90),
    updatedAt: iso(-30_000),
    ...p,
  } as Server;
}

export const SEED_SERVERS: Server[] = [
  mkServer({ id: "srv-001", hostname: "sap-erp-prod-01", ip: "10.20.10.11", kind: "linux", os: "RHEL", osVersion: "9.4", criticality: "T0", tags: ["sap", "erp", "prod"], linkedApps: ["app-sap-erp"], clusterId: "cluster-prod", hypervisorId: "esxi-01", siteId: "site-tun" }),
  mkServer({ id: "srv-002", hostname: "sap-erp-prod-02", ip: "10.20.10.12", kind: "linux", os: "RHEL", osVersion: "9.4", criticality: "T0", tags: ["sap", "erp", "prod"], linkedApps: ["app-sap-erp"], clusterId: "cluster-prod", hypervisorId: "esxi-01", cpuPct: 78, ramPct: 84, status: "warning", healthScore: 68, riskScore: 42, activeIncidents: 1, siteId: "site-tun" }),
  mkServer({ id: "srv-003", hostname: "billing-api-01", ip: "10.20.20.21", kind: "linux", os: "Ubuntu", osVersion: "22.04", criticality: "T1", tags: ["billing", "api"], linkedApps: ["app-billing-api"], siteId: "site-tun" }),
  mkServer({ id: "srv-004", hostname: "portal-web-01", ip: "10.20.30.31", kind: "linux", os: "Ubuntu", osVersion: "22.04", criticality: "T1", tags: ["portal", "web"], linkedApps: ["app-customer-portal"], siteId: "site-tun" }),
  mkServer({ id: "srv-005", hostname: "pg-prod-01", ip: "10.20.40.41", kind: "linux", os: "Debian", osVersion: "12", criticality: "T0", tags: ["db", "postgres"], linkedApps: ["app-postgres"], cpuPct: 64, ramPct: 76, diskPct: 81, status: "warning", healthScore: 71, riskScore: 38, siteId: "site-tun", monitoring: { ...baseMonitoring, database: true } }),
  mkServer({ id: "srv-006", hostname: "ad-dc-01", ip: "10.20.50.51", kind: "windows", os: "Windows Server", osVersion: "2022", criticality: "T0", tags: ["ad", "identity"], linkedApps: ["app-auth"], siteId: "site-tun", agent: "zabbix-agent", credentials: { authMethod: "winrm", username: "svc_zabbix", port: 5986, domain: "POULINA" } }),
  mkServer({ id: "srv-007", hostname: "hr-app-01", ip: "10.20.60.61", kind: "linux", os: "Ubuntu", osVersion: "20.04", criticality: "T2", tags: ["hr"], linkedApps: ["app-hr"], cpuPct: 88, ramPct: 92, status: "degraded", healthScore: 48, riskScore: 71, activeIncidents: 2, siteId: "site-par" }),
  mkServer({ id: "srv-008", hostname: "k8s-node-01", ip: "10.30.10.11", kind: "k8s-node", os: "Talos", osVersion: "1.7", criticality: "T1", tags: ["k8s", "node"], siteId: "site-tun", monitoring: { ...baseMonitoring, containers: true } }),
  mkServer({ id: "srv-009", hostname: "k8s-node-02", ip: "10.30.10.12", kind: "k8s-node", os: "Talos", osVersion: "1.7", criticality: "T1", tags: ["k8s", "node"], siteId: "site-tun", monitoring: { ...baseMonitoring, containers: true } }),
  mkServer({ id: "srv-010", hostname: "docker-host-01", ip: "10.30.20.21", kind: "docker-host", os: "Ubuntu", osVersion: "22.04", criticality: "T2", tags: ["docker"], siteId: "site-tun", monitoring: { ...baseMonitoring, containers: true } }),
  mkServer({ id: "srv-011", hostname: "edge-cdn-par-01", ip: "10.40.10.11", kind: "cloud-vm", os: "Alpine", osVersion: "3.20", criticality: "T2", tags: ["edge", "cdn"], region: "EMEA", siteId: "site-par" }),
  mkServer({ id: "srv-012", hostname: "dr-replica-01", ip: "10.50.10.11", kind: "vmware-vm", os: "RHEL", osVersion: "9.4", criticality: "T1", tags: ["dr", "replica"], environment: "dr", region: "EMEA", siteId: "site-fra", status: "maintenance" }),
];

export const SEED_VMS: VirtualMachine[] = [
  { id: "vm-001", name: "sap-erp-prod-01", hypervisorId: "esxi-01", guestOs: "RHEL 9.4", vcpu: 16, ramGb: 64, diskGb: 500, state: "running", ip: "10.20.10.11", serverId: "srv-001", cpuPct: 32, ramPct: 58 },
  { id: "vm-002", name: "sap-erp-prod-02", hypervisorId: "esxi-01", guestOs: "RHEL 9.4", vcpu: 16, ramGb: 64, diskGb: 500, state: "running", ip: "10.20.10.12", serverId: "srv-002", cpuPct: 78, ramPct: 84 },
  { id: "vm-003", name: "billing-api-01", hypervisorId: "esxi-02", guestOs: "Ubuntu 22.04", vcpu: 8, ramGb: 32, diskGb: 200, state: "running", ip: "10.20.20.21", serverId: "srv-003", cpuPct: 41, ramPct: 62 },
  { id: "vm-004", name: "dr-replica-01", hypervisorId: "hv-fra-01", guestOs: "RHEL 9.4", vcpu: 8, ramGb: 32, diskGb: 500, state: "suspended", ip: "10.50.10.11", serverId: "srv-012", cpuPct: 0, ramPct: 0 },
];

export const SEED_CONTAINERS: Container[] = [
  { id: "c-001", name: "billing-api", image: "registry/billing-api:1.42.0", hostId: "srv-010", state: "running", cpuPct: 22, ramMb: 412, restartCount: 0, createdAt: iso(-86_400_000) },
  { id: "c-002", name: "portal-web", image: "registry/portal-web:2.8.1", hostId: "srv-010", state: "running", cpuPct: 18, ramMb: 286, restartCount: 0, createdAt: iso(-3_600_000) },
  { id: "c-003", name: "redis-cache", image: "redis:7.2-alpine", hostId: "srv-010", state: "running", cpuPct: 3, ramMb: 64, restartCount: 2, createdAt: iso(-43_200_000) },
];

export const SEED_K8S: K8sCluster[] = [
  { id: "k8s-prod", name: "prod-cluster", version: "1.30.2", provider: "self-managed", nodeCount: 6, podCount: 142, cpuPct: 58, ramPct: 64, status: "healthy", region: "Africa" },
  { id: "k8s-stg", name: "staging-cluster", version: "1.30.2", provider: "eks", nodeCount: 3, podCount: 48, cpuPct: 31, ramPct: 42, status: "healthy", region: "EMEA" },
];

export const SEED_NETWORK: NetworkDevice[] = [
  { id: "net-001", hostname: "core-sw-01", ip: "10.0.0.1", kind: "switch", vendor: "Cisco", model: "C9500-48Y4C", siteId: "site-tun", uptimeSec: 86_400 * 240, cpuPct: 22, throughputMbps: 1820, status: "healthy" },
  { id: "net-002", hostname: "edge-fw-01", ip: "10.0.0.2", kind: "firewall", vendor: "Fortinet", model: "FG-200F", siteId: "site-tun", uptimeSec: 86_400 * 180, cpuPct: 38, throughputMbps: 920, status: "warning" },
  { id: "net-003", hostname: "router-par-01", ip: "10.40.0.1", kind: "router", vendor: "Juniper", model: "MX204", siteId: "site-par", uptimeSec: 86_400 * 120, cpuPct: 18, throughputMbps: 480, status: "healthy" },
];

export const SEED_STORAGE: StorageArray[] = [
  { id: "sto-001", name: "tun-san-01", kind: "san", vendor: "Pure Storage", capacityTb: 240, usedTb: 168, iops: 142_000, latencyMs: 1.2, siteId: "site-tun", status: "healthy" },
  { id: "sto-002", name: "tun-nas-01", kind: "nas", vendor: "NetApp", capacityTb: 120, usedTb: 96, iops: 28_000, latencyMs: 4.8, siteId: "site-tun", status: "warning" },
  { id: "sto-003", name: "fra-object-01", kind: "object", vendor: "MinIO", capacityTb: 480, usedTb: 132, iops: 9_400, latencyMs: 12.4, siteId: "site-fra", status: "healthy" },
];

export const SEED_DATABASES: DatabaseServer[] = [
  { id: "db-001", name: "pg-prod-01", engine: "postgres", version: "16.3", serverId: "srv-005", port: 5432, role: "primary", connections: 184, qps: 4_280, replicationLagMs: 12, status: "healthy" },
  { id: "db-002", name: "pg-prod-02", engine: "postgres", version: "16.3", serverId: "srv-005", port: 5432, role: "replica", connections: 92, qps: 1_840, replicationLagMs: 28, status: "healthy" },
  { id: "db-003", name: "mongo-cluster", engine: "mongodb", version: "7.0", serverId: "srv-003", port: 27017, role: "primary", connections: 64, qps: 980, replicationLagMs: 0, status: "warning" },
];

export const SEED_LBS: LoadBalancer[] = [
  { id: "lb-001", name: "edge-haproxy", kind: "haproxy", vip: "10.0.0.100", backends: 8, healthyBackends: 8, rps: 4_280, status: "healthy" },
  { id: "lb-002", name: "api-nginx", kind: "nginx", vip: "10.0.0.101", backends: 6, healthyBackends: 5, rps: 1_820, status: "warning" },
];

export const SEED_CLOUD: CloudResource[] = [
  { id: "cl-001", provider: "aws", service: "EC2", name: "edge-cdn-par-01", region: "eu-west-3", accountId: "1234-acc", monthlyCostUsd: 142, status: "healthy", tags: { env: "prod", owner: "platform" } },
  { id: "cl-002", provider: "aws", service: "S3", name: "poulina-backups", region: "eu-west-3", accountId: "1234-acc", monthlyCostUsd: 412, status: "healthy", tags: { env: "prod", owner: "infra" } },
  { id: "cl-003", provider: "azure", service: "VM", name: "dr-replica-01", region: "germanywestcentral", accountId: "azr-poulina", monthlyCostUsd: 286, status: "warning", tags: { env: "dr", owner: "infra" } },
];

export const SEED_MAINTENANCE: MaintenanceWindow[] = [
  { id: "mw-001", title: "Kernel patching wave 24-Q2", description: "Apply CVE-2024-XXXX kernel patches across SAP cluster.", targets: ["srv-001", "srv-002"], startsAt: iso(86_400_000 * 3), endsAt: iso(86_400_000 * 3 + 7_200_000), state: "scheduled", approver: "cio.office", createdBy: "ali.b", changeTicket: "CHG-1042" },
  { id: "mw-002", title: "DR failover drill", description: "Quarterly DR test — Frankfurt site.", targets: ["srv-012"], startsAt: iso(-86_400_000), endsAt: iso(-43_200_000), state: "completed", createdBy: "infra.ops" },
];

export const SEED_DISCOVERY: DiscoveryJob[] = [
  { id: "disc-001", name: "Tunis /16 sweep", kind: "ip-range", target: "10.20.0.0/16", schedule: "0 */6 * * *", lastRunAt: iso(-1_800_000), lastDurationSec: 142, discovered: 86, enabled: true, status: "ok" },
  { id: "disc-002", name: "VMware vCenter sync", kind: "vmware", target: "vcenter.poulina.tn", schedule: "*/15 * * * *", lastRunAt: iso(-600_000), lastDurationSec: 38, discovered: 72, enabled: true, status: "ok" },
  { id: "disc-003", name: "Kubernetes node discovery", kind: "kubernetes", target: "prod-cluster", schedule: "*/10 * * * *", lastRunAt: iso(-300_000), lastDurationSec: 12, discovered: 6, enabled: true, status: "ok" },
  { id: "disc-004", name: "AWS account inventory", kind: "cloud", target: "aws://1234-acc", schedule: "0 2 * * *", lastRunAt: iso(-3_600_000 * 4), lastDurationSec: 412, discovered: 218, enabled: true, status: "ok" },
];

export const SEED_POLICIES: InfraPolicy[] = [
  { id: "pol-001", name: "All prod must carry owner tag", category: "tagging", scope: "environment", scopeValue: "prod", enforced: true, compliancePct: 94, description: "Every production server must have a `businessOwner` and `technicalOwner` tag." },
  { id: "pol-002", name: "Zabbix monitoring required", category: "monitoring", scope: "global", enforced: true, compliancePct: 98, description: "Every onboarded server must have the Zabbix agent enabled." },
  { id: "pol-003", name: "T0 patching SLA = 7 days", category: "patching", scope: "tier", scopeValue: "T0", enforced: true, compliancePct: 88, description: "Critical-tier servers must apply security patches within 7 days." },
  { id: "pol-004", name: "Daily backup required", category: "backup", scope: "tier", scopeValue: "T0", enforced: true, compliancePct: 100, description: "All T0 systems must have a verified daily backup." },
];

export const SEED_CAPACITY: CapacityForecast[] = [
  { resource: "cpu", scope: "site", scopeValue: "site-tun", currentPct: 58, forecast30dPct: 67, forecast90dPct: 81, exhaustionDays: 142, risk: "medium" },
  { resource: "ram", scope: "site", scopeValue: "site-tun", currentPct: 71, forecast30dPct: 79, forecast90dPct: 92, exhaustionDays: 86, risk: "high" },
  { resource: "disk", scope: "site", scopeValue: "site-tun", currentPct: 64, forecast30dPct: 72, forecast90dPct: 88, exhaustionDays: 108, risk: "medium" },
  { resource: "cpu", scope: "site", scopeValue: "site-fra", currentPct: 42, forecast30dPct: 48, forecast90dPct: 58, risk: "low" },
  { resource: "disk", scope: "cluster", scopeValue: "k8s-prod", currentPct: 81, forecast30dPct: 89, forecast90dPct: 96, exhaustionDays: 42, risk: "high" },
];
