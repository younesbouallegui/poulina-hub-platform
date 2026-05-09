import { useEffect, useMemo, useState } from "react";
import { Responsive, WidthProvider, type Layout } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import { useNavigate, useParams } from "react-router-dom";
import {
  Plus, Save, Tv, Download, Upload, Copy, Trash2, Pencil, LayoutGrid, FileText, Star,
  Building2, Users as UsersIcon, User, ShieldCheck, Activity, ArrowLeft, Search,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { PanelBuilder } from "@/components/dashboards/PanelBuilder";
import { PanelRenderer } from "@/components/dashboards/PanelRenderer";
import { STARTER_DASHBOARDS } from "@/data/monitoringMock";
import type { DashboardCategory, DashboardPanel, MonitoringDashboard } from "@/types/monitoring";

const ResponsiveGrid = WidthProvider(Responsive);
const STORAGE_KEY = "poulina.dashboards.v1";

const CATEGORIES: { id: DashboardCategory | "all"; label: string; icon: typeof LayoutGrid }[] = [
  { id: "all", label: "All", icon: LayoutGrid },
  { id: "executive", label: "Executive", icon: ShieldCheck },
  { id: "noc", label: "NOC", icon: Activity },
  { id: "department", label: "Department", icon: Building2 },
  { id: "team", label: "Team", icon: UsersIcon },
  { id: "personal", label: "Personal", icon: User },
  { id: "template", label: "Templates", icon: FileText },
];

const loadDashboards = (): MonitoringDashboard[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return STARTER_DASHBOARDS;
};
const saveDashboards = (d: MonitoringDashboard[]) => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); } catch {}
};

