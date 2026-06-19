import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import {
  LayoutDashboard,
  Users,
  FolderGit2,
  CheckSquare,
  Fuel,
  Wallet,
  Activity,
  MessageSquare,
  Trophy,
  Settings,
  Terminal,
  LogOut,
  Vault,
  Inbox,
  ShieldCheck,
  KeyRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface AppSidebarProps {
  onNavigate?: () => void;
}

export function AppSidebar({ onNavigate }: AppSidebarProps = {}) {
  const [location] = useLocation();
  const { isAdmin, logout, user } = useAuth();

  const adminLinks = [
    { href: "/admin/dashboard", label: "Overview", icon: LayoutDashboard },
    { href: "/admin/users", label: "Users", icon: Users },
    { href: "/admin/projects", label: "Projects", icon: FolderGit2 },
    { href: "/admin/tasks", label: "Tasks", icon: CheckSquare },
    { href: "/admin/tools/gas", label: "Gas Tracker", icon: Fuel },
    { href: "/admin/tools/wallet", label: "Wallet Analysis", icon: Wallet },
    { href: "/admin/tools/streak", label: "Streak & Spam", icon: Activity },
    { href: "/admin/broadcast", label: "Broadcast", icon: MessageSquare },
    { href: "/admin/leaderboard", label: "Leaderboard", icon: Trophy },
    { href: "/admin/settings", label: "Settings", icon: Settings },
    { href: "/admin/developer", label: "Developer", icon: Terminal },
  ];

  const userLinks = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/projects", label: "Projects", icon: FolderGit2 },
    { href: "/tasks", label: "Tasks", icon: CheckSquare },
    { href: "/vault", label: "Vault", icon: Vault },
    { href: "/authenticator", label: "2FA Codes", icon: ShieldCheck },
    { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
    { href: "/inbox", label: "Inbox", icon: Inbox },
  ];

  const links = isAdmin ? adminLinks : userLinks;

  return (
    <div className="flex h-full w-64 flex-col bg-sidebar border-r border-sidebar-border text-sidebar-foreground">
      <div className="p-4 flex items-center gap-2 font-mono text-xl font-bold tracking-tighter text-primary border-b border-sidebar-border">
        <Terminal className="w-5 h-5" />
        AYZEN
      </div>
      <div className="flex-1 overflow-y-auto py-3">
        <nav className="space-y-0.5 px-2">
          {links.map((link) => {
            const Icon = link.icon;
            const isActive = location === link.href || location.startsWith(link.href + "/");
            return (
              <Link key={link.href} href={link.href} onClick={onNavigate}>
                <div className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors cursor-pointer font-mono",
                  isActive
                    ? "bg-primary/10 text-primary border border-primary/20"
                    : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground border border-transparent"
                )}>
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate">{link.label}</span>
                </div>
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="p-3 border-t border-sidebar-border">
        <div className="flex items-center gap-2 mb-3 px-1">
          <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center font-bold text-xs uppercase text-primary flex-shrink-0">
            {user?.username?.[0] || 'U'}
          </div>
          <div className="flex-1 overflow-hidden min-w-0">
            <div className="text-sm font-mono font-medium truncate">{user?.username}</div>
            <div className="text-[10px] text-sidebar-foreground/50 truncate uppercase font-mono">{user?.email}</div>
          </div>
        </div>
        <Button
          variant="outline"
          className="w-full justify-start gap-2 border-sidebar-border text-sidebar-foreground hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 text-xs font-mono"
          onClick={logout}
        >
          <LogOut className="w-3.5 h-3.5" />
          Disconnect
        </Button>
      </div>
    </div>
  );
}
