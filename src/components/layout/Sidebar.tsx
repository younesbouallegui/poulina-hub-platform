import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  AlertTriangle,
  Sparkles,
  Server,
  GaugeCircle,
  Settings,
  ChevronLeft,
  ShieldCheck,
  X,
  Lock,
  LineChart,
  Bell,
  Boxes,
  Layers,
  Users as UsersIcon,
  Building2,
  ScrollText,
  Plug,
  Grid3x3,
  TerminalSquare,
  Globe2,
  Map as MapIcon,
  AppWindow,
  Network,
  ClipboardList,
  Siren,
} from "lucide-react";
import logo from "@/assets/logo.png";
import { cn } from "@/lib/utils";
import { useI18n } from "@/contexts/I18nContext";
import { useAuth, Role } from "@/contexts/AuthContext";
import { getIncidentsForUser } from "@/data/mockData";

interface NavItem {
  to: string;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: () => string | number | undefined;
  allow: Role[];
  adminBadge?: boolean;
}

interface NavSection {
  titleKey: string;
  items: NavItem[];
}

interface SidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export const Sidebar = ({ mobileOpen, onMobileClose }: SidebarProps) => {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useI18n();
  const { user, hasRole } = useAuth();

  const openAlertsCount = user
    ? getIncidentsForUser(user.assignedServers ?? []).filter((i) => i.status !== "resolved").length
    : 0;

