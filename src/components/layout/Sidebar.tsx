import { useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  AlertTriangle,
  Sparkles,
  Server,
  GaugeCircle,
  Settings,
  ChevronLeft,
  ChevronDown,
  ShieldCheck,
  X,
  Lock,
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
  BookOpen,
  History,
  Bot,
  Activity,
  Container,
  HardDrive,
  Database,
  Scale,
  Cloud,
  Building,
  GitBranch,
  TrendingUp,
  Wrench,
  Workflow,
  Radar,
  ShieldHalf,
  MonitorCog,
  Cpu,
} from "lucide-react";

import logo from "@/assets/logo.png";
import { cn } from "@/lib/utils";
import { useI18n } from "@/contexts/I18nContext";
import { useAuth, Role } from "@/contexts/AuthContext";
import { getIncidentsForUser } from "@/data/mockData";

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: () => string | number | undefined;
  allow: Role[];
}

interface NavSection {
  id: string;
  title: string;
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

  const sections: NavSection[] = useMemo(() => [
    {
      id: "overview",
      title: "Overview",
      items: [
        { to: "/executive", label: "Executive Command Center", icon: Globe2, allow: ["super_admin", "admin", "operator", "viewer", "auditor"] },
        { to: "/dashboards", label: t("nav.dashboards"), icon: Grid3x3, allow: ["super_admin", "admin", "operator", "viewer", "auditor"] },
        { to: "/maps", label: "Global Map", icon: MapIcon, allow: ["super_admin", "admin", "operator", "viewer", "auditor"] },
        { to: "/ai", label: "AI Insights", icon: Sparkles, allow: ["super_admin", "admin", "operator", "viewer", "auditor"] },
      ],
    },
    {
      id: "operations",
      title: "Operations",
      items: [
        { to: "/alerts", label: "Alert Hub", icon: Bell, allow: ["super_admin", "admin", "operator", "viewer", "auditor"], badge: () => (openAlertsCount > 0 ? openAlertsCount : undefined) },
        { to: "/incidents", label: t("nav.incidents"), icon: AlertTriangle, allow: ["super_admin", "admin", "operator", "viewer", "auditor"] },
        { to: "/sla", label: "SLA & Reports", icon: GaugeCircle, allow: ["super_admin", "admin", "operator", "viewer", "auditor"] },
        { to: "/terminal", label: t("nav.terminal"), icon: TerminalSquare, allow: ["super_admin", "admin", "operator"] },
      ],
    },
    {
      id: "infrastructure",
      title: "Infrastructure",
      items: [
        { to: "/infrastructure", label: "Overview", icon: MonitorCog, allow: ["super_admin", "admin", "operator", "viewer", "auditor"] },
        { to: "/infrastructure/servers", label: "Servers", icon: Server, allow: ["super_admin", "admin", "operator", "viewer", "auditor"] },
        { to: "/infrastructure/vms", label: "Virtual Machines", icon: Cpu, allow: ["super_admin", "admin", "operator", "viewer", "auditor"] },
        { to: "/infrastructure/containers", label: "Containers", icon: Container, allow: ["super_admin", "admin", "operator", "viewer", "auditor"] },
        { to: "/infrastructure/kubernetes", label: "Kubernetes", icon: Boxes, allow: ["super_admin", "admin", "operator", "viewer", "auditor"] },
        { to: "/infrastructure/networks", label: "Networks", icon: Network, allow: ["super_admin", "admin", "operator", "viewer", "auditor"] },
        { to: "/infrastructure/storage", label: "Storage", icon: HardDrive, allow: ["super_admin", "admin", "operator", "viewer", "auditor"] },
        { to: "/infrastructure/databases", label: "Databases", icon: Database, allow: ["super_admin", "admin", "operator", "viewer", "auditor"] },
        { to: "/infrastructure/load-balancers", label: "Load Balancers", icon: Scale, allow: ["super_admin", "admin", "operator", "viewer", "auditor"] },
        { to: "/infrastructure/cloud", label: "Cloud Resources", icon: Cloud, allow: ["super_admin", "admin", "operator", "viewer", "auditor"] },
        { to: "/infrastructure/sites", label: "Sites & Regions", icon: Building, allow: ["super_admin", "admin", "operator", "viewer", "auditor"] },
        { to: "/infrastructure/topology", label: "Topology", icon: GitBranch, allow: ["super_admin", "admin", "operator", "viewer", "auditor"] },
        { to: "/infrastructure/capacity", label: "Capacity Planning", icon: TrendingUp, allow: ["super_admin", "admin", "operator", "viewer", "auditor"] },
        { to: "/infrastructure/maintenance", label: "Maintenance", icon: Wrench, allow: ["super_admin", "admin", "operator", "viewer", "auditor"] },
        { to: "/infrastructure/provisioning", label: "Provisioning", icon: Workflow, allow: ["super_admin", "admin", "operator"] },
        { to: "/infrastructure/discovery", label: "Discovery", icon: Radar, allow: ["super_admin", "admin", "operator"] },
        { to: "/infrastructure/policies", label: "Infra Policies", icon: ShieldHalf, allow: ["super_admin", "admin", "auditor"] },
      ],
    },

    {
      id: "cmdb",
      title: "CMDB",
      items: [
        { to: "/cmdb/assets", label: "Asset Registry", icon: Boxes, allow: ["super_admin", "admin", "operator", "viewer", "auditor"] },
        { to: "/cmdb/services", label: "Business Services", icon: Layers, allow: ["super_admin", "admin", "operator", "viewer", "auditor"] },
        { to: "/applications", label: "Applications", icon: AppWindow, allow: ["super_admin", "admin", "operator", "viewer", "auditor"] },
      ],
    },
    {
      id: "aiops",
      title: "AI Operations",
      items: [
        { to: "/ai", label: "AI Insights", icon: Sparkles, allow: ["super_admin", "admin", "operator", "viewer", "auditor"] },
        { to: "/aiops/policies", label: "AI Policies", icon: Bot, allow: ["super_admin", "admin", "operator", "viewer", "auditor"] },
        { to: "/aiops/knowledge", label: "Knowledge Base", icon: BookOpen, allow: ["super_admin", "admin", "operator", "viewer", "auditor"] },
        { to: "/aiops/history", label: "Automation History", icon: History, allow: ["super_admin", "admin", "operator", "viewer", "auditor"] },
      ],
    },
    {
      id: "governance",
      title: "Governance",
      items: [
        { to: "/governance/users", label: "Users & Roles", icon: UsersIcon, allow: ["super_admin", "admin"] },
        { to: "/governance/departments", label: "Departments", icon: Building2, allow: ["super_admin", "admin"] },
        { to: "/governance/audit", label: "Audit Logs", icon: ScrollText, allow: ["super_admin", "admin", "auditor"] },
      ],
    },
    {
      id: "platform",
      title: "Settings",
      items: [
        { to: "/integrations", label: t("nav.integrations"), icon: Plug, allow: ["super_admin", "admin", "auditor"] },
        { to: "/settings", label: "System Settings", icon: Settings, allow: ["super_admin", "admin", "operator", "viewer", "auditor"] },
      ],
    },
  ], [t, openAlertsCount]);

