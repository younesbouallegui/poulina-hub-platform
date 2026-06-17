import type { Application, AppDbHealth, AppDbBackup, AppDbSlowQuery, AppStatus } from "@/types/applications";

// Deterministic pseudo-random based on a string seed so values are stable
// across renders but vary per database/app.
function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}
function rng(seed: string) {
  let s = hash(seed) || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}
const between = (r: () => number, a: number, b: number) => a + r() * (b - a);

function statusFor(cpu: number, err: number, lag: number): AppStatus {
  if (err > 4 || cpu > 92 || lag > 8000) return "critical";
  if (err > 2 || cpu > 80 || lag > 3000) return "degraded";
  if (err > 1 || cpu > 70) return "warning";
  return "healthy";
}

function mkBackups(seed: string): AppDbBackup[] {
  const r = rng(seed + ":backup");
  const out: AppDbBackup[] = [];
  for (let i = 0; i < 6; i++) {
    const ageHrs = i * 24 + Math.floor(between(r, 0, 6));
    const failed = i === 2 && r() > 0.6;
    out.push({
      id: `${seed}-bk-${i}`,
      type: i % 7 === 0 ? "full" : i % 3 === 0 ? "differential" : "incremental",
      startedAt: new Date(Date.now() - ageHrs * 3600_000).toISOString(),
      durationMs: Math.round(between(r, 30_000, 900_000)),
      sizeMb: Math.round(between(r, 200, 18_000)),
      status: failed ? "failed" : "success",
      restoreTested: i === 0 ? r() > 0.5 : undefined,
      restoreTestedAt: i === 0 ? new Date(Date.now() - 6 * 3600_000).toISOString() : undefined,
    });
  }
  return out;
}

function mkSlow(seed: string): AppDbSlowQuery[] {
  const r = rng(seed + ":slow");
  const samples = [
    "SELECT * FROM invoices WHERE customer_id = $1 ORDER BY created_at DESC",
    "UPDATE orders SET status = $1 WHERE id = ANY($2)",
    "SELECT count(*) FROM events WHERE ts > now() - interval '7 day'",
    "SELECT u.*, p.* FROM users u JOIN profiles p ON p.user_id = u.id",
    "DELETE FROM sessions WHERE expires_at < now()",
  ];
  return samples.slice(0, 3 + Math.floor(r() * 3)).map((sql, i) => ({
    id: `${seed}-q-${i}`,
    sql,
    avgMs: Math.round(between(r, 320, 4200)),
    calls: Math.round(between(r, 50, 12_000)),
    lastSeen: new Date(Date.now() - Math.floor(between(r, 1, 120)) * 60_000).toISOString(),
  }));
}

/** Enrich a base AppDbHealth (or a partial) with extended observability fields. */
export function enrichDatabase(base: AppDbHealth, seed: string): Required<Omit<AppDbHealth, "id" | "role" | "backups" | "slowQueryList">> & AppDbHealth {
  const r = rng(seed);
  const cpu = base.cpuPct ?? Math.round(between(r, 18, 88));
  const mem = base.memoryPct ?? Math.round(between(r, 30, 90));
  const err = base.errorRate ?? Math.round(between(r, 0, 4.5) * 100) / 100;
  const lag = base.replicationLagMs;
  const status = base.status ?? statusFor(cpu, err, lag);
  const conns = base.connections;
  return {
    ...base,
    id: base.id ?? seed,
    role: base.role ?? "primary",
    status,
    cpuPct: cpu,
    memoryPct: mem,
    diskIops: base.diskIops ?? Math.round(between(r, 200, 9000)),
    latencyMs: base.latencyMs ?? Math.round(between(r, 1, 80)),
    qps: base.qps ?? Math.round(between(r, 80, 6000)),
    tps: base.tps ?? Math.round(between(r, 20, 900)),
    p95Ms: base.p95Ms ?? Math.round(between(r, 20, 600)),
    p99Ms: base.p99Ms ?? Math.round(between(r, 60, 1400)),
    errorRate: err,
    activeConnections: base.activeConnections ?? Math.round(conns * between(r, 0.4, 0.85)),
    idleConnections: base.idleConnections ?? Math.round(conns * between(r, 0.1, 0.4)),
    failedConnections: base.failedConnections ?? Math.round(between(r, 0, 12)),
    deadlocks: base.deadlocks ?? Math.round(between(r, 0, 6)),
    lockWaits: base.lockWaits ?? Math.round(between(r, 0, 28)),
    queryErrors: base.queryErrors ?? Math.round(between(r, 0, 40)),
    dbSizeGb: base.dbSizeGb ?? Math.round(between(r, 12, 920)),
    tables: base.tables ?? Math.round(between(r, 20, 480)),
    indexes: base.indexes ?? Math.round(between(r, 40, 1200)),
    growthGbPerDay: base.growthGbPerDay ?? Math.round(between(r, 0.1, 6) * 100) / 100,
    replicaStatus: base.replicaStatus ?? (lag > 5000 ? "lagging" : lag > 0 ? "in-sync" : "n/a"),
    backups: base.backups ?? mkBackups(seed),
    slowQueryList: base.slowQueryList ?? mkSlow(seed),
  };
}

