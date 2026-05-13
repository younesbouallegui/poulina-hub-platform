import { useParams, Link } from "react-router-dom";
import { PageHeader } from "@/components/layout/PageHeader";
import { useI18n } from "@/contexts/I18nContext";
import {
  ArrowLeft, Server, Loader2, Tag, MapPin, Network, Cpu, Building2, ShieldAlert, AlertTriangle,
} from "lucide-react";
import { useZabbixHosts, useZabbixProblems, severityTier, severityName } from "@/lib/zabbix";

const AssetDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { t } = useI18n();
  const { data: hosts = [], isLoading } = useZabbixHosts();
  const { data: problems = [] } = useZabbixProblems();

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const host = hosts.find((h) => h.hostid === id);
  if (!host) {
    return <div className="px-6 py-10 text-center text-sm text-muted-foreground">Host not found in Zabbix.</div>;
  }

  const inv = (host.inventory && !Array.isArray(host.inventory) ? host.inventory : {}) as Record<string, string>;
  const ip = host.interfaces?.[0]?.ip ?? "—";
  const hostProblems = problems.filter((p) => p.hosts?.some((ph) => ph.hostid === host.hostid));
  const criticality = host.tags?.find((t) => /^(criticality|tier|severity)$/i.test(t.tag))?.value ?? "—";
  const env = host.tags?.find((t) => t.tag.toLowerCase() === "env")?.value ?? "—";
  const status = host.status === "1" ? "disabled" : host.available === "2" ? "unavailable" : "active";

  return (
    <div className="flex flex-col">
      <PageHeader
        title={host.name}
        subtitle={host.host}
        icon={Server}
        action={
          <Link to="/cmdb/assets" className="flex items-center gap-1.5 rounded-lg border border-input px-3 py-1.5 text-xs font-medium text-muted-foreground transition-all hover:border-primary/40 hover:text-primary">
            <ArrowLeft className="h-3.5 w-3.5" />
            {t("cmdb.detail.back")}
          </Link>
        }
      />

      <div className="grid gap-4 px-6 lg:grid-cols-3">
        <Card title={t("cmdb.detail.identity")} icon={Cpu}>
          <Row label="Host ID" value={<span className="font-mono text-xs">{host.hostid}</span>} />
          <Row label={t("cmdb.detail.env")} value={env} />
          <Row label={t("cmdb.detail.os")} value={inv.os ?? "—"} />
          <Row label="Vendor" value={inv.vendor ?? "—"} />
          <Row label="Model" value={inv.model ?? "—"} />
          <Row label={t("cmdb.detail.status")} value={status} />
        </Card>

        <Card title={t("cmdb.detail.network")} icon={Network}>
          <Row label="IP" value={ip} />
          <Row label="DNS" value={host.interfaces?.[0]?.dns ?? "—"} />
          <Row label={<span className="flex items-center gap-1.5"><MapPin className="h-3 w-3" />{t("cmdb.detail.location")}</span>} value={inv.location ?? "—"} />
        </Card>

        <Card title={t("cmdb.detail.governance")} icon={Building2}>
          <Row label={t("cmdb.detail.criticality")} value={
            <span className="inline-flex items-center gap-1.5 capitalize">
              <ShieldAlert className={`h-3.5 w-3.5 ${criticality === "critical" ? "text-destructive" : criticality === "high" ? "text-warning" : "text-muted-foreground"}`} />
              {criticality}
            </span>
          } />
          <Row label="Groups" value={
            <div className="flex flex-wrap gap-1 justify-end">
              {(host.groups ?? []).length === 0 && "—"}
              {(host.groups ?? []).map((g) => (
                <span key={g.groupid} className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground ring-1 ring-border">{g.name}</span>
              ))}
            </div>
          } />
          <Row label={t("cmdb.detail.tags")} value={
            <div className="flex flex-wrap gap-1 justify-end">
              {(host.tags ?? []).length === 0 && "—"}
              {(host.tags ?? []).map((tag) => (
                <span key={`${tag.tag}-${tag.value}`} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground ring-1 ring-border">
                  <Tag className="h-2.5 w-2.5" />{tag.tag}{tag.value ? `:${tag.value}` : ""}
                </span>
              ))}
            </div>
          } />
        </Card>
      </div>

      <div className="px-6 py-6">
        <Card title={`Active problems (${hostProblems.length})`} icon={AlertTriangle}>
          {hostProblems.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active problems.</p>
          ) : (
            <ul className="space-y-2">
              {hostProblems.map((p) => {
                const tier = severityTier(p.severity);
                return (
                  <li key={p.eventid}>
                    <Link to="/incidents" className="flex items-center justify-between rounded-lg border border-border bg-background p-3 hover:border-primary/40">
                      <div>
                        <p className="text-sm font-medium text-foreground">{p.name}</p>
                        <p className="text-xs text-muted-foreground">since {new Date(parseInt(p.clock, 10) * 1000).toLocaleString()}</p>
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ring-1 ${
                        tier === "critical" ? "bg-destructive/10 text-destructive ring-destructive/30" :
                        tier === "high" ? "bg-warning/10 text-warning ring-warning/30" :
                        "bg-primary/10 text-primary ring-primary/30"
                      }`}>{severityName(p.severity)}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
};

const Card = ({ title, icon: Icon, children }: { title: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) => (
  <section className="rounded-xl border border-border bg-card p-4">
    <header className="mb-3 flex items-center gap-2">
      <Icon className="h-4 w-4 text-primary" />
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
    </header>
    <div className="space-y-2">{children}</div>
  </section>
);

const Row = ({ label, value }: { label: React.ReactNode; value: React.ReactNode }) => (
  <div className="flex items-start justify-between gap-3 text-sm">
    <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
    <span className="text-right capitalize text-foreground">{value}</span>
  </div>
);

export default AssetDetail;
