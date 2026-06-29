import { useState, useEffect, useCallback } from "react";
import { useGetProject, useGetProjectStats } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  ArrowLeft, ExternalLink, Users, CheckSquare, Zap, Activity,
  LayoutDashboard, ListTodo, Settings, Plus, Trash2, Edit3,
  Twitter, Globe, MessageCircle, TrendingUp, DollarSign, Timer, Calendar,
  CheckCircle2, Clock, ChevronRight, Star, Shield,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { TaskCategoryBadge, CategoryLegend } from "@/components/ui/task-category-badge";
import { CountdownTimer } from "@/components/ui/countdown-timer";
import { format } from "date-fns";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

function getToken() { return localStorage.getItem("ayzen_token") || ""; }
function getAuth() {
  const t = getToken();
  if (!t) return { userId: 1, role: "user" };
  try { return JSON.parse(Buffer.from(t.replace("Bearer ", ""), "base64").toString()); } catch { return { userId: 1, role: "user" }; }
}

interface Task {
  id: number; name: string; description?: string;
  rewardAmount?: number; verificationType: string; taskType: string;
  cost: number; profit: number; category: string; taskCategory: string;
  completionCount: number; deadline?: string; timeLimitMinutes?: number;
}

// ─── Create/Edit Task Dialog ──────────────────────────────────────────────────
function TaskDialog({ projectId, task, onDone }: { projectId: number; task?: Task; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: task?.name ?? "",
    description: task?.description ?? "",
    rewardAmount: task?.rewardAmount?.toString() ?? "",
    verificationType: task?.verificationType ?? "manual",
    taskType: task?.taskType ?? "One-time",
    cost: task?.cost?.toString() ?? "0",
    profit: task?.profit?.toString() ?? "0",
    taskCategory: task?.taskCategory ?? "B1",
    deadline: task?.deadline ? new Date(task.deadline).toISOString().slice(0, 16) : "",
    timeLimitMinutes: task?.timeLimitMinutes?.toString() ?? "",
  });
  const { toast } = useToast();
  const token = getToken();
  const fv = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm(p => ({ ...p, [k]: e.target.value }));

  const handleSave = async () => {
    if (!form.name.trim()) { toast({ variant: "destructive", title: "Task name required" }); return; }
    setSaving(true);
    try {
      const url = task ? `${BASE}/api/tasks/${task.id}` : `${BASE}/api/tasks`;
      const method = task ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          projectId, name: form.name.trim(),
          description: form.description || undefined,
          rewardAmount: Number(form.rewardAmount) || undefined,
          verificationType: form.verificationType, taskType: form.taskType,
          cost: Number(form.cost) || 0, profit: Number(form.profit) || 0,
          taskCategory: form.taskCategory,
          deadline: form.deadline ? new Date(form.deadline).toISOString() : undefined,
          timeLimitMinutes: Number(form.timeLimitMinutes) || undefined,
        }),
      });
      if (!res.ok) { toast({ variant: "destructive", title: "Failed to save task" }); return; }
      toast({ title: task ? "Task updated!" : "Task created!" });
      setOpen(false);
      onDone();
    } catch { toast({ variant: "destructive", title: "Network error" }); }
    finally { setSaving(false); }
  };

  return (
    <>
      <Button size="sm" variant={task ? "ghost" : "default"} onClick={() => setOpen(true)}
        className={cn("font-mono text-[10px] uppercase tracking-wider gap-1.5 h-7",
          task ? "text-muted-foreground hover:text-primary" : ""
        )}>
        {task ? <Edit3 className="w-3 h-3" /> : <><Plus className="w-3 h-3" /> Add Task</>}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-card border-card-border max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-mono uppercase tracking-wider text-primary flex items-center gap-2">
              {task ? <><Edit3 className="w-4 h-4" /> Edit Task</> : <><Plus className="w-4 h-4" /> New Task</>}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1 max-h-[70vh] overflow-y-auto pr-1">
            <div className="space-y-1">
              <Label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Task Name *</Label>
              <Input value={form.name} onChange={fv("name")} className="font-mono text-xs h-8 bg-input" placeholder="e.g. Follow on Twitter" />
            </div>
            <div className="space-y-1">
              <Label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Description</Label>
              <Textarea value={form.description} onChange={fv("description")} className="font-mono text-xs bg-input min-h-[55px] resize-none" placeholder="Task instructions..." />
            </div>

            {/* Category */}
            <div className="space-y-2">
              <Label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Task Category</Label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: "A", label: "A — Sign-in Only", desc: "No cost, no reward" },
                  { id: "B1", label: "B1 — Free + Reward", desc: "Free, earns reward" },
                  { id: "B2", label: "B2 — Paid + Instant", desc: "Costs money, instant reward" },
                  { id: "C", label: "C — Cost Only", desc: "Deducts cost, no reward" },
                ].map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setForm(p => ({ ...p, taskCategory: cat.id }))}
                    className={cn(
                      "p-2 rounded-lg border text-left transition-all",
                      form.taskCategory === cat.id
                        ? "border-primary/50 bg-primary/10"
                        : "border-card-border hover:border-primary/20"
                    )}
                  >
                    <div className="font-mono text-[10px] font-bold text-foreground">{cat.label}</div>
                    <div className="font-mono text-[9px] text-muted-foreground/50 mt-0.5">{cat.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Type</Label>
                <Select value={form.taskType} onValueChange={v => setForm(p => ({ ...p, taskType: v }))}>
                  <SelectTrigger className="font-mono text-xs h-8 bg-input"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["One-time", "Daily", "Weekly"].map(t => <SelectItem key={t} value={t} className="font-mono text-xs">{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Verify</Label>
                <Select value={form.verificationType} onValueChange={v => setForm(p => ({ ...p, verificationType: v }))}>
                  <SelectTrigger className="font-mono text-xs h-8 bg-input"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual" className="font-mono text-xs">Manual</SelectItem>
                    <SelectItem value="auto" className="font-mono text-xs">Auto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-primary/3 border border-primary/10 space-y-2">
              <span className="font-mono text-[10px] uppercase tracking-wider text-primary/70 font-bold">Cost & Reward</span>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label className="font-mono text-[9px] uppercase text-muted-foreground">Reward ($)</Label>
                  <Input value={form.rewardAmount} onChange={fv("rewardAmount")} type="number" className="font-mono text-xs h-8 bg-input" placeholder="0" />
                </div>
                <div className="space-y-1">
                  <Label className="font-mono text-[9px] uppercase text-red-400/70">Cost ($)</Label>
                  <Input value={form.cost} onChange={fv("cost")} type="number" className="font-mono text-xs h-8 bg-input" placeholder="0" />
                </div>
                <div className="space-y-1">
                  <Label className="font-mono text-[9px] uppercase text-emerald-400/70">Profit ($)</Label>
                  <Input value={form.profit} onChange={fv("profit")} type="number" className="font-mono text-xs h-8 bg-input" placeholder="0" />
                </div>
              </div>
            </div>

            {/* Timer */}
            <div className="p-3 rounded-lg bg-muted/10 border border-card-border space-y-2">
              <div className="flex items-center gap-1.5">
                <Timer className="w-3 h-3 text-primary/60" />
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Timer</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="font-mono text-[9px] uppercase text-muted-foreground">Deadline</Label>
                  <Input value={form.deadline} onChange={fv("deadline")} type="datetime-local" className="font-mono text-xs h-8 bg-input" />
                </div>
                <div className="space-y-1">
                  <Label className="font-mono text-[9px] uppercase text-muted-foreground">Time Limit (min)</Label>
                  <Input value={form.timeLimitMinutes} onChange={fv("timeLimitMinutes")} type="number" className="font-mono text-xs h-8 bg-input" placeholder="e.g. 60" />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} className="font-mono text-xs">Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="font-mono text-xs uppercase gap-2">
              {saving ? "Saving..." : <><CheckSquare className="w-3.5 h-3.5" /> {task ? "Update" : "Create"}</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AdminProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const projectId = parseInt(id || "0", 10);
  const { toast } = useToast();
  const token = getToken();

  const { data: project, isLoading: projectLoading, refetch } = useGetProject(projectId, {
    query: { enabled: !!projectId, queryKey: ["project", projectId] }
  });
  const { data: stats, isLoading: statsLoading } = useGetProjectStats(projectId, {
    query: { enabled: !!projectId, queryKey: ["project-stats", projectId] }
  });

  const [activeTab, setActiveTab] = useState<"dashboard" | "tasks" | "members" | "settings">("dashboard");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [settingsForm, setSettingsForm] = useState<any>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [showCategoryLegend, setShowCategoryLegend] = useState(false);

  const loadTasks = useCallback(async () => {
    setLoadingTasks(true);
    try {
      const res = await fetch(`${BASE}/api/tasks?projectId=${projectId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setTasks(await res.json());
    } catch {} finally { setLoadingTasks(false); }
  }, [projectId, token]);

  const loadMembers = useCallback(async () => {
    setLoadingMembers(true);
    try {
      const res = await fetch(`${BASE}/api/projects/${projectId}/members`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setMembers(await res.json());
    } catch {} finally { setLoadingMembers(false); }
  }, [projectId, token]);

  useEffect(() => { loadTasks(); }, [loadTasks]);
  useEffect(() => { if (activeTab === "members") loadMembers(); }, [activeTab, loadMembers]);
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
        deadline: (project as any).deadline ? new Date((project as any).deadline).toISOString().slice(0, 16) : "",
        status: (project as any).status ?? "active",
      });
    }
  }, [project, settingsForm]);

  const deleteTask = async (taskId: number) => {
    if (!confirm("Delete this task?")) return;
    await fetch(`${BASE}/api/tasks/${taskId}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    toast({ title: "Task deleted" });
    loadTasks();
  };

  const saveSettings = async () => {
    if (!settingsForm) return;
    setSavingSettings(true);
    try {
      const body = {
        ...settingsForm,
        deadline: settingsForm.deadline ? new Date(settingsForm.deadline).toISOString() : undefined,
      };
      const res = await fetch(`${BASE}/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) { toast({ variant: "destructive", title: "Save failed" }); return; }
      toast({ title: "Project settings saved!" });
      refetch();
      setSettingsForm(null);
    } catch { toast({ variant: "destructive", title: "Network error" }); }
    finally { setSavingSettings(false); }
  };

  const TABS = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "tasks", label: `Tasks (${tasks.length})`, icon: ListTodo },
    { id: "members", label: "Operators", icon: Users },
    { id: "settings", label: "Settings", icon: Settings },
  ] as const;

  const keyTasks = tasks.filter(t => (t.rewardAmount ?? 0) > 0).slice(0, 3);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/admin/projects">
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold font-mono tracking-tighter uppercase flex items-center gap-3">
            {projectLoading ? <Skeleton className="h-8 w-40" /> : (project as any)?.name}
            {(project as any)?.tier && (
              <Badge variant="outline" className="font-mono text-xs border-primary/50 text-primary">
                TIER {(project as any).tier}
              </Badge>
            )}
            {(project as any)?.status && (project as any).status !== "active" && (
              <Badge variant="outline" className="font-mono text-xs border-amber-400/50 text-amber-400">
                {((project as any).status as string).toUpperCase()}
              </Badge>
            )}
          </h1>
          <p className="text-muted-foreground font-mono text-sm">Protocol details · admin panel</p>
        </div>
        {(project as any)?.deadline && (
          <div className="flex flex-col items-end gap-1">
            <span className="font-mono text-[9px] text-muted-foreground/50 uppercase">Deadline</span>
            <CountdownTimer deadline={(project as any).deadline} />
          </div>
        )}
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: "Active Operators", value: statsLoading ? null : (stats as any)?.activeUsers || 0, icon: Users, color: "text-primary" },
          { label: "Total Tasks", value: statsLoading ? null : tasks.length, icon: Activity, color: "text-cyan-400" },
          { label: "Executions", value: statsLoading ? null : (stats as any)?.completedTasks || 0, icon: CheckSquare, color: "text-emerald-400" },
          { label: "Distributed ROI", value: statsLoading ? null : `$${((stats as any)?.totalRoiDistributed || 0).toLocaleString()}`, icon: Zap, color: "text-yellow-400" },
        ].map(s => (
          <Card key={s.label} className="bg-card border-card-border shadow-none">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-mono uppercase text-muted-foreground">{s.label}</CardTitle>
              <s.icon className={cn("h-4 w-4", s.color)} />
            </CardHeader>
            <CardContent>
              {s.value === null ? <Skeleton className="h-8 w-16" /> : (
                <div className={cn("text-2xl font-bold font-mono", s.color)}>{s.value}</div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tab Navigation */}
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

      {/* ─── DASHBOARD TAB ─── */}
      {activeTab === "dashboard" && (
        <div className="space-y-4">
          {/* Description + Links */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="bg-card border-card-border shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="font-mono text-xs uppercase text-primary/60">Protocol Intel</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="font-mono text-sm text-muted-foreground leading-relaxed">
                  {projectLoading ? <Skeleton className="h-16 w-full" /> : ((project as any)?.description || "No description.")}
                </p>
                {(project as any)?.xpName && (
                  <div className="flex items-center gap-2">
                    <Zap className="w-3.5 h-3.5 text-yellow-400" />
                    <span className="font-mono text-xs text-yellow-400">{(project as any).xpName} XP Token</span>
                  </div>
                )}
                <div className="flex flex-col gap-1.5 pt-1">
                  {(project as any)?.websiteUrl && (
                    <a href={(project as any).websiteUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-xs font-mono text-muted-foreground hover:text-primary transition-colors">
                      <Globe className="w-3.5 h-3.5" /> Website
                    </a>
                  )}
                  {(project as any)?.twitterHandle && (
                    <a href={`https://twitter.com/${(project as any).twitterHandle.replace("@","")}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-xs font-mono text-muted-foreground hover:text-sky-400 transition-colors">
                      <Twitter className="w-3.5 h-3.5" /> {(project as any).twitterHandle}
                    </a>
                  )}
                  {(project as any)?.discordUrl && (
                    <a href={(project as any).discordUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-xs font-mono text-muted-foreground hover:text-indigo-400 transition-colors">
                      <MessageCircle className="w-3.5 h-3.5" /> Discord
                    </a>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-card-border shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="font-mono text-xs uppercase text-primary/60">Key Tasks</CardTitle>
              </CardHeader>
              <CardContent>
                {keyTasks.length === 0 ? (
                  <p className="font-mono text-xs text-muted-foreground/50">No high-value tasks yet.</p>
                ) : (
                  <div className="space-y-2">
                    {keyTasks.map(t => (
                      <div key={t.id} className="flex items-center gap-3 p-2 bg-muted/10 rounded-md">
                        <Star className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="font-mono text-xs font-bold truncate">{t.name}</div>
                          <div className="font-mono text-[9px] text-muted-foreground/50">{t.taskType} · {t.verificationType}</div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <TaskCategoryBadge category={t.taskCategory ?? t.category ?? "B1"} />
                          {t.rewardAmount && <span className="font-mono text-[9px] text-primary font-bold">${t.rewardAmount}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Financials */}
          <Card className="bg-card border-card-border shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="font-mono text-xs uppercase text-primary/60">Financials</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <div className="font-mono text-[9px] text-muted-foreground/50 uppercase">Funding</div>
                  <div className="font-mono text-xl font-bold text-primary">${(project as any)?.fundingAmount?.toLocaleString() ?? 0}</div>
                </div>
                <div className="space-y-1">
                  <div className="font-mono text-[9px] text-muted-foreground/50 uppercase">Est. Reward</div>
                  <div className="font-mono text-xl font-bold text-emerald-400">${(project as any)?.rewardEstimate?.toLocaleString() ?? 0}</div>
                </div>
                <div className="space-y-1">
                  <div className="font-mono text-[9px] text-muted-foreground/50 uppercase">ROI Distributed</div>
                  <div className="font-mono text-xl font-bold text-yellow-400">${(project as any)?.totalRoiDistributed?.toLocaleString() ?? 0}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ─── TASKS TAB ─── */}
      {activeTab === "tasks" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-mono font-bold text-sm">Tasks</div>
              <div className="font-mono text-[10px] text-muted-foreground/50">{tasks.length} task{tasks.length !== 1 ? "s" : ""}</div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowCategoryLegend(v => !v)}
                className="font-mono text-[10px] text-muted-foreground/50 hover:text-primary transition-colors border border-card-border rounded px-2 py-1"
              >
                Category Guide
              </button>
              <TaskDialog projectId={projectId} onDone={loadTasks} />
            </div>
          </div>

          {showCategoryLegend && (
            <Card className="bg-card border-card-border shadow-none p-4">
              <CategoryLegend />
            </Card>
          )}

          {loadingTasks ? (
            <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : tasks.length === 0 ? (
            <Card className="bg-card border-card-border shadow-none">
              <CardContent className="p-8 text-center font-mono text-muted-foreground/50">
                No tasks yet. Add the first task.
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-card border-card-border shadow-none overflow-hidden">
              <div className="divide-y divide-card-border">
                {tasks.map(t => (
                  <div key={t.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/5 group transition-colors">
                    <TaskCategoryBadge category={t.taskCategory ?? t.category ?? "B1"} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm font-medium">{t.name}</span>
                        <Badge variant="outline" className="font-mono text-[9px] border-card-border text-muted-foreground/50">{t.taskType}</Badge>
                        {t.verificationType === "auto" && (
                          <Badge variant="outline" className="font-mono text-[9px] border-emerald-400/20 text-emerald-400">AUTO</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        {t.description && <span className="font-mono text-[9px] text-muted-foreground/40 truncate max-w-xs">{t.description}</span>}
                        {t.rewardAmount != null && t.rewardAmount > 0 && <span className="font-mono text-[9px] text-primary font-bold">${t.rewardAmount} reward</span>}
                        {(t.cost ?? 0) > 0 && <span className="font-mono text-[9px] text-red-400">-${t.cost} cost</span>}
                        {(t.profit ?? 0) > 0 && <span className="font-mono text-[9px] text-emerald-400">+${t.profit} profit</span>}
                        <span className="font-mono text-[9px] text-muted-foreground/30">{t.completionCount} done</span>
                      </div>
                      {t.deadline && (
                        <div className="mt-1">
                          <CountdownTimer deadline={t.deadline} compact />
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      <TaskDialog projectId={projectId} task={t} onDone={loadTasks} />
                      <Button size="sm" variant="ghost" onClick={() => deleteTask(t.id)}
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-red-400">
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ─── MEMBERS / OPERATORS TAB ─── */}
      {activeTab === "members" && (
        <div className="space-y-3">
          <div>
            <div className="font-mono font-bold text-sm">Operators</div>
            <div className="font-mono text-[10px] text-muted-foreground/50">{members.length} enrolled</div>
          </div>
          {loadingMembers ? (
            <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : members.length === 0 ? (
            <Card className="bg-card border-card-border shadow-none">
              <CardContent className="p-8 text-center font-mono text-muted-foreground/50">No operators enrolled yet.</CardContent>
            </Card>
          ) : (
            <>
              {/* ROI Summary Bar */}
              {(() => {
                const totalTasks = members.reduce((s: number, m: any) => s + (m.tasksCompleted || 0), 0);
                const maxTasks = Math.max(...members.map((m: any) => m.tasksCompleted || 0), 1);
                const totalRoi = members.reduce((s: number, m: any) => s + (m.roi || 0), 0);
                return (
                  <div className="grid grid-cols-3 gap-3 mb-3">
                    {[
                      { label: "Total Operators", value: members.length, color: "text-primary" },
                      { label: "Total Executions", value: totalTasks, color: "text-emerald-400" },
                      { label: "ROI Distributed", value: `$${totalRoi.toLocaleString()}`, color: "text-yellow-400" },
                    ].map(s => (
                      <div key={s.label} className="bg-card border border-card-border rounded-lg p-3">
                        <div className={cn("font-mono text-lg font-bold", s.color)}>{s.value}</div>
                        <div className="font-mono text-[9px] text-muted-foreground/50">{s.label}</div>
                      </div>
                    ))}
                  </div>
                );
              })()}
              <Card className="bg-card border-card-border shadow-none overflow-hidden">
                <div className="divide-y divide-card-border">
                  {members.map((m: any) => {
                    const maxTasks = Math.max(...members.map((x: any) => x.tasksCompleted || 0), 1);
                    const pct = Math.round(((m.tasksCompleted || 0) / maxTasks) * 100);
                    const progressPct = Math.round(m.progress || 0);
                    return (
                      <div key={m.userId} className="px-4 py-3 space-y-2">
                        <div className="flex items-center gap-4">
                          <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0 font-bold font-mono text-xs text-primary">
                            {(m.username || "?")[0].toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-mono text-sm font-bold">{m.username}</div>
                            <div className="font-mono text-[9px] text-muted-foreground/40">
                              Joined {m.joinedAt ? format(new Date(m.joinedAt), "MMM d, yyyy") : "—"}
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="font-mono text-xs font-bold text-primary">{m.tasksCompleted} tasks</div>
                            <div className="font-mono text-[9px] text-muted-foreground/40">{progressPct}% done</div>
                          </div>
                        </div>
                        {/* ROI bar */}
                        <div className="space-y-0.5">
                          <div className="flex justify-between text-[9px] font-mono text-muted-foreground/40">
                            <span>Task completion</span>
                            <span>{pct}% of top performer</span>
                          </div>
                          <div className="h-1.5 bg-muted/20 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-primary/60 to-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                          </div>
                          <div className="flex justify-between text-[9px] font-mono text-muted-foreground/40">
                            <span>Project progress</span>
                            <span>{progressPct}%</span>
                          </div>
                          <div className="h-1 bg-muted/20 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-emerald-500/50 to-emerald-400 rounded-full transition-all" style={{ width: `${progressPct}%` }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </>
          )}
        </div>
      )}

      {/* ─── SETTINGS TAB ─── */}
      {activeTab === "settings" && settingsForm && (
        <div className="space-y-4 max-w-2xl">
          <Card className="bg-card border-card-border shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="font-mono text-xs uppercase text-primary/60">General</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { key: "name", label: "Project Name *", placeholder: "Project name" },
                { key: "xpName", label: "XP Token Name", placeholder: "e.g. LAYER3 XP" },
                { key: "websiteUrl", label: "Website URL", placeholder: "https://..." },
                { key: "twitterHandle", label: "Twitter Handle", placeholder: "@handle" },
                { key: "discordUrl", label: "Discord URL", placeholder: "https://discord.gg/..." },
              ].map(f => (
                <div key={f.key} className="space-y-1">
                  <Label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{f.label}</Label>
                  <Input
                    value={settingsForm[f.key] ?? ""}
                    onChange={e => setSettingsForm((p: any) => ({ ...p, [f.key]: e.target.value }))}
                    className="font-mono text-xs h-8 bg-input"
                    placeholder={f.placeholder}
                  />
                </div>
              ))}
              <div className="space-y-1">
                <Label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Description</Label>
                <Textarea
                  value={settingsForm.description ?? ""}
                  onChange={e => setSettingsForm((p: any) => ({ ...p, description: e.target.value }))}
                  className="font-mono text-xs bg-input min-h-[80px] resize-none"
                  placeholder="Project description..."
                />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-card-border shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="font-mono text-xs uppercase text-primary/60">Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1 mb-3">
                <Label className="font-mono text-[10px] uppercase text-muted-foreground">Category</Label>
                <div className="flex flex-wrap gap-1.5">
                  {["DeFi","NFT","GameFi","Layer2","Testnet","CEX","Exchange","Instant Web3","TGE","Social","Other"].map(cat => (
                    <button key={cat} onClick={() => setSettingsForm((p: any) => ({ ...p, category: cat }))}
                      className={cn("px-2.5 py-1 rounded-lg font-mono text-[10px] border transition-all",
                        (settingsForm.category ?? "Other") === cat
                          ? "border-primary/50 bg-primary/10 text-primary font-bold"
                          : "border-card-border text-muted-foreground/60 hover:border-primary/20")}>
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="font-mono text-[10px] uppercase text-muted-foreground">Tier</Label>
                  <Select value={settingsForm.tier} onValueChange={v => setSettingsForm((p: any) => ({ ...p, tier: v }))}>
                    <SelectTrigger className="font-mono text-xs h-8 bg-input"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["1","2","3","4","5"].map(t => <SelectItem key={t} value={t} className="font-mono text-xs">Tier {t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="font-mono text-[10px] uppercase text-muted-foreground">Funding ($)</Label>
                  <Input type="number" value={settingsForm.fundingAmount} onChange={e => setSettingsForm((p: any) => ({ ...p, fundingAmount: Number(e.target.value) }))} className="font-mono text-xs h-8 bg-input" />
                </div>
                <div className="space-y-1">
                  <Label className="font-mono text-[10px] uppercase text-muted-foreground">Est. Reward ($)</Label>
                  <Input type="number" value={settingsForm.rewardEstimate} onChange={e => setSettingsForm((p: any) => ({ ...p, rewardEstimate: Number(e.target.value) }))} className="font-mono text-xs h-8 bg-input" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="font-mono text-[10px] uppercase text-muted-foreground">Experience Level</Label>
                  <Select value={settingsForm.experienceLevel} onValueChange={v => setSettingsForm((p: any) => ({ ...p, experienceLevel: v }))}>
                    <SelectTrigger className="font-mono text-xs h-8 bg-input"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["Beginner","Intermediate","Advanced"].map(l => <SelectItem key={l} value={l} className="font-mono text-xs">{l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="font-mono text-[10px] uppercase text-muted-foreground">Status</Label>
                  <Select value={settingsForm.status} onValueChange={v => setSettingsForm((p: any) => ({ ...p, status: v }))}>
                    <SelectTrigger className="font-mono text-xs h-8 bg-input"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["active","paused","completed","archived"].map(s => <SelectItem key={s} value={s} className="font-mono text-xs capitalize">{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="font-mono text-[10px] uppercase text-muted-foreground flex items-center gap-1">
                  <Timer className="w-2.5 h-2.5" /> Project Deadline
                </Label>
                <Input
                  type="datetime-local"
                  value={settingsForm.deadline}
                  onChange={e => setSettingsForm((p: any) => ({ ...p, deadline: e.target.value }))}
                  className="font-mono text-xs h-8 bg-input"
                />
              </div>
            </CardContent>
          </Card>

          <Button onClick={saveSettings} disabled={savingSettings} className="font-mono text-xs uppercase gap-2">
            {savingSettings ? "Saving..." : <><CheckSquare className="w-3.5 h-3.5" /> Save Settings</>}
          </Button>
        </div>
      )}
    </div>
  );
}
