import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Settings, Send, Link2, Unlink, RefreshCw, CheckCircle2,
  ExternalLink, KeyRound, Eye, EyeOff, Bell, Shield, Loader2,
  Lock, Key, Copy, Trash2, Plus, AlertTriangle, Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

interface TelegramStatus {
  linked: boolean;
  chatId: string | null;
  username: string | null;
}

function Section({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-card-border rounded-lg overflow-hidden">
      <div className="bg-primary/5 border-b border-card-border px-5 py-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        <div className="font-mono font-bold text-sm text-foreground">{title}</div>
      </div>
      <div className="px-5 py-5">{children}</div>
    </div>
  );
}

export default function UserSettings() {
  const { token, user } = useAuth() as any;
  const { toast } = useToast();

  const [tgStatus, setTgStatus] = useState<TelegramStatus | null>(null);
  const [tgLoading, setTgLoading] = useState(true);
  const [code, setCode] = useState("");
  const [linking, setLinking] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [botName, setBotName] = useState<string | null>(null);

  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);

  const [notifBroadcast, setNotifBroadcast] = useState(true);
  const [notifTask, setNotifTask] = useState(true);

  const fetchTgStatus = useCallback(async () => {
    setTgLoading(true);
    try {
      const res = await fetch(`${BASE}/api/telegram/me`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setTgStatus(await res.json());
    } catch { }
    setTgLoading(false);
  }, [token]);

  const fetchBotInfo = useCallback(async () => {
    try {
      const res = await fetch(`${BASE}/api/telegram/status`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        if (data.online) setBotName(data.username);
      }
    } catch { }
  }, [token]);

  useEffect(() => { fetchTgStatus(); fetchBotInfo(); }, [fetchTgStatus, fetchBotInfo]);

  const handleLink = async () => {
    if (!code.trim() || code.trim().length !== 6) {
      toast({ variant: "destructive", title: "Enter the 6-digit code from the bot" });
      return;
    }
    setLinking(true);
    try {
      const res = await fetch(`${BASE}/api/telegram/connect/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: "✅ Telegram linked!", description: "Your Telegram account is now connected to AYZEN." });
        setCode("");
        await fetchTgStatus();
      } else {
        toast({ variant: "destructive", title: "Link failed", description: data.error });
      }
    } catch {
      toast({ variant: "destructive", title: "Connection error" });
    }
    setLinking(false);
  };

  const handleUnlink = async () => {
    setUnlinking(true);
    try {
      const res = await fetch(`${BASE}/api/telegram/disconnect`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        toast({ title: "Telegram disconnected" });
        await fetchTgStatus();
      }
    } catch {
      toast({ variant: "destructive", title: "Error disconnecting" });
    }
    setUnlinking(false);
  };

  const handleChangePassword = async () => {
    if (!oldPw || !newPw) {
      toast({ variant: "destructive", title: "Fill both fields" });
      return;
    }
    if (newPw.length < 6) {
      toast({ variant: "destructive", title: "New password too short", description: "Minimum 6 characters." });
      return;
    }
    setPwLoading(true);
    try {
      const res = await fetch(`${BASE}/api/users/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ oldPassword: oldPw, newPassword: newPw }),
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: "✅ Password changed", description: "Your passphrase has been updated." });
        setOldPw(""); setNewPw("");
      } else {
        toast({ variant: "destructive", title: "Password change failed", description: data.error ?? "Wrong current password?" });
      }
    } catch {
      toast({ variant: "destructive", title: "Connection error" });
    }
    setPwLoading(false);
  };

  const ToggleRow = ({ label, sub, value, onChange }: { label: string; sub: string; value: boolean; onChange: (v: boolean) => void }) => (
    <div className="flex items-center justify-between py-3 border-b border-card-border last:border-b-0">
      <div>
        <div className="font-mono text-xs text-foreground font-medium">{label}</div>
        <div className="font-mono text-[10px] text-muted-foreground mt-0.5">{sub}</div>
      </div>
      <button
        onClick={() => onChange(!value)}
        className={cn(
          "w-10 h-5 rounded-full transition-all duration-200 relative",
          value ? "bg-primary" : "bg-muted"
        )}
      >
        <span className={cn(
          "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all duration-200",
          value ? "left-5" : "left-0.5"
        )} />
      </button>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-mono tracking-tighter uppercase flex items-center gap-2">
          <Settings className="w-6 h-6 text-primary" /> Settings
        </h1>
        <p className="text-muted-foreground font-mono text-xs mt-1">
          Account: <span className="text-primary">{user?.username ?? "..."}</span> · {user?.email ?? ""}
        </p>
      </div>

      {/* ── Telegram Connect ── */}
      <div className="bg-card border border-card-border rounded-lg overflow-hidden">
        <div className="bg-[#229ED9]/5 border-b border-card-border px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#229ED9]/10 border border-[#229ED9]/20 flex items-center justify-center">
              <Send className="w-4 h-4 text-[#229ED9]" />
            </div>
            <div>
              <div className="font-mono font-bold text-sm text-foreground">Telegram Bot</div>
              <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
                {botName ? <>Bot: <a href={`https://t.me/${botName}`} target="_blank" rel="noopener noreferrer" className="text-[#229ED9] hover:underline inline-flex items-center gap-0.5">@{botName} <ExternalLink className="w-2.5 h-2.5" /></a></> : "Notifications & Commands"}
              </div>
            </div>
          </div>
          {tgLoading ? (
            <div className="w-16 h-5 bg-muted/30 rounded animate-pulse" />
          ) : tgStatus?.linked ? (
            <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 font-mono text-[10px] uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 animate-pulse inline-block" />
              Linked
            </Badge>
          ) : (
            <Badge variant="outline" className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Not linked
            </Badge>
          )}
        </div>

        <div className="px-5 py-5 space-y-5">
          {tgStatus?.linked ? (
            <div className="space-y-4">
              <div className="bg-emerald-500/5 border border-emerald-500/15 rounded-md px-4 py-3 flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                <div>
                  <div className="font-mono text-sm text-emerald-400 font-medium">Account connected</div>
                  {tgStatus.username && (
                    <div className="font-mono text-xs text-muted-foreground mt-0.5">@{tgStatus.username}</div>
                  )}
                </div>
              </div>
              <div className="text-xs font-mono text-muted-foreground space-y-1.5">
                <div>✓ Task approvals → Telegram notification</div>
                <div>✓ Broadcast alerts from admin</div>
                <div>✓ Commands: /tasks · /done &lt;id&gt; · /mytasks · /me</div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="font-mono text-xs border-red-500/20 text-red-400 hover:bg-red-500/10 hover:border-red-500/30 gap-2"
                onClick={handleUnlink}
                disabled={unlinking}
              >
                <Unlink className="w-3.5 h-3.5" />
                {unlinking ? "Disconnecting..." : "Disconnect Telegram"}
              </Button>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="space-y-2.5">
                <p className="font-mono text-[11px] text-muted-foreground uppercase tracking-widest mb-3">How to connect</p>
                {[
                  {
                    n: "1",
                    text: botName
                      ? <>Open <a href={`https://t.me/${botName}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-0.5 font-bold">@{botName} <ExternalLink className="w-3 h-3" /></a> on Telegram</>
                      : "Open the AYZEN bot on Telegram",
                  },
                  { n: "2", text: <>Send <span className="bg-muted px-1.5 py-0.5 rounded font-mono text-primary">/connect</span> — the bot replies with a 6-digit code</> },
                  { n: "3", text: "Paste that code below and click Link Account" },
                ].map(({ n, text }) => (
                  <div key={n} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-[10px] font-mono font-bold text-primary flex-shrink-0 mt-0.5">{n}</div>
                    <p className="text-xs font-mono text-muted-foreground leading-relaxed">{text}</p>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">6-Digit Code from Bot</label>
                <div className="flex gap-2">
                  <Input
                    value={code}
                    onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="123456"
                    maxLength={6}
                    className="font-mono tracking-[0.4em] text-center text-lg h-11 bg-input border-border focus-visible:ring-primary/50 focus-visible:border-primary max-w-[160px]"
                    onKeyDown={e => e.key === "Enter" && handleLink()}
                  />
                  <Button
                    onClick={handleLink}
                    disabled={linking || code.length !== 6}
                    className="font-mono text-xs gap-2 h-11"
                  >
                    {linking ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
                    {linking ? "Linking..." : "Link Account"}
                  </Button>
                </div>
                <p className="text-[10px] font-mono text-muted-foreground/50">Code expires in 10 minutes</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Change Password ── */}
      <Section title="Security — Change Password" icon={KeyRound}>
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Current Password</label>
            <div className="relative">
              <Input
                type={showOld ? "text" : "password"}
                value={oldPw}
                onChange={e => setOldPw(e.target.value)}
                placeholder="Current passphrase"
                className="font-mono h-10 text-sm bg-input border-border pr-9 focus-visible:ring-primary/50"
              />
              <button type="button" onClick={() => setShowOld(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                {showOld ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">New Password</label>
            <div className="relative">
              <Input
                type={showNew ? "text" : "password"}
                value={newPw}
                onChange={e => setNewPw(e.target.value)}
                placeholder="New passphrase (min 6 chars)"
                className="font-mono h-10 text-sm bg-input border-border pr-9 focus-visible:ring-primary/50"
              />
              <button type="button" onClick={() => setShowNew(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <Button
            className="font-mono text-xs gap-2 h-10"
            onClick={handleChangePassword}
            disabled={pwLoading || !oldPw || !newPw}
          >
            {pwLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Shield className="w-3.5 h-3.5" />}
            {pwLoading ? "Updating..." : "Update Password"}
          </Button>
        </div>
      </Section>

      {/* ── Notification Preferences ── */}
      <Section title="Notification Preferences" icon={Bell}>
        <div className="divide-y divide-card-border">
          <ToggleRow
            label="Broadcast Alerts"
            sub="Receive system-wide announcements from admin"
            value={notifBroadcast}
            onChange={setNotifBroadcast}
          />
          <ToggleRow
            label="Task Updates"
            sub="Notify when task submissions are approved or rejected"
            value={notifTask}
            onChange={setNotifTask}
          />
        </div>
        <p className="text-[10px] font-mono text-muted-foreground/40 mt-3">
          Notifications are delivered via connected Telegram. Link your Telegram above to receive them.
        </p>
      </Section>

      {/* ── Security: Backup Codes ── */}
      <SecuritySection token={token} />
    </div>
  );
}

// ─── Security Section ──────────────────────────────────────────────────────────
function SecuritySection({ token }: { token: string }) {
  const { toast } = useToast();
  const [backupCodes, setBackupCodes] = useState<{ id: number; code: string; is_used: boolean }[]>([]);
  const [magicCodes, setMagicCodes] = useState<{ id: number; code: string; label?: string; is_used: boolean; expires_at?: string }[]>([]);
  const [genLoading, setGenLoading] = useState(false);
  const [magicLoading, setMagicLoading] = useState(false);
  const [magicLabel, setMagicLabel] = useState("");
  const [revealed, setRevealed] = useState(false);

  const loadCodes = useCallback(async () => {
    try {
      const [bR, mR] = await Promise.all([
        fetch(`${BASE}/api/security/backup-codes`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${BASE}/api/security/magic-codes`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (bR.ok) setBackupCodes(await bR.json());
      if (mR.ok) setMagicCodes(await mR.json());
    } catch { }
  }, [token]);

  useEffect(() => { loadCodes(); }, [loadCodes]);

  const generateBackupCodes = async () => {
    setGenLoading(true);
    try {
      const r = await fetch(`${BASE}/api/security/backup-codes/generate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      toast({ title: "✅ 10 backup codes generated! Save them now." });
      await loadCodes();
      setRevealed(true);
    } catch (e: any) { toast({ title: e.message, variant: "destructive" }); }
    setGenLoading(false);
  };

  const createMagicCode = async () => {
    setMagicLoading(true);
    try {
      const r = await fetch(`${BASE}/api/security/magic-codes`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ label: magicLabel.trim() || "Magic Code" }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      toast({ title: "Magic code created!" });
      setMagicLabel("");
      await loadCodes();
    } catch (e: any) { toast({ title: e.message, variant: "destructive" }); }
    setMagicLoading(false);
  };

  const deleteMagicCode = async (id: number) => {
    try {
      await fetch(`${BASE}/api/security/magic-codes/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      setMagicCodes(prev => prev.filter(c => c.id !== id));
      toast({ title: "Code deleted" });
    } catch { toast({ title: "Failed", variant: "destructive" }); }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => toast({ title: "Copied!" })).catch(() => {});
  };

  const copyAllBackupCodes = () => {
    const text = backupCodes.filter(c => !c.is_used).map(c => c.code).join("\n");
    copyToClipboard(text);
  };

  const unusedBackup = backupCodes.filter(c => !c.is_used);
  const usedBackup = backupCodes.filter(c => c.is_used);

  return (
    <div className="space-y-4">
      {/* Backup Codes */}
      <div className="bg-card border border-card-border rounded-lg overflow-hidden">
        <div className="bg-primary/5 border-b border-card-border px-5 py-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Key className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1">
            <div className="font-mono font-bold text-sm text-foreground">Backup Codes</div>
            <div className="text-[10px] font-mono text-muted-foreground">One-time codes to access your account if you lose access</div>
          </div>
          {unusedBackup.length > 0 && (
            <Badge variant="outline" className="font-mono text-[10px] text-emerald-400 border-emerald-400/30">
              {unusedBackup.length} remaining
            </Badge>
          )}
        </div>
        <div className="px-5 py-5 space-y-4">
          {unusedBackup.length === 0 && backupCodes.length === 0 && (
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs font-mono text-amber-400">No backup codes yet. Generate them to protect your account.</p>
            </div>
          )}
          {unusedBackup.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Active Codes ({unusedBackup.length})</span>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setRevealed(r => !r)} className="h-7 text-xs gap-1">
                    {revealed ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />} {revealed ? "Hide" : "Show"}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={copyAllBackupCodes} className="h-7 text-xs gap-1">
                    <Copy className="w-3 h-3" /> Copy All
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {unusedBackup.map(c => (
                  <div key={c.id} className="flex items-center gap-2 bg-muted/30 border border-border/30 rounded-lg px-3 py-2">
                    <span className={cn("font-mono text-xs font-bold flex-1 tracking-widest transition-all", revealed ? "text-primary" : "text-muted-foreground/30 blur-sm")}>
                      {c.code}
                    </span>
                    <button onClick={() => copyToClipboard(c.code)} className="text-muted-foreground hover:text-primary flex-shrink-0">
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
              {usedBackup.length > 0 && (
                <p className="text-[10px] font-mono text-muted-foreground/40">{usedBackup.length} code{usedBackup.length > 1 ? "s" : ""} already used</p>
              )}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={generateBackupCodes} disabled={genLoading} className="text-xs gap-1.5 h-9">
              {genLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Key className="w-3.5 h-3.5" />}
              {backupCodes.length > 0 ? "Regenerate Codes" : "Generate 10 Codes"}
            </Button>
            {backupCodes.length > 0 && (
              <p className="text-[10px] font-mono text-muted-foreground/50 self-center">Regenerating will invalidate existing unused codes.</p>
            )}
          </div>
        </div>
      </div>

      {/* Magic Codes */}
      <div className="bg-card border border-card-border rounded-lg overflow-hidden">
        <div className="bg-violet-400/5 border-b border-card-border px-5 py-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-violet-400/10 border border-violet-400/20 flex items-center justify-center">
            <Zap className="w-4 h-4 text-violet-400" />
          </div>
          <div>
            <div className="font-mono font-bold text-sm text-foreground">Magic Login Codes</div>
            <div className="text-[10px] font-mono text-muted-foreground">One-time codes for instant login — share with trusted devices</div>
          </div>
        </div>
        <div className="px-5 py-5 space-y-4">
          <div className="flex gap-2">
            <Input
              value={magicLabel}
              onChange={e => setMagicLabel(e.target.value)}
              placeholder="Label (e.g. Phone, Office PC)"
              className="font-mono text-xs h-9 flex-1"
              onKeyDown={e => e.key === "Enter" && createMagicCode()}
            />
            <Button size="sm" onClick={createMagicCode} disabled={magicLoading} className="text-xs gap-1 h-9">
              {magicLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />} Create
            </Button>
          </div>
          {magicCodes.length === 0 ? (
            <p className="text-xs font-mono text-muted-foreground/40">No magic codes yet. Create one to enable one-tap login.</p>
          ) : (
            <div className="space-y-2">
              {magicCodes.map(c => (
                <div key={c.id} className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border",
                  c.is_used ? "bg-muted/10 border-border/20 opacity-50" : "bg-muted/20 border-border/40"
                )}>
                  <Zap className="w-3.5 h-3.5 text-violet-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-xs font-bold text-foreground">{c.label || "Magic Code"}</div>
                    <div className="font-mono text-[10px] text-muted-foreground/60 mt-0.5">
                      {c.is_used ? "Used" : c.expires_at ? `Expires ${new Date(c.expires_at).toLocaleDateString()}` : "No expiry"}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {!c.is_used && (
                      <button onClick={() => copyToClipboard(c.code)} className="p-1.5 rounded hover:bg-muted/40 text-muted-foreground hover:text-primary">
                        <Copy className="w-3 h-3" />
                      </button>
                    )}
                    <button onClick={() => deleteMagicCode(c.id)} className="p-1.5 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-400">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="bg-muted/20 border border-border/30 rounded-lg p-3">
            <p className="text-[10px] font-mono text-muted-foreground/60 leading-relaxed">
              Magic codes are single-use. Share one with a trusted device for instant login without password.
              Use them carefully — anyone with the code can log in to your account.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
