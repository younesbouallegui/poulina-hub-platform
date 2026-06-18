// Deterministic per-server enrichment used by the enterprise server cockpit.
// Pure functions — no persistence, derived from the Server.id seed so the UI
// stays stable between renders and reflects the same posture in aggregates.
import type { Server } from "@/types/infrastructure";

export type AgentHealth = "healthy" | "warning" | "critical" | "unknown";

export interface ZabbixAgentStatus {
  state: "online" | "offline";
  lastCheckIn: string;
  version: string;
  mode: "active" | "passive";
  latencyMs: number;
  availability7d: number;
  health: AgentHealth;
}

export interface AiAgentStatus {
  state: "online" | "offline";
  lastHeartbeat: string;
  version: string;
  model: string;
  automation: "autonomous" | "supervised" | "off";
  learning: "active" | "idle" | "paused";
  knowledgeSync: "in-sync" | "syncing" | "stale";
  confidence: number; // 0-100
  health: AgentHealth;
}

export type AppServerKind =
  | "Tomcat" | "WildFly" | "JBoss" | "WebLogic" | "WebSphere"
  | "Nginx" | "Apache HTTPD" | "NodeJS" | "Python Service"
  | "FastAPI" | "Spring Boot" | ".NET Application";

export interface AppServerProcess {
  name: string;
  kind: AppServerKind;
  state: "running" | "degraded" | "stopped";
  availability: number;
  responseMs: number;
  errorRate: number;
  sessions: number;
  rps: number;
  cpuPct: number;
  memPct: number;
  port: number;
}

export interface OpenEdgeStatus {
  present: boolean;
  dbAvailable: boolean;
  brokerState: "running" | "stopped" | "degraded";
  sessions: number;
  users: number;
  txPerSec: number;
  lockWaits: number;
  replicationState: "in-sync" | "lagging" | "failed" | "n/a";
  replicationLagMs: number;
  storageUsedPct: number;
  growthGbPerDay: number;
  recentErrors: number;
  healthScore: number;
}

export interface AiOpsRecord {
  id: string;
  ts: string;
  kind: "auto-remediate" | "investigation" | "learned" | "recommendation";
  title: string;
  outcome: "success" | "failure" | "pending";
  confidence: number;
}

export interface DependencyGraph {
  apps: string[];
  databases: { id: string; name: string; engine: string }[];
  businessServices: string[];
  peerServers: { id: string; hostname: string }[];
  loadBalancers: string[];
  containers: { id: string; image: string }[];
  k8sNodes: string[];
}

// --- deterministic helpers -------------------------------------------------

function hash(id: string) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}
function pick<T>(arr: readonly T[], seed: number) { return arr[seed % arr.length]; }
function between(seed: number, min: number, max: number) {
  return min + (seed % 1000) / 1000 * (max - min);
}

const ZBX_VERSIONS = ["7.0.4", "7.0.3", "6.4.18", "6.4.16"];
const AI_VERSIONS = ["aiops-1.8.2", "aiops-1.8.1", "aiops-1.7.9"];
const AI_MODELS = ["gemini-3-flash", "gpt-oss-mid", "claude-haiku", "llama-3.1-70b"];

export function zabbixAgent(srv: Server): ZabbixAgentStatus {
  const h = hash(srv.id + "zbx");
  const offline = srv.status === "critical" || (srv.status === "maintenance" && h % 3 === 0);
  const latency = Math.round(between(h, 8, 180));
  const avail = Math.max(80, 100 - between(h, 0.1, 8));
  const health: AgentHealth =
    offline ? "critical" :
    srv.status === "maintenance" ? "unknown" :
    latency > 120 || avail < 95 ? "warning" : "healthy";
  return {
    state: offline ? "offline" : "online",
    lastCheckIn: new Date(Date.now() - (offline ? 1000 * 60 * 12 : (h % 60) * 1000)).toISOString(),
    version: pick(ZBX_VERSIONS, h),
    mode: h % 2 === 0 ? "active" : "passive",
    latencyMs: latency,
    availability7d: Math.round(avail * 100) / 100,
    health,
  };
}

export function aiAgent(srv: Server): AiAgentStatus {
  const h = hash(srv.id + "ai");
  const offline = srv.status === "critical" && h % 4 === 0;
  const conf = Math.round(between(h, 62, 97));
  const sync: AiAgentStatus["knowledgeSync"] =
    h % 7 === 0 ? "stale" : h % 5 === 0 ? "syncing" : "in-sync";
  const health: AgentHealth =
    offline ? "critical" :
    srv.status === "maintenance" ? "unknown" :
    sync === "stale" || conf < 70 ? "warning" : "healthy";
  return {
    state: offline ? "offline" : "online",
    lastHeartbeat: new Date(Date.now() - (offline ? 1000 * 60 * 8 : (h % 45) * 1000)).toISOString(),
    version: pick(AI_VERSIONS, h),
    model: pick(AI_MODELS, h),
    automation: srv.criticality === "T0" ? "supervised" : pick(["autonomous", "supervised", "off"] as const, h),
    learning: h % 6 === 0 ? "paused" : h % 3 === 0 ? "idle" : "active",
    knowledgeSync: sync,
    confidence: conf,
    health,
  };
}

