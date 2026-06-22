import { useState } from "react";
import { useListTasks } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Plus, CheckSquare, ClipboardList, Check, X, ExternalLink, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

interface Submission {
  id: number;
  taskId: number;
  taskName: string | null;
  userId: number;
  username: string | null;
  status: string;
  proofUrl: string | null;
  notes: string | null;
  submittedAt: string;
  reviewedAt: string | null;
}

type Tab = "tasks" | "submissions";

export default function AdminTasks() {
  const { data, isLoading, refetch } = useListTasks();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [tab, setTab] = useState<Tab>("tasks");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "", description: "", projectId: "",
    rewardAmount: "", taskType: "One-time", verificationType: "manual",
  });

  // Submissions state
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [subsLoading, setSubsLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [verifying, setVerifying] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectDialog, setRejectDialog] = useState<Submission | null>(null);

  const resetForm = () => setForm({ name: "", description: "", projectId: "", rewardAmount: "", taskType: "One-time", verificationType: "manual" });

  const loadSubmissions = async (status = statusFilter) => {
    setSubsLoading(true);
    try {
      const token = localStorage.getItem("ayzen_token") ?? "";
      const res = await fetch(`${BASE}/api/tasks/submissions?status=${status}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSubmissions(data);
      }
    } catch {
      toast({ variant: "destructive", title: "Failed to load submissions" });
    }
    setSubsLoading(false);
  };

  const handleTabChange = (t: Tab) => {
    setTab(t);
    if (t === "submissions") loadSubmissions();
  };

  const handleFilterChange = (status: string) => {
    setStatusFilter(status);
    loadSubmissions(status);
  };

  const handleApprove = async (sub: Submission) => {
    setVerifying(sub.id);
    try {
      const token = localStorage.getItem("ayzen_token") ?? "";
      const res = await fetch(`${BASE}/api/tasks/${sub.taskId}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ submissionId: sub.id, approved: true }),
      });
      if (res.ok) {
        toast({ title: "Approved ✓", description: `Task "${sub.taskName}" approved for ${sub.username ?? `User #${sub.userId}`}` });
        loadSubmissions();
        queryClient.invalidateQueries();
      } else {
        const d = await res.json();
        toast({ variant: "destructive", title: "Failed", description: d.error });
      }
    } catch {
      toast({ variant: "destructive", title: "Connection error" });
    }
    setVerifying(null);
  };

  const handleReject = async () => {
    if (!rejectDialog) return;
    setVerifying(rejectDialog.id);
    try {
      const token = localStorage.getItem("ayzen_token") ?? "";
      const res = await fetch(`${BASE}/api/tasks/${rejectDialog.taskId}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ submissionId: rejectDialog.id, approved: false, rejectionReason: rejectReason || "Rejected by admin" }),
      });
      if (res.ok) {
        toast({ title: "Rejected", description: `Submission rejected for ${rejectDialog.username ?? `User #${rejectDialog.userId}`}` });
        setRejectDialog(null);
        setRejectReason("");
        loadSubmissions();
      } else {
        const d = await res.json();
        toast({ variant: "destructive", title: "Failed", description: d.error });
      }
    } catch {
      toast({ variant: "destructive", title: "Connection error" });
    }
    setVerifying(null);
  };

  const handleCreate = async () => {
    if (!form.name || !form.projectId) {
      toast({ variant: "destructive", title: "Task name and Project ID are required." });
      return;
    }
    setSaving(true);
    try {
      const token = localStorage.getItem("ayzen_token") ?? "";
      const res = await fetch(`${BASE}/api/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: form.name,
          description: form.description || undefined,
          projectId: parseInt(form.projectId, 10),
          rewardAmount: form.rewardAmount ? parseFloat(form.rewardAmount) : undefined,
          taskType: form.taskType,
          verificationType: form.verificationType,
        }),
      });
      if (res.ok) {
        toast({ title: "Task created", description: `"${form.name}" added to the protocol.` });
        queryClient.invalidateQueries();
        refetch();
        setOpen(false);
        resetForm();
      } else {
        const d = await res.json();
        toast({ variant: "destructive", title: "Failed", description: d.error });
      }
    } catch {
      toast({ variant: "destructive", title: "Connection error" });
    }
    setSaving(false);
  };

  const statusColor: Record<string, string> = {
    pending: "text-yellow-400 border-yellow-400/30 bg-yellow-400/10",
    approved: "text-green-400 border-green-400/30 bg-green-400/10",
    rejected: "text-red-400 border-red-400/30 bg-red-400/10",
  };

  return (
    <div className="space-y-6 page-enter">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-mono tracking-tighter uppercase flex items-center gap-2">
            <CheckSquare className="w-6 h-6 text-primary" /> Task Execution
          </h1>
          <p className="text-muted-foreground font-mono text-sm">Define, monitor, and verify protocol operations</p>
        </div>
        {tab === "tasks" && (
          <Button className="font-mono uppercase text-xs tracking-wider gap-2 animate-glow-pulse" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> New Task
          </Button>
        )}
        {tab === "submissions" && (
          <Button variant="outline" className="font-mono uppercase text-xs tracking-wider gap-2" onClick={() => loadSubmissions()}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-card border border-card-border rounded-lg p-1 w-fit">
        {(["tasks", "submissions"] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => handleTabChange(t)}
            className={`px-4 py-2 rounded-md font-mono text-xs uppercase tracking-wider transition-colors ${tab === t ? "bg-primary text-black font-bold" : "text-muted-foreground hover:text-foreground"}`}
          >
            {t === "tasks" ? <span className="flex items-center gap-1.5"><CheckSquare className="w-3.5 h-3.5" /> Tasks</span>
              : <span className="flex items-center gap-1.5"><ClipboardList className="w-3.5 h-3.5" /> Submissions {t === "submissions" && submissions.filter(s => s.status === "pending").length > 0 ? <span className="bg-yellow-400 text-black rounded-full w-4 h-4 flex items-center justify-center text-[9px] font-bold">{submissions.filter(s => s.status === "pending").length}</span> : null}</span>}
          </button>
        ))}
      </div>

      {/* Tasks Tab */}
      {tab === "tasks" && (
        <div className="border border-card-border rounded-xl bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-card-border hover:bg-transparent">
                <TableHead className="font-mono uppercase text-[10px] tracking-widest text-muted-foreground">Task Name</TableHead>
                <TableHead className="font-mono uppercase text-[10px] tracking-widest text-muted-foreground">Protocol</TableHead>
                <TableHead className="font-mono uppercase text-[10px] tracking-widest text-muted-foreground">Type</TableHead>
                <TableHead className="font-mono uppercase text-[10px] tracking-widest text-muted-foreground">Verification</TableHead>
                <TableHead className="font-mono uppercase text-[10px] tracking-widest text-muted-foreground text-right">Reward</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i} className="border-card-border">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : !data || data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-14 font-mono text-muted-foreground/50">
                    <div className="flex flex-col items-center gap-3">
                      <CheckSquare className="w-8 h-8 opacity-20" />
                      <span className="text-sm">No tasks yet — click New Task to create one</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                data.map((task) => (
                  <TableRow key={task.id} className="border-card-border hover:bg-primary/3 transition-colors">
                    <TableCell className="font-mono font-medium text-sm">{task.name}</TableCell>
                    <TableCell className="font-mono text-muted-foreground text-xs">{task.projectName || `#${task.projectId}`}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-[10px] uppercase rounded-sm border-primary/20 text-primary/70">
                        {task.taskType}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-mono text-[10px] uppercase rounded-sm">
                        {task.verificationType}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold text-primary">
                      {task.rewardAmount ? `$${task.rewardAmount}` : "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Submissions Tab */}
      {tab === "submissions" && (
        <div className="space-y-4">
          {/* Filter */}
          <div className="flex gap-2 flex-wrap">
            {["pending", "approved", "rejected"].map(s => (
              <button
                key={s}
                onClick={() => handleFilterChange(s)}
                className={`px-3 py-1.5 rounded-md font-mono text-[10px] uppercase tracking-widest border transition-colors ${statusFilter === s ? statusColor[s] : "border-border text-muted-foreground hover:border-primary/30"}`}
              >
                {s}
              </button>
            ))}
          </div>

          <div className="border border-card-border rounded-xl bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-card-border hover:bg-transparent">
                  <TableHead className="font-mono uppercase text-[10px] tracking-widest text-muted-foreground">User</TableHead>
                  <TableHead className="font-mono uppercase text-[10px] tracking-widest text-muted-foreground">Task</TableHead>
                  <TableHead className="font-mono uppercase text-[10px] tracking-widest text-muted-foreground">Proof / Notes</TableHead>
                  <TableHead className="font-mono uppercase text-[10px] tracking-widest text-muted-foreground">Submitted</TableHead>
                  <TableHead className="font-mono uppercase text-[10px] tracking-widest text-muted-foreground">Status</TableHead>
                  {statusFilter === "pending" && (
                    <TableHead className="font-mono uppercase text-[10px] tracking-widest text-muted-foreground text-right">Actions</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {subsLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i} className="border-card-border">
                      {Array.from({ length: 5 }).map((_, j) => (
                        <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : submissions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-14 font-mono text-muted-foreground/50">
                      <div className="flex flex-col items-center gap-3">
                        <ClipboardList className="w-8 h-8 opacity-20" />
                        <span className="text-sm">No {statusFilter} submissions</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  submissions.map((sub) => (
                    <TableRow key={sub.id} className="border-card-border hover:bg-primary/3 transition-colors">
                      <TableCell className="font-mono text-sm font-medium">{sub.username ?? `#${sub.userId}`}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{sub.taskName ?? `Task #${sub.taskId}`}</TableCell>
                      <TableCell className="max-w-[200px]">
                        {sub.proofUrl ? (
                          <a href={sub.proofUrl} target="_blank" rel="noreferrer"
                            className="font-mono text-xs text-primary flex items-center gap-1 hover:underline truncate">
                            <ExternalLink className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate">{sub.proofUrl}</span>
                          </a>
                        ) : sub.notes ? (
                          <span className="font-mono text-xs text-muted-foreground truncate">{sub.notes}</span>
                        ) : (
                          <span className="text-muted-foreground/30 font-mono text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {new Date(sub.submittedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </TableCell>
                      <TableCell>
                        <span className={`px-2 py-0.5 rounded font-mono text-[10px] uppercase border ${statusColor[sub.status] ?? "border-border text-muted-foreground"}`}>
                          {sub.status}
                        </span>
                      </TableCell>
                      {statusFilter === "pending" && (
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button size="sm" variant="ghost"
                              className="h-7 px-2.5 font-mono text-[10px] text-green-400 hover:text-green-300 hover:bg-green-400/10 gap-1"
                              disabled={verifying === sub.id}
                              onClick={() => handleApprove(sub)}>
                              <Check className="w-3 h-3" /> Approve
                            </Button>
                            <Button size="sm" variant="ghost"
                              className="h-7 px-2.5 font-mono text-[10px] text-red-400 hover:text-red-300 hover:bg-red-400/10 gap-1"
                              disabled={verifying === sub.id}
                              onClick={() => { setRejectDialog(sub); setRejectReason(""); }}>
                              <X className="w-3 h-3" /> Reject
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Create Task Dialog */}
      <Dialog open={open} onOpenChange={o => { setOpen(o); if (!o) resetForm(); }}>
        <DialogContent className="bg-card border-card-border max-w-md">
          <DialogHeader>
            <DialogTitle className="font-mono uppercase tracking-wider text-primary flex items-center gap-2">
              <Plus className="w-4 h-4" /> New Task
            </DialogTitle>
            <p className="text-xs font-mono text-muted-foreground">Assign a task to a project. Operators will see and submit it.</p>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Task Name *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="font-mono text-xs h-9 bg-input" placeholder="e.g. Daily Check-in" />
            </div>
            <div className="space-y-1.5">
              <Label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Project ID *</Label>
              <Input value={form.projectId} onChange={e => setForm(f => ({ ...f, projectId: e.target.value.replace(/\D/g, "") }))} className="font-mono text-xs h-9 bg-input" placeholder="Project ID number" type="number" />
            </div>
            <div className="space-y-1.5">
              <Label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Description</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="font-mono text-xs bg-input min-h-[60px] resize-none" placeholder="What operators need to do..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Type</Label>
                <Select value={form.taskType} onValueChange={v => setForm(f => ({ ...f, taskType: v }))}>
                  <SelectTrigger className="font-mono text-xs h-9 border-border bg-input"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["One-time", "Daily", "Weekly", "Recurring"].map(t => <SelectItem key={t} value={t} className="font-mono text-xs">{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Verification</Label>
                <Select value={form.verificationType} onValueChange={v => setForm(f => ({ ...f, verificationType: v }))}>
                  <SelectTrigger className="font-mono text-xs h-9 border-border bg-input"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["manual", "auto"].map(t => <SelectItem key={t} value={t} className="font-mono text-xs">{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Reward Amount (USD)</Label>
              <Input value={form.rewardAmount} onChange={e => setForm(f => ({ ...f, rewardAmount: e.target.value }))} className="font-mono text-xs h-9 bg-input" placeholder="e.g. 5.00" type="number" step="0.01" />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setOpen(false); resetForm(); }} className="font-mono text-xs">Cancel</Button>
            <Button onClick={handleCreate} disabled={saving} className="font-mono text-xs gap-2">
              <Plus className="w-3 h-3" />{saving ? "Creating..." : "Create Task"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={!!rejectDialog} onOpenChange={o => { if (!o) { setRejectDialog(null); setRejectReason(""); } }}>
        <DialogContent className="bg-card border-card-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-mono uppercase tracking-wider text-red-400 flex items-center gap-2">
              <X className="w-4 h-4" /> Reject Submission
            </DialogTitle>
            <p className="text-xs font-mono text-muted-foreground">
              Rejecting <strong>{rejectDialog?.username}</strong>'s submission for "{rejectDialog?.taskName}"
            </p>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Reason (optional)</Label>
            <Textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} className="font-mono text-xs bg-input resize-none min-h-[80px]" placeholder="e.g. Proof not valid, wrong wallet, etc." />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setRejectDialog(null); setRejectReason(""); }} className="font-mono text-xs">Cancel</Button>
            <Button onClick={handleReject} disabled={verifying === rejectDialog?.id} className="font-mono text-xs gap-2 bg-red-500 hover:bg-red-600 text-white">
              <X className="w-3 h-3" /> Confirm Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
