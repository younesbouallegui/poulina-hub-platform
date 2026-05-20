import { Network } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { InfraStatusBadge } from "@/components/infrastructure/InfraStatusBadge";
import { useLoadBalancers } from "@/hooks/useInfrastructure";

export default function LoadBalancers() {
  const { data: lbs = [] } = useLoadBalancers();
  return (
    <div className="flex min-h-full flex-col">
      <PageHeader title="Load Balancers" subtitle={`${lbs.length} virtual services`} icon={Network} />
      <div className="grid gap-3 p-4 sm:p-6 lg:grid-cols-2">
        {lbs.map((l) => (
          <div key={l.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <div><p className="font-medium">{l.name}</p><p className="text-[11px] text-muted-foreground uppercase">{l.kind} · VIP {l.vip}</p></div>
              <InfraStatusBadge status={l.status} />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
              <div><p className="text-muted-foreground">Backends</p><p className="text-xl font-semibold">{l.healthyBackends}/{l.backends}</p></div>
              <div><p className="text-muted-foreground">RPS</p><p className="text-xl font-semibold">{l.rps.toLocaleString()}</p></div>
              <div><p className="text-muted-foreground">Health</p><p className="text-xl font-semibold">{Math.round((l.healthyBackends / l.backends) * 100)}%</p></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
