import { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { ChatInterface } from "@/components/ChatInterface";

const Index = () => {
  const [active, setActive] = useState("ai");
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="relative flex h-screen w-full overflow-hidden bg-background animate-fade-in">
      <Sidebar
        active={active}
        onSelect={setActive}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        <TopBar onMenuClick={() => setMobileOpen(true)} />

        <main className="flex min-h-0 flex-1 flex-col">
          <ChatInterface />
        </main>
      </div>
    </div>
  );
};

export default Index;
