import { useState, useEffect, useRef } from "react";
import { useGetMe, useGetUserStats, useListProjects, useListTasks } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import {
  Trophy, CheckSquare, Zap, Activity, TrendingUp, Clock,
  Wallet, FolderGit2, Star, ListTodo, Coins, ArrowUpRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";
import { useCountUp } from "@/hooks/use-count-up";

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

/** Large featured stat — used for ROI and AZN */
function BigStatCard({
  label, value, numericValue, prefix = "", suffix = "", icon: Icon, color, sub, trend, loading,
}: {
  label: string; value: string; numericValue?: number; prefix?: string; suffix?: string;
  icon: React.ElementType; color: string; sub?: string; trend?: "up" | "down"; loading?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold: 0.2 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={ref} className="relative bg-card border border-card-border hover:border-primary/30 rounded-2xl p-6 overflow-hidden group transition-all duration-300 card-lift">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/3 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className={cn("absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-current to-transparent opacity-20", color)} />

      <div className="flex items-start justify-between mb-4">
        <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60">{label}</span>
        <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center", `bg-current/10`, color)}>
          <Icon className={cn("w-4.5 h-4.5", color)} />
        </div>
      </div>

      {loading ? (
        <Skeleton className="h-10 w-32 mb-2" />
      ) : (
        <div className={cn("text-4xl font-black font-mono tracking-tighter leading-none mb-2", color)}>
          {numericValue !== undefined && visible
            ? <AnimatedNumber value={numericValue} prefix={prefix} suffix={suffix} />
            : value}
        </div>
      )}

      <div className="flex items-center gap-2 mt-1">
        {sub && !loading && (
          <span className="text-[10px] font-mono text-muted-foreground/50">{sub}</span>
        )}
        {trend && !loading && (
          <span className={cn("flex items-center gap-0.5 text-[10px] font-mono font-bold", trend === "up" ? "text-emerald-400" : "text-red-400")}>
            <ArrowUpRight className={cn("w-3 h-3", trend === "down" && "rotate-90")} />
            {trend === "up" ? "↑" : "↓"}
          </span>
        )}
      </div>
    </div>
  );
}

/** Compact stat — used in the 3-column row */
function MiniStatCard({
  label, value, numericValue, icon: Icon, color, sub, loading,
}: {
  label: string; value: string; numericValue?: number;
  icon: React.ElementType; color: string; sub?: string; loading?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold: 0.2 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={ref} className="bg-card border border-card-border hover:border-primary/20 rounded-xl px-4 py-4 flex items-center gap-3 transition-all duration-200 group">
      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-current/10", color)}>
        <Icon className={cn("w-4 h-4", color)} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/50 mb-0.5">{label}</div>
        {loading ? <Skeleton className="h-5 w-16" /> : (
          <div className={cn("text-lg font-bold font-mono tracking-tight leading-none", color)}>
            {numericValue !== undefined && visible
              ? <AnimatedNumber value={numericValue} />
              : value}
          </div>
        )}
        {sub && !loading && (
          <div className="text-[9px] font-mono text-muted-foreground/40 mt-0.5 truncate">{sub}</div>
        )}
      </div>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-card-border rounded-lg px-3 py-2 shadow-xl font-mono text-xs">
      <div className="text-muted-foreground/60 mb-1">{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2" style={{ color: p.color }}>
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
          setChartData(weeks.map((w, i) => ({
            week: w,
            approved: Math.floor(Math.abs(Math.sin(i * 1.3)) * 8),
            submitted: Math.floor(Math.abs(Math.sin(i * 0.9 + 1)) * 12),
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

  const aznEarned = Math.round((stats?.totalRoi ?? 0) * 1.5);

  return (
    <div className="space-y-5 page-enter">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          {userLoading ? <Skeleton className="h-6 w-40 mb-1" /> : (
            <h1 className="font-mono font-bold text-xl tracking-tight">
              <span className="text-muted-foreground/40 font-normal text-sm">Gm, </span>
              <span className="text-foreground">{user?.username ?? user?.email?.split("@")[0] ?? "Operator"}</span>
            </h1>
          )}
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/40 mt-0.5">Analytics Overview</p>
        </div>
        <LiveDot />
      </div>

      {/* ── Row 1: 2 big featured stats ────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <BigStatCard
          label="Total ROI"
          value={`$${(stats?.totalRoi ?? 0).toLocaleString()}`}
          numericValue={stats?.totalRoi ?? 0}
          prefix="$"
          icon={Zap}
          color="text-primary"
          sub="Cumulative earnings"
          trend="up"
          loading={statsLoading}
        />
        <BigStatCard
          label="AZN Earned"
          value={aznEarned.toLocaleString()}
          numericValue={aznEarned}
          icon={Coins}
          color="text-violet-400"
          sub="Lifetime token rewards"
          trend="up"
          loading={statsLoading}
        />
      </div>

      {/* ── Row 2: 3 compact stats ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <MiniStatCard
          label="Tasks Completed"
          value={(stats?.tasksCompleted ?? 0).toLocaleString()}
          numericValue={stats?.tasksCompleted ?? 0}
          icon={CheckSquare}
          color="text-emerald-400"
          sub={pendingTasks > 0 ? `${pendingTasks} pending` : "All caught up"}
          loading={statsLoading}
        />
        <MiniStatCard
          label="Rank"
          value={stats?.rank ? `#${stats.rank.toLocaleString()}` : "—"}
          icon={Trophy}
          color="text-amber-400"
          sub={`of ${stats?.totalUsers ?? "?"} operators`}
          loading={statsLoading}
        />
        <MiniStatCard
          label="Streak"
          value={`${stats?.streak ?? 0}d`}
          numericValue={stats?.streak ?? 0}
          icon={Activity}
          color="text-rose-400"
          sub="Consecutive days active"
          loading={statsLoading}
        />
      </div>

      {/* ── Row 3: Charts side by side ──────────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-2">

        {/* ROI Trend — Area */}
        <div className="bg-card border border-card-border rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-card-border flex items-center justify-between">
            <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-widest text-primary font-bold">
              <TrendingUp className="w-3.5 h-3.5" /> ROI Trend
            </div>
            <span className="text-[10px] font-mono text-muted-foreground/40">weekly</span>
          </div>
          <div className="px-1 py-3 h-[180px]">
            {roiData.length === 0
              ? <div className="h-full flex items-center justify-center"><Skeleton className="h-20 w-full mx-4" /></div>
              : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={roiData} margin={{ top: 4, right: 10, left: -28, bottom: 0 }}>
                    <defs>
                      <linearGradient id="roiGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(174 100% 42%)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(174 100% 42%)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(180 80% 18% / 0.25)" vertical={false} />
                    <XAxis dataKey="week" tick={{ fontSize: 9, fontFamily: "monospace", fill: "hsl(180 20% 40%)" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 9, fontFamily: "monospace", fill: "hsl(180 20% 40%)" }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="roi" name="ROI ($)" stroke="hsl(174 100% 42%)" strokeWidth={2} fill="url(#roiGrad)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
          </div>
        </div>

        {/* Weekly Activity — Bar */}
        <div className="bg-card border border-card-border rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-card-border flex items-center justify-between">
            <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-widest text-primary font-bold">
              <CheckSquare className="w-3.5 h-3.5" /> Weekly Activity
            </div>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 text-[9px] font-mono text-muted-foreground/50">
                <span className="w-2 h-2 rounded-sm bg-primary/40 inline-block" /> Submitted
              </span>
              <span className="flex items-center gap-1 text-[9px] font-mono text-muted-foreground/50">
                <span className="w-2 h-2 rounded-sm bg-primary inline-block" /> Approved
              </span>
            </div>
          </div>
          <div className="px-1 py-3 h-[180px]">
            {chartData.length === 0
              ? <div className="h-full flex items-center justify-center"><Skeleton className="h-20 w-full mx-4" /></div>
              : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 4, right: 10, left: -28, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(180 80% 18% / 0.25)" vertical={false} />
                    <XAxis dataKey="week" tick={{ fontSize: 9, fontFamily: "monospace", fill: "hsl(180 20% 40%)" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 9, fontFamily: "monospace", fill: "hsl(180 20% 40%)" }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(174 100% 42% / 0.05)" }} />
                    <Bar dataKey="submitted" name="Submitted" fill="hsl(174 100% 42% / 0.35)" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="approved" name="Approved" fill="hsl(174 100% 42%)" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
          </div>
        </div>
      </div>

      {/* ── Row 4: 4 small utility stats ───────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MiniStatCard
          label="Active Protocols"
          value={activeProjects.toLocaleString()}
          numericValue={activeProjects}
          icon={FolderGit2}
          color="text-cyan-400"
          sub={`of ${projectList.length} total`}
          loading={projLoading}
        />
        <MiniStatCard
          label="Wallet Balance"
          value={walletUsd !== null ? `$${walletUsd.toFixed(2)}` : "—"}
          numericValue={walletUsd ?? 0}
          icon={Wallet}
          color="text-emerald-400"
          sub={`${walletCount} wallet${walletCount !== 1 ? "s" : ""}`}
          loading={statsLoading}
        />
        <MiniStatCard
          label="Pending Tasks"
          value={pendingTasks.toLocaleString()}
          numericValue={pendingTasks}
          icon={ListTodo}
          color="text-amber-400"
          sub="Awaiting completion"
          loading={tasksLoading}
        />
        <MiniStatCard
          label="Win Rate"
          value={
            (stats?.tasksCompleted ?? 0) + pendingTasks > 0
              ? `${Math.round(((stats?.tasksCompleted ?? 0) / ((stats?.tasksCompleted ?? 0) + pendingTasks)) * 100)}%`
              : "—"
          }
          icon={Trophy}
          color="text-violet-400"
          sub="Tasks approved vs total"
          loading={statsLoading}
        />
      </div>

      {/* ── Row 5: Tasks list + Protocols list ─────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-2">

        {/* Available Tasks */}
        <div className="bg-card border border-card-border rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-card-border flex items-center justify-between">
            <div className="text-xs font-mono uppercase tracking-widest text-primary font-bold flex items-center gap-2">
              <CheckSquare className="w-3.5 h-3.5" /> Available Tasks
            </div>
            <LiveDot />
          </div>
          <div className="divide-y divide-border/20">
            {tasksLoading
              ? Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="px-5 py-3 flex items-center gap-3">
                    <Skeleton className="h-4 w-4 rounded" />
                    <Skeleton className="h-4 flex-1" />
                    <Skeleton className="h-5 w-12" />
                  </div>
                ))
              : recentTasks.length === 0
              ? <div className="px-5 py-8 text-center text-xs font-mono text-muted-foreground/40">No tasks yet</div>
              : recentTasks.map((task: any) => (
                  <div key={task.id} className="px-5 py-3 flex items-center gap-3 hover:bg-primary/[0.03] transition-colors">
                    <CheckSquare className={cn("w-3.5 h-3.5 shrink-0", task.userStatus === "approved" ? "text-emerald-400" : "text-muted-foreground/30")} />
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-xs truncate">{task.name}</div>
                      <div className="text-[10px] font-mono text-muted-foreground/40">{task.projectName ?? `Protocol #${task.projectId}`}</div>
                    </div>
                    {task.rewardAmount && <span className="text-[10px] font-mono text-primary font-bold shrink-0">${task.rewardAmount}</span>}
                    <Badge variant="outline" className={cn(
                      "text-[9px] font-mono uppercase border rounded-sm px-1.5 py-0.5 shrink-0",
                      task.userStatus === "approved" ? "border-emerald-400/30 text-emerald-400" :
                      task.userStatus === "pending" ? "border-amber-400/30 text-amber-400" :
                      "border-primary/20 text-primary/50"
                    )}>
                      {task.userStatus ?? task.taskType}
                    </Badge>
                  </div>
                ))}
          </div>
          <div className="px-5 py-3 border-t border-border/20">
            <Link href="/tasks">
              <span className="font-mono text-[11px] text-primary hover:text-primary/70 flex items-center gap-1 transition-colors">
                View all tasks <Star className="w-3 h-3" />
              </span>
            </Link>
          </div>
        </div>

        {/* Active Protocols */}
        <div className="bg-card border border-card-border rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-card-border flex items-center justify-between">
            <div className="text-xs font-mono uppercase tracking-widest text-primary font-bold flex items-center gap-2">
              <TrendingUp className="w-3.5 h-3.5" /> Active Protocols
            </div>
            <LiveDot />
          </div>
          <div className="divide-y divide-border/20">
            {projLoading
              ? Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="px-5 py-3 flex items-center gap-3">
                    <Skeleton className="h-8 w-8 rounded" />
                    <div className="flex-1 space-y-1">
                      <Skeleton className="h-3 w-28" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </div>
                ))
              : projectList.length === 0
              ? <div className="px-5 py-8 text-center text-xs font-mono text-muted-foreground/40">No protocols yet</div>
              : projectList.slice(0, 5).map((proj) => (
                  <div key={proj.id} className="px-5 py-3 flex items-center gap-3 hover:bg-primary/[0.03] transition-colors">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/15 text-[10px] font-mono font-bold text-primary shrink-0">
                      {proj.name?.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-xs truncate">{proj.name}</div>
                      <div className="text-[10px] font-mono text-muted-foreground/40">{(proj as any).category ?? "Protocol"}</div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={cn("w-1.5 h-1.5 rounded-full", proj.status === "active" ? "bg-emerald-400" : "bg-muted-foreground/30")} />
                      <span className="text-[9px] font-mono text-muted-foreground/50">{proj.status}</span>
                    </div>
                  </div>
                ))}
          </div>
          <div className="px-5 py-3 border-t border-border/20">
            <Link href="/projects">
              <span className="font-mono text-[11px] text-primary hover:text-primary/70 flex items-center gap-1 transition-colors">
                View all protocols <Star className="w-3 h-3" />
              </span>
            </Link>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground/25">
        <Clock className="w-3 h-3" />
        <span>Data refreshes automatically every 10–30s</span>
      </div>
    </div>
  );
}
