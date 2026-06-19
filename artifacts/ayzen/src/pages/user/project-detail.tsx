import { useGetProject } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function UserProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const projectId = parseInt(id || "0", 10);
  
  const { data: project, isLoading } = useGetProject(projectId, {
    query: { enabled: !!projectId }
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/projects">
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold font-mono tracking-tighter uppercase flex items-center gap-3">
            {isLoading ? <Skeleton className="h-8 w-40" /> : project?.name}
          </h1>
          <p className="text-muted-foreground font-mono text-sm">Protocol Terminal</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-6">
          <Card className="bg-card border-card-border shadow-none">
            <CardHeader>
              <CardTitle className="text-sm font-mono uppercase text-primary">Protocol Intel</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-5/6" /></div>
              ) : (
                <p className="text-muted-foreground text-sm font-mono leading-relaxed">{project?.description || 'No description available.'}</p>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card border-card-border shadow-none">
            <CardHeader>
              <CardTitle className="text-sm font-mono uppercase text-primary">Assigned Tasks</CardTitle>
            </CardHeader>
            <CardContent className="text-center py-8 font-mono text-muted-foreground">
              {project?.tasks?.length === 0 ? "No tasks currently assigned for this protocol." : "Tasks available. System linking pending."}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="bg-card border-card-border shadow-none">
            <CardHeader>
              <CardTitle className="text-sm font-mono uppercase text-primary">Data Profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 font-mono text-sm">
              <div className="flex justify-between items-center border-b border-card-border pb-2">
                <span className="text-muted-foreground">Tier</span>
                <Badge variant="outline" className="text-[10px] rounded-sm border-primary/30">{project?.tier || '-'}</Badge>
              </div>
              <div className="flex justify-between items-center border-b border-card-border pb-2">
                <span className="text-muted-foreground">Funding</span>
                <span className="font-bold">${project?.fundingAmount?.toLocaleString() || 0}</span>
              </div>
              <div className="flex justify-between items-center pb-2">
                <span className="text-muted-foreground">Difficulty</span>
                <span className="font-bold">{project?.experienceLevel || '-'}</span>
              </div>
              {project?.websiteUrl && (
                <Button variant="outline" className="w-full mt-4 bg-transparent border-primary/20 text-primary hover:bg-primary/10 font-mono text-xs uppercase" onClick={() => window.open(project.websiteUrl!, '_blank')}>
                  <ExternalLink className="h-3 w-3 mr-2" /> Launch Protocol
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
