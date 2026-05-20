import { Cloud } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { InfraStatusBadge } from "@/components/infrastructure/InfraStatusBadge";
import { useCloudResources } from "@/hooks/useInfrastructure";

export default function CloudResources() {
  const { data: rs = [] } = useCloudResources();
  const monthly = rs.reduce((a, r) => a + r.monthlyCostUsd, 0);
  return (
    <div className="flex min-h-full flex-col">
      <PageHeader title="Cloud Resources" subtitle={`${rs.length} resources · ~$${monthly.toLocaleString()} / month`} icon={Cloud} />
      <div className="p-4 sm:p-6">
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-xs">
            <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground"><tr><th className="px-3 py-2 text-left">Provider</th><th className="px-3 py-2 text-left">Service</th><th className="px-3 py-2 text-left">Name</th><th className="px-3 py-2 text-left">Region</th><th className="px-3 py-2 text-left">Account</th><th className="px-3 py-2 text-right">Monthly $</th><th className="px-3 py-2 text-left">Status</th></tr></thead>
            <tbody>
              {rs.map((r) => (
                <tr key={r.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-3 py-2 uppercase font-medium">{r.provider}</td>
                  <td className="px-3 py-2">{r.service}</td>
                  <td className="px-3 py-2">{r.name}</td>
                  <td className="px-3 py-2 font-mono">{r.region}</td>
                  <td className="px-3 py-2 font-mono">{r.accountId}</td>
                  <td className="px-3 py-2 text-right font-mono">${r.monthlyCostUsd.toLocaleString()}</td>
                  <td className="px-3 py-2"><InfraStatusBadge status={r.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
