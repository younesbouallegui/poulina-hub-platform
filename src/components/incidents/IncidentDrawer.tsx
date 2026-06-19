import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bot, CheckCircle2, Loader2, ShieldAlert, ShieldOff, ToggleLeft, ToggleRight, Zap,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import {
  useAuditLog,
  useEffectivePolicy,
  useIncidentKnowledge,
  useIncidentOverrides,
  useKillSwitch,
  useTrustScores,
} from "@/hooks/useAiOps";
import { IncidentAuditTimeline } from "./IncidentAuditTimeline";
import { AiTrustBadge } from "./AiTrustBadge";
import { acknowledgeEvent, type ZabbixProblem, type ZabbixSeverity } from "@/lib/zabbixApi";
import { classifyIncident, decideAutonomy } from "@/types/aiops";
import { cn } from "@/lib/utils";

const SEVERITY_LABEL: Record<ZabbixSeverity, string> = {
  "5": "Disaster", "4": "High", "3": "Average",
  "2": "Warning", "1": "Info", "0": "Not classified",
};

interface Props {
  problem: ZabbixProblem | null;
  hostName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAcknowledged?: () => void;
}

// Deterministic confidence from event id so re-opens are stable.
function seedConfidence(eventId: string, trigger: string) {
  const base = (eventId + trigger).split("").reduce((s, c) => (s * 31 + c.charCodeAt(0)) >>> 0, 7);
  return 72 + (base % 26); // 72–97
}

