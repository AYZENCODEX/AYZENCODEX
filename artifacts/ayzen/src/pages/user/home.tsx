import { useState } from "react";
import { useLocation } from "wouter";
import {
  Search, LayoutDashboard, Shield, FolderOpen, Settings,
  Terminal, ChevronRight, Zap, Activity, Wallet, BookOpen,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";

const QUICK_LINKS = [
  {
    label: "Dashboard",
    icon: LayoutDashboard,
    href: "/dashboard",
    desc: "ROI overview & analytics",
    color: "from-primary/15 to-primary/5 border-primary/30 hover:border-primary/60",
    iconColor: "text-primary",
  },
  {
    label: "Vault",
    icon: Shield,
    href: "/vault",
    desc: "Credentials & accounts",
    color: "from-violet-500/15 to-violet-500/5 border-violet-500/30 hover:border-violet-500/60",
    iconColor: "text-violet-400",
  },
  {
    label: "Projects",
    icon: FolderOpen,
    href: "/projects",
    desc: "Airdrop protocols",
    color: "from-cyan-500/15 to-cyan-500/5 border-cyan-500/30 hover:border-cyan-500/60",
    iconColor: "text-cyan-400",
  },
  {
    label: "Settings",
    icon: Settings,
    href: "/settings",
    desc: "Preferences & config",
    color: "from-amber-500/15 to-amber-500/5 border-amber-500/30 hover:border-amber-500/60",
    iconColor: "text-amber-400",
  },
];

const ALL_LINKS = [
  ...QUICK_LINKS,
  { label: "Tasks", icon: Zap, href: "/tasks", desc: "Task center & submissions", color: "from-emerald-500/15 to-emerald-500/5 border-emerald-500/30 hover:border-emerald-500/60", iconColor: "text-emerald-400" },
  { label: "Leaderboard", icon: Activity, href: "/leaderboard", desc: "Rankings & scores", color: "from-orange-500/15 to-orange-500/5 border-orange-500/30 hover:border-orange-500/60", iconColor: "text-orange-400" },
  { label: "Wallets", icon: Wallet, href: "/wallets", desc: "Multi-chain wallet tracker", color: "from-sky-500/15 to-sky-500/5 border-sky-500/30 hover:border-sky-500/60", iconColor: "text-sky-400" },
  { label: "History", icon: BookOpen, href: "/history", desc: "Activity log & timeline", color: "from-rose-500/15 to-rose-500/5 border-rose-500/30 hover:border-rose-500/60", iconColor: "text-rose-400" },
];

export default function UserHome() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [search, setSearch] = useState("");

  const filtered = search.trim()
    ? ALL_LINKS.filter(l =>
        l.label.toLowerCase().includes(search.toLowerCase()) ||
        l.desc.toLowerCase().includes(search.toLowerCase())
      )
    : QUICK_LINKS;

  const showingAll = Boolean(search.trim());

  return (
    <div className="space-y-8 max-w-3xl mx-auto py-4">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-primary/60" />
          <span className="font-mono text-[10px] text-primary/60 uppercase tracking-widest">
            OPERATOR WORKSPACE
          </span>
        </div>
        <h1 className="font-mono font-black text-4xl md:text-5xl tracking-tight text-foreground leading-none">
          AYZEN{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-violet-400">
            WORKSPACE
          </span>
        </h1>
        <p className="font-mono text-sm text-muted-foreground/60 max-w-md">
          {user?.username
            ? `Welcome back, ${user.username}. Command center ready.`
            : "Crypto airdrop command center."}
        </p>
      </div>

      {/* ── Search ──────────────────────────────────────────────── */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground/40 pointer-events-none" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === "Escape" && setSearch("")}
          placeholder="Search workspace — Dashboard, Vault, Tasks…"
          className="h-13 pl-12 pr-6 font-mono text-sm bg-card border-card-border rounded-xl focus-visible:ring-primary/30 focus-visible:border-primary/50 h-[3.25rem]"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[10px] text-muted-foreground/40 hover:text-muted-foreground border border-border/40 rounded px-1.5 py-0.5 transition-colors"
          >
            ESC
          </button>
        )}
      </div>

      {/* ── Quick Launch / Search Results ───────────────────────── */}
      <div>
        <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/40 mb-3">
          {showingAll ? `Results for "${search}"` : "Quick Launch"}
        </div>

        {filtered.length === 0 ? (
          <div className="py-12 text-center font-mono text-sm text-muted-foreground/40 border border-dashed border-border/30 rounded-xl">
            No matches for &ldquo;{search}&rdquo;
          </div>
        ) : (
          <div className={cn(
            "grid gap-3",
            showingAll ? "grid-cols-2 md:grid-cols-4" : "grid-cols-2 md:grid-cols-4"
          )}>
            {filtered.map(link => {
              const Icon = link.icon;
              return (
                <button
                  key={link.href}
                  onClick={() => setLocation(link.href)}
                  className={cn(
                    "p-5 rounded-xl border bg-gradient-to-br text-left transition-all duration-200",
                    "hover:scale-[1.03] hover:shadow-xl hover:shadow-black/20 group",
                    link.color
                  )}
                >
                  <Icon className={cn("w-6 h-6 mb-3 transition-colors", link.iconColor)} />
                  <div className="font-mono font-bold text-sm text-foreground">{link.label}</div>
                  <div className="font-mono text-[10px] text-muted-foreground/60 mt-0.5 leading-relaxed">
                    {link.desc}
                  </div>
                  <ChevronRight className="w-3 h-3 text-muted-foreground/30 group-hover:text-foreground/50 mt-2 transition-colors" />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Status strip ─────────────────────────────────────────── */}
      <div className="flex items-center gap-4 py-2 border-t border-border/20">
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
        <span className="text-[9px] font-mono text-muted-foreground/30 tracking-widest">
          AYZEN PROTOCOL
        </span>
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
      </div>
    </div>
  );
}
