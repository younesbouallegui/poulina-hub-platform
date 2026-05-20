import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Server as ServerIcon, ShieldCheck, Network, Wrench } from "lucide-react";
import { toast } from "sonner";
import { useUpsertServer } from "@/hooks/useInfrastructure";
import { useSites } from "@/hooks/useInfrastructure";
import { DEFAULT_MONITORING, type Server, type ServerKind, type InfraEnvironment, type InfraCriticality, type AgentType, type AuthMethod } from "@/types/infrastructure";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const KINDS: { v: ServerKind; l: string }[] = [
  { v: "linux", l: "Linux" }, { v: "windows", l: "Windows" }, { v: "vmware-vm", l: "VMware VM" },
  { v: "hyperv-vm", l: "Hyper-V VM" }, { v: "cloud-vm", l: "Cloud VM" }, { v: "bare-metal", l: "Bare metal" },
  { v: "k8s-node", l: "Kubernetes node" }, { v: "docker-host", l: "Docker host" },
];

export function ServerOnboardDialog({ open, onOpenChange }: Props) {
  const [step, setStep] = useState(1);
  const { data: sites = [] } = useSites();
  const upsert = useUpsertServer();
  const [form, setForm] = useState({
    hostname: "", ip: "", kind: "linux" as ServerKind, os: "Ubuntu", osVersion: "22.04",
    environment: "prod" as InfraEnvironment, region: "Africa" as Server["region"],
    siteId: "site-tun", criticality: "T2" as InfraCriticality,
    businessOwner: "", technicalOwner: "", team: "Platform", department: "IT",
    tags: "", agent: "zabbix-agent" as AgentType, authMethod: "ssh-key" as AuthMethod,
    username: "ansible", port: 22, keyRef: "", domain: "",
    monitoring: { ...DEFAULT_MONITORING },
    description: "",
  });

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const toggleMon = (k: keyof typeof form.monitoring) =>
    setForm((f) => ({ ...f, monitoring: { ...f.monitoring, [k]: !f.monitoring[k] } }));

  const submit = () => {
    if (!form.hostname || !form.ip) {
      toast.error("Hostname and IP are required");
      return;
    }
    const now = new Date().toISOString();
    const srv: Server = {
      id: `srv-${Date.now().toString(36)}`,
      hostname: form.hostname,
      fqdn: `${form.hostname}.poulina.tn`,
      ip: form.ip,
      kind: form.kind,
      os: form.os,
      osVersion: form.osVersion,
      environment: form.environment,
      region: form.region,
      siteId: form.siteId,
      criticality: form.criticality,
      status: "unknown",
      uptimeSec: 0,
      availability: 100,
      slaTarget: form.criticality === "T0" ? 99.99 : form.criticality === "T1" ? 99.9 : 99.5,
      slaActual: 100,
      riskScore: 12,
      healthScore: 100,
      cpuPct: 8, ramPct: 18, diskPct: 12, ioWaitPct: 0.5,
      loadAvg: [0.1, 0.12, 0.14],
      netRxMbps: 2, netTxMbps: 1,
      activeIncidents: 0,
      businessOwner: form.businessOwner || "Unassigned",
      technicalOwner: form.technicalOwner || "Unassigned",
      team: form.team,
      department: form.department,
      tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
      agent: form.agent,
      credentials: {
        authMethod: form.authMethod,
        username: form.username,
        port: form.port,
        keyRef: form.keyRef || undefined,
        domain: form.domain || undefined,
      },
      monitoring: form.monitoring,
      hardware: { cpuModel: "—", cores: 4, sockets: 1, ramGb: 16, diskGb: 200 },
      disks: [{ mount: "/", totalGb: 100, usedGb: 12 }],
      nics: [{ name: "eth0", ipv4: form.ip, speedMbps: 1000, rxMbps: 2, txMbps: 1 }],
      services: [],
      processes: [],
      installed: [],
      linkedApps: [],
      containers: [],
      recentLogs: [],
      changes: [{ id: `ch-${Date.now()}`, ts: now, actor: "onboarding", kind: "config", summary: `Server onboarded via wizard (${form.kind}).` }],
      lastSeen: now,
      createdAt: now,
      updatedAt: now,
    };
    upsert.mutate(srv, {
      onSuccess: () => {
        toast.success(`${srv.hostname} onboarded`);
        onOpenChange(false);
        setStep(1);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ServerIcon className="h-5 w-5 text-primary" /> Onboard a new server
          </DialogTitle>
        </DialogHeader>

        <div className="mb-4 flex items-center gap-2 text-[11px]">
          {[
            { n: 1, l: "Identity", icon: ServerIcon },
            { n: 2, l: "Location", icon: Network },
            { n: 3, l: "Credentials", icon: ShieldCheck },
            { n: 4, l: "Monitoring", icon: Wrench },
          ].map(({ n, l, icon: Ic }) => (
            <button
              key={n}
              onClick={() => setStep(n)}
              className={`flex flex-1 items-center gap-1.5 rounded-md border px-2 py-1.5 transition ${step === n ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}
            >
              <Ic className="h-3.5 w-3.5" />
              <span className="font-medium">{n}. {l}</span>
            </button>
          ))}
        </div>

        {step === 1 && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Hostname *"><Input value={form.hostname} onChange={(e) => set("hostname", e.target.value)} placeholder="app-prod-01" /></Field>
            <Field label="IP Address *"><Input value={form.ip} onChange={(e) => set("ip", e.target.value)} placeholder="10.20.30.40" /></Field>
            <Field label="Server type">
              <Select value={form.kind} onValueChange={(v) => set("kind", v as ServerKind)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{KINDS.map((k) => <SelectItem key={k.v} value={k.v}>{k.l}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Criticality">
              <Select value={form.criticality} onValueChange={(v) => set("criticality", v as InfraCriticality)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["T0", "T1", "T2", "T3"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="OS"><Input value={form.os} onChange={(e) => set("os", e.target.value)} /></Field>
            <Field label="OS version"><Input value={form.osVersion} onChange={(e) => set("osVersion", e.target.value)} /></Field>
            <Field label="Tags (comma-separated)" className="sm:col-span-2"><Input value={form.tags} onChange={(e) => set("tags", e.target.value)} placeholder="prod, api, billing" /></Field>
            <Field label="Description" className="sm:col-span-2"><Textarea rows={2} value={form.description} onChange={(e) => set("description", e.target.value)} /></Field>
          </div>
        )}

        {step === 2 && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Environment">
              <Select value={form.environment} onValueChange={(v) => set("environment", v as InfraEnvironment)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["prod", "uat", "dev", "dr"].map((e) => <SelectItem key={e} value={e}>{e.toUpperCase()}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Region">
              <Select value={form.region} onValueChange={(v) => set("region", v as Server["region"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Africa", "EMEA", "Americas", "APAC"].map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Site / Datacenter" className="sm:col-span-2">
              <Select value={form.siteId} onValueChange={(v) => set("siteId", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{sites.map((s) => <SelectItem key={s.id} value={s.id}>{s.name} · {s.code}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Business owner"><Input value={form.businessOwner} onChange={(e) => set("businessOwner", e.target.value)} placeholder="e.g. CFO Office" /></Field>
            <Field label="Technical owner"><Input value={form.technicalOwner} onChange={(e) => set("technicalOwner", e.target.value)} placeholder="e.g. Platform Team" /></Field>
            <Field label="Team"><Input value={form.team} onChange={(e) => set("team", e.target.value)} /></Field>
            <Field label="Department"><Input value={form.department} onChange={(e) => set("department", e.target.value)} /></Field>
          </div>
        )}

        {step === 3 && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Agent type">
              <Select value={form.agent} onValueChange={(v) => set("agent", v as AgentType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["zabbix-agent", "telegraf", "snmp", "agentless", "ssm", "ossec"].map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Auth method">
              <Select value={form.authMethod} onValueChange={(v) => set("authMethod", v as AuthMethod)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["ssh-key", "ssh-password", "winrm", "iam-role", "none"].map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Username"><Input value={form.username} onChange={(e) => set("username", e.target.value)} /></Field>
            <Field label="Port"><Input type="number" value={form.port} onChange={(e) => set("port", Number(e.target.value))} /></Field>
            <Field label="Vault key reference (no raw secrets)" className="sm:col-span-2">
              <Input value={form.keyRef} onChange={(e) => set("keyRef", e.target.value)} placeholder="vault://infra/ssh/ansible" />
            </Field>
            {form.authMethod === "winrm" && (
              <Field label="Windows domain" className="sm:col-span-2"><Input value={form.domain} onChange={(e) => set("domain", e.target.value)} placeholder="POULINA" /></Field>
            )}
            <div className="sm:col-span-2 rounded-md border border-border bg-muted/30 p-2 text-[11px] text-muted-foreground">
              Credentials are never stored in the platform — only a reference to your secrets vault is persisted.
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {([
              ["zabbix", "Zabbix monitoring"],
              ["logs", "Log monitoring"],
              ["process", "Process monitoring"],
              ["application", "Application monitoring"],
              ["database", "Database monitoring"],
              ["containers", "Container monitoring"],
              ["network", "Network checks"],
              ["ssl", "SSL monitoring"],
              ["security", "Security audit"],
            ] as const).map(([k, l]) => (
              <label key={k} className="flex items-start gap-2 rounded-md border border-border bg-card p-2.5 text-xs">
                <Checkbox checked={form.monitoring[k]} onCheckedChange={() => toggleMon(k)} />
                <span>{l}</span>
              </label>
            ))}
          </div>
        )}

        <DialogFooter className="mt-4 flex !justify-between gap-2">
          <Button variant="ghost" disabled={step === 1} onClick={() => setStep((s) => s - 1)}>Back</Button>
          {step < 4 ? (
            <Button onClick={() => setStep((s) => s + 1)}>Next</Button>
          ) : (
            <Button onClick={submit}>Onboard server</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <Label className="mb-1 block text-[11px] uppercase tracking-wider text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
