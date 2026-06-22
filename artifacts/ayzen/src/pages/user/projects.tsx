import { useState, useEffect, useRef } from "react";
import { useListProjects } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { Users, Wifi, WifiOff, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

// ─── Presence hook ────────────────────────────────────────────────────────────
function useProjectPresence() {
  const { token } = useAuth();
  const [online, setOnline] = useState<Record<number, number[]>>({});
  const [connected, setConnected] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!token) return;
    const es = new EventSource(`${BASE}/api/events`);
    esRef.current = es;
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);

    const handler = (e: MessageEvent) => {
      try {
        const d = JSON.parse(e.data);
        if (d.projectId && d.online) {
          setOnline(prev => ({ ...prev, [d.projectId]: d.online }));
        }
      } catch {}
    };
    es.addEventListener("presence_updated", handler);

    return () => { es.close(); setConnected(false); };
  }, [token]);

  const joinProject = (projectId: number) => {
    if (esRef.current) {
      esRef.current.close();
    }
    const es = new EventSource(`${BASE}/api/events?projectId=${projectId}`);
    esRef.current = es;
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    es.addEventListener("presence_updated", (e: MessageEvent) => {
      try {
        const d = JSON.parse(e.data);
        if (d.projectId && d.online) {
          setOnline(prev => ({ ...prev, [d.projectId]: d.online }));
        }
      } catch {}
    });
  };

  return { online, connected, joinProject };
}

const TIER_COLORS: Record<string, string> = {
  "1": "border-emerald-400/30 text-emerald-400",
  "2": "border-primary/30 text-primary",
  "3": "border-amber-400/30 text-amber-400",
  "4": "border-red-400/30 text-red-400",
};

export default function UserProjects() {
  const { data, isLoading } = useListProjects({ limit: 50 });
  const { online, connected } = useProjectPresence();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-mono tracking-tighter uppercase">Active Protocols</h1>
          <p className="text-muted-foreground font-mono text-sm">Available airdrop campaigns and tracking targets</p>
        </div>
        <div className={cn(
          "flex items-center gap-1.5 px-2.5 py-1 rounded border text-[10px] font-mono",
          connected ? "bg-emerald-400/10 border-emerald-400/20 text-emerald-400" : "bg-muted border-card-border text-muted-foreground"
        )}>
          {connected ? <Wifi className="w-3 h-3 animate-pulse" /> : <WifiOff className="w-3 h-3" />}
          {connected ? "LIVE" : "OFFLINE"}
        </div>
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
          data.projects.map((project) => {
            const onlineCount = online[project.id]?.length ?? 0;
            return (
              <Card key={project.id} className="bg-card border-card-border shadow-none hover:border-primary/50 transition-colors flex flex-col group">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start gap-2">
                    <CardTitle className="font-mono font-bold text-primary truncate">{project.name}</CardTitle>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {onlineCount > 0 && (
                        <div className="flex items-center gap-1 px-1.5 py-0.5 bg-emerald-400/10 border border-emerald-400/20 rounded text-[9px] font-mono text-emerald-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          {onlineCount}
                        </div>
                      )}
                      <Badge variant="outline" className={cn("font-mono text-[10px] uppercase rounded-sm", TIER_COLORS[String(project.tier)] ?? "border-card-border")}>
                        T{project.tier}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex-1">
                  <p className="text-sm text-muted-foreground line-clamp-3 mb-4">{project.description}</p>
                  <div className="flex items-center justify-between text-xs font-mono">
                    <div>
                      <span className="text-muted-foreground">Est. Reward: </span>
                      <span className="text-primary font-bold">${project.rewardEstimate?.toLocaleString() || 'TBA'}</span>
                    </div>
                    {onlineCount > 0 && (
                      <div className="flex items-center gap-1 text-muted-foreground/60">
                        <Users className="w-3 h-3" />
                        <span>{onlineCount} online</span>
                      </div>
                    )}
                  </div>
                </CardContent>
                <CardFooter className="pt-0">
                  <Link href={`/projects/${project.id}`} className="w-full">
                    <Button variant="outline" className="w-full font-mono uppercase text-xs border-primary/20 text-primary hover:bg-primary/10 gap-2">
                      <Zap className="w-3 h-3" /> Access Terminal
                    </Button>
                  </Link>
                </CardFooter>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
