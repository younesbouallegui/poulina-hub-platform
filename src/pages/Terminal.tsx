import { useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, X, TerminalSquare, Server } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface Tab {
  id: string;
  hostLabel: string;
  hostId?: string;
  hostname?: string;
  ip?: string;
  os?: string;
  user?: string;
  lines: string[];
}

interface AssetOption {
  id: string;
  name: string;
  hostname: string | null;
  ip_address: string | null;
  os: string | null;
}

const newTab = (): Tab => ({
  id: crypto.randomUUID(),
  hostLabel: "local",
  lines: [
    "Poulina AI Hub Terminal v1.0",
    "Type `connect <asset>` to open SSH session, or `help` for commands.",
  ],
});

const Terminal = () => {
  const [tabs, setTabs] = useState<Tab[]>([newTab()]);
  const [active, setActive] = useState(0);
  const [input, setInput] = useState("");
  const [assets, setAssets] = useState<AssetOption[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (supabase as any)
      .from("assets")
      .select("id,name,hostname,ip_address,os")
      .limit(100)
      .then(({ data }) => data && setAssets(data as AssetOption[]));
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [tabs, active]);

  const tab = tabs[active];
  const updateTab = (patch: Partial<Tab>) =>
    setTabs((t) => t.map((x, i) => (i === active ? { ...x, ...patch } : x)));
  const append = (...lines: string[]) =>
    setTabs((t) => t.map((x, i) => (i === active ? { ...x, lines: [...x.lines, ...lines] } : x)));

  const connect = (asset: AssetOption) => {
    updateTab({
      hostLabel: asset.name,
      hostId: asset.id,
      hostname: asset.hostname ?? asset.name,
      ip: asset.ip_address ?? "",
      os: asset.os ?? "linux",
      user: "ops",
    });
    append(
      `[ssh] Connecting to ${asset.hostname ?? asset.name} (${asset.ip_address ?? "n/a"})…`,
      `[ssh] Authenticating via enterprise key…`,
      `[ssh] Connected. OS: ${asset.os ?? "Linux"} · Host: ${asset.hostname ?? asset.name}`,
      `ops@${asset.hostname ?? asset.name}:~$ `,
    );
  };

  const run = (cmd: string) => {
    if (!cmd.trim()) return;
    setHistory((h) => [...h, cmd]);
    append(`${prompt(tab)}${cmd}`);
    const [head, ...rest] = cmd.trim().split(/\s+/);
    if (head === "help") {
      append("Commands: connect <asset|name>, disconnect, hostname, whoami, uname, ls, ps, clear, exit");
    } else if (head === "connect") {
      const q = rest.join(" ").toLowerCase();
      const a = assets.find((x) => x.name.toLowerCase() === q || x.hostname?.toLowerCase() === q);
      if (!a) append(`No asset matches "${q}". Try one of: ${assets.slice(0, 5).map((a) => a.name).join(", ")}`);
      else connect(a);
    } else if (head === "disconnect" || head === "exit") {
      updateTab({ hostLabel: "local", hostId: undefined, hostname: undefined, user: undefined, ip: undefined, os: undefined });
      append("[ssh] Disconnected.");
    } else if (head === "clear") {
      updateTab({ lines: [] });
    } else if (head === "hostname") {
      append(tab.hostname ?? "local");
    } else if (head === "whoami") {
      append(tab.user ?? "guest");
    } else if (head === "uname") {
      append(tab.os ?? "Poulina-Hub");
    } else if (head === "ls") {
      append("etc  home  opt  srv  var  tmp  usr");
    } else if (head === "ps") {
      append("PID  CMD\n  1  systemd\n 412  sshd\n 902  nginx\n1240  node");
    } else {
      append(`bash: ${head}: command not found`);
    }
    append(prompt(tab));
  };

  const prompt = (t: Tab) =>
    t.user && t.hostname ? `${t.user}@${t.hostname}:~$ ` : `guest@local:~$ `;

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader
        title="Terminal"
        subtitle="Integrated enterprise shell · multi-tab · CMDB-aware"
        actions={
          <Button size="sm" onClick={() => { setTabs((t) => [...t, newTab()]); setActive(tabs.length); }}>
            <Plus className="mr-2 h-4 w-4" /> New tab
          </Button>
        }
      />
      <div className="flex flex-1 gap-4 p-4">
        <Card className="h-fit w-56 shrink-0 p-3">
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <Server className="h-3.5 w-3.5" /> Saved hosts
          </p>
          <div className="grid max-h-[60vh] gap-1 overflow-auto">
            {assets.length === 0 && <p className="text-xs text-muted-foreground">No assets in CMDB.</p>}
            {assets.map((a) => (
              <button
                key={a.id}
                onClick={() => connect(a)}
                className="rounded-md border border-border px-2 py-1.5 text-left text-xs hover:bg-muted"
              >
                <div className="font-medium text-foreground">{a.name}</div>
                <div className="truncate text-[10px] text-muted-foreground">
                  {a.hostname ?? "—"} · {a.ip_address ?? "no ip"}
                </div>
              </button>
            ))}
          </div>
        </Card>
        <Card className="flex flex-1 flex-col overflow-hidden">
          <div className="flex items-center gap-1 border-b border-border bg-muted/40 px-2 py-1">
            {tabs.map((t, i) => (
              <div
                key={t.id}
                onClick={() => setActive(i)}
                className={cn(
                  "flex cursor-pointer items-center gap-1.5 rounded-t-md border-b-2 px-3 py-1.5 text-xs",
                  i === active
                    ? "border-primary bg-background text-foreground"
                    : "border-transparent text-muted-foreground hover:bg-background/50",
                )}
              >
                <TerminalSquare className="h-3.5 w-3.5" />
                {t.hostLabel}
                <X
                  className="h-3 w-3 hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    setTabs((all) => all.filter((_, j) => j !== i));
                    setActive((a) => Math.max(0, Math.min(a, tabs.length - 2)));
                  }}
                />
              </div>
            ))}
          </div>
          <div
            ref={scrollRef}
            className="flex-1 overflow-auto bg-[#0b0f17] p-3 font-mono text-[12.5px] leading-relaxed text-emerald-300"
          >
            {tab.lines.map((l, i) => (
              <pre key={i} className="whitespace-pre-wrap">{l}</pre>
            ))}
          </div>
          <form
            onSubmit={(e) => { e.preventDefault(); run(input); setInput(""); }}
            className="flex items-center gap-2 border-t border-border bg-[#0b0f17] px-3 py-2 font-mono text-sm text-emerald-300"
          >
            <span className="shrink-0">{prompt(tab)}</span>
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              autoFocus
              className="h-7 border-0 bg-transparent p-0 font-mono text-emerald-200 focus-visible:ring-0"
              placeholder="type a command…"
            />
          </form>
        </Card>
      </div>
    </div>
  );
};

export default Terminal;
