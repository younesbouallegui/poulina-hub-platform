import { useNavigate } from "react-router-dom";
import { Network as NetIcon } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { InfraTopology } from "@/components/infrastructure/InfraTopology";
import { useServers, useSites } from "@/hooks/useInfrastructure";

export default function InfrastructureTopology() {
  const { data: servers = [] } = useServers();
  const { data: sites = [] } = useSites();
  const navigate = useNavigate();
  return (
    <div className="flex min-h-full flex-col">
      <PageHeader title="Datacenter Topology" subtitle="Site / rack / host relationships — blast radius view" icon={NetIcon} />
      <div className="p-4 sm:p-6">
        <InfraTopology servers={servers} sites={sites} onSelect={(id) => navigate(`/infrastructure/servers/${id}`)} />
        <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
          <Legend color="#10b981" label="Healthy" />
          <Legend color="#eab308" label="Warning" />
          <Legend color="#f97316" label="Degraded" />
          <Legend color="#dc2626" label="Critical" />
          <Legend color="#3b82f6" label="Maintenance" />
          <span>· Hubs = sites · Nodes = servers · Hover for details · Click to open cockpit</span>
        </div>
      </div>
    </div>
  );
}
function Legend({ color, label }: { color: string; label: string }) {
  return <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} /> {label}</span>;
}
