import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { auth, googleProvider, signInWithPopup, signInWithEmailAndPassword, hasFirebase } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Terminal, ArrowRight, Loader2, Mail, User, Eye, EyeOff, Sparkles, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

function GoogleIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

async function firebaseSyncToBackend(idToken: string): Promise<{ token: string; user: any } | null> {
  try {
    const res = await fetch(`${BASE}/api/auth/firebase-sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function backendLogin(email: string, password: string): Promise<{ token: string; user: any } | null> {
  try {
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function backendRegister(username: string, email: string, password: string, refCode?: string): Promise<{ token: string; user: any; error?: string } | null> {
  try {
    const res = await fetch(`${BASE}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, email, password, ...(refCode ? { refCode } : {}) }),
    });
    const data = await res.json();
    if (!res.ok) return { token: "", user: null, error: data.error ?? "Registration failed" };
    return data;
  } catch {
    return null;
  }
}

export default function Login() {
  const [, setLocation] = useLocation();
  const { login: setAuthContext } = useAuth();
  const { toast } = useToast();

  const [tab, setTab] = useState<"signin" | "signup" | "magic">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [magicSent, setMagicSent] = useState(false);
  const [magicLoading, setMagicLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const idToken = await result.user.getIdToken();
      const data = await firebaseSyncToBackend(idToken);
      if (!data) throw new Error("Could not sync account with server");
      setAuthContext(data.user, data.token);
      toast({ title: "Access granted", description: `Welcome, ${data.user.username}!` });
      if (data.user.role === "admin") setLocation("/admin/dashboard");
      else setLocation("/dashboard");
    } catch (err: any) {
      if (err?.code !== "auth/popup-closed-by-user") {
        const msg = err?.code === "auth/unauthorized-domain"
          ? "Google sign-in not available on this domain. Use email/password instead."
          : (err?.message ?? "Google sign-in failed. Try again.");
        toast({ variant: "destructive", title: "Google sign-in failed", description: msg });
      }
    }
    setGoogleLoading(false);
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    try {
      const data = await backendLogin(email, password);
      if (data) {
        setAuthContext(data.user, data.token);
        toast({ title: "Access granted", description: "Welcome back, operator." });
        if (data.user.role === "admin") setLocation("/admin/dashboard");
        else setLocation("/dashboard");
        try {
          const cred = await signInWithEmailAndPassword(auth, email, password);
          if (cred.user) {
            const idToken = await cred.user.getIdToken();
            await firebaseSyncToBackend(idToken);
          }
        } catch { }
      } else {
        toast({ variant: "destructive", title: "Access denied", description: "Invalid credentials. Check email and password." });
      }
    } catch {
      toast({ variant: "destructive", title: "Connection error", description: "Could not reach server. Try again." });
    }
    setLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !email || !password) {
      toast({ variant: "destructive", title: "Fill all fields", description: "Username, email and password are required." });
      return;
    }
    if (password.length < 6) {
      toast({ variant: "destructive", title: "Password too short", description: "Minimum 6 characters required." });
      return;
    }
    setLoading(true);
    try {
      const data = await backendRegister(username, email, password);
      if (!data) {
        toast({ variant: "destructive", title: "Registration failed", description: "Server error. Try again." });
        setLoading(false);
        return;
      }
      if (data.error) {
        toast({ variant: "destructive", title: "Registration failed", description: data.error });
        setLoading(false);
        return;
      }
      setAuthContext(data.user, data.token);
      toast({ title: "Account created!", description: "Welcome to AYZEN, Operator." });
      setLocation("/dashboard");
    } catch {
      toast({ variant: "destructive", title: "Registration failed", description: "Try again." });
    }
    setLoading(false);
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) { toast({ variant: "destructive", title: "Enter your email" }); return; }
    setMagicLoading(true);
    try {
      const res = await fetch(`${BASE}/api/auth/magic-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ variant: "destructive", title: data.error ?? "Failed to send magic link" });
      } else {
        setMagicSent(true);
      }
    } catch {
      toast({ variant: "destructive", title: "Failed to send magic link" });
    }
    setMagicLoading(false);
  };

  const handleDemoAdmin = async () => {
    setLoading(true);
    const data = await backendLogin("support@ayzen.tech", "1234578@Ba1");
    if (data) {
      setAuthContext(data.user, data.token);
      setLocation("/admin/dashboard");
    }
    setLoading(false);
  };

  const handleDemoUser = async () => {
    setLoading(true);
    const data = await backendLogin("user@ayzen.io", "demo123");
    if (data) {
      setAuthContext(data.user, data.token);
      setLocation("/dashboard");
    }
    setLoading(false);
  };

  const isLoading = loading || googleLoading;

  return (
    <div className="min-h-screen w-full bg-background flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 z-0 opacity-[0.02]"
        style={{ backgroundImage: "linear-gradient(to right, #808080 1px, transparent 1px), linear-gradient(to bottom, #808080 1px, transparent 1px)", backgroundSize: "40px 40px" }}
      />

      <div className="w-full max-w-md space-y-8 relative z-10">
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-primary/10 rounded-xl flex items-center justify-center border border-primary/20 shadow-[0_0_20px_rgba(0,255,255,0.08)]">
              <Terminal className="w-8 h-8 text-primary" />
            </div>
          </div>
          <h1 className="text-4xl font-mono font-bold tracking-tighter text-foreground mb-2">AYZEN</h1>
          <p className="text-muted-foreground font-mono text-xs uppercase tracking-[0.3em]">Airdrop Command Center</p>
        </div>

        <div className="bg-card border border-card-border p-8 shadow-2xl relative">
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-primary to-transparent opacity-60" />

          <div className="flex mb-6 border border-border rounded overflow-hidden">
            <button
              onClick={() => setTab("signin")}
              className={`flex-1 py-2 text-xs font-mono uppercase tracking-widest transition-colors ${tab === "signin" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"}`}
            >Sign In</button>
            <button
              onClick={() => setTab("signup")}
              className={`flex-1 py-2 text-xs font-mono uppercase tracking-widest transition-colors ${tab === "signup" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"}`}
            >Sign Up</button>
            <button
              onClick={() => { setTab("magic"); setMagicSent(false); }}
              className={`flex-1 py-2 text-xs font-mono uppercase tracking-widest transition-colors flex items-center justify-center gap-1 ${tab === "magic" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"}`}
            ><Sparkles className="w-3 h-3" /> Magic</button>
          </div>
          {tab !== "magic" && hasFirebase && (
            <>
              <Button
                type="button"
                variant="outline"
                className="w-full h-10 font-mono text-xs border-border hover:border-primary/40 hover:text-primary gap-2 mb-5"
                onClick={handleGoogleSignIn}
                disabled={isLoading}
              >
                {googleLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <GoogleIcon />}
                Continue with Google
              </Button>
              <div className="flex items-center gap-3 mb-5">
                <div className="flex-1 h-px bg-border" />
                <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">or</span>
                <div className="flex-1 h-px bg-border" />
              </div>
            </>
          )}

          {tab === "magic" ? (
            <div className="space-y-4">
              {magicSent ? (
                <div className="py-8 flex flex-col items-center gap-4 text-center">
                  <div className="w-14 h-14 rounded-full bg-emerald-400/10 border border-emerald-400/30 flex items-center justify-center">
                    <Check className="w-7 h-7 text-emerald-400" />
                  </div>
                  <div>
                    <div className="font-mono font-bold text-foreground mb-1">Check your inbox</div>
                    <div className="font-mono text-xs text-muted-foreground">
                      We sent a magic link to <span className="text-primary">{email}</span>.<br />
                      Click the link to sign in instantly — no password needed.
                    </div>
                  </div>
                  <Button variant="outline" className="font-mono text-xs w-full" onClick={() => { setMagicSent(false); setEmail(""); }}>
                    Send to different email
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleMagicLink} className="space-y-4">
                  <div className="text-center pb-2">
                    <div className="flex justify-center mb-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                        <Sparkles className="w-5 h-5 text-primary" />
                      </div>
                    </div>
                    <div className="font-mono text-xs text-muted-foreground">
                      Enter your email — we'll send you a one-click sign-in link. No password needed.
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input type="email" placeholder="operator@command.io" value={email} onChange={e => setEmail(e.target.value)}
                        className="bg-input border-border font-mono h-11 pl-9 focus-visible:ring-primary/50 focus-visible:border-primary" required />
                    </div>
                  </div>
                  <Button type="submit" className="w-full h-11 font-mono font-bold uppercase tracking-widest" disabled={magicLoading}>
                    {magicLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <span className="flex items-center gap-2">Send Magic Link <Sparkles className="w-4 h-4" /></span>}
                  </Button>
                </form>
              )}
            </div>
          ) : (
          <form onSubmit={tab === "signin" ? handleSignIn : handleSignUp} className="space-y-4">
            {tab === "signup" && (
              <div className="space-y-2">
                <Label htmlFor="username" className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Username</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="username"
                    type="text"
                    placeholder="operator_handle"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                    className="bg-input border-border font-mono h-11 pl-9 focus-visible:ring-primary/50 focus-visible:border-primary"
                    required
                  />
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email" className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                {tab === "signin" ? "Email / Identifier" : "Email"}
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="operator@command.io"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-input border-border font-mono h-11 pl-9 focus-visible:ring-primary/50 focus-visible:border-primary"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Passphrase</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-input border-border font-mono h-11 pr-10 focus-visible:ring-primary/50 focus-visible:border-primary"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-11 font-mono font-bold uppercase tracking-widest bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={isLoading}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <span className="flex items-center gap-2">
                  {tab === "signin" ? "Initialize" : "Create Account"} <ArrowRight className="w-4 h-4" />
                </span>
              )}
            </Button>
          </form>
          )}

          <div className="mt-6 border-t border-border pt-5">
            <div className="text-[10px] font-mono text-center text-muted-foreground mb-3 uppercase tracking-widest">Demo Override</div>
            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" className="font-mono text-xs h-9 border-border hover:border-primary/40 hover:text-primary" onClick={handleDemoAdmin} disabled={isLoading}>
                {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Admin Init"}
              </Button>
              <Button variant="outline" className="font-mono text-xs h-9 border-border hover:border-violet-500/40 hover:text-violet-400" onClick={handleDemoUser} disabled={isLoading}>
                {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : "User Init"}
              </Button>
            </div>
          </div>
        </div>

        <div className="text-center text-sm text-muted-foreground font-mono">
          {tab === "signin" ? (
            <>Unregistered entity?{" "}<button onClick={() => setTab("signup")} className="text-primary hover:underline">Request access</button></>
          ) : tab === "signup" ? (
            <>Already have access?{" "}<button onClick={() => setTab("signin")} className="text-primary hover:underline">Sign in</button></>
          ) : (
            <>Prefer password?{" "}<button onClick={() => setTab("signin")} className="text-primary hover:underline">Sign in</button></>
          )}
        </div>
      </div>
    </div>
  );
}
