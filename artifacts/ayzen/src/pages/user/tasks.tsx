import { useState, useCallback } from "react";
import { useListTasks, useGetMe, useListVaultEntries } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Play, CheckCircle2, Clock, XCircle, Loader2,
  Filter, Search, Zap, Trophy, Send, DollarSign,
  Star, Settings2, Info, X,
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
  xpAmount?: number | null;
  cost?: number | null;
  profit?: number | null;
  taskCategory?: string | null;
  category?: string | null;
  deadline?: string | null;
  timeLimitMinutes?: number | null;
}

type SubmitTab = "details" | "cost-roi" | "points" | "settings";

function SubmitModal({ task, onClose, onDone }: {
  task: Task;
  onClose: () => void;
  onDone: () => void;
}) {
  const [tab, setTab] = useState<SubmitTab>("details");
  const [proofUrl, setProofUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [cost, setCost] = useState("");
  const [profit, setProfit] = useState("");
  const [selectedEntityIds, setSelectedEntityIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { data: vaultData } = useListVaultEntries();

  const token = localStorage.getItem("ayzen_token") ?? "";
  const vaultEntries = Array.isArray(vaultData) ? vaultData : [];

  const roi = profit && cost
    ? (((Number(profit) - Number(cost)) / Number(cost)) * 100).toFixed(1)
    : null;

  const toggleEntity = (id: number) => {
    setSelectedEntityIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const submit = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/tasks/${task.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          proofUrl: proofUrl.trim() || undefined,
          notes: notes.trim() || undefined,
          cost: cost ? Number(cost) : undefined,
          profit: profit ? Number(profit) : undefined,
          roi: roi ? Number(roi) : undefined,
          entityIds: selectedEntityIds.size > 0 ? [...selectedEntityIds] : undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.status === "approved") {
          toast({ title: "✅ Auto-verified!", description: `Reward credited for "${task.name}"` });
        } else {
          toast({ title: "📨 Submitted for review", description: "Admin will verify shortly." });
        }
        onDone();
      } else {
        toast({ variant: "destructive", title: "Submit failed", description: data.error ?? "Try again." });
      }
    } catch {
      toast({ variant: "destructive", title: "Connection error" });
    }
    setLoading(false);
  };

  const TABS: { id: SubmitTab; label: string; icon: React.ElementType }[] = [
    { id: "details",  label: "Details",   icon: Info },
    { id: "cost-roi", label: "Cost / ROI",icon: DollarSign },
    { id: "points",   label: "Points",    icon: Star },
    { id: "settings", label: "Settings",  icon: Settings2 },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-card border border-card-border rounded-xl w-full max-w-lg shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-primary to-transparent" />

        {/* Header */}
        <div className="px-5 pt-5 pb-0">
          <div className="flex items-start justify-between mb-1">
            <div className="flex items-center gap-2">
              <Send className="w-4 h-4 text-primary" />
              <span className="font-mono text-xs uppercase tracking-widest text-primary font-bold">Execute Task</span>
            </div>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="font-mono font-semibold text-foreground text-sm mt-1.5">{task.name}</p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            <Badge variant="outline" className={cn("font-mono text-[10px] uppercase", TYPE_COLOR[task.taskType] ?? "border-muted-foreground/30 text-muted-foreground")}>
              {task.taskType}
            </Badge>
            {task.taskCategory && (
              <Badge variant="outline" className="font-mono text-[10px] uppercase border-violet-400/30 text-violet-400">
                {task.taskCategory}
              </Badge>
            )}
            <Badge variant="outline" className="font-mono text-[10px] border-muted-foreground/30 text-muted-foreground">
              {task.verificationType === "auto" ? "⚡ Auto" : "👤 Manual"}
            </Badge>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border mt-4 px-5">
          {TABS.map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2.5 text-[10px] font-mono uppercase tracking-wider border-b-2 transition-all -mb-px",
                  tab === t.id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="w-3 h-3" />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        <div className="p-5 space-y-4 min-h-[200px]">

          {/* ── Details ─────────────────────────────────────────── */}
          {tab === "details" && (
            <>
              {task.description && (
                <p className="text-[11px] font-mono text-muted-foreground bg-muted/20 rounded px-3 py-2 leading-relaxed">
                  {task.description}
                </p>
              )}
              <div>
                <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5 block">
                  Proof URL / TX Hash — optional
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
                  placeholder="Notes for the reviewer..."
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={3}
                  className="font-mono text-xs bg-input border-border focus-visible:ring-primary/50 resize-none"
                />
              </div>

              {/* Vault entity multi-select */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    Select Entities — optional
                  </label>
                  {selectedEntityIds.size > 0 && (
                    <span className="text-[10px] font-mono text-primary">
                      {selectedEntityIds.size} selected
                    </span>
                  )}
                </div>
                {vaultEntries.length === 0 ? (
                  <p className="text-[10px] font-mono text-muted-foreground/50 py-2 text-center bg-muted/20 rounded border border-border">
                    No vault entities yet. Add entities in the Vault.
                  </p>
                ) : (
                  <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                    {vaultEntries.map((entry: any) => {
                      const serial = `AYZNA-${String(entry.id).padStart(4, "0")}`;
                      const selected = selectedEntityIds.has(entry.id);
                      return (
                        <button
                          key={entry.id}
                          type="button"
                          onClick={() => toggleEntity(entry.id)}
                          className={cn(
                            "w-full flex items-center gap-2.5 px-3 py-2 rounded border text-left transition-all",
                            selected
                              ? "bg-primary/10 border-primary/40 text-primary"
                              : "bg-muted/20 border-border/40 text-muted-foreground hover:border-border hover:text-foreground"
                          )}
                        >
                          <div className={cn(
                            "w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-all",
                            selected ? "bg-primary border-primary" : "border-border/60"
                          )}>
                            {selected && <span className="text-primary-foreground text-[8px] font-bold">✓</span>}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-mono text-[11px] font-medium truncate">
                              {entry.projectName || serial}
                            </div>
                            <div className="font-mono text-[9px] text-muted-foreground/60 truncate">
                              {serial} · {entry.category ?? "General"}
                              {entry.twitterUsername && ` · @${entry.twitterUsername}`}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
                {selectedEntityIds.size > 1 && (
                  <p className="text-[10px] font-mono text-muted-foreground/60 mt-1.5">
                    {selectedEntityIds.size} entities will be included in this submission
                  </p>
                )}
              </div>
            </>
          )}

          {/* ── Cost / ROI ──────────────────────────────────────── */}
          {tab === "cost-roi" && (
            <>
              <p className="text-[11px] font-mono text-muted-foreground">
                Track your spending and earnings for this task. Used in your ROI dashboard.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5 block">
                    Cost ($)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono text-xs">$</span>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={cost}
                      onChange={e => setCost(e.target.value)}
                      className="font-mono text-xs h-10 bg-input border-border focus-visible:ring-primary/50 pl-6"
                    />
                  </div>
                </div>
                <div>
                  <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5 block">
                    Profit / Return ($)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono text-xs">$</span>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={profit}
                      onChange={e => setProfit(e.target.value)}
                      className="font-mono text-xs h-10 bg-input border-border focus-visible:ring-primary/50 pl-6"
                    />
                  </div>
                </div>
              </div>

              {/* ROI auto-calc */}
              <div className={cn(
                "rounded-lg border p-4 text-center transition-all",
                roi
                  ? Number(roi) >= 0 ? "border-emerald-500/20 bg-emerald-500/5" : "border-red-500/20 bg-red-500/5"
                  : "border-border bg-muted/20"
              )}>
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
                  Calculated ROI
                </div>
                <div className={cn(
                  "font-mono text-3xl font-bold",
                  roi
                    ? Number(roi) >= 0 ? "text-emerald-400" : "text-red-400"
                    : "text-muted-foreground/40"
                )}>
                  {roi ? `${Number(roi) >= 0 ? "+" : ""}${roi}%` : "—"}
                </div>
                {cost && profit && (
                  <div className="font-mono text-[10px] text-muted-foreground mt-1">
                    Net: ${(Number(profit) - Number(cost)).toFixed(2)}
                  </div>
                )}
              </div>
              <p className="text-[10px] font-mono text-muted-foreground/50">
                These figures are stored privately and used to calculate your total platform ROI.
              </p>
            </>
          )}

          {/* ── Points ──────────────────────────────────────────── */}
          {tab === "points" && (
            <>
              <p className="text-[11px] font-mono text-muted-foreground">
                Rewards you'll earn upon successful verification of this task.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 text-center">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">XP Points</div>
                  <div className="font-mono text-2xl font-bold text-primary">
                    {task.xpAmount ? `+${task.xpAmount}` : "—"}
                  </div>
                  <div className="font-mono text-[10px] text-muted-foreground/60 mt-1">XP</div>
                </div>
                <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-4 text-center">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Reward</div>
                  <div className="font-mono text-2xl font-bold text-amber-400">
                    {task.rewardAmount ? `$${task.rewardAmount}` : "—"}
                  </div>
                  <div className="font-mono text-[10px] text-muted-foreground/60 mt-1">USD</div>
                </div>
              </div>

              <div className="bg-muted/20 border border-border rounded-lg p-4 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wide">Task Category</span>
                  <Badge variant="outline" className="font-mono text-[10px] border-violet-400/30 text-violet-400">
                    {task.taskCategory ?? task.category ?? "General"}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wide">Type</span>
                  <span className="font-mono text-[10px] text-foreground">{task.taskType}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wide">Verification</span>
                  <span className="font-mono text-[10px] text-foreground">
                    {task.verificationType === "auto" ? "⚡ Automatic" : "👤 Manual review"}
                  </span>
                </div>
              </div>
            </>
          )}

          {/* ── Settings ────────────────────────────────────────── */}
          {tab === "settings" && (
            <>
              <p className="text-[11px] font-mono text-muted-foreground">
                Task configuration and constraints set by the admin.
              </p>
              <div className="bg-muted/20 border border-border rounded-lg divide-y divide-border">
                {[
                  { label: "Task ID", value: `#${task.id}` },
                  { label: "Project", value: task.projectName ?? "General" },
                  { label: "Task Category", value: task.taskCategory ?? task.category ?? "—" },
                  { label: "Task Type", value: task.taskType },
                  { label: "Verification", value: task.verificationType === "auto" ? "Automatic" : "Manual review" },
                  { label: "Time Limit", value: task.timeLimitMinutes ? `${task.timeLimitMinutes} min` : "No limit" },
                  { label: "Deadline", value: task.deadline ? new Date(task.deadline).toLocaleDateString() : "None" },
                ].map(row => (
                  <div key={row.label} className="flex justify-between items-center px-4 py-2.5">
                    <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wide">{row.label}</span>
                    <span className="font-mono text-[10px] text-foreground">{row.value}</span>
                  </div>
                ))}
              </div>
              {task.verificationType !== "auto" && (
                <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg px-4 py-3">
                  <p className="font-mono text-[10px] text-amber-400">
                    ℹ️ Manual review required. You'll receive a notification when the admin approves your submission.
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border px-5 py-4 flex gap-3">
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
            {loading ? "Submitting…" : "Submit Task"}
          </Button>
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
                      {task.taskCategory && (
                        <Badge variant="outline" className="font-mono text-[10px] uppercase rounded-sm shrink-0 border-violet-400/30 text-violet-400">
                          {task.taskCategory}
                        </Badge>
                      )}
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
                    {(task.rewardAmount || task.xpAmount) && (
                      <div className="text-right flex-1 sm:flex-none">
                        {task.rewardAmount && (
                          <>
                            <div className="text-[9px] uppercase font-mono text-muted-foreground mb-0.5">Reward</div>
                            <div className="font-bold font-mono text-base text-primary">${task.rewardAmount}</div>
                          </>
                        )}
                        {task.xpAmount && (
                          <div className="font-mono text-[10px] text-muted-foreground/60">+{task.xpAmount} XP</div>
                        )}
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
