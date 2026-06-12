import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { useI18n } from "@/contexts/I18nContext";
import { ScrollText, Loader2, Search, Download } from "lucide-react";
import type { Database as DB } from "@/integrations/supabase/types";

type Audit = any;

const ACTION_BADGE: Record<string, string> = {
  INSERT: "bg-success/15 text-success ring-success/30",
  UPDATE: "bg-primary/15 text-primary ring-primary/30",
  DELETE: "bg-destructive/15 text-destructive ring-destructive/30",
};

const AuditLog = () => {
  const { t } = useI18n();
  const [items, setItems] = useState<Audit[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [entityFilter, setEntityFilter] = useState("all");

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase
        .from("audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (mounted) {
        setItems(data ?? []);
        setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const entities = useMemo(() => Array.from(new Set(items.map((i) => i.entity_type))).sort(), [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((i) => {
      if (entityFilter !== "all" && i.entity_type !== entityFilter) return false;
      if (!q) return true;
      return [i.action, i.entity_type, i.actor_email, i.entity_id]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [items, search, entityFilter]);

  const exportCsv = () => {
    const header = "timestamp,actor,action,entity_type,entity_id";
    const rows = filtered.map((i) =>
      [i.created_at, i.actor_email ?? "", i.action, i.entity_type, i.entity_id ?? ""].join(",")
    );
    const blob = new Blob([header + "\n" + rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col">
      <PageHeader
        title={t("gov.audit.title")}
        subtitle={t("gov.audit.subtitle")}
        icon={ScrollText}
        action={
          <button
            onClick={exportCsv}
            className="inline-flex items-center gap-1.5 rounded-lg border border-input px-3 py-1.5 text-xs font-medium text-muted-foreground transition-all hover:border-primary/40 hover:text-primary"
          >
            <Download className="h-3.5 w-3.5" />
            {t("gov.audit.export")}
          </button>
        }
      />

      <div className="flex flex-col gap-3 px-6 pb-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("gov.audit.search")}
            className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
        </div>
        <select
          value={entityFilter}
          onChange={(e) => setEntityFilter(e.target.value)}
          className="h-10 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
        >
          <option value="all">{t("gov.audit.allEntities")}</option>
          {entities.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
      </div>

      <div className="px-6 pb-8">
        {loading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">{t("gov.audit.empty")}</div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">{t("gov.audit.col.when")}</th>
                  <th className="px-4 py-3">{t("gov.audit.col.actor")}</th>
                  <th className="px-4 py-3">{t("gov.audit.col.action")}</th>
                  <th className="px-4 py-3">{t("gov.audit.col.entity")}</th>
                  <th className="px-4 py-3">{t("gov.audit.col.id")}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((i) => (
                  <tr key={i.id} className="border-b border-border/60 last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{new Date(i.created_at).toLocaleString()}</td>
                    <td className="px-4 py-3 text-foreground">{i.actor_email ?? <span className="text-muted-foreground italic">system</span>}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${ACTION_BADGE[i.action] ?? "bg-muted text-muted-foreground ring-border"}`}>
                        {i.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-foreground">{i.entity_type}</td>
                    <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">{i.entity_id?.slice(0, 8) ?? "—"}…</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuditLog;
