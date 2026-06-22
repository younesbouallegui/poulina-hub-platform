import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, ShieldCheck, ShieldX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuditLog } from "@/hooks/useAiOps";

const KNOWLEDGE_REDEEM_URL =
  `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sso-redeem`;

type Phase = "working" | "success" | "error";

const friendlyError = (raw: string): string => {
  const m = raw.toLowerCase();
  if (m.includes("expired")) return "This SSO link has expired. Please try again from Poulina AI Knowledge.";
  if (m.includes("consumed") || m.includes("already")) return "This SSO link has already been used. Please request a new one.";
  if (m.includes("invalid") || m.includes("not found")) return "Invalid SSO code. Please request a fresh link.";
  if (m.includes("network") || m.includes("failed to fetch")) return "Network error while contacting Poulina AI Knowledge.";
  return raw || "SSO sign-in failed.";
};

const parseJson = async (res: Response) => {
  const text = await res.text().catch(() => "");
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { raw: text.slice(0, 500) };
  }
};

export default function AuthSSO() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const audit = useAuditLog();
  const [phase, setPhase] = useState<Phase>("working");
  const [message, setMessage] = useState("Establishing your secure session…");
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const code = params.get("code");
    const next = params.get("next") || "/";

    if (!code) {
      setPhase("error");
      setMessage("Missing SSO code in URL.");
      audit.append({ actor: "sso", kind: "policy-change", message: "SSO redeem aborted: missing code" });
      return;
    }

    (async () => {
      audit.append({ actor: "sso", kind: "policy-change", message: "SSO redeem initiated" });
      try {
        const healthUrl = `${KNOWLEDGE_REDEEM_URL}/sso/health`;
        console.info("[SSO Receiver] Checking Hub receiver connectivity", { healthUrl });
        const healthRes = await fetch(healthUrl).catch((e) => {
          throw new Error(`Cannot reach Hub sso-redeem health endpoint: ${(e as Error).message}`);
        });
        const healthPayload = await parseJson(healthRes);
        console.info("[SSO Receiver] Health response", { status: healthRes.status, payload: healthPayload });
        if (!healthRes.ok || healthPayload?.status !== "ok") {
          throw new Error(`Hub SSO receiver health check failed (${healthRes.status})`);
        }

        console.info("[SSO Receiver] Redeem attempt started", {
          endpoint: KNOWLEDGE_REDEEM_URL,
          code_present: true,
          next,
        });
        const res = await fetch(KNOWLEDGE_REDEEM_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, next }),
        }).catch((e) => {
          throw new Error(`Cannot reach Hub sso-redeem: ${(e as Error).message}`);
        });
        const payload = await parseJson(res);
        console.info("[SSO Receiver] Redeem response", { status: res.status, payload });
        if (!res.ok) {
          throw new Error(payload?.error || `Redeem failed (${res.status})`);
        }

        // Accept several response shapes coming back from the Knowledge platform.
        const session =
          payload?.session ??
          (payload?.access_token && payload?.refresh_token ? payload : null);

        if (!session?.access_token || !session?.refresh_token) {
          throw new Error("SSO response did not include a valid session");
        }

        const { error } = await supabase.auth.setSession({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
        });
        if (error) throw error;
        console.info("[SSO Receiver] Session created", {
          user_email: payload?.user?.email,
          redirect: next,
        });

        audit.append({
          actor: payload?.user?.email ?? "sso",
          kind: "policy-change",
          message: "SSO redeem succeeded",
        });
        setPhase("success");
        setMessage("Signed in. Redirecting…");
        setTimeout(() => navigate(next, { replace: true }), 600);
      } catch (e) {
        const msg = friendlyError((e as Error).message);
        console.error("[SSO Receiver] Redeem failed", { reason: msg });
        audit.append({ actor: "sso", kind: "policy-change", message: `SSO redeem failed: ${msg}` });
        setPhase("error");
        setMessage(msg);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-elevated">
        <div className="mb-5 flex items-center gap-3">
          {phase === "working" && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
          {phase === "success" && <ShieldCheck className="h-5 w-5 text-success" />}
          {phase === "error" && <ShieldX className="h-5 w-5 text-destructive" />}
          <h1 className="text-lg font-semibold text-foreground">
            {phase === "working" && "Signing you in via Poulina AI Knowledge"}
            {phase === "success" && "Welcome back"}
            {phase === "error" && "SSO sign-in failed"}
          </h1>
        </div>
        <p className="text-sm text-muted-foreground">{message}</p>
        {phase === "error" && (
          <div className="mt-6 flex gap-2">
            <button
              onClick={() => navigate("/login", { replace: true })}
              className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
            >
              Go to login
            </button>
            <button
              onClick={() => (window.location.href = "https://aiknowledge.younesblg.com/")}
              className="flex-1 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Back to Knowledge
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
