import { useGetProject, useGetProjectStats } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ExternalLink, Users, CheckSquare, Zap, Activity } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function AdminProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const projectId = parseInt(id || "0", 10);
  
  const { data: project, isLoading: projectLoading } = useGetProject(projectId, {
    query: { enabled: !!projectId, queryKey: ["project", projectId] }
  });
  
  const { data: stats, isLoading: statsLoading } = useGetProjectStats(projectId, {
    query: { enabled: !!projectId, queryKey: ["project-stats", projectId] }
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/projects">
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold font-mono tracking-tighter uppercase flex items-center gap-3">
            {projectLoading ? <Skeleton className="h-8 w-40" /> : project?.name}
            {project?.tier && (
              <Badge variant="outline" className="font-mono text-xs border-primary/50 text-primary">
                TIER {project.tier}
              </Badge>
            )}
          </h1>
          <p className="text-muted-foreground font-mono text-sm">Protocol details and telemetry</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-card border-card-border shadow-none">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-mono uppercase text-muted-foreground">Active Operators</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {statsLoading ? <Skeleton className="h-8 w-16" /> : (
              <div className="text-2xl font-bold font-mono">{stats?.activeUsers || 0}</div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-card-border shadow-none">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-mono uppercase text-muted-foreground">Total Tasks</CardTitle>
            <Activity className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {statsLoading ? <Skeleton className="h-8 w-16" /> : (
              <div className="text-2xl font-bold font-mono">{stats?.totalTasks || 0}</div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-card-border shadow-none">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-mono uppercase text-muted-foreground">Executions</CardTitle>
            <CheckSquare className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {statsLoading ? <Skeleton className="h-8 w-16" /> : (
              <div className="text-2xl font-bold font-mono">{stats?.completedTasks || 0}</div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-card-border shadow-none">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-mono uppercase text-muted-foreground">Distributed ROI</CardTitle>
            <Zap className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {statsLoading ? <Skeleton className="h-8 w-24" /> : (
              <div className="text-2xl font-bold font-mono">${stats?.totalRoiDistributed?.toLocaleString() || 0}</div>
            )}
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="tasks" className="w-full">
        <TabsList className="bg-card border border-card-border w-full justify-start rounded-md h-12 p-1">
          <TabsTrigger value="tasks" className="font-mono uppercase text-xs data-[state=active]:bg-primary/20 data-[state=active]:text-primary">Tasks</TabsTrigger>
          <TabsTrigger value="members" className="font-mono uppercase text-xs data-[state=active]:bg-primary/20 data-[state=active]:text-primary">Operators</TabsTrigger>
          <TabsTrigger value="settings" className="font-mono uppercase text-xs data-[state=active]:bg-primary/20 data-[state=active]:text-primary">Settings</TabsTrigger>
        </TabsList>
        
        <TabsContent value="tasks" className="mt-4">
          <Card className="bg-card border-card-border shadow-none">
            <CardContent className="p-6 text-center font-mono text-muted-foreground">
              Task list functionality pending implementation.
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="members" className="mt-4">
          <Card className="bg-card border-card-border shadow-none">
            <CardContent className="p-6 text-center font-mono text-muted-foreground">
              Operator list functionality pending implementation.
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
