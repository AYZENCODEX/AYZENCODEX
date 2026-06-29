import { useState, useEffect, useRef, useCallback } from "react";
import { useListProjects } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Link, useSearch } from "wouter";
import { Users, Wifi, WifiOff, Zap, LayoutGrid, Star, Clock, TrendingUp, ArrowLeftRight, FlaskConical, Timer, Globe, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

function daysRemaining(deadline: string | null | undefined) {
  if (!deadline) return null;
  const diff = new Date(deadline).getTime() - Date.now();
  if (diff < 0) return -1;
  return Math.ceil(diff / 86_400_000);
}

function DeadlineChip({ deadline }: { deadline?: string | null }) {
  const days = daysRemaining(deadline);
  if (days === null) return null;
  if (days < 0) return <span className="font-mono text-[9px] px-1.5 py-0.5 rounded border border-red-500/30 text-red-400 bg-red-500/5">ENDED</span>;
  if (days === 0) return <span className="font-mono text-[9px] px-1.5 py-0.5 rounded border border-red-500/40 text-red-400 bg-red-500/10 animate-pulse">LAST DAY</span>;
  if (days <= 3) return <span className="font-mono text-[9px] px-1.5 py-0.5 rounded border border-amber-500/30 text-amber-400 bg-amber-500/5">{days}d left</span>;
  if (days <= 7) return <span className="font-mono text-[9px] px-1.5 py-0.5 rounded border border-yellow-500/30 text-yellow-400 bg-yellow-500/5">{days}d left</span>;
  return <span className="font-mono text-[9px] px-1.5 py-0.5 rounded border border-border/40 text-muted-foreground/60">{days}d left</span>;
}

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

const PROJECT_CATEGORIES = ["All", "DeFi", "NFT", "GameFi", "Layer2", "Testnet", "CEX", "Exchange", "Instant Web3", "TGE", "Social", "Other"];

const CATEGORY_COLORS: Record<string, string> = {
  DeFi:          "text-cyan-400 border-cyan-400/20",
  NFT:           "text-purple-400 border-purple-400/20",
  GameFi:        "text-emerald-400 border-emerald-400/20",
  Layer2:        "text-blue-400 border-blue-400/20",
  Testnet:       "text-orange-400 border-orange-400/20",
  CEX:           "text-amber-400 border-amber-400/20",
  Exchange:      "text-yellow-400 border-yellow-400/20",
  "Instant Web3":"text-violet-400 border-violet-400/20",
  TGE:           "text-rose-400 border-rose-400/20",
  Social:        "text-pink-400 border-pink-400/20",
  Other:         "text-muted-foreground border-border",
};

const EXCHANGE_SUB_TYPES = [
  { id: "all",           label: "All Types" },
  { id: "candydrop",     label: "Candydrop" },
  { id: "candybomb",     label: "Candybomb" },
  { id: "booster",       label: "Booster" },
  { id: "trading_volume",label: "Trading Vol." },
];

const ACCOUNT_CATEGORIES = [
  { id: "all", label: "All Accounts" },
  { id: "new", label: "New Account" },
  { id: "old", label: "Old Account" },
];

const TYPE_META: Record<string, { title: string; desc: string; icon: React.ElementType; color: string }> = {
  exchange: { title: "Exchange Campaigns", desc: "Candydrop · Candybomb · Booster · Trading Volume", icon: ArrowLeftRight, color: "text-amber-400" },
  instant:  { title: "Instant Rewards",    desc: "Quick airdrop completion campaigns",              icon: Zap,             color: "text-violet-400" },
  web3:     { title: "Web3 Projects",      desc: "DeFi · NFT · GameFi · Decentralized protocols",  icon: Globe,           color: "text-blue-400" },
  testnet:  { title: "Testnet Programs",   desc: "Early network testing opportunities",             icon: FlaskConical,    color: "text-orange-400" },
  waitlist: { title: "Wait-list Programs", desc: "Whitelist and early access campaigns",            icon: Timer,           color: "text-rose-400" },
  protocol: { title: "Active Protocols",   desc: "Core airdrop campaigns",                         icon: LayoutGrid,      color: "text-primary" },
  "":       { title: "Active Protocols",   desc: "Core airdrop campaigns",                         icon: LayoutGrid,      color: "text-primary" },
};

function useBookmarks() {
  const { token } = useAuth();
  const [bookmarks, setBookmarks] = useState<Set<number>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem("ayzen_bookmarks") ?? "[]")); } catch { return new Set(); }
  });

  const toggle = useCallback((id: number) => {
    setBookmarks(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      localStorage.setItem("ayzen_bookmarks", JSON.stringify(Array.from(next)));
      return next;
    });
  }, []);

  return { bookmarks, toggle };
}

