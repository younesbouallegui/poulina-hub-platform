import { useState } from "react";
import { BookOpenText, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useAuditLog } from "@/hooks/useAiOps";

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
      // Guard: re-verify a live Supabase session AND user before minting.
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (!accessToken || userErr || !userData?.user) {
        toast({
          title: "Please sign in again",
          description: "Your Hub session has expired. Redirecting to login…",
          variant: "destructive",
        });
        setLoading(false);
        window.location.href = "/login?next=/";
        return;
      }
      const meta = (userData.user.user_metadata ?? {}) as Record<string, unknown>;
      if (!meta.zabbix_userid || !meta.zabbix_username) {
        throw new Error(
          "Your Hub account is not linked to a Zabbix identity. Please sign out and sign in again with your Zabbix credentials.",
        );
      }


      const mintUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sso-token-mint`;
      const res = await fetch(mintUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ target: "knowledge" }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body?.redirect_url) {
        throw new Error(body?.error || `SSO mint failed (${res.status})`);
      }
      audit.append({
        actor: user.email,
        kind: "policy-change",
        message: "SSO token minted, redirecting to Knowledge",
      });
      window.location.href = body.redirect_url as string;
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
