import { useMemo, useState } from "react";
import { ChevronDown, Cpu, HardDrive, MemoryStick, Server as ServerIcon } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/contexts/I18nContext";
import { getServersForUser, ServerInfo } from "@/data/mockData";
import { cn } from "@/lib/utils";

const Infrastructure = () => {
  const { user } = useAuth();
  const { t } = useI18n();
  const [expanded, setExpanded] = useState<string | null>(null);

  const servers = useMemo(
    () => (user ? getServersForUser(user.assignedServers) : []),
    [user],
  );

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader title={t("infra.title")} subtitle={t("infra.subtitle")} />

      <div className="flex-1 space-y-3 p-4 sm:p-6">
        {servers.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
            {t("infra.noServers")}
          </div>
        ) : (
          servers.map((s) => (
            <ServerRow
              key={s.id}
              server={s}
              expanded={expanded === s.id}
              onToggle={() => setExpanded((e) => (e === s.id ? null : s.id))}
            />
          ))
        )}
      </div>
    </div>
  );
};

const ServerRow = ({
  server,
  expanded,
  onToggle,
}: {
  server: ServerInfo;
  expanded: boolean;
  onToggle: () => void;
}) => {
  const { t } = useI18n();
  const statusColor =
    server.status === "healthy"
      ? "bg-success"
      : server.status === "warning"
        ? "bg-warning"
        : "bg-destructive";

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card transition-all hover-lift">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-4 p-4 text-left transition-colors hover:bg-muted/30"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <ServerIcon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold text-foreground">{server.name}</p>
            <span className={cn("h-2 w-2 rounded-full", statusColor)} />
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {server.type} · {server.region} · {server.ipAddress}
          </p>
        </div>
        <div className="hidden items-center gap-4 sm:flex">
          <Metric icon={Cpu} value={server.cpu} />
          <Metric icon={MemoryStick} value={server.memory} />
          <Metric icon={HardDrive} value={server.disk} />
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            expanded && "rotate-180",
          )}
        />
      </button>

      {expanded && (
        <div className="border-t border-border bg-muted/20 p-4 animate-fade-in">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <MetricBar label={t("common.cpu")} value={server.cpu} />
            <MetricBar label={t("common.memory")} value={server.memory} />
            <MetricBar label={t("common.disk")} value={server.disk} />
          </div>
          <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2 text-xs sm:grid-cols-2">
            <Detail k={t("common.region")} v={server.region} />
            <Detail k={t("common.type")} v={server.type} />
            <Detail k="OS" v={server.os} />
            <Detail k="IP" v={server.ipAddress} />
            <Detail k={t("common.uptime")} v={`${server.uptime}%`} />
            <Detail k="Last deployment" v={server.lastDeployment} />
          </dl>
        </div>
      )}
    </div>
  );
};

const Metric = ({
  icon: Icon,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: number;
}) => {
  const tone =
    value >= 85 ? "text-destructive" : value >= 65 ? "text-warning" : "text-muted-foreground";
  return (
    <div className={cn("flex items-center gap-1 font-mono text-xs", tone)}>
      <Icon className="h-3.5 w-3.5" />
      <span className="tabular-nums">{value}%</span>
    </div>
  );
};

const MetricBar = ({ label, value }: { label: string; value: number }) => {
  const tone =
    value >= 85 ? "bg-destructive" : value >= 65 ? "bg-warning" : "bg-primary";
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-medium text-foreground">{label}</span>
        <span className="font-mono tabular-nums text-muted-foreground">{value}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full transition-all duration-700", tone)}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
};

const Detail = ({ k, v }: { k: string; v: string }) => (
  <div className="flex items-center justify-between border-b border-border/60 py-1.5">
    <span className="text-muted-foreground">{k}</span>
    <span className="font-mono text-foreground">{v}</span>
  </div>
);

export default Infrastructure;
