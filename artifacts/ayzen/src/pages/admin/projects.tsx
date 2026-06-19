import { useState } from "react";
import { Link } from "wouter";
import { useListProjects } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, ExternalLink, Activity } from "lucide-react";

export default function AdminProjects() {
  const [search, setSearch] = useState("");
  const { data, isLoading } = useListProjects({ search, page: 1, limit: 50 });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-mono tracking-tighter uppercase">Project Database</h1>
          <p className="text-muted-foreground font-mono text-sm">Manage airdrop campaigns and protocols</p>
        </div>
        <Button className="font-mono uppercase text-xs tracking-wider gap-2">
          <Plus className="h-4 w-4" /> Initialize Project
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search by protocol name..." 
            className="pl-9 font-mono bg-card border-card-border"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="bg-card border-card-border shadow-none">
              <CardHeader className="pb-2">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2 mt-2" />
              </CardHeader>
              <CardContent>
                <div className="space-y-2 mt-4">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                </div>
              </CardContent>
              <CardFooter>
                <Skeleton className="h-8 w-full" />
              </CardFooter>
            </Card>
          ))
        ) : data?.projects.length === 0 ? (
          <div className="col-span-full py-12 text-center font-mono text-muted-foreground bg-card border border-card-border rounded-md">
            No active protocols in the database.
          </div>
        ) : (
          data?.projects.map((project) => (
            <Card key={project.id} className="bg-card border-card-border shadow-none flex flex-col group hover:border-primary/50 transition-colors">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <CardTitle className="font-mono font-bold truncate pr-2 text-primary group-hover:text-primary">
                    {project.name}
                  </CardTitle>
                  <Badge variant="outline" className="font-mono text-[10px] uppercase rounded-sm border-primary/30">
                    Tier {project.tier}
                  </Badge>
                </div>
                <div className="text-xs font-mono text-muted-foreground truncate">
                  Funding: ${project.fundingAmount?.toLocaleString() || 0}
                </div>
              </CardHeader>
              <CardContent className="flex-1">
                <p className="text-sm text-muted-foreground line-clamp-3 mb-4">
                  {project.description || 'No data provided.'}
                </p>
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="bg-background/50 rounded p-2 border border-border">
                    <div className="text-muted-foreground mb-1 uppercase">Operators</div>
                    <div className="font-bold">{project.activeUserCount || 0}</div>
                  </div>
                  <div className="bg-background/50 rounded p-2 border border-border">
                    <div className="text-muted-foreground mb-1 uppercase">Tasks</div>
                    <div className="font-bold">{project.taskCount || 0}</div>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="pt-0 flex gap-2">
                <Link href={`/admin/projects/${project.id}`} className="flex-1">
                  <Button variant="outline" className="w-full font-mono text-xs uppercase bg-transparent border-card-border hover:bg-primary/10 hover:text-primary">
                    <Activity className="h-3 w-3 mr-2" /> Details
                  </Button>
                </Link>
                {project.websiteUrl && (
                  <Button variant="ghost" size="icon" className="border border-card-border hover:bg-primary/10 hover:text-primary" onClick={() => window.open(project.websiteUrl!, '_blank')}>
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                )}
              </CardFooter>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