const Dashboards = () => {
  const navigate = useNavigate();
  const { mode, id } = useParams<{ mode?: string; id?: string }>();
  const [dashboards, setDashboards] = useState<MonitoringDashboard[]>(loadDashboards);
  const [category, setCategory] = useState<DashboardCategory | "all">("all");
  const [search, setSearch] = useState("");

  useEffect(() => { saveDashboards(dashboards); }, [dashboards]);

  const filtered = useMemo(() => dashboards.filter((d) =>
    (category === "all" || d.category === category) &&
    (search === "" || d.name.toLowerCase().includes(search.toLowerCase()))
  ), [dashboards, category, search]);

  // VIEWER / BUILDER mode
  if (mode === "view" || mode === "builder" || mode === "wallboard") {
    const dash = dashboards.find((d) => d.id === id);
    if (!dash) return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        Dashboard not found.
      </div>
    );
    return (
      <DashboardEditor
        dashboard={dash}
        mode={mode as any}
        onSave={(d) => setDashboards((arr) => arr.map((x) => x.id === d.id ? d : x))}
        onExit={() => navigate("/dashboards")}
        onDuplicate={(d) => {
          const copy: MonitoringDashboard = { ...d, id: crypto.randomUUID(), name: `${d.name} (copy)`, updatedAt: new Date().toISOString() };
          setDashboards((arr) => [copy, ...arr]);
          navigate(`/dashboards/builder/${copy.id}`);
        }}
        onDelete={(d) => {
          setDashboards((arr) => arr.filter((x) => x.id !== d.id));
          navigate("/dashboards");
        }}
      />
    );
  }

  // HOME
  const create = (category: DashboardCategory = "personal") => {
    const d: MonitoringDashboard = {
      id: crypto.randomUUID(),
      name: "New dashboard",
      category,
      panels: [],
      updatedAt: new Date().toISOString(),
    };
    setDashboards((arr) => [d, ...arr]);
    navigate(`/dashboards/builder/${d.id}`);
  };

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader
        title="Dashboards"
        subtitle="Unified observability — Grafana-class panels for hosts, services and departments"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate("/dashboards/templates")}><FileText className="mr-2 h-4 w-4" /> Templates</Button>
            <Button size="sm" onClick={() => create("personal")}><Plus className="mr-2 h-4 w-4" /> New dashboard</Button>
          </div>
        }
      />
      <div className="flex flex-1 flex-col gap-4 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search dashboards…" className="pl-9" />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((c) => {
              const Icon = c.icon;
              const active = category === c.id;
              return (
                <button key={c.id} onClick={() => setCategory(c.id)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors",
                    active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:bg-muted",
                  )}>
                  <Icon className="h-3.5 w-3.5" /> {c.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((d) => (
            <Card key={d.id} className="group flex flex-col overflow-hidden transition-all hover:border-primary/40 hover:shadow-elevated">
              <button onClick={() => navigate(`/dashboards/view/${d.id}`)} className="flex h-32 items-center justify-center bg-gradient-to-br from-primary/10 via-card to-card">
                <LayoutGrid className="h-10 w-10 text-primary/60 transition-transform group-hover:scale-110" />
              </button>
              <div className="flex flex-1 flex-col gap-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{d.name}</p>
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{d.category}</p>
                  </div>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">{d.panels.length} panels</span>
                </div>
                {d.description && <p className="line-clamp-2 text-xs text-muted-foreground">{d.description}</p>}
                <div className="mt-auto flex gap-1.5 pt-2">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => navigate(`/dashboards/builder/${d.id}`)}>
                    <Pencil className="mr-1.5 h-3 w-3" /> Edit
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => navigate(`/dashboards/wallboard/${d.id}`)} title="Wallboard">
                    <Tv className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
          {filtered.length === 0 && (
            <Card className="col-span-full flex flex-col items-center justify-center gap-3 p-12 text-center">
              <LayoutGrid className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm font-medium">No dashboards yet</p>
              <Button size="sm" onClick={() => create()}><Plus className="mr-2 h-4 w-4" /> Create your first dashboard</Button>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

interface EditorProps {
  dashboard: MonitoringDashboard;
  mode: "view" | "builder" | "wallboard";
  onSave: (d: MonitoringDashboard) => void;
  onExit: () => void;
  onDuplicate: (d: MonitoringDashboard) => void;
  onDelete: (d: MonitoringDashboard) => void;
}

const DashboardEditor = ({ dashboard, mode, onSave, onExit, onDuplicate, onDelete }: EditorProps) => {
  const navigate = useNavigate();
  const [local, setLocal] = useState<MonitoringDashboard>(dashboard);
  const [builderOpen, setBuilderOpen] = useState(false);
  const editing = mode === "builder";
  const wallboard = mode === "wallboard";

  const layout: Layout[] = local.panels.map((p) => ({
    i: p.id, x: p.x, y: p.y, w: p.w, h: p.h, minW: 3, minH: 3,
  }));

  const onLayoutChange = (l: Layout[]) => {
    setLocal((d) => ({
      ...d,
      panels: d.panels.map((p) => {
        const li = l.find((x) => x.i === p.id);
        return li ? { ...p, x: li.x, y: li.y, w: li.w, h: li.h } : p;
      }),
    }));
  };

  const addPanel = (panel: DashboardPanel) => {
    const maxY = local.panels.reduce((m, p) => Math.max(m, p.y + p.h), 0);
    setLocal((d) => ({ ...d, panels: [...d.panels, { ...panel, x: 0, y: maxY, w: 8, h: 6 }] }));
  };

  const removePanel = (id: string) => setLocal((d) => ({ ...d, panels: d.panels.filter((p) => p.id !== id) }));
  const clonePanel = (id: string) => setLocal((d) => {
    const p = d.panels.find((x) => x.id === id);
    if (!p) return d;
    const maxY = d.panels.reduce((m, x) => Math.max(m, x.y + x.h), 0);
    return { ...d, panels: [...d.panels, { ...p, id: crypto.randomUUID(), title: `${p.title} (copy)`, y: maxY, x: 0 }] };
  });

  const save = () => {
    const updated = { ...local, updatedAt: new Date().toISOString() };
    onSave(updated);
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(local, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${local.name.replace(/\s+/g, "-")}.json`;
    a.click();
  };
  const importJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => { try { setLocal(JSON.parse(r.result as string)); } catch {} };
    r.readAsText(f);
  };

  return (
    <div className={cn("flex min-h-full flex-col", wallboard && "bg-background")}>
      {!wallboard && (
        <div className="sticky top-0 z-20 flex flex-wrap items-center gap-2 border-b border-border bg-card/80 px-4 py-3 backdrop-blur-md">
          <Button variant="ghost" size="sm" onClick={onExit}><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
          <input
            value={local.name}
            onChange={(e) => setLocal((d) => ({ ...d, name: e.target.value }))}
            className="border-0 bg-transparent text-base font-semibold tracking-tight text-foreground outline-none focus:bg-muted/50 rounded px-2 py-1"
            disabled={!editing}
          />
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{local.category}</span>
          <div className="ml-auto flex flex-wrap gap-2">
            {editing && <Button size="sm" variant="outline" onClick={() => setBuilderOpen(true)}><Plus className="mr-2 h-4 w-4" /> Add panel</Button>}
            <Button size="sm" variant="outline" onClick={() => navigate(`/dashboards/wallboard/${local.id}`)}><Tv className="mr-2 h-4 w-4" /> Wallboard</Button>
            {editing ? (
              <Button size="sm" variant="outline" onClick={() => navigate(`/dashboards/view/${local.id}`)}>View</Button>
            ) : (
              <Button size="sm" variant="outline" onClick={() => navigate(`/dashboards/builder/${local.id}`)}><Pencil className="mr-2 h-4 w-4" /> Edit</Button>
            )}
            <Button size="sm" variant="outline" onClick={() => onDuplicate(local)}><Copy className="mr-2 h-4 w-4" /> Duplicate</Button>
            <Button size="sm" variant="outline" onClick={exportJson}><Download className="mr-2 h-4 w-4" /> Export</Button>
            <label className="inline-flex h-9 cursor-pointer items-center rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-muted">
              <Upload className="mr-2 h-4 w-4" /> Import
              <input type="file" accept="application/json" hidden onChange={importJson} />
            </label>
            {editing && <Button size="sm" onClick={save}><Save className="mr-2 h-4 w-4" /> Save</Button>}
            {editing && <Button size="sm" variant="ghost" className="text-destructive" onClick={() => onDelete(local)}><Trash2 className="mr-2 h-4 w-4" /> Delete</Button>}
          </div>
        </div>
      )}
      {wallboard && (
        <Button onClick={onExit} className="fixed right-4 top-4 z-50" size="sm" variant="outline">Exit wallboard</Button>
      )}

      {local.panels.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-12">
          <Card className="flex flex-col items-center gap-4 p-12 text-center">
            <LayoutGrid className="h-12 w-12 text-muted-foreground/40" />
            <div>
              <p className="text-base font-semibold text-foreground">No panels yet</p>
              <p className="mt-1 text-sm text-muted-foreground">Build a panel using the host → metric → visualization flow.</p>
            </div>
            <Button onClick={() => setBuilderOpen(true)}><Plus className="mr-2 h-4 w-4" /> Add panel</Button>
          </Card>
        </div>
      ) : (
        <div className="p-3">
          <ResponsiveGrid
            className="layout"
            cols={24}
            rowHeight={40}
            isDraggable={editing}
            isResizable={editing}
            draggableHandle=".panel-drag"
            margin={[8, 8]}
            layout={layouts}
            onLayoutChange={onLayoutChange}
          >
            {local.panels.map((p) => (
              <div key={p.id} className={cn(
                "rounded-xl border border-border bg-card shadow-sm overflow-hidden flex flex-col",
                wallboard && "border-border/40",
              )}>
                <div className={cn("flex items-center justify-between border-b border-border px-3 py-1.5", editing && "panel-drag cursor-move")}>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-foreground">{p.title}</p>
                    <p className="truncate text-[10px] uppercase tracking-wider text-muted-foreground">
                      {p.viz} · {p.scope.kind} · {p.config.timeRange}
                    </p>
                  </div>
                  {editing && (
                    <div className="flex gap-0.5">
                      <button onClick={() => clonePanel(p.id)} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" title="Duplicate"><Copy className="h-3 w-3" /></button>
                      <button onClick={() => removePanel(p.id)} className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" title="Remove"><Trash2 className="h-3 w-3" /></button>
                    </div>
                  )}
                </div>
                <div className="flex-1 overflow-hidden p-2">
                  <PanelRenderer panel={p} />
                </div>
              </div>
            ))}
          </ResponsiveGrid>
        </div>
      )}

      <PanelBuilder open={builderOpen} onClose={() => setBuilderOpen(false)} onSave={addPanel} />
    </div>
  );
};

export default Dashboards;
