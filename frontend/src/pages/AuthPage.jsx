import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Feather, Loader2, Eye, EyeOff, Sparkles, FileText,
  GitBranch, Palette, TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const FEATURES = [
  { icon: FileText,   label: "An editor in the room",          desc: "Thad reads what you've written and tells you what's working — and what isn't." },
  { icon: GitBranch,  label: "Know where you are",             desc: "Concept, draft, revision, ready to send. The whole arc, kept track of." },
  { icon: Palette,    label: "Voice you can hold onto",        desc: "Pacing, tone, sentence shape — feedback an editor would give at three in the morning." },
  { icon: TrendingUp, label: "What the market is doing",       desc: "Who's reading what, where the gaps are, where your book might land." },
];

export default function AuthPage() {
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState("login");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", displayName: "", confirmPassword: "" });
  const [errors, setErrors] = useState({});

  const set = (field) => (e) => {
    setForm((p) => ({ ...p, [field]: e.target.value }));
    setErrors((p) => ({ ...p, [field]: undefined }));
  };

  const validate = () => {
    const e = {};
    if (!form.email.trim()) e.email = "Email is needed";
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = "That doesn't look like an email";
    if (!form.password) e.password = "Password is needed";
    else if (form.password.length < 8) e.password = "At least 8 characters";
    if (mode === "register") {
      if (!form.displayName.trim()) e.displayName = "What should we call you?";
      if (form.password !== form.confirmPassword) e.confirmPassword = "These don't match";
    }
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setLoading(true);
    try {
      if (mode === "login") {
        await login(form.email, form.password);
        toast.success("Welcome back.");
      } else {
        await register(form.email, form.password, form.displayName);
        toast.success("You're in.");
      }
      navigate("/");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Something went sideways. Try again?");
    } finally { setLoading(false); }
  };

  const switchMode = () => {
    setMode((m) => (m === "login" ? "register" : "login"));
    setErrors({});
    setForm({ email: "", password: "", displayName: "", confirmPassword: "" });
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* ── Left: feature panel ── */}
      <div className="hidden lg:flex lg:w-[52%] xl:w-[55%] bg-primary flex-col justify-between p-12 relative overflow-hidden">
        {/* Background texture */}
        <div className="absolute inset-0 opacity-[0.04]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }} />

        <div>
          {/* Logo */}
          <div className="flex items-center gap-3 mb-16">
            <Feather className="h-6 w-6 text-primary-foreground/80" />
            <span className="font-serif text-2xl font-semibold text-primary-foreground tracking-tight">
              Publish Itt
            </span>
          </div>

          {/* Headline */}
          <div className="mb-12">
            <h1 className="font-serif text-4xl xl:text-5xl font-semibold text-primary-foreground leading-[1.2] mb-4">
              A workshop<br />for the long draft.
            </h1>
            <p className="text-primary-foreground/60 text-lg leading-relaxed max-w-sm">
              Publish Itt is where the book gets made — first idea, shaky middle, last line. Thad's the editor in the corner, and he's read it.
            </p>
          </div>

          {/* Feature list */}
          <div className="space-y-5">
            {FEATURES.map(({ icon: Icon, label, desc }, i) => (
              <div
                key={label}
                className="flex items-start gap-4 animate-slide-in"
                style={{ animationDelay: `${i * 0.08 + 0.1}s` }}
              >
                <div className="mt-0.5 w-8 h-8 rounded-sm bg-primary-foreground/10 flex items-center justify-center shrink-0">
                  <Icon className="h-4 w-4 text-primary-foreground/70" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-primary-foreground">{label}</p>
                  <p className="text-xs text-primary-foreground/50 mt-0.5 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quote */}
        <blockquote className="border-l-2 border-primary-foreground/20 pl-4">
          <p className="text-sm text-primary-foreground/50 italic leading-relaxed">
            "The first draft of anything is shit." — Hemingway, probably to himself, probably more than once.
          </p>
        </blockquote>
      </div>

      {/* ── Right: form panel ── */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 lg:p-12">
        {/* Mobile logo */}
        <div className="flex items-center gap-2.5 mb-10 lg:hidden">
          <Feather className="h-6 w-6 text-accent" />
          <span className="font-serif text-2xl font-semibold">Publish Itt</span>
        </div>

        <div className="w-full max-w-sm animate-scale-in">
          {/* Header */}
          <div className="mb-8">
            <h2 className="font-serif text-2xl font-semibold tracking-tight">
              {mode === "login" ? "Welcome back" : "Pull up a chair"}
            </h2>
            <p className="text-muted-foreground text-sm mt-1">
              {mode === "login"
                ? "Sign in and pick up where you left off."
                : "Make an account and get to writing."}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "register" && (
              <div className="space-y-1.5">
                <Label htmlFor="displayName">What should we call you?</Label>
                <Input
                  id="displayName"
                  placeholder="e.g., J.K. Rowling"
                  value={form.displayName}
                  onChange={set("displayName")}
                  className={cn("rounded-sm", errors.displayName && "border-destructive")}
                  disabled={loading}
                />
                {errors.displayName && <p className="text-xs text-destructive">{errors.displayName}</p>}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={set("email")}
                className={cn("rounded-sm", errors.email && "border-destructive")}
                disabled={loading}
                autoComplete={mode === "login" ? "email" : "off"}
              />
              {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={form.password}
                  onChange={set("password")}
                  className={cn("rounded-sm pr-10", errors.password && "border-destructive")}
                  disabled={loading}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
            </div>

            {mode === "register" && (
              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword">Confirm password</Label>
                <Input
                  id="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={form.confirmPassword}
                  onChange={set("confirmPassword")}
                  className={cn("rounded-sm", errors.confirmPassword && "border-destructive")}
                  disabled={loading}
                  autoComplete="new-password"
                />
                {errors.confirmPassword && <p className="text-xs text-destructive">{errors.confirmPassword}</p>}
              </div>
            )}

            <Button type="submit" className="w-full rounded-sm mt-2" disabled={loading}>
              {loading
                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />One moment.</>
                : mode === "login" ? "Sign in" : "Create account"}
            </Button>
          </form>

          <div className="mt-5 text-center text-sm text-muted-foreground">
            {mode === "login" ? (
              <>New here?{" "}<button onClick={switchMode} className="text-accent hover:underline font-medium">Make an account</button></>
            ) : (
              <>Already have one?{" "}<button onClick={switchMode} className="text-accent hover:underline font-medium">Sign in</button></>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
