import { useState, useEffect, useCallback } from "react";
import { useSearch, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ShieldCheck, KeyRound, Eye, EyeOff, Lock, Key, Copy, Trash2, Plus,
  AlertTriangle, Zap, Loader2, Smartphone, Mail, QrCode, CheckCircle2, XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

const SECURITY_SIDEBAR = [
  { id: "password", label: "Password",       icon: KeyRound },
  { id: "2fa",       label: "2FA / TOTP",     icon: QrCode },
  { id: "backup",    label: "Backup Codes",   icon: Key },
  { id: "magic",     label: "Magic Codes",    icon: Zap },
  { id: "recovery",  label: "Recovery Email", icon: Mail },
] as const;

type SecuritySection = typeof SECURITY_SIDEBAR[number]["id"];

export default function UserSecurity() {
  const { token, user } = useAuth() as any;
  const search = useSearch();
  const [, navigate] = useLocation();
  const urlTab = new URLSearchParams(search).get("tab") as SecuritySection | null;
  const [section, setSectionState] = useState<SecuritySection>(
    urlTab && SECURITY_SIDEBAR.some(s => s.id === urlTab) ? urlTab : "password"
  );
  const setSection = (id: SecuritySection) => {
    setSectionState(id);
    navigate(`/security?tab=${id}`, { replace: true });
  };
  useEffect(() => {
    if (urlTab && SECURITY_SIDEBAR.some(s => s.id === urlTab) && urlTab !== section) {
      setSectionState(urlTab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlTab]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold font-mono tracking-tighter uppercase flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-primary" /> Security
        </h1>
        <p className="text-muted-foreground font-mono text-xs mt-1">
          Account: <span className="text-primary">{user?.username ?? "..."}</span> · {user?.email ?? ""}
        </p>
      </div>

      <div className="flex flex-col md:flex-row border border-card-border rounded-xl overflow-hidden min-h-[560px] bg-card">
        {/* ── Mobile nav: scrollable pill bar ──────────────────────────── */}
        <div className="md:hidden flex gap-1 overflow-x-auto border-b border-card-border bg-card/60 px-3 py-2 shrink-0 no-scrollbar">
          {SECURITY_SIDEBAR.map(item => (
            <button
              key={item.id}
              onClick={() => setSection(item.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-mono font-medium whitespace-nowrap transition-all shrink-0",
                section === item.id
                  ? "bg-primary/15 text-primary border border-primary/30"
                  : "text-muted-foreground border border-transparent hover:bg-muted/30 hover:text-foreground"
              )}
            >
              <item.icon className="w-3.5 h-3.5 shrink-0" />
              {item.label}
            </button>
          ))}
        </div>

        {/* ── Desktop sidebar ───────────────────────────────────────────── */}
        <nav className="hidden md:flex w-52 shrink-0 border-r border-card-border bg-card/60 flex-col py-2">
          {SECURITY_SIDEBAR.map(item => (
            <button
              key={item.id}
              onClick={() => setSection(item.id)}
              className={cn(
                "flex items-center gap-2.5 px-4 py-3 text-xs font-mono font-medium transition-all text-left border-r-2",
                section === item.id
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30"
              )}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              {item.label}
            </button>
          ))}
        </nav>

        {/* ── Content ────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-auto p-4 md:p-5 min-w-0">
          {section === "password" && <PasswordPanel token={token} />}
          {section === "2fa" && <TwoFactorPanel token={token} />}
          {section === "backup" && <BackupCodesPanel token={token} />}
          {section === "magic" && <MagicCodesPanel token={token} />}
          {section === "recovery" && <RecoveryEmailPanel token={token} user={user} />}
        </div>
      </div>
    </div>
  );
}

function Panel({ title, sub, icon: Icon, iconClass, children }: { title: string; sub?: string; icon: React.ElementType; iconClass?: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-card-border rounded-lg overflow-hidden">
      <div className="bg-primary/5 border-b border-card-border px-5 py-4 flex items-center gap-3">
        <div className={cn("w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center", iconClass)}>
          <Icon className="w-4 h-4 text-primary" />
        </div>
        <div>
          <div className="font-mono font-bold text-sm text-foreground">{title}</div>
          {sub && <div className="text-[10px] font-mono text-muted-foreground mt-0.5">{sub}</div>}
        </div>
      </div>
      <div className="px-5 py-5">{children}</div>
    </div>
  );
}

// ─── Password ─────────────────────────────────────────────────────────────────
function PasswordPanel({ token }: { token: string }) {
  const { toast } = useToast();
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChangePassword = async () => {
    if (!oldPw || !newPw) { toast({ variant: "destructive", title: "Fill both fields" }); return; }
    if (newPw.length < 6) { toast({ variant: "destructive", title: "New password too short", description: "Minimum 6 characters." }); return; }
    setLoading(true);
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
    } catch { toast({ variant: "destructive", title: "Connection error" }); }
    setLoading(false);
  };

  return (
    <Panel title="Change Password" sub="Update your account passphrase" icon={KeyRound}>
      <div className="max-w-md space-y-4">
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
          disabled={loading || !oldPw || !newPw}
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
          {loading ? "Updating..." : "Update Password"}
        </Button>
      </div>
    </Panel>
  );
}

// ─── 2FA / TOTP ────────────────────────────────────────────────────────────────
function TwoFactorPanel({ token }: { token: string }) {
  const { toast } = useToast();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [setupData, setSetupData] = useState<{ secret: string; qrDataUrl: string } | null>(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [busy, setBusy] = useState(false);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${BASE}/api/security/2fa/status`, { headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      setEnabled(!!d.enabled);
    } catch { setEnabled(false); }
    setLoading(false);
  }, [token]);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  const startSetup = async () => {
    setBusy(true);
    try {
      const r = await fetch(`${BASE}/api/security/2fa/setup`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setSetupData(d);
    } catch (e: any) { toast({ variant: "destructive", title: "Setup failed", description: e.message }); }
    setBusy(false);
  };

  const confirmSetup = async () => {
    if (verifyCode.trim().length !== 6) { toast({ variant: "destructive", title: "Enter the 6-digit code" }); return; }
    setBusy(true);
    try {
      const r = await fetch(`${BASE}/api/security/2fa/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ token: verifyCode.trim() }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      toast({ title: "✅ 2FA enabled", description: "Your account now requires an authenticator code." });
      setEnabled(true);
      setSetupData(null);
      setVerifyCode("");
    } catch (e: any) { toast({ variant: "destructive", title: "Verification failed", description: e.message }); }
    setBusy(false);
  };

  const disable2fa = async () => {
    setBusy(true);
    try {
      const r = await fetch(`${BASE}/api/security/2fa/disable`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      toast({ title: "2FA disabled" });
      setEnabled(false);
    } catch (e: any) { toast({ variant: "destructive", title: "Failed", description: e.message }); }
    setBusy(false);
  };

  return (
    <Panel title="Two-Factor Authentication" sub="Protect your account with a TOTP authenticator app" icon={QrCode}>
      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-xs font-mono"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading...</div>
      ) : enabled ? (
        <div className="space-y-4 max-w-md">
          <div className="bg-emerald-500/5 border border-emerald-500/15 rounded-md px-4 py-3 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            <div>
              <div className="font-mono text-sm text-emerald-400 font-medium">2FA is active</div>
              <div className="font-mono text-xs text-muted-foreground mt-0.5">Codes are required from your authenticator app.</div>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="font-mono text-xs border-red-500/20 text-red-400 hover:bg-red-500/10 hover:border-red-500/30 gap-2"
            onClick={disable2fa}
            disabled={busy}
          >
            <XCircle className="w-3.5 h-3.5" />
            {busy ? "Disabling..." : "Disable 2FA"}
          </Button>
        </div>
      ) : setupData ? (
        <div className="space-y-4 max-w-md">
          <div className="flex flex-col items-center gap-3 bg-muted/20 border border-border/30 rounded-lg p-4">
            <img src={setupData.qrDataUrl} alt="2FA QR code" className="w-40 h-40 rounded-md bg-white p-2" />
            <p className="text-[10px] font-mono text-muted-foreground text-center">Scan with Google Authenticator, Authy, or any TOTP app</p>
            <div className="flex items-center gap-2 bg-background border border-border/40 rounded px-3 py-1.5">
              <span className="font-mono text-xs tracking-widest text-primary">{setupData.secret}</span>
              <button onClick={() => { navigator.clipboard.writeText(setupData.secret); toast({ title: "Copied!" }); }} className="text-muted-foreground hover:text-primary">
                <Copy className="w-3 h-3" />
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Enter 6-digit code to confirm</label>
            <div className="flex gap-2">
              <Input
                value={verifyCode}
                onChange={e => setVerifyCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="123456"
                maxLength={6}
                className="font-mono tracking-[0.4em] text-center text-lg h-11 bg-input border-border focus-visible:ring-primary/50 focus-visible:border-primary max-w-[160px]"
                onKeyDown={e => e.key === "Enter" && confirmSetup()}
              />
              <Button onClick={confirmSetup} disabled={busy || verifyCode.length !== 6} className="font-mono text-xs h-11">
                {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Confirm & Enable"}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4 max-w-md">
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs font-mono text-amber-400">2FA is not enabled. Add an extra layer of protection.</p>
          </div>
          <Button onClick={startSetup} disabled={busy} className="font-mono text-xs gap-2 h-10">
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Smartphone className="w-3.5 h-3.5" />}
            Set Up 2FA
          </Button>
        </div>
      )}
    </Panel>
  );
}

// ─── Backup Codes ───────────────────────────────────────────────────────────────
function BackupCodesPanel({ token }: { token: string }) {
  const { toast } = useToast();
  const [backupCodes, setBackupCodes] = useState<{ id: number; code: string; is_used: boolean }[]>([]);
  const [genLoading, setGenLoading] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const loadCodes = useCallback(async () => {
    try {
      const r = await fetch(`${BASE}/api/security/backup-codes`, { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) setBackupCodes(await r.json());
    } catch { }
  }, [token]);

  useEffect(() => { loadCodes(); }, [loadCodes]);

  const generateBackupCodes = async () => {
    setGenLoading(true);
    try {
      const r = await fetch(`${BASE}/api/security/backup-codes/generate`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      toast({ title: "✅ 10 backup codes generated! Save them now." });
      await loadCodes();
      setRevealed(true);
    } catch (e: any) { toast({ title: e.message, variant: "destructive" }); }
    setGenLoading(false);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => toast({ title: "Copied!" })).catch(() => {});
  };
  const copyAllBackupCodes = () => copyToClipboard(unusedBackup.map(c => c.code).join("\n"));

  const unusedBackup = backupCodes.filter(c => !c.is_used);
  const usedBackup = backupCodes.filter(c => c.is_used);

  return (
    <Panel title="Backup Codes" sub="One-time codes to access your account if you lose access" icon={Key}>
      <div className="space-y-4">
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
            <div className="grid grid-cols-2 gap-1.5 max-w-md">
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
        <div className="flex flex-wrap gap-2 items-center">
          <Button size="sm" onClick={generateBackupCodes} disabled={genLoading} className="text-xs gap-1.5 h-9">
            {genLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Key className="w-3.5 h-3.5" />}
            {backupCodes.length > 0 ? "Regenerate Codes" : "Generate 10 Codes"}
          </Button>
          {backupCodes.length > 0 && (
            <p className="text-[10px] font-mono text-muted-foreground/50">Regenerating will invalidate existing unused codes.</p>
          )}
        </div>
      </div>
    </Panel>
  );
}

// ─── Magic Codes ────────────────────────────────────────────────────────────────
function MagicCodesPanel({ token }: { token: string }) {
  const { toast } = useToast();
  const [magicCodes, setMagicCodes] = useState<{ id: number; code: string; label?: string; is_used: boolean; expires_at?: string }[]>([]);
  const [magicLoading, setMagicLoading] = useState(false);
  const [magicLabel, setMagicLabel] = useState("");

  const loadCodes = useCallback(async () => {
    try {
      const r = await fetch(`${BASE}/api/security/magic-codes`, { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) setMagicCodes(await r.json());
    } catch { }
  }, [token]);

  useEffect(() => { loadCodes(); }, [loadCodes]);

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

  return (
    <Panel title="Magic Login Codes" sub="One-time codes for instant login — share with trusted devices" icon={Zap}>
      <div className="space-y-4 max-w-md">
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
    </Panel>
  );
}

// ─── Recovery Email ─────────────────────────────────────────────────────────────
function RecoveryEmailPanel({ token, user }: { token: string; user: any }) {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [saved, setSaved] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${BASE}/api/security/recovery-email`, { headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      setSaved(d.recoveryEmail ?? null);
      setEmail(d.recoveryEmail ?? "");
    } catch { }
    setLoading(false);
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      const r = await fetch(`${BASE}/api/security/recovery-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email: email.trim() }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      toast({ title: "✅ Recovery email updated" });
      setSaved(d.recoveryEmail);
    } catch (e: any) { toast({ variant: "destructive", title: "Failed", description: e.message }); }
    setSaving(false);
  };

  const remove = async () => {
    setEmail("");
    setSaving(true);
    try {
      const r = await fetch(`${BASE}/api/security/recovery-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email: "" }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      toast({ title: "Recovery email removed" });
      setSaved(null);
    } catch (e: any) { toast({ variant: "destructive", title: "Failed", description: e.message }); }
    setSaving(false);
  };

  return (
    <Panel title="Recovery Email" sub="A secondary email used to help you regain access to your account" icon={Mail}>
      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-xs font-mono"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading...</div>
      ) : (
        <div className="max-w-md space-y-4">
          {saved && (
            <div className="bg-emerald-500/5 border border-emerald-500/15 rounded-md px-4 py-3 flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
              <div>
                <div className="font-mono text-sm text-emerald-400 font-medium">Recovery email set</div>
                <div className="font-mono text-xs text-muted-foreground mt-0.5">{saved}</div>
              </div>
            </div>
          )}
          <div className="space-y-2">
            <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Recovery Email Address</label>
            <Input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="font-mono h-10 text-sm bg-input border-border focus-visible:ring-primary/50"
            />
            <p className="text-[10px] font-mono text-muted-foreground/50">Must be different from your primary login email ({user?.email ?? "—"}).</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={save} disabled={saving || !email.trim() || email.trim() === saved} className="font-mono text-xs gap-2 h-10">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
              Save
            </Button>
            {saved && (
              <Button variant="outline" onClick={remove} disabled={saving} className="font-mono text-xs gap-2 h-10 border-red-500/20 text-red-400 hover:bg-red-500/10">
                <Trash2 className="w-3.5 h-3.5" /> Remove
              </Button>
            )}
          </div>
        </div>
      )}
    </Panel>
  );
}
