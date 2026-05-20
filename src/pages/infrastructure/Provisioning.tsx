import { useState } from "react";
import { Workflow, Server as ServerIcon, Trash2, Power, Wrench, Tag } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ServerOnboardDialog } from "@/components/infrastructure/ServerOnboardDialog";
import { useServers, useUpsertServer, useDeleteServer, useAppendChange } from "@/hooks/useInfrastructure";

export default function Provisioning() {
  const { data: servers = [] } = useServers();
  const upsert = useUpsertServer();
  const del = useDeleteServer();
  const appendChange = useAppendChange();
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [tag, setTag] = useState("");

  const toggle = (id: string) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const bulkMaintenance = () => {
    sel.forEach((id) => {
      const s = servers.find((x) => x.id === id);
      if (!s) return;
      upsert.mutate({ ...s, status: "maintenance", updatedAt: new Date().toISOString() });
      appendChange.mutate({ id, change: { id: `ch-${Date.now()}-${id}`, ts: new Date().toISOString(), actor: "bulk", kind: "maintenance", summary: "Bulk maintenance mode" } });
    });
    toast.success(`${sel.size} servers → maintenance`);
    setSel(new Set());
  };
  const bulkRestart = () => {
    sel.forEach((id) => appendChange.mutate({ id, change: { id: `ch-${Date.now()}-${id}`, ts: new Date().toISOString(), actor: "bulk", kind: "restart", summary: "Bulk restart" } }));
    toast.success(`${sel.size} servers → restart queued`);
    setSel(new Set());
  };
  const bulkTag = () => {
    if (!tag) return toast.error("Enter a tag");
    sel.forEach((id) => {
      const s = servers.find((x) => x.id === id);
      if (!s) return;
      const next = Array.from(new Set([...s.tags, tag]));
      upsert.mutate({ ...s, tags: next, updatedAt: new Date().toISOString() });
      appendChange.mutate({ id, change: { id: `ch-${Date.now()}-${id}`, ts: new Date().toISOString(), actor: "bulk", kind: "tag", summary: `Tagged: ${tag}` } });
    });
    toast.success(`${sel.size} servers tagged "${tag}"`);
    setTag(""); setSel(new Set());
  };
  const bulkDelete = () => { sel.forEach((id) => del.mutate(id)); toast.success(`${sel.size} servers decommissioned`); setSel(new Set()); };

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader title="Provisioning" subtitle="Onboarding · bulk operations · agent deployment · template assignment"
        icon={Workflow} actions={<Button size="sm" onClick={() => setOpen(true)}><ServerIcon className="mr-1 h-3.5 w-3.5" /> Add server</Button>} />
      <div className="space-y-3 p-4 sm:p-6">
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3">
          <span className="text-xs text-muted-foreground">{sel.size} selected ·</span>
          <Button size="sm" variant="outline" disabled={!sel.size} onClick={bulkMaintenance}><Wrench className="mr-1 h-3.5 w-3.5" /> Maintenance</Button>
          <Button size="sm" variant="outline" disabled={!sel.size} onClick={bulkRestart}><Power className="mr-1 h-3.5 w-3.5" /> Restart</Button>
          <div className="flex items-center gap-1">
            <Input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="add tag…" className="h-8 w-32 text-xs" />
            <Button size="sm" variant="outline" disabled={!sel.size} onClick={bulkTag}><Tag className="mr-1 h-3.5 w-3.5" /> Tag</Button>
          </div>
          <Button size="sm" variant="destructive" disabled={!sel.size} onClick={bulkDelete}><Trash2 className="mr-1 h-3.5 w-3.5" /> Decommission</Button>
        </div>
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-xs">
            <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr><th className="px-3 py-2"><Checkbox checked={sel.size > 0 && sel.size === servers.length} onCheckedChange={(c) => setSel(c ? new Set(servers.map((s) => s.id)) : new Set())} /></th><th className="px-3 py-2 text-left">Hostname</th><th className="px-3 py-2 text-left">IP</th><th className="px-3 py-2 text-left">OS</th><th className="px-3 py-2 text-left">Env</th><th className="px-3 py-2 text-left">Agent</th><th className="px-3 py-2 text-left">Status</th></tr>
            </thead>
            <tbody>
              {servers.map((s) => (
                <tr key={s.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-3 py-2"><Checkbox checked={sel.has(s.id)} onCheckedChange={() => toggle(s.id)} /></td>
                  <td className="px-3 py-2 font-medium">{s.hostname}</td>
                  <td className="px-3 py-2 font-mono">{s.ip}</td>
                  <td className="px-3 py-2">{s.os} {s.osVersion}</td>
                  <td className="px-3 py-2 uppercase">{s.environment}</td>
                  <td className="px-3 py-2">{s.agent}</td>
                  <td className="px-3 py-2 uppercase">{s.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <ServerOnboardDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}
