import { useGetMe, useGetUserStats } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, CheckSquare, Zap, Activity } from "lucide-react";

export default function UserDashboard() {
  const { data: user, isLoading: userLoading } = useGetMe();
  const { data: stats, isLoading: statsLoading } = useGetUserStats(user?.id || 0, {
    query: { enabled: !!user?.id }
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-mono tracking-tighter uppercase">Operator Terminal</h1>
        <p className="text-muted-foreground font-mono text-sm">Welcome back, {user?.username || 'Hunter'}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-card border-card-border shadow-none">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-mono uppercase text-muted-foreground">Total ROI</CardTitle>
            <Zap className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {statsLoading ? <Skeleton className="h-8 w-20" /> : (
              <div className="text-2xl font-bold font-mono">${stats?.totalRoi?.toLocaleString() || 0}</div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-card-border shadow-none">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-mono uppercase text-muted-foreground">Tasks Completed</CardTitle>
            <CheckSquare className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {statsLoading ? <Skeleton className="h-8 w-20" /> : (
              <div className="text-2xl font-bold font-mono">{stats?.tasksCompleted?.toLocaleString() || 0}</div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-card-border shadow-none">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-mono uppercase text-muted-foreground">Current Rank</CardTitle>
            <Trophy className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {statsLoading ? <Skeleton className="h-8 w-20" /> : (
              <div className="text-2xl font-bold font-mono">#{stats?.rank?.toLocaleString() || '-'}</div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-card-border shadow-none">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-mono uppercase text-muted-foreground">Current Streak</CardTitle>
            <Activity className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {statsLoading ? <Skeleton className="h-8 w-20" /> : (
              <div className="text-2xl font-bold font-mono">{stats?.streak || 0} Days</div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="bg-card border-card-border shadow-none">
          <CardHeader>
            <CardTitle className="text-sm font-mono uppercase text-primary">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground font-mono">No recent activity found. Execute tasks to build your history.</div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-card-border shadow-none">
          <CardHeader>
            <CardTitle className="text-sm font-mono uppercase text-primary">Pending Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground font-mono">All systems operational. No pending actions required.</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
