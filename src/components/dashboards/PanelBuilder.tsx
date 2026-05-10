import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  ArrowRight,
  Server,
  Layers,
  Building2,
  Boxes,
  Briefcase,
  Plug,
  CheckCircle2,
  Search,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  HOSTS,
  HOST_GROUPS,
  PROVIDERS,
  DEPARTMENTS,
  BUSINESS_SERVICES,
  METRIC_LIBRARY,
  VIZ_LIBRARY,
} from "@/data/monitoringMock";
import type {
  DashboardPanel,
  MetricKind,
  PanelConfig,
  PanelScope,
  PanelThreshold,
  ScopeKind,
  VizKind,
} from "@/types/monitoring";

interface PanelBuilderProps {
  open: boolean;
  onClose: () => void;
  onSave: (panel: DashboardPanel) => void;
}

const SCOPE_TYPES: { kind: ScopeKind; label: string; icon: typeof Server; help: string }[] = [
  { kind: "host", label: "Host", icon: Server, help: "Single machine, container or device." },
  { kind: "host_group", label: "Host group", icon: Layers, help: "Group of hosts (e.g. Linux fleet)." },
  { kind: "department", label: "Department", icon: Building2, help: "Owner / business unit." },
  { kind: "asset", label: "Asset", icon: Boxes, help: "CMDB asset entry." },
  { kind: "business_service", label: "Business service", icon: Briefcase, help: "End-user facing service." },
  { kind: "provider", label: "Provider", icon: Plug, help: "Source system (Zabbix, Prometheus…)." },
];

const TIME_RANGES: PanelConfig["timeRange"][] = ["5m", "15m", "1h", "6h", "24h", "7d", "30d"];

