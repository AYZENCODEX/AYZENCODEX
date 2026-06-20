import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import {
  LayoutDashboard, Users, FolderGit2, CheckSquare, Fuel, Wallet,
  Activity, MessageSquare, Trophy, Settings, Terminal, LogOut,
  Vault, Inbox, ShieldCheck, KeyRound, ChevronDown, ChevronRight,
  Radio, Code2, BarChart3, Database, AtSign,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface AppSidebarProps { onNavigate?: () => void; }

interface NavItem { href: string; label: string; icon: React.ElementType; }
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
      { href: "/admin/vault", label: "Entities", icon: Database },
    ],
  },
  {
    label: "Protocols", icon: FolderGit2,
    items: [
      { href: "/admin/projects", label: "Projects", icon: FolderGit2 },
      { href: "/admin/tasks", label: "Tasks", icon: CheckSquare },
    ],
  },
  {
    label: "Tools", icon: Fuel,
    items: [
      { href: "/admin/tools/gas", label: "Gas Tracker", icon: Fuel },
      { href: "/admin/tools/wallet", label: "Wallet Analysis", icon: Wallet },
      { href: "/admin/tools/streak", label: "Streak & Spam", icon: Activity },
    ],
  },
  {
    label: "System", icon: Settings,
    items: [
      { href: "/admin/broadcast", label: "Broadcast", icon: Radio },
      { href: "/admin/leaderboard", label: "Leaderboard", icon: Trophy },
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
      { href: "/projects", label: "Projects", icon: FolderGit2 },
      { href: "/tasks", label: "Tasks", icon: CheckSquare },
    ],
  },
  {
    label: "Assets", icon: KeyRound,
    items: [
      { href: "/vault", label: "Vault", icon: Vault },
      { href: "/ayzen-email", label: "AYZEN Email", icon: AtSign },
      { href: "/authenticator", label: "2FA Codes", icon: ShieldCheck },
    ],
  },
  {
    label: "Social", icon: Trophy,
    items: [
      { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
      { href: "/inbox", label: "Inbox", icon: Inbox },
    ],
  },
];

function NavGroup({ group, location, onNavigate }: { group: NavGroup; location: string; onNavigate?: () => void }) {
  const hasActive = group.items.some(i => location === i.href || location.startsWith(i.href + "/"));
  const [open, setOpen] = useState(hasActive || group.items.length === 1);
  const GroupIcon = group.icon;

  return (
    <div>
      {group.items.length > 1 ? (
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
          {group.items.map(item => {
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
  const groups = isAdmin ? ADMIN_NAV : USER_NAV;

  return (
    <div className="flex h-full w-64 flex-col bg-sidebar border-r border-sidebar-border text-sidebar-foreground">
      <div className="p-4 flex items-center gap-2 font-mono text-xl font-bold tracking-tighter text-primary border-b border-sidebar-border">
        <Terminal className="w-5 h-5" />
        AYZEN
      </div>
      <div className="flex-1 overflow-y-auto py-2 space-y-1">
        {groups.map(group => (
          <NavGroup key={group.label} group={group} location={location} onNavigate={onNavigate} />
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
