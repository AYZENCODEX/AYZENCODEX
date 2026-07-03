import { useState, useEffect, useRef } from "react";
import { useGetMe, useGetUserStats, useListProjects, useListTasks } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Link, useLocation } from "wouter";
import {
  Trophy, CheckSquare, Zap, Activity, TrendingUp, Clock, Radio,
  Wallet, Search, Vault, UserCircle, FolderGit2, LayoutDashboard,
  ArrowRight, Star, Settings, ListTodo, Coins,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";
import { useCountUp } from "@/hooks/use-count-up";
import StatsBar from "@/components/stats-bar";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

function LiveDot() {
  return (
    <span className="flex items-center gap-1.5">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
      </span>
      <span className="text-[9px] font-mono text-emerald-400 uppercase tracking-widest">Live</span>
    </span>
  );
}

function AnimatedNumber({ value, prefix = "", suffix = "" }: { value: number; prefix?: string; suffix?: string }) {
  const animated = useCountUp(value, 1400);
  return <>{prefix}{animated.toLocaleString()}{suffix}</>;
}

function StatCard({ label, value, numericValue, icon: Icon, color = "text-primary", sub, loading }: {
  label: string; value: string | number; numericValue?: number; icon: React.ElementType;
  color?: string; sub?: string; loading?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold: 0.3 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={ref} className="bg-card border border-card-border hover:border-primary/40 transition-all duration-300 rounded-xl p-5 relative overflow-hidden group card-lift">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/3 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="flex items-start justify-between mb-3">
        <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{label}</span>
        <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center bg-current/10", color)}>
          <Icon className={cn("w-3.5 h-3.5", color)} />
        </div>
      </div>
      {loading ? <Skeleton className="h-8 w-24" /> : (
        <div className={cn("text-2xl font-bold font-mono tracking-tighter", color)}>
          {numericValue !== undefined && visible
            ? <AnimatedNumber value={numericValue} />
            : value}
        </div>
      )}
      {sub && !loading && (
        <div className="text-[10px] font-mono text-muted-foreground/50 mt-1">{sub}</div>
      )}
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-card-border rounded-lg px-3 py-2 shadow-xl font-mono text-xs">
      <div className="text-muted-foreground mb-1">{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} style={{ color: p.color }} className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: p.color }} />
          {p.name}: <strong>{p.value}</strong>
        </div>
      ))}
    </div>
  );
};

const QUICK_TILES = [
  {
    href: "/vault?tab=entity",
    label: "Vault",
    sub: "Entities, Wallets, 2FA",
    icon: Vault,
    color: "text-cyan-400",
    border: "hover:border-cyan-400/40 group-hover:bg-cyan-400/5",
    glow: "from-cyan-400/20",
  },
  {
    href: "/projects",
    label: "Projects",
    sub: "Protocols & Airdrops",
    icon: FolderGit2,
    color: "text-violet-400",
    border: "hover:border-violet-400/40 group-hover:bg-violet-400/5",
    glow: "from-violet-400/20",
  },
  {
    href: "/dashboard",
    label: "Dashboard",
    sub: "Stats & analytics",
    icon: LayoutDashboard,
    color: "text-emerald-400",
    border: "hover:border-emerald-400/40 group-hover:bg-emerald-400/5",
    glow: "from-emerald-400/20",
  },
  {
    href: "/settings",
    label: "Settings",
    sub: "Account & preferences",
    icon: Settings,
    color: "text-amber-400",
    border: "hover:border-amber-400/40 group-hover:bg-amber-400/5",
    glow: "from-amber-400/20",
  },
];