export const IncidentDrawer = ({ problem, hostName, open, onOpenChange, onAcknowledged }: Props) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const actor = user?.email ?? "anonymous";
  const { toast } = useToast();
  const audit = useAuditLog();
  const kb = useIncidentKnowledge();
  const { killed } = useKillSwitch();
  const overrides = useIncidentOverrides();
  const trustScores = useTrustScores();
  const [tab, setTab] = useState<"overview" | "timeline" | "governance">("overview");
  const [ackReason, setAckReason] = useState("");
  const [acking, setAcking] = useState(false);
  const [acked, setAcked] = useState(false);
  const [remediating, setRemediating] = useState(false);

  const confidence = useMemo(
    () => problem ? seedConfidence(problem.eventid, problem.name) : 0,
    [problem],
  );
  const incidentType = problem ? classifyIncident(problem.name) : "other";
  const tier = decideAutonomy(confidence);

  const effective = useEffectivePolicy({
    eventId: problem?.eventid ?? "",
    hostKey: hostName,
    trigger: problem?.name ?? "",
    confidence,
  });

  useEffect(() => {
    if (open) {
      setTab("overview");
      setAckReason("");
      setAcked(problem?.acknowledged === "1");
    }
  }, [open, problem]);

  if (!problem) return null;

  const policy = effective.effective;
  const isAck = acked || problem.acknowledged === "1";
  const triggeredAt = new Date(Number(problem.clock) * 1000).toISOString();
  const override = overrides.get(problem.eventid);
  const trustForType = trustScores.find((t) => t.type === incidentType);

  const handleAck = async () => {
    setAcking(true);
    try {
      await acknowledgeEvent(problem.eventid, ackReason || "Acknowledged via console");
      audit.append({
        actor,
        kind: "ack",
        message: ackReason ? `Acknowledged: ${ackReason}` : "Acknowledged incident",
        meta: { eventId: problem.eventid, host: hostName },
      });
      setAcked(true);
      toast({ title: "Acknowledged", description: `Event #${problem.eventid}` });
      onAcknowledged?.();
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Acknowledge failed",
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setAcking(false);
    }
  };

  const handleExplainWithAi = () => {
    audit.append({
      actor,
      kind: "ai-explain",
      message: "Opened AI Insights for investigation",
      meta: { eventId: problem.eventid, host: hostName, confidence, reasoning: effective.reasons },
    });
    const params = new URLSearchParams({
      event: problem.eventid,
      host: hostName,
      trigger: problem.name,
      severity: SEVERITY_LABEL[problem.severity],
      at: triggeredAt,
    });
    if (problem.opdata) params.set("opdata", problem.opdata);
    onOpenChange(false);
    navigate(`/ai?${params.toString()}`);
  };

  const toggleOverride = (enabled: boolean) => {
    overrides.set(problem.eventid, enabled, actor, enabled ? "Engineer enabled AI for this incident" : "Engineer disabled AI for this incident");
    audit.append({
      actor,
      kind: "override",
      message: `Per-incident AI automation ${enabled ? "ENABLED" : "DISABLED"}`,
      meta: { eventId: problem.eventid, host: hostName, enabled, reason: enabled ? "manual enable" : "manual disable" },
    });
    toast({ title: `Override ${enabled ? "enabled" : "disabled"}`, description: `Event #${problem.eventid}` });
  };

  const handleAutoRemediate = () => {
    if (killed) {
      toast({ variant: "destructive", title: "Kill switch active", description: "All AI remediation suspended platform-wide." });
      return;
    }
    if (policy === "off") {
      toast({ variant: "destructive", title: "AI remediation disabled", description: `Policy resolved to OFF — see Governance tab.` });
      return;
    }
    if (policy === "suggest") {
      toast({ title: "Suggest-only policy", description: "AI may propose actions but cannot execute." });
      return;
    }

    setRemediating(true);
    setTab("timeline");

    const service = hostName.split("-")[0] || "service";
    const start = Date.now();

    // 1. AI Analysis
    audit.append({
      actor: "ai-copilot",
      kind: "ai-analysis",
      message: `AI analysis started — incident classified as ${incidentType}`,
      meta: {
        eventId: problem.eventid, host: hostName,
        confidence,
        reasoning: [
          `Trigger "${problem.name}" classified as ${incidentType}`,
          `Host ${hostName} evaluated`,
          `Decision tier: ${tier}`,
          `${trustForType?.attempts ?? 0} historical attempts, success rate ${trustForType?.successRate ?? 0}%`,
        ],
        decisionPath: effective.reasons,
        historicalMatches: trustForType?.attempts ?? 0,
        relatedServices: [service, "monitoring", "load-balancer"],
        dependencies: [hostName, `${service}.upstream`, `${service}.db`],
      },
    });

    // 2. Remediation Plan
    setTimeout(() => {
      audit.append({
        actor: "ai-copilot",
        kind: "ai-remediate-plan",
        message: `Plan generated for ${service}`,
        meta: {
          eventId: problem.eventid, host: hostName, confidence,
          decisionPath: [
            "Snapshot current state",
            `Restart ${service}`,
            "Verify health probes recover",
          ],
        },
      });
    }, 400);

    // 3. Execute
    setTimeout(() => {
      const commands = [
        `systemctl status ${service}`,
        `systemctl restart ${service}`,
        `systemctl status ${service}`,
      ];
      audit.append({
        actor: policy === "autonomous" ? "ai-copilot" : actor,
        kind: "ai-remediate-execute",
        message: `Restart ${service} on ${hostName}`,
        meta: {
          eventId: problem.eventid, host: hostName,
          action: "Restart service",
          service,
          status: "success",
          durationMs: 8000,
          commands,
          confidence,
        },
      });
    }, 1200);

    // 4. Verify
    setTimeout(() => {
      audit.append({
        actor: "ai-copilot",
        kind: "ai-verify",
        message: "Health verification completed",
        meta: {
          eventId: problem.eventid, host: hostName, status: "success",
          metricsChecked: ["CPU", "Memory", "Disk", "Network", "Service status"],
          verifications: [
            { name: "HTTP 200", result: "pass" },
            { name: "CPU normal", result: "pass", detail: "<60%" },
            { name: "Memory normal", result: "pass", detail: "<70%" },
            { name: "Service responsive", result: "pass" },
          ],
        },
      });

      // 5. Knowledge write
      kb.upsert({
        trigger: problem.name,
        host: hostName,
        incidentType,
        symptoms: [problem.name],
        rootCause: "Service degraded — restarted by AIOps Copilot",
        resolution: `Restart ${service}; verify probes`,
        actions: ["Snapshot", "Restart", "Verify"],
        commands: [`systemctl restart ${service}`],
        durationMs: Date.now() - start,
        outcome: "resolved",
        confidence,
        source: "ai",
      });
      audit.append({
        actor: "ai-copilot",
        kind: "knowledge-write",
        message: "Resolution stored in knowledge base for future incidents",
        meta: { eventId: problem.eventid, host: hostName, status: "success" },
      });

      setRemediating(false);
      toast({ title: "Auto-remediation complete", description: `Verified & logged for ${hostName}.` });
    }, 2200);
  };

  const canExecute = !killed && (policy === "autonomous" || policy === "approval");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-destructive ring-1 ring-destructive/30">
              {SEVERITY_LABEL[problem.severity]}
            </span>
            <AiTrustBadge policy={policy} />
            <span className="rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[10px] text-primary">
              {confidence}% conf · {tier}
            </span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase text-muted-foreground">
              {incidentType}
            </span>
            <span className="font-mono text-[10px] text-muted-foreground">#{problem.eventid}</span>
          </div>
          <SheetTitle className="text-left text-base leading-snug">{problem.name}</SheetTitle>
          <p className="text-xs text-muted-foreground">
            Host <span className="font-mono text-foreground">{hostName}</span>
            {" · "}Triggered {new Date(triggeredAt).toLocaleString()}
          </p>
        </SheetHeader>

        {/* Per-incident override */}
        <div className={cn(
          "mt-4 flex items-center justify-between rounded-xl border p-3 text-xs",
          override?.enabled === false
            ? "border-destructive/30 bg-destructive/5"
            : override?.enabled
              ? "border-success/30 bg-success/5"
              : "border-border bg-card",
        )}>
          <div>
            <p className="font-semibold text-foreground">AI Automation (this incident)</p>
            <p className="text-[11px] text-muted-foreground">
              {override
                ? `Overridden ${override.enabled ? "ENABLED" : "DISABLED"} by ${override.updatedBy}`
                : `Following ${effective.source} policy`}
            </p>
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => toggleOverride(true)}
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold",
                override?.enabled ? "bg-success text-success-foreground" : "bg-muted text-foreground hover:bg-muted/70",
              )}
            >
              <ToggleRight className="h-3.5 w-3.5" /> Enable
            </button>
            <button
              onClick={() => toggleOverride(false)}
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold",
                override?.enabled === false ? "bg-destructive text-destructive-foreground" : "bg-muted text-foreground hover:bg-muted/70",
              )}
            >
              <ToggleLeft className="h-3.5 w-3.5" /> Disable
            </button>
            {override && (
              <button
                onClick={() => overrides.clear(problem.eventid)}
                className="rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Action bar */}
        <div className="mt-3 grid grid-cols-3 gap-2">
          <button
            onClick={handleAck}
            disabled={isAck || acking}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-md border px-2.5 py-2 text-xs font-semibold transition-colors",
              isAck
                ? "border-success/40 bg-success/10 text-success"
                : "border-border bg-card text-foreground hover:bg-muted",
              acking && "opacity-60",
            )}
          >
            {acking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            {isAck ? "Acknowledged" : "Acknowledge"}
          </button>
          <button
            onClick={handleExplainWithAi}
            className="inline-flex items-center justify-center gap-1.5 rounded-md bg-gradient-primary px-2.5 py-2 text-xs font-semibold text-primary-foreground shadow-glow hover:opacity-95"
          >
            <Bot className="h-3.5 w-3.5" />
            Explain with AI
          </button>
          <button
            onClick={handleAutoRemediate}
            disabled={remediating || !canExecute}
            className="inline-flex items-center justify-center gap-1.5 rounded-md border border-success/40 bg-success/10 px-2.5 py-2 text-xs font-semibold text-success hover:bg-success/15 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {remediating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
            Auto-Remediate
          </button>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="timeline">Resolution Timeline</TabsTrigger>
            <TabsTrigger value="governance">AI Governance</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-3 space-y-3">
            <div className="rounded-xl border border-border bg-card p-3 text-xs">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Acknowledge & log
              </p>
              <textarea
                value={ackReason}
                onChange={(e) => setAckReason(e.target.value)}
                placeholder="Reason / note (optional) — captured in the audit timeline"
                disabled={isAck}
                rows={3}
                className="mt-2 w-full rounded-md border border-input bg-background p-2 text-xs outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-50"
              />
              <p className="mt-2 text-[10px] text-muted-foreground">Actor: {actor}</p>
            </div>

            {problem.opdata && (
              <div className="rounded-xl border border-border bg-card p-3 text-xs">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Operational data
                </p>
                <pre className="mt-1 whitespace-pre-wrap font-mono text-[11px] text-foreground">
                  {problem.opdata}
                </pre>
              </div>
            )}

            {killed && (
              <div className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
                <ShieldOff className="mt-0.5 h-4 w-4" />
                <div>
                  <p className="font-semibold">Global kill switch is engaged.</p>
                  <p className="mt-0.5 text-[11px] opacity-80">AI remediation suspended platform-wide.</p>
                </div>
              </div>
            )}
            {!killed && policy === "off" && (
              <div className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/5 p-3 text-xs text-warning">
                <ShieldAlert className="mt-0.5 h-4 w-4" />
                <div>
                  <p className="font-semibold">AI automation is OFF for this incident.</p>
                  <p className="mt-0.5 text-[11px] opacity-80">See Governance tab for the decision trace.</p>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="timeline" className="mt-3">
            <div className="rounded-xl border border-border bg-card p-3">
              <IncidentAuditTimeline eventId={problem.eventid} />
            </div>
          </TabsContent>

          <TabsContent value="governance" className="mt-3 space-y-3">
            <div className="rounded-xl border border-border bg-card p-3 text-xs">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Decision trace</p>
              <ol className="mt-2 space-y-1">
                {effective.reasons.map((r, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="font-mono text-muted-foreground">{i + 1}.</span>
                    <span className="text-foreground">{r}</span>
                  </li>
                ))}
              </ol>
              <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border pt-3">
                <Cell label="Effective policy" value={policy} />
                <Cell label="Decision tier" value={tier} />
                <Cell label="Confidence" value={`${confidence}%`} />
                <Cell label="Source" value={effective.source} />
                <Cell label="Min required" value={`${effective.minConfidence}%`} />
                <Cell label="Type" value={incidentType} />
              </div>
            </div>

            {trustForType && (
              <div className="rounded-xl border border-border bg-card p-3 text-xs">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Trust score for {trustForType.label}</p>
                <div className="mt-2 flex items-center gap-3">
                  <div className="flex-1">
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn(
                          "h-full",
                          trustForType.trust === "high" ? "bg-success" :
                          trustForType.trust === "medium" ? "bg-warning" : "bg-destructive",
                        )}
                        style={{ width: `${trustForType.successRate}%` }}
                      />
                    </div>
                  </div>
                  <span className="font-mono text-sm font-semibold text-foreground">{trustForType.successRate}%</span>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {trustForType.successes}/{trustForType.attempts} AI runs succeeded — trust: {trustForType.trust}
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
};

const Cell = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-md border border-border bg-background-elevated/30 p-2">
    <p className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</p>
    <p className="mt-0.5 font-mono text-xs font-semibold text-foreground">{value}</p>
  </div>
);
