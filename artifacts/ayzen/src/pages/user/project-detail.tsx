import { useState, useEffect, useCallback, useRef } from "react";
import { useGetProject, useListVaultEntries } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft, ExternalLink, UserPlus, Hash, CheckCircle2, Clock, Twitter,
  MessageCircle, Wallet, Trash2, ChevronRight, Zap, Link2, Plus,
  LayoutDashboard, ListTodo, Users, Settings, DollarSign, TrendingUp,
  TrendingDown, AlertCircle, Shield, Copy, Check, Edit3, Globe, Star,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { TaskCategoryBadge } from "@/components/ui/task-category-badge";
import { CountdownTimer } from "@/components/ui/countdown-timer";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Task {
  id: number; name: string; description?: string;
  rewardAmount?: number; verificationType: string; taskType: string;
  cost: number; profit: number; completionCount: number;
  userStatus?: string | null;
  taskCategory?: string; category?: string;
  deadline?: string | null; timeLimitMinutes?: number | null;
}

interface EntityTaskStatus {
  taskId: number; taskName: string; taskType: string;
  rewardAmount?: number; cost: number; profit: number;
  status: string | null;
}

interface EntityWithTasks {
  enrollmentId: number; vaultEntryId: number;
  entitySerial?: string; entityName?: string;
  category?: string; email?: string;
  twitterUsername?: string; discordUsername?: string;
  status: string; tasks: EntityTaskStatus[];
  completedTasks: number; totalTasks: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function copyText(text: string) {
  navigator.clipboard.writeText(text).catch(() => {});
}

function CopyId({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { copyText(value); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground/60 hover:text-primary transition-colors"
    >
      {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
      <span className={copied ? "text-emerald-400" : ""}>{value}</span>
    </button>
  );
}

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-[9px] font-mono text-muted-foreground/40 uppercase">—</span>;
  const cfg: Record<string, string> = {
    approved: "text-emerald-400 border-emerald-400/30 bg-emerald-400/5",
    completed: "text-emerald-400 border-emerald-400/30 bg-emerald-400/5",
    pending: "text-yellow-400 border-yellow-400/30 bg-yellow-400/5",
    rejected: "text-red-400 border-red-400/30 bg-red-400/5",
  };
  return (
    <Badge variant="outline" className={cn("text-[9px] font-mono", cfg[status] ?? "")}>
      {status}
    </Badge>
  );
}

// ─── Task Submit Dialog ───────────────────────────────────────────────────────
function TaskSubmitDialog({
  task, projectId, onDone, token,
}: {
  task: Task; projectId: number; onDone: () => void; token: string;
}) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [proofUrl, setProofUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [cost, setCost] = useState("");
  const [profit, setProfit] = useState("");
  const { toast } = useToast();

  const isDone = task.userStatus === "approved" || task.userStatus === "completed" || task.userStatus === "pending";

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`${BASE}/api/tasks/${task.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          proofUrl: proofUrl || undefined,
          notes: notes || undefined,
          cost: Number(cost) || 0,
          profit: Number(profit) || 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast({ variant: "destructive", title: data.error || "Submission failed" }); return; }
      toast({ title: "Task submitted!", description: task.verificationType === "auto" ? "Auto-approved!" : "Pending admin review." });
      setOpen(false);
      onDone();
    } catch {
      toast({ variant: "destructive", title: "Network error" });
    } finally { setSubmitting(false); }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "flex-1 flex items-center justify-between px-4 py-3 hover:bg-muted/10 transition-colors text-left group",
        )}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className={cn("flex-shrink-0", isDone ? "text-emerald-400" : "text-muted-foreground/40")}>
            {isDone ? <CheckCircle2 className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-sm font-medium truncate">{task.name}</span>
              <TaskCategoryBadge category={task.taskCategory ?? task.category ?? "B1"} />
            </div>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className="text-[9px] font-mono text-muted-foreground/50 uppercase">{task.taskType} · {task.verificationType}</span>
              {task.rewardAmount ? <span className="text-[9px] font-mono text-primary font-bold">${task.rewardAmount}</span> : null}
              {task.cost > 0 && <span className="text-[9px] font-mono text-red-400">Cost: ${task.cost}</span>}
              {task.profit > 0 && <span className="text-[9px] font-mono text-emerald-400">Profit: ${task.profit}</span>}
            </div>
            {task.deadline && <CountdownTimer deadline={task.deadline} compact className="mt-1" />}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <StatusBadge status={task.userStatus ?? null} />
          {!isDone && <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-primary transition-colors" />}
        </div>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-card border-card-border max-w-md">
          <DialogHeader>
            <DialogTitle className="font-mono uppercase tracking-wider text-primary flex items-center gap-2">
              <ListTodo className="w-4 h-4" /> Submit Task
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div>
              <div className="font-mono font-bold text-sm">{task.name}</div>
              {task.description && <p className="text-xs font-mono text-muted-foreground mt-1 leading-relaxed">{task.description}</p>}
            </div>

            <div className="space-y-1">
              <Label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <Link2 className="w-2.5 h-2.5" /> Proof URL (optional)
              </Label>
              <Input value={proofUrl} onChange={e => setProofUrl(e.target.value)} className="font-mono text-xs h-8 bg-input" placeholder="https://..." />
            </div>

            <div className="space-y-1">
              <Label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Notes (optional)</Label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} className="font-mono text-xs bg-input min-h-[55px] resize-none" placeholder="Any additional notes..." />
            </div>

            {/* Cost & Profit */}
            <div className="p-3 rounded-lg bg-primary/3 border border-primary/10 space-y-2">
              <div className="flex items-center gap-1.5">
                <DollarSign className="w-3 h-3 text-primary/60" />
                <span className="font-mono text-[10px] uppercase tracking-wider text-primary/70 font-bold">Cost & Profit Tracking</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="font-mono text-[9px] uppercase tracking-wider text-red-400/70 flex items-center gap-1">
                    <TrendingDown className="w-2.5 h-2.5" /> Cost ($)
                  </Label>
                  <Input value={cost} onChange={e => setCost(e.target.value)} type="number" className="font-mono text-xs h-8 bg-input" placeholder="0.00" />
                </div>
                <div className="space-y-1">
                  <Label className="font-mono text-[9px] uppercase tracking-wider text-emerald-400/70 flex items-center gap-1">
                    <TrendingUp className="w-2.5 h-2.5" /> Profit ($)
                  </Label>
                  <Input value={profit} onChange={e => setProfit(e.target.value)} type="number" className="font-mono text-xs h-8 bg-input" placeholder="0.00" />
                </div>
              </div>
              {Number(cost) > 0 || Number(profit) > 0 ? (
                <div className={cn(
                  "text-[10px] font-mono font-bold flex items-center gap-1.5",
                  Number(profit) - Number(cost) >= 0 ? "text-emerald-400" : "text-red-400"
                )}>
                  <Star className="w-3 h-3" />
                  Net: {Number(profit) - Number(cost) >= 0 ? "+" : ""}${(Number(profit) - Number(cost)).toFixed(2)}
                </div>
              ) : null}
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} className="font-mono text-xs">Cancel</Button>
            <Button onClick={handleSubmit} disabled={submitting || isDone} className="font-mono text-xs uppercase tracking-wider gap-2">
              {submitting ? <span className="animate-pulse">Submitting...</span> : <><CheckCircle2 className="w-3.5 h-3.5" /> Mark Complete</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Create Task Dialog ───────────────────────────────────────────────────────
function CreateTaskDialog({ projectId, token, onCreated }: { projectId: number; token: string; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", rewardAmount: "", verificationType: "manual", taskType: "One-time", cost: "", profit: "" });
  const { toast } = useToast();
  const fv = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm(p => ({ ...p, [k]: e.target.value }));

  const handleCreate = async () => {
    if (!form.name.trim()) { toast({ variant: "destructive", title: "Task name required" }); return; }
    setSaving(true);
    try {
      const res = await fetch(`${BASE}/api/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          projectId, name: form.name.trim(),
          description: form.description || undefined,
          rewardAmount: Number(form.rewardAmount) || undefined,
          verificationType: form.verificationType, taskType: form.taskType,
          cost: Number(form.cost) || 0, profit: Number(form.profit) || 0,
        }),
      });
      if (!res.ok) { toast({ variant: "destructive", title: "Failed to create task" }); return; }
      toast({ title: "Task created!" });
      setOpen(false);
      setForm({ name: "", description: "", rewardAmount: "", verificationType: "manual", taskType: "One-time", cost: "", profit: "" });
      onCreated();
    } catch { toast({ variant: "destructive", title: "Network error" }); }
    finally { setSaving(false); }
  };

  return (
    <>
      <Button size="sm" className="font-mono text-[10px] uppercase tracking-wider gap-1.5 h-8" onClick={() => setOpen(true)}>
        <Plus className="w-3.5 h-3.5" /> Add Task
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-card border-card-border max-w-md">
          <DialogHeader>
            <DialogTitle className="font-mono uppercase tracking-wider text-primary flex items-center gap-2">
              <Plus className="w-4 h-4" /> New Task
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1">
              <Label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Task Name *</Label>
              <Input value={form.name} onChange={fv("name")} className="font-mono text-xs h-8 bg-input" placeholder="e.g. Follow on Twitter" />
            </div>
            <div className="space-y-1">
              <Label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Description</Label>
              <Textarea value={form.description} onChange={fv("description")} className="font-mono text-xs bg-input min-h-[55px] resize-none" placeholder="Task instructions..." />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Type</Label>
                <Select value={form.taskType} onValueChange={v => setForm(p => ({ ...p, taskType: v }))}>
                  <SelectTrigger className="font-mono text-xs h-8 bg-input">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["One-time", "Daily", "Weekly"].map(t => <SelectItem key={t} value={t} className="font-mono text-xs">{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Verify</Label>
                <Select value={form.verificationType} onValueChange={v => setForm(p => ({ ...p, verificationType: v }))}>
                  <SelectTrigger className="font-mono text-xs h-8 bg-input">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual" className="font-mono text-xs">Manual</SelectItem>
                    <SelectItem value="auto" className="font-mono text-xs">Auto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="p-3 rounded-lg bg-primary/3 border border-primary/10 space-y-2">
              <span className="font-mono text-[10px] uppercase tracking-wider text-primary/70 font-bold">Cost & Profit</span>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Reward ($)</Label>
                  <Input value={form.rewardAmount} onChange={fv("rewardAmount")} type="number" className="font-mono text-xs h-8 bg-input" placeholder="0" />
                </div>
                <div className="space-y-1">
                  <Label className="font-mono text-[9px] uppercase tracking-wider text-red-400/70">Cost ($)</Label>
                  <Input value={form.cost} onChange={fv("cost")} type="number" className="font-mono text-xs h-8 bg-input" placeholder="0" />
                </div>
                <div className="space-y-1">
                  <Label className="font-mono text-[9px] uppercase tracking-wider text-emerald-400/70">Profit ($)</Label>
                  <Input value={form.profit} onChange={fv("profit")} type="number" className="font-mono text-xs h-8 bg-input" placeholder="0" />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} className="font-mono text-xs">Cancel</Button>
            <Button onClick={handleCreate} disabled={saving} className="font-mono text-xs uppercase gap-2">
              {saving ? "Creating..." : <><Plus className="w-3.5 h-3.5" /> Create Task</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function UserProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const projectId = parseInt(id || "0", 10);
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"dashboard" | "tasks" | "entities" | "settings">("dashboard");

  const { data: project, isLoading, refetch: refetchProject } = useGetProject(projectId, {
    query: { enabled: !!projectId, queryKey: ["project", projectId] },
  });
  const { data: vaultEntries } = useListVaultEntries();

  // ── SSE live refresh for this project ──────────────────────────────────────
  const sseRef = useRef<EventSource | null>(null);
  const sseRetry = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sseRetries = useRef(0);

  useEffect(() => {
    if (!projectId) return;
    let unmounted = false;

    const connect = () => {
      if (unmounted) return;
      const tok = localStorage.getItem("ayzen_token") ?? "";
      const url = `${BASE}/api/events?projectId=${projectId}&token=${encodeURIComponent(tok)}`;
      const es = new EventSource(url);
      sseRef.current = es;

      const refresh = () => { refetchProject(); };
      const refreshEntity = () => { if (activeTab === "entities") loadEntityData(); };

      es.addEventListener("tasks_updated", refresh);
      es.addEventListener("submissions_updated", () => { refresh(); refreshEntity(); });
      es.addEventListener("projects_updated", refresh);
      es.addEventListener("presence_updated", () => {}); // handled by presence bar if needed

      es.onerror = () => {
        es.close();
        sseRef.current = null;
        if (unmounted) return;
        const delay = Math.min(1000 * Math.pow(2, sseRetries.current++), 30_000);
        sseRetry.current = setTimeout(connect, delay);
      };

      es.addEventListener("connected", () => { sseRetries.current = 0; });
    };

    connect();

    return () => {
      unmounted = true;
      if (sseRetry.current) clearTimeout(sseRetry.current);
      sseRef.current?.close();
      sseRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const token = localStorage.getItem("ayzen_token") || "";
  const xpName = (project as any)?.xpName;
  const tasks: Task[] = (project as any)?.tasks ?? [];

  // Enrollments
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [loadingEnroll, setLoadingEnroll] = useState<number | null>(null);

  // Entity tasks (for Entities tab)
  const [entityData, setEntityData] = useState<{ tasks: any[]; entities: EntityWithTasks[] } | null>(null);
  const [loadingEntityData, setLoadingEntityData] = useState(false);

  // Settings form
  const [settingsForm, setSettingsForm] = useState<any>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [deletingProject, setDeletingProject] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const loadEnrollments = useCallback(async () => {
    try {
      const res = await fetch(`${BASE}/api/projects/${projectId}/enrollments`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setEnrollments(await res.json());
    } catch {}
  }, [projectId, token]);

  const loadEntityData = useCallback(async () => {
    setLoadingEntityData(true);
    try {
      const res = await fetch(`${BASE}/api/projects/${projectId}/entity-tasks`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setEntityData(await res.json());
    } catch {} finally { setLoadingEntityData(false); }
  }, [projectId, token]);

  useEffect(() => { loadEnrollments(); }, [loadEnrollments]);

  useEffect(() => {
    if (activeTab === "entities") loadEntityData();
  }, [activeTab, loadEntityData]);

  useEffect(() => {
    if (project && !settingsForm) {
      setSettingsForm({
        name: (project as any).name ?? "",
        description: (project as any).description ?? "",
        xpName: (project as any).xpName ?? "",
        websiteUrl: (project as any).websiteUrl ?? "",
        twitterHandle: (project as any).twitterHandle ?? "",
        discordUrl: (project as any).discordUrl ?? "",
        tier: (project as any).tier ?? "1",
        fundingAmount: (project as any).fundingAmount ?? 0,
        rewardEstimate: (project as any).rewardEstimate ?? 0,
        experienceLevel: (project as any).experienceLevel ?? "Beginner",
      });
    }
  }, [project, settingsForm]);

  const handleEnroll = async (vaultEntryId: number) => {
    setLoadingEnroll(vaultEntryId);
    try {
      const res = await fetch(`${BASE}/api/projects/${projectId}/enroll`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ vaultEntryId }),
      });
      const data = await res.json();
      if (!res.ok) { toast({ variant: "destructive", title: data.error || "Enrollment failed" }); return; }
      toast({ title: "Entity enrolled!" });
      await loadEnrollments();
    } catch { toast({ variant: "destructive", title: "Network error" }); }
    finally { setLoadingEnroll(null); }
  };

  const handleUnenroll = async (enrollmentId: number) => {
    try {
      await fetch(`${BASE}/api/projects/${projectId}/enrollments/${enrollmentId}`, {
        method: "DELETE", headers: { Authorization: `Bearer ${token}` },
      });
      setEnrollments(e => e.filter(x => x.id !== enrollmentId));
      toast({ title: "Entity removed from project" });
    } catch { toast({ variant: "destructive", title: "Failed to remove" }); }
  };

  const handleSaveSettings = async () => {
    if (!settingsForm) return;
    setSavingSettings(true);
    try {
      const res = await fetch(`${BASE}/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(settingsForm),
      });
      if (!res.ok) { toast({ variant: "destructive", title: "Save failed" }); return; }
      toast({ title: "Project settings saved!" });
      refetchProject();
    } catch { toast({ variant: "destructive", title: "Network error" }); }
    finally { setSavingSettings(false); }
  };

  const handleDeleteProject = async () => {
    setDeletingProject(true);
    try {
      await fetch(`${BASE}/api/projects/${projectId}`, {
        method: "DELETE", headers: { Authorization: `Bearer ${token}` },
      });
      toast({ title: "Project deleted" });
      window.location.href = `${BASE}/projects`;
    } catch { toast({ variant: "destructive", title: "Delete failed" }); }
    finally { setDeletingProject(false); setDeleteConfirmOpen(false); }
  };

  const enrolledIds = new Set(enrollments.map((e: any) => e.vaultEntryId));
  const completedTasks = tasks.filter(t => t.userStatus === "approved" || t.userStatus === "completed").length;
  const progress = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;

  const TABS = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "tasks", label: "Tasks", icon: ListTodo },
    { id: "entities", label: "Entities", icon: Users },
    { id: "settings", label: "Settings", icon: Settings },
  ] as const;

  if (isLoading) return (
    <div className="space-y-6 page-enter">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-32 w-full" />
    </div>
  );

  if (!project) return (
    <div className="py-20 text-center font-mono text-muted-foreground">
      Project not found.{" "}
      <Link href="/projects" className="text-primary hover:underline">Back to projects</Link>
    </div>
  );

  const sf = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setSettingsForm((p: any) => ({ ...p, [k]: e.target.value }));

  return (
    <div className="space-y-4 page-enter">
      {/* ── Header ── */}
      <div className="flex items-start gap-3">
        <Link href="/projects">
          <Button variant="ghost" size="icon" className="h-8 w-8 mt-0.5 flex-shrink-0"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold font-mono tracking-tighter uppercase truncate">
              {(project as any).name}
            </h1>
            {xpName && (
              <Badge variant="outline" className="font-mono text-[10px] border-yellow-500/30 text-yellow-400 bg-yellow-400/5 flex items-center gap-1 flex-shrink-0">
                <Zap className="w-2.5 h-2.5" />{xpName}
              </Badge>
            )}
            <Badge variant="outline" className="font-mono text-[9px] border-primary/20 text-primary/60 flex-shrink-0">
              T{(project as any).tier}
            </Badge>
          </div>
          {/* Project ID */}
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <CopyId value={`#PRJ-${String(projectId).padStart(4, "0")}`} />
            <span className="text-[10px] font-mono text-muted-foreground/40">·</span>
            <span className="text-[10px] font-mono text-muted-foreground/50">{enrollments.length} entit{enrollments.length !== 1 ? "ies" : "y"} enrolled</span>
            {tasks.length > 0 && (
              <>
                <span className="text-[10px] font-mono text-muted-foreground/40">·</span>
                <span className="text-[10px] font-mono text-primary/60 font-bold">{completedTasks}/{tasks.length} tasks done</span>
              </>
            )}
          </div>
        </div>
        <Button
          onClick={() => setEnrollOpen(true)}
          className="font-mono text-xs gap-2 uppercase flex-shrink-0" size="sm"
        >
          <UserPlus className="w-3.5 h-3.5" /> Enroll Entity
        </Button>
      </div>

      {/* ── Progress bar (always visible) ── */}
      {tasks.length > 0 && (
        <div className="bg-card border border-card-border rounded-xl px-4 py-3 flex items-center gap-4">
          <div className="flex-1 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Overall Progress</span>
              <span className="font-mono text-sm font-bold text-primary">{progress}%</span>
            </div>
            <Progress value={progress} className="h-1.5" />
          </div>
          <div className="text-right">
            <div className="font-mono text-xs font-bold">{completedTasks}/{tasks.length}</div>
            <div className="font-mono text-[9px] text-muted-foreground/50">tasks done</div>
          </div>
        </div>
      )}

      {/* ── Tab Nav ── */}
      <div className="flex gap-0.5 p-1 bg-muted/20 rounded-xl border border-border/30 w-fit">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-[10px] uppercase tracking-wider transition-all",
              activeTab === tab.id
                ? "bg-card text-primary font-bold shadow-sm border border-border/40"
                : "text-muted-foreground/50 hover:text-muted-foreground"
            )}
          >
            <tab.icon className="w-3 h-3" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* ── TAB: DASHBOARD ── */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "dashboard" && (
        <div className="space-y-4">
          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Est. Reward", value: `$${(project as any).rewardEstimate?.toLocaleString() ?? 0}`, color: "text-primary" },
              { label: "Funding", value: `$${(project as any).fundingAmount?.toLocaleString() ?? 0}`, color: "text-muted-foreground" },
              { label: "Members", value: (project as any).activeUserCount ?? 0, color: "text-cyan-400" },
              { label: "Total Tasks", value: tasks.length, color: "text-purple-400" },
            ].map(s => (
              <div key={s.label} className="bg-card border border-card-border rounded-xl p-4">
                <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground/50 mb-1">{s.label}</div>
                <div className={cn("font-mono text-xl font-bold", s.color)}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Description */}
          <div className="bg-card border border-card-border rounded-xl p-4">
            <div className="font-mono text-[10px] uppercase tracking-wider text-primary/60 mb-2">Protocol Intel</div>
            <p className="font-mono text-sm text-muted-foreground leading-relaxed">
              {(project as any).description || "No description available."}
            </p>
          </div>

          {/* Links */}
          <div className="bg-card border border-card-border rounded-xl p-4 space-y-2">
            <div className="font-mono text-[10px] uppercase tracking-wider text-primary/60 mb-2">Links</div>
            {(project as any).websiteUrl && (
              <a href={(project as any).websiteUrl} target="_blank" rel="noreferrer"
                className="flex items-center gap-2 text-xs font-mono text-muted-foreground hover:text-primary transition-colors">
                <Globe className="w-3.5 h-3.5" /> Website
              </a>
            )}
            {(project as any).twitterHandle && (
              <a href={`https://twitter.com/${(project as any).twitterHandle.replace("@", "")}`} target="_blank" rel="noreferrer"
                className="flex items-center gap-2 text-xs font-mono text-muted-foreground hover:text-sky-400 transition-colors">
                <Twitter className="w-3.5 h-3.5" /> {(project as any).twitterHandle}
              </a>
            )}
            {(project as any).discordUrl && (
              <a href={(project as any).discordUrl} target="_blank" rel="noreferrer"
                className="flex items-center gap-2 text-xs font-mono text-muted-foreground hover:text-indigo-400 transition-colors">
                <MessageCircle className="w-3.5 h-3.5" /> Discord
              </a>
            )}
          </div>

          {/* Enrolled Entities mini-summary */}
          {enrollments.length > 0 && (
            <div className="bg-card border border-card-border rounded-xl p-4">
              <div className="font-mono text-[10px] uppercase tracking-wider text-primary/60 mb-3">Enrolled Entities</div>
              <div className="space-y-2">
                {enrollments.map((enr: any) => (
                  <div key={enr.id} className="flex items-center gap-3 p-2 bg-muted/10 rounded-md">
                    <Hash className="w-3.5 h-3.5 text-primary/40 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-xs font-bold text-primary truncate">{enr.entity?.entitySerial || `#${enr.vaultEntryId}`}</div>
                      <div className="font-mono text-[9px] text-muted-foreground/50 truncate">{enr.entity?.projectName}</div>
                    </div>
                    <Badge variant="outline" className="font-mono text-[8px] border-emerald-500/20 text-emerald-400">{enr.status}</Badge>
                    <button onClick={() => handleUnenroll(enr.id)} className="text-muted-foreground/30 hover:text-red-400 transition-colors">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* ── TAB: TASKS ── */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "tasks" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-mono font-bold text-sm">Tasks</div>
              <div className="font-mono text-[10px] text-muted-foreground/50">{tasks.length} task{tasks.length !== 1 ? "s" : ""} · {completedTasks} completed</div>
            </div>
            <CreateTaskDialog projectId={projectId} token={token} onCreated={() => refetchProject()} />
          </div>

          {tasks.length === 0 ? (
            <div className="py-16 flex flex-col items-center gap-4 border border-dashed border-primary/15 rounded-xl bg-primary/2">
              <ListTodo className="w-8 h-8 text-primary/20" />
              <div className="text-center">
                <div className="font-mono font-bold text-muted-foreground/50 text-sm">No tasks yet</div>
                <div className="font-mono text-[10px] text-muted-foreground/30 mt-0.5">Create the first task for this project</div>
              </div>
            </div>
          ) : (
            <div className="bg-card border border-card-border rounded-xl overflow-hidden divide-y divide-card-border">
              {tasks.map((task) => (
                <TaskSubmitDialog
                  key={task.id}
                  task={task}
                  projectId={projectId}
                  token={token}
                  onDone={() => refetchProject()}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* ── TAB: ENTITIES ── */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "entities" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-mono font-bold text-sm">Entity Progress</div>
              <div className="font-mono text-[10px] text-muted-foreground/50">Per-entity task completion status</div>
            </div>
            <Button size="sm" variant="outline" onClick={() => setEnrollOpen(true)} className="font-mono text-[10px] h-8 gap-1.5 uppercase">
              <UserPlus className="w-3 h-3" /> Enroll
            </Button>
          </div>

          {loadingEntityData ? (
            <div className="space-y-3">{[1, 2].map(i => <div key={i} className="h-32 bg-card border border-card-border rounded-xl animate-pulse" />)}</div>
          ) : !entityData || entityData.entities.length === 0 ? (
            <div className="py-16 flex flex-col items-center gap-4 border border-dashed border-primary/15 rounded-xl bg-primary/2">
              <Users className="w-8 h-8 text-primary/20" />
              <div className="text-center">
                <div className="font-mono font-bold text-muted-foreground/50 text-sm">No entities enrolled</div>
                <div className="font-mono text-[10px] text-muted-foreground/30">Enroll vault entities to track per-account progress</div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {entityData.entities.map((entity) => {
                const prog = entity.totalTasks > 0 ? Math.round((entity.completedTasks / entity.totalTasks) * 100) : 0;
                const totalProfit = entity.tasks.reduce((s, t) => s + (t.status === "approved" || t.status === "completed" ? t.profit : 0), 0);
                const totalCost = entity.tasks.reduce((s, t) => s + (t.status === "approved" || t.status === "completed" ? t.cost : 0), 0);
                return (
                  <div key={entity.enrollmentId} className="bg-card border border-card-border rounded-xl overflow-hidden">
                    {/* Entity header */}
                    <div className="bg-gradient-to-r from-primary/8 to-transparent border-b border-card-border px-4 py-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <Shield className="w-3.5 h-3.5 text-primary/50" />
                          <div>
                            <div className="font-mono font-bold text-sm text-primary">{entity.entitySerial || `#${entity.vaultEntryId}`}</div>
                            <div className="font-mono text-[9px] text-muted-foreground/50">{entity.entityName} · {entity.category}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {totalCost > 0 && <div className="font-mono text-[10px] text-red-400">-${totalCost.toFixed(2)}</div>}
                          {totalProfit > 0 && <div className="font-mono text-[10px] text-emerald-400">+${totalProfit.toFixed(2)}</div>}
                          <div className="font-mono text-[10px] font-bold text-primary">{prog}%</div>
                          <Progress value={prog} className="w-20 h-1.5" />
                          <button onClick={() => handleUnenroll(entity.enrollmentId)} className="text-muted-foreground/30 hover:text-red-400 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Task list for this entity */}
                    {entity.totalTasks === 0 ? (
                      <div className="px-4 py-3 font-mono text-[10px] text-muted-foreground/40">No tasks in this project yet.</div>
                    ) : (
                      <div className="divide-y divide-border/20">
                        {entity.tasks.map((task) => {
                          const done = task.status === "approved" || task.status === "completed";
                          const pending = task.status === "pending";
                          return (
                            <div key={task.taskId} className="px-4 py-2.5 flex items-center gap-3">
                              <div className={cn("flex-shrink-0", done ? "text-emerald-400" : pending ? "text-yellow-400" : "text-muted-foreground/30")}>
                                {done ? <CheckCircle2 className="w-3.5 h-3.5" /> : pending ? <Clock className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-mono text-xs truncate">{task.taskName}</div>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-[9px] font-mono text-muted-foreground/40 uppercase">{task.taskType}</span>
                                  {task.cost > 0 && <span className="text-[9px] font-mono text-red-400/70">-${task.cost}</span>}
                                  {task.profit > 0 && <span className="text-[9px] font-mono text-emerald-400/70">+${task.profit}</span>}
                                </div>
                              </div>
                              <StatusBadge status={task.status} />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* ── TAB: SETTINGS ── */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "settings" && settingsForm && (
        <div className="space-y-4 max-w-xl">
          <div className="bg-card border border-card-border rounded-xl p-4 space-y-3">
            <div className="font-mono text-[10px] uppercase tracking-wider text-primary/60 mb-1">Project Details</div>
            <div className="space-y-1">
              <Label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Name</Label>
              <Input value={settingsForm.name} onChange={sf("name")} className="font-mono text-xs h-9 bg-input" />
            </div>
            <div className="space-y-1">
              <Label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Description</Label>
              <Textarea value={settingsForm.description} onChange={sf("description")} className="font-mono text-xs bg-input min-h-[80px] resize-none" />
            </div>
            <div className="space-y-1">
              <Label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <Zap className="w-2.5 h-2.5 text-yellow-400" /> XP Token Name
              </Label>
              <Input value={settingsForm.xpName} onChange={sf("xpName")} className="font-mono text-xs h-9 bg-input" placeholder="e.g. POINTS, XP, $TOKEN" />
            </div>
          </div>

          <div className="bg-card border border-card-border rounded-xl p-4 space-y-3">
            <div className="font-mono text-[10px] uppercase tracking-wider text-primary/60 mb-1">Links</div>
            <div className="space-y-1">
              <Label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1"><Globe className="w-2.5 h-2.5" /> Website</Label>
              <Input value={settingsForm.websiteUrl} onChange={sf("websiteUrl")} className="font-mono text-xs h-9 bg-input" placeholder="https://..." />
            </div>
            <div className="space-y-1">
              <Label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1"><Twitter className="w-2.5 h-2.5" /> Twitter</Label>
              <Input value={settingsForm.twitterHandle} onChange={sf("twitterHandle")} className="font-mono text-xs h-9 bg-input" placeholder="@handle" />
            </div>
            <div className="space-y-1">
              <Label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1"><MessageCircle className="w-2.5 h-2.5" /> Discord</Label>
              <Input value={settingsForm.discordUrl} onChange={sf("discordUrl")} className="font-mono text-xs h-9 bg-input" placeholder="https://discord.gg/..." />
            </div>
          </div>

          <div className="bg-card border border-card-border rounded-xl p-4 space-y-3">
            <div className="font-mono text-[10px] uppercase tracking-wider text-primary/60 mb-1">Protocol Params</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Tier</Label>
                <Select value={settingsForm.tier} onValueChange={v => setSettingsForm((p: any) => ({ ...p, tier: v }))}>
                  <SelectTrigger className="font-mono text-xs h-9 bg-input"><SelectValue /></SelectTrigger>
                  <SelectContent>{["1","2","3","4"].map(t => <SelectItem key={t} value={t} className="font-mono text-xs">Tier {t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Difficulty</Label>
                <Select value={settingsForm.experienceLevel} onValueChange={v => setSettingsForm((p: any) => ({ ...p, experienceLevel: v }))}>
                  <SelectTrigger className="font-mono text-xs h-9 bg-input"><SelectValue /></SelectTrigger>
                  <SelectContent>{["Beginner","Intermediate","Advanced"].map(l => <SelectItem key={l} value={l} className="font-mono text-xs">{l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Funding ($)</Label>
                <Input type="number" value={settingsForm.fundingAmount} onChange={sf("fundingAmount")} className="font-mono text-xs h-9 bg-input" />
              </div>
              <div className="space-y-1">
                <Label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Est. Reward ($)</Label>
                <Input type="number" value={settingsForm.rewardEstimate} onChange={sf("rewardEstimate")} className="font-mono text-xs h-9 bg-input" />
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <Button onClick={handleSaveSettings} disabled={savingSettings} className="font-mono text-xs uppercase tracking-wider gap-2">
              {savingSettings ? "Saving..." : <><Edit3 className="w-3.5 h-3.5" /> Save Changes</>}
            </Button>
            <Button
              variant="destructive"
              onClick={() => setDeleteConfirmOpen(true)}
              className="font-mono text-xs uppercase tracking-wider gap-2 ml-auto"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete Project
            </Button>
          </div>

          {/* Project ID display in settings */}
          <div className="bg-muted/20 border border-border/30 rounded-xl p-3">
            <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground/40 mb-1">Project ID</div>
            <CopyId value={`#PRJ-${String(projectId).padStart(4, "0")} (DB ID: ${projectId})`} />
          </div>
        </div>
      )}

      {/* ── Enroll Entity Modal ── */}
      <Dialog open={enrollOpen} onOpenChange={setEnrollOpen}>
        <DialogContent className="bg-card border-card-border max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-mono uppercase tracking-wider text-primary flex items-center gap-2">
              <UserPlus className="w-4 h-4" /> Enroll Entity
            </DialogTitle>
            <p className="text-xs font-mono text-muted-foreground">
              Select a vault entity to enroll in <span className="text-foreground">{(project as any).name}</span>.
            </p>
          </DialogHeader>
          <div className="space-y-2 py-2">
            {!vaultEntries || (vaultEntries as any[]).length === 0 ? (
              <div className="text-center py-8 font-mono text-muted-foreground text-xs">
                No vault entities found.{" "}
                <Link href="/vault" className="text-primary hover:underline">Create one first.</Link>
              </div>
            ) : (
              (vaultEntries as any[]).map(entry => {
                const isEnrolled = enrolledIds.has(entry.id);
                const isLoadingThis = loadingEnroll === entry.id;
                return (
                  <div
                    key={entry.id}
                    className={cn(
                      "flex items-center gap-3 p-3 border rounded-md transition-colors",
                      isEnrolled ? "border-green-500/30 bg-green-500/5" : "border-card-border hover:border-primary/30 bg-muted/5"
                    )}
                  >
                    <Hash className={cn("w-4 h-4 flex-shrink-0", isEnrolled ? "text-green-400" : "text-primary")} />
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-sm font-bold text-primary">{entry.entitySerial || `AYZNA${entry.id}`}</div>
                      <div className="text-[10px] font-mono text-muted-foreground truncate">{entry.projectName} · {entry.category}</div>
                      {Array.isArray(entry.walletAddresses) && entry.walletAddresses.length > 0 && (
                        <div className="text-[9px] font-mono text-muted-foreground/60 flex items-center gap-1 mt-0.5">
                          <Wallet className="w-2.5 h-2.5" /> {(entry.walletAddresses as string[])[0]?.slice(0, 16)}...
                        </div>
                      )}
                    </div>
                    {isEnrolled ? (
                      <Badge variant="outline" className="font-mono text-[9px] border-green-500/30 text-green-400 flex-shrink-0">Enrolled</Badge>
                    ) : (
                      <Button size="sm" onClick={() => handleEnroll(entry.id)} disabled={!!isLoadingThis} className="font-mono text-[10px] h-7 px-3 flex-shrink-0">
                        {isLoadingThis ? "..." : "Enroll"}
                      </Button>
                    )}
                  </div>
                );
              })
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEnrollOpen(false)} className="font-mono text-xs">Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm ── */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="bg-card border-card-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-mono text-red-400 flex items-center gap-2">
              <Trash2 className="w-4 h-4" /> Delete Project?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm font-mono text-muted-foreground">
            This will permanently delete <strong className="text-foreground">{(project as any).name}</strong> and all its tasks.
            This cannot be undone.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)} className="font-mono text-xs">Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteProject} disabled={deletingProject} className="font-mono text-xs">
              {deletingProject ? "Deleting..." : "Delete Forever"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
