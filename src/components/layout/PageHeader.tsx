import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
}

export const PageHeader = ({ title, subtitle, actions, className }: PageHeaderProps) => (
  <div
    className={cn(
      "flex flex-col gap-3 border-b border-border px-4 py-5 sm:flex-row sm:items-end sm:justify-between sm:px-6 sm:py-6",
      className,
    )}
  >
    <div className="min-w-0">
      <h1 className="truncate text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
        {title}
      </h1>
      {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </div>
);
