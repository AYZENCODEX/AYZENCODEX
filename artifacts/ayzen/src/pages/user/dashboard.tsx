import { useGetMe, useGetUserStats, useListProjects, useListTasks } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Trophy, CheckSquare, Zap, Activity, TrendingUp, Clock, Radio } from "lucide-react";
import { cn } from "@/lib/utils";

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

function StatCard({
  label, value, icon: Icon, color = "text-primary", sub, loading,
}: { label: string; value: string | number; icon: React.ElementType; color?: string; sub?: string; loading?: boolean }) {
  return (
    <div className="bg-card border border-card-border hover:border-primary/40 transition-all duration-300 rounded-xl p-5 hover-lift relative overflow-hidden group">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/3 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="flex items-start justify-between mb-3">
        <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{label}</span>
        <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center bg-current/10", color)}>
          <Icon className={cn("w-3.5 h-3.5", color)} />
        </div>
      </div>
      {loading ? (
        <Skeleton className="h-8 w-24" />
      ) : (
        <div className={cn("text-2xl font-bold font-mono tracking-tighter", color)}>{value}</div>
      )}
      {sub && !loading && (
        <div className="text-[10px] font-mono text-muted-foreground/50 mt-1">{sub}</div>
      )}
    </div>
  );
}

export default function UserDashboard() {
  const { data: user, isLoading: userLoading } = useGetMe({
    query: { refetchInterval: 30_000 },
  });
  const { data: stats, isLoading: statsLoading } = useGetUserStats(user?.id || 0, {
    query: { enabled: !!user?.id, queryKey: ["user-stats", user?.id], refetchInterval: 15_000 },
  });
  const { data: projects, isLoading: projLoading } = useListProjects({
    query: { refetchInterval: 20_000 },
  });
  const { data: tasks, isLoading: tasksLoading } = useListTasks({
    query: { refetchInterval: 10_000 },
  });

  const projectList: any[] = Array.isArray(projects) ? projects : ((projects as any)?.projects ?? []);
  const taskList: any[] = Array.isArray(tasks) ? tasks : [];
  const activeProjects = projectList.filter((p: any) => p.status === "active").length;
  const pendingTasks = taskList.filter((t: any) => !t.userStatus || t.userStatus === "pending").length;
  const recentTasks = taskList.slice(0, 5);

  return (
    <div className="space-y-6 page-enter">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-mono tracking-tighter uppercase flex items-center gap-2">
            <Radio className="w-5 h-5 text-primary" />
            Operator Terminal
          </h1>
          <p className="text-muted-foreground font-mono text-sm mt-0.5">
            {userLoading ? (
              <Skeleton className="h-4 w-32 inline-block" />
            ) : (
              <>Welcome back, <span className="text-primary">{user?.username || "Hunter"}</span></>
            )}
          </p>
        </div>
        <LiveDot />
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total ROI"
          value={`$${(stats?.totalRoi ?? 0).toLocaleString()}`}
          icon={Zap}
          color="text-primary"
          sub="Cumulative earnings"
          loading={statsLoading}
        />
        <StatCard
          label="Tasks Completed"
          value={(stats?.tasksCompleted ?? 0).toLocaleString()}
          icon={CheckSquare}
          color="text-emerald-400"
          sub={pendingTasks > 0 ? `${pendingTasks} pending` : "All caught up"}
          loading={statsLoading}
        />
        <StatCard
          label="Current Rank"
          value={stats?.rank ? `#${stats.rank.toLocaleString()}` : "—"}
          icon={Trophy}
          color="text-amber-400"
          sub={`of ${stats?.totalUsers ?? "?"} operators`}
          loading={statsLoading}
        />
        <StatCard
          label="Streak"
          value={`${stats?.streak ?? 0}d`}
          icon={Activity}
          color="text-violet-400"
          sub="Consecutive days active"
          loading={statsLoading}
        />
      </div>

      {/* Secondary row */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="bg-card border border-card-border rounded-xl p-5">
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">Active Protocols</div>
          {projLoading ? <Skeleton className="h-7 w-12" /> : (
            <div className="text-xl font-bold font-mono text-sky-400">{activeProjects}</div>
          )}
        </div>
        <div className="bg-card border border-card-border rounded-xl p-5">
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">Referrals</div>
          <div className="text-xl font-bold font-mono text-pink-400">{stats?.referrals ?? 0}</div>
        </div>
        <div className="bg-card border border-card-border rounded-xl p-5">
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">Points</div>
          {statsLoading ? <Skeleton className="h-7 w-16" /> : (
            <div className="text-xl font-bold font-mono text-orange-400">{(stats?.points ?? user?.points ?? 0).toLocaleString()}</div>
          )}
        </div>
      </div>

      {/* Recent tasks + Active projects */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Recent Tasks */}
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
              <div className="px-5 py-8 text-center text-xs font-mono text-muted-foreground/50">
                No tasks available — check back soon
              </div>
            ) : (
              recentTasks.map((task: any) => (
                <div key={task.id} className="px-5 py-3 flex items-center gap-3 hover:bg-primary/3 transition-colors">
                  <CheckSquare className={cn("w-3.5 h-3.5 flex-shrink-0", task.userStatus === "approved" ? "text-emerald-400" : "text-muted-foreground/40")} />
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-xs truncate">{task.name}</div>
                    <div className="text-[10px] font-mono text-muted-foreground/50">{task.projectName ?? `Protocol #${task.projectId}`}</div>
                  </div>
                  {task.rewardAmount && (
                    <span className="text-[10px] font-mono text-primary font-bold">${task.rewardAmount}</span>
                  )}
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

        {/* Active Protocols */}
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
              <div className="px-5 py-8 text-center text-xs font-mono text-muted-foreground/50">
                No protocols — admin will add them soon
              </div>
            ) : (
              projectList.slice(0, 5).map((proj) => (
                <div key={proj.id} className="px-5 py-3 flex items-center gap-3 hover:bg-primary/3 transition-colors">
                  <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center border border-primary/20 text-[10px] font-mono font-bold text-primary flex-shrink-0">
                    {proj.name?.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-xs truncate">{proj.name}</div>
                    <div className="text-[10px] font-mono text-muted-foreground/50">{proj.category ?? "Protocol"}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className={cn(
                      "w-1.5 h-1.5 rounded-full",
                      proj.status === "active" ? "bg-emerald-400" : "bg-muted-foreground/30"
                    )} />
                    <span className="text-[9px] font-mono text-muted-foreground/60">{proj.status}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Last updated */}
      <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground/30">
        <Clock className="w-3 h-3" />
        <span>Data refreshes automatically every 10–30s via live sync</span>
      </div>
    </div>
  );
}
