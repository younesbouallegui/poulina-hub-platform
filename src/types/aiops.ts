// AIOps trust framework + incident knowledge model.

export type RemediationPolicy =
  | "off"             // AI explains only
  | "suggest"         // AI proposes, user executes manually
  | "approval"        // AI prepares plan, user approves, AI executes
  | "autonomous";     // AI executes automatically for approved classes

export interface AssetPolicy {
  /** Stable key — e.g. host name, application id, service id */
  assetKey: string;
  /** Human label shown in UI */
  label: string;
  /** Category for grouping */
  scope: "infrastructure" | "server" | "application" | "service";
  policy: RemediationPolicy;
  /** Approved remediation actions when policy >= approval */
  approvedActions: ApprovedAction[];
  updatedAt: string;
  updatedBy?: string;
}

export type ApprovedAction =
  | "disk-cleanup"
  | "service-restart"
  | "cache-cleanup"
  | "log-rotation"
  | "process-restart"
  | "container-restart"
  | "script-execution"
  | "runbook-execution";

export const ALL_APPROVED_ACTIONS: ApprovedAction[] = [
  "disk-cleanup",
  "service-restart",
  "cache-cleanup",
  "log-rotation",
  "process-restart",
  "container-restart",
  "script-execution",
  "runbook-execution",
];

/** Categories of incident the platform recognises for governance. */
export type IncidentType =
  | "disk-full"
  | "service-down"
  | "high-cpu"
  | "high-memory"
  | "cache-pressure"
  | "log-overflow"
  | "network-degradation"
  | "database-failure"
  | "production-sap"
  | "container-crash"
  | "other";

export interface IncidentTypePolicy {
  type: IncidentType;
  label: string;
  policy: RemediationPolicy;
  /** Minimum confidence required for autonomous run. */
  minConfidence: number;
  updatedAt: string;
}

export const DEFAULT_INCIDENT_TYPE_POLICIES: IncidentTypePolicy[] = [
  { type: "disk-full",           label: "Disk Full",            policy: "autonomous", minConfidence: 80, updatedAt: new Date().toISOString() },
  { type: "cache-pressure",      label: "Cache Pressure",       policy: "autonomous", minConfidence: 80, updatedAt: new Date().toISOString() },
  { type: "log-overflow",        label: "Log Overflow",         policy: "autonomous", minConfidence: 75, updatedAt: new Date().toISOString() },
  { type: "service-down",        label: "Service Down",         policy: "approval",   minConfidence: 75, updatedAt: new Date().toISOString() },
  { type: "container-crash",     label: "Container Crash",      policy: "approval",   minConfidence: 75, updatedAt: new Date().toISOString() },
  { type: "high-cpu",            label: "High CPU",             policy: "suggest",    minConfidence: 70, updatedAt: new Date().toISOString() },
  { type: "high-memory",         label: "High Memory",          policy: "suggest",    minConfidence: 70, updatedAt: new Date().toISOString() },
  { type: "network-degradation", label: "Network Degradation",  policy: "suggest",    minConfidence: 70, updatedAt: new Date().toISOString() },
  { type: "database-failure",    label: "Database Failure",     policy: "suggest",    minConfidence: 90, updatedAt: new Date().toISOString() },
  { type: "production-sap",      label: "Production SAP",       policy: "off",        minConfidence: 99, updatedAt: new Date().toISOString() },
  { type: "other",               label: "Other / Uncategorised",policy: "suggest",    minConfidence: 80, updatedAt: new Date().toISOString() },
];

/** Loose lexical classifier — keeps incident routing deterministic without an LLM. */
export function classifyIncident(trigger: string): IncidentType {
  const t = trigger.toLowerCase();
  if (/sap|s\/4|hana/.test(t)) return "production-sap";
  if (/disk|space|filesystem|inode/.test(t)) return "disk-full";
  if (/cache|redis|memcache/.test(t)) return "cache-pressure";
  if (/log/.test(t)) return "log-overflow";
  if (/container|pod|docker|k8s|kube/.test(t)) return "container-crash";
  if (/database|db|postgres|mysql|oracle|mssql|openedge/.test(t)) return "database-failure";
  if (/network|packet|latency|link/.test(t)) return "network-degradation";
  if (/memory|ram|oom/.test(t)) return "high-memory";
  if (/cpu|load/.test(t)) return "high-cpu";
  if (/down|offline|unreachable|crash|failed/.test(t)) return "service-down";
  return "other";
}

/** Per-incident override of the AI automation switch. */
export interface IncidentOverride {
  eventId: string;
  enabled: boolean;
  updatedAt: string;
  updatedBy: string;
  reason?: string;
}

export interface AuditEntry {
  id: string;
  ts: string;
  actor: string;            // user email or "ai-copilot"
  kind:
    | "ack"
    | "ai-analysis"
    | "ai-explain"
    | "ai-remediate-plan"
    | "ai-remediate-execute"
    | "ai-verify"
    | "approval"
    | "rollback"
    | "kill-switch"
    | "policy-change"
    | "override"
    | "knowledge-write";
  message: string;
  meta?: AuditMeta;
}

/** Rich audit payload — every field is optional, all are persisted for full transparency. */
export interface AuditMeta {
  eventId?: string;
  host?: string;
  step?: number;
  // AI analysis
  reasoning?: string[];
  decisionPath?: string[];
  confidence?: number;
  historicalMatches?: number;
  relatedServices?: string[];
  dependencies?: string[];
  // Remediation
  action?: string;
  service?: string;
  status?: "success" | "partial" | "failed";
  durationMs?: number;
  commands?: string[];
  // Verification
  metricsChecked?: string[];
  verifications?: { name: string; result: "pass" | "fail"; detail?: string }[];
  // Policy / overrides
  fromPolicy?: RemediationPolicy;
  toPolicy?: RemediationPolicy;
  enabled?: boolean;
  reason?: string;
  // Free-form catch-all
  [k: string]: unknown;
}

export interface KnowledgeRecord {
  id: string;
  createdAt: string;
  trigger: string;
  host: string;
  incidentType?: IncidentType;
  symptoms: string[];
  rootCause?: string;
  resolution?: string;
  actions: string[];
  commands?: string[];
  durationMs?: number;
  outcome: "resolved" | "mitigated" | "escalated";
  confidence: number; // 0-100
  source: "ai" | "engineer" | "auto";
}

/** Confidence-based decision tier used uniformly across the platform. */
export type ConfidenceTier = "investigate" | "approve" | "auto";

export function decideAutonomy(confidence: number): ConfidenceTier {
  if (confidence < 70) return "investigate";
  if (confidence <= 90) return "approve";
  return "auto";
}
