import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/layout/PageHeader";
import { useI18n } from "@/contexts/I18nContext";
import { useZabbixHosts, useZabbixProblems, severityTier, type ZHost } from "@/lib/zabbix";
import {
  Server, Boxes, Network, Database, Layers, Router, Cable, HardDrive,
  Search, Filter, Loader2, ShieldAlert, AlertTriangle,
} from "lucide-react";

const TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  server: Server, container: Boxes, k8s_cluster: Layers, application: Boxes,
  router: Router, switch: Cable, database: Database, load_balancer: Network, storage: HardDrive,
};

const inv = (h: ZHost): Record<string, string> =>
  (h.inventory && !Array.isArray(h.inventory) ? h.inventory : {}) as Record<string, string>;

const guessType = (h: ZHost): string => {
  const it = inv(h).type?.toLowerCase() ?? "";
  if (/router/.test(it)) return "router";
  if (/switch/.test(it)) return "switch";
  if (/database|db/.test(it)) return "database";
  if (/storage|nas|san/.test(it)) return "storage";
  if (/container|docker|k8s|kubernetes/.test(it)) return "container";
  if (/load.?balancer|lb|haproxy|nginx/.test(it)) return "load_balancer";
  if (/app/.test(it)) return "application";
  return "server";
};

const criticalityFromTags = (h: ZHost): "critical" | "high" | "medium" | "low" => {
  const v = h.tags?.find((t) => /^(criticality|tier|severity)$/i.test(t.tag))?.value?.toLowerCase();
  if (v === "critical" || v === "tier1" || v === "1") return "critical";
  if (v === "high" || v === "tier2" || v === "2") return "high";
  if (v === "medium" || v === "tier3" || v === "3") return "medium";
  return "low";
};

const statusOf = (h: ZHost) =>
  h.status === "1" ? "decommissioned" : h.available === "2" ? "maintenance" : "active";

const CRIT_BADGE: Record<string, string> = {
  critical: "bg-destructive/15 text-destructive ring-destructive/30",
  high: "bg-warning/15 text-warning ring-warning/30",
  medium: "bg-primary/15 text-primary ring-primary/30",
  low: "bg-muted text-muted-foreground ring-border",
};

const STATUS_BADGE: Record<string, string> = {
  active: "bg-success/15 text-success ring-success/30",
  maintenance: "bg-warning/15 text-warning ring-warning/30",
  decommissioned: "bg-muted text-muted-foreground ring-border",
};

