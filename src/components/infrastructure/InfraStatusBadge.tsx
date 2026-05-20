import { cn } from "@/lib/utils";
import type { InfraStatus } from "@/types/infrastructure";

const MAP: Record<InfraStatus, { dot: string; ring: string; text: string; bg: string; label: string }> = {
  healthy:     { dot: "bg-success",       ring: "ring-success/30",       text: "text-success",       bg: "bg-success/10",       label: "Healthy" },
  warning:     { dot: "bg-yellow-500",    ring: "ring-yellow-500/30",    text: "text-yellow-600 dark:text-yellow-400",     bg: "bg-yellow-500/10",    label: "Warning" },
  degraded:    { dot: "bg-orange-500",    ring: "ring-orange-500/30",    text: "text-orange-600 dark:text-orange-400",     bg: "bg-orange-500/10",    label: "Degraded" },
  critical:    { dot: "bg-destructive",   ring: "ring-destructive/30",   text: "text-destructive",   bg: "bg-destructive/10",   label: "Critical" },
  maintenance: { dot: "bg-blue-500",      ring: "ring-blue-500/30",      text: "text-blue-600 dark:text-blue-400",       bg: "bg-blue-500/10",      label: "Maintenance" },
  unknown:     { dot: "bg-muted-foreground", ring: "ring-border",        text: "text-muted-foreground", bg: "bg-muted/40",       label: "Unknown" },
};

interface Props {
  status: InfraStatus;
  pulse?: boolean;
  size?: "sm" | "md";
}

export function InfraStatusBadge({ status, pulse, size = "sm" }: Props) {
  const m = MAP[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 ring-1", m.bg, m.ring, m.text,
      size === "sm" ? "text-[10px] font-semibold uppercase tracking-wider" : "text-xs font-medium")}>
      <span className={cn("relative h-1.5 w-1.5 rounded-full", m.dot)}>
        {pulse && status !== "healthy" && (
          <span className={cn("absolute inset-0 animate-ping rounded-full opacity-75", m.dot)} />
        )}
      </span>
      {m.label}
    </span>
  );
}

export function ResourceBar({ value, label }: { value: number; label?: string }) {
  const color = value > 90 ? "bg-destructive" : value > 80 ? "bg-orange-500" : value > 70 ? "bg-yellow-500" : "bg-success";
  return (
    <div>
      {label && (
        <div className="mb-0.5 flex items-baseline justify-between text-[10px] text-muted-foreground">
          <span>{label}</span>
          <span className="font-mono text-foreground">{value.toFixed(0)}%</span>
        </div>
      )}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full transition-all duration-500", color)} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      </div>
    </div>
  );
}
