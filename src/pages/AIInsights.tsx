import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { ChatInterface } from "@/components/ChatInterface";

const buildIncidentBrief = (params: URLSearchParams) => {
  const event = params.get("event");
  if (!event) return undefined;
  const host = params.get("host") ?? "unknown";
  const trigger = params.get("trigger") ?? "unknown trigger";
  const severity = params.get("severity") ?? "n/a";
  const opdata = params.get("opdata") ?? "";
  const triggeredAt = params.get("at") ?? "";

  return `🚨 Investigate incident #${event}

• Host: ${host}
• Trigger: ${trigger}
• Severity: ${severity}
• Triggered at: ${triggeredAt}
${opdata ? `• Operational data: ${opdata}\n` : ""}
Please produce:
1. Incident Summary
2. Root Cause Analysis
3. Investigation Steps
4. Resolution Steps
5. Prevention Plan

Also surface related/historical incidents, key metrics, and dependency impact.`;
};

const AIInsights = () => {
  const [params] = useSearchParams();
  const autoMessage = useMemo(() => buildIncidentBrief(params), [params]);
  const autoMessageKey = params.get("event") ?? undefined;

  return (
    <div className="flex min-h-full flex-col">
      <ChatInterface autoMessage={autoMessage} autoMessageKey={autoMessageKey} />
    </div>
  );
};

export default AIInsights;
