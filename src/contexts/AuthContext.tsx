import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type Role = "admin" | "operator" | "viewer";

export interface User {
  email: string;
  name: string;
  role: Role;
  initials: string;
  /** IDs of servers the user is allowed to access */
  assignedServers: string[];
}

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string, remember: boolean) => Promise<void>;
  logout: () => void;
  loading: boolean;
  hasRole: (...roles: Role[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const STORAGE_KEY = "poulina-auth";

/** Demo user catalog — in real app this would come from the backend. */
const KNOWN_USERS: Record<string, Omit<User, "email" | "name" | "initials">> = {
  "admin@poulina.com": {
    role: "admin",
    assignedServers: ["srv-001", "srv-002", "srv-003", "srv-004", "srv-005", "srv-006"],
  },
  "operator@poulina.com": {
    role: "operator",
    assignedServers: ["srv-001", "srv-002", "srv-003"],
  },
  "viewer@poulina.com": {
    role: "viewer",
    assignedServers: ["srv-001", "srv-002"],
  },
};

const inferRole = (email: string): Role => {
  const local = email.toLowerCase();
  if (local.includes("admin")) return "admin";
  if (local.includes("view")) return "viewer";
  return "operator";
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY) ?? sessionStorage.getItem(STORAGE_KEY);
      if (raw) setUser(JSON.parse(raw));
    } catch {
      // ignore
    }
    setLoading(false);
  }, []);

  const login = async (email: string, _password: string, remember: boolean) => {
    await new Promise((r) => setTimeout(r, 800));
    const known = KNOWN_USERS[email.toLowerCase()];
    const role = known?.role ?? inferRole(email);
    const assignedServers =
      known?.assignedServers ??
      (role === "admin"
        ? ["srv-001", "srv-002", "srv-003", "srv-004", "srv-005", "srv-006"]
        : role === "operator"
          ? ["srv-001", "srv-002", "srv-003"]
          : ["srv-001"]);

    const name =
      email.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) || "User";
    const initials = name
      .split(" ")
      .map((s) => s[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

    const u: User = { email, name, role, initials, assignedServers };
    setUser(u);
    const store = remember ? localStorage : sessionStorage;
    store.setItem(STORAGE_KEY, JSON.stringify(u));
    (remember ? sessionStorage : localStorage).removeItem(STORAGE_KEY);
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_KEY);
  };

  const hasRole = (...roles: Role[]) => !!user && roles.includes(user.role);

  return (
    <AuthContext.Provider
      value={{ user, isAuthenticated: !!user, login, logout, loading, hasRole }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
