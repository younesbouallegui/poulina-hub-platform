import { Wifi } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { InfraStatusBadge } from "@/components/infrastructure/InfraStatusBadge";
import { useNetworkDevices } from "@/hooks/useInfrastructure";

export default function Networks() {
  const { data: ns = [] } = useNetworkDevices();
  return (
    <div className="flex min-h-full flex-col">
      <PageHeader title="Networks" subtitle={`${ns.length} network devices · switches, routers, firewalls`} icon={Wifi} />
      <div className="p-4 sm:p-6">
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-xs">
            <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground"><tr><th className="px-3 py-2 text-left">Device</th><th className="px-3 py-2 text-left">Kind</th><th className="px-3 py-2 text-left">Vendor / Model</th><th className="px-3 py-2 text-left">IP</th><th className="px-3 py-2 text-right">Throughput</th><th className="px-3 py-2 text-right">CPU%</th><th className="px-3 py-2 text-left">Status</th></tr></thead>
            <tbody>
              {ns.map((n) => (
                <tr key={n.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-3 py-2 font-medium">{n.hostname}</td>
                  <td className="px-3 py-2 capitalize">{n.kind}</td>
                  <td className="px-3 py-2">{n.vendor} {n.model}</td>
                  <td className="px-3 py-2 font-mono">{n.ip}</td>
                  <td className="px-3 py-2 text-right font-mono">{n.throughputMbps} Mbps</td>
                  <td className="px-3 py-2 text-right font-mono">{n.cpuPct}</td>
                  <td className="px-3 py-2"><InfraStatusBadge status={n.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
