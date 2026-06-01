// Lovable AI Operations Copilot — streaming incident analysis.
// Uses Lovable AI Gateway (free Gemini tier by default).

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface IncidentCtx {
  eventId?: string;
  trigger?: string;
  host?: string;
  hostGroup?: string;
  severity?: string;
  opdata?: string;
  triggeredAt?: string;
  relatedIncidents?: Array<{
    id: string;
    name: string;
    resolution?: string;
    similarity?: number;
  }>;
  metrics?: Record<string, string | number>;
  services?: string[];
}

interface Body {
  mode?: "explain" | "chat" | "remediate";
  incident?: IncidentCtx;
  messages?: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  model?: string;
}

function buildSystem(mode: NonNullable<Body["mode"]>): string {
  const base =
    "You are AIOps Copilot — a senior SRE assistant embedded in an enterprise operations platform. " +
    "Be precise, structured, and concise. Use markdown with clear ## section headers. " +
    "Never invent host names, IDs, or metrics. If data is missing, say so.";
  if (mode === "explain") {
    return (
      base +
      "\n\nProduce EXACTLY these sections in order:\n" +
      "## Incident Summary\n## Root Cause Analysis\n## Investigation Guide\n## Remediation Guide\n## Prevention Plan"
    );
  }
  if (mode === "remediate") {
    return (
      base +
      "\n\nProduce a safe REMEDIATION PLAN as ordered steps. " +
      "For each step include: action, target host, risk level, reversible (yes/no), and approval requirement when risk >= medium. " +
      "End with a one-line confidence estimate."
    );
  }
  return base + "\n\nAnswer the user's operations question grounded in the provided incident context.";
}

function contextBlock(i?: IncidentCtx): string {
  if (!i) return "";
  const lines = [
    "## Incident Context",
    `- Event ID: ${i.eventId ?? "n/a"}`,
    `- Trigger: ${i.trigger ?? "n/a"}`,
    `- Host: ${i.host ?? "n/a"}`,
    `- Host group: ${i.hostGroup ?? "n/a"}`,
    `- Severity: ${i.severity ?? "n/a"}`,
    `- Operational data: ${i.opdata ?? "n/a"}`,
    `- Triggered at: ${i.triggeredAt ?? "n/a"}`,
  ];
  if (i.services?.length) lines.push(`- Services impacted: ${i.services.join(", ")}`);
  if (i.metrics) lines.push(`- Recent metrics: ${JSON.stringify(i.metrics)}`);
  if (i.relatedIncidents?.length) {
    lines.push("- Related historical incidents:");
    for (const r of i.relatedIncidents) {
      lines.push(
        `  • #${r.id} ${r.name}${r.similarity ? ` (${r.similarity}% similar)` : ""}${r.resolution ? ` → ${r.resolution}` : ""}`,
      );
    }
  }
  return lines.join("\n");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = (await req.json()) as Body;
    const mode: NonNullable<Body["mode"]> = body.mode ?? "explain";
    const model = body.model ?? "google/gemini-3-flash-preview";

    const messages: Array<{ role: string; content: string }> = [
      { role: "system", content: buildSystem(mode) },
    ];

    if (mode === "chat") {
      if (body.incident) {
        messages.push({ role: "system", content: contextBlock(body.incident) });
      }
      for (const m of body.messages ?? []) messages.push(m);
    } else {
      const ask =
        mode === "explain"
          ? "Analyze this incident and produce the full structured report."
          : "Produce a safe remediation plan for this incident.";
      messages.push({
        role: "user",
        content: `${ask}\n\n${contextBlock(body.incident)}`,
      });
    }

    const upstream = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model, messages, stream: true }),
    });

    if (!upstream.ok) {
      if (upstream.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit reached. Try again shortly." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (upstream.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Add credits in workspace settings." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const txt = await upstream.text();
      console.error("AI gateway error", upstream.status, txt);
      return new Response(
        JSON.stringify({ error: "AI gateway error", details: txt }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(upstream.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("incident-ai error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
