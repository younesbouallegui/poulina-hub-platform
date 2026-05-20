import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Filter, Plus, RefreshCw, Search, Server as ServerIcon, Wrench } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { InfraStatusBadge, ResourceBar } from "@/components/infrastructure/InfraStatusBadge";
import { ServerOnboardDialog } from "@/components/infrastructure/ServerOnboardDialog";
import { useServers, useSites } from "@/hooks/useInfrastructure";
import type { InfraEnvironment, InfraStatus } from "@/types/infrastructure";

const ENVS: InfraEnvironment[] = ["prod", "uat", "dev", "dr"];
const STS: InfraStatus[] = ["healthy", "warning", "degraded", "critical", "maintenance", "unknown"];

export default function Servers() {
  const { data: servers = [], refetch, isFetching } = useServers();
  const { data: sites = [] } = useSites();
  const [search, setSearch] = useState("");
  const [env, setEnv] = useState<InfraEnvironment | "all">("all");
  const [status, setStatus] = useState<InfraStatus | "all">("all");
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => servers.filter((s) => {
    if (env !== "all" && s.environment !== env) return false;
    if (status !== "all" && s.status !== status) return false;
    if (search) {
      const q = search.toLowerCase();
      if (![s.hostname, s.ip, s.os, s.team, s.businessOwner, ...s.tags].some((x) => x.toLowerCase().includes(q))) return false;
    }
    return true;
  }), [servers, env, status, search]);

  const siteName = (id: string) => sites.find((s) => s.id === id)?.code ?? id;

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader
        title="Servers"
        subtitle={`${filtered.length} / ${servers.length} hosts · live fleet`}
        icon={ServerIcon}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} /> Refresh
            </Button>
            <Button size="sm" onClick={() => setOpen(true)}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Add server
            </Button>
          </>
        }
      />
      <div className="space-y-3 p-4 sm:p-6">
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search hostname, IP, tag, owner…" className="pl-8" />
          </div>
          <Select label="Env" value={env} onChange={(v) => setEnv(v as any)} options={["all", ...ENVS]} />
          <Select label="Status" value={status} onChange={(v) => setStatus(v as any)} options={["all", ...STS]} />
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-xs">
            <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Host</th>
                <th className="px-3 py-2 text-left">Env</th>
                <th className="px-3 py-2 text-left">Site</th>
                <th className="px-3 py-2 text-left">OS</th>
                <th className="px-3 py-2 text-left">Tier</th>
                <th className="px-3 py-2 text-left">CPU</th>
                <th className="px-3 py-2 text-left">RAM</th>
                <th className="px-3 py-2 text-left">Disk</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-right">Risk</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-3 py-2">
                    <Link to={`/infrastructure/servers/${s.id}`} className="font-medium hover:text-primary">{s.hostname}</Link>
                    <div className="text-[10px] text-muted-foreground">{s.ip} · {s.tags.join(", ") || "—"}</div>
                  </td>
                  <td className="px-3 py-2 uppercase">{s.environment}</td>
                  <td className="px-3 py-2">{siteName(s.siteId)}</td>
                  <td className="px-3 py-2">{s.os} {s.osVersion}</td>
                  <td className="px-3 py-2 font-mono">{s.criticality}</td>
                  <td className="px-3 py-2 w-[110px]"><ResourceBar value={s.cpuPct} /></td>
                  <td className="px-3 py-2 w-[110px]"><ResourceBar value={s.ramPct} /></td>
                  <td className="px-3 py-2 w-[110px]"><ResourceBar value={s.diskPct} /></td>
                  <td className="px-3 py-2"><InfraStatusBadge status={s.status} pulse /></td>
                  <td className="px-3 py-2 text-right font-mono">{s.riskScore}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={10} className="px-3 py-10 text-center text-muted-foreground"><Wrench className="mx-auto mb-1 h-4 w-4" /> No servers match the filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <ServerOnboardDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="rounded-md border border-border bg-background px-2 py-1 text-xs">
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}
