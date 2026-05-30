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

export interface AuditEntry {
  id: string;
  ts: string;
  actor: string;            // user email or "ai-copilot"
  kind:
    | "ack"
    | "ai-explain"
    | "ai-remediate-plan"
    | "ai-remediate-execute"
    | "approval"
    | "rollback"
    | "kill-switch"
    | "knowledge-write";
  message: string;
  meta?: Record<string, unknown>;
}

export interface KnowledgeRecord {
  id: string;
  createdAt: string;
  trigger: string;
  host: string;
  symptoms: string[];
  rootCause?: string;
  resolution?: string;
  actions: string[];
  outcome: "resolved" | "mitigated" | "escalated";
  confidence: number; // 0-100
  source: "ai" | "engineer" | "auto";
}
