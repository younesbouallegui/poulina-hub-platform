import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Plug,
  RefreshCw,
  Server,
  Shield,
  Zap,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { Database as DB } from "@/integrations/supabase/types";

type Provider = any;
type SyncLog = any;

const PROVIDER_CATALOG: Array<{
  kind: Provider["kind"];
  name: string;
  description: string;
  available: boolean;
}> = [
  { kind: "zabbix", name: "Zabbix", description: "Monitoring engine — hosts, triggers, problems", available: true },
  { kind: "grafana", name: "Grafana", description: "Dashboards & metrics (coming soon)", available: false },
  { kind: "prometheus", name: "Prometheus", description: "Time-series metrics (coming soon)", available: false },
  { kind: "datadog", name: "Datadog", description: "APM & observability (coming soon)", available: false },
  { kind: "jira", name: "Jira", description: "Incident ticketing (coming soon)", available: false },
  { kind: "slack", name: "Slack", description: "Notifications (coming soon)", available: false },
  { kind: "teams", name: "Microsoft Teams", description: "Notifications (coming soon)", available: false },
  { kind: "huawei_nms", name: "Huawei NMS", description: "Network management (coming soon)", available: false },
];

const statusBadge = (s: Provider["status"]) => {
  switch (s) {
    case "connected":
      return "bg-success/10 text-success ring-1 ring-success/30";
    case "degraded":
      return "bg-warning/10 text-warning ring-1 ring-warning/30";
    case "error":
    case "disconnected":
      return "bg-destructive/10 text-destructive ring-1 ring-destructive/30";
    default:
      return "bg-muted text-muted-foreground ring-1 ring-border";
  }
};

