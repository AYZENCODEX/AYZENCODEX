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
import { Plus, CheckSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

export default function AdminTasks() {
  const { data, isLoading, refetch } = useListTasks();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "", description: "", projectId: "",
    rewardAmount: "", taskType: "One-time", verificationType: "manual",
  });

  const resetForm = () => setForm({ name: "", description: "", projectId: "", rewardAmount: "", taskType: "One-time", verificationType: "manual" });

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

  return (
    <div className="space-y-6 page-enter">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-mono tracking-tighter uppercase flex items-center gap-2">
            <CheckSquare className="w-6 h-6 text-primary" /> Task Execution
          </h1>
          <p className="text-muted-foreground font-mono text-sm">Define and monitor protocol operations</p>
        </div>
        <Button className="font-mono uppercase text-xs tracking-wider gap-2 animate-glow-pulse" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> New Task
        </Button>
      </div>

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
    </div>
  );
}
