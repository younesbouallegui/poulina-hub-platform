import { FormEvent, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { useI18n } from "@/contexts/I18nContext";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Building2, Loader2, Plus, Trash2 } from "lucide-react";
import type { Database as DB } from "@/integrations/supabase/types";

type Department = DB["public"]["Tables"]["departments"]["Row"];

const Departments = () => {
  const { t } = useI18n();
  const { hasRole } = useAuth();
  const { toast } = useToast();
  const isAdmin = hasRole("admin");
  const [items, setItems] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    const { data } = await (supabase as any).from("departments").select("*").order("name");
    setItems(data ?? []);
  };

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !code.trim()) return;
    setSubmitting(true);
    const { error } = await (supabase as any).from("departments").insert({ name: name.trim(), code: code.trim().toUpperCase(), description: description.trim() || null });
    setSubmitting(false);
    if (error) {
      toast({ title: t("gov.dept.createFailed"), description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: t("gov.dept.created") });
    setName(""); setCode(""); setDescription("");
    load();
  };

  const onDelete = async (id: string) => {
    const { error } = await (supabase as any).from("departments").delete().eq("id", id);
    if (error) {
      toast({ title: t("gov.dept.deleteFailed"), description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: t("gov.dept.deleted") });
    load();
  };

  return (
    <div className="flex flex-col">
      <PageHeader title={t("gov.dept.title")} subtitle={t("gov.dept.subtitle")} icon={Building2} />

      {isAdmin && (
        <form onSubmit={onCreate} className="mx-6 mb-6 grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-[1fr_120px_1fr_auto]">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("gov.dept.namePh")}
            className="h-10 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
            maxLength={120}
            required
          />
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder={t("gov.dept.codePh")}
            className="h-10 rounded-lg border border-input bg-background px-3 text-sm font-mono uppercase outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
            maxLength={16}
            required
          />
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("gov.dept.descPh")}
            className="h-10 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
            maxLength={300}
          />
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary-glow active:scale-[0.99] disabled:opacity-60"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {t("gov.dept.add")}
          </button>
        </form>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
      ) : (
        <div className="overflow-hidden mx-6 mb-8 rounded-xl border border-border bg-card">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">{t("gov.dept.col.code")}</th>
                <th className="px-4 py-3">{t("gov.dept.col.name")}</th>
                <th className="px-4 py-3">{t("gov.dept.col.desc")}</th>
                {isAdmin && <th className="px-4 py-3 w-16"></th>}
              </tr>
            </thead>
            <tbody>
              {items.map((d) => (
                <tr key={d.id} className="border-b border-border/60 last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{d.code}</td>
                  <td className="px-4 py-3 font-medium text-foreground">{d.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{d.description ?? "—"}</td>
                  {isAdmin && (
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => onDelete(d.id)}
                        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                        aria-label="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Departments;