// Some apps demo a multi-DB topology even though seed mock only had one `db`.
const MULTI_DB_EXTRAS: Record<string, Array<Partial<AppDbHealth> & { engine: AppDbHealth["engine"]; name: string }>> = {
  "app-sap-erp": [
    { engine: "redis", name: "erp-session-cache", role: "cache" },
  ],
  "app-billing-api": [
    { engine: "postgres", name: "billing-readonly-replica", role: "replica" },
    { engine: "redis", name: "billing-rate-limit", role: "cache" },
  ],
  "app-ecom": [
    { engine: "mongodb", name: "catalog-mongo", role: "analytics" },
    { engine: "redis", name: "ecom-cart-cache", role: "cache" },
  ],
};

function partialToBase(p: Partial<AppDbHealth> & { engine: AppDbHealth["engine"]; name: string }, seed: string): AppDbHealth {
  const r = rng(seed + ":base");
  return {
    name: p.name,
    engine: p.engine,
    role: p.role,
    uptimeDays: p.uptimeDays ?? Math.floor(between(r, 10, 600)),
    connections: p.connections ?? Math.round(between(r, 20, 600)),
    maxConnections: p.maxConnections ?? 1000,
    slowQueries: p.slowQueries ?? Math.round(between(r, 0, 30)),
    locks: p.locks ?? Math.round(between(r, 0, 6)),
    replicationLagMs: p.replicationLagMs ?? Math.round(between(r, 0, p.role === "replica" ? 8000 : 200)),
    storageUsedPct: p.storageUsedPct ?? Math.round(between(r, 25, 85)),
    ...p,
  };
}

/** Resolve the flexible 0 / 1 / many database list for an application. */
export function getAppDatabases(app: Application): AppDbHealth[] {
  const list: AppDbHealth[] = [];
  if (Array.isArray(app.databases) && app.databases.length) {
    list.push(...app.databases);
  } else if (app.db) {
    list.push({ ...app.db, role: app.db.role ?? "primary" });
  }
  const extras = MULTI_DB_EXTRAS[app.id];
  if (extras) {
    extras.forEach((e, i) => {
      list.push(partialToBase(e, `${app.id}:extra:${i}`));
    });
  }
  return list.map((d, i) => enrichDatabase(d, d.id ?? `${app.id}:db:${i}:${d.name}`));
}

/** Aggregate metrics across all databases of an application. */
export function aggregateDbMetrics(dbs: AppDbHealth[]) {
  if (!dbs.length) {
    return { count: 0, avgLatencyMs: 0, totalConnections: 0, totalQps: 0, avgErrorRate: 0, worstStatus: "healthy" as AppStatus };
  }
  const order: AppStatus[] = ["healthy", "warning", "degraded", "critical", "unknown"];
  const worst = dbs.reduce<AppStatus>((acc, d) => {
    const s = d.status ?? "healthy";
    return order.indexOf(s) > order.indexOf(acc) ? s : acc;
  }, "healthy");
  return {
    count: dbs.length,
    avgLatencyMs: Math.round(dbs.reduce((s, d) => s + (d.latencyMs ?? 0), 0) / dbs.length),
    totalConnections: dbs.reduce((s, d) => s + d.connections, 0),
    totalQps: dbs.reduce((s, d) => s + (d.qps ?? 0), 0),
    avgErrorRate: Math.round((dbs.reduce((s, d) => s + (d.errorRate ?? 0), 0) / dbs.length) * 100) / 100,
    worstStatus: worst,
  };
}

// ---- AI insights (mock) -------------------------------------------------
export interface AiInsight {
  id: string;
  scope: "app" | "db";
  severity: "info" | "warning" | "critical";
  title: string;
  detail: string;
  recommendation: string;
}

export function generateAppInsights(app: Application): AiInsight[] {
  const out: AiInsight[] = [];
  if (app.errorRate > 2) {
    out.push({
      id: `${app.id}-err`,
      scope: "app",
      severity: app.errorRate > 4 ? "critical" : "warning",
      title: `Elevated error rate (${app.errorRate.toFixed(2)}%)`,
      detail: "Error rate is above the rolling 24h baseline. Most failures correlate with upstream dependencies.",
      recommendation: "Inspect downstream services and recent deployment artifacts; consider rollback if regression confirmed.",
    });
  }
  if (app.latencyP95Ms > 600) {
    out.push({
      id: `${app.id}-lat`,
      scope: "app",
      severity: app.latencyP95Ms > 1000 ? "critical" : "warning",
      title: `P95 latency above SLO (${app.latencyP95Ms}ms)`,
      detail: "Latency regression detected across primary endpoints in the last 30 minutes.",
      recommendation: "Profile slowest endpoints; check DB connection pool saturation and cache hit-rate.",
    });
  }
  if (app.activeIncidents > 0) {
    out.push({
      id: `${app.id}-inc`,
      scope: "app",
      severity: "warning",
      title: `${app.activeIncidents} active incident${app.activeIncidents > 1 ? "s" : ""} linked to this app`,
      detail: "Correlated incidents in the platform incident timeline.",
      recommendation: "Open the incident drawer and review the AI root-cause analysis.",
    });
  }
  if (!out.length) {
    out.push({
      id: `${app.id}-ok`, scope: "app", severity: "info",
      title: "No anomalies detected", detail: "All signals are within the predicted baseline envelope.",
      recommendation: "No action required. Continue monitoring.",
    });
  }
  return out;
}

