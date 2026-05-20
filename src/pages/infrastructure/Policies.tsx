import { Shield } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { usePolicies, useUpsertPolicy } from "@/hooks/useInfrastructure";

const CAT_COLOR: Record<string, string> = {
  tagging: "bg-blue-500/10 text-blue-600 ring-blue-500/30",
  monitoring: "bg-success/10 text-success ring-success/30",
  naming: "bg-purple-500/10 text-purple-600 ring-purple-500/30",
  patching: "bg-orange-500/10 text-orange-600 ring-orange-500/30",
  backup: "bg-cyan-500/10 text-cyan-600 ring-cyan-500/30",
  security: "bg-destructive/10 text-destructive ring-destructive/30",
};

export default function Policies() {
  const { data: pols = [] } = usePolicies();
  const upsert = useUpsertPolicy();
  return (
    <div className="flex min-h-full flex-col">
      <PageHeader title="Infrastructure Policies" subtitle={`${pols.length} governance policies · ${pols.filter((p) => p.enforced).length} enforced`} icon={Shield} />
      <div className="grid gap-3 p-4 sm:p-6 lg:grid-cols-2">
        {pols.map((p) => (
          <div key={p.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">{p.name}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{p.description}</p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px]">
                  <span className={`rounded-full px-2 py-0.5 font-semibold uppercase ring-1 ${CAT_COLOR[p.category] ?? "bg-muted/40 text-muted-foreground ring-border"}`}>{p.category}</span>
                  <span className="rounded-full bg-muted/40 px-2 py-0.5 uppercase text-muted-foreground">scope: {p.scope}{p.scopeValue ? `=${p.scopeValue}` : ""}</span>
                </div>
              </div>
              <Switch checked={p.enforced} onCheckedChange={(v) => { upsert.mutate({ ...p, enforced: v }); toast.success(v ? "Policy enforced" : "Policy paused"); }} />
            </div>
            <div className="mt-3">
              <div className="mb-1 flex items-baseline justify-between text-[10px] text-muted-foreground">
                <span>Compliance</span><span className="font-mono text-foreground">{p.compliancePct}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div className={`h-full ${p.compliancePct >= 95 ? "bg-success" : p.compliancePct >= 80 ? "bg-yellow-500" : "bg-destructive"}`} style={{ width: `${p.compliancePct}%` }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
