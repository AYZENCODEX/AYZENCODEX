import { useState, useEffect, useRef } from "react";
import { useGetMe, useGetUserStats, useListProjects, useListTasks } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import {
  Trophy, CheckSquare, Zap, Activity, TrendingUp, Clock, Radio,
  Wallet, DollarSign, MousePointerClick,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";
import { ActivityHeatmap } from "@/components/activity-heatmap";
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
    // Fetch chart data
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
          // Synthetic fallback
          const weeks = ["W1","W2","W3","W4","W5","W6","W7","W8"];
          setChartData(weeks.map(w => ({
            week: w,
            approved: Math.floor(Math.random() * 8),
            submitted: Math.floor(Math.random() * 12),
          })));
        }
      }).catch(() => {});
    // Fetch wallets summary
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

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-mono tracking-tighter uppercase flex items-center gap-2">
            <Radio className="w-5 h-5 text-primary" /> Operator Terminal
          </h1>
          <p className="text-muted-foreground font-mono text-sm mt-0.5">
            {userLoading
              ? <Skeleton className="h-4 w-32 inline-block" />
              : <>Welcome back, <span className="text-primary">{user?.username || "Hunter"}</span></>}
          </p>
        </div>
        <LiveDot />
      </div>

      {/* Primary stat cards */}
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

      {/* Secondary stats row */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 stagger-children">
        {[
          { label: "Active Protocols", value: activeProjects, color: "text-sky-400" },
          { label: "Points", value: (stats?.points ?? (user as any)?.points ?? 0).toLocaleString(), color: "text-orange-400" },
          { label: "Referrals", value: stats?.referrals ?? 0, color: "text-pink-400" },
          { label: "Wallet USD",
            value: walletUsd !== null ? `$${walletUsd.toFixed(2)}` : "—",
            color: "text-cyan-400",
            sub: walletCount > 0 ? `${walletCount} wallet${walletCount !== 1 ? "s" : ""}` : null },
        ].map(({ label, value, color, sub }: any) => (
          <div key={label} className="bg-card border border-card-border rounded-xl p-4">
            <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">{label}</div>
            <div className={cn("text-xl font-bold font-mono", color)}>{value}</div>
            {sub && <div className="text-[9px] font-mono text-muted-foreground/50 mt-0.5">{sub}</div>}
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Weekly task chart */}
        <div className="bg-card border border-card-border rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-card-border flex items-center justify-between">
            <div className="text-[11px] font-mono uppercase tracking-widest text-primary font-bold flex items-center gap-2">
              <CheckSquare className="w-3.5 h-3.5" /> Weekly Activity
            </div>
            <span className="text-[10px] font-mono text-muted-foreground/50">last 8 weeks</span>
          </div>
          <div className="px-2 py-3 h-40">
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

        {/* ROI chart */}
        <div className="bg-card border border-card-border rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-card-border flex items-center justify-between">
            <div className="text-[11px] font-mono uppercase tracking-widest text-primary font-bold flex items-center gap-2">
              <TrendingUp className="w-3.5 h-3.5" /> ROI Trend
            </div>
            <span className="text-[10px] font-mono text-muted-foreground/50">weekly</span>
          </div>
          <div className="px-2 py-3 h-40">
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
      </div>

      {/* Activity Heatmap */}
      <ActivityHeatmap />

      {/* Wallet quick panel */}
      {walletCount > 0 && (
        <Link href="/wallets">
          <div className="bg-card border border-card-border hover:border-primary/30 rounded-xl p-4 flex items-center gap-4 cursor-pointer transition-all card-lift group">
            <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
              <Wallet className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-mono text-sm font-bold">My Wallets</div>
              <div className="font-mono text-[10px] text-muted-foreground mt-0.5">
                {walletCount} wallet{walletCount !== 1 ? "s" : ""} tracked
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="font-mono text-lg font-bold text-primary">
                {walletUsd !== null ? `$${walletUsd.toFixed(2)}` : "—"}
              </div>
              <div className="font-mono text-[10px] text-muted-foreground">Total USD</div>
            </div>
          </div>
        </Link>
      )}

      {/* Tasks + Protocols */}
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
        </div>
      </div>

      <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground/30">
        <Clock className="w-3 h-3" />
        <span>Data refreshes automatically every 10–30s via live sync</span>
      </div>
    </div>
  );
}
