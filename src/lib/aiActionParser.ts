// Parse an AI markdown response into a structured ExecutionPlan.
// Heuristics-only — deterministic, no LLM round-trips.

export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface ExecutionStep {
  id: string;
  name: string;
  description: string;
  command?: string;
  /** Estimated duration (ms) used by the live timeline simulator. */
  estimatedMs: number;
}

export interface ExecutionPlan {
  /** Stable key derived from the source message id. */
  planId: string;
  summary: string;
  risk: RiskLevel;
  /** Total estimated execution time, in seconds, for the header chip. */
  etaSeconds: number;
  services: string[];
  resources: string[];
  expectedOutcome: string;
  steps: ExecutionStep[];
  /** Critical flag → forces double-confirmation. */
  critical: boolean;
  /** Free-text warnings shown in the safety banner. */
  warnings: string[];
}

const ACTION_VERBS =
  /\b(restart|reload|reboot|deploy|rollout|kubectl|systemctl|docker|helm|terraform|apt|yum|npm|bun|pnpm|psql|mysql|redis-cli|aws|gcloud|az|curl|wget|chmod|chown|rm|mv|cp|mkdir|service|cordon|drain|scale|patch|apply|exec|create|delete|update|migrate|backup|restore|truncate|alter|drop|grant|revoke)\b/i;

const DANGEROUS = [
  /\brm\s+-rf\b/i,
  /\bdrop\s+(table|database|schema)\b/i,
  /\btruncate\s+/i,
  /\bdelete\s+from\b/i,
  /\b--force\b/i,
  /\bkubectl\s+delete\b/i,
  /\bshutdown\b/i,
  /\bmkfs\b/i,
];

const SERVICE_HINTS =
  /\b(payment-svc|api-gateway|auth-svc|order-svc|user-svc|search-svc|nginx|tomcat|redis|postgres|mysql|kafka|rabbitmq|elasticsearch|mongodb|openedge|sap|webhook-handler|cache|broker)[a-z0-9-]*/gi;

const RESOURCE_HINTS =
  /\b(pod|deployment|node|cluster|namespace|container|volume|pvc|service|ingress|configmap|secret|table|index|database|broker|queue|topic|partition|server|host|vm|instance)\s+[a-z0-9_./-]+/gi;

interface Block {
  language: string;
  body: string;
}

/** Pull fenced code blocks out of a markdown string. */
function extractCodeBlocks(md: string): Block[] {
  const re = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
  const out: Block[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(md)) !== null) {
    out.push({ language: m[1] || "text", body: m[2].trim() });
  }
  return out;
}

/** Detect command-like lines from inline backticks. */
function extractInlineCommands(md: string): string[] {
  const re = /`([^`\n]{4,200})`/g;
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(md)) !== null) {
    const c = m[1].trim();
    if (ACTION_VERBS.test(c)) out.push(c);
  }
  return out;
}

/** Pull bullet/numbered steps from the markdown body. */
function extractBulletSteps(md: string): string[] {
  const out: string[] = [];
  const lines = md.split("\n");
  for (const raw of lines) {
    const line = raw.trim();
    const bullet = line.match(/^(?:[-*]|\d+[.)])\s+(.{6,240})$/);
    if (bullet) out.push(bullet[1].replace(/[*_`]/g, "").trim());
  }
  return out;
}

function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

function scoreRisk(allCommands: string[], body: string): { risk: RiskLevel; warnings: string[]; critical: boolean } {
  const warnings: string[] = [];
  let danger = 0;
  for (const c of allCommands) {
    for (const re of DANGEROUS) {
      if (re.test(c)) {
        danger += 2;
        warnings.push(`Dangerous pattern detected: \`${c.slice(0, 80)}\``);
      }
    }
    if (/\bprod(uction)?\b/i.test(c) || /\bprod(uction)?\b/i.test(body)) danger += 1;
    if (/\brestart|reboot|rollout|drain|cordon\b/i.test(c)) danger += 0.5;
  }
  if (/\bcritical\b/i.test(body)) danger += 1;
  let risk: RiskLevel = "low";
  if (danger >= 4) risk = "critical";
  else if (danger >= 2.5) risk = "high";
  else if (danger >= 1) risk = "medium";
  return { risk, warnings: uniq(warnings).slice(0, 4), critical: risk === "critical" };
}

