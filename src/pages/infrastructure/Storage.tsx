import { HardDrive } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { InfraStatusBadge, ResourceBar } from "@/components/infrastructure/InfraStatusBadge";
import { useStorageArrays } from "@/hooks/useInfrastructure";

export default function Storage() {
  const { data: arrs = [] } = useStorageArrays();
  return (
    <div className="flex min-h-full flex-col">
      <PageHeader title="Storage" subtitle={`${arrs.length} arrays · ${arrs.reduce((a, s) => a + s.capacityTb, 0)} TB total capacity`} icon={HardDrive} />
      <div className="grid gap-3 p-4 sm:p-6 lg:grid-cols-3">
        {arrs.map((a) => (
          <div key={a.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <div><p className="font-medium">{a.name}</p><p className="text-[11px] text-muted-foreground uppercase">{a.kind} · {a.vendor}</p></div>
              <InfraStatusBadge status={a.status} />
            </div>
            <div className="mt-3 space-y-2">
              <ResourceBar value={(a.usedTb / a.capacityTb) * 100} label={`${a.usedTb} / ${a.capacityTb} TB`} />
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><p className="text-muted-foreground">IOPS</p><p className="font-mono">{a.iops.toLocaleString()}</p></div>
                <div><p className="text-muted-foreground">Latency</p><p className="font-mono">{a.latencyMs} ms</p></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