  const sections: NavSection[] = [
    {
      titleKey: "nav.section.overview",
      items: [
        { to: "/executive", labelKey: "nav.executive", icon: Globe2, allow: ["super_admin", "admin", "operator", "viewer", "auditor"] },
        { to: "/dashboards", labelKey: "nav.dashboards", icon: Grid3x3, allow: ["super_admin", "admin", "operator", "viewer", "auditor"] },
        { to: "/maps", labelKey: "nav.maps", icon: MapIcon, allow: ["super_admin", "admin", "operator", "viewer", "auditor"] },
        { to: "/ai", labelKey: "nav.ai", icon: Sparkles, allow: ["super_admin", "admin", "operator", "viewer", "auditor"] },
      ],
    },
    {
      titleKey: "nav.section.operations",
      items: [
        { to: "/alerts", labelKey: "nav.alerts", icon: Bell, allow: ["super_admin", "admin", "operator", "viewer", "auditor"], badge: () => (openAlertsCount > 0 ? openAlertsCount : undefined) },
        { to: "/incidents", labelKey: "nav.incidents", icon: AlertTriangle, allow: ["super_admin", "admin", "operator", "viewer", "auditor"] },
        { to: "/sla", labelKey: "nav.sla", icon: GaugeCircle, allow: ["super_admin", "admin", "operator", "viewer", "auditor"] },
        { to: "/terminal", labelKey: "nav.terminal", icon: TerminalSquare, allow: ["super_admin", "admin", "operator"] },
      ],
    },
    {
      titleKey: "nav.section.infrastructure",
      items: [
        { to: "/infrastructure", labelKey: "nav.infra.overview", icon: Server, allow: ["super_admin", "admin", "operator", "viewer", "auditor"] },
        { to: "/infrastructure/servers", labelKey: "nav.infra.servers", icon: Server, allow: ["super_admin", "admin", "operator", "viewer", "auditor"] },
        { to: "/infrastructure/vms", labelKey: "nav.infra.vms", icon: Boxes, allow: ["super_admin", "admin", "operator", "viewer", "auditor"] },
        { to: "/infrastructure/containers", labelKey: "nav.infra.containers", icon: Boxes, allow: ["super_admin", "admin", "operator", "viewer", "auditor"] },
        { to: "/infrastructure/kubernetes", labelKey: "nav.infra.k8s", icon: Layers, allow: ["super_admin", "admin", "operator", "viewer", "auditor"] },
        { to: "/infrastructure/networks", labelKey: "nav.infra.networks", icon: MapIcon, allow: ["super_admin", "admin", "operator", "viewer", "auditor"] },
        { to: "/infrastructure/storage", labelKey: "nav.infra.storage", icon: Boxes, allow: ["super_admin", "admin", "operator", "viewer", "auditor"] },
        { to: "/infrastructure/databases", labelKey: "nav.infra.databases", icon: Boxes, allow: ["super_admin", "admin", "operator", "viewer", "auditor"] },
        { to: "/infrastructure/load-balancers", labelKey: "nav.infra.lbs", icon: MapIcon, allow: ["super_admin", "admin", "operator", "viewer", "auditor"] },
        { to: "/infrastructure/cloud", labelKey: "nav.infra.cloud", icon: Globe2, allow: ["super_admin", "admin", "operator", "viewer", "auditor"] },
        { to: "/infrastructure/sites", labelKey: "nav.infra.sites", icon: Building2, allow: ["super_admin", "admin", "operator", "viewer", "auditor"] },
        { to: "/infrastructure/topology", labelKey: "nav.infra.topology", icon: Network, allow: ["super_admin", "admin", "operator", "viewer", "auditor"] },
        { to: "/infrastructure/capacity", labelKey: "nav.infra.capacity", icon: GaugeCircle, allow: ["super_admin", "admin", "operator", "viewer", "auditor"] },
        { to: "/infrastructure/maintenance", labelKey: "nav.infra.maintenance", icon: ScrollText, allow: ["super_admin", "admin", "operator", "viewer", "auditor"] },
        { to: "/infrastructure/provisioning", labelKey: "nav.infra.provisioning", icon: Plug, allow: ["super_admin", "admin", "operator"] },
        { to: "/infrastructure/discovery", labelKey: "nav.infra.discovery", icon: ClipboardList, allow: ["super_admin", "admin", "operator"] },
        { to: "/infrastructure/policies", labelKey: "nav.infra.policies", icon: ShieldCheck, allow: ["super_admin", "admin", "auditor"] },
      ],
    },
    {
      titleKey: "nav.section.cmdb",
      items: [
        { to: "/cmdb/assets", labelKey: "nav.cmdb.assets", icon: Boxes, allow: ["super_admin", "admin", "operator", "viewer", "auditor"] },
        { to: "/cmdb/services", labelKey: "nav.cmdb.services", icon: Layers, allow: ["super_admin", "admin", "operator", "viewer", "auditor"] },
      ],
    },
    {
      titleKey: "nav.section.applications",
      items: [
        { to: "/applications", labelKey: "nav.apps.command", icon: AppWindow, allow: ["super_admin", "admin", "operator", "viewer", "auditor"] },
        { to: "/applications/registry", labelKey: "nav.apps.registry", icon: ClipboardList, allow: ["super_admin", "admin", "operator"] },
        { to: "/applications/topology", labelKey: "nav.apps.topology", icon: Network, allow: ["super_admin", "admin", "operator", "viewer", "auditor"] },
        { to: "/applications/alerts", labelKey: "nav.apps.alerts", icon: Siren, allow: ["super_admin", "admin", "operator"] },
      ],
    },
    {
      titleKey: "nav.section.governance",
      items: [
        { to: "/governance/users", labelKey: "nav.gov.users", icon: UsersIcon, allow: ["super_admin", "admin"] },
        { to: "/governance/departments", labelKey: "nav.gov.dept", icon: Building2, allow: ["super_admin", "admin"] },
        { to: "/governance/audit", labelKey: "nav.gov.audit", icon: ScrollText, allow: ["super_admin", "admin", "auditor"] },
      ],
    },
    {
      titleKey: "nav.section.platform",
      items: [
        { to: "/integrations", labelKey: "nav.integrations", icon: Plug, allow: ["super_admin", "admin", "auditor"] },
        { to: "/settings", labelKey: "nav.settings", icon: Settings, allow: ["super_admin", "admin", "operator", "viewer", "auditor"] },
      ],
    },
  ];

  const visibleSections = sections
    .map((s) => ({
      ...s,
      items: s.items.filter((it) => !user || it.allow.some((r) => user.roles?.includes(r) ?? user.role === r)),
    }))
    .filter((s) => s.items.length > 0);

