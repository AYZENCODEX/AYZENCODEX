import { useState, useCallback } from "react";
import { useListTasks, useGetMe } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Play, CheckCircle2, Clock, XCircle, Loader2,
  ExternalLink, Filter, Search, Zap, Trophy, Send,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

const STATUS_CONFIG = {
  approved:  { label: "Completed", icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
  pending:   { label: "Pending",   icon: Clock,        color: "text-amber-400",   bg: "bg-amber-500/10 border-amber-500/20" },
  rejected:  { label: "Rejected",  icon: XCircle,      color: "text-red-400",     bg: "bg-red-500/10 border-red-500/20" },
};

const TYPE_COLOR: Record<string, string> = {
  "One-time": "border-primary/30 text-primary",
  "Daily":    "border-violet-400/30 text-violet-400",
  "Weekly":   "border-amber-400/30 text-amber-400",
};

interface Task {
  id: number;
  name: string;
  description?: string | null;
  taskType: string;
  rewardAmount?: number | null;
  verificationType: string;
  projectName?: string | null;
  userStatus?: string | null;
}

function SubmitModal({ task, onClose, onDone }: {
  task: Task;
  onClose: () => void;
  onDone: () => void;
}) {
  const [proofUrl, setProofUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const token = localStorage.getItem("ayzen_token") ?? "";

  const submit = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/tasks/${task.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ proofUrl: proofUrl.trim() || undefined, notes: notes.trim() || undefined }),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.status === "approved") {
          toast({ title: "✅ Task auto-verified!", description: `Reward credited for "${task.name}"` });
        } else {
          toast({ title: "📨 Submitted for review", description: "Admin will verify your submission shortly." });
        }
        onDone();
      } else {
        toast({ variant: "destructive", title: "Submit failed", description: data.error ?? "Try again." });
      }
    } catch {
      toast({ variant: "destructive", title: "Connection error", description: "Could not reach server." });
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-card border border-card-border rounded-xl w-full max-w-md shadow-2xl relative">
        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-primary to-transparent opacity-60" />

        <div className="p-6 space-y-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Send className="w-4 h-4 text-primary" />
              <h2 className="font-mono font-bold text-sm uppercase tracking-wider text-primary">Execute Task</h2>
            </div>
            <p className="font-mono font-semibold text-foreground mt-2">{task.name}</p>
            {task.description && (
              <p className="text-xs font-mono text-muted-foreground mt-1 leading-relaxed">{task.description}</p>
            )}
          </div>

          <div className="flex gap-3">
            <Badge variant="outline" className={cn("font-mono text-[10px] uppercase", TYPE_COLOR[task.taskType] ?? "border-muted-foreground/30 text-muted-foreground")}>
              {task.taskType}
            </Badge>
            <Badge variant="outline" className="font-mono text-[10px] uppercase border-muted-foreground/30 text-muted-foreground">
              {task.verificationType === "auto" ? "⚡ Auto-verify" : "👤 Manual review"}
            </Badge>
            {task.rewardAmount && (
              <Badge className="font-mono text-[10px] bg-primary/10 text-primary border-primary/20 uppercase">
                ${task.rewardAmount} reward
              </Badge>
            )}
          </div>

          <div className="space-y-3">
            <div>
              <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5 block">
                Proof URL (screenshot / tx hash) — optional
              </label>
              <Input
                placeholder="https://... or 0x..."
                value={proofUrl}
                onChange={e => setProofUrl(e.target.value)}
                className="font-mono text-xs h-10 bg-input border-border focus-visible:ring-primary/50"
              />
            </div>
            <div>
              <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5 block">
                Notes — optional
              </label>
              <Textarea
                placeholder="Any notes for the reviewer..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                className="font-mono text-xs bg-input border-border focus-visible:ring-primary/50 resize-none"
              />
            </div>
          </div>

          {task.verificationType !== "auto" && (
            <p className="text-[10px] font-mono text-muted-foreground/60 bg-muted/30 rounded px-3 py-2">
              ℹ️ This task requires admin review. You'll be notified on Telegram when approved.
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <Button
              variant="outline"
              className="flex-1 font-mono text-xs h-10 border-border"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 font-mono text-xs h-10 gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={submit}
              disabled={loading}
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              {loading ? "Submitting..." : "Submit"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function UserTasks() {
  const queryClient = useQueryClient();
  const { data: me } = useGetMe();
  const { data, isLoading, refetch } = useListTasks({
    query: { queryKey: ["tasks", me?.id] },
  });
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "pending" | "completed" | "available">("all");
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const { toast } = useToast();

  const userId = me?.id;

  const tasks: Task[] = (Array.isArray(data) ? data : []) as Task[];

  const filtered = tasks.filter(t => {
    const q = search.toLowerCase();
    if (q && !t.name.toLowerCase().includes(q) && !(t.projectName ?? "").toLowerCase().includes(q)) return false;
    if (filter === "completed") return t.userStatus === "approved";
    if (filter === "pending")   return t.userStatus === "pending";
    if (filter === "available") return !t.userStatus;
    return true;
  });

  const counts = {
    all:       tasks.length,
    available: tasks.filter(t => !t.userStatus).length,
    pending:   tasks.filter(t => t.userStatus === "pending").length,
    completed: tasks.filter(t => t.userStatus === "approved").length,
  };

  const handleDone = useCallback(async () => {
    setActiveTask(null);
    await refetch();
    queryClient.invalidateQueries({ queryKey: ["me"] });
    queryClient.invalidateQueries({ queryKey: ["user-stats"] });
  }, [refetch, queryClient]);

  const handleExecute = (task: Task) => {
    if (task.userStatus === "approved") {
      toast({ title: "Already completed", description: "You already earned rewards for this task." });
      return;
    }
    if (task.userStatus === "pending") {
      toast({ title: "Under review", description: "Your submission is awaiting admin verification." });
      return;
    }
    setActiveTask(task);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold font-mono tracking-tighter uppercase">Task Center</h1>
          <p className="text-muted-foreground font-mono text-sm">Pending executions and active operations</p>
        </div>
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-400" />
          <span className="font-mono text-xs text-muted-foreground">
            <span className="text-emerald-400 font-bold">{counts.completed}</span> / {counts.all} completed
          </span>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {(["all", "available", "pending", "completed"] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "px-3 py-1.5 rounded text-[10px] font-mono uppercase tracking-wider transition-all border",
              filter === f
                ? "bg-primary/15 text-primary border-primary/30"
                : "text-muted-foreground border-muted/30 hover:border-muted-foreground/30"
            )}
          >
            {f} <span className="opacity-60">({counts[f]})</span>
          </button>
        ))}
        <div className="ml-auto relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
          <Input
            placeholder="Search tasks..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-7 h-8 w-44 text-xs font-mono bg-input border-border"
          />
        </div>
      </div>

      {/* Task list */}
      <div className="grid gap-3">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="bg-card border-card-border shadow-none">
              <CardContent className="p-5"><Skeleton className="h-14 w-full" /></CardContent>
            </Card>
          ))
        ) : filtered.length === 0 ? (
          <div className="py-14 text-center font-mono text-muted-foreground bg-card border border-card-border rounded-xl">
            <Filter className="w-8 h-8 mx-auto mb-3 opacity-30" />
            {search ? "No tasks match your search." : "No tasks in this category."}
          </div>
        ) : (
          filtered.map(task => {
            const statusCfg = task.userStatus ? STATUS_CONFIG[task.userStatus as keyof typeof STATUS_CONFIG] : null;
            const StatusIcon = statusCfg?.icon;
            const isDone = task.userStatus === "approved";
            const isPending = task.userStatus === "pending";

            return (
              <Card
                key={task.id}
                className={cn(
                  "bg-card border-card-border shadow-none transition-all duration-200",
                  isDone ? "opacity-70" : "hover:border-primary/40"
                )}
              >
                <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className={cn("font-mono font-bold truncate", isDone ? "text-muted-foreground line-through" : "text-foreground")}>
                        {task.name}
                      </h3>
                      <Badge variant="outline" className={cn("font-mono text-[10px] uppercase rounded-sm shrink-0", TYPE_COLOR[task.taskType] ?? "border-muted-foreground/30 text-muted-foreground")}>
                        {task.taskType}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="text-xs font-mono text-muted-foreground/70">{task.projectName ?? "General"}</p>
                      {task.verificationType === "auto" && (
                        <span className="text-[9px] font-mono text-emerald-400 uppercase tracking-wider flex items-center gap-0.5">
                          <Zap className="w-2.5 h-2.5" /> auto
                        </span>
                      )}
                    </div>
                    {task.description && (
                      <p className="text-[11px] font-mono text-muted-foreground/50 leading-relaxed line-clamp-1">{task.description}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-3 w-full sm:w-auto shrink-0">
                    {task.rewardAmount && (
                      <div className="text-right flex-1 sm:flex-none">
                        <div className="text-[9px] uppercase font-mono text-muted-foreground mb-0.5">Reward</div>
                        <div className="font-bold font-mono text-base text-primary">${task.rewardAmount}</div>
                      </div>
                    )}

                    {statusCfg && StatusIcon ? (
                      <div className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded border text-xs font-mono", statusCfg.bg, statusCfg.color)}>
                        <StatusIcon className="w-3.5 h-3.5" />
                        {statusCfg.label}
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        className="font-mono uppercase text-xs gap-2 bg-primary text-primary-foreground hover:bg-primary/90 h-9"
                        onClick={() => handleExecute(task)}
                      >
                        <Play className="h-3 w-3" /> Execute
                      </Button>
                    )}

                    {isPending && (
                      <button
                        className="text-[10px] font-mono text-muted-foreground hover:text-foreground underline"
                        onClick={() => setActiveTask(task)}
                        title="Resubmit"
                      >
                        Edit
                      </button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Submit modal */}
      {activeTask && (
        <SubmitModal
          task={activeTask}
          onClose={() => setActiveTask(null)}
          onDone={handleDone}
        />
      )}
    </div>
  );
}