const APP_TEMPLATES: Record<string, AppServerKind[]> = {
  web: ["Nginx", "Apache HTTPD", "NodeJS"],
  api: ["Spring Boot", "FastAPI", "NodeJS"],
  erp: ["WebLogic", "Tomcat", "WildFly"],
  hr: ["Tomcat", "JBoss"],
  portal: ["Nginx", "NodeJS", "Spring Boot"],
  billing: ["Spring Boot", "NodeJS"],
  edge: ["Nginx"],
  k8s: ["NodeJS", "FastAPI"],
  docker: ["NodeJS", "Python Service"],
  ad: [".NET Application"],
};

export function appServers(srv: Server): AppServerProcess[] {
  const tags = srv.tags;
  const kinds = new Set<AppServerKind>();
  tags.forEach((t) => APP_TEMPLATES[t]?.forEach((k) => kinds.add(k)));
  if (kinds.size === 0 && !srv.tags.includes("db")) kinds.add("Nginx");
  const h0 = hash(srv.id);
  return Array.from(kinds).slice(0, 4).map((kind, i) => {
    const h = hash(srv.id + kind + i);
    const stressed = srv.cpuPct > 75 || srv.ramPct > 80;
    return {
      name: `${kind.toLowerCase().replace(/[^a-z]/g, "")}-${(h0 % 90) + 10}`,
      kind,
      state: srv.status === "critical" ? "stopped" : stressed && i === 0 ? "degraded" : "running",
      availability: Math.round((99.99 - between(h, 0.01, 1.4)) * 100) / 100,
      responseMs: Math.round(between(h, 18, stressed ? 480 : 220)),
      errorRate: Math.round(between(h, 0.01, stressed ? 4.8 : 1.2) * 100) / 100,
      sessions: Math.round(between(h, 12, 1200)),
      rps: Math.round(between(h, 4, 820)),
      cpuPct: Math.round(between(h, 4, Math.min(95, srv.cpuPct + 12))),
      memPct: Math.round(between(h, 8, Math.min(96, srv.ramPct + 8))),
      port: 8000 + (h % 1000),
    };
  });
}

export function openEdge(srv: Server): OpenEdgeStatus {
  const present = srv.tags.some((t) => ["db", "erp", "billing", "hr"].includes(t));
  if (!present) {
    return {
      present: false, dbAvailable: false, brokerState: "stopped",
      sessions: 0, users: 0, txPerSec: 0, lockWaits: 0,
      replicationState: "n/a", replicationLagMs: 0,
      storageUsedPct: 0, growthGbPerDay: 0, recentErrors: 0, healthScore: 0,
    };
  }
  const h = hash(srv.id + "oe");
  const broker: OpenEdgeStatus["brokerState"] = srv.status === "critical" ? "stopped" : srv.cpuPct > 80 ? "degraded" : "running";
  const lockWaits = Math.round(between(h, 0, srv.cpuPct > 70 ? 84 : 18));
  const lag = Math.round(between(h, 4, srv.status === "warning" ? 1800 : 240));
  const repl: OpenEdgeStatus["replicationState"] = lag > 1500 ? "lagging" : srv.status === "critical" ? "failed" : "in-sync";
  const errors = Math.round(between(h, 0, srv.status === "healthy" ? 2 : 12));
  const score = Math.max(0, 100 - (broker !== "running" ? 30 : 0) - lockWaits * 0.4 - errors * 3 - (repl === "lagging" ? 12 : repl === "failed" ? 35 : 0));
  return {
    present: true,
    dbAvailable: broker !== "stopped",
    brokerState: broker,
    sessions: Math.round(between(h, 24, 720)),
    users: Math.round(between(h, 8, 280)),
    txPerSec: Math.round(between(h, 40, 3200)),
    lockWaits,
    replicationState: repl,
    replicationLagMs: lag,
    storageUsedPct: Math.round(between(h, 28, 92)),
    growthGbPerDay: Math.round(between(h, 0.4, 12) * 10) / 10,
    recentErrors: errors,
    healthScore: Math.round(score),
  };
}