  const handleSelect = (to: string) => {
    navigate(to);
    onMobileClose();
  };

  const isActiveRoute = (to: string) =>
    location.pathname === to || (to !== "/" && location.pathname.startsWith(to));

  const content = (isMobile: boolean) => (
    <>
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-4">
        <div className="relative">
          <img src={logo} alt="Poulina AI Hub logo" className="h-9 w-9 rounded-md object-contain" />
          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-success ring-2 ring-sidebar" />
        </div>
        {(!collapsed || isMobile) && (
          <div className="min-w-0 flex-1 animate-fade-in">
            <p className="truncate text-sm font-semibold tracking-tight text-sidebar-accent-foreground">
              Poulina AI Hub
            </p>
            <p className="truncate text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Corporate Operational OS
            </p>
          </div>
        )}
        {isMobile && (
          <button
            onClick={onMobileClose}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-3 overflow-y-auto p-3">
        {visibleSections.map((section) => (
          <div key={section.titleKey}>
            {(!collapsed || isMobile) && (
              <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {t(section.titleKey)}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = isActiveRoute(item.to);
                const badgeValue = item.badge?.();
                const adminOnly = item.allow.length === 1 && item.allow[0] === "admin";
                return (
                  <button
                    key={item.to}
                    onClick={() => handleSelect(item.to)}
                    className={cn(
                      "group relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                      "hover:bg-sidebar-accent",
                      isActive
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground",
                    )}
                    title={collapsed && !isMobile ? t(item.labelKey) : undefined}
                  >
                    {isActive && (
                      <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-r-full bg-primary" />
                    )}
                    <Icon
                      className={cn(
                        "h-[18px] w-[18px] shrink-0 transition-colors",
                        isActive
                          ? "text-primary"
                          : "text-sidebar-foreground group-hover:text-sidebar-accent-foreground",
                      )}
                    />
                    {(!collapsed || isMobile) && (
                      <>
                        <span className="flex-1 truncate text-left">{t(item.labelKey)}</span>
                        {badgeValue !== undefined && (
                          <span className="rounded-full bg-destructive/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-destructive ring-1 ring-destructive/30">
                            {badgeValue}
                          </span>
                        )}
                        {adminOnly && !hasRole("admin") && (
                          <Lock className="h-3 w-3 text-muted-foreground" aria-label={t("nav.adminOnly")} />
                        )}
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-sidebar-border p-3">
        <div
          className={cn(
            "flex items-center gap-3 rounded-lg border border-success/20 bg-success/5 p-3",
            collapsed && !isMobile && "justify-center p-2",
          )}
        >
          <ShieldCheck className="h-5 w-5 shrink-0 text-success" />
          {(!collapsed || isMobile) && (
            <div className="min-w-0 animate-fade-in">
              <p className="truncate text-xs font-semibold capitalize text-foreground">
                {user?.role ?? "—"}
              </p>
              <p className="truncate text-[10px] text-muted-foreground">
                {user?.roles?.length ?? 0} role{(user?.roles?.length ?? 0) === 1 ? "" : "s"} · audited
              </p>
            </div>
          )}
        </div>

        {!isMobile && (
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="mt-3 flex w-full items-center justify-center rounded-lg border border-sidebar-border py-1.5 text-muted-foreground transition-all hover:border-primary/40 hover:text-primary active:scale-95"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <ChevronLeft className={cn("h-4 w-4 transition-transform duration-300", collapsed && "rotate-180")} />
          </button>
        )}
      </div>
    </>
  );

  return (
    <>
      <aside
        className={cn(
          "relative z-20 hidden shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-300 ease-out md:flex",
          collapsed ? "w-[76px]" : "w-[260px]",
        )}
      >
        {content(false)}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-foreground/40 backdrop-blur-sm animate-fade-in"
            onClick={onMobileClose}
            aria-hidden
          />
          <aside className="absolute inset-y-0 left-0 flex w-[280px] flex-col border-r border-sidebar-border bg-sidebar shadow-elevated animate-slide-in-right [animation-duration:300ms]">
            {content(true)}
          </aside>
        </div>
      )}
    </>
  );
};
