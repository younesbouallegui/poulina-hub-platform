import { useMemo, useState } from "react";
import { ChevronDown, Cpu, HardDrive, MemoryStick, RefreshCw, Server as ServerIcon } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { useI18n } from "@/contexts/I18nContext";
import { cn } from "@/lib/utils";
import { useZabbixHosts, type ZHost } from "@/lib/zabbix";

const Infrastructure = () => {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState<string | null>(null);
  const { data: hosts, isLoading, isError, error, refetch, isFetching, dataUpdatedAt } = useZabbixHosts();

  const lastSync = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString() : "—";

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader
        title={t("infra.title")}
        subtitle={t("infra.subtitle")}
        actions={
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground hover:border-primary/40"
          >
            <RefreshCw className={cn("h-3 w-3", isFetching && "animate-spin")} />
            {isError ? "Zabbix offline" : isLoading ? "Loading…" : `Live · ${hosts?.length ?? 0} hosts · ${lastSync}`}
          </button>
        }
      />

      <div className="flex-1 space-y-3 p-4 sm:p-6">
        {isError && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
            Could not reach Zabbix: {(error as Error)?.message ?? "unknown error"}.
          </div>
        )}
        {isLoading ? (
          <div className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
            <RefreshCw className="mx-auto mb-2 h-4 w-4 animate-spin" /> Fetching hosts from Zabbix…
          </div>
        ) : !hosts || hosts.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
            {t("infra.noServers")}
          </div>
        ) : (
          hosts.map((h) => (
            <ServerRow
              key={h.hostid}
              host={h}
              expanded={expanded === h.hostid}
              onToggle={() => setExpanded((e) => (e === h.hostid ? null : h.hostid))}
            />
          ))
        )}
      </div>
    </div>
  );
};

function availabilityToStatus(av?: string): { color: string; label: string } {
  // Zabbix 6+ availability per-interface, but host.get returns "available" too in many setups.
  // 0 unknown, 1 available, 2 unavailable
  if (av === "1") return { color: "bg-success", label: "available" };
  if (av === "2") return { color: "bg-destructive", label: "unavailable" };
  return { color: "bg-muted-foreground", label: "unknown" };
}

const ServerRow = ({
  host, expanded, onToggle,
}: {
  host: ZHost; expanded: boolean; onToggle: () => void;
}) => {
  const { t } = useI18n();
  const { color, label } = availabilityToStatus(host.available);
  const ip = host.interfaces?.[0]?.ip ?? host.interfaces?.[0]?.dns ?? "—";
  const inv = (Array.isArray(host.inventory) ? {} : host.inventory) ?? {};
  const inventory = inv as Record<string, string>;
  const groups = (host.groups ?? []).map((g) => g.name).join(", ") || "—";

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card transition-all hover-lift">
      <button onClick={onToggle} className="flex w-full items-center gap-4 p-4 text-left transition-colors hover:bg-muted/30">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <ServerIcon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold text-foreground">{host.name || host.host}</p>
            <span className={cn("h-2 w-2 rounded-full", color)} title={label} />
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {host.host} · {ip} · {groups}
          </p>
        </div>
        <div className="hidden items-center gap-2 sm:flex">
          <span className={cn("rounded-md px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider",
            label === "available" ? "bg-success/10 text-success"
            : label === "unavailable" ? "bg-destructive/10 text-destructive"
            : "bg-muted text-muted-foreground")}>
            {label}
          </span>
          <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-mono text-muted-foreground">
            {host.status === "0" ? "enabled" : "disabled"}
          </span>
        </div>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", expanded && "rotate-180")} />
      </button>

      {expanded && (
        <div className="border-t border-border bg-muted/20 p-4 animate-fade-in">
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-xs sm:grid-cols-2">
            <Detail k="Host ID" v={host.hostid} />
            <Detail k="Hostname" v={host.host} />
            <Detail k="IP" v={ip} />
            <Detail k={t("common.status")} v={host.status === "0" ? "enabled" : "disabled"} />
            <Detail k="Availability" v={label} />
            <Detail k="Groups" v={groups} />
            {inventory.os && <Detail k="OS" v={inventory.os} />}
            {inventory.type && <Detail k={t("common.type")} v={inventory.type} />}
            {inventory.vendor && <Detail k="Vendor" v={inventory.vendor} />}
            {inventory.model && <Detail k="Model" v={inventory.model} />}
            {inventory.location && <Detail k="Location" v={inventory.location} />}
          </dl>
          {host.tags && host.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {host.tags.map((tag, i) => (
                <span key={i} className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-mono text-muted-foreground">
                  {tag.tag}{tag.value ? `: ${tag.value}` : ""}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const Detail = ({ k, v }: { k: string; v: string }) => (
  <div className="flex items-center justify-between border-b border-border/60 py-1.5">
    <span className="text-muted-foreground">{k}</span>
    <span className="font-mono text-foreground">{v}</span>
  </div>
);

// silence unused imports for tree-shake friendliness
void Cpu; void HardDrive; void MemoryStick;

export default Infrastructure;
