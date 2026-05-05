import { Navigate } from "react-router-dom";
import { ReactNode } from "react";
import { useAuth, Role } from "@/contexts/AuthContext";
import { useI18n } from "@/contexts/I18nContext";
import { ShieldAlert } from "lucide-react";

interface RoleGuardProps {
  allow: Role[];
  children: ReactNode;
  /** When true, render an inline "forbidden" panel instead of redirecting. */
  inline?: boolean;
}

export const RoleGuard = ({ allow, children, inline = false }: RoleGuardProps) => {
  const { user } = useAuth();
  const { t } = useI18n();

  if (!user) return <Navigate to="/login" replace />;
  const granted = user.roles?.some((r) => allow.includes(r)) ?? allow.includes(user.role);
  if (!granted) {
    if (inline) {
      return (
        <div className="m-6 flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-foreground">
          <ShieldAlert className="h-5 w-5 shrink-0 text-destructive" />
          <div>
            <p className="font-semibold">{t("settings.systemRestricted")}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t("common.role")}: <span className="font-mono">{user.role}</span>
            </p>
          </div>
        </div>
      );
    }
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
};
