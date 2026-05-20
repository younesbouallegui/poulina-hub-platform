import { Database } from "lucide-react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/layout/PageHeader";
import { InfraStatusBadge } from "@/components/infrastructure/InfraStatusBadge";
import { useDatabaseServers } from "@/hooks/useInfrastructure";

export default function Databases() {
  const { data: dbs = [] } = useDatabaseServers();
  return (
    <div className="flex min-h-full flex-col">
      <PageHeader title="Databases" subtitle={`${dbs.length} database servers`} icon={Database} />
      <div className="p-4 sm:p-6">
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-xs">
            <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground"><tr><th className="px-3 py-2 text-left">Database</th><th className="px-3 py-2 text-left">Engine</th><th className="px-3 py-2 text-left">Version</th><th className="px-3 py-2 text-left">Role</th><th className="px-3 py-2 text-right">Connections</th><th className="px-3 py-2 text-right">QPS</th><th className="px-3 py-2 text-right">Repl lag</th><th className="px-3 py-2 text-left">Host</th><th className="px-3 py-2 text-left">Status</th></tr></thead>
            <tbody>
              {dbs.map((d) => (
                <tr key={d.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-3 py-2 font-medium">{d.name}</td>
                  <td className="px-3 py-2 capitalize">{d.engine}</td>
                  <td className="px-3 py-2 font-mono">{d.version}</td>
                  <td className="px-3 py-2 capitalize">{d.role}</td>
                  <td className="px-3 py-2 text-right font-mono">{d.connections}</td>
                  <td className="px-3 py-2 text-right font-mono">{d.qps.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right font-mono">{d.replicationLagMs} ms</td>
                  <td className="px-3 py-2"><Link to={`/infrastructure/servers/${d.serverId}`} className="text-primary hover:underline">{d.serverId}</Link></td>
                  <td className="px-3 py-2"><InfraStatusBadge status={d.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