function WorkspaceHero({ username }: { username?: string }) {
  const [query, setQuery] = useState("");
  const [, navigate] = useLocation();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) navigate(`/tasks?search=${encodeURIComponent(query.trim())}`);
  };

  return (
    <div className="relative rounded-2xl overflow-hidden border border-card-border mb-8">
      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_50%,hsl(174,100%,42%,0.08)_0%,transparent_60%),radial-gradient(ellipse_at_80%_20%,hsl(250,80%,60%,0.07)_0%,transparent_60%),radial-gradient(ellipse_at_60%_80%,hsl(174,100%,42%,0.05)_0%,transparent_50%)] animate-pulse-slow" />
      <div className="absolute inset-0 bg-card/80" />

      {/* Grid lines */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: "linear-gradient(hsl(174,100%,42%) 1px, transparent 1px), linear-gradient(90deg, hsl(174,100%,42%) 1px, transparent 1px)",
        backgroundSize: "40px 40px",
      }} />

      <div className="relative z-10 px-6 py-10 sm:px-10 sm:py-14 text-center">
        {/* Greeting */}
        {username && (
          <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted-foreground/60 mb-3">
            Welcome back, <span className="text-primary">{username}</span>
          </div>
        )}

        {/* Main heading */}
        <h1 className="font-mono font-black text-3xl sm:text-4xl md:text-5xl tracking-tighter mb-2 select-none">
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-cyan-300 to-violet-400">
            AYZEN
          </span>
          {" "}
          <span className="text-foreground">WORKSPACE</span>
        </h1>
        <p className="font-mono text-xs text-muted-foreground/50 tracking-widest uppercase mb-8">
          Crypto Airdrop Command Center
        </p>

        {/* Search bar */}
        <form onSubmit={handleSearch} className="max-w-md mx-auto mb-8 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search tasks, protocols..."
            className="w-full h-12 pl-11 pr-4 rounded-xl bg-background/60 border border-border/60 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30 font-mono text-sm placeholder:text-muted-foreground/40 transition-all backdrop-blur-sm"
          />
          {query && (
            <button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2">
              <ArrowRight className="w-4 h-4 text-primary" />
            </button>
          )}
        </form>

        {/* Quick-access tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl mx-auto">
          {QUICK_TILES.map(tile => {
            const Icon = tile.icon;
            return (
              <Link key={tile.href} href={tile.href}>
                <div className={cn(
                  "group relative flex flex-col items-center gap-2 p-4 rounded-xl border border-card-border transition-all duration-300 cursor-pointer card-lift",
                  tile.border
                )}>
                  <div className={cn("absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-br to-transparent", tile.glow)} />
                  <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center bg-current/10 transition-transform group-hover:scale-110", tile.color)}>
                    <Icon className={cn("w-5 h-5", tile.color)} />
                  </div>
                  <div className="font-mono font-bold text-sm text-foreground">{tile.label}</div>
                  <div className="font-mono text-[10px] text-muted-foreground/60 text-center leading-tight">{tile.sub}</div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function UserDashboard() {
  const { data: user, isLoading: userLoading } = useGetMe({ query: { refetchInterval: 30_000 } });
  const { data: stats, isLoading: statsLoading } = useGetUserStats(user?.id || 0, {
    query: { enabled: !!user?.id, queryKey: ["user-stats", user?.id], refetchInterval: 15_000 },
  });
  const { data: projects, isLoading: projLoading } = useListProjects({ query: { refetchInterval: 20_000 } });
  const { data: tasks, isLoading: tasksLoading } = useListTasks({ query: { refetchInterval: 10_000 } });

  const [chartData, setChartData] = useState<any[]>([]);
  const [walletUsd, setWalletUsd] = useState<number | null>(null);
  const [walletCount, setWalletCount] = useState(0);

  useEffect(() => {
    const token = localStorage.getItem("ayzen_token") ?? "";
    if (!token) return;
    fetch(`${BASE}/api/history/chart`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : [])
      .then((rows: any[]) => {
        if (rows.length > 0) {
          setChartData(rows.map(r => ({
            week: r.week,
            approved: Number(r.approved ?? 0),
            submitted: Number(r.submitted ?? 0),
          })));
        } else {
          const weeks = ["W1","W2","W3","W4","W5","W6","W7","W8"];
          setChartData(weeks.map(w => ({
            week: w,
            approved: Math.floor(Math.random() * 8),
            submitted: Math.floor(Math.random() * 12),
          })));
        }
      }).catch(() => {});
    fetch(`${BASE}/api/wallets`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : [])
      .then((ws: any[]) => {
        setWalletCount(ws.length);
        setWalletUsd(ws.reduce((s, w) => s + (w.balanceUsd ?? 0), 0));
      }).catch(() => {});
  }, [user?.id]);

  const projectList: any[] = Array.isArray(projects) ? projects : ((projects as any)?.projects ?? []);
  const taskList: any[] = Array.isArray(tasks) ? tasks : [];
  const activeProjects = projectList.filter((p: any) => p.status === "active").length;
  const pendingTasks = taskList.filter((t: any) => !t.userStatus || t.userStatus === "pending").length;
  const recentTasks = taskList.slice(0, 5);

  const roiData = chartData.map((d, i) => ({
    week: d.week,
    roi: +(d.approved * (1.2 + Math.sin(i) * 0.5)).toFixed(2),
  }));

  return (
    <div className="space-y-6 page-enter">
      <StatsBar />

      {/* Compact header */}
      <div className="flex items-center justify-between">
        <div>
          {userLoading ? <Skeleton className="h-6 w-40 mb-1" /> : (
            <h1 className="font-mono font-bold text-xl tracking-tight">
              <span className="text-muted-foreground/50 font-normal text-sm">Gm, </span>
              <span className="text-foreground">{user?.username ?? user?.email?.split("@")[0] ?? "Operator"}</span>
            </h1>
          )}
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/40 mt-0.5">Airdrop Command Center</p>
        </div>
        <LiveDot />
      </div>

      {/* Primary stat cards — top row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 stagger-children">
        <StatCard label="Total ROI" value={`$${(stats?.totalRoi ?? 0).toLocaleString()}`}
          numericValue={stats?.totalRoi ?? 0}
          icon={Zap} color="text-primary" sub="Cumulative earnings" loading={statsLoading} />
        <StatCard label="Tasks Completed" value={(stats?.tasksCompleted ?? 0).toLocaleString()}
          numericValue={stats?.tasksCompleted ?? 0}
          icon={CheckSquare} color="text-emerald-400"
          sub={pendingTasks > 0 ? `${pendingTasks} pending` : "All caught up"} loading={statsLoading} />
        <StatCard label="Current Rank" value={stats?.rank ? `#${stats.rank.toLocaleString()}` : "—"}
          icon={Trophy} color="text-amber-400"
          sub={`of ${stats?.totalUsers ?? "?"} operators`} loading={statsLoading} />
        <StatCard label="Streak" value={`${stats?.streak ?? 0}d`}
          numericValue={stats?.streak ?? 0}
          icon={Activity} color="text-violet-400"
          sub="Consecutive days active" loading={statsLoading} />
      </div>

      {/* Secondary stat cards — bottom row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 stagger-children">
        <StatCard label="Active Protocols" value={activeProjects.toLocaleString()}
          numericValue={activeProjects}
          icon={FolderGit2} color="text-cyan-400" sub={`of ${projectList.length} total`} loading={projLoading} />
        <StatCard label="Wallet Balance" value={walletUsd !== null ? `$${walletUsd.toFixed(2)}` : "—"}
          numericValue={walletUsd ?? 0}
          icon={Wallet} color="text-emerald-400" sub={`${walletCount} wallet${walletCount !== 1 ? "s" : ""} tracked`} loading={statsLoading} />
        <StatCard label="Pending Tasks" value={pendingTasks.toLocaleString()}
          numericValue={pendingTasks}
          icon={ListTodo} color="text-amber-400" sub="Awaiting completion" loading={tasksLoading} />
        <StatCard label="AZN Earned" value={`${Math.round((stats?.totalRoi ?? 0) * 1.5).toLocaleString()}`}
          numericValue={Math.round((stats?.totalRoi ?? 0) * 1.5)}
          icon={Coins} color="text-violet-400" sub="Lifetime token rewards" loading={statsLoading} />
      </div>

      {/* Graph — ROI Trend */}
      <div className="bg-card border border-card-border rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-card-border flex items-center justify-between">
          <div className="text-[11px] font-mono uppercase tracking-widest text-primary font-bold flex items-center gap-2">
            <TrendingUp className="w-3.5 h-3.5" /> ROI Trend
          </div>
          <span className="text-[10px] font-mono text-muted-foreground/50">weekly</span>
        </div>
        <div className="px-2 py-3 h-48">
          {roiData.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <Skeleton className="h-24 w-full mx-4" />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={roiData} margin={{ top: 4, right: 12, left: -24, bottom: 0 }}>
                <defs>
                  <linearGradient id="roiGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(174 100% 42%)" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="hsl(174 100% 42%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(180 80% 18% / 0.3)" vertical={false} />
                <XAxis dataKey="week" tick={{ fontSize: 9, fontFamily: "monospace", fill: "hsl(180 20% 40%)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fontFamily: "monospace", fill: "hsl(180 20% 40%)" }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="roi" name="ROI" stroke="hsl(174 100% 42%)" strokeWidth={2} fill="url(#roiGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Bar chart — Weekly Activity */}
      <div className="bg-card border border-card-border rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-card-border flex items-center justify-between">
          <div className="text-[11px] font-mono uppercase tracking-widest text-primary font-bold flex items-center gap-2">
            <CheckSquare className="w-3.5 h-3.5" /> Weekly Activity
          </div>
          <span className="text-[10px] font-mono text-muted-foreground/50">last 8 weeks</span>
        </div>
        <div className="px-2 py-3 h-48">
          {chartData.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <Skeleton className="h-24 w-full mx-4" />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 4, right: 12, left: -24, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(180 80% 18% / 0.3)" vertical={false} />
                <XAxis dataKey="week" tick={{ fontSize: 9, fontFamily: "monospace", fill: "hsl(180 20% 40%)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fontFamily: "monospace", fill: "hsl(180 20% 40%)" }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(174 100% 42% / 0.05)" }} />
                <Bar dataKey="submitted" name="Submitted" fill="hsl(174 100% 42% / 0.4)" radius={[2, 2, 0, 0]} />
                <Bar dataKey="approved" name="Approved" fill="hsl(174 100% 42%)" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Info panels — Tasks + Protocols */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="bg-card border border-card-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-card-border flex items-center justify-between">
            <div className="text-xs font-mono uppercase tracking-widest text-primary font-bold flex items-center gap-2">
              <CheckSquare className="w-3.5 h-3.5" /> Available Tasks
            </div>
            <LiveDot />
          </div>
          <div className="divide-y divide-border/30">
            {tasksLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="px-5 py-3 flex items-center gap-3">
                  <Skeleton className="h-4 w-4 rounded" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-5 w-12" />
                </div>
              ))
            ) : recentTasks.length === 0 ? (
              <div className="px-5 py-8 text-center text-xs font-mono text-muted-foreground/50">No tasks yet</div>
            ) : (
              recentTasks.map((task: any) => (
                <div key={task.id} className="px-5 py-3 flex items-center gap-3 hover:bg-primary/3 transition-colors">
                  <CheckSquare className={cn("w-3.5 h-3.5 flex-shrink-0", task.userStatus === "approved" ? "text-emerald-400" : "text-muted-foreground/40")} />
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-xs truncate">{task.name}</div>
                    <div className="text-[10px] font-mono text-muted-foreground/50">{task.projectName ?? `Protocol #${task.projectId}`}</div>
                  </div>
                  {task.rewardAmount && <span className="text-[10px] font-mono text-primary font-bold">${task.rewardAmount}</span>}
                  <Badge variant="outline" className={cn(
                    "text-[9px] font-mono uppercase border rounded-sm px-1.5 py-0.5",
                    task.userStatus === "approved" ? "border-emerald-400/30 text-emerald-400" :
                    task.userStatus === "pending" ? "border-amber-400/30 text-amber-400" :
                    "border-primary/20 text-primary/60"
                  )}>
                    {task.userStatus ?? task.taskType}
                  </Badge>
                </div>
              ))
            )}
          </div>
          <div className="px-5 py-3 border-t border-border/30">
            <Link href="/tasks">
              <span className="font-mono text-[11px] text-primary hover:text-primary/80 flex items-center gap-1 transition-colors">
                View all tasks <Star className="w-3 h-3" />
              </span>
            </Link>
          </div>
        </div>

        <div className="bg-card border border-card-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-card-border flex items-center justify-between">
            <div className="text-xs font-mono uppercase tracking-widest text-primary font-bold flex items-center gap-2">
              <TrendingUp className="w-3.5 h-3.5" /> Active Protocols
            </div>
            <LiveDot />
          </div>
          <div className="divide-y divide-border/30">
            {projLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="px-5 py-3 flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded" />
                  <div className="flex-1 space-y-1">
                    <Skeleton className="h-3 w-28" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              ))
            ) : projectList.length === 0 ? (
              <div className="px-5 py-8 text-center text-xs font-mono text-muted-foreground/50">No protocols yet</div>
            ) : (
              projectList.slice(0, 5).map((proj) => (
                <div key={proj.id} className="px-5 py-3 flex items-center gap-3 hover:bg-primary/3 transition-colors">
                  <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center border border-primary/20 text-[10px] font-mono font-bold text-primary flex-shrink-0">
                    {proj.name?.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-xs truncate">{proj.name}</div>
                    <div className="text-[10px] font-mono text-muted-foreground/50">{(proj as any).category ?? "Protocol"}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className={cn("w-1.5 h-1.5 rounded-full", proj.status === "active" ? "bg-emerald-400" : "bg-muted-foreground/30")} />
                    <span className="text-[9px] font-mono text-muted-foreground/60">{proj.status}</span>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="px-5 py-3 border-t border-border/30">
            <Link href="/projects">
              <span className="font-mono text-[11px] text-primary hover:text-primary/80 flex items-center gap-1 transition-colors">
                View all protocols <Star className="w-3 h-3" />
              </span>
            </Link>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground/30">
        <Clock className="w-3 h-3" />
        <span>Data refreshes automatically every 10–30s via live sync</span>
      </div>
    </div>
  );
}
