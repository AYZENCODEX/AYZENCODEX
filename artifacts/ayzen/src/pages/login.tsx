import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useLogin } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Terminal, ArrowRight, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Login() {
  const [, setLocation] = useLocation();
  const { login: setAuthContext } = useAuth();
  const { toast } = useToast();
  const loginMutation = useLogin();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const doLogin = (emailVal: string, passwordVal: string) => {
    loginMutation.mutate(
      { data: { email: emailVal, password: passwordVal } },
      {
        onSuccess: (data) => {
          setAuthContext(data.user, data.token);
          toast({ title: "Access granted", description: "Welcome back, operator." });
          if (data.user.role === "admin") {
            setLocation("/admin/dashboard");
          } else {
            setLocation("/dashboard");
          }
        },
        onError: () => {
          toast({ variant: "destructive", title: "Access denied", description: "Invalid credentials." });
        }
      }
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    doLogin(email, password);
  };

  const handleDemoAdmin = () => doLogin("support@ayzen.tech", "1234578@Ba1");
  const handleDemoUser = () => doLogin("user@ayzen.io", "demo123");

  return (
    <div className="min-h-screen w-full bg-background flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 z-0 opacity-[0.02]"
        style={{ backgroundImage: 'linear-gradient(to right, #808080 1px, transparent 1px), linear-gradient(to bottom, #808080 1px, transparent 1px)', backgroundSize: '40px 40px' }}
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

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Identify</Label>
              <Input
                id="email"
                type="email"
                placeholder="system@operator.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-input border-border font-mono h-12 focus-visible:ring-primary/50 focus-visible:border-primary"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Passphrase</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-input border-border font-mono h-12 focus-visible:ring-primary/50 focus-visible:border-primary"
                required
              />
            </div>

            <Button
              type="submit"
              className="w-full h-12 font-mono font-bold uppercase tracking-widest bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                <span className="flex items-center gap-2">Initialize <ArrowRight className="w-4 h-4" /></span>
              )}
            </Button>
          </form>

          <div className="mt-8 border-t border-border pt-6">
            <div className="text-[10px] font-mono text-center text-muted-foreground mb-4 uppercase tracking-widest">Demo Override</div>
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                className="font-mono text-xs h-10 border-border hover:border-primary/40 hover:text-primary"
                onClick={handleDemoAdmin}
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Admin Init"}
              </Button>
              <Button
                variant="outline"
                className="font-mono text-xs h-10 border-border hover:border-violet-500/40 hover:text-violet-400"
                onClick={handleDemoUser}
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "User Init"}
              </Button>
            </div>
          </div>
        </div>

        <div className="text-center text-sm text-muted-foreground font-mono">
          Unregistered entity?{" "}
          <Link href="/register" className="text-primary hover:underline">Request access</Link>
        </div>
      </div>
    </div>
  );
}
