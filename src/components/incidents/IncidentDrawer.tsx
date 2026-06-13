import { useEffect, useState } from "react";
import { Bot, CheckCircle2, Loader2, ShieldAlert, Zap } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useAiPolicies, useAuditLog } from "@/hooks/useAiOps";
import { AiExplainPanel } from "./AiExplainPanel";
import { AutoRemediatePanel } from "./AutoRemediatePanel";
import { IncidentAuditTimeline } from "./IncidentAuditTimeline";
import { AiTrustBadge } from "./AiTrustBadge";
import { acknowledgeEvent, type ZabbixProblem, type ZabbixSeverity } from "@/lib/zabbixApi";
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

export const IncidentDrawer = ({ problem, hostName, open, onOpenChange, onAcknowledged }: Props) => {
  const { user } = useAuth();
  const actor = user?.email ?? "anonymous";
  const { toast } = useToast();
  const audit = useAuditLog();
  const { getPolicy } = useAiPolicies();
  const [tab, setTab] = useState<"overview" | "ai" | "remediate" | "timeline">("overview");
  const [ackReason, setAckReason] = useState("");
  const [acking, setAcking] = useState(false);
  const [acked, setAcked] = useState(false);

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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-destructive ring-1 ring-destructive/30">
              {SEVERITY_LABEL[problem.severity]}
            </span>
            <AiTrustBadge policy={policy} />
            <span className="font-mono text-[10px] text-muted-foreground">#{problem.eventid}</span>
          </div>
          <SheetTitle className="text-left text-base leading-snug">{problem.name}</SheetTitle>
          <p className="text-xs text-muted-foreground">
            Host <span className="font-mono text-foreground">{hostName}</span>
            {" · "}Triggered {new Date(Number(problem.clock) * 1000).toLocaleString()}
          </p>
        </SheetHeader>

        {/* Action bar */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          <button
            onClick={() => setTab("overview")}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-md border px-2.5 py-2 text-xs font-semibold transition-colors",
              isAck
                ? "border-success/40 bg-success/10 text-success"
                : "border-border bg-card text-foreground hover:bg-muted",
            )}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            {isAck ? "Acknowledged" : "Acknowledge"}
          </button>
          <button
            onClick={() => setTab("ai")}
            className="inline-flex items-center justify-center gap-1.5 rounded-md bg-gradient-primary px-2.5 py-2 text-xs font-semibold text-primary-foreground shadow-glow hover:opacity-95"
          >
            <Bot className="h-3.5 w-3.5" />
            Explain with AI
          </button>
          <button
            onClick={() => setTab("remediate")}
            className="inline-flex items-center justify-center gap-1.5 rounded-md border border-success/40 bg-success/10 px-2.5 py-2 text-xs font-semibold text-success hover:bg-success/15"
          >
            <Zap className="h-3.5 w-3.5" />
            Auto-Remediate
          </button>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="mt-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="ai">AI Copilot</TabsTrigger>
            <TabsTrigger value="remediate">Remediate</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
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
              <div className="mt-2 flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">Actor: {actor}</span>
                <button
                  disabled={isAck || acking}
                  onClick={handleAck}
                  className="inline-flex items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-[11px] font-semibold text-background hover:opacity-90 disabled:opacity-40"
                >
                  {acking ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                  {isAck ? "Acknowledged" : "Acknowledge"}
                </button>
              </div>
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

            {policy === "off" && (
              <div className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/5 p-3 text-xs text-warning">
                <ShieldAlert className="mt-0.5 h-4 w-4" />
                <div>
                  <p className="font-semibold">AI Auto Remediation is not enabled for this asset.</p>
                  <p className="mt-0.5 text-[11px] opacity-80">
                    Configure a trust policy for <span className="font-mono">{hostName}</span> in
                    Infrastructure → Policies to enable suggest / approval / autonomous modes.
                  </p>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="ai" className="mt-3">
            <AiExplainPanel
              eventId={problem.eventid}
              trigger={problem.name}
              host={hostName}
              severity={SEVERITY_LABEL[problem.severity]}
              opdata={problem.opdata}
              triggeredAt={new Date(Number(problem.clock) * 1000).toISOString()}
              actor={actor}
            />
          </TabsContent>

          <TabsContent value="remediate" className="mt-3">
            <AutoRemediatePanel
              assetKey={hostName}
              eventId={problem.eventid}
              trigger={problem.name}
              host={hostName}
              actor={actor}
            />
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
