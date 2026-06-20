import { Link } from "wouter";
import { Terminal, Zap, ShieldCheck, Wallet, BarChart3, Mail, Bot, ArrowRight, ChevronRight, Globe, Lock, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";

const features = [
  {
    icon: BarChart3,
    title: "Airdrop Intelligence",
    desc: "Track every project's ROI, task completion, and rewards in one unified dashboard. Never miss a claim again.",
    color: "text-cyan-400",
    glow: "shadow-[0_0_20px_rgba(34,211,238,0.12)]",
    border: "border-cyan-900/40",
  },
  {
    icon: Zap,
    title: "Task Automation Center",
    desc: "Complete Twitter follows, Discord joins, and on-chain interactions. Submit proofs and track status per project.",
    color: "text-violet-400",
    glow: "shadow-[0_0_20px_rgba(167,139,250,0.12)]",
    border: "border-violet-900/40",
  },
  {
    icon: Wallet,
    title: "Multi-Chain Wallet Analysis",
    desc: "Analyze wallets across 20+ blockchains. Track gas usage, transaction history, and on-chain footprint.",
    color: "text-cyan-400",
    glow: "shadow-[0_0_20px_rgba(34,211,238,0.12)]",
    border: "border-cyan-900/40",
  },
  {
    icon: Lock,
    title: "Encrypted Vault",
    desc: "Store seed phrases, private keys, and backup codes in your encrypted vault. Your keys, your control.",
    color: "text-violet-400",
    glow: "shadow-[0_0_20px_rgba(167,139,250,0.12)]",
    border: "border-violet-900/40",
  },
  {
    icon: Mail,
    title: "AYZEN Email",
    desc: "Get your own @ayzen.tech email address. Forward airdrop confirmations, whitelist notices, and alerts.",
    color: "text-cyan-400",
    glow: "shadow-[0_0_20px_rgba(34,211,238,0.12)]",
    border: "border-cyan-900/40",
  },
  {
    icon: Bot,
    title: "AI Airdrop Assistant",
    desc: "Ask our AI anything — which projects to prioritize, how to optimize gas, or what tasks are still pending.",
    color: "text-violet-400",
    glow: "shadow-[0_0_20px_rgba(167,139,250,0.12)]",
    border: "border-violet-900/40",
  },
];

const stats = [
  { value: "20+", label: "Blockchains Supported" },
  { value: "100%", label: "On-Chain Verified" },
  { value: "0", label: "Hidden Fees" },
  { value: "24/7", label: "Airdrop Monitoring" },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* Grid texture */}
      <div
        className="fixed inset-0 z-0 pointer-events-none opacity-[0.025]"
        style={{
          backgroundImage:
            "linear-gradient(to right, #808080 1px, transparent 1px), linear-gradient(to bottom, #808080 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      {/* Nav */}
      <header className="relative z-10 border-b border-border/50 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="w-5 h-5 text-primary" />
            <span className="font-mono font-bold text-base tracking-tight text-foreground">AYZEN</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" className="font-mono text-xs h-8 px-4 text-muted-foreground hover:text-foreground">
                Sign In
              </Button>
            </Link>
            <Link href="/login">
              <Button className="font-mono text-xs h-8 px-4 bg-primary text-primary-foreground hover:bg-primary/90">
                Get Started <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative z-10 pt-24 pb-20 px-6 text-center">
        <div className="max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 border border-primary/20 bg-primary/5 rounded-full px-4 py-1.5 mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-primary">Airdrop Command Center · Live</span>
          </div>

          <h1 className="text-5xl sm:text-6xl md:text-7xl font-mono font-bold tracking-tighter text-foreground mb-6 leading-[1.05]">
            Dominate Every{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-violet-500">
              Airdrop
            </span>
          </h1>

          <p className="text-base sm:text-lg text-muted-foreground font-mono max-w-2xl mx-auto leading-relaxed mb-10">
            AYZEN is the professional operator platform for tracking crypto airdrops, completing tasks, analyzing wallets across 20+ chains, and maximizing your ROI — all in one encrypted command center.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/login">
              <Button className="h-12 px-8 font-mono font-bold uppercase tracking-widest text-sm bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_0_25px_rgba(0,255,255,0.2)]">
                Launch Dashboard <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
            <Link href="/login">
              <Button variant="outline" className="h-12 px-8 font-mono text-sm border-border hover:border-primary/40 hover:text-primary uppercase tracking-widest">
                View Demo
              </Button>
            </Link>
          </div>
        </div>

        {/* Glow orbs */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/3 right-1/4 w-[300px] h-[300px] bg-violet-500/5 rounded-full blur-3xl pointer-events-none" />
      </section>

      {/* Stats bar */}
      <section className="relative z-10 border-y border-border/40 bg-card/30">
        <div className="max-w-4xl mx-auto px-6 py-8 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {stats.map((s) => (
            <div key={s.label}>
              <div className="text-2xl font-mono font-bold text-primary mb-1">{s.value}</div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features grid */}
      <section className="relative z-10 py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary/70 mb-3">Platform Features</div>
            <h2 className="text-3xl sm:text-4xl font-mono font-bold tracking-tight text-foreground">
              Everything an operator needs
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((f) => (
              <div
                key={f.title}
                className={`bg-card border ${f.border} rounded p-6 ${f.glow} hover:border-primary/30 transition-colors group`}
              >
                <div className={`w-10 h-10 rounded flex items-center justify-center bg-background border ${f.border} mb-4 group-hover:border-primary/30 transition-colors`}>
                  <f.icon className={`w-5 h-5 ${f.color}`} />
                </div>
                <h3 className="font-mono font-bold text-sm text-foreground mb-2">{f.title}</h3>
                <p className="text-xs text-muted-foreground font-mono leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="relative z-10 py-20 px-6 border-t border-border/40">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary/70 mb-3">How It Works</div>
            <h2 className="text-3xl font-mono font-bold tracking-tight text-foreground">
              Up and running in minutes
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { step: "01", icon: ShieldCheck, title: "Create Account", desc: "Sign up with email or Google. Your account is secured and your vault is encrypted." },
              { step: "02", icon: Layers, title: "Browse Projects", desc: "Explore live airdrop projects. Join the ones that fit your strategy and wallet profile." },
              { step: "03", icon: Globe, title: "Complete & Earn", desc: "Finish tasks, submit proofs, track your ROI, and collect rewards when airdrops drop." },
            ].map((item) => (
              <div key={item.step} className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 rounded-full border border-primary/30 bg-primary/5 flex items-center justify-center">
                    <span className="font-mono text-[10px] text-primary font-bold">{item.step}</span>
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <item.icon className="w-4 h-4 text-primary" />
                    <h3 className="font-mono font-bold text-sm text-foreground">{item.title}</h3>
                  </div>
                  <p className="text-xs text-muted-foreground font-mono leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 py-24 px-6 border-t border-border/40">
        <div className="max-w-2xl mx-auto text-center">
          <div className="bg-card border border-primary/20 rounded p-10 shadow-[0_0_40px_rgba(0,255,255,0.06)] relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-primary to-transparent opacity-60" />
            <Terminal className="w-10 h-10 text-primary mx-auto mb-5 opacity-80" />
            <h2 className="text-2xl font-mono font-bold tracking-tight text-foreground mb-3">
              Ready to start operating?
            </h2>
            <p className="text-sm text-muted-foreground font-mono mb-8 leading-relaxed">
              Join AYZEN and get a complete command center for every airdrop campaign you run.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href="/login">
                <Button className="h-11 px-8 font-mono font-bold uppercase tracking-widest text-sm bg-primary text-primary-foreground hover:bg-primary/90">
                  Get Started Free <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
              <Link href="/login">
                <Button variant="outline" className="h-11 px-8 font-mono text-sm border-border hover:border-primary/40 hover:text-primary uppercase tracking-widest">
                  Demo Login
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border/40 py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-primary" />
            <span className="font-mono text-sm font-bold text-foreground">AYZEN</span>
            <span className="font-mono text-xs text-muted-foreground ml-2">Airdrop Command Center</span>
          </div>
          <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
            © 2026 AYZEN. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
