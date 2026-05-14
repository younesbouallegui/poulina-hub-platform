import { useMemo, useState, useEffect } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, LayersControl, LayerGroup, Marker } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  hostCoords, severityColor, severityTier,
  useZabbixHosts, useZabbixProblems, useZabbixMaps,
  type ZHost,
} from "@/lib/zabbix";
import { Loader2, Globe2, Maximize2, Minimize2, Activity, AlertTriangle, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

// Fix default marker icon
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

type Tier = "critical" | "high" | "medium" | "low";
type Point = { host: ZHost; lat: number; lon: number; sev: number; tier: Tier; alerts: number };

const Maps = () => {
  const { data: hosts = [], isLoading } = useZabbixHosts();
  const { data: problems = [] } = useZabbixProblems();
  const { data: zMaps = [] } = useZabbixMaps();
  const [nocWall, setNocWall] = useState(false);
  const [filterTier, setFilterTier] = useState<"all" | "critical" | "high" | "medium" | "low">("all");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && nocWall) setNocWall(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [nocWall]);

  const points: Point[] = useMemo(() => {
    const sevByHost = new Map<string, { max: number; count: number }>();
    for (const p of problems) {
      const hid = p.hosts?.[0]?.hostid;
      if (!hid) continue;
      const cur = sevByHost.get(hid) ?? { max: 0, count: 0 };
      cur.max = Math.max(cur.max, parseInt(p.severity, 10) || 0);
      cur.count++;
      sevByHost.set(hid, cur);
    }
    return hosts
      .map((h) => {
        const c = hostCoords(h);
        if (!c) return null;
        const x = sevByHost.get(h.hostid) ?? { max: 0, count: 0 };
        return { host: h, lat: c.lat, lon: c.lon, sev: x.max, alerts: x.count, tier: severityTier(x.max) };
      })
      .filter((p): p is Point => Boolean(p));
  }, [hosts, problems]);

  const filtered = useMemo(
    () => filterTier === "all" ? points : points.filter((p) => p.tier === filterTier),
    [points, filterTier]
  );

  // Region heatmap zones (rough lat/lon bands)
  const regions = useMemo(() => {
    const r = { Americas: 0, EMEA: 0, APAC: 0 };
    for (const p of points) {
      if (p.lon < -30) r.Americas += p.alerts || 1;
      else if (p.lon < 60) r.EMEA += p.alerts || 1;
      else r.APAC += p.alerts || 1;
    }
    return r;
  }, [points]);

  const stats = {
    total: hosts.length,
    geolocated: points.length,
    alerting: points.filter((p) => p.alerts > 0).length,
    critical: points.filter((p) => p.tier === "critical").length,
  };

  const createClusterIcon = (cluster: { getChildCount: () => number; getAllChildMarkers: () => Array<{ options: { fillColor?: string } }> }) => {
    const count = cluster.getChildCount();
    const children = cluster.getAllChildMarkers();
    let maxSev = 0;
    for (const c of children) {
      const fc = c.options.fillColor;
      if (fc === "#dc2626") maxSev = Math.max(maxSev, 5);
      else if (fc === "#ea580c") maxSev = Math.max(maxSev, 4);
      else if (fc === "#eab308") maxSev = Math.max(maxSev, 3);
      else maxSev = Math.max(maxSev, 1);
    }
    const color = severityColor(maxSev);
    return L.divIcon({
      html: `<div style="background:${color};color:white;border-radius:50%;width:40px;height:40px;display:flex;align-items:center;justify-content:center;font-weight:600;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,.3)">${count}</div>`,
      className: "z-cluster",
      iconSize: L.point(40, 40, true),
    });
  };

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", nocWall && "fixed inset-0 z-50 bg-black")}>
      {!nocWall && (
        <PageHeader
          title="Global Operations Map"
          subtitle={`${stats.geolocated} of ${stats.total} hosts geolocated · ${stats.alerting} alerting · ${stats.critical} critical`}
          icon={Globe2}
          actions={
            <button
              onClick={() => setNocWall(true)}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
            >
              <Maximize2 className="h-3.5 w-3.5" /> NOC Wall
            </button>
          }
        />
      )}

      <div className={cn("relative flex-1", nocWall ? "p-0" : "p-4")}>
        {isLoading ? (
          <div className="flex h-[60vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <div className={cn("relative overflow-hidden border border-border", nocWall ? "h-screen" : "h-[calc(100vh-12rem)] rounded-xl")}>
            {/* Floating top-left HUD */}
            <div className="absolute left-3 top-3 z-[1000] flex flex-col gap-2">
              <div className="rounded-lg border border-border bg-card/95 p-3 shadow-lg backdrop-blur">
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                  <Stat icon={MapPin} label="Hosts" value={stats.geolocated} />
                  <Stat icon={Activity} label="Alerting" value={stats.alerting} accent="warning" />
                  <Stat icon={AlertTriangle} label="Critical" value={stats.critical} accent="destructive" />
                  <Stat icon={Globe2} label="Maps" value={zMaps.length} />
                </div>
                <div className="mt-3 border-t border-border/60 pt-2">
                  <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Region heat</p>
                  {Object.entries(regions).map(([r, v]) => {
                    const max = Math.max(1, ...Object.values(regions));
                    return (
                      <div key={r} className="mb-1 last:mb-0">
                        <div className="flex justify-between text-[10px]">
                          <span>{r}</span><span className="font-mono">{v}</span>
                        </div>
                        <div className="h-1 overflow-hidden rounded-full bg-muted">
                          <div className="h-full bg-destructive" style={{ width: `${(v / max) * 100}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Severity filter */}
              <div className="rounded-lg border border-border bg-card/95 p-2 shadow-lg backdrop-blur">
                <p className="mb-1.5 px-1 text-[10px] uppercase tracking-wider text-muted-foreground">Filter</p>
                <div className="flex flex-col gap-1">
                  {(["all", "critical", "high", "medium", "low"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setFilterTier(t)}
                      className={cn(
                        "rounded px-2 py-1 text-left text-[11px] capitalize transition-colors",
                        filterTier === t ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                      )}
                    >
                      {t === "all" ? `All (${points.length})` : `${t} (${points.filter((p) => p.tier === t).length})`}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {nocWall && (
              <button
                onClick={() => setNocWall(false)}
                className="absolute right-3 top-3 z-[1000] rounded-md bg-card/95 p-2 shadow-lg backdrop-blur hover:bg-muted"
                title="Exit NOC Wall (Esc)"
              >
                <Minimize2 className="h-4 w-4" />
              </button>
            )}

            <MapContainer center={[20, 0]} zoom={2} scrollWheelZoom worldCopyJump style={{ height: "100%", width: "100%", background: nocWall ? "#000" : undefined }}>
              <LayersControl position="topright">
                <LayersControl.BaseLayer checked={!nocWall} name="Streets">
                  <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                </LayersControl.BaseLayer>
                <LayersControl.BaseLayer checked={nocWall} name="Dark">
                  <TileLayer attribution='&copy; CARTO' url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
                </LayersControl.BaseLayer>
                <LayersControl.BaseLayer name="Satellite">
                  <TileLayer attribution='Tiles &copy; Esri' url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />
                </LayersControl.BaseLayer>

                {/* Severity overlay (blast radius) */}
                <LayersControl.Overlay checked name="Blast radius">
                  <LayerGroup>
                    {filtered.filter((p) => p.alerts > 0).map((p) => (
                      <CircleMarker
                        key={`blast-${p.host.hostid}`}
                        center={[p.lat, p.lon]}
                        radius={20 + p.alerts * 4}
                        pathOptions={{ color: severityColor(p.sev), fillColor: severityColor(p.sev), fillOpacity: 0.12, weight: 0 }}
                        interactive={false}
                      />
                    ))}
                  </LayerGroup>
                </LayersControl.Overlay>

                {/* Clustered host markers */}
                <LayersControl.Overlay checked name="Hosts">
                  <MarkerClusterGroup chunkedLoading iconCreateFunction={createClusterIcon} maxClusterRadius={50}>
                    {filtered.map((p) => (
                      <Marker
                        key={p.host.hostid}
                        position={[p.lat, p.lon]}
                        icon={L.divIcon({
                          html: `<div style="background:${severityColor(p.sev)};width:14px;height:14px;border-radius:50%;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`,
                          className: "z-host",
                          iconSize: [14, 14],
                          iconAnchor: [7, 7],
                        })}
                        // @ts-expect-error pass-through option
                        fillColor={severityColor(p.sev)}
                      >
                        <Popup>
                          <div className="space-y-1 text-xs">
                            <p className="font-semibold">{p.host.name}</p>
                            <p className="text-muted-foreground">{p.host.host}</p>
                            <p>Status: <span className="font-semibold">{p.host.available === "1" ? "Online" : p.host.available === "2" ? "Offline" : "Unknown"}</span></p>
                            <p>Severity: <span className="font-semibold capitalize">{p.tier}</span></p>
                            <p>Active alerts: <span className="font-semibold">{p.alerts}</span></p>
                            <p className="font-mono text-muted-foreground">{p.lat.toFixed(2)}, {p.lon.toFixed(2)}</p>
                            <a href={`/cmdb/assets/${p.host.hostid}`} className="mt-1 block text-primary hover:underline">Open asset →</a>
                          </div>
                        </Popup>
                      </Marker>
                    ))}
                  </MarkerClusterGroup>
                </LayersControl.Overlay>

                {/* Static markers (uncluster, raw) — for incident overlay */}
                <LayersControl.Overlay name="Critical only (uncluster)">
                  <LayerGroup>
                    {filtered.filter((p) => p.tier === "critical").map((p) => (
                      <CircleMarker
                        key={`crit-${p.host.hostid}`}
                        center={[p.lat, p.lon]}
                        radius={10}
                        pathOptions={{ color: "#dc2626", fillColor: "#dc2626", fillOpacity: 0.9, weight: 2 }}
                      >
                        <Popup>
                          <div className="space-y-1 text-xs">
                            <p className="font-semibold text-destructive">{p.host.name}</p>
                            <p>{p.alerts} active alerts</p>
                          </div>
                        </Popup>
                      </CircleMarker>
                    ))}
                  </LayerGroup>
                </LayersControl.Overlay>
              </LayersControl>
            </MapContainer>
          </div>
        )}
      </div>
    </div>
  );
};

const Stat = ({ icon: Icon, label, value, accent }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number; accent?: "warning" | "destructive" }) => (
  <div className="flex items-center gap-1.5">
    <Icon className={cn("h-3 w-3", accent === "destructive" ? "text-destructive" : accent === "warning" ? "text-warning" : "text-muted-foreground")} />
    <span className="text-muted-foreground">{label}</span>
    <span className="ml-auto font-mono font-semibold tabular-nums">{value}</span>
  </div>
);

export default Maps;
