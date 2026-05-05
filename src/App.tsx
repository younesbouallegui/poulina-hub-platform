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
import Dashboard from "./pages/Dashboard";
import Incidents from "./pages/Incidents";
import Infrastructure from "./pages/Infrastructure";
import SLA from "./pages/SLA";
import Settings from "./pages/Settings";
import AIInsights from "./pages/AIInsights";
import IncidentChat from "./pages/IncidentChat";
import Executive from "./pages/Executive";
import Alerts from "./pages/Alerts";
import Executive from "./pages/Executive";
import Alerts from "./pages/Alerts";
import Assets from "./pages/cmdb/Assets";
import AssetDetail from "./pages/cmdb/AssetDetail";
import Services from "./pages/cmdb/Services";
import GovernanceUsers from "./pages/governance/Users";
import GovernanceDepartments from "./pages/governance/Departments";
import GovernanceAuditLog from "./pages/governance/AuditLog";
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
                  <Route path="/" element={<Navigate to="/executive" replace />} />
                  <Route path="/executive" element={<Executive />} />
                  <Route path="/alerts" element={<Alerts />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/incidents" element={<Incidents />} />
                  <Route path="/ai" element={<AIInsights />} />
                  <Route path="/s/:eventId" element={<IncidentChat />} />
                  <Route path="/infrastructure" element={<Infrastructure />} />
                  <Route path="/sla" element={<SLA />} />
                  <Route path="/cmdb/assets" element={<Assets />} />
                  <Route path="/cmdb/assets/:id" element={<AssetDetail />} />
                  <Route path="/cmdb/services" element={<Services />} />
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