export function generateDbInsights(db: AppDbHealth): AiInsight[] {
  const out: AiInsight[] = [];
  if ((db.cpuPct ?? 0) > 80) {
    out.push({
      id: `${db.name}-cpu`, scope: "db", severity: "warning",
      title: `High CPU on ${db.name} (${db.cpuPct}%)`,
      detail: "Sustained CPU pressure correlates with the slow-query surge in the same window.",
      recommendation: "Review top slow queries; consider an index on the most-called table.",
    });
  }
  if (db.replicationLagMs > 5000) {
    out.push({
      id: `${db.name}-lag`, scope: "db", severity: "critical",
      title: `Replication lag ${(db.replicationLagMs / 1000).toFixed(1)}s on ${db.name}`,
      detail: "Replica is falling behind primary. Risk of stale reads and failed failover.",
      recommendation: "Check network throughput and WAL/redo backlog; pause heavy writes if possible.",
    });
  }
  if ((db.deadlocks ?? 0) > 2) {
    out.push({
      id: `${db.name}-dl`, scope: "db", severity: "warning",
      title: `${db.deadlocks} deadlocks observed`,
      detail: "Concurrent writes on hot tables are producing deadlocks.",
      recommendation: "Order updates consistently across transactions and shorten transaction scope.",
    });
  }
  if (db.storageUsedPct > 85) {
    out.push({
      id: `${db.name}-stor`, scope: "db", severity: "warning",
      title: `Storage ${db.storageUsedPct.toFixed(0)}% used`,
      detail: `Projected to fill in ~${Math.max(1, Math.round((100 - db.storageUsedPct) / Math.max(0.1, db.growthGbPerDay ?? 1)))} days at current growth.`,
      recommendation: "Plan storage expansion or archive cold partitions.",
    });
  }
  const recentFailed = (db.backups ?? []).filter((b) => b.status === "failed").length;
  if (recentFailed > 0) {
    out.push({
      id: `${db.name}-bk`, scope: "db", severity: "critical",
      title: `${recentFailed} recent backup failure${recentFailed > 1 ? "s" : ""}`,
      detail: "Backups failed within the last week — recovery point objective at risk.",
      recommendation: "Investigate backup agent logs and re-run a manual full backup.",
    });
  }
  if (!out.length) {
    out.push({ id: `${db.name}-ok`, scope: "db", severity: "info",
      title: `${db.name} healthy`, detail: "All metrics within baseline.", recommendation: "No action required." });
  }
  return out;
}

// ---- Traces (mock) ------------------------------------------------------
export interface TraceSpan { service: string; kind: "app" | "db" | "cache" | "queue" | "ext"; ms: number; }
export interface AppTrace { id: string; endpoint: string; totalMs: number; spans: TraceSpan[]; sampledAt: string; bottleneck: string; }

export function generateTraces(app: Application, dbs: AppDbHealth[]): AppTrace[] {
  const r = rng(app.id + ":traces");
  const endpoints = app.endpoints.length ? app.endpoints.slice(0, 3) : [{ method: "GET" as const, path: "/health" }];
  return endpoints.map((ep, i) => {
    const spans: TraceSpan[] = [
      { service: app.name, kind: "app", ms: Math.round(between(r, 10, 80)) },
    ];
    dbs.slice(0, 2).forEach((d) => spans.push({ service: d.name, kind: d.role === "cache" ? "cache" : "db", ms: Math.round(between(r, 5, 380)) }));
    if (r() > 0.4) spans.push({ service: "auth-service", kind: "ext", ms: Math.round(between(r, 10, 90)) });
    const totalMs = spans.reduce((s, x) => s + x.ms, 0);
    const bottleneck = spans.reduce((a, b) => (b.ms > a.ms ? b : a)).service;
    return {
      id: `${app.id}-tr-${i}`,
      endpoint: `${"method" in ep ? ep.method : "GET"} ${"path" in ep ? ep.path : "/"}`,
      totalMs,
      spans,
      sampledAt: new Date(Date.now() - Math.floor(between(r, 1, 30)) * 60_000).toISOString(),
      bottleneck,
    };
  });
}