export const PanelBuilder = ({ open, onClose, onSave }: PanelBuilderProps) => {
  const [step, setStep] = useState(0);
  const [scope, setScope] = useState<PanelScope>({ kind: "host", ids: [] });
  const [search, setSearch] = useState("");
  const [metric, setMetric] = useState<MetricKind | null>(null);
  const [viz, setViz] = useState<VizKind | null>(null);
  const [config, setConfig] = useState<PanelConfig>({
    timeRange: "1h",
    refreshIntervalSec: 30,
    thresholds: [{ value: 80, color: "warning" }, { value: 95, color: "critical" }],
    severityColors: true,
  });
  const [multiHost, setMultiHost] = useState(false);
  const [forecast, setForecast] = useState(false);

  const scopeOptions = useMemo(() => {
    const q = search.toLowerCase();
    const filter = <T extends { id?: string; name?: string }>(arr: T[]) =>
      arr.filter((it) => ((it.name ?? it.id) ?? "").toLowerCase().includes(q));
    switch (scope.kind) {
      case "host": return HOSTS.filter((h) => h.name.toLowerCase().includes(q)).map((h) => ({ id: h.id, label: h.name, sub: h.fqdn ?? "" }));
      case "host_group": return filter(HOST_GROUPS).map((g) => ({ id: g.id, label: g.name, sub: g.department ?? "" }));
      case "department": return DEPARTMENTS.filter((d) => d.toLowerCase().includes(q)).map((d) => ({ id: d, label: d, sub: "" }));
      case "asset": return HOSTS.filter((h) => h.name.toLowerCase().includes(q)).map((h) => ({ id: h.id, label: h.name, sub: "Asset" }));
      case "business_service": return BUSINESS_SERVICES.filter((s) => s.toLowerCase().includes(q)).map((s) => ({ id: s, label: s, sub: "Service" }));
      case "provider": return PROVIDERS.filter((p) => p.name.toLowerCase().includes(q)).map((p) => ({ id: p.id, label: p.name, sub: p.kind }));
    }
  }, [scope.kind, search]);

  const reset = () => {
    setStep(0);
    setScope({ kind: "host", ids: [] });
    setSearch("");
    setMetric(null);
    setViz(null);
    setMultiHost(false);
    setForecast(false);
  };

  const close = () => { reset(); onClose(); };

  const canNext =
    (step === 0 && scope.ids.length > 0) ||
    (step === 1 && metric !== null) ||
    (step === 2 && viz !== null) ||
    step === 3;

  const finish = () => {
    if (!metric || !viz) return;
    const metricLabel = METRIC_LIBRARY.find((m) => m.kind === metric)?.label ?? metric;
    const panel: DashboardPanel = {
      id: crypto.randomUUID(),
      title: `${metricLabel}`,
      viz,
      scope,
      query: { metric, multiHost, forecast },
      config,
      x: 0, y: 0, w: 8, h: 6,
    };
    onSave(panel);
    close();
  };

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!open) return null;
  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-stretch justify-end bg-foreground/50 backdrop-blur-sm animate-fade-in">
      <div className="flex h-full w-full max-w-[min(1100px,100vw)] flex-col overflow-hidden border-l border-border bg-card shadow-elevated">
        {/* header */}
        <div className="flex items-center justify-between border-b border-border bg-muted/30 px-6 py-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Add panel</p>
            <h2 className="text-lg font-semibold text-foreground">
              {["Select scope", "Select metric", "Select visualization", "Configure"][step]}
            </h2>
          </div>
          <button onClick={close} className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* stepper */}
        <div className="flex items-center gap-2 border-b border-border px-6 py-3">
          {["Scope", "Metric", "Visualization", "Configure"].map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <div className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold ring-1",
                i < step ? "bg-success/15 text-success ring-success/30" :
                i === step ? "bg-primary text-primary-foreground ring-primary" :
                "bg-muted text-muted-foreground ring-border",
              )}>
                {i < step ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
              </div>
              <span className={cn("text-xs font-medium", i === step ? "text-foreground" : "text-muted-foreground")}>{label}</span>
              {i < 3 && <span className="mx-2 h-px w-6 bg-border" />}
            </div>
          ))}
        </div>

        {/* body */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === 0 && (
            <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Scope type</p>
                <div className="grid gap-2">
                  {SCOPE_TYPES.map((s) => {
                    const Icon = s.icon;
                    const active = scope.kind === s.kind;
                    return (
                      <button key={s.kind} onClick={() => { setScope({ kind: s.kind, ids: [] }); setSearch(""); }}
                        className={cn(
                          "flex items-start gap-3 rounded-lg border p-3 text-left transition-colors",
                          active ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50",
                        )}>
                        <Icon className={cn("mt-0.5 h-4 w-4", active ? "text-primary" : "text-muted-foreground")} />
                        <div>
                          <p className="text-sm font-medium text-foreground">{s.label}</p>
                          <p className="text-[11px] text-muted-foreground">{s.help}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="flex flex-col">
                <div className="relative mb-3">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" className="pl-9" />
                </div>
                <div className="flex-1 overflow-y-auto rounded-lg border border-border">
                  {scopeOptions.length === 0 ? (
                    <p className="p-6 text-center text-xs text-muted-foreground">No matches.</p>
                  ) : scopeOptions.map((o) => {
                    const selected = scope.ids.includes(o.id);
                    return (
                      <button key={o.id} onClick={() => setScope((s) => ({
                        ...s,
                        ids: selected ? s.ids.filter((i) => i !== o.id) : [...s.ids, o.id],
                      }))}
                        className={cn(
                          "flex w-full items-center justify-between border-b border-border px-4 py-2.5 text-left text-sm transition-colors last:border-b-0",
                          selected ? "bg-primary/5" : "hover:bg-muted/40",
                        )}>
                        <div>
                          <p className="font-medium text-foreground">{o.label}</p>
                          {o.sub && <p className="text-[11px] text-muted-foreground">{o.sub}</p>}
                        </div>
                        {selected && <CheckCircle2 className="h-4 w-4 text-primary" />}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">{scope.ids.length} selected</p>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {METRIC_LIBRARY.map((m) => {
                const active = metric === m.kind;
                return (
                  <button key={m.kind} onClick={() => setMetric(m.kind)}
                    className={cn(
                      "flex flex-col items-start gap-1 rounded-lg border p-4 text-left transition-all",
                      active ? "border-primary bg-primary/5 ring-2 ring-primary/30" : "border-border hover:border-primary/40 hover:bg-muted/40",
                    )}>
                    <p className="text-sm font-semibold text-foreground">{m.label}</p>
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{m.unit || "—"}</p>
                  </button>
                );
              })}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              {Array.from(new Set(VIZ_LIBRARY.map((v) => v.group))).map((group) => (
                <div key={group}>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{group}</p>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {VIZ_LIBRARY.filter((v) => v.group === group).map((v) => {
                      const active = viz === v.kind;
                      return (
                        <button key={v.kind} onClick={() => setViz(v.kind)}
                          className={cn(
                            "flex flex-col items-start gap-1 rounded-lg border p-4 text-left transition-all",
                            active ? "border-primary bg-primary/5 ring-2 ring-primary/30" : "border-border hover:border-primary/40 hover:bg-muted/40",
                          )}>
                          <p className="text-sm font-semibold text-foreground">{v.label}</p>
                          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{v.kind}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {step === 3 && (
            <div className="grid gap-6 md:grid-cols-2">
              <Card className="p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Time range</p>
                <div className="flex flex-wrap gap-2">
                  {TIME_RANGES.map((r) => (
                    <button key={r} onClick={() => setConfig((c) => ({ ...c, timeRange: r }))}
                      className={cn(
                        "rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors",
                        config.timeRange === r ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted",
                      )}>{r}</button>
                  ))}
                </div>
              </Card>
              <Card className="p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Refresh interval</p>
                <div className="flex flex-wrap gap-2">
                  {[10, 30, 60, 300, 0].map((s) => (
                    <button key={s} onClick={() => setConfig((c) => ({ ...c, refreshIntervalSec: s }))}
                      className={cn(
                        "rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors",
                        config.refreshIntervalSec === s ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted",
                      )}>{s === 0 ? "Off" : `${s}s`}</button>
                  ))}
                </div>
              </Card>
              <Card className="p-4 md:col-span-2">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Thresholds</p>
                <div className="space-y-2">
                  {config.thresholds.map((t, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input type="number" value={t.value} onChange={(e) => {
                        const v = Number(e.target.value);
                        setConfig((c) => ({ ...c, thresholds: c.thresholds.map((th, j) => j === i ? { ...th, value: v } : th) }));
                      }} className="w-24" />
                      <select value={t.color} onChange={(e) => {
                        const color = e.target.value as PanelThreshold["color"];
                        setConfig((c) => ({ ...c, thresholds: c.thresholds.map((th, j) => j === i ? { ...th, color } : th) }));
                      }} className="h-9 rounded-md border border-input bg-background px-2 text-xs">
                        <option value="ok">ok</option><option value="info">info</option>
                        <option value="warning">warning</option><option value="critical">critical</option>
                      </select>
                      <button onClick={() => setConfig((c) => ({ ...c, thresholds: c.thresholds.filter((_, j) => j !== i) }))}
                        className="rounded-md border border-border p-1.5 text-muted-foreground hover:bg-muted"><X className="h-3 w-3" /></button>
                    </div>
                  ))}
                  <Button size="sm" variant="outline" onClick={() => setConfig((c) => ({ ...c, thresholds: [...c.thresholds, { value: 0, color: "warning" }] }))}>
                    + Add threshold
                  </Button>
                </div>
              </Card>
              <Card className="p-4 md:col-span-2">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Advanced</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex items-center justify-between rounded-md border border-border p-3 text-sm">
                    <span>Multi-host comparison</span>
                    <input type="checkbox" checked={multiHost} onChange={(e) => setMultiHost(e.target.checked)} />
                  </label>
                  <label className="flex items-center justify-between rounded-md border border-border p-3 text-sm">
                    <span>Forecast mode</span>
                    <input type="checkbox" checked={forecast} onChange={(e) => setForecast(e.target.checked)} />
                  </label>
                  <label className="flex items-center justify-between rounded-md border border-border p-3 text-sm">
                    <span>Severity colors</span>
                    <input type="checkbox" checked={!!config.severityColors} onChange={(e) => setConfig((c) => ({ ...c, severityColors: e.target.checked }))} />
                  </label>
                </div>
              </Card>
            </div>
          )}
        </div>

        {/* footer */}
        <div className="flex items-center justify-between border-t border-border bg-muted/30 px-6 py-3">
          <Button variant="ghost" size="sm" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
          <p className="text-[11px] text-muted-foreground">Step {step + 1} of 4</p>
          {step < 3 ? (
            <Button size="sm" disabled={!canNext} onClick={() => setStep((s) => Math.min(3, s + 1))}>
              Next <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button size="sm" onClick={finish}>Add panel</Button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};
