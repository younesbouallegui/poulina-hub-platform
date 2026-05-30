// SSE streaming helper for the incident-ai edge function.
// Robust line-by-line parser, handles CRLF, comments, partial JSON, and [DONE].

const ENDPOINT = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/incident-ai`;
const PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

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
        Authorization: `Bearer ${PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify(payload),
      signal,
    });
  } catch (e) {
    onError?.({ status: 0, message: e instanceof Error ? e.message : "Network error" });
    return;
  }

  if (!response.ok || !response.body) {
    let msg = `Request failed (${response.status})`;
    try {
      const j = await response.json();
      if (j?.error) msg = j.error;
    } catch {
      /* noop */
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

  onDone();
}
