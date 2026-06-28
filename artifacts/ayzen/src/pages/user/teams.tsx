import { useState, useEffect, useRef } from "react";
import { customFetch } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Users, Plus, Send, MessageCircle, Settings, Crown,
  UserPlus, Trash2, ChevronRight, RefreshCw,
  BarChart2, FolderGit2, Loader2, Trophy, TrendingUp,
  Activity, Star, Zap, Shield, Medal, Target, CheckCircle2,
  KeyRound, Clock, Check, X, Lock, Wallet, Swords, ListTodo,
  Bell, ChevronDown, ChevronUp,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";

type Team = { id: number; name: string; description?: string; owner_id: number; member_count: number; member_role: string; status: string; created_at: string };
type Member = { id: number; user_id: number; team_id: number; role: string; status: string; username: string; email: string; joined_at: string; total_roi?: number; streak?: number };
type Message = { id: number; team_id: number; user_id: number; message: string; created_at: string; username?: string };
type TeamDetail = Team & { members: Member[]; myRole: string };
type TeamStats = { memberCount: number; messageCount: number; projectCount: number; totalRoi: number; recentActivity: any[] };
type LeaderboardEntry = { user_id: number; role: string; username: string; total_roi: number; streak: number; tasks_completed: number; messages_sent: number; azn_balance: number; rank: number };
type TeamProject = { id: number; name: string; status: string; task_count: number; participant_count: number; created_at: string; category?: string };
type Mission = { id: number; team_id: number; title: string; description?: string; status: string; target_value: number; current_value: number; reward_amount: number; deadline?: string; created_by: number; created_by_username?: string; created_at: string };
type VaultEntry = { id: number; project_name: string; category: string; email?: string; twitter_username?: string; discord_username?: string; telegram_username?: string; entity_serial?: string; user_id: number; username?: string; created_at: string };
type PendingInvite = { id: number; team_id: number; team_name: string; invited_by_username?: string; invited_at: string };

type Tab = "dashboard" | "members" | "vault" | "missions" | "tasks" | "leaderboard" | "projects" | "chat" | "panel";

function Avatar({ name, size = "md", role }: { name: string; size?: "sm" | "md" | "lg"; role?: string }) {
  const sizes = { sm: "w-6 h-6 text-[9px]", md: "w-8 h-8 text-xs", lg: "w-10 h-10 text-sm" };
  return (
    <div className={cn("rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center font-mono font-bold text-primary relative flex-shrink-0", sizes[size])}>
      {(name || "?")[0].toUpperCase()}
      {role === "leader" && (
        <span className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-500 rounded-full flex items-center justify-center">
          <Crown className="w-1.5 h-1.5 text-background" />
        </span>
      )}
    </div>
  );
}

