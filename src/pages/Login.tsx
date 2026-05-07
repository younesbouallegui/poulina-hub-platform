import { FormEvent, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Loader2, Lock, Mail, ShieldCheck } from "lucide-react";
import logo from "@/assets/logo.png";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

const schema = z.object({
  email: z.string().trim().email("Please enter a valid email").max(255),
  password: z.string().min(6, "Password must be at least 6 characters").max(128),
});

const Login = () => {
  const { isAuthenticated, login, resetPassword } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPwd, setShowPwd] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (isAuthenticated) return <Navigate to="/" replace />;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) {
      toast({ title: "Invalid input", description: parsed.error.issues[0].message, variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      await login(parsed.data.email, parsed.data.password, remember);
      toast({ title: "Welcome back", description: "Redirecting…" });
      navigate("/", { replace: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Please try again.";
      toast({ title: "Sign-in failed", description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const onForgot = async () => {
    if (!email) {
      toast({ title: "Enter your email first", description: "Your administrator will receive a reset request.", variant: "destructive" });
      return;
    }
    try {
      await resetPassword(email);
      toast({ title: "Check your inbox", description: "Password reset email sent." });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not send reset email.";
      toast({ title: "Reset failed", description: msg, variant: "destructive" });
    }
  };

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-background p-4 animate-fade-in">
      <div
        className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[900px] -translate-x-1/2 rounded-full opacity-50 blur-3xl"
        style={{ background: "var(--gradient-glow)" }}
        aria-hidden
      />
      <main className="relative z-10 w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-card shadow-elevated ring-1 ring-border">
            <img src={logo} alt="Poulina AI Hub logo" className="h-9 w-9 object-contain" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Poulina AI Hub</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">Corporate Operational OS · Enterprise SSO</p>
        </div>

        <form onSubmit={onSubmit} className="glass-strong rounded-2xl p-6 sm:p-8" noValidate>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">
              Sign in to your workspace
            </h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Access is admin-controlled. Contact your administrator if you don't have an account.
          </p>

          <div className="mt-6 space-y-4">

            <div>
              <label htmlFor="email" className="mb-1.5 block text-xs font-medium text-foreground">Email</label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="h-11 w-full rounded-lg border border-input bg-background px-3 pl-9 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground/70 focus:border-primary focus:ring-2 focus:ring-primary/15"
                  required
                  maxLength={255}
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-xs font-medium text-foreground">Password</label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="password"
                  type={showPwd ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-11 w-full rounded-lg border border-input bg-background px-3 pl-9 pr-10 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground/70 focus:border-primary focus:ring-2 focus:ring-primary/15"
                  required
                  maxLength={128}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground transition-colors hover:text-foreground"
                  aria-label={showPwd ? "Hide password" : "Show password"}
                >
                  {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex cursor-pointer items-center gap-2 text-xs text-foreground">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="h-4 w-4 cursor-pointer rounded border-input text-primary accent-[hsl(var(--primary))] focus:ring-primary"
                />
                Remember me
              </label>
              <button
                type="button"
                onClick={onForgot}
                className="text-xs font-medium text-primary transition-colors hover:text-primary-glow hover:underline"
              >
                Forgot password?
              </button>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground shadow-glow transition-all hover:bg-primary-glow active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {submitting ? (
                <><Loader2 className="h-4 w-4 animate-spin" />Signing in…</>
              ) : "Sign in"}
            </button>
          </div>

          <div className="mt-6 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-success" />
            Audit trail enabled · RBAC enforced
          </div>
        </form>

        <p className="mt-6 text-center text-[11px] text-muted-foreground">
          © {new Date().getFullYear()} Poulina Group · AI Hub Platform
        </p>
      </main>
    </div>
  );
};

export default Login;
