import { Boxes } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { InfraStatusBadge, ResourceBar } from "@/components/infrastructure/InfraStatusBadge";
import { useVMs, useHypervisors } from "@/hooks/useInfrastructure";

export default function VirtualMachines() {
  const { data: vms = [] } = useVMs();
  const { data: hvs = [] } = useHypervisors();
  const hvName = (id: string) => hvs.find((h) => h.id === id)?.name ?? id;

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader title="Virtual Machines" subtitle={`${vms.length} VMs across ${hvs.length} hypervisors`} icon={Boxes} />
      <div className="grid gap-3 p-4 sm:p-6 lg:grid-cols-3">
        {hvs.map((h) => (
          <div key={h.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{h.name}</p>
                <p className="text-[11px] text-muted-foreground">{h.type} {h.version} · {h.vmCount} VMs</p>
              </div>
              <InfraStatusBadge status={h.status} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <ResourceBar value={h.cpuPct} label="CPU" />
              <ResourceBar value={h.ramPct} label="RAM" />
            </div>
          </div>
        ))}
      </div>
      <div className="px-4 sm:px-6 pb-6">
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-xs">
            <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr><th className="px-3 py-2 text-left">VM</th><th className="px-3 py-2 text-left">Hypervisor</th><th className="px-3 py-2 text-left">Guest OS</th><th className="px-3 py-2 text-left">vCPU</th><th className="px-3 py-2 text-left">RAM</th><th className="px-3 py-2 text-left">Disk</th><th className="px-3 py-2 text-left">State</th><th className="px-3 py-2 text-left">CPU%</th><th className="px-3 py-2 text-left">RAM%</th></tr>
            </thead>
            <tbody>
              {vms.map((v) => (
                <tr key={v.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-3 py-2 font-medium">{v.name}</td>
                  <td className="px-3 py-2">{hvName(v.hypervisorId)}</td>
                  <td className="px-3 py-2">{v.guestOs}</td>
                  <td className="px-3 py-2 font-mono">{v.vcpu}</td>
                  <td className="px-3 py-2 font-mono">{v.ramGb} GB</td>
                  <td className="px-3 py-2 font-mono">{v.diskGb} GB</td>
                  <td className="px-3 py-2"><span className={`rounded px-2 py-0.5 text-[10px] uppercase ${v.state === "running" ? "bg-success/10 text-success" : v.state === "suspended" ? "bg-blue-500/10 text-blue-600" : "bg-muted/40 text-muted-foreground"}`}>{v.state}</span></td>
                  <td className="px-3 py-2 w-[100px]"><ResourceBar value={v.cpuPct} /></td>
                  <td className="px-3 py-2 w-[100px]"><ResourceBar value={v.ramPct} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
