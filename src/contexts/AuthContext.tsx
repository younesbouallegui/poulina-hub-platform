import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import type { Session, User as SbUser } from "@supabase/supabase-js";

export type Role = "super_admin" | "admin" | "operator" | "viewer" | "auditor";

export interface User {
  id: string;
  email: string;
  name: string;
  initials: string;
  role: Role;
  roles: Role[];
  /** kept for backward compatibility with legacy components/screens */
  assignedServers: string[];
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (email: string, password: string, remember: boolean) => Promise<void>;
  signup: (email: string, password: string, fullName: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  hasRole: (...roles: Role[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const ROLE_PRIORITY: Role[] = ["super_admin", "admin", "operator", "auditor", "viewer"];
const pickPrimary = (roles: Role[]): Role =>
  ROLE_PRIORITY.find((r) => roles.includes(r)) ?? "viewer";

const buildBaseUser = (sb: SbUser): Omit<User, "role" | "roles"> => {
  const email = sb.email ?? "";
  const meta = (sb.user_metadata ?? {}) as Record<string, unknown>;
  const fullName =
    (meta.full_name as string) ||
    (meta.name as string) ||
    email.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) ||
    "User";
  const initials = fullName
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return { id: sb.id, email, name: fullName, initials, assignedServers: [] };
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const loadRoles = useCallback(async (sb: SbUser): Promise<User> => {
    const { data, error } = await (supabase as any)
      .from("user_roles")
      .select("role")
      .eq("user_id", sb.id);
    const roles = !error && data ? (data.map((r) => r.role as Role)) : ["viewer" as Role];
    const safeRoles = roles.length ? roles : ["viewer" as Role];
    return { ...buildBaseUser(sb), roles: safeRoles, role: pickPrimary(safeRoles) };
  }, []);

  useEffect(() => {
    // CRITICAL: subscribe BEFORE getSession
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession?.user) {
        // Defer Supabase calls to avoid deadlocking the auth callback
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

  const login = async (email: string, password: string, _remember: boolean) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signup = async (email: string, password: string, fullName: string) => {
    const redirectUrl = `${window.location.origin}/`;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: redirectUrl, data: { full_name: fullName } },
    });
    if (error) throw error;
  };

  const loginWithGoogle = async () => {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) throw result.error;
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
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
        signup,
        loginWithGoogle,
        resetPassword,
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
  login: async () => {
    throw new Error("Auth not ready");
  },
  signup: async () => {
    throw new Error("Auth not ready");
  },
  loginWithGoogle: async () => {
    throw new Error("Auth not ready");
  },
  resetPassword: async () => {
    throw new Error("Auth not ready");
  },
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
