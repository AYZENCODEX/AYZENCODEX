import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { usePlugins } from "@/hooks/use-plugins";
import {
  LayoutDashboard, Users, FolderGit2, CheckSquare, Fuel, Wallet,
  Trophy, Settings, Terminal, LogOut,
  Vault, Inbox, ShieldCheck, KeyRound, ChevronDown, ChevronRight,
  Radio, Code2, Database, AtSign, UserCircle, Mail, HelpCircle, Share2, Puzzle,
  Bot, Send, Loader2, X, ChevronUp, Star, Coins, MessageCircle, History,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface AppSidebarProps { onNavigate?: () => void; }
interface NavItem { href: string; label: string; icon: React.ElementType; pluginSlug?: string; }
interface NavGroup { label: string; icon: React.ElementType; items: NavItem[]; }

const ADMIN_NAV: NavGroup[] = [
  {
    label: "Platform", icon: LayoutDashboard,
    items: [{ href: "/admin/dashboard", label: "Overview", icon: LayoutDashboard }],
  },
  {
    label: "Operators", icon: Users,
    items: [
      { href: "/admin/users", label: "Users", icon: Users },
      { href: "/admin/vault", label: "Entities", icon: Database, pluginSlug: "vault" },
    ],
  },
  {
    label: "Protocols", icon: FolderGit2,
    items: [
      { href: "/admin/projects", label: "Projects", icon: FolderGit2, pluginSlug: "projects" },
      { href: "/admin/tasks", label: "Tasks", icon: CheckSquare, pluginSlug: "tasks" },
    ],
  },
  {
    label: "Tools", icon: Fuel,
    items: [
      { href: "/admin/tools/gas", label: "Gas Tracker", icon: Fuel },
      { href: "/admin/tools/wallet", label: "Wallet Analysis", icon: Wallet },
      { href: "/admin/tools/streak", label: "Streak & Spam", icon: CheckSquare },
    ],
  },
  {
    label: "System", icon: Settings,
    items: [
      { href: "/admin/broadcast", label: "Broadcast", icon: Radio, pluginSlug: "broadcast" },
      { href: "/admin/referrals", label: "Referrals", icon: Share2, pluginSlug: "referrals" },
      { href: "/admin/leaderboard", label: "Leaderboard", icon: Trophy, pluginSlug: "leaderboard" },
      { href: "/admin/support", label: "Support", icon: HelpCircle, pluginSlug: "support" },
      { href: "/admin/credits", label: "Credit Approvals", icon: Coins },
      { href: "/admin/subscriptions", label: "Subscriptions", icon: Star },
      { href: "/admin/plugins", label: "Plugins", icon: Puzzle },
      { href: "/admin/settings", label: "Settings", icon: Settings },
      { href: "/admin/developer", label: "Developer", icon: Code2 },
    ],
  },
];

const USER_NAV: NavGroup[] = [
  {
    label: "Command", icon: LayoutDashboard,
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/history",   label: "Activity Log", icon: History },
    ],
  },
  {
    label: "Protocols", icon: FolderGit2,
    items: [
      { href: "/projects", label: "Projects", icon: FolderGit2, pluginSlug: "projects" },
      { href: "/tasks", label: "Tasks", icon: CheckSquare, pluginSlug: "tasks" },
    ],
  },
  {
    label: "Assets", icon: KeyRound,
    items: [
      { href: "/wallets", label: "My Wallets", icon: Wallet, pluginSlug: "wallets" },
      { href: "/vault", label: "Vault", icon: Vault, pluginSlug: "vault" },
      { href: "/authenticator", label: "2FA Codes", icon: ShieldCheck, pluginSlug: "authenticator" },
    ],
  },
  {
    label: "Mail", icon: Mail,
    items: [
      { href: "/ayzen-email", label: "AYZEN", icon: AtSign, pluginSlug: "ayzen-email" },
      { href: "/email-accounts", label: "LOCAL", icon: Mail, pluginSlug: "email-manager" },
    ],
  },
  {
    label: "Social", icon: Trophy,
    items: [
      { href: "/leaderboard", label: "Leaderboard", icon: Trophy, pluginSlug: "leaderboard" },
      { href: "/inbox", label: "Messages", icon: MessageCircle },
      { href: "/profile", label: "My Profile", icon: UserCircle },
      { href: "/referrals", label: "Referrals", icon: Share2, pluginSlug: "referrals" },
      { href: "/support", label: "Support", icon: HelpCircle, pluginSlug: "support" },
    ],
  },
  {
    label: "System", icon: Settings,
    items: [
      { href: "/credits", label: "Credits & AZN", icon: Coins },
      { href: "/subscription", label: "Subscription", icon: Star },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

interface Message { role: "user" | "assistant"; content: string; }

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

function SidebarAiPanel() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  const sendMessage = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    const userMsg: Message = { role: "user", content };
    const newMsgs = [...messages, userMsg];
    setMessages(newMsgs);
    setInput("");
    setLoading(true);
    try {
      const token = localStorage.getItem("ayzen_token") ?? "";
      const res = await fetch(`${BASE}/api/ai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ messages: newMsgs, model: "llama-3.3-70b-versatile" }),
      });
      const data = await res.json();
      const reply = data.choices?.[0]?.message?.content ?? "Sorry, I couldn't respond right now.";
      setMessages(m => [...m, { role: "assistant", content: reply }]);
    } catch {
      setMessages(m => [...m, { role: "assistant", content: "Connection error." }]);
    }
    setLoading(false);
  };

  return (
    <div className="border-t border-sidebar-border">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-sidebar-accent transition-colors"
      >
        <div className="relative">
          <div className="w-6 h-6 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
            <Bot className="w-3.5 h-3.5 text-primary" />
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full border border-sidebar" />
        </div>
        <span className="flex-1 text-left font-mono text-xs font-bold text-primary tracking-wider">AYZEN AI</span>
        {open ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronUp className="w-3 h-3 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t border-sidebar-border flex flex-col" style={{ height: "280px" }}>
          <div className="flex-1 overflow-y-auto px-2 py-2 space-y-2">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-2">
                <Bot className="w-6 h-6 text-primary/30" />
                <div className="text-[10px] font-mono text-muted-foreground/40 text-center">
                  Ask about airdrops, vault, wallets...
                </div>
                <div className="flex flex-col gap-1 w-full">
                  {["Best L2 airdrops?", "Check my vault"].map(q => (
                    <button
                      key={q}
                      onClick={() => sendMessage(q)}
                      className="text-[9px] font-mono text-left px-2 py-1.5 rounded border border-border/50 hover:border-primary/30 hover:text-primary text-muted-foreground/50 transition-all"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={cn("flex gap-1.5 animate-fade-up", m.role === "user" ? "flex-row-reverse" : "flex-row")}>
                {m.role === "assistant" && (
                  <div className="w-5 h-5 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Bot className="w-2.5 h-2.5 text-primary" />
                  </div>
                )}
                <div className={cn(
                  "max-w-[85%] text-[10px] font-mono p-2 rounded-lg leading-relaxed",
                  m.role === "user"
                    ? "bg-primary/15 text-foreground border border-primary/20 rounded-tr-sm"
                    : "bg-muted/60 text-foreground border border-border rounded-tl-sm"
                )}>
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex gap-1.5 animate-fade-up">
                <div className="w-5 h-5 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Bot className="w-2.5 h-2.5 text-primary" />
                </div>
                <div className="bg-muted/60 border border-border text-[10px] font-mono p-2 rounded-lg rounded-tl-sm flex items-center gap-1.5">
                  <Loader2 className="w-2.5 h-2.5 animate-spin text-primary" />
                  <span className="text-muted-foreground">Thinking…</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
          <div className="px-2 py-2 border-t border-sidebar-border flex gap-1.5">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()}
              placeholder="Ask AYZEN AI…"
              disabled={loading}
              className="flex-1 bg-input border border-border rounded px-2 py-1.5 text-[10px] font-mono focus:outline-none focus:border-primary/60 placeholder:text-muted-foreground"
            />
            <button
              onClick={() => sendMessage()}
              disabled={loading || !input.trim()}
              className="text-primary hover:text-primary/80 disabled:opacity-30 transition-colors p-1.5 hover:bg-primary/10 rounded"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function NavGroupComp({ group, location, isEnabled, onNavigate }: {
  group: NavGroup;
  location: string;
  isEnabled: (slug: string) => boolean;
  onNavigate?: () => void;
}) {
  const visibleItems = group.items.filter(i => !i.pluginSlug || isEnabled(i.pluginSlug));
  const hasActive = visibleItems.some(i => location === i.href || location.startsWith(i.href + "/"));
  const [open, setOpen] = useState(hasActive || visibleItems.length === 1);
  const GroupIcon = group.icon;

  if (visibleItems.length === 0) return null;

  return (
    <div>
      {visibleItems.length > 1 ? (
        <button
          onClick={() => setOpen(o => !o)}
          className="w-full flex items-center gap-2 px-3 py-1.5 text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60 hover:text-muted-foreground transition-colors"
        >
          <GroupIcon className="w-3 h-3" />
          <span className="flex-1 text-left">{group.label}</span>
          {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        </button>
      ) : (
        <div className="px-3 pt-2 pb-1 text-[10px] font-mono uppercase tracking-widest text-muted-foreground/40">
          {group.label}
        </div>
      )}
      {open && (
        <nav className="space-y-0.5 px-2 pb-1">
          {visibleItems.map(item => {
            const Icon = item.icon;
            const isActive = location === item.href || location.startsWith(item.href + "/");
            return (
              <Link key={item.href} href={item.href} onClick={onNavigate}>
                <div className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer font-mono",
                  isActive
                    ? "bg-primary/10 text-primary border border-primary/20"
                    : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground border border-transparent"
                )}>
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate">{item.label}</span>
                </div>
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}

export function AppSidebar({ onNavigate }: AppSidebarProps = {}) {
  const [location] = useLocation();
  const { isAdmin, logout, user } = useAuth();
  const { isEnabled } = usePlugins();
  const groups = isAdmin ? ADMIN_NAV : USER_NAV;

  return (
    <div className="flex h-full w-64 flex-col bg-sidebar border-r border-sidebar-border text-sidebar-foreground">
      <div className="p-4 flex items-center gap-2 font-mono text-xl font-bold tracking-tighter text-primary border-b border-sidebar-border">
        <Terminal className="w-5 h-5" />
        AYZEN
      </div>
      <div className="flex-1 overflow-y-auto py-2 space-y-1">
        {groups.map(group => (
          <NavGroupComp key={group.label} group={group} location={location} isEnabled={isEnabled} onNavigate={onNavigate} />
        ))}
      </div>

      {/* AI Assistant Panel */}
      <SidebarAiPanel />

      <div className="p-3 border-t border-sidebar-border">
        <div className="flex items-center gap-2 mb-3 px-1">
          <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center font-bold text-xs uppercase text-primary flex-shrink-0">
            {user?.username?.[0] || 'U'}
          </div>
          <div className="flex-1 overflow-hidden min-w-0">
            <div className="text-xs font-mono font-medium truncate">{user?.username}</div>
            <div className="text-[10px] text-sidebar-foreground/50 truncate font-mono">{user?.email}</div>
          </div>
        </div>
        <Button variant="outline" className="w-full justify-start gap-2 border-sidebar-border text-sidebar-foreground hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 text-xs font-mono" onClick={logout}>
          <LogOut className="w-3.5 h-3.5" />
          Disconnect
        </Button>
      </div>
    </div>
  );
}
