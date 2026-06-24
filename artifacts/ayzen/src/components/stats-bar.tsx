import { useGetMe, useListTasks } from "@workspace/api-client-react";
import { TrendingUp, CheckCircle2, DollarSign, Zap, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  color: string;
  borderColor: string;
  trend?: "up" | "down" | null;
  loading?: boolean;
}

function StatCard({ label, value, sub, icon: Icon, color, borderColor, trend, loading }: StatCardProps) {
  return (
    <div className={cn(
      "bg-card border rounded-xl px-4 py-3 flex items-center gap-3 flex-1 min-w-0 relative overflow-hidden",
      borderColor
    )}>
      <div className={cn("absolute top-0 left-0 w-full h-[1px]", color.replace("text-", "bg-").replace("/80", "/40"))} />
      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0", `bg-${color.split("-")[1]}-500/10`)}>
        <Icon className={cn("w-4 h-4", color)} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/60 mb-0.5">{label}</div>
        {loading ? (
          <Skeleton className="h-5 w-16" />
        ) : (
          <div className="flex items-center gap-1.5">
            <span className={cn("font-mono font-bold text-lg leading-tight", color)}>{value}</span>
            {trend && (
              <span className={cn("text-[9px]", trend === "up" ? "text-emerald-400" : "text-red-400")}>
                {trend === "up" ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              </span>
            )}
          </div>
        )}
        {sub && !loading && (
          <div className="font-mono text-[9px] text-muted-foreground/50 mt-0.5 truncate">{sub}</div>
        )}
      </div>
    </div>
  );
}

export default function StatsBar() {
  const { data: me, isLoading: meLoading } = useGetMe();
  const { data: tasksData, isLoading: tasksLoading } = useListTasks();

  const tasks = Array.isArray(tasksData) ? tasksData : [];
  const userId = (me as any)?.id;

  const completedTasks = tasks.filter((t: any) => t.userStatus === "approved").length;
  const pendingTasks = tasks.filter((t: any) => t.userStatus === "pending").length;

  const approvedSubs = tasks.filter((t: any) => t.userStatus === "approved");
  const totalCost = approvedSubs.reduce((s: number, t: any) => s + (t.cost ?? 0), 0);
  const totalProfit = approvedSubs.reduce((s: number, t: any) => s + (t.profit ?? 0), 0);
  const roi = totalCost > 0 ? (((totalProfit - totalCost) / totalCost) * 100) : null;

  const aznBalance = (me as any)?.aznBalance ?? (me as any)?.credits?.aznBalance ?? 0;
  const xpBalance = (me as any)?.xpBalance ?? (me as any)?.credits?.balance ?? 0;

  const loading = meLoading || tasksLoading;

  return (
    <div className="flex gap-2 flex-wrap sm:flex-nowrap">
      <StatCard
        label="Portfolio ROI"
        value={roi !== null ? `${roi >= 0 ? "+" : ""}${roi.toFixed(1)}%` : "—"}
        sub={totalCost > 0 ? `$${totalCost.toFixed(2)} invested` : "No cost tracked"}
        icon={TrendingUp}
        color={roi !== null && roi >= 0 ? "text-emerald-400/80" : "text-red-400/80"}
        borderColor={roi !== null && roi >= 0 ? "border-emerald-500/20" : roi !== null ? "border-red-500/20" : "border-card-border"}
        trend={roi !== null ? (roi >= 0 ? "up" : "down") : null}
        loading={loading}
      />
      <StatCard
        label="Tasks Done"
        value={String(completedTasks)}
        sub={pendingTasks > 0 ? `${pendingTasks} pending review` : `of ${tasks.length} total`}
        icon={CheckCircle2}
        color="text-primary/80"
        borderColor="border-primary/20"
        loading={loading}
      />
      <StatCard
        label="Total Cost"
        value={totalCost > 0 ? `$${totalCost.toFixed(2)}` : "$0.00"}
        sub={totalProfit > 0 ? `$${totalProfit.toFixed(2)} earned back` : "Track costs in tasks"}
        icon={DollarSign}
        color="text-amber-400/80"
        borderColor="border-amber-500/20"
        loading={loading}
      />
      <StatCard
        label="AZN Balance"
        value={aznBalance > 0 ? `${Number(aznBalance).toFixed(4)}` : "0.0000"}
        sub={xpBalance > 0 ? `${xpBalance} XP accumulated` : "Complete tasks to earn"}
        icon={Zap}
        color="text-violet-400/80"
        borderColor="border-violet-500/20"
        loading={loading}
      />
    </div>
  );
}