export function aiOpsHistory(srv: Server): AiOpsRecord[] {
  const h = hash(srv.id + "hist");
  const seed = (n: number) => hash(srv.id + "h" + n);
  const tpl: Array<Pick<AiOpsRecord, "kind" | "title" | "outcome">> = [
    { kind: "auto-remediate", title: "Cleared /var/log overflow", outcome: "success" },
    { kind: "investigation", title: "Investigated 5xx spike on API tier", outcome: "success" },
    { kind: "learned", title: "Learned new memory leak signature", outcome: "success" },
    { kind: "recommendation", title: "Scale-out advisor: add 1 replica", outcome: "pending" },
    { kind: "auto-remediate", title: "Restarted failed nginx worker", outcome: srv.status === "critical" ? "failure" : "success" },
    { kind: "investigation", title: "Correlated DB latency with broker lock waits", outcome: "success" },
  ];
  return tpl.slice(0, 4 + (h % 3)).map((t, i) => ({
    id: `aio-${srv.id}-${i}`,
    ts: new Date(Date.now() - (i + 1) * 3_600_000 - (seed(i) % 86_400) * 1000).toISOString(),
    confidence: 60 + (seed(i) % 38),
    ...t,
  }));
}

export function dependencyGraph(srv: Server, all: Server[]): DependencyGraph {
  const peers = all.filter((s) => s.id !== srv.id && (
    s.linkedApps.some((a) => srv.linkedApps.includes(a)) || s.clusterId && s.clusterId === srv.clusterId
  )).slice(0, 6).map((s) => ({ id: s.id, hostname: s.hostname }));
  const apps = appServers(srv);
  const oe = openEdge(srv);
  return {
    apps: srv.linkedApps,
    databases: [
      ...(srv.tags.includes("db") ? [{ id: "db-local", name: srv.hostname, engine: "postgres" }] : []),
      ...(oe.present ? [{ id: "oe-local", name: `${srv.hostname}-oe`, engine: "openedge" }] : []),
    ],
    businessServices: srv.linkedApps.map((a) => a.replace(/^app-/, "Service: ")),
    peerServers: peers,
    loadBalancers: apps.some((a) => a.kind === "Nginx" || a.kind === "Apache HTTPD") ? ["edge-haproxy", "api-nginx"] : [],
    containers: srv.containers.map((c) => ({ id: c.id, image: c.image })),
    k8sNodes: srv.kind === "k8s-node" ? [srv.hostname] : [],
  };
}

export interface CockpitScores {
  server: number;
  application: number;
  database: number;
  overallRisk: "low" | "medium" | "high";
}
export function cockpitScores(srv: Server): CockpitScores {
  const apps = appServers(srv);
  const oe = openEdge(srv);
  const appScore = apps.length
    ? Math.round(apps.reduce((a, p) => a + (p.state === "running" ? 100 - p.errorRate * 4 - Math.max(0, p.responseMs - 200) * 0.1 : p.state === "degraded" ? 60 : 20), 0) / apps.length)
    : srv.healthScore;
  const dbScore = oe.present ? oe.healthScore : srv.tags.includes("db") ? Math.max(0, 100 - srv.diskPct * 0.4 - srv.ioWaitPct * 1.5) : srv.healthScore;
  const overall = (srv.healthScore + appScore + dbScore) / 3;
  return {
    server: srv.healthScore,
    application: Math.max(0, Math.min(100, appScore)),
    database: Math.round(Math.max(0, Math.min(100, dbScore))),
    overallRisk: overall > 80 ? "low" : overall > 60 ? "medium" : "high",
  };
}

// --- fleet-level aggregation for the executive cockpit ---------------------

export interface FleetAgentPosture {
  zabbixOnline: number;
  zabbixOffline: number;
  aiOnline: number;
  aiOffline: number;
  agentFailures: number;
  appServerAvailability: number;
  openEdgeAvailability: number;
  topCritical: { id: string; hostname: string; score: number }[];
}
export function fleetAgentPosture(servers: Server[]): FleetAgentPosture {
  let zOn = 0, zOff = 0, aOn = 0, aOff = 0, failures = 0;
  let appAvailSum = 0, appAvailN = 0;
  let oeAvailN = 0, oeAvailSum = 0;
  const critical: { id: string; hostname: string; score: number }[] = [];
  for (const s of servers) {
    const z = zabbixAgent(s);
    const a = aiAgent(s);
    if (z.state === "online") zOn++; else { zOff++; failures++; }
    if (a.state === "online") aOn++; else { aOff++; failures++; }
    const apps = appServers(s);
    if (apps.length) {
      appAvailSum += apps.reduce((x, p) => x + p.availability, 0) / apps.length;
      appAvailN++;
    }
    const oe = openEdge(s);
    if (oe.present) { oeAvailSum += oe.dbAvailable ? oe.healthScore : 0; oeAvailN++; }
    const sc = cockpitScores(s);
    critical.push({ id: s.id, hostname: s.hostname, score: sc.server });
  }
  critical.sort((a, b) => a.score - b.score);
  return {
    zabbixOnline: zOn, zabbixOffline: zOff,
    aiOnline: aOn, aiOffline: aOff,
    agentFailures: failures,
    appServerAvailability: appAvailN ? Math.round((appAvailSum / appAvailN) * 100) / 100 : 100,
    openEdgeAvailability: oeAvailN ? Math.round((oeAvailSum / oeAvailN) * 100) / 100 : 100,
    topCritical: critical.slice(0, 5),
  };
}