function estimateMs(command: string | undefined, name: string): number {
  if (!command) return 1200;
  if (/restart|reboot|rollout/i.test(command + name)) return 4500;
  if (/deploy|apply|migrate|terraform/i.test(command + name)) return 6500;
  if (/scale|cordon|drain/i.test(command + name)) return 3500;
  if (/backup|restore|snapshot/i.test(command + name)) return 5000;
  return 1800;
}

/**
 * Build a deterministic plan from an AI markdown response.
 * Returns null when the response has no actionable content (pure explanation).
 */
export function parseAiPlan(messageId: string, markdown: string): ExecutionPlan | null {
  if (!markdown || markdown.length < 12) return null;

  const blocks = extractCodeBlocks(markdown);
  const execBlocks = blocks.filter((b) =>
    /^(bash|sh|shell|zsh|console|yaml|yml|hcl|sql|dockerfile|kubectl)?$/i.test(b.language) &&
    ACTION_VERBS.test(b.body),
  );
  const inlineCmds = extractInlineCommands(markdown);
  const bulletSteps = extractBulletSteps(markdown);

  // Actionability gate
  const hasExecutable =
    execBlocks.length > 0 ||
    inlineCmds.length > 0 ||
    bulletSteps.some((s) => ACTION_VERBS.test(s));
  if (!hasExecutable) return null;

  // Build the step list
  const steps: ExecutionStep[] = [];

  execBlocks.forEach((block, i) => {
    const cmdLines = block.body
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#"));
    cmdLines.forEach((cmd, j) => {
      const name = cmd.split(/\s+/).slice(0, 3).join(" ");
      steps.push({
        id: `${messageId}-blk-${i}-${j}`,
        name: name.length > 48 ? name.slice(0, 48) + "…" : name,
        description: `Execute command from block ${i + 1}`,
        command: cmd,
        estimatedMs: estimateMs(cmd, name),
      });
    });
  });

  if (steps.length === 0) {
    inlineCmds.slice(0, 6).forEach((cmd, i) => {
      const name = cmd.split(/\s+/).slice(0, 3).join(" ");
      steps.push({
        id: `${messageId}-inl-${i}`,
        name: name.length > 48 ? name.slice(0, 48) + "…" : name,
        description: "Inline operation",
        command: cmd,
        estimatedMs: estimateMs(cmd, name),
      });
    });
  }

  if (steps.length === 0) {
    bulletSteps
      .filter((s) => ACTION_VERBS.test(s))
      .slice(0, 6)
      .forEach((s, i) => {
        steps.push({
          id: `${messageId}-stp-${i}`,
          name: s.slice(0, 48),
          description: s,
          estimatedMs: estimateMs(undefined, s),
        });
      });
  }

  if (steps.length === 0) return null;

  // Always start with an automatic backup step + finish with a verification step
  const backupStep: ExecutionStep = {
    id: `${messageId}-backup`,
    name: "Create recovery point",
    description: "Snapshot of previous configuration, state, values & commands",
    estimatedMs: 1500,
  };
  const verifyStep: ExecutionStep = {
    id: `${messageId}-verify`,
    name: "Validate post-state",
    description: "Health checks, smoke tests and SLO verification",
    estimatedMs: 2000,
  };
  const allSteps = [backupStep, ...steps, verifyStep];

  const allCommands = steps.map((s) => s.command ?? s.name);
  const { risk, warnings, critical } = scoreRisk(allCommands, markdown);

  const services = uniq(Array.from(markdown.matchAll(SERVICE_HINTS)).map((m) => m[0])).slice(0, 6);
  const resources = uniq(Array.from(markdown.matchAll(RESOURCE_HINTS)).map((m) => m[0])).slice(0, 6);

  // Summary = first non-empty line, trimmed
  const firstLine = markdown
    .split("\n")
    .map((l) => l.replace(/[#*_`>]/g, "").trim())
    .find((l) => l.length > 12) ?? "AI proposed remediation plan";

  const etaSeconds = Math.round(allSteps.reduce((a, s) => a + s.estimatedMs, 0) / 1000);

  return {
    planId: messageId,
    summary: firstLine.slice(0, 180),
    risk,
    etaSeconds,
    services,
    resources,
    expectedOutcome:
      risk === "critical"
        ? "Restore service while limiting blast radius. Manual oversight required."
        : "Restore nominal operations and clear the originating alert.",
    steps: allSteps,
    critical,
    warnings,
  };
}
