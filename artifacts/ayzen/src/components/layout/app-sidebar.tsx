import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { usePlugins } from "@/hooks/use-plugins";
import {
  LayoutDashboard, Users, FolderGit2, CheckSquare, Fuel, Wallet,
  Trophy, Settings, Terminal, LogOut,
  Vault, Inbox, ShieldCheck, KeyRound, ChevronDown, ChevronRight,
  Radio, Code2, Database, AtSign, UserCircle, Mail, HelpCircle, Share2, Puzzle,
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
      { href: "/admin/plugins", label: "Plugins", icon: Puzzle },
      { href: "/admin/settings", label: "Settings", icon: Settings },
      { href: "/admin/developer", label: "Developer", icon: Code2 },
    ],
  },
];

const USER_NAV: NavGroup[] = [
  {
    label: "Command", icon: LayoutDashboard,
    items: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }],
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
      { href: "/ayzen-email", label: "AYZEN Email", icon: AtSign, pluginSlug: "ayzen-email" },
      { href: "/email-accounts", label: "Email Manager", icon: Mail, pluginSlug: "email-manager" },
      { href: "/authenticator", label: "2FA Codes", icon: ShieldCheck, pluginSlug: "authenticator" },
    ],
  },
  {
    label: "Social", icon: Trophy,
    items: [
      { href: "/leaderboard", label: "Leaderboard", icon: Trophy, pluginSlug: "leaderboard" },
      { href: "/inbox", label: "Inbox", icon: Inbox },
      { href: "/profile", label: "My Profile", icon: UserCircle },
      { href: "/referrals", label: "Referrals", icon: Share2, pluginSlug: "referrals" },
      { href: "/support", label: "Support", icon: HelpCircle, pluginSlug: "support" },
    ],
  },
  {
    label: "System", icon: Settings,
    items: [
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

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
