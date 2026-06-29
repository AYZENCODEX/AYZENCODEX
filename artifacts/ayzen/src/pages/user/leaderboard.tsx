import { useGetLeaderboard, useGetMe } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, Zap, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

const MEDAL_CONFIG: Record<number, { emoji: string; bg: string; text: string; border: string }> = {
  1: { emoji: "🥇", bg: "bg-yellow-500/10", text: "text-yellow-400", border: "border-yellow-500/30" },
  2: { emoji: "🥈", bg: "bg-slate-400/10", text: "text-slate-300", border: "border-slate-400/30" },
  3: { emoji: "🥉", bg: "bg-amber-700/10", text: "text-amber-600", border: "border-amber-700/30" },
};

export default function UserLeaderboard() {
  const { data, isLoading } = useGetLeaderboard({ period: "all", limit: 50 });
  const { data: me } = useGetMe();
  const myEntry = me && data ? data.find((e: any) => e.username === (me as any).username) : null;

  const top3 = (data ?? []).slice(0, 3);

  return (
    <div className="space-y-6 page-enter">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold font-mono tracking-tighter uppercase text-glow flex items-center gap-2">
            <Trophy className="h-6 w-6 text-yellow-400" /> Leaderboard
          </h1>
          <p className="text-muted-foreground font-mono text-sm">Global operator rankings — all time</p>
        </div>
        {myEntry && (
          <div className="flex items-center gap-2 px-3 py-2 bg-primary/5 border border-primary/20 rounded-lg">
            <TrendingUp className="w-3.5 h-3.5 text-primary" />
            <span className="font-mono text-xs">Your rank: <strong className="text-primary">#{myEntry.rank}</strong></span>
          </div>
        )}
      </div>

      {/* Podium top 3 */}
      {!isLoading && top3.length >= 3 && (
        <div className="grid grid-cols-3 gap-3 max-w-sm mx-auto">
          {[top3[1], top3[0], top3[2]].map((entry: any, idx) => {
            const rank = idx === 0 ? 2 : idx === 1 ? 1 : 3;
            const cfg = MEDAL_CONFIG[rank];
            const heights = ["h-24", "h-32", "h-20"];
            const isMe = (myEntry as any)?.userId === entry.userId;
            return (
              <div key={entry.userId} className={cn("flex flex-col items-center justify-end rounded-xl border p-3 transition-all", cfg.bg, cfg.border, heights[idx], isMe && "ring-2 ring-primary/30")}>
                <div className="text-2xl mb-1">{cfg.emoji}</div>
                <div className={cn("font-mono text-[10px] font-bold truncate max-w-full", cfg.text, isMe && "underline")}>{entry.username}</div>
                <div className="font-mono text-[9px] text-muted-foreground/60">${entry.totalRoi.toLocaleString()}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Full list */}
      <div className="border border-card-border rounded-xl bg-card overflow-hidden">
        <div className="divide-y divide-card-border">
          {isLoading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3">
                <Skeleton className="h-6 w-6 rounded-full" />
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-16 ml-auto" />
              </div>
            ))
          ) : !data || data.length === 0 ? (
            <div className="text-center py-12 font-mono text-muted-foreground/50">
              <Trophy className="w-8 h-8 mx-auto mb-3 opacity-20" />
              Rankings unavailable.
            </div>
          ) : (
            data.map((entry: any) => {
              const cfg = MEDAL_CONFIG[entry.rank as number];
              const isMe = (myEntry as any)?.userId === entry.userId;
              return (
                <div key={entry.userId} className={cn(
                  "flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors",
                  entry.rank <= 3 && cfg.bg,
                  isMe && "bg-primary/5 border-l-2 border-primary"
                )}>
                  <div className={cn("w-8 h-8 rounded-full flex items-center justify-center font-mono font-black text-sm border shrink-0", cfg ? cn(cfg.bg, cfg.text, cfg.border) : "border-border/30 text-muted-foreground/40")}>
                    {entry.rank <= 3 ? cfg.emoji : entry.rank}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={cn("font-mono text-sm font-bold truncate", entry.rank <= 3 ? cfg.text : "text-foreground", isMe && "text-primary")}>
                      {entry.username} {isMe && <span className="text-[9px] font-normal text-primary/60">(you)</span>}
                    </div>
                    <div className="font-mono text-[9px] text-muted-foreground/50">{entry.tasksCompleted} tasks</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-mono text-sm font-bold text-primary">${entry.totalRoi.toLocaleString()}</div>
                    <div className="font-mono text-[9px] text-muted-foreground/50 flex items-center justify-end gap-1">
                      <Zap className="w-2.5 h-2.5" />{entry.streak ?? 0}d
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
