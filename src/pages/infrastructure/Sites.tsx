import { Building2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { InfraStatusBadge } from "@/components/infrastructure/InfraStatusBadge";
import { useSites } from "@/hooks/useInfrastructure";

export default function Sites() {
  const { data: sites = [] } = useSites();
  return (
    <div className="flex min-h-full flex-col">
      <PageHeader title="Sites & Regions" subtitle={`${sites.length} datacenters · ${sites.reduce((a, s) => a + s.servers, 0)} servers · ${sites.reduce((a, s) => a + s.powerKw, 0)} kW total power`} icon={Building2} />
      <div className="grid gap-3 p-4 sm:p-6 lg:grid-cols-3">
        {sites.map((s) => (
          <div key={s.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <div><p className="text-lg font-semibold">{s.name}</p><p className="text-[11px] text-muted-foreground uppercase">{s.code} · {s.tier}</p></div>
              <InfraStatusBadge status={s.status} />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{s.city}, {s.country} · {s.region}</p>
            <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
              <div><p className="text-muted-foreground">Racks</p><p className="text-xl font-semibold">{s.racks}</p></div>
              <div><p className="text-muted-foreground">Servers</p><p className="text-xl font-semibold">{s.servers}</p></div>
              <div><p className="text-muted-foreground">Power</p><p className="text-xl font-semibold">{s.powerKw} kW</p></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