  const visibleSections = sections
    .map((s) => ({
      ...s,
      items: s.items.filter((it) => !user || it.allow.some((r) => user.roles?.includes(r) ?? user.role === r)),
    }))
    .filter((s) => s.items.length > 0);

  const isActiveRoute = (to: string) =>
    location.pathname === to || (to !== "/" && location.pathname.startsWith(to));

  // Section auto-expand based on active route
  const activeSectionId = useMemo(() => {
    for (const s of visibleSections) {
      if (s.items.some((i) => isActiveRoute(i.to))) return s.id;
    }
    return visibleSections[0]?.id;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, visibleSections]);

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const isOpen = (id: string) => expanded[id] ?? id === activeSectionId;
  const toggle = (id: string) =>
    setExpanded((prev) => ({ ...prev, [id]: !isOpen(id) }));

  const handleSelect = (to: string) => {
    navigate(to);
    onMobileClose();
  };

  const content = (isMobile: boolean) => (
    <>
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

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {visibleSections.map((section) => {
          const open = isOpen(section.id);
          const showLabels = !collapsed || isMobile;
          return (
            <div key={section.id} className="rounded-lg">
              {showLabels ? (
                <button
                  onClick={() => toggle(section.id)}
                  className="flex w-full items-center justify-between rounded-md px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:bg-sidebar-accent/50 hover:text-foreground"
                  aria-expanded={open}
                >
                  <span>{section.title}</span>
                  <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open ? "rotate-0" : "-rotate-90")} />
                </button>
              ) : (
                <div className="my-2 h-px bg-sidebar-border/50" />
              )}
              {(open || !showLabels) && (
                <div className="mt-0.5 space-y-0.5">
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
                        title={!showLabels ? item.label : undefined}
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
                        {showLabels && (
                          <>
                            <span className="flex-1 truncate text-left">{item.label}</span>
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
              )}
            </div>
          );
        })}
      </nav>

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
