import { useState } from "react";
import { Link } from "wouter";
import { useListProjects, useCreateProject } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Plus, ExternalLink, Activity, X, Loader2, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CreateForm {
  name: string;
  description: string;
  xpName: string;
  tier: string;
  fundingAmount: string;
  rewardEstimate: string;
  twitterHandle: string;
  discordUrl: string;
  websiteUrl: string;
  experienceLevel: string;
}

const EMPTY_FORM: CreateForm = {
  name: "", description: "", xpName: "", tier: "1", fundingAmount: "", rewardEstimate: "",
  twitterHandle: "", discordUrl: "", websiteUrl: "", experienceLevel: "Beginner",
};

export default function AdminProjects() {
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<CreateForm>(EMPTY_FORM);
  const { data, isLoading, refetch } = useListProjects({ search, page: 1, limit: 50 });
  const createProject = useCreateProject();
  const { toast } = useToast();

  const setField = (key: keyof CreateForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleCreate = () => {
    if (!form.name.trim()) {
      toast({ variant: "destructive", title: "Name required" }); return;
    }
    createProject.mutate(
      {
        data: {
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          xpName: form.xpName.trim() || undefined,
          tier: form.tier as any,
          fundingAmount: form.fundingAmount ? Number(form.fundingAmount) : 0,
          rewardEstimate: form.rewardEstimate ? Number(form.rewardEstimate) : 0,
          twitterHandle: form.twitterHandle || undefined,
          discordUrl: form.discordUrl || undefined,
          websiteUrl: form.websiteUrl || undefined,
          experienceLevel: form.experienceLevel as any,
        } as any,
      },
      {
        onSuccess: () => {
          toast({ title: "Project created", description: `${form.name} added to the database.` });
          setForm(EMPTY_FORM);
          setShowCreate(false);
          refetch();
        },
        onError: (err: any) => {
          toast({ variant: "destructive", title: "Failed", description: err?.message ?? "Could not create project" });
        },
      }
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-mono tracking-tighter uppercase">Project Database</h1>
          <p className="text-muted-foreground font-mono text-sm">Manage airdrop campaigns and protocols</p>
        </div>
        <Button className="font-mono uppercase text-xs tracking-wider gap-2" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4" /> Initialize Project
        </Button>
      </div>

      {/* Create dialog (inline overlay) */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-card border border-card-border rounded-lg w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-card-border sticky top-0 bg-card z-10">
              <h2 className="font-mono font-bold uppercase tracking-wider text-primary">Initialize New Protocol</h2>
              <button onClick={() => setShowCreate(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <Label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Protocol Name *</Label>
                <Input value={form.name} onChange={setField("name")} placeholder="e.g. LayerZero, zkSync Era" className="bg-input border-border font-mono" />
              </div>

              <div className="space-y-2">
                <Label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Description</Label>
                <Textarea value={form.description} onChange={setField("description")} placeholder="Describe the protocol and airdrop opportunity..." className="bg-input border-border font-mono resize-none" rows={3} />
              </div>

              {/* XP Token Name */}
              <div className="space-y-2 p-3 rounded-lg border border-primary/20 bg-primary/3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Zap className="w-3 h-3 text-primary" />
                  <Label className="font-mono text-[10px] uppercase tracking-widest text-primary font-bold">XP Token Name</Label>
                </div>
                <Input
                  value={form.xpName}
                  onChange={setField("xpName")}
                  placeholder="e.g. TXP, ZXP, LZXP"
                  className="bg-input border-border font-mono"
                />
                <p className="text-[10px] font-mono text-muted-foreground/60">Custom XP label for this project's experience points</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Tier</Label>
                  <Select value={form.tier} onValueChange={(v) => setForm((f) => ({ ...f, tier: v }))}>
                    <SelectTrigger className="bg-input border-border font-mono">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["1", "2", "3", "4", "5"].map((t) => (
                        <SelectItem key={t} value={t} className="font-mono">Tier {t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Experience Level</Label>
                  <Select value={form.experienceLevel} onValueChange={(v) => setForm((f) => ({ ...f, experienceLevel: v }))}>
                    <SelectTrigger className="bg-input border-border font-mono">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["Beginner", "Intermediate", "Advanced", "Expert"].map((l) => (
                        <SelectItem key={l} value={l} className="font-mono">{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Funding ($)</Label>
                  <Input type="number" value={form.fundingAmount} onChange={setField("fundingAmount")} placeholder="50000000" className="bg-input border-border font-mono" />
                </div>
                <div className="space-y-2">
                  <Label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Est. Reward ($)</Label>
                  <Input type="number" value={form.rewardEstimate} onChange={setField("rewardEstimate")} placeholder="1000" className="bg-input border-border font-mono" />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Twitter Handle</Label>
                <Input value={form.twitterHandle} onChange={setField("twitterHandle")} placeholder="@protocol" className="bg-input border-border font-mono" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Discord URL</Label>
                  <Input value={form.discordUrl} onChange={setField("discordUrl")} placeholder="https://discord.gg/..." className="bg-input border-border font-mono" />
                </div>
                <div className="space-y-2">
                  <Label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Website URL</Label>
                  <Input value={form.websiteUrl} onChange={setField("websiteUrl")} placeholder="https://..." className="bg-input border-border font-mono" />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1 font-mono uppercase text-xs" onClick={() => { setShowCreate(false); setForm(EMPTY_FORM); }}>
                  Cancel
                </Button>
                <Button className="flex-1 font-mono uppercase text-xs" onClick={handleCreate} disabled={createProject.isPending}>
                  {createProject.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Initialize Protocol"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by protocol name..."
            className="pl-9 font-mono bg-card border-card-border"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="bg-card border-card-border shadow-none">
              <CardHeader className="pb-2"><Skeleton className="h-6 w-3/4" /><Skeleton className="h-4 w-1/2 mt-2" /></CardHeader>
              <CardContent><div className="space-y-2 mt-4"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-full" /></div></CardContent>
              <CardFooter><Skeleton className="h-8 w-full" /></CardFooter>
            </Card>
          ))
        ) : data?.projects.length === 0 ? (
          <div className="col-span-full py-12 text-center font-mono text-muted-foreground bg-card border border-card-border rounded-md">
            No active protocols in the database.{" "}
            <button onClick={() => setShowCreate(true)} className="text-primary hover:underline">Initialize one now.</button>
          </div>
        ) : (
          data?.projects.map((project) => (
            <Card key={project.id} className="bg-card border-card-border shadow-none flex flex-col group hover:border-primary/50 transition-colors">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <CardTitle className="font-mono font-bold truncate pr-2 text-primary">{project.name}</CardTitle>
                  <Badge variant="outline" className="font-mono text-[10px] uppercase rounded-sm border-primary/30">Tier {project.tier}</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-xs font-mono text-muted-foreground truncate">Funding: ${project.fundingAmount?.toLocaleString() ?? 0}</div>
                  {(project as any).xpName && (
                    <Badge variant="outline" className="font-mono text-[9px] uppercase border-yellow-500/30 text-yellow-400 bg-yellow-400/5 flex items-center gap-1">
                      <Zap className="w-2.5 h-2.5" />{(project as any).xpName}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="flex-1">
                <p className="text-sm text-muted-foreground line-clamp-3 mb-4">{project.description ?? "No data provided."}</p>
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="bg-background/50 rounded p-2 border border-border">
                    <div className="text-muted-foreground mb-1 uppercase">Operators</div>
                    <div className="font-bold">{project.activeUserCount ?? 0}</div>
                  </div>
                  <div className="bg-background/50 rounded p-2 border border-border">
                    <div className="text-muted-foreground mb-1 uppercase">Tasks</div>
                    <div className="font-bold">{project.taskCount ?? 0}</div>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="pt-0 flex gap-2">
                <Link href={`/admin/projects/${project.id}`} className="flex-1">
                  <Button variant="outline" className="w-full font-mono text-xs uppercase bg-transparent border-card-border hover:bg-primary/10 hover:text-primary">
                    <Activity className="h-3 w-3 mr-2" /> Details
                  </Button>
                </Link>
                {project.websiteUrl && (
                  <Button variant="ghost" size="icon" className="border border-card-border hover:bg-primary/10 hover:text-primary" onClick={() => window.open(project.websiteUrl!, "_blank")}>
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                )}
              </CardFooter>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