const Assets = () => {
  const { t } = useI18n();
  const { data: hosts = [], isLoading, error } = useZabbixHosts();
  const { data: problems = [] } = useZabbixProblems();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [critFilter, setCritFilter] = useState("all");

  const enriched = useMemo(() => hosts.map((h) => {
    const type = guessType(h);
    const criticality = criticalityFromTags(h);
    const status = statusOf(h);
    const i = inv(h);
    const ip = h.interfaces?.[0]?.ip ?? "";
    const hostProblems = problems.filter((p) => p.hosts?.some((ph) => ph.hostid === h.hostid));
    const worst = hostProblems.reduce<"critical" | "high" | "medium" | "low" | null>((acc, p) => {
      const tier = severityTier(p.severity);
      const order = { critical: 4, high: 3, medium: 2, low: 1 } as const;
      if (!acc || order[tier] > order[acc]) return tier;
      return acc;
    }, null);
    return {
      h,
      id: h.hostid,
      name: h.name,
      hostname: h.host,
      ip_address: ip,
      asset_type: type,
      environment: i.tag ?? h.tags?.find((t) => t.tag === "env")?.value ?? "—",
      criticality,
      status,
      os: i.os ?? "—",
      location: i.location ?? h.tags?.find((t) => t.tag.toLowerCase() === "country")?.value ?? "—",
      activeProblems: hostProblems.length,
      worstSeverity: worst,
    };
  }), [hosts, problems]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return enriched.filter((a) => {
      if (typeFilter !== "all" && a.asset_type !== typeFilter) return false;
      if (critFilter !== "all" && a.criticality !== critFilter) return false;
      if (!q) return true;
      return [a.name, a.hostname, a.ip_address, a.os, a.location].filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [enriched, search, typeFilter, critFilter]);

  const counts = useMemo(() => ({
    total: enriched.length,
    critical: enriched.filter((a) => a.criticality === "critical").length,
    maint: enriched.filter((a) => a.status === "maintenance").length,
    types: new Set(enriched.map((a) => a.asset_type)).size,
  }), [enriched]);

  return (
    <div className="flex flex-col">
      <PageHeader
        title={t("cmdb.assets.title")}
        subtitle={`${t("cmdb.assets.subtitle")} · live from Zabbix`}
        icon={Server}
      />

      {error && (
        <div className="mx-6 mb-2 flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/5 p-3 text-xs text-warning">
          <AlertTriangle className="h-4 w-4" /> {String(error instanceof Error ? error.message : error)}
        </div>
      )}

      <div className="grid gap-4 px-6 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={t("cmdb.assets.total")} value={counts.total} icon={Server} />
        <Stat label={t("cmdb.assets.critical")} value={counts.critical} icon={ShieldAlert} accent="destructive" />
        <Stat label={t("cmdb.assets.maintenance")} value={counts.maint} icon={Filter} accent="warning" />
        <Stat label={t("cmdb.assets.types")} value={counts.types} icon={Layers} />
      </div>

      <div className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("cmdb.assets.search")}
            className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
        </div>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
          className="h-10 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15">
          <option value="all">{t("cmdb.assets.allTypes")}</option>
          {Object.keys(TYPE_ICONS).map((tp) => (
            <option key={tp} value={tp}>{tp.replace("_", " ")}</option>
          ))}
        </select>
        <select value={critFilter} onChange={(e) => setCritFilter(e.target.value)}
          className="h-10 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15">
          <option value="all">{t("cmdb.assets.allCrit")}</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>

      <div className="px-6 pb-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
            {t("cmdb.assets.empty")}
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">{t("cmdb.assets.col.asset")}</th>
                  <th className="px-4 py-3">{t("cmdb.assets.col.type")}</th>
                  <th className="px-4 py-3">{t("cmdb.assets.col.criticality")}</th>
                  <th className="px-4 py-3">{t("cmdb.assets.col.status")}</th>
                  <th className="px-4 py-3">Active alerts</th>
                  <th className="px-4 py-3">{t("cmdb.assets.col.location")}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => {
                  const Icon = TYPE_ICONS[a.asset_type] ?? Server;
                  return (
                    <tr key={a.id} className="border-b border-border/60 last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <Link to={`/cmdb/assets/${a.id}`} className="flex items-center gap-3 group">
                          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted/60 ring-1 ring-border group-hover:bg-primary/10 group-hover:ring-primary/30">
                            <Icon className="h-4 w-4 text-foreground group-hover:text-primary" />
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-foreground group-hover:text-primary">{a.name}</p>
                            <p className="truncate text-xs text-muted-foreground">{a.hostname || a.ip_address || "—"}</p>
                          </div>
                        </Link>
                      </td>
                      <td className="px-4 py-3 capitalize text-muted-foreground">{a.asset_type.replace("_", " ")}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ring-1 ${CRIT_BADGE[a.criticality]}`}>
                          {a.criticality}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ring-1 ${STATUS_BADGE[a.status]}`}>
                          {a.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {a.activeProblems > 0 ? (
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${a.worstSeverity ? CRIT_BADGE[a.worstSeverity] : CRIT_BADGE.medium}`}>
                            <AlertTriangle className="h-3 w-3" /> {a.activeProblems}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{a.location}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

const Stat = ({
  label, value, icon: Icon, accent,
}: {
  label: string; value: number; icon: React.ComponentType<{ className?: string }>;
  accent?: "destructive" | "warning";
}) => (
  <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-all hover:-translate-y-0.5 hover:shadow-elevated">
    <span className={`flex h-10 w-10 items-center justify-center rounded-lg ring-1 ${
      accent === "destructive" ? "bg-destructive/10 text-destructive ring-destructive/20"
      : accent === "warning" ? "bg-warning/10 text-warning ring-warning/20"
      : "bg-primary/10 text-primary ring-primary/20"
    }`}>
      <Icon className="h-5 w-5" />
    </span>
    <div>
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold tracking-tight text-foreground">{value}</p>
    </div>
  </div>
);

export default Assets;
