import { useMemo, useRef, useState } from "react";
import type { Server, Site } from "@/types/infrastructure";

const COLOR: Record<Server["status"], string> = {
  healthy: "#10b981", warning: "#eab308", degraded: "#f97316",
  critical: "#dc2626", maintenance: "#3b82f6", unknown: "#64748b",
};

interface Props {
  servers: Server[];
  sites: Site[];
  onSelect?: (id: string) => void;
}

export function InfraTopology({ servers, sites, onSelect }: Props) {
  const ref = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<string | null>(null);

  const layout = useMemo(() => {
    const W = 920, H = 520;
    const siteRadius = Math.min(W, H) * 0.32;
    const cx = W / 2, cy = H / 2;
    const sitePos = new Map<string, { x: number; y: number }>();
    sites.forEach((s, i) => {
      const a = (i / sites.length) * Math.PI * 2 - Math.PI / 2;
      sitePos.set(s.id, { x: cx + Math.cos(a) * siteRadius, y: cy + Math.sin(a) * siteRadius });
    });
    const nodes = servers.map((srv) => {
      const sp = sitePos.get(srv.siteId) ?? { x: cx, y: cy };
      const siblings = servers.filter((x) => x.siteId === srv.siteId);
      const idx = siblings.findIndex((x) => x.id === srv.id);
      const a = (idx / Math.max(1, siblings.length)) * Math.PI * 2;
      const r = 70 + (siblings.length > 6 ? 10 : 0);
      return { srv, x: sp.x + Math.cos(a) * r, y: sp.y + Math.sin(a) * r };
    });
    return { W, H, sites: sites.map((s) => ({ ...s, ...(sitePos.get(s.id) ?? { x: cx, y: cy }) })), nodes };
  }, [servers, sites]);

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <svg ref={ref} viewBox={`0 0 ${layout.W} ${layout.H}`} className="h-[520px] w-full">
        {/* Site → server links */}
        {layout.nodes.map((n) => {
          const s = layout.sites.find((x) => x.id === n.srv.siteId);
          if (!s) return null;
          return <line key={`l-${n.srv.id}`} x1={s.x} y1={s.y} x2={n.x} y2={n.y} stroke="hsl(var(--border))" strokeWidth={1} opacity={0.5} />;
        })}
        {/* Site hubs */}
        {layout.sites.map((s) => (
          <g key={s.id}>
            <circle cx={s.x} cy={s.y} r={32} fill="hsl(var(--muted))" stroke="hsl(var(--border))" strokeWidth={1.5} />
            <text x={s.x} y={s.y + 4} textAnchor="middle" className="fill-foreground" fontSize={11} fontWeight={600}>{s.code}</text>
            <text x={s.x} y={s.y + 50} textAnchor="middle" className="fill-muted-foreground" fontSize={10}>{s.city}</text>
          </g>
        ))}
        {/* Server nodes */}
        {layout.nodes.map((n) => {
          const isHover = hover === n.srv.id;
          return (
            <g key={n.srv.id} className="cursor-pointer" onMouseEnter={() => setHover(n.srv.id)} onMouseLeave={() => setHover(null)} onClick={() => onSelect?.(n.srv.id)}>
              <circle cx={n.x} cy={n.y} r={isHover ? 12 : 9} fill={COLOR[n.srv.status]} opacity={0.92} />
              {n.srv.status !== "healthy" && (
                <circle cx={n.x} cy={n.y} r={14} fill="none" stroke={COLOR[n.srv.status]} opacity={0.35} className="animate-ping" />
              )}
              {isHover && (
                <g>
                  <rect x={n.x + 14} y={n.y - 22} rx={4} width={200} height={48} fill="hsl(var(--popover))" stroke="hsl(var(--border))" />
                  <text x={n.x + 22} y={n.y - 6} className="fill-foreground" fontSize={11} fontWeight={600}>{n.srv.hostname}</text>
                  <text x={n.x + 22} y={n.y + 10} className="fill-muted-foreground" fontSize={10}>{n.srv.ip} · {n.srv.kind} · {n.srv.status}</text>
                </g>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
