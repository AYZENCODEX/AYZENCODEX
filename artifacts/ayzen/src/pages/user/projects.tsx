import { useState, useEffect, useRef } from "react";
import { useListProjects } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { Users, Wifi, WifiOff, Zap, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

// ─── Presence hook ────────────────────────────────────────────────────────────
function useProjectPresence() {
  const { token } = useAuth();
  const [online, setOnline] = useState<Record<number, number[]>>({});
  const [connected, setConnected] = useState(false);
  const esRef = useRef<EventSource | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmounted = useRef(false);

  const openES = (url: string, onMsg: (d: any) => void) => {
    if (esRef.current) esRef.current.close();
    const es = new EventSource(url);
    esRef.current = es;
    es.onopen = () => setConnected(true);
    es.addEventListener("presence_updated", (e: MessageEvent) => {
      try { const d = JSON.parse(e.data); onMsg(d); } catch {}
    });
    es.addEventListener("projects_updated", () => setConnected(c => c));
    let retries = 0;
    es.onerror = () => {
      setConnected(false);
      es.close();
      if (unmounted.current) return;
      const delay = Math.min(1000 * Math.pow(2, retries++), 30_000);
      retryRef.current = setTimeout(() => {
        if (!unmounted.current) openES(url, onMsg);
      }, delay);
    };
    return es;
  };

  useEffect(() => {
    unmounted.current = false;
    if (!token) return;
    const encodedToken = encodeURIComponent(token);
    openES(
      `${BASE}/api/events?token=${encodedToken}`,
      (d) => { if (d.projectId && d.online) setOnline(prev => ({ ...prev, [d.projectId]: d.online })); }
    );
    return () => {
      unmounted.current = true;
      if (retryRef.current) clearTimeout(retryRef.current);
      esRef.current?.close();
      setConnected(false);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return { online, connected };
}

const TIER_COLORS: Record<string, string> = {
  "1": "border-emerald-400/30 text-emerald-400",
  "2": "border-primary/30 text-primary",
  "3": "border-amber-400/30 text-amber-400",
  "4": "border-red-400/30 text-red-400",
};

const PROJECT_CATEGORIES = ["All", "DeFi", "NFT", "GameFi", "Layer2", "Testnet", "CEX", "Social", "Other"];

const CATEGORY_COLORS: Record<string, string> = {
  DeFi:    "text-cyan-400 border-cyan-400/20",
  NFT:     "text-purple-400 border-purple-400/20",
  GameFi:  "text-emerald-400 border-emerald-400/20",
  Layer2:  "text-blue-400 border-blue-400/20",
  Testnet: "text-orange-400 border-orange-400/20",
  CEX:     "text-amber-400 border-amber-400/20",
  Social:  "text-pink-400 border-pink-400/20",
  Other:   "text-muted-foreground border-border",
};

export default function UserProjects() {
  const { data, isLoading } = useListProjects({ limit: 200 });
  const { online, connected } = useProjectPresence();
  const [selectedCategory, setSelectedCategory] = useState("All");

  const allProjects = data?.projects ?? [];

  const filteredProjects = selectedCategory === "All"
    ? allProjects
    : allProjects.filter(p => ((p as any).category ?? "Other") === selectedCategory);

  const categoryCounts = PROJECT_CATEGORIES.reduce<Record<string, number>>((acc, cat) => {
    acc[cat] = cat === "All"
      ? allProjects.length
      : allProjects.filter(p => ((p as any).category ?? "Other") === cat).length;
    return acc;
  }, {});

  return (
    <div className="space-y-6 page-enter">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-mono tracking-tighter uppercase text-glow">
            Active Protocols
          </h1>
          <p className="text-muted-foreground font-mono text-sm mt-0.5">
            {allProjects.length} airdrop campaigns
          </p>
        </div>
        <div className={cn(
          "flex items-center gap-1.5 px-2.5 py-1 rounded border text-[10px] font-mono transition-all",
          connected
            ? "bg-emerald-400/10 border-emerald-400/20 text-emerald-400"
            : "bg-muted border-card-border text-muted-foreground"
        )}>
          {connected
            ? <Wifi className="w-3 h-3 animate-pulse" />
            : <WifiOff className="w-3 h-3" />}
          {connected ? "LIVE" : "OFFLINE"}
        </div>
      </div>

      {/* Category tabs */}
      <div className="overflow-x-auto -mx-1 px-1 pb-1">
        <div className="flex gap-1 min-w-max">
          {PROJECT_CATEGORIES.map(cat => {
            const count = categoryCounts[cat] ?? 0;
            const isActive = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-mono font-medium transition-all whitespace-nowrap border",
                  isActive
                    ? "bg-primary/15 border-primary/40 text-primary shadow-sm"
                    : "bg-card/50 border-border/40 text-muted-foreground hover:border-border hover:text-foreground"
                )}
              >
                {cat === "All" && <LayoutGrid className="w-3 h-3" />}
                {cat}
                {count > 0 && (
                  <span className={cn(
                    "text-[9px] font-mono px-1.5 py-0.5 rounded-full",
                    isActive
                      ? "bg-primary/20 text-primary"
                      : "bg-muted text-muted-foreground/60"
                  )}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Project grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 stagger-children">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="bg-card border-card-border shadow-none">
              <CardHeader className="pb-2"><Skeleton className="h-6 w-3/4" /></CardHeader>
              <CardContent><Skeleton className="h-16 w-full" /></CardContent>
            </Card>
          ))
        ) : filteredProjects.length === 0 ? (
          <div className="col-span-full py-16 text-center font-mono text-muted-foreground bg-card border border-card-border rounded-lg">
            <LayoutGrid className="w-8 h-8 mx-auto mb-3 opacity-20" />
            <p className="text-sm">No {selectedCategory !== "All" ? selectedCategory : ""} protocols available.</p>
            {selectedCategory !== "All" && (
              <button
                onClick={() => setSelectedCategory("All")}
                className="mt-2 text-xs text-primary hover:underline font-mono"
              >
                View all categories
              </button>
            )}
          </div>
        ) : (
          filteredProjects.map((project) => {
            const onlineCount = online[project.id]?.length ?? 0;
            const category = (project as any).category ?? "Other";
            const catColor = CATEGORY_COLORS[category] ?? CATEGORY_COLORS.Other;

            return (
              <Card
                key={project.id}
                className="bg-card border-card-border shadow-none hover:border-primary/40 transition-all flex flex-col card-lift"
              >
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <CardTitle className="font-mono font-bold text-primary truncate">
                        {project.name}
                      </CardTitle>
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        {/* Category badge */}
                        <Badge variant="outline" className={cn("font-mono text-[9px] uppercase rounded-sm", catColor)}>
                          {category}
                        </Badge>
                        {/* Tier badge */}
                        <Badge variant="outline" className={cn("font-mono text-[10px] uppercase rounded-sm", TIER_COLORS[String(project.tier)] ?? "border-card-border")}>
                          T{project.tier}
                        </Badge>
                        {/* Live users */}
                        {onlineCount > 0 && (
                          <div className="flex items-center gap-1 px-1.5 py-0.5 bg-emerald-400/10 border border-emerald-400/20 rounded text-[9px] font-mono text-emerald-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            {onlineCount}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="flex-1">
                  <p className="text-sm text-muted-foreground line-clamp-3 mb-4 leading-relaxed">
                    {project.description}
                  </p>
                  <div className="flex items-center justify-between text-xs font-mono">
                    <div>
                      <span className="text-muted-foreground">Est. Reward: </span>
                      <span className="text-primary font-bold">
                        ${project.rewardEstimate?.toLocaleString() || "TBA"}
                      </span>
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
                    <Button
                      variant="outline"
                      className="w-full font-mono uppercase text-xs border-primary/20 text-primary hover:bg-primary/10 gap-2 mobile-tap"
                    >
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