export default function UserProjects() {
  const rawSearch = useSearch();
  const typeParam = new URLSearchParams(rawSearch.startsWith("?") ? rawSearch.slice(1) : rawSearch).get("type") ?? "";
  const [selectedSubType, setSelectedSubType] = useState("all");
  const [selectedAccountCat, setSelectedAccountCat] = useState("all");

  const { data, isLoading } = useListProjects({ limit: 200 });
  const { online, connected } = useProjectPresence();
  const [selectedCategory, setSelectedCategory] = useState("All");
  const { bookmarks, toggle: toggleBookmark } = useBookmarks();
  const [showBookmarked, setShowBookmarked] = useState(false);

  // Reset sub-filters when type changes
  useEffect(() => { setSelectedSubType("all"); setSelectedAccountCat("all"); setSelectedCategory("All"); }, [typeParam]);

  const typeMeta = TYPE_META[typeParam] ?? TYPE_META[""];
  const allProjects = data?.projects ?? [];

  const filteredProjects = (() => {
    let list: any[] = [...allProjects];
    // Filter by project type from URL param
    if (typeParam && typeParam !== "protocol") {
      list = list.filter((p: any) => (p.project_type ?? "protocol") === typeParam);
    } else {
      list = list.filter((p: any) => !p.project_type || p.project_type === "protocol");
    }
    // Category filter
    if (selectedCategory !== "All") {
      list = list.filter((p: any) => ((p as any).category ?? "Other") === selectedCategory);
    }
    // Exchange-specific sub-type filter
    if (typeParam === "exchange" && selectedSubType !== "all") {
      list = list.filter((p: any) => (p.exchange_sub_type ?? "candydrop") === selectedSubType);
    }
    // Exchange-specific account category filter
    if (typeParam === "exchange" && selectedAccountCat !== "all") {
      list = list.filter((p: any) => p.account_category === selectedAccountCat || p.account_category === "both");
    }
    if (showBookmarked) list = list.filter((p: any) => bookmarks.has(p.id));
    const starred = list.filter((p: any) => bookmarks.has(p.id));
    const rest = list.filter((p: any) => !bookmarks.has(p.id));
    return [...starred, ...rest];
  })();

  const baseList = typeParam && typeParam !== "protocol"
    ? allProjects.filter((p: any) => (p.project_type ?? "protocol") === typeParam)
    : allProjects.filter((p: any) => !p.project_type || p.project_type === "protocol");

  const categoryCounts = PROJECT_CATEGORIES.reduce<Record<string, number>>((acc, cat) => {
    acc[cat] = cat === "All"
      ? baseList.length
      : baseList.filter((p: any) => ((p as any).category ?? "Other") === cat).length;
    return acc;
  }, {});

  return (
    <div className="space-y-6 page-enter">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className={cn("text-2xl font-bold font-mono tracking-tighter uppercase text-glow", typeMeta.color)}>
            {typeMeta.title}
          </h1>
          <p className="text-muted-foreground font-mono text-sm mt-0.5">
            {filteredProjects.length} campaigns{bookmarks.size > 0 && ` · ${bookmarks.size} starred`}
            {typeParam && <span className="ml-1 text-muted-foreground/50">· {typeMeta.desc}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowBookmarked(v => !v)}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[10px] font-mono transition-all",
              showBookmarked
                ? "bg-amber-400/10 border-amber-400/30 text-amber-400"
                : "border-border/40 text-muted-foreground hover:border-border hover:text-foreground"
            )}
          >
            <Star className={cn("w-3 h-3", showBookmarked && "fill-amber-400")} />
            Starred
          </button>
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
      </div>

      {/* Exchange-specific sub-filters */}
      {typeParam === "exchange" && (
        <div className="space-y-3 bg-amber-500/5 border border-amber-500/15 rounded-xl px-4 py-3">
          <div className="font-mono text-[9px] uppercase tracking-widest text-amber-400/70 font-bold">Exchange Filters</div>
          <div>
            <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/50 mb-1.5">Campaign Type</div>
            <div className="flex flex-wrap gap-1.5">
              {EXCHANGE_SUB_TYPES.map(sub => (
                <button key={sub.id} onClick={() => setSelectedSubType(sub.id)}
                  className={cn("px-3 py-1 rounded-full font-mono text-[10px] border transition-all",
                    selectedSubType === sub.id
                      ? "bg-amber-400/15 border-amber-400/40 text-amber-400 font-bold"
                      : "border-border/40 text-muted-foreground/60 hover:border-amber-400/30 hover:text-amber-400"
                  )}>
                  {sub.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/50 mb-1.5">Account Type</div>
            <div className="flex flex-wrap gap-1.5">
              {ACCOUNT_CATEGORIES.map(cat => (
                <button key={cat.id} onClick={() => setSelectedAccountCat(cat.id)}
                  className={cn("px-3 py-1 rounded-full font-mono text-[10px] border transition-all",
                    selectedAccountCat === cat.id
                      ? "bg-primary/15 border-primary/40 text-primary font-bold"
                      : "border-border/40 text-muted-foreground/60 hover:border-primary/30 hover:text-primary/60"
                  )}>
                  {cat.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

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
                      <div className="flex items-start justify-between gap-1">
                        <CardTitle className="font-mono font-bold text-primary truncate">
                          {project.name}
                        </CardTitle>
                        <button
                          onClick={e => { e.preventDefault(); toggleBookmark(project.id); }}
                          className={cn(
                            "flex-shrink-0 p-1 rounded transition-all",
                            bookmarks.has(project.id)
                              ? "text-amber-400 hover:text-amber-300"
                              : "text-muted-foreground/30 hover:text-amber-400"
                          )}
                          title={bookmarks.has(project.id) ? "Remove bookmark" : "Bookmark"}
                        >
                          <Star className={cn("w-3.5 h-3.5", bookmarks.has(project.id) && "fill-amber-400")} />
                        </button>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        {/* Category badge */}
                        <Badge variant="outline" className={cn("font-mono text-[9px] uppercase rounded-sm", catColor)}>
                          {category}
                        </Badge>
                        {/* Tier badge */}
                        <Badge variant="outline" className={cn("font-mono text-[10px] uppercase rounded-sm", TIER_COLORS[String(project.tier)] ?? "border-card-border")}>
                          T{project.tier}
                        </Badge>
                        {/* Deadline chip */}
                        <DeadlineChip deadline={(project as any).deadline} />
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
                  <p className="text-sm text-muted-foreground line-clamp-3 mb-3 leading-relaxed">
                    {project.description}
                  </p>
                  {/* Visual progress bar */}
                  {(project as any).completionPct !== undefined && (
                    <div className="mb-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground/50">Progress</span>
                        <span className="text-[9px] font-mono text-primary">{Math.round((project as any).completionPct ?? 0)}%</span>
                      </div>
                      <div className="h-1 bg-muted/30 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-primary/60 to-primary rounded-full transition-all duration-700"
                          style={{ width: `${Math.min(100, (project as any).completionPct ?? 0)}%` }}
                        />
                      </div>
                    </div>
                  )}
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
