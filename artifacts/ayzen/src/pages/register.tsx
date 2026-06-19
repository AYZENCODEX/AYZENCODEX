import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useRegister } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Terminal, ArrowRight, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Register() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const registerMutation = useRegister();
  
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    registerMutation.mutate(
      { data: { username, email, password } },
      {
        onSuccess: () => {
          toast({
            title: "Registration successful",
            description: "You can now log in.",
          });
          setLocation("/login");
        },
        onError: () => {
          toast({
            variant: "destructive",
            title: "Registration failed",
            description: "Please check your inputs.",
          });
        }
      }
    );
  };

  return (
    <div className="min-h-screen w-full bg-background flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 z-0 opacity-[0.02]" 
           style={{ backgroundImage: 'linear-gradient(to right, #808080 1px, transparent 1px), linear-gradient(to bottom, #808080 1px, transparent 1px)', backgroundSize: '40px 40px' }} 
      />
      
      <div className="w-full max-w-md space-y-8 relative z-10">
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-primary/10 rounded-xl flex items-center justify-center border border-primary/20 shadow-[0_0_15px_rgba(0,255,255,0.1)]">
              <Terminal className="w-8 h-8 text-primary" />
            </div>
          </div>
          <h1 className="text-4xl font-mono font-bold tracking-tighter text-foreground mb-2">AYZEN</h1>
          <p className="text-muted-foreground font-mono text-sm uppercase tracking-widest">Airdrop Command Center</p>
        </div>

        <div className="bg-card border border-card-border p-8 shadow-2xl relative">
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-primary to-transparent opacity-50" />
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="username" className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Alias</Label>
              <Input 
                id="username" 
                type="text" 
                placeholder="hunter01" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="bg-input border-border font-mono h-12 focus-visible:ring-primary/50 focus-visible:border-primary"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Email</Label>
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
              <Label htmlFor="password" className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Passphrase</Label>
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
              disabled={registerMutation.isPending}
            >
              {registerMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                <span className="flex items-center gap-2">Register <ArrowRight className="w-4 h-4" /></span>
              )}
            </Button>
          </form>
        </div>
        
        <div className="text-center text-sm text-muted-foreground font-mono">
          Already registered? <Link href="/login" className="text-primary hover:underline">Identify</Link>
        </div>
      </div>
    </div>
  );
}