const formatRelative = (iso?: string | null) => {
  if (!iso) return "never";
  const diff = Math.floor((Date.now() - +new Date(iso)) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(iso).toLocaleString();
};

export default function IntegrationCenter() {
  const { hasRole } = useAuth();
  const { toast } = useToast();
  const isAdmin = hasRole("admin") || hasRole("super_admin");

  const [providers, setProviders] = useState<Provider[]>([]);
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const zabbixProvider = useMemo(
    () => providers.find((p) => p.kind === "zabbix") ?? null,
    [providers],
  );

  const load = async () => {
    const [{ data: provs }, { data: l }] = await Promise.all([
      (supabase as any).from("monitoring_providers").select("*").order("created_at"),
      (supabase as any)
        .from("monitoring_sync_logs")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(20),
    ]);
    setProviders(provs ?? []);
    setLogs(l ?? []);
  };

  useEffect(() => {
    load().finally(() => setLoading(false));
    const channel = supabase
      .channel("integration-center")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "monitoring_providers" },
        () => load(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "monitoring_sync_logs" },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const ensureZabbixProvider = async () => {
    const { data, error } = await (supabase as any)
      .from("monitoring_providers")
      .insert({
        kind: "zabbix",
        name: "Zabbix Production",
        status: "unconfigured",
        secret_ref: "ZABBIX_API_TOKEN",
        config: { token_secret: "ZABBIX_API_TOKEN", url_secret: "ZABBIX_URL" },
      })
      .select("*")
      .single();
    if (error) {
      toast({ title: "Failed to create provider", description: error.message, variant: "destructive" });
      return null;
    }
    setProviders((p) => [...p, data]);
    return data;
  };

  const callConnector = async (providerId: string | null, action: "test" | "sync") => {
    setBusyId(providerId ?? "test");
    try {
      const { data, error } = await supabase.functions.invoke("zabbix-connector", {
        body: { action, providerId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (action === "test") {
        toast({
          title: "Zabbix connection OK",
          description: `API v${data.version} · ${data.latency_ms}ms`,
        });
      } else {
        toast({
          title: "Sync complete",
          description: `${data.hosts ?? 0} hosts · ${data.alerts ?? 0} alerts · ${data.duration_ms}ms`,
        });
      }
      load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ title: `${action} failed`, description: msg, variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const onTestZabbix = async () => {
    let p = zabbixProvider;
    if (!p) p = await ensureZabbixProvider();
    if (!p) return;
    await callConnector(p.id, "test");
  };

  const onSyncZabbix = async () => {
    let p = zabbixProvider;
    if (!p) p = await ensureZabbixProvider();
    if (!p) return;
    await callConnector(p.id, "sync");
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Integration Center"
        subtitle="Centralized provider governance — credentials, sync, and health"
        icon={Plug}
      />

      <div className="space-y-6 p-4 sm:p-6">
        {!isAdmin && (
          <div className="rounded-lg border border-warning/30 bg-warning/5 p-4 text-sm text-warning">
            <Shield className="mr-2 inline h-4 w-4" />
            Read-only — only admins can configure providers and trigger syncs.
          </div>
        )}

        {/* Zabbix Card */}
        <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
                <Server className="h-6 w-6" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold tracking-tight">Zabbix</h2>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                      statusBadge(zabbixProvider?.status ?? "unconfigured"),
                    )}
                  >
                    {zabbixProvider?.status ?? "unconfigured"}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Live monitoring backend. Token stored server-side as <code className="font-mono text-xs">ZABBIX_API_TOKEN</code>.
                </p>
                <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs sm:grid-cols-4">
                  <div>
                    <dt className="text-muted-foreground">Last sync</dt>
                    <dd className="font-medium">{formatRelative(zabbixProvider?.last_sync_at)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Health</dt>
                    <dd className="font-medium">{zabbixProvider?.health_score ?? 0}%</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Interval</dt>
                    <dd className="font-medium">{zabbixProvider?.sync_interval_minutes ?? 5}m</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">URL secret</dt>
                    <dd className="font-mono text-[11px]">ZABBIX_URL</dd>
                  </div>
                </dl>
                {zabbixProvider?.last_error && (
                  <p className="mt-3 flex items-start gap-1.5 rounded-md bg-destructive/5 p-2 text-xs text-destructive">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {zabbixProvider.last_error}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={onTestZabbix}
                disabled={!isAdmin || busyId !== null}
                className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:border-primary/40 hover:text-primary disabled:opacity-50"
              >
                {busyId === (zabbixProvider?.id ?? "test") ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Activity className="h-4 w-4" />
                )}
                Test connection
              </button>
              <button
                onClick={onSyncZabbix}
                disabled={!isAdmin || busyId !== null}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {busyId === zabbixProvider?.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Sync now
              </button>
            </div>
          </div>
        </section>

        {/* Future providers */}
        <section>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Future providers
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {PROVIDER_CATALOG.filter((p) => p.kind !== "zabbix").map((p) => (
              <div
                key={p.kind}
                className="rounded-lg border border-dashed border-border bg-card/50 p-4 opacity-70"
              >
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-muted-foreground" />
                  <h4 className="font-medium">{p.name}</h4>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{p.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Sync logs */}
        {isAdmin && (
          <section className="rounded-xl border border-border bg-card shadow-sm">
            <div className="border-b border-border px-5 py-3">
              <h3 className="text-sm font-semibold">Recent sync runs</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 text-left font-semibold">Provider</th>
                    <th className="px-4 py-2 text-left font-semibold">Started</th>
                    <th className="px-4 py-2 text-left font-semibold">Result</th>
                    <th className="px-4 py-2 text-left font-semibold">Records</th>
                    <th className="px-4 py-2 text-left font-semibold">Duration</th>
                    <th className="px-4 py-2 text-left font-semibold">Message</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                        No syncs yet — click <em>Sync now</em> on a provider.
                      </td>
                    </tr>
                  )}
                  {logs.map((l) => {
                    const provider = providers.find((p) => p.id === l.provider_id);
                    return (
                      <tr key={l.id} className="border-b border-border last:border-0">
                        <td className="px-4 py-2 font-medium">{provider?.name ?? "—"}</td>
                        <td className="px-4 py-2 text-muted-foreground">{formatRelative(l.started_at)}</td>
                        <td className="px-4 py-2">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                              l.result === "ok"
                                ? "bg-success/10 text-success"
                                : l.result === "error"
                                  ? "bg-destructive/10 text-destructive"
                                  : l.result === "running"
                                    ? "bg-primary/10 text-primary"
                                    : "bg-warning/10 text-warning",
                            )}
                          >
                            {l.result === "ok" && <CheckCircle2 className="h-3 w-3" />}
                            {l.result === "error" && <AlertTriangle className="h-3 w-3" />}
                            {l.result === "running" && <Loader2 className="h-3 w-3 animate-spin" />}
                            {l.result}
                          </span>
                        </td>
                        <td className="px-4 py-2">{l.records_ingested}</td>
                        <td className="px-4 py-2 text-muted-foreground">{l.duration_ms ? `${l.duration_ms}ms` : "—"}</td>
                        <td className="px-4 py-2 text-xs text-muted-foreground">{l.message ?? "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
