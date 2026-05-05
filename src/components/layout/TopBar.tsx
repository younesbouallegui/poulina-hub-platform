import {
  Bell,
  Search,
  Command,
  ChevronDown,
  Sparkles,
  Sun,
  Moon,
  Menu,
  LogOut,
  User as UserIcon,
  Globe,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/contexts/I18nContext";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface TopBarProps {
  onMenuClick: () => void;
}

export const TopBar = ({ onMenuClick }: TopBarProps) => {
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const { t, lang, setLang } = useI18n();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [time, setTime] = useState(new Date());
  const [menuOpen, setMenuOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const langRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const i = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(i);
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
      if (langRef.current && !langRef.current.contains(e.target as Node)) setLangOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const handleLogout = async () => {
    setMenuOpen(false);
    await logout();
    toast({ title: "Signed out", description: "You have been logged out securely." });
    navigate("/login", { replace: true });
  };

  const handleNotifications = () => {
    toast({ title: t("top.notifications"), description: "You have 7 unread alerts." });
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-2 border-b border-border bg-background/85 px-3 backdrop-blur-xl md:gap-4 md:px-6">
      <button
        onClick={onMenuClick}
        className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-all hover:border-primary/40 hover:text-foreground active:scale-95 md:hidden"
        aria-label="Open menu"
      >
        <Menu className="h-4 w-4" />
      </button>

      <div className="hidden items-center gap-2 text-xs text-muted-foreground lg:flex">
        <span className="relative flex h-2 w-2 items-center justify-center">
          <span className="absolute h-2 w-2 animate-ping rounded-full bg-success opacity-60" />
          <span className="relative h-2 w-2 rounded-full bg-success" />
        </span>
        <span className="font-mono uppercase tracking-wider">{t("top.allOperational")}</span>
        <span className="text-border">·</span>
        <span className="font-mono">{time.toLocaleTimeString("en-US", { hour12: false })} UTC</span>
      </div>

      <div className="ml-auto flex max-w-xl flex-1 items-center">
        <div className="group relative w-full">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
          <input
            placeholder={t("top.search")}
            className="h-10 w-full rounded-lg border border-input bg-card pl-9 pr-16 text-sm text-foreground placeholder:text-muted-foreground/70 outline-none transition-all duration-300 focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
          />
          <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
            <Sparkles className="hidden h-3.5 w-3.5 text-primary sm:block" />
            <kbd className="hidden items-center gap-1 rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:flex">
              <Command className="h-3 w-3" />K
            </kbd>
          </div>
        </div>
      </div>

      {/* Language */}
      <div className="relative" ref={langRef}>
        <button
          onClick={() => setLangOpen((o) => !o)}
          className="flex h-10 items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 text-xs font-semibold uppercase text-muted-foreground transition-all hover:border-primary/40 hover:text-foreground active:scale-95"
          aria-label={t("common.language")}
        >
          <Globe className="h-4 w-4" />
          <span className="hidden sm:inline">{lang}</span>
        </button>
        {langOpen && (
          <div className="absolute right-0 top-12 w-32 origin-top-right rounded-lg border border-border bg-popover p-1 shadow-elevated animate-fade-in">
            {(["en", "fr"] as const).map((l) => (
              <button
                key={l}
                onClick={() => {
                  setLang(l);
                  setLangOpen(false);
                }}
                className={cn(
                  "flex w-full items-center justify-between rounded-md px-3 py-2 text-xs transition-colors hover:bg-muted",
                  lang === l ? "font-semibold text-primary" : "text-foreground",
                )}
              >
                <span>{l === "en" ? "English" : "Français"}</span>
                {lang === l && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
              </button>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={toggleTheme}
        className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-all hover:border-primary/40 hover:text-foreground active:scale-95"
        aria-label={theme === "light" ? t("top.theme.dark") : t("top.theme.light")}
        title={theme === "light" ? t("top.theme.dark") : t("top.theme.light")}
      >
        {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
      </button>

      <button
        onClick={handleNotifications}
        className="relative hidden h-10 w-10 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-all hover:border-primary/40 hover:text-foreground active:scale-95 sm:flex"
        aria-label={t("top.notifications")}
      >
        <Bell className="h-4 w-4" />
        <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground ring-2 ring-background">
          7
        </span>
      </button>

      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setMenuOpen((o) => !o)}
          className="flex items-center gap-2.5 rounded-lg border border-border bg-card p-1.5 pr-2 transition-all hover:border-primary/40 active:scale-[0.98] sm:pr-3"
        >
          <div className="relative flex h-7 w-7 items-center justify-center overflow-hidden rounded-md bg-gradient-primary text-[11px] font-semibold text-primary-foreground">
            {user?.initials ?? "U"}
          </div>
          <div className="hidden text-left md:block">
            <p className="text-xs font-semibold leading-tight text-foreground">{user?.name ?? "User"}</p>
            <p className="text-[10px] capitalize leading-tight text-muted-foreground">
              {user?.role ?? ""}
            </p>
          </div>
          <ChevronDown className="hidden h-3.5 w-3.5 text-muted-foreground md:block" />
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-12 w-56 origin-top-right rounded-lg border border-border bg-popover p-1.5 shadow-elevated animate-fade-in">
            <div className="border-b border-border px-3 py-2">
              <p className="truncate text-xs font-semibold text-foreground">{user?.name}</p>
              <p className="truncate text-[11px] text-muted-foreground">{user?.email}</p>
              <p className="mt-1 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                {user?.role}
              </p>
            </div>
            <button
              onClick={() => {
                setMenuOpen(false);
                navigate("/settings");
              }}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs text-foreground transition-colors hover:bg-muted"
            >
              <UserIcon className="h-3.5 w-3.5" />
              {t("top.profile")}
            </button>
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs text-destructive transition-colors hover:bg-destructive/10"
            >
              <LogOut className="h-3.5 w-3.5" />
              {t("top.signOut")}
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
