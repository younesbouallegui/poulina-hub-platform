import { useState } from "react";
import { Bell, KeyRound, Palette, Settings as SettingsIcon, ShieldAlert, User } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n, Lang } from "@/contexts/I18nContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const Settings = () => {
  const { user, hasRole } = useAuth();
  const { t, lang, setLang } = useI18n();
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();

  const [emailAlerts, setEmailAlerts] = useState(true);
  const [slackAlerts, setSlackAlerts] = useState(true);
  const [smsAlerts, setSmsAlerts] = useState(false);
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");

  const isAdmin = hasRole("admin");

  const onSave = () => {
    toast({ title: t("settings.saved") });
  };

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader title={t("settings.title")} subtitle={t("settings.subtitle")} />

      <div className="flex-1 space-y-6 p-4 sm:p-6">
        {/* Profile */}
        <Section icon={User} title={t("settings.profile")}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Name" value={user?.name ?? ""} readOnly />
            <Field label="Email" value={user?.email ?? ""} readOnly />
            <Field label={t("common.role")} value={user?.role ?? ""} readOnly />
            <div>
              <label className="mb-1.5 block text-xs font-medium text-foreground">
                {t("common.language")}
              </label>
              <select
                value={lang}
                onChange={(e) => setLang(e.target.value as Lang)}
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
              >
                <option value="en">English</option>
                <option value="fr">Français</option>
              </select>
            </div>
          </div>
        </Section>

        {/* Password */}
        <Section icon={KeyRound} title={t("settings.changePwd")}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <PwdField label={t("settings.currentPwd")} value={currentPwd} onChange={setCurrentPwd} />
            <PwdField label={t("settings.newPwd")} value={newPwd} onChange={setNewPwd} />
            <PwdField label={t("settings.confirmPwd")} value={confirmPwd} onChange={setConfirmPwd} />
          </div>
          <div className="mt-4">
            <button
              onClick={onSave}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary-glow active:scale-[0.98]"
            >
              {t("common.save")}
            </button>
          </div>
        </Section>

        {/* Notifications */}
        <Section icon={Bell} title={t("settings.notifications")}>
          <div className="space-y-3">
            <Toggle label={t("settings.emailAlerts")} value={emailAlerts} onChange={setEmailAlerts} />
            <Toggle label={t("settings.slackAlerts")} value={slackAlerts} onChange={setSlackAlerts} />
            <Toggle label={t("settings.smsAlerts")} value={smsAlerts} onChange={setSmsAlerts} />
          </div>
        </Section>

        {/* Appearance */}
        <Section icon={Palette} title={t("settings.appearance")}>
          <div>
            <p className="mb-2 text-xs font-medium text-foreground">{t("settings.theme")}</p>
            <div className="flex gap-2">
              {(["light", "dark"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setTheme(mode)}
                  className={cn(
                    "flex-1 rounded-lg border px-4 py-2 text-sm font-medium capitalize transition-all",
                    theme === mode
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border bg-card text-foreground hover:border-primary/40",
                  )}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>
        </Section>

        {/* Admin-only system config */}
        <Section icon={SettingsIcon} title={t("settings.system")}>
          {!isAdmin ? (
            <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
              <ShieldAlert className="h-4 w-4 shrink-0 text-destructive" />
              <p className="text-foreground">{t("settings.systemRestricted")}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Workspace" value="poulina-prod" readOnly />
              <Field label="Audit log retention" value="365 days" readOnly />
              <Field label="SSO provider" value="Okta" readOnly />
              <Field label="API rate limit" value="10 000 req/min" readOnly />
            </div>
          )}
        </Section>
      </div>
    </div>
  );
};

const Section = ({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) => (
  <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
    <header className="mb-4 flex items-center gap-2">
      <Icon className="h-4 w-4 text-primary" />
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
    </header>
    {children}
  </section>
);

const Field = ({
  label,
  value,
  readOnly,
}: {
  label: string;
  value: string;
  readOnly?: boolean;
}) => (
  <div>
    <label className="mb-1.5 block text-xs font-medium text-foreground">{label}</label>
    <input
      readOnly={readOnly}
      value={value}
      className={cn(
        "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15",
        readOnly && "bg-muted/40 capitalize text-muted-foreground",
      )}
    />
  </div>
);

const PwdField = ({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) => (
  <div>
    <label className="mb-1.5 block text-xs font-medium text-foreground">{label}</label>
    <input
      type="password"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="••••••••"
      className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground/70 focus:border-primary focus:ring-2 focus:ring-primary/15"
    />
  </div>
);

const Toggle = ({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) => (
  <label className="flex cursor-pointer items-center justify-between rounded-lg border border-border bg-background px-4 py-3 transition-colors hover:border-primary/40">
    <span className="text-sm text-foreground">{label}</span>
    <button
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      className={cn(
        "relative h-5 w-9 rounded-full transition-colors",
        value ? "bg-primary" : "bg-muted",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 h-4 w-4 rounded-full bg-background shadow transition-transform",
          value ? "translate-x-4" : "translate-x-0.5",
        )}
      />
    </button>
  </label>
);

export default Settings;
