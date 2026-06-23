import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, ShieldCheck, ShieldX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuditLog } from "@/hooks/useAiOps";

const REDEEM_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sso-redeem`;

type Phase = "working" | "success" | "error";

const friendly = (raw: string) => {
  const m = raw.toLowerCase();
  if (m.includes("expired")) return "This SSO link has expired. Please try again.";
  if (m.includes("already been used") || m.includes("replay")) return "This SSO link has already been used.";
  if (m.includes("signature") || m.includes("audience") || m.includes("issuer") || m.includes("malformed")) {
    return "This SSO link is invalid.";
  }
  return raw || "SSO sign-in failed.";
};

export default function AuthSSO() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const audit = useAuditLog();
  const [phase, setPhase] = useState<Phase>("working");
  const [message, setMessage] = useState("Verifying your Zabbix identity…");
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const code = params.get("code");
    const next = params.get("next") || "/";

    if (!code) {
      setPhase("error");
      setMessage("Missing SSO code in URL.");
      return;
    }

    (async () => {
      audit.append({ actor: "sso", kind: "policy-change", message: "SSO redeem initiated" });
      try {
        const res = await fetch(REDEEM_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(payload?.error || `Redeem failed (${res.status})`);
        const session = payload?.session;
        if (!session?.access_token || !session?.refresh_token) {
          throw new Error("SSO response missing session tokens");
        }
        const { error } = await supabase.auth.setSession({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
        });
        if (error) throw error;
        audit.append({
          actor: payload?.identity?.username ?? "sso",
          kind: "policy-change",
          message: "SSO redeem succeeded",
        });
        setPhase("success");
        setMessage("Signed in. Redirecting…");
        setTimeout(() => navigate(next, { replace: true }), 400);
      } catch (e) {
        const msg = friendly((e as Error).message);
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
            {phase === "working" && "Signing you in via Zabbix SSO"}
            {phase === "success" && "Welcome"}
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
              onClick={() => navigate("/diagnostics/sso", { replace: true })}
              className="flex-1 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Open diagnostics
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
