import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useLogin } from "@workspace/api-client-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Terminal, ArrowRight, Loader2, Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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

function FacebookIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="#1877F2">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
  );
}

export default function Login() {
  const [, setLocation] = useLocation();
  const { login: setAuthContext } = useAuth();
  const { toast } = useToast();
  const loginMutation = useLogin();
  const [tab, setTab] = useState<"signin" | "signup">("signin");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [oauthLoading, setOauthLoading] = useState<"google" | "facebook" | null>(null);
  const [supabaseLoading, setSupabaseLoading] = useState(false);

  const doLogin = (emailVal: string, passwordVal: string) => {
    loginMutation.mutate(
      { data: { email: emailVal, password: passwordVal } },
      {
        onSuccess: (data) => {
          setAuthContext(data.user, data.token);
          toast({ title: "Access granted", description: "Welcome back, operator." });
          if (data.user.role === "admin") setLocation("/admin/dashboard");
          else setLocation("/dashboard");
        },
        onError: () => toast({ variant: "destructive", title: "Access denied", description: "Invalid credentials." }),
      }
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (tab === "signin") {
      doLogin(email, password);
    } else {
      handleSupabaseSignup();
    }
  };

  const handleSupabaseSignup = async () => {
    if (!email || !password) return;
    setSupabaseLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { username: username || email.split("@")[0] } },
      });
      if (error) {
        toast({ variant: "destructive", title: "Signup failed", description: error.message });
      } else {
        toast({ title: "Account created", description: "Check your email to confirm your account, then sign in." });
        setTab("signin");
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err?.message ?? "Signup failed" });
    }
    setSupabaseLoading(false);
  };

  const handleOAuth = async (provider: "google" | "facebook") => {
    setOauthLoading(provider);
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/login`,
        queryParams: provider === "google" ? { access_type: "offline", prompt: "consent" } : {},
      },
    });
    if (error) {
      toast({ variant: "destructive", title: "OAuth failed", description: error.message });
      setOauthLoading(null);
    }
    // On success, page will redirect — no need to clear loading
  };

  const handleDemoAdmin = () => doLogin("support@ayzen.tech", "1234578@Ba1");
  const handleDemoUser = () => doLogin("user@ayzen.io", "demo123");

  const isLoading = loginMutation.isPending || supabaseLoading || !!oauthLoading;

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

          {/* Tab selector */}
          <div className="flex mb-6 border border-border rounded overflow-hidden">
            <button
              onClick={() => setTab("signin")}
              className={`flex-1 py-2 text-xs font-mono uppercase tracking-widest transition-colors ${tab === "signin" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"}`}
            >
              Sign In
            </button>
            <button
              onClick={() => setTab("signup")}
              className={`flex-1 py-2 text-xs font-mono uppercase tracking-widest transition-colors ${tab === "signup" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"}`}
            >
              Sign Up
            </button>
          </div>

          {/* OAuth Buttons */}
          <div className="space-y-2 mb-5">
            <Button
              type="button"
              variant="outline"
              className="w-full h-10 font-mono text-xs border-border hover:border-primary/40 hover:text-primary gap-2"
              onClick={() => handleOAuth("google")}
              disabled={isLoading}
            >
              {oauthLoading === "google" ? <Loader2 className="w-4 h-4 animate-spin" /> : <GoogleIcon />}
              Continue with Google
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full h-10 font-mono text-xs border-border hover:border-blue-500/40 hover:text-blue-400 gap-2"
              onClick={() => handleOAuth("facebook")}
              disabled={isLoading}
            >
              {oauthLoading === "facebook" ? <Loader2 className="w-4 h-4 animate-spin" /> : <FacebookIcon />}
              Continue with Facebook
            </Button>
          </div>

          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-border" />
            <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">or</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {tab === "signup" && (
              <div className="space-y-2">
                <Label htmlFor="username" className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Username</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="operator_handle"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="bg-input border-border font-mono h-11 focus-visible:ring-primary/50 focus-visible:border-primary"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email" className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                {tab === "signin" ? "Identify" : "Email"}
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="system@operator.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-input border-border font-mono h-11 pl-9 focus-visible:ring-primary/50 focus-visible:border-primary"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Passphrase</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-input border-border font-mono h-11 focus-visible:ring-primary/50 focus-visible:border-primary"
                required
              />
            </div>

            <Button
              type="submit"
              className="w-full h-11 font-mono font-bold uppercase tracking-widest bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={isLoading}
            >
              {(loginMutation.isPending || supabaseLoading) ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <span className="flex items-center gap-2">
                  {tab === "signin" ? "Initialize" : "Create Account"} <ArrowRight className="w-4 h-4" />
                </span>
              )}
            </Button>
          </form>

          <div className="mt-6 border-t border-border pt-5">
            <div className="text-[10px] font-mono text-center text-muted-foreground mb-3 uppercase tracking-widest">Demo Override</div>
            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" className="font-mono text-xs h-9 border-border hover:border-primary/40 hover:text-primary" onClick={handleDemoAdmin} disabled={isLoading}>
                {loginMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Admin Init"}
              </Button>
              <Button variant="outline" className="font-mono text-xs h-9 border-border hover:border-violet-500/40 hover:text-violet-400" onClick={handleDemoUser} disabled={isLoading}>
                {loginMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "User Init"}
              </Button>
            </div>
          </div>
        </div>

        <div className="text-center text-sm text-muted-foreground font-mono">
          {tab === "signin" ? (
            <>Unregistered entity?{" "}<button onClick={() => setTab("signup")} className="text-primary hover:underline">Request access</button></>
          ) : (
            <>Already have access?{" "}<button onClick={() => setTab("signin")} className="text-primary hover:underline">Sign in</button></>
          )}
        </div>
      </div>
    </div>
  );
}
