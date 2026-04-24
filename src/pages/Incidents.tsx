import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Filter, X } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/contexts/I18nContext";
import {
  ALL_SERVERS,
  getIncidentsForUser,
  Incident,
  IncidentSeverity,
  IncidentStatus,
} from "@/data/mockData";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const Incidents = () => {
  const { user, hasRole } = useAuth();
  const { t } = useI18n();
  const { toast } = useToast();

  const [severity, setSeverity] = useState<"all" | IncidentSeverity>("all");
  const [status, setStatus] = useState<"all" | IncidentStatus>("all");
  const [selected, setSelected] = useState<Incident | null>(null);
  const [overrides, setOverrides] = useState<Record<string, IncidentStatus>>({});

  const baseIncidents = useMemo(
    () => (user ? getIncidentsForUser(user.assignedServers) : []),
    [user],
  );

  const incidents = useMemo(
    () =>
      baseIncidents
        .map((i) => ({ ...i, status: overrides[i.id] ?? i.status }))
        .filter((i) => severity === "all" || i.severity === severity)
        .filter((i) => status === "all" || i.status === status)
        .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)),
    [baseIncidents, severity, status, overrides],
  );

  const canAct = hasRole("admin", "operator");

  const acknowledge = (id: string) => {
    if (!canAct) return toast({ title: t("inc.notAllowed"), variant: "destructive" });
    setOverrides((o) => ({ ...o, [id]: "acknowledged" }));
    toast({ title: t("inc.acknowledged") });
    if (selected?.id === id) setSelected({ ...selected, status: "acknowledged" });
  };

  const closeIncident = (id: string) => {
    if (!canAct) return toast({ title: t("inc.notAllowed"), variant: "destructive" });
    setOverrides((o) => ({ ...o, [id]: "resolved" }));
    toast({ title: t("inc.closed") });
    if (selected?.id === id) setSelected({ ...selected, status: "resolved" });
  };

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader title={t("inc.title")} subtitle={t("inc.subtitle")} />

      <div className="flex-1 p-4 sm:p-6">
        {/* Filters */}
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-card">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Filter className="h-3.5 w-3.5" />
            <span className="font-medium uppercase tracking-wider">Filters</span>
          </div>
          <FilterSelect
            label={t("inc.filterSeverity")}
            value={severity}
            onChange={(v) => setSeverity(v as typeof severity)}
            options={[
              { value: "all", label: t("common.all") },
              { value: "critical", label: t("common.critical") },
              { value: "high", label: "High" },
              { value: "medium", label: "Medium" },
              { value: "low", label: "Low" },
            ]}
          />
          <FilterSelect
            label={t("inc.filterStatus")}
            value={status}
            onChange={(v) => setStatus(v as typeof status)}
            options={[
              { value: "all", label: t("common.all") },
              { value: "open", label: t("common.open") },
              { value: "acknowledged", label: t("common.acknowledged") },
              { value: "resolved", label: t("common.resolved") },
            ]}
          />
        </div>

        {/* List */}
        <div className="rounded-2xl border border-border bg-card shadow-card">
          {incidents.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-10 text-center">
              <CheckCircle2 className="h-8 w-8 text-success" />
              <p className="text-sm text-muted-foreground">{t("inc.empty")}</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {incidents.map((i) => {
                const server = ALL_SERVERS.find((s) => s.id === i.serverId);
                return (
                  <li
                    key={i.id}
                    onClick={() => setSelected(i)}
                    className="cursor-pointer p-4 transition-colors hover:bg-muted/40"
                  >
                    <div className="flex items-start gap-3">
                      <SeverityPill severity={i.severity} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {i.title}
                          </p>
                          <span className="font-mono text-[10px] text-muted-foreground">
                            {i.id}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {server?.name} · {i.affectedComponent}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <StatusPill status={i.status} />
                        <span className="hidden font-mono text-[11px] text-muted-foreground sm:inline">
                          {new Date(i.createdAt).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Details drawer */}
      {selected && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-foreground/40 backdrop-blur-sm animate-fade-in"
            onClick={() => setSelected(null)}
          />
          <aside className="relative z-10 ml-auto flex h-full w-full max-w-md flex-col border-l border-border bg-card shadow-elevated animate-slide-in-right">
            <div className="flex items-start justify-between border-b border-border p-5">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">
                  {t("inc.detailsTitle")}
                </p>
                <h3 className="mt-1 truncate text-lg font-semibold text-foreground">
                  {selected.title}
                </h3>
                <p className="mt-0.5 font-mono text-xs text-muted-foreground">{selected.id}</p>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              <div className="flex items-center gap-2">
                <SeverityPill severity={selected.severity} />
                <StatusPill status={selected.status} />
              </div>
              <Field label={t("common.details")} value={selected.description} />
              <Field
                label={t("common.date")}
                value={new Date(selected.createdAt).toLocaleString()}
              />
              <Field label="Component" value={selected.affectedComponent} />
              <Field
                label="Server"
                value={ALL_SERVERS.find((s) => s.id === selected.serverId)?.name ?? "—"}
              />
            </div>
            <div className="flex flex-col gap-2 border-t border-border p-4 sm:flex-row">
              <button
                onClick={() => acknowledge(selected.id)}
                disabled={!canAct || selected.status !== "open"}
                className="flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-all hover:border-primary/40 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t("common.acknowledge")}
              </button>
              <button
                onClick={() => closeIncident(selected.id)}
                disabled={!canAct || selected.status === "resolved"}
                className="flex-1 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary-glow active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t("common.close")}
              </button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
};

const Field = ({ label, value }: { label: string; value: string }) => (
  <div>
    <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
      {label}
    </p>
    <p className="text-sm leading-relaxed text-foreground">{value}</p>
  </div>
);

const SeverityPill = ({ severity }: { severity: IncidentSeverity }) => {
  const cls =
    severity === "critical"
      ? "bg-destructive/15 text-destructive ring-destructive/30"
      : severity === "high"
        ? "bg-warning/15 text-warning ring-warning/30"
        : severity === "medium"
          ? "bg-info/15 text-info ring-info/30"
          : "bg-muted text-muted-foreground ring-border";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1",
        cls,
      )}
    >
      <AlertTriangle className="h-3 w-3" />
      {severity}
    </span>
  );
};

const StatusPill = ({ status }: { status: IncidentStatus }) => {
  const cls =
    status === "open"
      ? "bg-destructive/10 text-destructive ring-destructive/20"
      : status === "acknowledged"
        ? "bg-info/10 text-info ring-info/20"
        : "bg-success/10 text-success ring-success/20";
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1",
        cls,
      )}
    >
      {status}
    </span>
  );
};

const FilterSelect = ({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) => (
  <label className="flex items-center gap-2 text-xs">
    <span className="text-muted-foreground">{label}:</span>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-md border border-input bg-background px-2 py-1 text-xs text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  </label>
);

export default Incidents;
