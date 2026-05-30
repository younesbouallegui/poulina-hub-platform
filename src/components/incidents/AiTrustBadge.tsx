import { Bot, ShieldCheck, ShieldOff, UserCheck, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RemediationPolicy } from "@/types/aiops";

const META: Record<RemediationPolicy, { label: string; cls: string; Icon: React.ComponentType<{ className?: string }> }> = {
  off: { label: "AI Off", cls: "bg-muted text-muted-foreground ring-border", Icon: ShieldOff },
  suggest: { label: "Suggest Only", cls: "bg-info/15 text-info ring-info/30", Icon: Bot },
  approval: { label: "Requires Approval", cls: "bg-warning/15 text-warning ring-warning/30", Icon: UserCheck },
  autonomous: { label: "Autonomous", cls: "bg-success/15 text-success ring-success/30", Icon: Zap },
};

export const AiTrustBadge = ({ policy }: { policy: RemediationPolicy }) => {
  const m = META[policy];
  const Icon = m.Icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1",
        m.cls,
      )}
    >
      <Icon className="h-3 w-3" />
      {m.label}
    </span>
  );
};

export const AiTrustGlyph = () => (
  <ShieldCheck className="h-3 w-3 text-success" />
);
