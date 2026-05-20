import { useState } from "react";
import { CalendarClock, Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useMaintenanceWindows, useUpsertMaintenance, useServers } from "@/hooks/useInfrastructure";

export default function Maintenance() {
  const { data: mws = [] } = useMaintenanceWindows();
  const { data: servers = [] } = useServers();
  const upsert = useUpsertMaintenance();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ title: "", description: "", targets: "", startsAt: "", endsAt: "", changeTicket: "" });

  const create = () => {
    if (!f.title || !f.startsAt || !f.endsAt) { toast.error("Title, start and end are required"); return; }
    upsert.mutate({
      id: `mw-${Date.now().toString(36)}`,
      title: f.title, description: f.description,
      targets: f.targets.split(",").map((t) => t.trim()).filter(Boolean),
      startsAt: new Date(f.startsAt).toISOString(),
      endsAt: new Date(f.endsAt).toISOString(),
      state: "scheduled", createdBy: "you", changeTicket: f.changeTicket || undefined,
    }, { onSuccess: () => { toast.success("Maintenance window scheduled"); setOpen(false); setF({ title: "", description: "", targets: "", startsAt: "", endsAt: "", changeTicket: "" }); } });
  };

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader title="Maintenance" subtitle="Planned downtime · change windows · approvals"
        icon={CalendarClock} actions={<Button size="sm" onClick={() => setOpen(true)}><Plus className="mr-1 h-3.5 w-3.5" /> Schedule window</Button>} />
      <div className="p-4 sm:p-6">
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-xs">
            <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground"><tr><th className="px-3 py-2 text-left">Title</th><th className="px-3 py-2 text-left">Targets</th><th className="px-3 py-2 text-left">Start</th><th className="px-3 py-2 text-left">End</th><th className="px-3 py-2 text-left">State</th><th className="px-3 py-2 text-left">Ticket</th><th className="px-3 py-2 text-left">By</th></tr></thead>
            <tbody>
              {mws.map((m) => (
                <tr key={m.id} className="border-t border-border">
                  <td className="px-3 py-2"><div className="font-medium">{m.title}</div><div className="text-[10px] text-muted-foreground">{m.description}</div></td>
                  <td className="px-3 py-2 font-mono text-[10px]">{m.targets.join(", ")}</td>
                  <td className="px-3 py-2">{new Date(m.startsAt).toLocaleString()}</td>
                  <td className="px-3 py-2">{new Date(m.endsAt).toLocaleString()}</td>
                  <td className="px-3 py-2"><span className={`rounded px-2 py-0.5 text-[10px] uppercase ${m.state === "in_progress" ? "bg-blue-500/10 text-blue-600" : m.state === "completed" ? "bg-success/10 text-success" : m.state === "cancelled" ? "bg-muted/40 text-muted-foreground" : "bg-yellow-500/10 text-yellow-600"}`}>{m.state}</span></td>
                  <td className="px-3 py-2 font-mono">{m.changeTicket ?? "—"}</td>
                  <td className="px-3 py-2">{m.createdBy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Schedule maintenance window</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-[11px] uppercase">Title</Label><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
            <div><Label className="text-[11px] uppercase">Description</Label><Textarea rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
            <div><Label className="text-[11px] uppercase">Target server IDs (comma-separated)</Label><Input value={f.targets} onChange={(e) => setF({ ...f, targets: e.target.value })} placeholder={servers.slice(0, 2).map((s) => s.id).join(", ")} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-[11px] uppercase">Start</Label><Input type="datetime-local" value={f.startsAt} onChange={(e) => setF({ ...f, startsAt: e.target.value })} /></div>
              <div><Label className="text-[11px] uppercase">End</Label><Input type="datetime-local" value={f.endsAt} onChange={(e) => setF({ ...f, endsAt: e.target.value })} /></div>
            </div>
            <div><Label className="text-[11px] uppercase">Change ticket</Label><Input value={f.changeTicket} onChange={(e) => setF({ ...f, changeTicket: e.target.value })} placeholder="CHG-XXXX" /></div>
          </div>
          <DialogFooter><Button onClick={create}>Schedule</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
