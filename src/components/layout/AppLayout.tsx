import { ReactNode, useState } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";

interface AppLayoutProps {
  children?: ReactNode;
}

export const AppLayout = ({ children }: AppLayoutProps) => {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="relative flex h-screen w-full overflow-hidden bg-background animate-fade-in">
      <Sidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />
      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        <TopBar onMenuClick={() => setMobileOpen(true)} />
        <main className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {children ?? <Outlet />}
        </main>
      </div>
    </div>
  );
};
