import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { customFetch } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Users, Plus, Send, MessageCircle, Settings, Crown,
  UserPlus, Trash2, Shield, ChevronRight, RefreshCw,
  BarChart2, FolderGit2, Vault, Loader2, X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";

type Team = { id: number; name: string; owner_id: number; member_count: number; member_role: string; created_at: string };
type Member = { id: number; user_id: number; team_id: number; role: string; username: string; email: string; joined_at: string };
type Message = { id: number; team_id: number; user_id: number; message: string; created_at: string; username?: string };
type TeamDetail = Team & { members: Member[]; myRole: string };

type Tab = "overview" | "chat" | "settings";

function StatCard({ label, value, icon: Icon }: { label: string; value: string | number; icon: React.ElementType }) {
  return (
    <div className="bg-card/60 border border-border/40 rounded-lg p-4 flex items-start gap-3">
      <div className="p-2 bg-primary/10 rounded-lg"><Icon className="w-4 h-4 text-primary" /></div>
      <div><div className="text-xl font-mono font-bold text-foreground">{value}</div><div className="text-xs text-muted-foreground mt-0.5">{label}</div></div>
    </div>
  );
}

function TeamOverview({ team }: { team: TeamDetail }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Members" value={team.member_count ?? team.members.length} icon={Users} />
        <StatCard label="Your Role" value={team.myRole === "leader" ? "Leader" : "Member"} icon={Crown} />
        <StatCard label="Projects" value="—" icon={FolderGit2} />
        <StatCard label="Entities" value="—" icon={Vault} />
      </div>
      <div className="bg-card/60 border border-border/40 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-foreground mb-3">Members</h3>
        <div className="space-y-2">
          {team.members.map(m => (
            <div key={m.id} className="flex items-center gap-3 p-2 rounded hover:bg-muted/20">
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-[11px] font-mono text-primary font-bold">
                {(m.username || m.email || "?")[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-foreground truncate">{m.username || m.email}</div>
                <div className="text-[10px] text-muted-foreground">{new Date(m.joined_at).toLocaleDateString()}</div>
              </div>
              <Badge variant="outline" className={cn("text-[10px] capitalize", m.role === "leader" ? "border-yellow-500/30 text-yellow-400" : "")}>
                {m.role === "leader" ? <Crown className="w-2.5 h-2.5 mr-1" /> : null}
                {m.role}
              </Badge>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

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
    } catch { /* ignore */ } finally { setLoading(false); }
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
    <div className="flex flex-col h-[520px] bg-card/60 border border-border/40 rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/40">
        <MessageCircle className="w-4 h-4 text-primary" />
        <span className="text-sm font-medium text-foreground">{team.name} — Chat</span>
        <button onClick={loadMessages} className="ml-auto text-muted-foreground hover:text-primary transition-colors"><RefreshCw className="w-3.5 h-3.5" /></button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading ? <div className="flex items-center justify-center h-full"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          : messages.length === 0 ? <div className="flex items-center justify-center h-full text-sm text-muted-foreground">No messages yet. Say hello!</div>
          : messages.map(msg => {
            const isMe = msg.user_id === currentUserId;
            const name = msg.username || memberMap[msg.user_id] || `User ${msg.user_id}`;
            return (
              <div key={msg.id} className={cn("flex gap-2", isMe ? "flex-row-reverse" : "flex-row")}>
                <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0", isMe ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground")}>
                  {name[0].toUpperCase()}
                </div>
                <div className={cn("max-w-[75%] space-y-0.5", isMe ? "items-end" : "items-start")} style={{ display: "flex", flexDirection: "column" }}>
                  {!isMe && <span className="text-[10px] text-muted-foreground ml-1">{name}</span>}
                  <div className={cn("px-3 py-2 rounded-lg text-sm", isMe ? "bg-primary/20 text-foreground rounded-tr-none" : "bg-muted/40 text-foreground rounded-tl-none")}>
                    {msg.message}
                  </div>
                  <span className="text-[9px] text-muted-foreground/50 mx-1">{new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
              </div>
            );
          })
        }
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

function TeamSettings({ team, onRefresh, onDelete }: { team: TeamDetail; onRefresh: () => void; onDelete: () => void }) {
  const [newName, setNewName] = useState(team.name);
  const [inviteEmail, setInviteEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [inviting, setInviting] = useState(false);
  const { toast } = useToast();

  const saveTeam = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      await customFetch(`/teams/${team.id}`, { method: "PATCH", body: JSON.stringify({ name: newName }) });
      toast({ title: "Team updated" });
      onRefresh();
    } catch { toast({ title: "Failed to update", variant: "destructive" }); } finally { setSaving(false); }
  };

  const inviteMember = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      await customFetch(`/teams/${team.id}/invite`, { method: "POST", body: JSON.stringify({ username: inviteEmail.trim() }) });
      toast({ title: "Invite sent" });
      setInviteEmail("");
      onRefresh();
    } catch (e: any) {
      toast({ title: e?.message || "Failed to invite", variant: "destructive" });
    } finally { setInviting(false); }
  };

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

  const deleteTeam = async () => {
    if (!confirm(`Delete team "${team.name}"? This cannot be undone.`)) return;
    try {
      await customFetch(`/teams/${team.id}`, { method: "DELETE" });
      toast({ title: "Team deleted" });
      onDelete();
    } catch { toast({ title: "Failed to delete", variant: "destructive" }); }
  };

  return (
    <div className="space-y-4">
      <div className="bg-card/60 border border-border/40 rounded-lg p-4 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Team Name</h3>
        <div className="flex gap-2">
          <Input value={newName} onChange={e => setNewName(e.target.value)} className="h-9 text-sm bg-background/50 flex-1" />
          <Button size="sm" onClick={saveTeam} disabled={saving} className="h-9">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}</Button>
        </div>
      </div>

      <div className="bg-card/60 border border-border/40 rounded-lg p-4 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Invite Member</h3>
        <div className="flex gap-2">
          <Input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="Email address" className="h-9 text-sm bg-background/50 flex-1" />
          <Button size="sm" onClick={inviteMember} disabled={inviting} className="h-9">{inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}</Button>
        </div>
      </div>

      <div className="bg-card/60 border border-border/40 rounded-lg p-4 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Manage Members</h3>
        <div className="space-y-2">
          {team.members.map(m => (
            <div key={m.id} className="flex items-center gap-2 p-2 rounded hover:bg-muted/20">
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-[11px] font-mono text-primary font-bold">
                {(m.username || m.email || "?")[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{m.username || m.email}</div>
                <div className="text-[10px] text-muted-foreground capitalize">{m.role}</div>
              </div>
              {m.user_id !== team.owner_id && (
                <div className="flex gap-1">
                  <button onClick={() => promoteOrDemote(m.user_id, m.role)} className="p-1.5 rounded hover:bg-yellow-500/10 text-muted-foreground hover:text-yellow-400 transition-colors" title={m.role === "leader" ? "Demote to Member" : "Promote to Leader"}>
                    <Crown className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => removeMember(m.user_id)} className="p-1.5 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-card/60 border border-red-500/20 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-red-400 mb-2">Danger Zone</h3>
        <Button variant="destructive" size="sm" onClick={deleteTeam} className="h-8 text-xs">Delete Team</Button>
      </div>
    </div>
  );
}

export default function TeamsPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<TeamDetail | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [teamName, setTeamName] = useState("");
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
      await customFetch("/teams", { method: "POST", body: JSON.stringify({ name: teamName.trim() }) });
      toast({ title: "Team created!" });
      setCreateOpen(false);
      setTeamName("");
      await loadTeams();
    } catch { toast({ title: "Failed to create team", variant: "destructive" }); } finally { setCreating(false); }
  };

  if (!selectedTeam) {
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2"><Users className="w-5 h-5 text-primary" /> Teams</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Collaborate with your crew — shared vault, projects, and chat.</p>
          </div>
          <Button size="sm" onClick={() => setCreateOpen(true)} className="h-9 gap-2"><Plus className="w-4 h-4" /> New Team</Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : teams.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <Users className="w-10 h-10 text-muted-foreground/30 mx-auto" />
            <div className="text-sm text-muted-foreground">No teams yet. Create one to collaborate.</div>
            <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)} className="gap-2"><Plus className="w-4 h-4" /> Create Team</Button>
          </div>
        ) : (
          <div className="space-y-2">
            {teams.map(t => (
              <button key={t.id} onClick={async () => { await loadTeamDetail(t.id); setTab("overview"); }}
                className="w-full flex items-center gap-3 p-4 bg-card/60 border border-border/40 rounded-lg hover:border-primary/30 hover:bg-primary/5 transition-all text-left">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold font-mono text-sm">
                  {t.name[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-foreground">{t.name}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                    <Users className="w-3 h-3" />{t.member_count} members
                    <Badge variant="outline" className="text-[10px] capitalize ml-1">{t.member_role}</Badge>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground/40" />
              </button>
            ))}
          </div>
        )}

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="sm:max-w-sm bg-card border-border">
            <DialogHeader><DialogTitle className="flex items-center gap-2"><Users className="w-4 h-4 text-primary" /> Create Team</DialogTitle></DialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Team Name</label>
                <Input value={teamName} onChange={e => setTeamName(e.target.value)} onKeyDown={e => e.key === "Enter" && createTeam()} placeholder="e.g. Alpha Squad" className="h-9 text-sm bg-background/50" autoFocus />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button size="sm" onClick={createTeam} disabled={creating || !teamName.trim()}>
                {creating ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null} Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "overview", label: "Overview", icon: BarChart2 },
    { id: "chat", label: "Chat", icon: MessageCircle },
    ...(selectedTeam.myRole === "leader" ? [{ id: "settings" as Tab, label: "Settings", icon: Settings }] : []),
  ];

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => setSelectedTeam(null)} className="text-muted-foreground hover:text-foreground transition-colors text-sm">← Teams</button>
        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40" />
        <span className="text-sm font-semibold text-foreground">{selectedTeam.name}</span>
        <Badge variant="outline" className="text-[10px] capitalize ml-1">{selectedTeam.myRole}</Badge>
      </div>

      <div className="flex gap-1 border-b border-border/40">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn("flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px",
              tab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && <TeamOverview team={selectedTeam} />}
      {tab === "chat" && <TeamChat team={selectedTeam} currentUserId={user?.id ?? 0} />}
      {tab === "settings" && selectedTeam.myRole === "leader" && (
        <TeamSettings team={selectedTeam} onRefresh={() => loadTeamDetail(selectedTeam.id)} onDelete={() => { setSelectedTeam(null); loadTeams(); }} />
      )}
    </div>
  );
}
