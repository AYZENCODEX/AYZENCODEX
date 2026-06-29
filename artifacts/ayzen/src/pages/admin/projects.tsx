import { useState } from "react";
import { Link } from "wouter";
import { useListProjects } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Plus, ExternalLink, Activity, X, Zap, Globe, BookOpen, Tag, DollarSign, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface CreateForm {
  name: string;
  description: string;
  twitterHandle: string;
  discordUrl: string;
  websiteUrl: string;
  xpName: string;
  xpPrice: string;
  rewardEstimate: string;
  fundingAmount: string;
  deadline: string;
  category: string;
  tier: string;
  durationType: string;
  difficulty: string;
  costType: string;
  experienceLevel: string;
  tutorialLink: string;
  tutorialNotes: string;
}

const EMPTY_FORM: CreateForm = {
  name: "", description: "",
  twitterHandle: "", discordUrl: "", websiteUrl: "",
  xpName: "", xpPrice: "0.01", rewardEstimate: "", fundingAmount: "", deadline: "",
  category: "DeFi", tier: "1", durationType: "long", difficulty: "average", costType: "free", experienceLevel: "Beginner",
  tutorialLink: "", tutorialNotes: "",
};

type CreateTab = "basic" | "economics" | "meta" | "tutorial";

const CREATE_TABS: { id: CreateTab; label: string; icon: React.ElementType }[] = [
  { id: "basic",     label: "Basic",     icon: Info },
  { id: "economics", label: "Economics", icon: DollarSign },
  { id: "meta",      label: "Meta",      icon: Tag },
  { id: "tutorial",  label: "Tutorial",  icon: BookOpen },
];

