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
  Menu,
  Vault,
  Inbox
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function AppSidebar() {
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
    { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
    { href: "/inbox", label: "Inbox", icon: Inbox },
  ];

  const links = isAdmin ? adminLinks : userLinks;

  return (
    <div className="flex h-screen w-64 flex-col bg-sidebar border-r border-sidebar-border text-sidebar-foreground">
      <div className="p-4 flex items-center gap-2 font-mono text-xl font-bold tracking-tighter text-primary">
        <Terminal className="w-6 h-6" />
        AYZEN
      </div>
      <div className="flex-1 overflow-y-auto py-4">
        <nav className="space-y-1 px-2">
          {links.map((link) => {
            const Icon = link.icon;
            const isActive = location === link.href || location.startsWith(link.href + "/");
            return (
              <Link key={link.href} href={link.href}>
                <div
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer",
                    isActive 
                      ? "bg-sidebar-primary/10 text-sidebar-primary font-bold" 
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {link.label}
                </div>
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="p-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3 mb-4 px-2">
          <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center font-bold text-xs uppercase">
            {user?.username?.[0] || 'U'}
          </div>
          <div className="flex-1 overflow-hidden">
            <div className="text-sm font-medium truncate">{user?.username}</div>
            <div className="text-xs text-sidebar-foreground/50 truncate uppercase">{user?.role}</div>
          </div>
        </div>
        <Button variant="outline" className="w-full justify-start gap-2 border-sidebar-border text-sidebar-foreground hover:bg-sidebar-accent hover:text-white" onClick={logout}>
          <LogOut className="w-4 h-4" />
          Disconnect
        </Button>
      </div>
    </div>
  );
}
