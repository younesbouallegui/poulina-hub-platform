import { useMemo } from "react";
import { Download, FileText } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/contexts/I18nContext";
import { getServersForUser } from "@/data/mockData";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const SLA = () => {
  const { user } = useAuth();
  const { t } = useI18n();
  const { toast } = useToast();

  const servers = useMemo(
    () => (user ? getServersForUser(user.assignedServers) : []),
    [user],
  );

  const overall =
    servers.length > 0
      ? servers.reduce((acc, s) => acc + s.uptime, 0) / servers.length
      : 0;

  const exportFile = (kind: "pdf" | "csv") => {
    if (kind === "csv") {
      const rows = [
        ["Service", "Type", "Region", "Uptime %", "SLA Target %", "Status"],
        ...servers.map((s) => [s.name, s.type, s.region, s.uptime.toFixed(2), "99.50", s.status]),
      ];
      const csv = rows.map((r) => r.join(",")).join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sla-report-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
    toast({ title: t("sla.exported"), description: kind.toUpperCase() });
  };

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader
        title={t("sla.title")}
        subtitle={t("sla.subtitle")}
        actions={
          <>
            <button
              onClick={() => exportFile("pdf")}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground transition-all hover:border-primary/40 active:scale-[0.98]"
            >
              <FileText className="h-3.5 w-3.5" />
              {t("sla.exportPdf")}
            </button>
            <button
              onClick={() => exportFile("csv")}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-all hover:bg-primary-glow active:scale-[0.98]"
            >
              <Download className="h-3.5 w-3.5" />
              {t("sla.exportCsv")}
            </button>
          </>
        }
      />

      <div className="flex-1 space-y-6 p-4 sm:p-6">
        {/* Compliance summary */}
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-card lg:col-span-1">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {t("sla.compliance")}
            </p>
            <p className="mt-2 font-mono text-4xl font-semibold tabular-nums text-foreground">
              {overall.toFixed(2)}%
            </p>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-gradient-primary transition-all duration-1000"
                style={{ width: `${Math.min(100, overall)}%` }}
              />
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">Target: 99.50%</p>
          </div>

          {/* Per-region breakdown */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-card lg:col-span-2">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              By region
            </p>
            <div className="mt-3 space-y-3">
              {Array.from(new Set(servers.map((s) => s.region))).map((region) => {
                const subset = servers.filter((s) => s.region === region);
                const avg =
                  subset.reduce((acc, s) => acc + s.uptime, 0) / Math.max(1, subset.length);
                return (
                  <div key={region}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-medium text-foreground">{region}</span>
                      <span className="font-mono tabular-nums text-muted-foreground">
                        {avg.toFixed(2)}%
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn(
                          "h-full transition-all duration-700",
                          avg >= 99.9 ? "bg-success" : avg >= 99.5 ? "bg-info" : "bg-warning",
                        )}
                        style={{ width: `${avg}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              {servers.length === 0 && (
                <p className="text-sm text-muted-foreground">{t("infra.noServers")}</p>
              )}
            </div>
          </div>
        </section>

        {/* Per-service uptime table */}
        <section className="rounded-2xl border border-border bg-card shadow-card">
          <div className="border-b border-border px-4 py-3">
            <h3 className="text-sm font-semibold text-foreground">{t("sla.uptime")}</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-2 font-semibold">Service</th>
                  <th className="px-4 py-2 font-semibold">{t("common.region")}</th>
                  <th className="px-4 py-2 font-semibold">{t("common.uptime")}</th>
                  <th className="px-4 py-2 font-semibold">SLA target</th>
                  <th className="px-4 py-2 font-semibold">{t("common.status")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {servers.map((s) => {
                  const ok = s.uptime >= 99.5;
                  return (
                    <tr key={s.id} className="transition-colors hover:bg-muted/40">
                      <td className="px-4 py-3 font-medium text-foreground">{s.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{s.region}</td>
                      <td className="px-4 py-3 font-mono tabular-nums text-foreground">
                        {s.uptime}%
                      </td>
                      <td className="px-4 py-3 font-mono tabular-nums text-muted-foreground">
                        99.50%
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1",
                            ok
                              ? "bg-success/10 text-success ring-success/20"
                              : "bg-destructive/10 text-destructive ring-destructive/20",
                          )}
                        >
                          {ok ? "Met" : "Breach"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
};

export default SLA;
