import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bot, CheckCircle2, Loader2, ShieldAlert, ShieldOff, Zap } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import {
  useAiPolicies,
  useAuditLog,
  useIncidentKnowledge,
  useKillSwitch,
} from "@/hooks/useAiOps";
import { IncidentAuditTimeline } from "./IncidentAuditTimeline";
import { AiTrustBadge } from "./AiTrustBadge";
import { acknowledgeEvent, type ZabbixProblem, type ZabbixSeverity } from "@/lib/zabbixApi";
import { cn } from "@/lib/utils";

const SEVERITY_LABEL: Record<ZabbixSeverity, string> = {
  "5": "Disaster", "4": "High", "3": "Average",
  "2": "Warning", "1": "Info", "0": "Not classified",
};

const REMEDIATION_STEPS = [
  "Snapshot current state",
  "Restart degraded service",
  "Verify health probes recover",
];

interface Props {
  problem: ZabbixProblem | null;
  hostName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAcknowledged?: () => void;
}

export const IncidentDrawer = ({ problem, hostName, open, onOpenChange, onAcknowledged }: Props) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const actor = user?.email ?? "anonymous";
  const { toast } = useToast();
  const audit = useAuditLog();
  const kb = useIncidentKnowledge();
  const { getPolicy } = useAiPolicies();
  const { killed } = useKillSwitch();
  const [tab, setTab] = useState<"overview" | "timeline">("overview");
  const [ackReason, setAckReason] = useState("");
  const [acking, setAcking] = useState(false);
  const [acked, setAcked] = useState(false);
  const [remediating, setRemediating] = useState(false);

  useEffect(() => {
    if (open) {
      setTab("overview");
      setAckReason("");
      setAcked(problem?.acknowledged === "1");
    }
  }, [open, problem]);

  if (!problem) return null;

  const policy = getPolicy(hostName)?.policy ?? "off";
  const isAck = acked || problem.acknowledged === "1";
  const triggeredAt = new Date(Number(problem.clock) * 1000).toISOString();

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
      meta: { eventId: problem.eventid, host: hostName },
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

  const handleAutoRemediate = () => {
    if (killed) {
      toast({
        variant: "destructive",
        title: "Kill switch active",
        description: "All AI remediation suspended platform-wide.",
      });
      return;
    }
    if (policy === "off") {
      toast({
        variant: "destructive",
        title: "AI remediation disabled",
        description: `No policy for ${hostName}. Configure it in AI Operations → AI Policies.`,
      });
      return;
    }
    if (policy === "suggest") {
      toast({
        title: "Suggest-only policy",
        description: "AI may propose actions but cannot execute. Use Explain with AI.",
      });
      return;
    }

    setRemediating(true);
    setTab("timeline");

    audit.append({
      actor: "ai-copilot",
      kind: "ai-remediate-plan",
      message: `AI analysis started — root cause identification`,
      meta: { eventId: problem.eventid, host: hostName },
    });

    setTimeout(() => {
      REMEDIATION_STEPS.forEach((step, i) => {
        setTimeout(() => {
          audit.append({
            actor: policy === "autonomous" ? "ai-copilot" : actor,
            kind: "ai-remediate-execute",
            message: step,
            meta: { eventId: problem.eventid, host: hostName, step: i + 1 },
          });
        }, i * 600);
      });

      setTimeout(() => {
        kb.upsert({
          trigger: problem.name,
          host: hostName,
          symptoms: [problem.name],
          rootCause: "Auto-detected by AIOps Copilot",
          resolution: REMEDIATION_STEPS.join(" → "),
          actions: REMEDIATION_STEPS,
          outcome: "resolved",
          confidence: 88,
          source: "ai",
        });
        audit.append({
          actor: "ai-copilot",
          kind: "knowledge-write",
          message: "Incident resolved · knowledge base updated",
          meta: { eventId: problem.eventid, host: hostName },
        });
        setRemediating(false);
        toast({
          title: "Auto-remediation complete",
          description: `Resolution logged to timeline for ${hostName}.`,
        });
      }, REMEDIATION_STEPS.length * 600 + 400);
    }, 500);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-destructive ring-1 ring-destructive/30">
              {SEVERITY_LABEL[problem.severity]}
            </span>
            <AiTrustBadge policy={policy} />
            <span className="font-mono text-[10px] text-muted-foreground">#{problem.eventid}</span>
          </div>
          <SheetTitle className="text-left text-base leading-snug">{problem.name}</SheetTitle>
          <p className="text-xs text-muted-foreground">
            Host <span className="font-mono text-foreground">{hostName}</span>
            {" · "}Triggered {new Date(triggeredAt).toLocaleString()}
          </p>
        </SheetHeader>

        {/* Action bar — 3 enterprise actions */}
        <div className="mt-4 grid grid-cols-3 gap-2">
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
            disabled={remediating || killed || policy === "off" || policy === "suggest"}
            className="inline-flex items-center justify-center gap-1.5 rounded-md border border-success/40 bg-success/10 px-2.5 py-2 text-xs font-semibold text-success hover:bg-success/15 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {remediating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
            Auto-Remediate
          </button>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="timeline">Resolution Timeline</TabsTrigger>
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

            {killed ? (
              <div className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
                <ShieldOff className="mt-0.5 h-4 w-4" />
                <div>
                  <p className="font-semibold">Global kill switch is engaged.</p>
                  <p className="mt-0.5 text-[11px] opacity-80">
                    AI remediation is suspended platform-wide. Lift it in AI Operations → AI Policies.
                  </p>
                </div>
              </div>
            ) : policy === "off" ? (
              <div className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/5 p-3 text-xs text-warning">
                <ShieldAlert className="mt-0.5 h-4 w-4" />
                <div>
                  <p className="font-semibold">AI automation is not enabled for this asset.</p>
                  <p className="mt-0.5 text-[11px] opacity-80">
                    Configure a trust policy for <span className="font-mono">{hostName}</span> in
                    AI Operations → AI Policies to enable suggest / approval / autonomous modes.
                  </p>
                </div>
              </div>
            ) : null}
          </TabsContent>

          <TabsContent value="timeline" className="mt-3">
            <div className="rounded-xl border border-border bg-card p-3">
              <IncidentAuditTimeline eventId={problem.eventid} />
            </div>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
};
