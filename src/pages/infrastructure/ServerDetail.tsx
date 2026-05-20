import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Cpu, MemoryStick, HardDrive, Network, Activity, Boxes, ScrollText, AlertTriangle, ServerCog, Wrench, ShieldCheck, Power } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { InfraStatusBadge, ResourceBar } from "@/components/infrastructure/InfraStatusBadge";
import { useServer, useServers, useUpsertServer, useAppendChange } from "@/hooks/useInfrastructure";
import type { Server } from "@/types/infrastructure";

export default function ServerDetail() {
  const { id } = useParams();
  useServers(); // ensure live-driving
  const srv = useServer(id);
  const upsert = useUpsertServer();
  const appendChange = useAppendChange();
  const navigate = useNavigate();

  if (!srv) {
    return (
      <div className="p-6">
        <Link to="/infrastructure/servers" className="text-sm text-primary hover:underline"><ArrowLeft className="mr-1 inline h-3.5 w-3.5" /> Back to servers</Link>
        <p className="mt-6 text-sm text-muted-foreground">Server not found.</p>
      </div>
    );
  }

  const action = (kind: Server["changes"][number]["kind"], summary: string, mutate?: Partial<Server>) => {
    appendChange.mutate({ id: srv.id, change: { id: `ch-${Date.now()}`, ts: new Date().toISOString(), actor: "you", kind, summary } });
    if (mutate) upsert.mutate({ ...srv, ...mutate, updatedAt: new Date().toISOString() });
    toast.success(summary);
  };

  const enterMaintenance = () => action("maintenance", `Maintenance mode enabled for ${srv.hostname}`, { status: "maintenance" });
  const exitMaintenance  = () => action("maintenance", `Maintenance mode released on ${srv.hostname}`,  { status: "unknown" });
  const restart          = () => action("restart",     `Restart initiated on ${srv.hostname}`,          { uptimeSec: 0 });
  const decommission     = () => { action("decommission", `Server ${srv.hostname} marked decommissioned`); navigate("/infrastructure/servers"); };

  const uptimeDays = Math.floor(srv.uptimeSec / 86_400);

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader
        title={srv.hostname}
        subtitle={`${srv.ip} · ${srv.os} ${srv.osVersion} · ${srv.environment.toUpperCase()} · ${srv.criticality}`}
        icon={ServerCog}
        actions={
          <>
            <Link to="/infrastructure/servers"><Button variant="ghost" size="sm"><ArrowLeft className="mr-1 h-3.5 w-3.5" /> Back</Button></Link>
            {srv.status === "maintenance"
              ? <Button variant="outline" size="sm" onClick={exitMaintenance}><Wrench className="mr-1 h-3.5 w-3.5" /> Exit maintenance</Button>
              : <Button variant="outline" size="sm" onClick={enterMaintenance}><Wrench className="mr-1 h-3.5 w-3.5" /> Maintenance</Button>}
            <Button variant="outline" size="sm" onClick={restart}><Power className="mr-1 h-3.5 w-3.5" /> Restart</Button>
            <Button variant="destructive" size="sm" onClick={decommission}>Decommission</Button>
          </>
        }
      />

      <div className="grid gap-3 p-4 sm:p-6 lg:grid-cols-4">
        <Stat icon={Activity} label="Status">{<InfraStatusBadge status={srv.status} pulse size="md" />}</Stat>
        <Stat icon={ShieldCheck} label="SLA actual" value={`${srv.slaActual.toFixed(2)}%`} hint={`target ${srv.slaTarget}%`} />
        <Stat icon={Activity} label="Uptime" value={`${uptimeDays}d`} hint={`${(srv.uptimeSec / 3600).toFixed(0)}h`} />
        <Stat icon={AlertTriangle} label="Risk score" value={String(srv.riskScore)} hint={`${srv.activeIncidents} incidents`} />
      </div>

      <div className="px-4 sm:px-6 pb-8">
        <Tabs defaultValue="overview">
          <TabsList className="flex flex-wrap">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="services">Services</TabsTrigger>
            <TabsTrigger value="logs">Logs</TabsTrigger>
            <TabsTrigger value="applications">Applications</TabsTrigger>
            <TabsTrigger value="containers">Containers</TabsTrigger>
            <TabsTrigger value="alerts">Alerts</TabsTrigger>
            <TabsTrigger value="history">Change history</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-3 grid gap-3 lg:grid-cols-3">
            <Panel title="Identity">
              <KV k="Hostname" v={srv.hostname} />
              <KV k="FQDN" v={srv.fqdn ?? "—"} />
              <KV k="IP" v={srv.ip} />
              <KV k="OS" v={`${srv.os} ${srv.osVersion}`} />
              <KV k="Kind" v={srv.kind} />
              <KV k="Tags" v={srv.tags.join(", ") || "—"} />
            </Panel>
            <Panel title="Ownership & site">
              <KV k="Business owner" v={srv.businessOwner} />
              <KV k="Technical owner" v={srv.technicalOwner} />
              <KV k="Team" v={srv.team} />
              <KV k="Department" v={srv.department} />
              <KV k="Site" v={srv.siteId} />
              <KV k="Rack" v={`${srv.rack ?? "—"} U${srv.rackUnit ?? "—"}`} />
            </Panel>
            <Panel title="Hardware">
              <KV k="CPU" v={`${srv.hardware.cpuModel} · ${srv.hardware.cores}c × ${srv.hardware.sockets}`} />
              <KV k="RAM" v={`${srv.hardware.ramGb} GB`} />
              <KV k="Disk" v={`${srv.hardware.diskGb} GB`} />
              <KV k="Vendor" v={`${srv.hardware.vendor ?? "—"} ${srv.hardware.model ?? ""}`} />
              <KV k="Agent" v={srv.agent} />
              <KV k="Auth" v={srv.credentials.authMethod} />
            </Panel>
          </TabsContent>

          <TabsContent value="performance" className="mt-3 grid gap-3 lg:grid-cols-2">
            <Panel title="Resource posture">
              <div className="space-y-3">
                <Bar icon={Cpu} label={`CPU · load ${srv.loadAvg.join(" / ")}`} value={srv.cpuPct} />
                <Bar icon={MemoryStick} label="Memory" value={srv.ramPct} />
                <Bar icon={HardDrive} label={`Disk · IO-wait ${srv.ioWaitPct.toFixed(1)}%`} value={srv.diskPct} />
                <Bar icon={Network} label={`Network · rx ${srv.netRxMbps} / tx ${srv.netTxMbps} Mbps`} value={Math.min(100, (srv.netRxMbps + srv.netTxMbps) / 10)} />
              </div>
            </Panel>
            <Panel title="Mounted disks">
              <table className="w-full text-xs">
                <thead className="text-[10px] uppercase tracking-wider text-muted-foreground"><tr><th className="text-left">Mount</th><th className="text-right">Used</th><th className="text-right">Total</th><th className="w-[120px]">Usage</th></tr></thead>
                <tbody>
                  {srv.disks.map((d) => (
                    <tr key={d.mount} className="border-t border-border">
                      <td className="py-1.5 font-mono">{d.mount}</td>
                      <td className="py-1.5 text-right">{d.usedGb} GB</td>
                      <td className="py-1.5 text-right">{d.totalGb} GB</td>
                      <td className="py-1.5"><ResourceBar value={(d.usedGb / d.totalGb) * 100} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
            <Panel title="Processes (top)">
              <table className="w-full text-xs">
                <thead className="text-[10px] uppercase tracking-wider text-muted-foreground"><tr><th className="text-left">PID</th><th className="text-left">User</th><th className="text-left">Command</th><th className="text-right">CPU%</th><th className="text-right">MEM%</th></tr></thead>
                <tbody>
                  {srv.processes.map((p) => (
                    <tr key={p.pid} className="border-t border-border">
                      <td className="py-1.5 font-mono">{p.pid}</td>
                      <td className="py-1.5">{p.user}</td>
                      <td className="py-1.5 font-mono">{p.command}</td>
                      <td className="py-1.5 text-right">{p.cpu.toFixed(1)}</td>
                      <td className="py-1.5 text-right">{p.mem.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
            <Panel title="Network interfaces">
              <table className="w-full text-xs">
                <thead className="text-[10px] uppercase tracking-wider text-muted-foreground"><tr><th className="text-left">NIC</th><th className="text-left">IPv4</th><th className="text-right">Speed</th><th className="text-right">RX</th><th className="text-right">TX</th></tr></thead>
                <tbody>
                  {srv.nics.map((n) => (
                    <tr key={n.name} className="border-t border-border">
                      <td className="py-1.5 font-mono">{n.name}</td>
                      <td className="py-1.5 font-mono">{n.ipv4 ?? "—"}</td>
                      <td className="py-1.5 text-right">{n.speedMbps} Mbps</td>
                      <td className="py-1.5 text-right">{n.rxMbps} Mbps</td>
                      <td className="py-1.5 text-right">{n.txMbps} Mbps</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
          </TabsContent>

          <TabsContent value="services" className="mt-3">
            <Panel title="Running services">
              <table className="w-full text-xs">
                <thead className="text-[10px] uppercase tracking-wider text-muted-foreground"><tr><th className="text-left">Service</th><th className="text-left">State</th><th className="text-left">Enabled</th><th className="text-right">Uptime</th><th className="text-right">Actions</th></tr></thead>
                <tbody>
                  {srv.services.map((s) => (
                    <tr key={s.name} className="border-t border-border">
                      <td className="py-1.5 font-mono">{s.name}</td>
                      <td className="py-1.5"><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ring-1 ${s.state === "running" ? "bg-success/10 text-success ring-success/30" : s.state === "failed" ? "bg-destructive/10 text-destructive ring-destructive/30" : "bg-muted/40 text-muted-foreground ring-border"}`}>{s.state}</span></td>
                      <td className="py-1.5">{s.enabled ? "yes" : "no"}</td>
                      <td className="py-1.5 text-right">{s.uptimeSec ? `${Math.floor(s.uptimeSec / 3600)}h` : "—"}</td>
                      <td className="py-1.5 text-right"><Button size="sm" variant="ghost" onClick={() => action("restart", `Restarted service ${s.name}`)}>Restart</Button></td>
                    </tr>
                  ))}
                  {srv.services.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">No services tracked.</td></tr>}
                </tbody>
              </table>
            </Panel>
          </TabsContent>

          <TabsContent value="logs" className="mt-3">
            <Panel title="Recent log entries">
              <div className="space-y-1 font-mono text-[11px]">
                {srv.recentLogs.map((l, i) => (
                  <div key={i} className="flex gap-2 rounded border border-border bg-background px-2 py-1">
                    <span className="text-muted-foreground">{new Date(l.ts).toLocaleTimeString()}</span>
                    <span className={`uppercase ${l.level === "error" || l.level === "fatal" ? "text-destructive" : l.level === "warn" ? "text-yellow-600" : "text-muted-foreground"}`}>{l.level}</span>
                    <span className="text-muted-foreground">[{l.source}]</span>
                    <span className="text-foreground">{l.message}</span>
                  </div>
                ))}
                {srv.recentLogs.length === 0 && <p className="text-muted-foreground">No recent logs.</p>}
              </div>
            </Panel>
          </TabsContent>

          <TabsContent value="applications" className="mt-3 grid gap-3 lg:grid-cols-2">
            <Panel title="Installed packages">
              <table className="w-full text-xs">
                <thead className="text-[10px] uppercase tracking-wider text-muted-foreground"><tr><th className="text-left">Package</th><th className="text-left">Version</th><th className="text-left">Vendor</th></tr></thead>
                <tbody>
                  {srv.installed.map((p) => (
                    <tr key={p.name} className="border-t border-border"><td className="py-1.5 font-mono">{p.name}</td><td className="py-1.5">{p.version}</td><td className="py-1.5">{p.vendor ?? "—"}</td></tr>
                  ))}
                </tbody>
              </table>
            </Panel>
            <Panel title="Linked business applications">
              {srv.linkedApps.length === 0 && <p className="text-xs text-muted-foreground">No applications linked.</p>}
              <div className="space-y-1">
                {srv.linkedApps.map((a) => (
                  <Link key={a} to={`/applications/${a}`} className="block rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-mono hover:border-primary/40">{a}</Link>
                ))}
              </div>
            </Panel>
          </TabsContent>

          <TabsContent value="containers" className="mt-3">
            <Panel title="Containers on this host">
              {srv.containers.length === 0 && <p className="text-xs text-muted-foreground">No containers detected.</p>}
              <table className="w-full text-xs">
                <tbody>
                  {srv.containers.map((c) => (
                    <tr key={c.id} className="border-t border-border"><td className="py-1.5 font-mono">{c.id.slice(0, 12)}</td><td className="py-1.5 font-mono">{c.image}</td><td className="py-1.5">{c.state}</td></tr>
                  ))}
                </tbody>
              </table>
            </Panel>
          </TabsContent>

          <TabsContent value="alerts" className="mt-3">
            <Panel title="Active incidents & triggers">
              {srv.activeIncidents === 0
                ? <p className="text-xs text-muted-foreground">No active incidents.</p>
                : <p className="text-xs">{srv.activeIncidents} open incident(s) linked to this host. See <Link to="/incidents" className="text-primary hover:underline">Incidents</Link>.</p>}
            </Panel>
          </TabsContent>

          <TabsContent value="history" className="mt-3">
            <Panel title="Change & audit history">
              <div className="space-y-1.5">
                {srv.changes.map((c) => (
                  <div key={c.id} className="rounded-md border border-border bg-background p-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-medium capitalize">{c.kind}</span>
                      <span className="text-[10px] text-muted-foreground">{new Date(c.ts).toLocaleString()} · {c.actor}</span>
                    </div>
                    <p className="mt-0.5 text-muted-foreground">{c.summary}</p>
                  </div>
                ))}
                {srv.changes.length === 0 && <p className="text-xs text-muted-foreground">No changes recorded.</p>}
              </div>
            </Panel>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

const Panel = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="rounded-xl border border-border bg-card p-4">
    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{title}</p>
    {children}
  </div>
);
const KV = ({ k, v }: { k: string; v: string }) => (
  <div className="flex items-baseline justify-between gap-3 border-b border-border/60 py-1 text-xs last:border-b-0"><span className="text-muted-foreground">{k}</span><span className="text-right font-mono">{v}</span></div>
);
const Stat = ({ icon: Icon, label, value, hint, children }: { icon: any; label: string; value?: string; hint?: string; children?: React.ReactNode }) => (
  <div className="rounded-xl border border-border bg-card p-4">
    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted/60"><Icon className="h-4 w-4" /></div>
    {value && <p className="mt-3 text-2xl font-semibold tracking-tight">{value}</p>}
    {children && <div className="mt-3">{children}</div>}
    <p className="mt-0.5 text-[11px] text-muted-foreground">{label}{hint ? ` · ${hint}` : ""}</p>
  </div>
);
const Bar = ({ icon: Icon, label, value }: { icon: any; label: string; value: number }) => (
  <div>
    <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground"><span className="inline-flex items-center gap-1.5"><Icon className="h-3.5 w-3.5" /> {label}</span><span className="font-mono text-foreground">{value.toFixed(1)}%</span></div>
    <ResourceBar value={value} />
  </div>
);
