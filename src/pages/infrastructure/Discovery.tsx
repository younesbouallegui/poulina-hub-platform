import { useState } from "react";
import { Radar, Plus, Play } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useDiscoveryJobs, useUpsertDiscovery } from "@/hooks/useInfrastructure";
import type { DiscoveryJob } from "@/types/infrastructure";

const KINDS: DiscoveryJob["kind"][] = ["ip-range", "snmp", "vmware", "kubernetes", "cloud", "agent"];

export default function Discovery() {
  const { data: jobs = [] } = useDiscoveryJobs();
  const upsert = useUpsertDiscovery();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: "", kind: "ip-range" as DiscoveryJob["kind"], target: "", schedule: "*/15 * * * *" });

  const create = () => {
    if (!f.name || !f.target) return toast.error("Name and target required");
    upsert.mutate({
      id: `disc-${Date.now().toString(36)}`,
      name: f.name, kind: f.kind, target: f.target, schedule: f.schedule,
      enabled: true, discovered: 0, status: "idle",
    }, { onSuccess: () => { toast.success("Discovery job created"); setOpen(false); setF({ name: "", kind: "ip-range", target: "", schedule: "*/15 * * * *" }); } });
  };

  const runNow = (j: DiscoveryJob) => {
    upsert.mutate({ ...j, status: "running", lastRunAt: new Date().toISOString() });
    setTimeout(() => {
      const discovered = Math.floor(Math.random() * 40) + 4;
      upsert.mutate({ ...j, status: "ok", lastRunAt: new Date().toISOString(), lastDurationSec: 12, discovered });
      toast.success(`${j.name} found ${discovered} entities`);
    }, 1200);
  };

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader title="Discovery" subtitle="IP scanning · SNMP · VMware · Kubernetes · cloud inventory"
        icon={Radar} actions={<Button size="sm" onClick={() => setOpen(true)}><Plus className="mr-1 h-3.5 w-3.5" /> New job</Button>} />
      <div className="p-4 sm:p-6">
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-xs">
            <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground"><tr><th className="px-3 py-2 text-left">Job</th><th className="px-3 py-2 text-left">Kind</th><th className="px-3 py-2 text-left">Target</th><th className="px-3 py-2 text-left">Schedule</th><th className="px-3 py-2 text-left">Last run</th><th className="px-3 py-2 text-right">Discovered</th><th className="px-3 py-2 text-left">Status</th><th className="px-3 py-2"></th></tr></thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.id} className="border-t border-border">
                  <td className="px-3 py-2 font-medium">{j.name}</td>
                  <td className="px-3 py-2">{j.kind}</td>
                  <td className="px-3 py-2 font-mono">{j.target}</td>
                  <td className="px-3 py-2 font-mono">{j.schedule}</td>
                  <td className="px-3 py-2 text-muted-foreground">{j.lastRunAt ? new Date(j.lastRunAt).toLocaleString() : "—"}</td>
                  <td className="px-3 py-2 text-right font-mono">{j.discovered}</td>
                  <td className="px-3 py-2"><span className={`rounded px-2 py-0.5 text-[10px] uppercase ${j.status === "ok" ? "bg-success/10 text-success" : j.status === "failed" ? "bg-destructive/10 text-destructive" : j.status === "running" ? "bg-blue-500/10 text-blue-600" : "bg-muted/40 text-muted-foreground"}`}>{j.status}</span></td>
                  <td className="px-3 py-2 text-right"><Button size="sm" variant="ghost" onClick={() => runNow(j)}><Play className="mr-1 h-3.5 w-3.5" /> Run</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New discovery job</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-[11px] uppercase">Name</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
            <div><Label className="text-[11px] uppercase">Kind</Label>
              <Select value={f.kind} onValueChange={(v) => setF({ ...f, kind: v as DiscoveryJob["kind"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{KINDS.map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="text-[11px] uppercase">Target</Label><Input value={f.target} onChange={(e) => setF({ ...f, target: e.target.value })} placeholder="10.20.0.0/16 or vcenter.host" /></div>
            <div><Label className="text-[11px] uppercase">Schedule (cron)</Label><Input value={f.schedule} onChange={(e) => setF({ ...f, schedule: e.target.value })} className="font-mono" /></div>
          </div>
          <DialogFooter><Button onClick={create}>Create</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
