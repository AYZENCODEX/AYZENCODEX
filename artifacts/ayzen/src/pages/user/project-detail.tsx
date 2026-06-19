import { useState } from "react";
import { useGetProject, useListVaultEntries } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ArrowLeft, ExternalLink, UserPlus, Hash, CheckCircle2, Clock, Twitter, MessageCircle, Wallet, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

interface Enrollment {
  id: number;
  vaultEntryId: number;
  status: string;
  enrolledAt: string;
  entity: {
    id: number;
    entitySerial: string;
    projectName: string;
    category: string;
    twitterUsername?: string;
    discordUsername?: string;
    walletAddresses?: string[];
    email?: string;
  } | null;
}

function TaskRow({ task }: { task: any }) {
  const [open, setOpen] = useState(false);
  const statusColor = task.userStatus === "completed" ? "text-green-400" : task.userStatus === "pending" ? "text-yellow-400" : "text-muted-foreground";

  return (
    <div className="border border-card-border rounded-md overflow-hidden">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/10 transition-colors text-left">
        <div className={`flex-shrink-0 ${statusColor}`}>
          {task.userStatus === "completed" ? <CheckCircle2 className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-mono text-sm font-medium text-foreground truncate">{task.name}</div>
          <div className="text-[10px] font-mono text-muted-foreground uppercase">{task.taskType} · {task.verificationType}</div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="text-xs font-mono font-bold text-primary">${task.rewardAmount}</span>
          {open ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
        </div>
      </button>
      {open && (
        <div className="border-t border-card-border px-4 py-3 bg-muted/5">
          <p className="text-xs font-mono text-muted-foreground leading-relaxed mb-3">{task.description}</p>
          <Button size="sm" className="font-mono text-[10px] uppercase tracking-wider h-7">
            Mark Complete
          </Button>
        </div>
      )}
    </div>
  );
}

export default function UserProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const projectId = parseInt(id || "0", 10);
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: project, isLoading } = useGetProject(projectId, { query: { enabled: !!projectId } });
  const { data: vaultEntries } = useListVaultEntries();

  const [enrollOpen, setEnrollOpen] = useState(false);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loadingEnroll, setLoadingEnroll] = useState<number | null>(null);
  const [enrollLoaded, setEnrollLoaded] = useState(false);

  const token = localStorage.getItem("ayzen_token") || "";

  const loadEnrollments = async () => {
    if (enrollLoaded) return;
    try {
      const res = await fetch(`/api/projects/${projectId}/enrollments`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) { setEnrollments(await res.json()); setEnrollLoaded(true); }
    } catch {}
  };

  const handleEnroll = async (vaultEntryId: number) => {
    setLoadingEnroll(vaultEntryId);
    try {
      const res = await fetch(`/api/projects/${projectId}/enroll`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ vaultEntryId }),
      });
      const data = await res.json();
      if (!res.ok) { toast({ variant: "destructive", title: data.error || "Enrollment failed" }); return; }
      toast({ title: "Entity enrolled!", description: `Successfully enrolled in ${project?.name}.` });
      // Refresh enrollments
      const res2 = await fetch(`/api/projects/${projectId}/enrollments`, { headers: { Authorization: `Bearer ${token}` } });
      if (res2.ok) setEnrollments(await res2.json());
    } catch { toast({ variant: "destructive", title: "Network error" }); }
    finally { setLoadingEnroll(null); }
  };

  const handleUnenroll = async (enrollmentId: number) => {
    try {
      await fetch(`/api/projects/${projectId}/enrollments/${enrollmentId}`, {
        method: "DELETE", headers: { Authorization: `Bearer ${token}` },
      });
      setEnrollments(e => e.filter(x => x.id !== enrollmentId));
      toast({ title: "Entity removed from project" });
    } catch { toast({ variant: "destructive", title: "Failed to remove" }); }
  };

  const openEnrollModal = () => { loadEnrollments(); setEnrollOpen(true); };
  const enrolledIds = new Set(enrollments.map(e => e.vaultEntryId));
  const tasks = (project as any)?.tasks ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/projects">
          <Button variant="ghost" size="icon" className="h-8 w-8"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold font-mono tracking-tighter uppercase truncate">
            {isLoading ? <Skeleton className="h-7 w-48 inline-block" /> : project?.name}
          </h1>
          <p className="text-muted-foreground font-mono text-xs">Protocol Terminal · {enrollments.length} entit{enrollments.length === 1 ? "y" : "ies"} enrolled</p>
        </div>
        <Button onClick={openEnrollModal} className="font-mono text-xs gap-2 uppercase flex-shrink-0" size="sm">
          <UserPlus className="w-3.5 h-3.5" /> Enroll Entity
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* Protocol info */}
          <Card className="bg-card border-card-border shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-mono uppercase text-primary">Protocol Intel</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-16 w-full" /> : (
                <p className="text-muted-foreground text-sm font-mono leading-relaxed">{project?.description || 'No description available.'}</p>
              )}
            </CardContent>
          </Card>

          {/* Tasks inside project */}
          <Card className="bg-card border-card-border shadow-none">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-mono uppercase text-primary">Assigned Tasks</CardTitle>
              {tasks.length > 0 && (
                <Badge variant="outline" className="font-mono text-[10px] border-primary/20">{tasks.length} tasks</Badge>
              )}
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
              ) : tasks.length === 0 ? (
                <div className="text-center py-8 font-mono text-muted-foreground text-sm">No tasks assigned to this protocol yet.</div>
              ) : (
                <div className="space-y-2">
                  {tasks.map((task: any) => <TaskRow key={task.id} task={task} />)}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Enrolled entities */}
          {enrollments.length > 0 && (
            <Card className="bg-card border-card-border shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-mono uppercase text-primary">Enrolled Entities</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {enrollments.map(enr => (
                    <div key={enr.id} className="flex items-center gap-3 p-3 bg-muted/10 border border-card-border rounded-md group">
                      <Hash className="w-4 h-4 text-primary flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-mono text-sm font-bold text-primary">{enr.entity?.entitySerial || `#${enr.vaultEntryId}`}</div>
                        <div className="text-[10px] font-mono text-muted-foreground">{enr.entity?.projectName}</div>
                      </div>
                      <Badge variant="outline" className="font-mono text-[9px] border-green-500/30 text-green-400">{enr.status}</Badge>
                      <button onClick={() => handleUnenroll(enr.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-400 transition-all flex-shrink-0">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Side panel */}
        <div className="space-y-4">
          <Card className="bg-card border-card-border shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-mono uppercase text-primary">Data Profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 font-mono text-sm">
              {[
                { label: "Tier", value: project?.tier ? <Badge variant="outline" className="text-[10px] rounded-sm border-primary/30">Tier {project.tier}</Badge> : "-" },
                { label: "Funding", value: `$${project?.fundingAmount?.toLocaleString() ?? 0}` },
                { label: "Est. Reward", value: <span className="text-primary font-bold">${project?.rewardEstimate?.toLocaleString() ?? 0}</span> },
                { label: "Difficulty", value: project?.experienceLevel ?? "-" },
                { label: "Members", value: (project as any)?.activeUserCount ?? 0 },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between items-center border-b border-card-border pb-2 last:border-0 last:pb-0">
                  <span className="text-muted-foreground text-xs">{label}</span>
                  <span className="text-xs">{value}</span>
                </div>
              ))}
              {project?.websiteUrl && (
                <Button variant="outline" className="w-full mt-2 bg-transparent border-primary/20 text-primary hover:bg-primary/10 font-mono text-xs uppercase" onClick={() => window.open(project.websiteUrl!, '_blank')}>
                  <ExternalLink className="h-3 w-3 mr-2" /> Launch Protocol
                </Button>
              )}
            </CardContent>
          </Card>

          {project?.twitterHandle && (
            <Card className="bg-card border-card-border shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-mono uppercase text-primary">Links</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {project.twitterHandle && (
                  <a href={`https://twitter.com/${project.twitterHandle.replace('@', '')}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-xs font-mono text-muted-foreground hover:text-primary transition-colors">
                    <Twitter className="w-3.5 h-3.5" /> {project.twitterHandle}
                  </a>
                )}
                {project.discordUrl && (
                  <a href={project.discordUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-xs font-mono text-muted-foreground hover:text-violet-400 transition-colors">
                    <MessageCircle className="w-3.5 h-3.5" /> Discord Server
                  </a>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Enroll Entity Modal */}
      <Dialog open={enrollOpen} onOpenChange={setEnrollOpen}>
        <DialogContent className="bg-card border-card-border max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-mono uppercase tracking-wider text-primary flex items-center gap-2">
              <UserPlus className="w-4 h-4" /> Enroll Entity
            </DialogTitle>
            <p className="text-xs font-mono text-muted-foreground">Select a vault entity to enroll in <span className="text-foreground">{project?.name}</span>. Each entity represents one account identity.</p>
          </DialogHeader>
          <div className="space-y-2 py-2">
            {!vaultEntries || vaultEntries.length === 0 ? (
              <div className="text-center py-8 font-mono text-muted-foreground text-xs">
                No vault entities found. <Link href="/vault" className="text-primary hover:underline">Create one first.</Link>
              </div>
            ) : (
              vaultEntries.map(entry => {
                const isEnrolled = enrolledIds.has(entry.id);
                const isLoading = loadingEnroll === entry.id;
                return (
                  <div key={entry.id} className={`flex items-center gap-3 p-3 border rounded-md transition-colors ${isEnrolled ? "border-green-500/30 bg-green-500/5" : "border-card-border hover:border-primary/30 bg-muted/5"}`}>
                    <Hash className={`w-4 h-4 flex-shrink-0 ${isEnrolled ? "text-green-400" : "text-primary"}`} />
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
                      <Button size="sm" onClick={() => handleEnroll(entry.id)} disabled={isLoading} className="font-mono text-[10px] h-7 px-3 flex-shrink-0">
                        {isLoading ? "..." : "Enroll"}
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
    </div>
  );
}
