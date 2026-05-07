import { FormEvent, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Loader2, Lock, Mail, ShieldCheck, User as UserIcon } from "lucide-react";
import logo from "@/assets/logo.png";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

const schema = z.object({
  email: z.string().trim().email("Please enter a valid email").max(255),
  password: z.string().min(6, "Password must be at least 6 characters").max(128),
});
const signupSchema = schema.extend({
  fullName: z.string().trim().min(2, "Please enter your full name").max(120),
});

type Mode = "signin" | "signup";

const Login = () => {
  const { isAuthenticated, login, signup, loginWithGoogle, resetPassword } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPwd, setShowPwd] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  if (isAuthenticated) return <Navigate to="/" replace />;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (mode === "signin") {
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
    } else {
      const parsed = signupSchema.safeParse({ email, password, fullName });
      if (!parsed.success) {
        toast({ title: "Invalid input", description: parsed.error.issues[0].message, variant: "destructive" });
        return;
      }
      setSubmitting(true);
      try {
        await signup(parsed.data.email, parsed.data.password, parsed.data.fullName);
        toast({ title: "Account created", description: "You can now sign in." });
        setMode("signin");
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Please try again.";
        toast({ title: "Sign-up failed", description: msg, variant: "destructive" });
      } finally {
        setSubmitting(false);
      }
    }
  };

  const onGoogle = async () => {
    setGoogleLoading(true);
    try {
      await loginWithGoogle();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Google sign-in failed.";
      toast({ title: "Google sign-in failed", description: msg, variant: "destructive" });
      setGoogleLoading(false);
    }
  };

  const onForgot = async () => {
    if (!email) {
      toast({ title: "Enter your email first", description: "We'll send a reset link there.", variant: "destructive" });
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
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
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

            {mode === "signin" && (
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
            )}

            <button
              type="submit"
              disabled={submitting}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground shadow-glow transition-all hover:bg-primary-glow active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {submitting ? (
                <><Loader2 className="h-4 w-4 animate-spin" />{mode === "signin" ? "Signing in…" : "Creating…"}</>
              ) : mode === "signin" ? "Sign in" : "Create account"}
            </button>

            <div className="relative my-2 flex items-center">
              <div className="h-px flex-1 bg-border" />
              <span className="px-3 text-[10px] uppercase tracking-wider text-muted-foreground">or</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <button
              type="button"
              onClick={onGoogle}
              disabled={googleLoading}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-input bg-background text-sm font-medium text-foreground transition-all hover:bg-muted active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {googleLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden>
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A10.997 10.997 0 0 0 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.78.43 3.46 1.18 4.94l3.66-2.84z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
                </svg>
              )}
              Continue with Google
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
