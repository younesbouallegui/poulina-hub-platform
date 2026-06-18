import { useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Cpu, MemoryStick, HardDrive, Network, Activity,
  AlertTriangle, ServerCog, Wrench, ShieldCheck, Power, Brain, Radio,
  Database, Layers, Workflow, BookOpen, Sparkles, GitBranch, CheckCircle2,
  XCircle, HelpCircle, Boxes,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { InfraStatusBadge, ResourceBar } from "@/components/infrastructure/InfraStatusBadge";
import { useServer, useServers, useUpsertServer, useAppendChange } from "@/hooks/useInfrastructure";
import type { Server } from "@/types/infrastructure";
import {
  zabbixAgent, aiAgent, appServers, openEdge, aiOpsHistory,
  dependencyGraph, cockpitScores, type AgentHealth,
} from "@/lib/serverCockpit";

export default function ServerDetail() {
  const { id } = useParams();
  const { data: allServers = [] } = useServers();
  const srv = useServer(id);
  const upsert = useUpsertServer();
  const appendChange = useAppendChange();
  const navigate = useNavigate();

  const cockpit = useMemo(() => srv && {
    zbx: zabbixAgent(srv),
    ai: aiAgent(srv),
    apps: appServers(srv),
    oe: openEdge(srv),
    aiops: aiOpsHistory(srv),
    deps: dependencyGraph(srv, allServers),
    scores: cockpitScores(srv),
  }, [srv, allServers]);

  if (!srv || !cockpit) {
    return (
      <div className="p-6">
        <Link to="/infrastructure/servers" className="text-sm text-primary hover:underline">
          <ArrowLeft className="mr-1 inline h-3.5 w-3.5" /> Back to servers
        </Link>
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
  const { zbx, ai, apps, oe, aiops, deps, scores } = cockpit;

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

      {/* Top KPI strip */}
      <div className="grid gap-3 p-4 sm:p-6 lg:grid-cols-6">
        <Stat icon={Activity} label="Status">{<InfraStatusBadge status={srv.status} pulse size="md" />}</Stat>
        <ScoreCard label="Server health" value={scores.server} />
        <ScoreCard label="Application health" value={scores.application} />
        <ScoreCard label="Database health" value={scores.database} />
        <Stat icon={ShieldCheck} label="SLA actual" value={`${srv.slaActual.toFixed(2)}%`} hint={`target ${srv.slaTarget}%`} />
        <Stat icon={AlertTriangle} label="Overall risk" value={scores.overallRisk.toUpperCase()} hint={`${srv.activeIncidents} incidents · uptime ${uptimeDays}d`} />
      </div>

      {/* Agent Health Center — always visible above tabs */}
      <div className="grid gap-3 px-4 pb-2 sm:px-6 lg:grid-cols-2">
        <AgentCard
          title="Zabbix Agent"
          icon={Radio}
          health={zbx.health}
          rows={[
            ["State", zbx.state.toUpperCase()],
            ["Last check-in", new Date(zbx.lastCheckIn).toLocaleTimeString()],
            ["Version", zbx.version],
            ["Mode", zbx.mode],
            ["Response", `${zbx.latencyMs} ms`],
            ["7d availability", `${zbx.availability7d}%`],
          ]}
        />
        <AgentCard
          title="AI Agent"
          icon={Brain}
          health={ai.health}
          rows={[
            ["State", ai.state.toUpperCase()],
            ["Last heartbeat", new Date(ai.lastHeartbeat).toLocaleTimeString()],
            ["Version", ai.version],
            ["Model", ai.model],
            ["Automation", ai.automation],
            ["Learning", ai.learning],
            ["Knowledge sync", ai.knowledgeSync],
            ["Confidence", `${ai.confidence}%`],
          ]}
        />
      </div>

      <div className="px-4 sm:px-6 pb-8">
        <Tabs defaultValue="overview">
          <TabsList className="flex flex-wrap">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="health">Health</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="applications">Applications</TabsTrigger>
            <TabsTrigger value="databases">Databases</TabsTrigger>
            <TabsTrigger value="containers">Containers</TabsTrigger>
            <TabsTrigger value="services">Services</TabsTrigger>
            <TabsTrigger value="logs">Logs</TabsTrigger>
            <TabsTrigger value="incidents">Incidents</TabsTrigger>
            <TabsTrigger value="aiops">AI Operations</TabsTrigger>
            <TabsTrigger value="dependencies">Dependencies</TabsTrigger>
            <TabsTrigger value="audit">Audit Timeline</TabsTrigger>
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

          <TabsContent value="health" className="mt-3 grid gap-3 lg:grid-cols-3">
            <ScorePanel title="Server health" score={scores.server} desc="CPU · Memory · Storage · Network · Incidents · SLA" />
            <ScorePanel title="Application health" score={scores.application} desc="App-server availability, response time, error rate" />
            <ScorePanel title="Database health" score={scores.database} desc="OpenEdge / RDBMS broker, lock waits, replication" />
            <Panel title="Agent posture summary">
              <KV k="Zabbix agent" v={`${zbx.state} · ${zbx.health}`} />
              <KV k="AI agent" v={`${ai.state} · ${ai.health}`} />
              <KV k="Automation" v={ai.automation} />
              <KV k="Knowledge sync" v={ai.knowledgeSync} />
            </Panel>
            <Panel title="Resource posture">
              <div className="space-y-3">
                <Bar icon={Cpu} label="CPU" value={srv.cpuPct} />
                <Bar icon={MemoryStick} label="Memory" value={srv.ramPct} />
                <Bar icon={HardDrive} label="Disk" value={srv.diskPct} />
                <Bar icon={Network} label={`Net rx ${srv.netRxMbps} / tx ${srv.netTxMbps} Mbps`} value={Math.min(100, (srv.netRxMbps + srv.netTxMbps) / 10)} />
              </div>
            </Panel>
            <Panel title="Overall verdict">
              <div className="flex h-full flex-col items-start justify-center gap-2">
                <p className="text-3xl font-semibold tracking-tight capitalize">{scores.overallRisk} risk</p>
                <p className="text-xs text-muted-foreground">
                  Server {scores.server}% · App {scores.application}% · DB {scores.database}%
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {srv.activeIncidents} open incident(s) · SLA {srv.slaActual.toFixed(2)}% vs {srv.slaTarget}% target
                </p>
              </div>
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
              <Table head={["Mount", "Used", "Total", "Usage"]}>
                {srv.disks.map((d) => (
                  <tr key={d.mount} className="border-t border-border">
                    <td className="py-1.5 font-mono">{d.mount}</td>
                    <td className="py-1.5 text-right">{d.usedGb} GB</td>
                    <td className="py-1.5 text-right">{d.totalGb} GB</td>
                    <td className="py-1.5"><ResourceBar value={(d.usedGb / d.totalGb) * 100} /></td>
                  </tr>
                ))}
              </Table>
            </Panel>
            <Panel title="Processes (top)">
              <Table head={["PID", "User", "Command", "CPU%", "MEM%"]}>
                {srv.processes.map((p) => (
                  <tr key={p.pid} className="border-t border-border">
                    <td className="py-1.5 font-mono">{p.pid}</td>
                    <td className="py-1.5">{p.user}</td>
                    <td className="py-1.5 font-mono">{p.command}</td>
                    <td className="py-1.5 text-right">{p.cpu.toFixed(1)}</td>
                    <td className="py-1.5 text-right">{p.mem.toFixed(1)}</td>
                  </tr>
                ))}
              </Table>
            </Panel>
            <Panel title="Network interfaces">
              <Table head={["NIC", "IPv4", "Speed", "RX", "TX"]}>
                {srv.nics.map((n) => (
                  <tr key={n.name} className="border-t border-border">
                    <td className="py-1.5 font-mono">{n.name}</td>
                    <td className="py-1.5 font-mono">{n.ipv4 ?? "—"}</td>
                    <td className="py-1.5 text-right">{n.speedMbps} Mbps</td>
                    <td className="py-1.5 text-right">{n.rxMbps} Mbps</td>
                    <td className="py-1.5 text-right">{n.txMbps} Mbps</td>
                  </tr>
                ))}
              </Table>
            </Panel>
          </TabsContent>

          <TabsContent value="applications" className="mt-3 grid gap-3">
            <Panel title="Application servers detected">
              {apps.length === 0
                ? <p className="text-xs text-muted-foreground">No application servers detected on this host.</p>
                : (
                  <Table head={["Process", "Type", "State", "Avail", "Resp", "Err", "Sess", "RPS", "CPU%", "MEM%", "Port"]}>
                    {apps.map((a) => (
                      <tr key={a.name} className="border-t border-border">
                        <td className="py-1.5 font-mono">{a.name}</td>
                        <td className="py-1.5">{a.kind}</td>
                        <td className="py-1.5"><AppStateBadge state={a.state} /></td>
                        <td className="py-1.5 text-right">{a.availability}%</td>
                        <td className="py-1.5 text-right">{a.responseMs} ms</td>
                        <td className="py-1.5 text-right">{a.errorRate}%</td>
                        <td className="py-1.5 text-right">{a.sessions}</td>
                        <td className="py-1.5 text-right">{a.rps}</td>
                        <td className="py-1.5 text-right">{a.cpuPct}</td>
                        <td className="py-1.5 text-right">{a.memPct}</td>
                        <td className="py-1.5 text-right font-mono">{a.port}</td>
                      </tr>
                    ))}
                  </Table>
                )}
            </Panel>
            <div className="grid gap-3 lg:grid-cols-2">
              <Panel title="Installed packages">
                <Table head={["Package", "Version", "Vendor"]}>
                  {srv.installed.map((p) => (
                    <tr key={p.name} className="border-t border-border">
                      <td className="py-1.5 font-mono">{p.name}</td>
                      <td className="py-1.5">{p.version}</td>
                      <td className="py-1.5">{p.vendor ?? "—"}</td>
                    </tr>
                  ))}
                </Table>
              </Panel>
              <Panel title="Linked business applications">
                {srv.linkedApps.length === 0
                  ? <p className="text-xs text-muted-foreground">No applications linked.</p>
                  : (
                    <div className="space-y-1">
                      {srv.linkedApps.map((a) => (
                        <Link key={a} to={`/applications/${a}`} className="block rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-mono hover:border-primary/40">{a}</Link>
                      ))}
                    </div>
                  )}
              </Panel>
            </div>
          </TabsContent>

          <TabsContent value="databases" className="mt-3 grid gap-3 lg:grid-cols-3">
            <Panel title="OpenEdge monitoring">
              {!oe.present
                ? <p className="text-xs text-muted-foreground">OpenEdge not detected on this host.</p>
                : (
                  <>
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Health score</span>
                      <span className={`text-lg font-semibold ${oe.healthScore > 80 ? "text-success" : oe.healthScore > 60 ? "text-yellow-600" : "text-destructive"}`}>{oe.healthScore}</span>
                    </div>
                    <KV k="DB availability" v={oe.dbAvailable ? "Available" : "Unavailable"} />
                    <KV k="Broker" v={oe.brokerState} />
                    <KV k="Sessions" v={String(oe.sessions)} />
                    <KV k="Connected users" v={String(oe.users)} />
                    <KV k="Transactions/sec" v={String(oe.txPerSec)} />
                    <KV k="Lock waits" v={String(oe.lockWaits)} />
                    <KV k="Replication" v={`${oe.replicationState} · ${oe.replicationLagMs} ms`} />
                    <KV k="Storage used" v={`${oe.storageUsedPct}%`} />
                    <KV k="DB growth" v={`${oe.growthGbPerDay} GB/day`} />
                    <KV k="Recent errors" v={String(oe.recentErrors)} />
                  </>
                )}
            </Panel>
            <Panel title="Linked databases">
              {deps.databases.length === 0
                ? <p className="text-xs text-muted-foreground">No databases linked.</p>
                : (
                  <div className="space-y-1.5">
                    {deps.databases.map((d) => (
                      <div key={d.id} className="flex items-center justify-between rounded-md border border-border bg-background px-2.5 py-1.5 text-xs">
                        <span className="font-mono">{d.name}</span>
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{d.engine}</span>
                      </div>
                    ))}
                  </div>
                )}
            </Panel>
            <Panel title="Database performance">
              <div className="space-y-3">
                <Bar icon={HardDrive} label="Storage usage" value={oe.present ? oe.storageUsedPct : srv.diskPct} />
                <Bar icon={Activity} label="IO wait" value={Math.min(100, srv.ioWaitPct * 5)} />
                <Bar icon={Database} label="Lock contention" value={Math.min(100, oe.lockWaits * 1.2)} />
              </div>
            </Panel>
          </TabsContent>

          <TabsContent value="containers" className="mt-3">
            <Panel title="Containers on this host">
              {srv.containers.length === 0
                ? <p className="text-xs text-muted-foreground">No containers detected.</p>
                : (
                  <Table head={["ID", "Image", "State"]}>
                    {srv.containers.map((c) => (
                      <tr key={c.id} className="border-t border-border">
                        <td className="py-1.5 font-mono">{c.id.slice(0, 12)}</td>
                        <td className="py-1.5 font-mono">{c.image}</td>
                        <td className="py-1.5">{c.state}</td>
                      </tr>
                    ))}
                  </Table>
                )}
            </Panel>
          </TabsContent>

          <TabsContent value="services" className="mt-3">
            <Panel title="Running services">
              <Table head={["Service", "State", "Enabled", "Uptime", "Actions"]}>
                {srv.services.map((s) => (
                  <tr key={s.name} className="border-t border-border">
                    <td className="py-1.5 font-mono">{s.name}</td>
                    <td className="py-1.5">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ring-1 ${s.state === "running" ? "bg-success/10 text-success ring-success/30" : s.state === "failed" ? "bg-destructive/10 text-destructive ring-destructive/30" : "bg-muted/40 text-muted-foreground ring-border"}`}>{s.state}</span>
                    </td>
                    <td className="py-1.5">{s.enabled ? "yes" : "no"}</td>
                    <td className="py-1.5 text-right">{s.uptimeSec ? `${Math.floor(s.uptimeSec / 3600)}h` : "—"}</td>
                    <td className="py-1.5 text-right"><Button size="sm" variant="ghost" onClick={() => action("restart", `Restarted service ${s.name}`)}>Restart</Button></td>
                  </tr>
                ))}
                {srv.services.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">No services tracked.</td></tr>}
              </Table>
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

          <TabsContent value="incidents" className="mt-3">
            <Panel title="Active incidents & triggers">
              {srv.activeIncidents === 0
                ? <p className="text-xs text-muted-foreground">No active incidents.</p>
                : <p className="text-xs">{srv.activeIncidents} open incident(s) linked to this host. See <Link to="/incidents" className="text-primary hover:underline">Incidents</Link>.</p>}
            </Panel>
          </TabsContent>

          <TabsContent value="aiops" className="mt-3 grid gap-3 lg:grid-cols-3">
            <Panel title="AI agent status">
              <KV k="State" v={ai.state} />
              <KV k="Confidence" v={`${ai.confidence}%`} />
              <KV k="Automation policy" v={ai.automation} />
              <KV k="Learning" v={ai.learning} />
              <KV k="Knowledge" v={ai.knowledgeSync} />
              <KV k="Model" v={ai.model} />
            </Panel>
            <Panel title="Recommended actions">
              <div className="space-y-1.5">
                {aiops.filter((r) => r.kind === "recommendation").map((r) => (
                  <div key={r.id} className="rounded-md border border-border bg-background px-2.5 py-1.5 text-xs">
                    <div className="flex items-center gap-2"><Sparkles className="h-3 w-3 text-primary" /> {r.title}</div>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">confidence {r.confidence}%</p>
                  </div>
                ))}
                {aiops.filter((r) => r.kind === "recommendation").length === 0 && <p className="text-xs text-muted-foreground">No active recommendations.</p>}
              </div>
            </Panel>
            <Panel title="Learned incidents">
              <div className="space-y-1.5">
                {aiops.filter((r) => r.kind === "learned").map((r) => (
                  <div key={r.id} className="rounded-md border border-border bg-background px-2.5 py-1.5 text-xs">
                    <div className="flex items-center gap-2"><BookOpen className="h-3 w-3" /> {r.title}</div>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">{new Date(r.ts).toLocaleString()}</p>
                  </div>
                ))}
                {aiops.filter((r) => r.kind === "learned").length === 0 && <p className="text-xs text-muted-foreground">No learned incidents yet.</p>}
              </div>
            </Panel>
            <Panel title="Auto-remediation history">
              <div className="space-y-1.5">
                {aiops.filter((r) => r.kind === "auto-remediate").map((r) => (
                  <div key={r.id} className="flex items-center justify-between rounded-md border border-border bg-background px-2.5 py-1.5 text-xs">
                    <span className="inline-flex items-center gap-2">
                      {r.outcome === "success" ? <CheckCircle2 className="h-3 w-3 text-success" /> : r.outcome === "failure" ? <XCircle className="h-3 w-3 text-destructive" /> : <HelpCircle className="h-3 w-3 text-muted-foreground" />}
                      {r.title}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{new Date(r.ts).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </Panel>
            <Panel title="AI investigation history">
              <div className="space-y-1.5">
                {aiops.filter((r) => r.kind === "investigation").map((r) => (
                  <div key={r.id} className="rounded-md border border-border bg-background px-2.5 py-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-2"><Workflow className="h-3 w-3" /> {r.title}</span>
                      <span className="text-[10px] text-muted-foreground">conf {r.confidence}%</span>
                    </div>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">{new Date(r.ts).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </Panel>
          </TabsContent>

          <TabsContent value="dependencies" className="mt-3 grid gap-3 lg:grid-cols-2">
            <Panel title="Dependency graph">
              <div className="space-y-3 text-xs">
                <DepRow icon={Layers} label="Applications" items={deps.apps} />
                <DepRow icon={Database} label="Databases" items={deps.databases.map((d) => `${d.name} (${d.engine})`)} />
                <DepRow icon={Sparkles} label="Business services" items={deps.businessServices} />
                <DepRow icon={ServerCog} label="Peer servers" items={deps.peerServers.map((p) => p.hostname)} />
                <DepRow icon={GitBranch} label="Load balancers" items={deps.loadBalancers} />
                <DepRow icon={Boxes} label="Containers" items={deps.containers.map((c) => c.image)} />
                <DepRow icon={Network} label="Kubernetes nodes" items={deps.k8sNodes} />
              </div>
            </Panel>
            <Panel title="Infrastructure dependencies (visual)">
              <DependencyMap srv={srv} deps={deps} />
            </Panel>
          </TabsContent>

          <TabsContent value="audit" className="mt-3">
            <Panel title="Change & audit timeline">
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

// ---------- shared primitives ---------------------------------------------

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
const Table = ({ head, children }: { head: string[]; children: React.ReactNode }) => (
  <table className="w-full text-xs">
    <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
      <tr>{head.map((h, i) => <th key={i} className={i === 0 ? "text-left" : "text-right"}>{h}</th>)}</tr>
    </thead>
    <tbody>{children}</tbody>
  </table>
);

function ScoreCard({ label, value }: { label: string; value: number }) {
  const color = value > 80 ? "text-success" : value > 60 ? "text-yellow-600" : "text-destructive";
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-2 text-2xl font-semibold tracking-tight ${color}`}>{value}<span className="text-sm text-muted-foreground">/100</span></p>
      <div className="mt-2"><ResourceBar value={value} /></div>
    </div>
  );
}

function ScorePanel({ title, score, desc }: { title: string; score: number; desc: string }) {
  const color = score > 80 ? "text-success" : score > 60 ? "text-yellow-600" : "text-destructive";
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{title}</p>
      <p className={`mt-3 text-4xl font-semibold tracking-tight ${color}`}>{score}<span className="text-base text-muted-foreground">/100</span></p>
      <div className="mt-2"><ResourceBar value={score} /></div>
      <p className="mt-3 text-[11px] text-muted-foreground">{desc}</p>
    </div>
  );
}

function healthStyle(h: AgentHealth) {
  if (h === "healthy") return { dot: "bg-success", ring: "ring-success/30", text: "text-success", label: "Healthy" };
  if (h === "warning") return { dot: "bg-yellow-500", ring: "ring-yellow-500/30", text: "text-yellow-600", label: "Warning" };
  if (h === "critical") return { dot: "bg-destructive", ring: "ring-destructive/30", text: "text-destructive", label: "Critical" };
  return { dot: "bg-muted-foreground", ring: "ring-border", text: "text-muted-foreground", label: "Unknown" };
}

function AgentCard({ title, icon: Icon, health, rows }: { title: string; icon: any; health: AgentHealth; rows: [string, string][] }) {
  const s = healthStyle(health);
  return (
    <div className={`rounded-xl border bg-card p-4 ring-1 ${s.ring}`}>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted/60"><Icon className="h-4 w-4" /></div>
          <p className="text-sm font-semibold">{title}</p>
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ring-1 ${s.ring} ${s.text}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} /> {s.label}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-x-4">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between border-b border-border/60 py-1 text-xs last:border-b-0">
            <span className="text-muted-foreground">{k}</span>
            <span className="ml-2 truncate text-right font-mono">{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AppStateBadge({ state }: { state: "running" | "degraded" | "stopped" }) {
  const cls = state === "running"
    ? "bg-success/10 text-success ring-success/30"
    : state === "degraded"
      ? "bg-yellow-500/10 text-yellow-600 ring-yellow-500/30"
      : "bg-destructive/10 text-destructive ring-destructive/30";
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ring-1 ${cls}`}>{state}</span>;
}

function DepRow({ icon: Icon, label, items }: { icon: any; label: string; items: string[] }) {
  return (
    <div>
      <p className="mb-1 inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground"><Icon className="h-3 w-3" /> {label}</p>
      {items.length === 0
        ? <p className="text-[11px] text-muted-foreground">—</p>
        : (
          <div className="flex flex-wrap gap-1.5">
            {items.map((s, i) => (
              <span key={i} className="rounded-md border border-border bg-background px-2 py-0.5 font-mono text-[11px]">{s}</span>
            ))}
          </div>
        )}
    </div>
  );
}

function DependencyMap({ srv, deps }: { srv: Server; deps: ReturnType<typeof dependencyGraph> }) {
  // Lightweight radial SVG dependency map (no external libs)
  const groups: { label: string; items: string[]; color: string }[] = [
    { label: "Apps", items: deps.apps, color: "hsl(var(--primary))" },
    { label: "Databases", items: deps.databases.map((d) => d.name), color: "hsl(var(--success, 142 76% 36%))" },
    { label: "Peers", items: deps.peerServers.map((p) => p.hostname), color: "hsl(var(--muted-foreground))" },
    { label: "LBs", items: deps.loadBalancers, color: "hsl(48 96% 53%)" },
    { label: "Containers", items: deps.containers.map((c) => c.image.split(":")[0]), color: "hsl(199 89% 48%)" },
  ].filter((g) => g.items.length > 0);

  const cx = 200, cy = 160, r = 110;
  const total = groups.reduce((a, g) => a + g.items.length, 0) || 1;
  let idx = 0;
  return (
    <svg viewBox="0 0 400 320" className="w-full">
      <circle cx={cx} cy={cy} r={28} fill="hsl(var(--card))" stroke="hsl(var(--primary))" strokeWidth={2} />
      <text x={cx} y={cy - 2} textAnchor="middle" className="fill-foreground" fontSize={11} fontWeight={600}>{srv.hostname}</text>
      <text x={cx} y={cy + 12} textAnchor="middle" className="fill-muted-foreground" fontSize={9}>{srv.ip}</text>
      {groups.flatMap((g) =>
        g.items.slice(0, 6).map((label) => {
          const angle = (idx++ / Math.min(total, 24)) * Math.PI * 2;
          const x = cx + Math.cos(angle) * r;
          const y = cy + Math.sin(angle) * r;
          return (
            <g key={`${g.label}-${label}`}>
              <line x1={cx} y1={cy} x2={x} y2={y} stroke="hsl(var(--border))" strokeWidth={1} />
              <circle cx={x} cy={y} r={6} fill={g.color} />
              <text x={x} y={y - 9} textAnchor="middle" fontSize={9} className="fill-muted-foreground">{label.length > 14 ? `${label.slice(0, 14)}…` : label}</text>
            </g>
          );
        })
      )}
    </svg>
  );
}
