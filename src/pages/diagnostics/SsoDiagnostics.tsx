import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, RefreshCw, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type HealthRow = {
  label: string;
  url: string;
  status: "checking" | "ok" | "error";
  version?: string;
  env?: Record<string, boolean>;
  error?: string;
};

const HUB_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
const KNOWLEDGE_BASE = "https://yweknqfqvjkxepivuufc.supabase.co/functions/v1";

const ENDPOINTS = [
  { label: "Hub · sso-token-mint (sender)", url: `${HUB_BASE}/sso-token-mint?health=1` },
  { label: "Hub · sso-redeem (receiver)", url: `${HUB_BASE}/sso-redeem?health=1` },
  { label: "Knowledge · sso-token-mint (sender)", url: `${KNOWLEDGE_BASE}/sso-token-mint?health=1` },
  { label: "Knowledge · sso-redeem (receiver)", url: `${KNOWLEDGE_BASE}/sso-redeem?health=1` },
];

type AuditRow = {
  id: number;
  direction: string;
  actor_username: string | null;
  actor_zabbix_userid: string | null;
  outcome: string;
  created_at: string;
};

export default function SsoDiagnostics() {
  const [rows, setRows] = useState<HealthRow[]>(
    ENDPOINTS.map((e) => ({ ...e, status: "checking" as const })),
  );
  const [lastExchange, setLastExchange] = useState<AuditRow | null>(null);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const run = async () => {
    setRefreshing(true);
    setRows(ENDPOINTS.map((e) => ({ ...e, status: "checking" })));
    const results = await Promise.all(
      ENDPOINTS.map(async (e): Promise<HealthRow> => {
        try {
          const res = await fetch(e.url, { method: "GET" });
          const body = await res.json().catch(() => ({}));
          if (!res.ok || body?.status !== "ok") {
            return { ...e, status: "error", error: body?.error || `HTTP ${res.status}` };
          }
          return { ...e, status: "ok", version: body.version, env: body.env };
        } catch (err) {
          return { ...e, status: "error", error: (err as Error).message };
        }
      }),
    );
    setRows(results);

    const { data, error } = await supabase
      .from("sso_audit" as never)
      .select("id,direction,actor_username,actor_zabbix_userid,outcome,created_at")
      .eq("outcome", "redeemed")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      setAuditError(error.message);
      setLastExchange(null);
    } else {
      setAuditError(null);
      setLastExchange((data as AuditRow) ?? null);
    }
    setRefreshing(false);
  };

  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">SSO Diagnostics</h1>
          <p className="text-sm text-muted-foreground">
            Health of the Zabbix-identity SSO bridge between Poulina AI Hub and Poulina AI Knowledge.
          </p>
        </div>
        <button
          onClick={run}
          disabled={refreshing}
          className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-60"
        >
          {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Re-check
        </button>
      </div>

      <div className="grid gap-3">
        {rows.map((row) => (
          <div key={row.url} className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {row.status === "checking" && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                {row.status === "ok" && <CheckCircle2 className="h-4 w-4 text-success" />}
                {row.status === "error" && <XCircle className="h-4 w-4 text-destructive" />}
                <span className="font-medium text-foreground">{row.label}</span>
              </div>
              {row.version && (
                <span className="rounded bg-muted px-2 py-0.5 text-xs font-mono text-muted-foreground">
                  {row.version}
                </span>
              )}
            </div>
            <div className="mt-1 break-all text-xs text-muted-foreground">{row.url}</div>
            {row.error && <div className="mt-2 text-xs text-destructive">{row.error}</div>}
            {row.env && (
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                {Object.entries(row.env).map(([k, v]) => (
                  <span
                    key={k}
                    className={`rounded px-2 py-0.5 ${v ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}
                  >
                    {k}: {v ? "set" : "missing"}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-semibold text-foreground">Last successful SSO exchange</h2>
        {auditError && <p className="mt-2 text-xs text-destructive">Could not read audit log: {auditError}</p>}
        {!auditError && !lastExchange && (
          <p className="mt-2 text-xs text-muted-foreground">No successful exchanges recorded yet.</p>
        )}
        {lastExchange && (
          <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <dt className="text-muted-foreground">Direction</dt>
            <dd className="font-mono text-foreground">{lastExchange.direction}</dd>
            <dt className="text-muted-foreground">User</dt>
            <dd className="font-mono text-foreground">
              {lastExchange.actor_username ?? "—"}{" "}
              {lastExchange.actor_zabbix_userid ? `(zbx:${lastExchange.actor_zabbix_userid})` : ""}
            </dd>
            <dt className="text-muted-foreground">When</dt>
            <dd className="font-mono text-foreground">{new Date(lastExchange.created_at).toLocaleString()}</dd>
          </dl>
        )}
      </div>
    </div>
  );
}
