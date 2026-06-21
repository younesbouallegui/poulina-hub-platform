import { useState } from "react";
import { BookOpenText, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useAuditLog } from "@/hooks/useAiOps";

const KNOWLEDGE_ISSUE_URL =
  "https://yweknqfqvjkxepivuufc.supabase.co/functions/v1/sso-issue";
const KNOWLEDGE_RECEIVER_URL = "https://aiknowledge.younesblg.com/auth/sso";

export const KnowledgeSSOButton = () => {
  const { isAuthenticated, user } = useAuth();
  const { toast } = useToast();
  const audit = useAuditLog();
  const [loading, setLoading] = useState(false);

  if (!isAuthenticated || !user) return null;

  const onClick = async () => {
    if (loading) return;
    setLoading(true);
    audit.append({
      actor: user.email,
      kind: "policy-change",
      message: "SSO initiated → Poulina AI Knowledge",
    });
    try {
      // 1) Mint a fresh Zabbix API token for this user via the Hub.
      console.info("[SSO] Requesting Zabbix token mint from Hub…");
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) throw new Error("Your session has expired. Please sign in again.");

      const mintUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/zabbix-token-mint`;
      const mintRes = await fetch(mintUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({}),
      }).catch((e) => {
        throw new Error(`Cannot reach Hub edge function: ${(e as Error).message}`);
      });
      const mintBody = await mintRes.json().catch(() => ({}));
      console.info("[SSO] Mint response", mintRes.status, mintBody);
      if (!mintRes.ok) {
        throw new Error(mintBody?.error || `Token mint failed (${mintRes.status})`);
      }
      const { zabbix_token, zabbix_userid, zabbix_username } = mintBody as {
        zabbix_token?: string; zabbix_userid?: string; zabbix_username?: string;
      };
      if (!zabbix_token) throw new Error("Hub did not return a Zabbix token");

      // 2) Ask Knowledge to issue an SSO code for this user.
      const res = await fetch(KNOWLEDGE_ISSUE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: user.email,
          name: user.name,
          source: "poulina-ai-hub",
          zabbix_token,
          zabbix_userid,
          zabbix_username,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error || `Issue failed (${res.status})`);
      }
      const code: string | undefined = payload?.code ?? payload?.sso_code;
      const redirect: string | undefined = payload?.redirect_url;
      const target =
        redirect ??
        (code
          ? `${KNOWLEDGE_RECEIVER_URL}?code=${encodeURIComponent(code)}&from=hub`
          : null);
      if (!target) throw new Error("No SSO code returned");
      audit.append({
        actor: user.email,
        kind: "policy-change",
        message: "SSO code minted, redirecting to Knowledge",
      });
      window.location.href = target;
    } catch (e) {
      const msg = (e as Error).message || "Failed to start SSO";
      audit.append({
        actor: user.email,
        kind: "policy-change",
        message: `SSO handoff failed: ${msg}`,
      });
      toast({ title: "SSO failed", description: msg, variant: "destructive" });
      setLoading(false);
    }
  };

  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="hidden h-10 items-center gap-2 rounded-lg border border-border bg-card px-3 text-xs font-semibold text-muted-foreground transition-all hover:border-primary/40 hover:text-foreground active:scale-95 disabled:opacity-60 md:flex"
      title="Go to Poulina AI Knowledge (Single Sign-On)"
      aria-label="Go to Poulina AI Knowledge"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookOpenText className="h-4 w-4" />}
      <span className="hidden lg:inline">Knowledge</span>
    </button>
  );
};
