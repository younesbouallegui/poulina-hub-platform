// SSE streaming helper for the incident-ai edge function.
// Robust line-by-line parser, handles CRLF, comments, partial JSON, and [DONE].

import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/integrations/supabase/client";

const ENDPOINT = `${SUPABASE_URL}/functions/v1/incident-ai`;

export interface AiStreamInput {
  mode: "explain" | "chat" | "remediate";
  incident?: Record<string, unknown>;
  messages?: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  model?: string;
  signal?: AbortSignal;
  onDelta: (chunk: string) => void;
  onDone: () => void;
  onError?: (err: { status: number; message: string }) => void;
}

export async function streamIncidentAi(opts: AiStreamInput) {
  const { signal, onDelta, onDone, onError, ...payload } = opts;
  let response: Response;
  try {
    response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify(payload),
      signal,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      return;
    }
    onError?.({ status: 0, message: e instanceof Error ? e.message : "Network error" });
    return;
  }

  if (!response.ok || !response.body) {
    let msg = `Request failed (${response.status})`;
    try {
      const j = await response.json();
      if (j?.error) msg = j.error;
      else if (j?.message) msg = j.message;
    } catch {
      /* noop */
    }
    if (response.status === 404) {
      msg = "AI streaming service is not deployed yet. The client is fixed now, but the backend function must finish deploying.";
    }
    onError?.({ status: response.status, message: msg });
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let done = false;

  while (!done) {
    const { value, done: streamDone } = await reader.read();
    if (streamDone) break;
    buffer += decoder.decode(value, { stream: true });

    let idx: number;
    while ((idx = buffer.indexOf("\n")) !== -1) {
      let line = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (!line || line.startsWith(":")) continue;
      if (!line.startsWith("data: ")) continue;
      const json = line.slice(6).trim();
      if (json === "[DONE]") {
        done = true;
        break;
      }
      try {
        const parsed = JSON.parse(json);
        const delta = parsed?.choices?.[0]?.delta?.content as string | undefined;
        if (delta) onDelta(delta);
      } catch {
        // partial chunk — put back
        buffer = line + "\n" + buffer;
        break;
      }
    }
  }

  const trailing = buffer.trim();
  if (trailing) {
    for (const rawLine of trailing.split("\n")) {
      let line = rawLine;
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (!line || line.startsWith(":")) continue;
      if (!line.startsWith("data: ")) continue;
      const json = line.slice(6).trim();
      if (json === "[DONE]") continue;
      try {
        const parsed = JSON.parse(json);
        const delta = parsed?.choices?.[0]?.delta?.content as string | undefined;
        if (delta) onDelta(delta);
      } catch {
        /* ignore incomplete trailing frame */
      }
    }
  }

  onDone();
}
