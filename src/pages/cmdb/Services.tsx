import { useMemo } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { useI18n } from "@/contexts/I18nContext";
import { Layers, Loader2, ShieldAlert, Activity, AlertTriangle } from "lucide-react";
import { useZabbixServices, useZabbixProblems } from "@/lib/zabbix";

const STATUS_DOT: Record<string, string> = {
  ok: "bg-success",
  warn: "bg-warning",
  fail: "bg-destructive",
};

const statusOf = (s: string): keyof typeof STATUS_DOT => {
  const n = parseInt(s, 10);
  if (n >= 4) return "fail";
  if (n >= 2) return "warn";
  return "ok";
};

const Services = () => {
  const { t } = useI18n();
  const { data: services = [], isLoading } = useZabbixServices();
  const { data: problems = [] } = useZabbixProblems();

  const tree = useMemo(() => {
    const childIds = new Set<string>();
    services.forEach((s) => s.children?.forEach((c) => childIds.add(c.serviceid)));
    return services.filter((s) => !childIds.has(s.serviceid));
  }, [services]);

  const problemsForService = (tags?: Array<{ tag: string; value: string }>) => {
    if (!tags?.length) return 0;
    return problems.filter((p) =>
      tags.some((tg) => p.name.toLowerCase().includes(tg.value?.toLowerCase() ?? ""))
    ).length;
  };

  return (
    <div className="flex flex-col">
      <PageHeader
        title={t("cmdb.services.title")}
        subtitle={`${t("cmdb.services.subtitle")} · live from Zabbix`}
        icon={Layers}
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : services.length === 0 ? (
        <div className="mx-6 mb-8 rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
          No business services defined in Zabbix yet.
        </div>
      ) : (
        <div className="grid gap-4 px-6 pb-8 md:grid-cols-2">
          {tree.map((s) => {
            const status = statusOf(s.status);
            const childCount = s.children?.length ?? 0;
            const probCount = problemsForService(s.problem_tags);
            return (
              <article key={s.serviceid} className="rounded-xl border border-border bg-card p-5 transition-all hover:-translate-y-0.5 hover:shadow-elevated">
                <header className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${STATUS_DOT[status]}`} />
                      <h3 className="truncate text-base font-semibold text-foreground">{s.name}</h3>
                    </div>
                    {s.description && <p className="mt-1 text-xs text-muted-foreground">{s.description}</p>}
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ring-1 ${
                    status === "fail" ? "bg-destructive/10 text-destructive ring-destructive/30" :
                    status === "warn" ? "bg-warning/10 text-warning ring-warning/30" :
                    "bg-success/10 text-success ring-success/30"
                  }`}>{status}</span>
                </header>

                <div className="mt-4 grid grid-cols-3 gap-3 border-t border-border pt-4 text-center">
                  <Stat icon={Layers} label="Children" value={childCount} />
                  <Stat icon={AlertTriangle} label="Problems" value={probCount} accent={probCount > 0 ? "destructive" : undefined} />
                  <Stat icon={Activity} label="Algorithm" value={<span className="text-[11px]">{s.algorithm ?? "—"}</span>} />
                </div>

                {s.children && s.children.length > 0 && (
                  <div className="mt-4">
                    <p className="mb-2 text-[11px] uppercase tracking-wider text-muted-foreground">Sub-services</p>
                    <ul className="flex flex-wrap gap-1.5">
                      {s.children.map((c) => {
                        const child = services.find((x) => x.serviceid === c.serviceid);
                        const cs = child ? statusOf(child.status) : "ok";
                        return (
                          <li key={c.serviceid} className="inline-flex items-center gap-1.5 rounded-full bg-muted/60 px-2.5 py-1 text-[11px] text-foreground ring-1 ring-border">
                            <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[cs]}`} />
                            {child?.name ?? c.name ?? c.serviceid}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}

                {s.problem_tags && s.problem_tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {s.problem_tags.map((tg, i) => (
                      <span key={i} className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary ring-1 ring-primary/20">
                        <ShieldAlert className="mr-1 h-2.5 w-2.5" />{tg.tag}{tg.value ? `:${tg.value}` : ""}
                      </span>
                    ))}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};

const Stat = ({ icon: Icon, label, value, accent }: {
  icon: React.ComponentType<{ className?: string }>; label: string; value: React.ReactNode; accent?: "destructive";
}) => (
  <div>
    <Icon className={`mx-auto mb-1 h-4 w-4 ${accent === "destructive" ? "text-destructive" : "text-muted-foreground"}`} />
    <p className={`text-sm font-semibold ${accent === "destructive" ? "text-destructive" : "text-foreground"}`}>{value}</p>
    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
  </div>
);

export default Services;
