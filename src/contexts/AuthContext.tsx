import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User as SbUser } from "@supabase/supabase-js";

export type Role = "super_admin" | "admin" | "operator" | "viewer" | "auditor";

export interface User {
  id: string;
  email: string;
  name: string;
  initials: string;
  role: Role;
  roles: Role[];
  zabbixUserId?: string | null;
  zabbixUsername?: string | null;
  assignedServers: string[];
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  isAuthenticated: boolean;
  loading: boolean;
  /** `usernameOrEmail` is the Zabbix username. Password is the user's Zabbix password. */
  login: (usernameOrEmail: string, password: string, remember: boolean) => Promise<void>;
  logout: () => Promise<void>;
  hasRole: (...roles: Role[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const ROLE_PRIORITY: Role[] = ["super_admin", "admin", "operator", "auditor", "viewer"];
const pickPrimary = (roles: Role[]): Role =>
  ROLE_PRIORITY.find((r) => roles.includes(r)) ?? "viewer";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

const buildBaseUser = (sb: SbUser): Omit<User, "role" | "roles"> => {
  const meta = (sb.user_metadata ?? {}) as Record<string, unknown>;
  const email = sb.email ?? "";
  const fullName =
    (meta.full_name as string) ||
    (meta.zabbix_username as string) ||
    email.split("@")[0] ||
    "User";
  const initials = fullName
    .split(/\s+/)
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return {
    id: sb.id,
    email,
    name: fullName,
    initials,
    zabbixUserId: (meta.zabbix_userid as string) ?? null,
    zabbixUsername: (meta.zabbix_username as string) ?? null,
    assignedServers: [],
  };
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const loadRoles = useCallback(async (sb: SbUser): Promise<User> => {
    const { data, error } = await (supabase as any).rpc("current_user_platform_roles");
    let roles: Role[] = ["viewer"];
    let zabbixUserId: string | null = null;
    let zabbixUsername: string | null = null;
    if (!error && Array.isArray(data) && data.length) {
      roles = Array.from(new Set(data.map((r: any) => r.role as Role)));
      zabbixUserId = data[0]?.zabbix_userid ?? null;
      zabbixUsername = data[0]?.username ?? null;
    }
    const base = buildBaseUser(sb);
    return {
      ...base,
      zabbixUserId: zabbixUserId ?? base.zabbixUserId,
      zabbixUsername: zabbixUsername ?? base.zabbixUsername,
      roles,
      role: pickPrimary(roles),
    };
  }, []);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession?.user) {
        setTimeout(() => {
          loadRoles(newSession.user).then(setUser).catch(() => setUser(null));
        }, 0);
      } else {
        setUser(null);
      }
    });

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (s?.user) {
        loadRoles(s.user).then(setUser).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, [loadRoles]);

  const login = async (usernameOrEmail: string, password: string, _remember: boolean) => {
    // Strip @domain if the user pasted an email — Zabbix expects the bare username.
    const username = usernameOrEmail.includes("@")
      ? usernameOrEmail.split("@")[0]
      : usernameOrEmail.trim();

    const res = await fetch(`${SUPABASE_URL}/functions/v1/zabbix-auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(body?.error || `Zabbix login failed (${res.status})`);
    }
    if (!body?.session?.access_token || !body?.session?.refresh_token) {
      throw new Error("Zabbix login did not return a session");
    }
    const { error } = await supabase.auth.setSession({
      access_token: body.session.access_token,
      refresh_token: body.session.refresh_token,
    });
    if (error) throw error;
  };

  const logout = async () => {
    await supabase.auth.signOut();
  };

  const hasRole = (...roles: Role[]) => !!user && roles.some((r) => user.roles.includes(r));

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isAuthenticated: !!session,
        loading,
        login,
        logout,
        hasRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

const FALLBACK_AUTH: AuthContextValue = {
  user: null,
  session: null,
  isAuthenticated: false,
  loading: true,
  login: async () => { throw new Error("Auth not ready"); },
  logout: async () => {},
  hasRole: () => false,
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    if (typeof window !== "undefined") {
      console.warn("useAuth() called outside AuthProvider — using fallback");
    }
    return FALLBACK_AUTH;
  }
  return ctx;
};