// ─── Pending Invites Banner ───────────────────────────────────────────────────
function PendingInvitesBanner({ onAccepted }: { onAccepted: () => void }) {
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    customFetch<PendingInvite[]>("/teams/my-invites")
      .then(d => setInvites(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const respond = async (teamId: number, action: "accept" | "reject") => {
    try {
      await customFetch(`/teams/${teamId}/invites/respond`, { method: "PATCH", body: JSON.stringify({ action }) });
      setInvites(prev => prev.filter(i => i.team_id !== teamId));
      toast({ title: action === "accept" ? "Joined team!" : "Invite declined" });
      if (action === "accept") onAccepted();
    } catch { toast({ title: "Failed", variant: "destructive" }); }
  };

  if (loading || invites.length === 0) return null;

  return (
    <div className="space-y-2 mb-1">
      {invites.map(inv => (
        <div key={inv.id} className="flex items-center gap-3 p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl">
          <Bell className="w-4 h-4 text-amber-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">{inv.team_name}</p>
            <p className="text-xs text-muted-foreground font-mono">You have a pending team invite{inv.invited_by_username ? ` from ${inv.invited_by_username}` : ""}</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button size="sm" className="h-7 text-xs gap-1" onClick={() => respond(inv.team_id, "accept")}>
              <Check className="w-3 h-3" /> Accept
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-muted-foreground hover:text-red-400" onClick={() => respond(inv.team_id, "reject")}>
              <X className="w-3 h-3" /> Decline
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Team Dashboard ───────────────────────────────────────────────────────────
function TeamDashboard({ team }: { team: TeamDetail }) {
  const [stats, setStats] = useState<TeamStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    customFetch<TeamStats>(`/teams/${team.id}/stats`)
      .then(d => setStats(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [team.id]);

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;

  const statCards = [
    { label: "Members", value: stats?.memberCount ?? team.member_count, icon: Users, color: "text-cyan-400", bg: "bg-cyan-400/10" },
    { label: "Messages", value: stats?.messageCount ?? 0, icon: MessageCircle, color: "text-violet-400", bg: "bg-violet-400/10" },
    { label: "Projects", value: stats?.projectCount ?? 0, icon: FolderGit2, color: "text-emerald-400", bg: "bg-emerald-400/10" },
    { label: "Team ROI", value: `$${(stats?.totalRoi ?? 0).toFixed(2)}`, icon: TrendingUp, color: "text-amber-400", bg: "bg-amber-400/10" },
  ];

  return (
    <div className="space-y-5">
      {team.status === "pending" && (
        <div className="flex items-center gap-3 p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl">
          <Clock className="w-4 h-4 text-amber-400 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-400">Pending Admin Approval</p>
            <p className="text-xs text-muted-foreground font-mono">This team request is awaiting approval. Most features will be unlocked once approved.</p>
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {statCards.map(s => (
          <div key={s.label} className="bg-card/60 border border-border/40 rounded-xl p-4 flex items-start gap-3">
            <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0", s.bg)}>
              <s.icon className={cn("w-4 h-4", s.color)} />
            </div>
            <div>
              <div className={cn("text-xl font-mono font-bold", s.color)}>{s.value}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5 font-mono">{s.label}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="bg-card/60 border border-border/40 rounded-xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold font-mono text-lg">
            {team.name[0].toUpperCase()}
          </div>
          <div>
            <h3 className="font-bold text-foreground">{team.name}</h3>
            {team.description && <p className="text-xs text-muted-foreground font-mono">{team.description}</p>}
            <p className="text-xs text-muted-foreground/60 font-mono">Created {new Date(team.created_at).toLocaleDateString()}</p>
          </div>
          <Badge variant="outline" className="ml-auto text-[10px] capitalize">{team.myRole}</Badge>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-lg border border-border/30 p-3">
            <p className="text-[10px] text-muted-foreground/60 font-mono uppercase tracking-widest mb-2">Top Members</p>
            <div className="space-y-2">
              {team.members.filter(m => m.status === "active").slice(0, 4).map(m => (
                <div key={m.id} className="flex items-center gap-2">
                  <Avatar name={m.username || m.email || "?"} size="sm" role={m.role} />
                  <span className="text-xs font-mono text-foreground truncate flex-1">{m.username || m.email}</span>
                  <Badge variant="outline" className={cn("text-[9px] capitalize", m.role === "leader" ? "border-yellow-500/30 text-yellow-400" : "")}>
                    {m.role}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-lg border border-border/30 p-3">
            <p className="text-[10px] text-muted-foreground/60 font-mono uppercase tracking-widest mb-2">Activity</p>
            <div className="space-y-2">
              {(stats?.recentActivity ?? []).length === 0 ? (
                <p className="text-xs text-muted-foreground/40 font-mono">No recent activity</p>
              ) : (
                (stats?.recentActivity ?? []).slice(0, 4).map((a: any, i: number) => (
                  <div key={i} className="flex items-center gap-2">
                    <Activity className="w-3 h-3 text-primary/50 flex-shrink-0" />
                    <span className="text-xs font-mono text-muted-foreground truncate">{a.username} sent a message</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Team Members ─────────────────────────────────────────────────────────────
function TeamMembers({ team, onRefresh }: { team: TeamDetail; onRefresh: () => void }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const active = team.members.filter(m => m.status !== "pending");
  const pending = team.members.filter(m => m.status === "pending");

  const removeMember = async (userId: number) => {
    try {
      await customFetch(`/teams/${team.id}/members/${userId}`, { method: "DELETE" });
      toast({ title: "Member removed" });
      onRefresh();
    } catch { toast({ title: "Failed", variant: "destructive" }); }
  };

  const promoteOrDemote = async (userId: number, currentRole: string) => {
    const newRole = currentRole === "leader" ? "member" : "leader";
    try {
      await customFetch(`/teams/${team.id}/members/${userId}/role`, { method: "PATCH", body: JSON.stringify({ role: newRole }) });
      toast({ title: `Role updated to ${newRole}` });
      onRefresh();
    } catch { toast({ title: "Failed", variant: "destructive" }); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">{active.length} Active Members</p>
        {pending.length > 0 && (
          <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-400">{pending.length} pending invite{pending.length > 1 ? "s" : ""}</Badge>
        )}
      </div>

      {pending.length > 0 && team.myRole === "leader" && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest">Awaiting Acceptance</p>
          {pending.map(m => (
            <div key={m.id} className="flex items-center gap-3 p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl">
              <Avatar name={m.username || m.email || "?"} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground">{m.username || m.email}</p>
                <p className="text-[10px] text-muted-foreground font-mono">Invited · Pending</p>
              </div>
              <button onClick={() => removeMember(m.user_id)} className="p-1.5 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors" title="Cancel invite">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {active.map(m => (
          <div key={m.id} className="bg-card/60 border border-border/40 rounded-xl p-4 flex items-center gap-3 group hover:border-primary/30 transition-colors">
            <Avatar name={m.username || m.email || "?"} size="lg" role={m.role} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-foreground truncate">{m.username || m.email}</span>
                {m.user_id === team.owner_id && (
                  <Badge variant="outline" className="text-[9px] border-yellow-500/30 text-yellow-400 gap-0.5">
                    <Crown className="w-2 h-2" /> Owner
                  </Badge>
                )}
              </div>
              {m.email && <p className="text-[10px] text-muted-foreground font-mono truncate">{m.email}</p>}
              <div className="flex items-center gap-3 mt-1">
                <span className="text-[10px] text-muted-foreground font-mono">Joined {new Date(m.joined_at).toLocaleDateString()}</span>
                {m.streak != null && m.streak > 0 && (
                  <span className="text-[10px] text-orange-400 font-mono">{m.streak}d 🔥</span>
                )}
              </div>
            </div>
            {team.myRole === "leader" && m.user_id !== user?.id && (
              <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => promoteOrDemote(m.user_id, m.role)}
                  className="p-1.5 rounded hover:bg-yellow-500/10 text-muted-foreground hover:text-yellow-400 transition-colors"
                  title={m.role === "leader" ? "Demote" : "Promote to Leader"}>
                  <Crown className="w-3.5 h-3.5" />
                </button>
                {m.user_id !== team.owner_id && (
                  <button onClick={() => removeMember(m.user_id)}
                    className="p-1.5 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Team Vault ───────────────────────────────────────────────────────────────
function TeamVault({ team }: { team: TeamDetail }) {
  const [entries, setEntries] = useState<VaultEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    customFetch<VaultEntry[]>(`/teams/${team.id}/vault`)
      .then(d => setEntries(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [team.id]);

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;

  const CAT_COLORS: Record<string, string> = {
    defi: "text-violet-400 border-violet-500/30",
    nft: "text-pink-400 border-pink-500/30",
    gaming: "text-emerald-400 border-emerald-500/30",
    layer2: "text-blue-400 border-blue-500/30",
    dao: "text-amber-400 border-amber-500/30",
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Lock className="w-3.5 h-3.5 text-primary" /> Team Vault
        </p>
        <p className="text-xs text-muted-foreground font-mono">{entries.length} entries from {team.members.filter(m => m.status === "active").length} members</p>
      </div>

      {entries.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <KeyRound className="w-10 h-10 text-muted-foreground/20 mx-auto" />
          <p className="text-sm text-muted-foreground font-mono">No vault entries shared yet</p>
          <p className="text-xs text-muted-foreground/50 font-mono">Team members' project registrations will appear here</p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map(e => (
            <div key={e.id} className="bg-card/60 border border-border/40 rounded-xl p-4 flex items-start gap-3 hover:border-primary/30 transition-colors">
              <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold font-mono text-xs flex-shrink-0">
                {(e.project_name || "?"[0]).charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-sm text-foreground">{e.project_name}</p>
                  {e.category && (
                    <Badge variant="outline" className={cn("text-[9px] capitalize", CAT_COLORS[e.category] ?? "")}>
                      {e.category}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  {e.twitter_username && <span className="text-[10px] text-muted-foreground font-mono">🐦 @{e.twitter_username}</span>}
                  {e.discord_username && <span className="text-[10px] text-muted-foreground font-mono">💬 {e.discord_username}</span>}
                  {e.email && <span className="text-[10px] text-muted-foreground font-mono">✉ {e.email}</span>}
                  {e.entity_serial && <span className="text-[10px] text-primary/60 font-mono">#{e.entity_serial}</span>}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="flex items-center gap-1">
                  <Avatar name={e.username || "?"} size="sm" />
                  <p className="text-[10px] text-muted-foreground font-mono">{e.username}</p>
                </div>
                <p className="text-[9px] text-muted-foreground/40 mt-1 font-mono">{new Date(e.created_at).toLocaleDateString()}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Team Missions ────────────────────────────────────────────────────────────
function TeamMissions({ team }: { team: TeamDetail }) {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", target_value: "100", reward_amount: "0", deadline: "" });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const loadMissions = () => {
    customFetch<Mission[]>(`/teams/${team.id}/missions`)
      .then(d => setMissions(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadMissions(); }, [team.id]);

  const createMission = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      await customFetch(`/teams/${team.id}/missions`, { method: "POST", body: JSON.stringify(form) });
      toast({ title: "Mission created!" });
      setCreateOpen(false);
      setForm({ title: "", description: "", target_value: "100", reward_amount: "0", deadline: "" });
      loadMissions();
    } catch { toast({ title: "Failed", variant: "destructive" }); } finally { setSaving(false); }
  };

  const updateProgress = async (mission: Mission, delta: number) => {
    const newVal = Math.min(mission.target_value, Math.max(0, mission.current_value + delta));
    try {
      await customFetch(`/teams/${team.id}/missions/${mission.id}`, { method: "PATCH", body: JSON.stringify({ current_value: newVal }) });
      setMissions(prev => prev.map(m => m.id === mission.id ? { ...m, current_value: newVal } : m));
    } catch { toast({ title: "Failed", variant: "destructive" }); }
  };

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;

  const STATUS_COLOR: Record<string, string> = {
    active: "text-emerald-400 border-emerald-500/30",
    completed: "text-blue-400 border-blue-500/30",
    cancelled: "text-red-400 border-red-500/30",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Swords className="w-3.5 h-3.5 text-primary" /> Team Missions
        </p>
        {team.myRole === "leader" && (
          <Button size="sm" onClick={() => setCreateOpen(true)} className="h-8 text-xs gap-1">
            <Plus className="w-3 h-3" /> New Mission
          </Button>
        )}
      </div>

      {missions.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <Target className="w-10 h-10 text-muted-foreground/20 mx-auto" />
          <p className="text-sm text-muted-foreground font-mono">No missions yet</p>
          {team.myRole === "leader" && (
            <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)} className="gap-2 mt-1"><Plus className="w-3.5 h-3.5" /> Create Mission</Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {missions.map(m => {
            const pct = m.target_value > 0 ? Math.min(100, Math.round((m.current_value / m.target_value) * 100)) : 0;
            const done = pct >= 100;
            return (
              <div key={m.id} className={cn("bg-card/60 border rounded-xl p-4 space-y-3 transition-colors", done ? "border-emerald-500/30 bg-emerald-400/5" : "border-border/40 hover:border-primary/30")}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {done ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <Target className="w-4 h-4 text-primary/60 shrink-0" />}
                      <p className={cn("font-semibold text-sm", done ? "text-emerald-400" : "text-foreground")}>{m.title}</p>
                      <Badge variant="outline" className={cn("text-[9px] capitalize", STATUS_COLOR[m.status] ?? "")}>{m.status}</Badge>
                    </div>
                    {m.description && <p className="text-xs text-muted-foreground mt-1 font-mono ml-6">{m.description}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    {parseFloat(String(m.reward_amount)) > 0 && (
                      <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-400">{parseFloat(String(m.reward_amount))} AZN</Badge>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <span className="text-muted-foreground">Progress</span>
                    <span className={done ? "text-emerald-400" : "text-primary"}>{m.current_value} / {m.target_value} ({pct}%)</span>
                  </div>
                  <div className="h-1.5 bg-muted/20 rounded-full overflow-hidden">
                    <div className={cn("h-full rounded-full transition-all", done ? "bg-emerald-400" : "bg-primary/70")} style={{ width: `${pct}%` }} />
                  </div>
                </div>

                {team.myRole === "leader" && !done && (
                  <div className="flex items-center gap-2">
                    <button onClick={() => updateProgress(m, -10)} className="p-1 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors">
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-[10px] text-muted-foreground font-mono">Adjust progress</span>
                    <button onClick={() => updateProgress(m, 10)} className="p-1 rounded hover:bg-emerald-500/10 text-muted-foreground hover:text-emerald-400 transition-colors">
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                    {m.deadline && (
                      <span className="text-[10px] text-muted-foreground/60 font-mono ml-auto flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {new Date(m.deadline).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-sm bg-card border-border">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Swords className="w-4 h-4 text-primary" /> New Mission</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground font-mono">Title</label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Complete 100 tasks" className="h-9 text-sm bg-background/50" autoFocus />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground font-mono">Description (optional)</label>
              <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Mission details" className="h-9 text-sm bg-background/50" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground font-mono">Target</label>
                <Input type="number" value={form.target_value} onChange={e => setForm(f => ({ ...f, target_value: e.target.value }))} className="h-9 text-sm bg-background/50" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground font-mono">Reward (AZN)</label>
                <Input type="number" value={form.reward_amount} onChange={e => setForm(f => ({ ...f, reward_amount: e.target.value }))} className="h-9 text-sm bg-background/50" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground font-mono">Deadline (optional)</label>
              <Input type="date" value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} className="h-9 text-sm bg-background/50" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={createMission} disabled={saving || !form.title.trim()}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null} Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Team Leaderboard ─────────────────────────────────────────────────────────
function TeamLeaderboard({ team }: { team: TeamDetail }) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    customFetch<LeaderboardEntry[]>(`/teams/${team.id}/leaderboard`)
      .then(d => setEntries(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [team.id]);

  const rankIcon = (rank: number) => {
    if (rank === 1) return <Medal className="w-4 h-4 text-yellow-400" />;
    if (rank === 2) return <Medal className="w-4 h-4 text-slate-300" />;
    if (rank === 3) return <Medal className="w-4 h-4 text-amber-600" />;
    return <span className="font-mono text-xs text-muted-foreground/60 w-4 text-center">#{rank}</span>;
  };

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground font-mono">Ranked by total ROI earned</p>
      <div className="bg-card/60 border border-border/40 rounded-xl overflow-hidden">
        <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-3 px-4 py-2.5 border-b border-border/30 bg-muted/10">
          {["#", "Member", "ROI", "Tasks", "AZN"].map(h => (
            <span key={h} className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/40">{h}</span>
          ))}
        </div>
        {entries.length === 0 ? (
          <div className="py-10 text-center text-muted-foreground/40 font-mono text-xs">No data yet</div>
        ) : entries.map((e) => {
          const isMe = e.user_id === user?.id;
          const maxRoi = entries[0]?.total_roi || 1;
          const pct = Math.max(5, (parseFloat(String(e.total_roi)) / maxRoi) * 100);
          return (
            <div key={e.user_id}
              className={cn("grid grid-cols-[auto_1fr_auto_auto_auto] gap-3 items-center px-4 py-3 border-b border-border/20 last:border-0 transition-colors",
                isMe ? "bg-primary/5 border-l-2 border-l-primary" : "hover:bg-muted/10")}>
              <div className="flex items-center justify-center w-4">{rankIcon(e.rank)}</div>
              <div className="flex items-center gap-2 min-w-0">
                <Avatar name={e.username || "?"} size="sm" role={e.role} />
                <div className="min-w-0">
                  <p className={cn("text-xs font-mono font-semibold truncate", isMe ? "text-primary" : "text-foreground")}>{e.username}</p>
                  <div className="h-1 bg-muted/20 rounded-full w-20 mt-1">
                    <div className="h-full bg-primary/60 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              </div>
              <span className="font-mono text-xs font-bold text-emerald-400">${parseFloat(String(e.total_roi ?? 0)).toFixed(2)}</span>
              <span className="font-mono text-xs text-muted-foreground">{e.tasks_completed ?? 0}</span>
              <span className="font-mono text-xs text-cyan-400">{parseFloat(String(e.azn_balance ?? 0)).toFixed(1)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Team Projects ────────────────────────────────────────────────────────────
function TeamProjects({ team }: { team: TeamDetail }) {
  const [projects, setProjects] = useState<TeamProject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    customFetch<TeamProject[]>(`/teams/${team.id}/projects`)
      .then(d => setProjects(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [team.id]);

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;

  const STATUS_COLORS: Record<string, string> = {
    active: "text-emerald-400 border-emerald-500/30",
    completed: "text-blue-400 border-blue-500/30",
    paused: "text-amber-400 border-amber-500/30",
    cancelled: "text-red-400 border-red-500/30",
  };

  return (
    <div className="space-y-3">
      {projects.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <FolderGit2 className="w-10 h-10 text-muted-foreground/20 mx-auto" />
          <p className="text-sm text-muted-foreground font-mono">No team projects yet</p>
          <p className="text-xs text-muted-foreground/50 font-mono">Assign a project to this team to see it here</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {projects.map(p => (
            <div key={p.id} className="bg-card/60 border border-border/40 rounded-xl p-4 hover:border-primary/30 transition-colors">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-semibold text-sm text-foreground">{p.name}</p>
                  {p.category && <p className="text-[10px] text-muted-foreground font-mono">{p.category}</p>}
                </div>
                <Badge variant="outline" className={cn("text-[9px] capitalize ml-2", STATUS_COLORS[p.status] ?? "")}>
                  {p.status}
                </Badge>
              </div>
              <div className="flex items-center gap-4 text-[10px] text-muted-foreground font-mono">
                <span className="flex items-center gap-1"><Zap className="w-3 h-3" />{p.task_count} tasks</span>
                <span className="flex items-center gap-1"><Users className="w-3 h-3" />{p.participant_count} joined</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Team Chat ────────────────────────────────────────────────────────────────
function TeamChat({ team, currentUserId }: { team: TeamDetail; currentUserId: number }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const loadMessages = async () => {
    try {
      const data = await customFetch<Message[]>(`/teams/${team.id}/messages`);
      setMessages(Array.isArray(data) ? data : []);
    } catch { } finally { setLoading(false); }
  };

  useEffect(() => { loadMessages(); const t = setInterval(loadMessages, 5000); return () => clearInterval(t); }, [team.id]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = async () => {
    if (!input.trim()) return;
    setSending(true);
    try {
      await customFetch(`/teams/${team.id}/messages`, { method: "POST", body: JSON.stringify({ message: input.trim() }) });
      setInput("");
      await loadMessages();
    } catch { toast({ title: "Failed to send", variant: "destructive" }); } finally { setSending(false); }
  };

  const memberMap = Object.fromEntries(team.members.map(m => [m.user_id, m.username || m.email || `User ${m.user_id}`]));

  return (
    <div className="flex flex-col h-[520px] bg-card/60 border border-border/40 rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/40 bg-muted/10">
        <MessageCircle className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold text-foreground">{team.name}</span>
        <span className="text-xs text-muted-foreground font-mono">· {team.members.filter(m => m.status === "active").length} members</span>
        <button onClick={loadMessages} className="ml-auto text-muted-foreground hover:text-primary transition-colors">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading ? <div className="flex items-center justify-center h-full"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          : messages.length === 0 ? <div className="flex items-center justify-center h-full text-sm text-muted-foreground font-mono">No messages yet. Say hello! 👋</div>
          : messages.map(msg => {
            const isMe = msg.user_id === currentUserId;
            const name = msg.username || memberMap[msg.user_id] || `User ${msg.user_id}`;
            return (
              <div key={msg.id} className={cn("flex gap-2", isMe ? "flex-row-reverse" : "flex-row")}>
                <Avatar name={name} size="sm" />
                <div className={cn("max-w-[75%] space-y-0.5", isMe ? "items-end" : "items-start")} style={{ display: "flex", flexDirection: "column" }}>
                  {!isMe && <span className="text-[10px] text-muted-foreground ml-1 font-mono">{name}</span>}
                  <div className={cn("px-3 py-2 rounded-lg text-sm", isMe ? "bg-primary/20 text-foreground rounded-tr-none" : "bg-muted/40 text-foreground rounded-tl-none")}>
                    {msg.message}
                  </div>
                  <span className="text-[9px] text-muted-foreground/50 mx-1">{new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
              </div>
            );
          })}
        <div ref={bottomRef} />
      </div>

      <div className="flex items-center gap-2 p-3 border-t border-border/40">
        <Input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Type a message..."
          className="flex-1 h-9 text-sm bg-background/50"
          disabled={sending}
        />
        <Button size="sm" onClick={send} disabled={sending || !input.trim()} className="h-9">
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  );
}

// ─── Team Panel (Admin Panel for Leaders) ────────────────────────────────────
function TeamPanel({ team, onRefresh, onDelete }: { team: TeamDetail; onRefresh: () => void; onDelete: () => void }) {
  const [newName, setNewName] = useState(team.name);
  const [newDesc, setNewDesc] = useState(team.description ?? "");
  const [inviteEmail, setInviteEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [inviting, setInviting] = useState(false);
  const { toast } = useToast();

  const saveTeam = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      await customFetch(`/teams/${team.id}`, { method: "PATCH", body: JSON.stringify({ name: newName, description: newDesc }) });
      toast({ title: "Team updated" });
      onRefresh();
    } catch { toast({ title: "Failed to update", variant: "destructive" }); } finally { setSaving(false); }
  };

  const inviteMember = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      await customFetch(`/teams/${team.id}/invite`, { method: "POST", body: JSON.stringify({ username: inviteEmail.trim() }) });
      toast({ title: "Invite sent! They'll see it in their teams page." });
      setInviteEmail("");
      onRefresh();
    } catch (e: any) {
      toast({ title: e?.message || "Failed to invite", variant: "destructive" });
    } finally { setInviting(false); }
  };

  const deleteTeam = async () => {
    if (!confirm(`Disband "${team.name}"? This cannot be undone.`)) return;
    try {
      await customFetch(`/teams/${team.id}`, { method: "DELETE" });
      toast({ title: "Team disbanded" });
      onDelete();
    } catch { toast({ title: "Failed to delete", variant: "destructive" }); }
  };

  return (
    <div className="space-y-4">
      <div className="bg-card/60 border border-border/40 rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><Settings className="w-3.5 h-3.5 text-primary" /> Team Info</h3>
        <div className="space-y-2">
          <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Team name" className="h-9 text-sm bg-background/50" />
          <Input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Description (optional)" className="h-9 text-sm bg-background/50" />
          <Button size="sm" onClick={saveTeam} disabled={saving} className="h-9 w-full">{saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null} Save Changes</Button>
        </div>
      </div>

      <div className="bg-card/60 border border-border/40 rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><UserPlus className="w-3.5 h-3.5 text-primary" /> Invite Member</h3>
        <p className="text-xs text-muted-foreground font-mono">Invites are pending until the user accepts from their Teams page.</p>
        <div className="flex gap-2">
          <Input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="Username or email"
            onKeyDown={e => e.key === "Enter" && inviteMember()}
            className="h-9 text-sm bg-background/50 flex-1" />
          <Button size="sm" onClick={inviteMember} disabled={inviting} className="h-9">
            {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      <div className="bg-card/60 border border-border/40 rounded-xl p-4 space-y-2">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><Users className="w-3.5 h-3.5 text-primary" /> Members ({team.members.filter(m => m.status === "active").length})</h3>
        <div className="space-y-1.5 max-h-48 overflow-y-auto">
          {team.members.map(m => (
            <div key={m.id} className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-muted/20">
              <Avatar name={m.username || m.email || "?"} size="sm" role={m.role} />
              <span className="text-xs text-foreground flex-1 truncate font-mono">{m.username || m.email}</span>
              <Badge variant="outline" className={cn("text-[9px] capitalize", m.status === "pending" ? "border-amber-500/30 text-amber-400" : m.role === "leader" ? "border-yellow-500/30 text-yellow-400" : "")}>
                {m.status === "pending" ? "pending" : m.role}
              </Badge>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-card/60 border border-red-500/20 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-red-400 mb-2 flex items-center gap-2"><Shield className="w-3.5 h-3.5" /> Danger Zone</h3>
        <p className="text-xs text-muted-foreground font-mono mb-3">Disbanding removes all members and messages permanently.</p>
        <Button variant="destructive" size="sm" onClick={deleteTeam} className="h-8 text-xs">Disband Team</Button>
      </div>
    </div>
  );
}

// ─── Main Teams Page ──────────────────────────────────────────────────────────
export default function TeamsPage() {
  const { user } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<TeamDetail | null>(null);
  const [tab, setTab] = useState<Tab>("dashboard");
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [teamDesc, setTeamDesc] = useState("");
  const [creating, setCreating] = useState(false);
  const { toast } = useToast();

  const loadTeams = async () => {
    try {
      const data = await customFetch<Team[]>("/teams");
      setTeams(Array.isArray(data) ? data : []);
    } catch { setTeams([]); } finally { setLoading(false); }
  };

  const loadTeamDetail = async (id: number) => {
    try {
      const data = await customFetch<TeamDetail>(`/teams/${id}`);
      setSelectedTeam(data);
    } catch { toast({ title: "Failed to load team", variant: "destructive" }); }
  };

  useEffect(() => { loadTeams(); }, []);

  const createTeam = async () => {
    if (!teamName.trim()) return;
    setCreating(true);
    try {
      await customFetch("/teams", { method: "POST", body: JSON.stringify({ name: teamName.trim(), description: teamDesc.trim() }) });
      toast({ title: "Team request submitted!", description: "Awaiting admin approval — you'll be notified once approved." });
      setCreateOpen(false);
      setTeamName("");
      setTeamDesc("");
      await loadTeams();
    } catch { toast({ title: "Failed to create team", variant: "destructive" }); } finally { setCreating(false); }
  };

  if (!selectedTeam) {
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" /> Teams
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5 font-mono">Collaborate with your crew — shared vault, missions, projects & chat.</p>
          </div>
          <Button size="sm" onClick={() => setCreateOpen(true)} className="h-9 gap-2"><Plus className="w-4 h-4" /> Request Team</Button>
        </div>

        <PendingInvitesBanner onAccepted={loadTeams} />

        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : teams.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <div className="w-16 h-16 bg-primary/5 border border-primary/10 rounded-2xl flex items-center justify-center mx-auto">
              <Users className="w-8 h-8 text-muted-foreground/30" />
            </div>
            <div className="text-sm font-semibold text-foreground">No teams yet</div>
            <div className="text-xs text-muted-foreground font-mono">Submit a team request — admins approve and you're in.</div>
            <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)} className="gap-2 mt-2"><Plus className="w-4 h-4" /> Request Team</Button>
          </div>
        ) : (
          <div className="space-y-2">
            {teams.map(t => (
              <button key={t.id} onClick={async () => { await loadTeamDetail(t.id); setTab("dashboard"); }}
                disabled={t.status === "pending"}
                className={cn(
                  "w-full flex items-center gap-4 p-4 bg-card/60 border border-border/40 rounded-xl text-left group transition-all",
                  t.status !== "pending" ? "hover:border-primary/30 hover:bg-primary/5" : "opacity-60 cursor-default"
                )}>
                <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold font-mono text-base">
                  {t.name[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-semibold text-foreground">{t.name}</div>
                    {t.status === "pending" && (
                      <Badge variant="outline" className="text-[9px] border-amber-500/30 text-amber-400 gap-1">
                        <Clock className="w-2.5 h-2.5" /> Pending
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5 font-mono">
                    <Users className="w-3 h-3" />{t.member_count} members
                    <Badge variant="outline" className={cn("text-[9px] capitalize ml-1", t.member_role === "leader" ? "border-yellow-500/30 text-yellow-400" : "")}>{t.member_role}</Badge>
                  </div>
                </div>
                {t.status !== "pending" && <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary/60 transition-colors" />}
              </button>
            ))}
          </div>
        )}

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="sm:max-w-sm bg-card border-border">
            <DialogHeader><DialogTitle className="flex items-center gap-2"><Users className="w-4 h-4 text-primary" /> Request a Team</DialogTitle></DialogHeader>
            <div className="space-y-3 py-2">
              <p className="text-xs text-muted-foreground font-mono">Your request will be reviewed by an admin. Once approved, you can invite members and use all team features.</p>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground font-mono">Team Name</label>
                <Input value={teamName} onChange={e => setTeamName(e.target.value)} placeholder="e.g. Alpha Squad" className="h-9 text-sm bg-background/50" autoFocus />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground font-mono">Description (optional)</label>
                <Input value={teamDesc} onChange={e => setTeamDesc(e.target.value)} placeholder="What will your team focus on?" className="h-9 text-sm bg-background/50" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button size="sm" onClick={createTeam} disabled={creating || !teamName.trim()}>
                {creating ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null} Submit Request
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  const TABS: { id: Tab; label: string; icon: React.ElementType; leaderOnly?: boolean }[] = [
    { id: "dashboard",   label: "Overview",     icon: BarChart2 },
    { id: "members",     label: "Members",      icon: Users },
    { id: "vault",       label: "Vault",        icon: Wallet },
    { id: "missions",    label: "Missions",     icon: Swords },
    { id: "leaderboard", label: "Board",        icon: Trophy },
    { id: "projects",    label: "Projects",     icon: FolderGit2 },
    { id: "chat",        label: "Chat",         icon: MessageCircle },
    { id: "panel",       label: "Panel",        icon: Settings, leaderOnly: true },
  ].filter(t => !t.leaderOnly || selectedTeam.myRole === "leader");

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <button onClick={() => setSelectedTeam(null)} className="text-muted-foreground hover:text-foreground transition-colors text-sm font-mono">← Teams</button>
        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40" />
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold font-mono text-[10px]">
            {selectedTeam.name[0].toUpperCase()}
          </div>
          <span className="text-sm font-semibold text-foreground">{selectedTeam.name}</span>
        </div>
        <Badge variant="outline" className={cn("text-[9px] capitalize ml-1", selectedTeam.status === "pending" ? "border-amber-500/30 text-amber-400" : selectedTeam.myRole === "leader" ? "border-yellow-500/30 text-yellow-400" : "")}>
          {selectedTeam.status === "pending" ? "pending" : selectedTeam.myRole}
        </Badge>
        <button onClick={() => loadTeamDetail(selectedTeam.id)} className="ml-auto text-muted-foreground hover:text-primary transition-colors">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-0.5 border-b border-border/40 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn("flex items-center gap-1.5 px-3 py-2.5 text-xs font-mono font-medium transition-all border-b-2 -mb-px whitespace-nowrap",
              tab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "dashboard" && <TeamDashboard team={selectedTeam} />}
      {tab === "members" && <TeamMembers team={selectedTeam} onRefresh={() => loadTeamDetail(selectedTeam.id)} />}
      {tab === "vault" && <TeamVault team={selectedTeam} />}
      {tab === "missions" && <TeamMissions team={selectedTeam} />}
      {tab === "leaderboard" && <TeamLeaderboard team={selectedTeam} />}
      {tab === "projects" && <TeamProjects team={selectedTeam} />}
      {tab === "chat" && <TeamChat team={selectedTeam} currentUserId={user?.id ?? 0} />}
      {tab === "panel" && selectedTeam.myRole === "leader" && (
        <TeamPanel team={selectedTeam} onRefresh={() => loadTeamDetail(selectedTeam.id)} onDelete={() => { setSelectedTeam(null); loadTeams(); }} />
      )}
    </div>
  );
}