const PillSelect = ({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) => (
  <div className="flex flex-wrap gap-1.5">
    {options.map(opt => (
      <button
        key={opt}
        type="button"
        onClick={() => onChange(opt)}
        className={cn(
          "px-3 py-1 rounded-full font-mono text-[10px] border transition-all",
          value === opt
            ? "bg-primary/20 border-primary/50 text-primary font-bold"
            : "border-border/40 text-muted-foreground/60 hover:border-primary/30 hover:text-primary/60"
        )}
      >{opt}</button>
    ))}
  </div>
);

const ALL_CATS = ["All", "DeFi", "NFT", "GameFi", "Layer2", "Testnet", "CEX", "Exchange", "Instant Web3", "TGE", "Social", "Other"];

export default function AdminProjects() {
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("All");
  const [showCreate, setShowCreate] = useState(false);
  const [createTab, setCreateTab] = useState<CreateTab>("basic");
  const [form, setForm] = useState<CreateForm>(EMPTY_FORM);
  const { data, isLoading, refetch } = useListProjects({ search, page: 1, limit: 50 });
  const { toast } = useToast();

  const f = (key: keyof CreateForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const handleCreate = () => {
    if (!form.name.trim()) { toast({ variant: "destructive", title: "Name required" }); return; }
    const token = localStorage.getItem("ayzen_token") ?? "";
    const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
    fetch(`${BASE}/api/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        twitterHandle: form.twitterHandle || undefined,
        discordUrl: form.discordUrl || undefined,
        websiteUrl: form.websiteUrl || undefined,
        xpName: form.xpName.trim() || undefined,
        xpPrice: form.xpPrice ? Number(form.xpPrice) : 0.01,
        rewardEstimate: form.rewardEstimate ? Number(form.rewardEstimate) : 0,
        fundingAmount: form.fundingAmount ? Number(form.fundingAmount) : 0,
        deadline: form.deadline || undefined,
        category: form.category,
        tier: form.tier,
        durationType: form.durationType,
        difficulty: form.difficulty,
        costType: form.costType,
        experienceLevel: form.experienceLevel,
        tutorialLink: form.tutorialLink || undefined,
        tutorialNotes: form.tutorialNotes || undefined,
      }),
    }).then(async r => {
      if (r.ok) {
        toast({ title: "Project created", description: `${form.name} initialized.` });
        setForm(EMPTY_FORM); setShowCreate(false); setCreateTab("basic"); refetch();
      } else {
        const d = await r.json();
        toast({ variant: "destructive", title: "Failed", description: d.error });
      }
    }).catch(() => toast({ variant: "destructive", title: "Connection error" }));
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

      {/* ── Create dialog (4-tab overlay) ── */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-card border border-card-border rounded-xl w-full max-w-xl shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]">
            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-primary to-transparent" />

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-card-border shrink-0">
              <h2 className="font-mono font-bold uppercase tracking-wider text-primary text-sm">Initialize New Protocol</h2>
              <button onClick={() => { setShowCreate(false); setForm(EMPTY_FORM); setCreateTab("basic"); }} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tab navigation */}
            <div className="flex border-b border-border shrink-0 px-2 overflow-x-auto">
              {CREATE_TABS.map(t => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.id}
                    onClick={() => setCreateTab(t.id)}
                    className={cn(
                      "flex items-center gap-1.5 px-4 py-3 font-mono text-[10px] uppercase tracking-wider border-b-2 transition-all -mb-px whitespace-nowrap",
                      createTab === t.id
                        ? "border-primary text-primary font-bold"
                        : "border-transparent text-muted-foreground/50 hover:text-muted-foreground"
                    )}
                  >
                    <Icon className="w-3 h-3" /> {t.label}
                  </button>
                );
              })}
            </div>

            {/* Tab content */}
            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">

              {/* ── Tab 1: Basic ── */}
              {createTab === "basic" && (
                <>
                  <div className="space-y-1.5">
                    <Label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Protocol Name *</Label>
                    <Input value={form.name} onChange={f("name")} placeholder="e.g. LayerZero, zkSync Era" className="bg-input border-border font-mono" autoFocus />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Description</Label>
                    <Textarea value={form.description} onChange={f("description")} placeholder="Describe the protocol and airdrop opportunity..." className="bg-input border-border font-mono resize-none" rows={3} />
                  </div>

                  <div className="rounded-lg border border-sky-500/20 bg-sky-500/5 p-4 space-y-3">
                    <div className="flex items-center gap-1.5">
                      <Globe className="w-3 h-3 text-sky-400" />
                      <span className="font-mono text-[10px] uppercase tracking-widest text-sky-400 font-bold">Social Links</span>
                    </div>
                    <div className="space-y-2">
                      <div className="space-y-1">
                        <Label className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Twitter Handle</Label>
                        <Input value={form.twitterHandle} onChange={f("twitterHandle")} placeholder="@protocol" className="bg-input border-border font-mono text-xs h-8" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Discord URL</Label>
                          <Input value={form.discordUrl} onChange={f("discordUrl")} placeholder="https://discord.gg/..." className="bg-input border-border font-mono text-xs h-8" />
                        </div>
                        <div className="space-y-1">
                          <Label className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Website URL</Label>
                          <Input value={form.websiteUrl} onChange={f("websiteUrl")} placeholder="https://..." className="bg-input border-border font-mono text-xs h-8" />
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* ── Tab 2: Economics ── */}
              {createTab === "economics" && (
                <>
                  <div className="rounded-lg border border-primary/20 bg-primary/3 p-4 space-y-3">
                    <div className="flex items-center gap-1.5">
                      <Zap className="w-3 h-3 text-primary" />
                      <Label className="font-mono text-[10px] uppercase tracking-widest text-primary font-bold">XP System</Label>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="font-mono text-[9px] text-muted-foreground uppercase tracking-widest">XP Token Name</Label>
                        <Input value={form.xpName} onChange={f("xpName")} placeholder="e.g. TXP, ZXP" className="bg-input border-border font-mono text-xs h-8" />
                      </div>
                      <div className="space-y-1">
                        <Label className="font-mono text-[9px] text-muted-foreground uppercase tracking-widest">1 XP = ? AZN</Label>
                        <Input type="number" step="0.001" min="0" value={form.xpPrice} onChange={f("xpPrice")} placeholder="0.01" className="bg-input border-border font-mono text-xs h-8" />
                      </div>
                    </div>
                    <p className="text-[9px] font-mono text-muted-foreground/60">XP earned from tasks × price = AZN auto-awarded on approval</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Funding Amount ($)</Label>
                      <Input type="number" value={form.fundingAmount} onChange={f("fundingAmount")} placeholder="50000000" className="bg-input border-border font-mono" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Est. Reward ($)</Label>
                      <Input type="number" value={form.rewardEstimate} onChange={f("rewardEstimate")} placeholder="1000" className="bg-input border-border font-mono" />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Airdrop Deadline</Label>
                    <Input type="date" value={form.deadline} onChange={f("deadline")} className="bg-input border-border font-mono" />
                    <p className="text-[9px] font-mono text-muted-foreground/50">Leave blank if no known deadline</p>
                  </div>
                </>
              )}

              {/* ── Tab 3: Meta ── */}
              {createTab === "meta" && (
                <>
                  <div className="space-y-1.5">
                    <Label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Category</Label>
                    <PillSelect
                      options={["DeFi", "NFT", "GameFi", "Layer2", "Testnet", "CEX", "Exchange", "Instant Web3", "TGE", "Social", "Other"]}
                      value={form.category}
                      onChange={v => setForm(p => ({ ...p, category: v }))}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Tier</Label>
                      <Select value={form.tier} onValueChange={v => setForm(p => ({ ...p, tier: v }))}>
                        <SelectTrigger className="bg-input border-border font-mono text-xs h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["1", "2", "3", "4", "5"].map(t => <SelectItem key={t} value={t} className="font-mono text-xs">Tier {t}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Experience Level</Label>
                      <Select value={form.experienceLevel} onValueChange={v => setForm(p => ({ ...p, experienceLevel: v }))}>
                        <SelectTrigger className="bg-input border-border font-mono text-xs h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["Beginner", "Intermediate", "Advanced", "Expert"].map(l => <SelectItem key={l} value={l} className="font-mono text-xs">{l}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Duration Type</Label>
                    <PillSelect
                      options={["long", "short", "instant", "micro"]}
                      value={form.durationType}
                      onChange={v => setForm(p => ({ ...p, durationType: v }))}
                    />
                    <p className="text-[9px] font-mono text-muted-foreground/50">Long = months · Short = weeks · Instant = days · Micro = hours</p>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Difficulty</Label>
                    <PillSelect
                      options={["easy", "average", "hard"]}
                      value={form.difficulty}
                      onChange={v => setForm(p => ({ ...p, difficulty: v }))}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Cost Type</Label>
                    <PillSelect
                      options={["free", "paid"]}
                      value={form.costType}
                      onChange={v => setForm(p => ({ ...p, costType: v }))}
                    />
                    <p className="text-[9px] font-mono text-muted-foreground/50">Does completing this airdrop require spending gas/fees?</p>
                  </div>
                </>
              )}

              {/* ── Tab 4: Tutorial ── */}
              {createTab === "tutorial" && (
                <>
                  <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-4 space-y-3">
                    <div className="flex items-center gap-1.5">
                      <BookOpen className="w-3 h-3 text-violet-400" />
                      <span className="font-mono text-[10px] uppercase tracking-widest text-violet-400 font-bold">Tutorial Resource</span>
                    </div>
                    <div className="space-y-1">
                      <Label className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Tutorial URL</Label>
                      <Input
                        value={form.tutorialLink}
                        onChange={f("tutorialLink")}
                        placeholder="https://youtube.com/watch?v=... or https://docs...."
                        className="bg-input border-border font-mono text-xs h-8"
                      />
                    </div>
                    <p className="text-[9px] font-mono text-muted-foreground/60">Operators will see this guide when they open the project</p>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Tutorial Notes</Label>
                    <Textarea
                      value={form.tutorialNotes}
                      onChange={f("tutorialNotes")}
                      placeholder={"Step 1: Connect your wallet to...\nStep 2: Navigate to the bridge...\nStep 3: Complete the transaction..."}
                      className="bg-input border-border font-mono resize-none text-xs"
                      rows={8}
                    />
                    <p className="text-[9px] font-mono text-muted-foreground/50">Markdown-style instructions shown to operators. One step per line.</p>
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-card-border px-6 py-4 flex gap-3 shrink-0">
              <div className="flex gap-1 flex-1 mr-2">
                {CREATE_TABS.map((t, i) => (
                  <div
                    key={t.id}
                    className={cn(
                      "flex-1 h-1 rounded-full transition-all",
                      i <= CREATE_TABS.findIndex(x => x.id === createTab)
                        ? "bg-primary"
                        : "bg-muted/40"
                    )}
                  />
                ))}
              </div>
              <Button
                variant="outline"
                className="font-mono text-xs"
                onClick={() => {
                  const idx = CREATE_TABS.findIndex(t => t.id === createTab);
                  if (idx > 0) setCreateTab(CREATE_TABS[idx - 1].id);
                  else { setShowCreate(false); setForm(EMPTY_FORM); }
                }}
              >
                {createTab === "basic" ? "Cancel" : "Back"}
              </Button>
              {createTab !== "tutorial" ? (
                <Button
                  className="font-mono text-xs"
                  onClick={() => {
                    const idx = CREATE_TABS.findIndex(t => t.id === createTab);
                    setCreateTab(CREATE_TABS[idx + 1].id);
                  }}
                >
                  Next →
                </Button>
              ) : (
                <Button className="font-mono text-xs" onClick={handleCreate}>
                  Initialize Protocol
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">
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
          {catFilter !== "All" && (
            <button onClick={() => setCatFilter("All")} className="flex items-center gap-1 text-xs font-mono text-muted-foreground/50 hover:text-primary transition-colors">
              <X className="w-3 h-3" /> Clear filter
            </button>
          )}
        </div>
        {/* Category filter pills */}
        <div className="flex flex-wrap gap-1.5 pb-1">
          {ALL_CATS.map(cat => (
            <button key={cat} onClick={() => setCatFilter(cat)}
              className={cn("px-2.5 py-1 rounded-lg font-mono text-[10px] border transition-all",
                catFilter === cat
                  ? "border-primary/50 bg-primary/10 text-primary font-bold"
                  : "border-border/30 text-muted-foreground/50 hover:border-primary/20 hover:text-muted-foreground")}>
              {cat}
            </button>
          ))}
        </div>
      </div>

      {(() => {
        const allProjects = data?.projects ?? [];
        const projects = catFilter === "All" ? allProjects : allProjects.filter((p: any) => p.category === catFilter);
        return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="bg-card border-card-border shadow-none">
              <CardHeader className="pb-2"><Skeleton className="h-6 w-3/4" /><Skeleton className="h-4 w-1/2 mt-2" /></CardHeader>
              <CardContent><div className="space-y-2 mt-4"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-full" /></div></CardContent>
              <CardFooter><Skeleton className="h-8 w-full" /></CardFooter>
            </Card>
          ))
        ) : projects.length === 0 ? (
          <div className="col-span-full py-12 text-center font-mono text-muted-foreground bg-card border border-card-border rounded-md">
            No active protocols in the database.{" "}
            <button onClick={() => setShowCreate(true)} className="text-primary hover:underline">Initialize one now.</button>
          </div>
        ) : (
          projects.map((project: any) => (
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
        );
      })()}
    </div>
  );
}
