import { Container as ContainerIcon } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { useContainers, useServers } from "@/hooks/useInfrastructure";

export default function Containers() {
  const { data: cs = [] } = useContainers();
  const { data: servers = [] } = useServers();
  const hostName = (id: string) => servers.find((s) => s.id === id)?.hostname ?? id;
  return (
    <div className="flex min-h-full flex-col">
      <PageHeader title="Containers" subtitle={`${cs.length} containers across Docker/K8s hosts`} icon={ContainerIcon} />
      <div className="p-4 sm:p-6">
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-xs">
            <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr><th className="px-3 py-2 text-left">Container</th><th className="px-3 py-2 text-left">Image</th><th className="px-3 py-2 text-left">Host</th><th className="px-3 py-2 text-left">State</th><th className="px-3 py-2 text-right">CPU%</th><th className="px-3 py-2 text-right">RAM (MB)</th><th className="px-3 py-2 text-right">Restarts</th><th className="px-3 py-2 text-right">Created</th></tr>
            </thead>
            <tbody>
              {cs.map((c) => (
                <tr key={c.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-3 py-2 font-medium">{c.name}</td>
                  <td className="px-3 py-2 font-mono">{c.image}</td>
                  <td className="px-3 py-2">{hostName(c.hostId)}</td>
                  <td className="px-3 py-2"><span className={`rounded px-2 py-0.5 text-[10px] uppercase ${c.state === "running" ? "bg-success/10 text-success" : c.state === "exited" ? "bg-destructive/10 text-destructive" : "bg-yellow-500/10 text-yellow-600"}`}>{c.state}</span></td>
                  <td className="px-3 py-2 text-right font-mono">{c.cpuPct.toFixed(1)}</td>
                  <td className="px-3 py-2 text-right font-mono">{c.ramMb}</td>
                  <td className="px-3 py-2 text-right font-mono">{c.restartCount}</td>
                  <td className="px-3 py-2 text-right text-muted-foreground">{new Date(c.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
