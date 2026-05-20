import { Layers } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { InfraStatusBadge, ResourceBar } from "@/components/infrastructure/InfraStatusBadge";
import { useK8sClusters } from "@/hooks/useInfrastructure";

export default function Kubernetes() {
  const { data: cs = [] } = useK8sClusters();
  return (
    <div className="flex min-h-full flex-col">
      <PageHeader title="Kubernetes" subtitle={`${cs.length} clusters · ${cs.reduce((a, c) => a + c.nodeCount, 0)} nodes · ${cs.reduce((a, c) => a + c.podCount, 0)} pods`} icon={Layers} />
      <div className="grid gap-3 p-4 sm:p-6 lg:grid-cols-2">
        {cs.map((c) => (
          <div key={c.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-lg font-semibold">{c.name}</p>
                <p className="text-[11px] text-muted-foreground uppercase">{c.provider} · v{c.version} · {c.region}</p>
              </div>
              <InfraStatusBadge status={c.status} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
              <div><p className="text-muted-foreground">Nodes</p><p className="text-xl font-semibold">{c.nodeCount}</p></div>
              <div><p className="text-muted-foreground">Pods</p><p className="text-xl font-semibold">{c.podCount}</p></div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <ResourceBar value={c.cpuPct} label="CPU" />
              <ResourceBar value={c.ramPct} label="RAM" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
