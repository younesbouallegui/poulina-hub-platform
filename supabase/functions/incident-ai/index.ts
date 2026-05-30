// Lovable AI Operations Copilot — streaming incident analysis.
// Provider-abstracted: defaults to Lovable AI Gateway (google/gemini-3-flash-preview).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface IncidentCtx {
  eventId?: string;
  trigger?: string;
  host?: string;
  hostGroup?: string;
  severity?: string;
  opdata?: string;
  triggeredAt?: string;
  relatedIncidents?: Array<{ id: string; name: string; resolution?: string; similarity?: number }>;
  metrics?: Record<string, string | number>;
  services?: string[];
}

interface Body {
  mode: "explain" | "chat" | "remediate";
  incident?: IncidentCtx;
  messages?: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  model?: string;
}

const buildSystem = (mode: Body["mode"]) => {
  const base =
    "You are AIOps Copilot — a senior SRE assistant embedded in an enterprise operations platform. " +
    "Be precise, structured, and concise. Use markdown with clear ## section headers. " +
    "Never invent host names, IDs, or metrics. If data is missing, say so.";
  if (mode === "explain") {
    return (
      base +
      "\n\nProduce EXACTLY these sections in order:\n" +
      "## Incident Summary\n(What happened, why, impact scope, affected systems, business impact)\n" +
      "## Root Cause Analysis\n(Likely root cause, confidence %, related symptoms, historical correlation)\n" +
      "## Investigation Guide\n(Numbered steps an on-call engineer should run now)\n" +
      "## Remediation Guide\n(Exact actions — commands or operations — to resolve)\n" +
      "## Prevention Plan\n(Monitoring, threshold, capacity recommendations)"
    );
  }
  if (mode === "remediate") {
    return (
      base +
      "\n\nProduce a safe REMEDIATION PLAN as ordered steps. " +
      "For each step include: action, target host, risk level (low/medium/high), reversible (yes/no), " +
      "and an approval requirement when risk >= medium. End with a one-line confidence estimate."
    );
  }
  return base + "\n\nAnswer the user's operations question grounded in the provided incident context.";
};

const contextBlock = (i?: IncidentCtx) =>
  !i
    ? ""
    : [
        "## Incident Context",
        `- Event ID: ${i.eventId ?? "n/a"}`,
        `- Trigger: ${i.trigger ?? "n/a"}`,
        `- Host: ${i.host ?? "n/a"}`,
        `- Host group: ${i.hostGroup ?? "n/a"}`,
        `- Severity: ${i.severity ?? "n/a"}`,
        `- Operational data: ${i.opdata ?? "n/a"}`,
        `- Triggered at: ${i.triggeredAt ?? "n/a"}`,
        i.services?.length ? `- Services impacted: ${i.services.join(", ")}` : "",
        i.metrics ? `- Recent metrics: ${JSON.stringify(i.metrics)}` : "",
        i.relatedIncidents?.length
          ? `- Related historical incidents:\n${i.relatedIncidents
              .map((r) => `  • #${r.id} ${r.name}${r.similarity ? ` (${r.similarity}% similar)` : ""}${r.resolution ? ` → ${r.resolution}` : ""}`)
              .join("\n")}`
          : "",
      ]
        .filter(Boolean)
        .join("\n");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = (await req.json()) as Body;
    const mode = body.mode ?? "explain";
    const model = body.model ?? "google/gemini-3-flash-preview";

    const messages: Array<{ role: string; content: string }> = [
      { role: "system", content: buildSystem(mode) },
    ];

    if (mode === "chat") {
      if (body.incident) messages.push({ role: "system", content: contextBlock(body.incident) });
      for (const m of body.messages ?? []) messages.push(m);
    } else {
      messages.push({
        role: "user",
        content:
          (mode === "explain"
            ? "Analyze this incident and produce the full structured report."
            : "Produce a safe remediation plan for this incident.") +
          "\n\n" +
          contextBlock(body.incident),
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
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
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
