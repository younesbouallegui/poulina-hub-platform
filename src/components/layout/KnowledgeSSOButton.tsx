import { useState } from "react";
import { BookOpenText, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useAuditLog } from "@/hooks/useAiOps";

const KNOWLEDGE_RECEIVER_URL = "https://aiknowledge.younesblg.com/auth/sso";

export const KnowledgeSSOButton = () => {
  const { isAuthenticated, user } = useAuth();
  const { toast } = useToast();
  const audit = useAuditLog();
  const [loading, setLoading] = useState(false);

  if (!isAuthenticated) return null;

  const onClick = async () => {
    if (loading) return;
    setLoading(true);
    audit.append({
      actor: user?.email ?? "user",
      kind: "policy-change",
      message: "SSO initiated → Poulina AI Knowledge",
    });
    try {
      const { data, error } = await supabase.functions.invoke("sso-issue", {
        body: { audience: "knowledge" },
      });
      if (error) throw error;
      const code = (data as { code?: string })?.code;
      if (!code) throw new Error("No SSO code returned");
      const url = `${KNOWLEDGE_RECEIVER_URL}?code=${encodeURIComponent(code)}&from=hub`;
      window.location.href = url;
    } catch (e) {
      const msg = (e as Error).message || "Failed to start SSO";
      audit.append({
        actor: user?.email ?? "user",
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
