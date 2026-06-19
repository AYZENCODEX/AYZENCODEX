import { useListProjects } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";

export default function UserProjects() {
  const { data, isLoading } = useListProjects({ limit: 50 });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-mono tracking-tighter uppercase">Active Protocols</h1>
        <p className="text-muted-foreground font-mono text-sm">Available airdrop campaigns and tracking targets</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="bg-card border-card-border shadow-none">
              <CardHeader className="pb-2"><Skeleton className="h-6 w-3/4" /></CardHeader>
              <CardContent><Skeleton className="h-16 w-full" /></CardContent>
            </Card>
          ))
        ) : !data || data.projects.length === 0 ? (
          <div className="col-span-full py-12 text-center font-mono text-muted-foreground bg-card border border-card-border rounded-md">
            No active protocols available.
          </div>
        ) : (
          data.projects.map((project) => (
            <Card key={project.id} className="bg-card border-card-border shadow-none hover:border-primary/50 transition-colors flex flex-col">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <CardTitle className="font-mono font-bold text-primary">{project.name}</CardTitle>
                  <Badge variant="outline" className="font-mono text-[10px] uppercase rounded-sm border-primary/30">Tier {project.tier}</Badge>
                </div>
              </CardHeader>
              <CardContent className="flex-1">
                <p className="text-sm text-muted-foreground line-clamp-3 mb-4">{project.description}</p>
                <div className="text-xs font-mono">
                  <span className="text-muted-foreground">Est. Reward:</span> <span className="text-primary font-bold">${project.rewardEstimate?.toLocaleString() || 'TBA'}</span>
                </div>
              </CardContent>
              <CardFooter className="pt-0">
                <Link href={`/projects/${project.id}`} className="w-full">
                  <Button variant="outline" className="w-full font-mono uppercase text-xs border-primary/20 text-primary hover:bg-primary/10">Access Terminal</Button>
                </Link>
              </CardFooter>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
