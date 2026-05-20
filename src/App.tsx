import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { I18nProvider } from "@/contexts/I18nContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { RoleGuard } from "@/components/RoleGuard";
import { AppLayout } from "@/components/layout/AppLayout";
import Login from "./pages/Login";
import Incidents from "./pages/Incidents";
import Infrastructure from "./pages/Infrastructure";
import InfrastructureOverview from "./pages/infrastructure/Overview";
import InfraServers from "./pages/infrastructure/Servers";
import InfraServerDetail from "./pages/infrastructure/ServerDetail";
import InfraVMs from "./pages/infrastructure/VirtualMachines";
import InfraContainers from "./pages/infrastructure/Containers";
import InfraKubernetes from "./pages/infrastructure/Kubernetes";
import InfraNetworks from "./pages/infrastructure/Networks";
import InfraStorage from "./pages/infrastructure/Storage";
import InfraDatabases from "./pages/infrastructure/Databases";
import InfraLoadBalancers from "./pages/infrastructure/LoadBalancers";
import InfraCloud from "./pages/infrastructure/CloudResources";
import InfraSites from "./pages/infrastructure/Sites";
import InfraTopologyPage from "./pages/infrastructure/Topology";
import InfraCapacity from "./pages/infrastructure/Capacity";
import InfraMaintenance from "./pages/infrastructure/Maintenance";
import InfraProvisioning from "./pages/infrastructure/Provisioning";
import InfraDiscovery from "./pages/infrastructure/Discovery";
import InfraPolicies from "./pages/infrastructure/Policies";
import SLA from "./pages/SLA";
import Settings from "./pages/Settings";
import AIInsights from "./pages/AIInsights";
import IncidentChat from "./pages/IncidentChat";
import Alerts from "./pages/Alerts";
import Assets from "./pages/cmdb/Assets";
import AssetDetail from "./pages/cmdb/AssetDetail";
import Services from "./pages/cmdb/Services";
import GovernanceUsers from "./pages/governance/Users";
import GovernanceDepartments from "./pages/governance/Departments";
import GovernanceAuditLog from "./pages/governance/AuditLog";
import IntegrationCenter from "./pages/integrations/IntegrationCenter";
import Dashboards from "./pages/Dashboards";
import TerminalPage from "./pages/Terminal";
import Maps from "./pages/Maps";
import Executive from "./pages/Executive";
import ApplicationsCommand from "./pages/applications/Command";
import ApplicationsRegistry from "./pages/applications/Registry";
import ApplicationsTopology from "./pages/applications/Topology";
import ApplicationsAlerts from "./pages/applications/Alerts";
import ApplicationDetail from "./pages/applications/Detail";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <I18nProvider>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route
                  element={
                    <ProtectedRoute>
                      <AppLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route path="/" element={<Navigate to="/dashboards" replace />} />
                  <Route path="/executive" element={<Executive />} />
                  <Route path="/maps" element={<Maps />} />
                  <Route path="/dashboard" element={<Navigate to="/dashboards" replace />} />
                  <Route path="/alerts" element={<Alerts />} />
                  <Route path="/dashboards" element={<Dashboards />} />
                  <Route path="/dashboards/:mode/:id" element={<Dashboards />} />
                  <Route path="/dashboards/templates" element={<Dashboards />} />
                  <Route
                    path="/terminal"
                    element={
                      <RoleGuard allow={["super_admin", "admin", "operator"]}>
                        <TerminalPage />
                      </RoleGuard>
                    }
                  />
                  <Route path="/incidents" element={<Incidents />} />
                  <Route path="/ai" element={<AIInsights />} />
                  <Route path="/s/:eventId" element={<IncidentChat />} />
                  <Route path="/infrastructure" element={<Infrastructure />} />
                  <Route path="/sla" element={<SLA />} />
                  <Route path="/cmdb/assets" element={<Assets />} />
                  <Route path="/cmdb/assets/:id" element={<AssetDetail />} />
                  <Route path="/cmdb/services" element={<Services />} />
                  <Route path="/applications" element={<ApplicationsCommand />} />
                  <Route path="/applications/registry" element={<RoleGuard allow={["super_admin", "admin", "operator"]}><ApplicationsRegistry /></RoleGuard>} />
                  <Route path="/applications/topology" element={<ApplicationsTopology />} />
                  <Route path="/applications/alerts" element={<RoleGuard allow={["super_admin", "admin", "operator"]}><ApplicationsAlerts /></RoleGuard>} />
                  <Route path="/applications/:id" element={<ApplicationDetail />} />
                  <Route
                    path="/governance/users"
                    element={
                      <RoleGuard allow={["admin"]}>
                        <GovernanceUsers />
                      </RoleGuard>
                    }
                  />
                  <Route
                    path="/governance/departments"
                    element={
                      <RoleGuard allow={["admin"]}>
                        <GovernanceDepartments />
                      </RoleGuard>
                    }
                  />
                  <Route
                    path="/governance/audit"
                    element={
                      <RoleGuard allow={["admin", "auditor"]}>
                        <GovernanceAuditLog />
                      </RoleGuard>
                    }
                  />
                  <Route
                    path="/integrations"
                    element={
                      <RoleGuard allow={["super_admin", "admin", "auditor"]}>
                        <IntegrationCenter />
                      </RoleGuard>
                    }
                  />
                  <Route
                    path="/settings"
                    element={
                      <RoleGuard allow={["admin", "operator", "viewer", "auditor"]}>
                        <Settings />
                      </RoleGuard>
                    }
                  />
                  <Route
                    path="/settings"
                    element={
                      <RoleGuard allow={["admin", "operator", "viewer", "auditor"]}>
                        <Settings />
                      </RoleGuard>
                    }
                  />
                </Route>
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </AuthProvider>
      </I18nProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
