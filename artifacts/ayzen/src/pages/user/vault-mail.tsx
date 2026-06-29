import { useState, useEffect, useCallback } from "react";
import { useListVaultEntries } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import {
  Mail, Eye, EyeOff, Copy, Check, Shield,
  Smartphone, AtSign, Loader2, Twitter, MessageSquare, Phone,
  Settings, Server, Send, Inbox, Save, Trash2, Plus,
  ChevronDown, ChevronUp, Star, CheckCircle2, XCircle, Wifi,
  Pencil, AlertCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

// ─── Types ────────────────────────────────────────────────────────────────────
interface MailItem {
  id: string;
  source: "entity" | "local";
  sourceName: string;
  platform?: string;
  email: string;
  password?: string | null;
  recovery?: string | null;
  recoveryPassword?: string | null;
  twofa?: string | null;
}

interface EmailAccount {
  id: number;
  label: string;
  emailAddress: string;
  imapHost?: string | null;
  imapPort?: number | null;
  smtpHost?: string | null;
  smtpPort?: number | null;
  username?: string | null;
  password?: string | null;
  useSSL: boolean;
  isDefault: boolean;
}

interface ImapSmtpFormState {
  label: string;
  imapHost: string; imapPort: string;
  smtpHost: string; smtpPort: string;
  username: string; password: string;
  useSSL: boolean;
}

const PROVIDERS = [
  { label: "Gmail",     imap: "imap.gmail.com",          smtp: "smtp.gmail.com",          iport: "993", sport: "587" },
  { label: "Outlook",   imap: "outlook.office365.com",   smtp: "smtp.office365.com",      iport: "993", sport: "587" },
  { label: "Yahoo",     imap: "imap.mail.yahoo.com",     smtp: "smtp.mail.yahoo.com",     iport: "993", sport: "587" },
  { label: "ProtonMail",imap: "127.0.0.1",               smtp: "127.0.0.1",               iport: "1143",sport: "1025" },
  { label: "iCloud",    imap: "imap.mail.me.com",        smtp: "smtp.mail.me.com",        iport: "993", sport: "587" },
  { label: "Zoho",      imap: "imap.zoho.com",           smtp: "smtp.zoho.com",           iport: "993", sport: "587" },
  { label: "Fastmail",  imap: "imap.fastmail.com",       smtp: "smtp.fastmail.com",       iport: "993", sport: "587" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function CredRow({ label, value }: { label: string; value: string }) {
  const [shown, setShown] = useState(false);
  const [copied, setCopied] = useState(false);
  const copy = async () => { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  return (
    <div className="flex items-center gap-2 py-0.5 group">
      <span className="font-mono text-[9px] text-muted-foreground/40 uppercase tracking-wider w-14 flex-shrink-0">{label}</span>
      <span className="flex-1 font-mono text-[10px] truncate text-foreground/70">{shown ? value : "•".repeat(Math.min(value.length, 12))}</span>
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={() => setShown(s => !s)} className="p-0.5 text-muted-foreground/40 hover:text-primary transition-colors">
          {shown ? <EyeOff className="w-2.5 h-2.5" /> : <Eye className="w-2.5 h-2.5" />}
        </button>
        <button onClick={copy} className={cn("p-0.5 transition-colors", copied ? "text-emerald-400" : "text-muted-foreground/40 hover:text-primary")}>
          {copied ? <Check className="w-2.5 h-2.5" /> : <Copy className="w-2.5 h-2.5" />}
        </button>
      </div>
    </div>
  );
}

function emptyForm(email?: string): ImapSmtpFormState {
  return {
    label: email ? email.split("@")[1]?.split(".")[0] ?? email : "",
    imapHost: "", imapPort: "993", smtpHost: "", smtpPort: "587",
    username: email ?? "", password: "", useSSL: true,
  };
}

function accountToForm(a: EmailAccount): ImapSmtpFormState {
  return {
    label: a.label,
    imapHost: a.imapHost ?? "", imapPort: String(a.imapPort ?? 993),
    smtpHost: a.smtpHost ?? "", smtpPort: String(a.smtpPort ?? 587),
    username: a.username ?? "", password: "",
    useSSL: a.useSSL,
  };
}

// ─── IMAP/SMTP Inline Config Form ─────────────────────────────────────────────
function ImapSmtpForm({
  emailAddress, existingAccount, token, onSaved, onDeleted, compact = false,
}: {
  emailAddress: string;
  existingAccount: EmailAccount | null;
  token: string | null;
  onSaved: () => void;
  onDeleted?: () => void;
  compact?: boolean;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState<ImapSmtpFormState>(() =>
    existingAccount ? accountToForm(existingAccount) : emptyForm(emailAddress)
  );
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const set = (key: keyof ImapSmtpFormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }));
  const quickFill = (p: typeof PROVIDERS[0]) =>
    setForm(f => ({ ...f, imapHost: p.imap, imapPort: p.iport, smtpHost: p.smtp, smtpPort: p.sport }));

  const save = async () => {
    setSaving(true);
    try {
      const body = {
        label: form.label || emailAddress,
        emailAddress,
        imapHost: form.imapHost, imapPort: Number(form.imapPort),
        smtpHost: form.smtpHost, smtpPort: Number(form.smtpPort),
        username: form.username || emailAddress,
        password: form.password || undefined,
        useSSL: form.useSSL,
      };
      const url = existingAccount
        ? `${BASE}/api/email-accounts/${existingAccount.id}`
        : `${BASE}/api/email-accounts`;
      const method = existingAccount ? "PUT" : "POST";
      const res = await fetch(url, {
        method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      toast({ title: existingAccount ? "Config updated" : "Config saved", description: `IMAP/SMTP saved for ${emailAddress}` });
      onSaved();
    } catch {
      toast({ variant: "destructive", title: "Save failed", description: "Check your settings and try again." });
    } finally { setSaving(false); }
  };

  const remove = async () => {
    if (!existingAccount) return;
    setDeleting(true);
    try {
      await fetch(`${BASE}/api/email-accounts/${existingAccount.id}`, {
        method: "DELETE", headers: { Authorization: `Bearer ${token}` },
      });
      toast({ title: "Config removed", description: `IMAP/SMTP removed for ${emailAddress}` });
      onDeleted?.();
    } catch {
      toast({ variant: "destructive", title: "Delete failed" });
    } finally { setDeleting(false); }
  };

  return (
    <div className={cn("space-y-3", compact ? "p-3" : "p-4")}>
      {/* Quick-fill providers */}
      <div>
        <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/40 mb-1.5">Quick-fill provider</p>
        <div className="flex flex-wrap gap-1.5">
          {PROVIDERS.map(p => (
            <button key={p.label} onClick={() => quickFill(p)}
              className="px-2 py-1 rounded border border-border/40 font-mono text-[9px] hover:border-primary/50 hover:text-primary transition-all text-muted-foreground/50">
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* IMAP */}
        <div className="space-y-2 p-3 bg-muted/5 rounded-lg border border-border/20">
          <div className="flex items-center gap-1.5 mb-2">
            <Inbox className="w-3 h-3 text-violet-400" />
            <p className="font-mono text-[10px] font-bold text-violet-400 uppercase tracking-wide">IMAP</p>
          </div>
          <div className="space-y-1">
            <Label className="font-mono text-[9px] uppercase text-muted-foreground/50">Host</Label>
            <Input value={form.imapHost} onChange={set("imapHost")} placeholder="imap.gmail.com" className="font-mono text-[10px] h-7 bg-input" />
          </div>
          <div className="space-y-1">
            <Label className="font-mono text-[9px] uppercase text-muted-foreground/50">Port</Label>
            <Input value={form.imapPort} onChange={set("imapPort")} placeholder="993" type="number" className="font-mono text-[10px] h-7 bg-input" />
          </div>
        </div>
        {/* SMTP */}
        <div className="space-y-2 p-3 bg-muted/5 rounded-lg border border-border/20">
          <div className="flex items-center gap-1.5 mb-2">
            <Send className="w-3 h-3 text-emerald-400" />
            <p className="font-mono text-[10px] font-bold text-emerald-400 uppercase tracking-wide">SMTP</p>
          </div>
          <div className="space-y-1">
            <Label className="font-mono text-[9px] uppercase text-muted-foreground/50">Host</Label>
            <Input value={form.smtpHost} onChange={set("smtpHost")} placeholder="smtp.gmail.com" className="font-mono text-[10px] h-7 bg-input" />
          </div>
          <div className="space-y-1">
            <Label className="font-mono text-[9px] uppercase text-muted-foreground/50">Port</Label>
            <Input value={form.smtpPort} onChange={set("smtpPort")} placeholder="587" type="number" className="font-mono text-[10px] h-7 bg-input" />
          </div>
        </div>
      </div>

      {/* Auth */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="font-mono text-[9px] uppercase text-muted-foreground/50">Username / Email</Label>
          <Input value={form.username} onChange={set("username")} placeholder={emailAddress} className="font-mono text-[10px] h-7 bg-input" />
        </div>
        <div className="space-y-1">
          <Label className="font-mono text-[9px] uppercase text-muted-foreground/50">
            {existingAccount ? "New Password (leave blank to keep)" : "Password / App Password"}
          </Label>
          <Input value={form.password} onChange={set("password")} type="password" placeholder="••••••••" className="font-mono text-[10px] h-7 bg-input" />
        </div>
      </div>

      <div className="flex items-center gap-2 p-2 bg-muted/10 rounded-lg border border-border/20 text-[9px] font-mono text-muted-foreground/40">
        <Server className="w-3 h-3 flex-shrink-0" />
        IMAP 993 (SSL) · 143 (STARTTLS) · SMTP 465 (SSL) · 587 (TLS) · Use App Passwords for Gmail/Outlook
      </div>

      <div className="flex items-center gap-2">
        <Button size="sm" onClick={save} disabled={saving || !form.imapHost || !form.smtpHost} className="font-mono text-[10px] gap-1.5 h-7">
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
          {existingAccount ? "Update" : "Save Config"}
        </Button>
        {existingAccount && onDeleted && (
          <Button size="sm" variant="ghost" onClick={remove} disabled={deleting} className="font-mono text-[10px] gap-1.5 h-7 text-red-400 hover:text-red-300 hover:bg-red-400/10">
            {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
            Remove
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Mail Card ────────────────────────────────────────────────────────────────
function MailCard({
  item, emailAccount, token, onRefresh,
}: {
  item: MailItem;
  emailAccount: EmailAccount | null;
  token: string | null;
  onRefresh: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [emailCopied, setEmailCopied] = useState(false);

  const copyEmail = async () => { await navigator.clipboard.writeText(item.email); setEmailCopied(true); setTimeout(() => setEmailCopied(false), 1500); };

  const hasConfig = item.password || item.recovery || item.recoveryPassword || item.twofa;
  const isConnected = !!emailAccount?.imapHost;

  const platformIcon = () => {
    if (item.platform === "twitter")  return <Twitter className="w-3 h-3 text-sky-400" />;
    if (item.platform === "discord")  return <MessageSquare className="w-3 h-3 text-indigo-400" />;
    if (item.platform === "telegram") return <Phone className="w-3 h-3 text-blue-400" />;
    if (item.source === "entity")     return <Shield className="w-3 h-3 text-primary" />;
    return <Smartphone className="w-3 h-3 text-cyan-400" />;
  };

  const sourceBadgeColor = item.source === "entity"
    ? "text-primary bg-primary/10 border-primary/20"
    : "text-cyan-400 bg-cyan-400/10 border-cyan-400/20";

  return (
    <div className={cn("bg-card border rounded-xl overflow-hidden transition-all", isConnected ? "border-emerald-500/20 hover:border-emerald-500/40" : "border-card-border hover:border-primary/20")}>
      {/* Header row */}
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="w-7 h-7 rounded-lg bg-muted/20 border border-border/30 flex items-center justify-center flex-shrink-0">
          {platformIcon()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="font-mono text-xs text-foreground font-medium truncate">{item.email}</p>
            {isConnected && (
              <span className="flex items-center gap-0.5 font-mono text-[8px] px-1 py-0.5 rounded bg-emerald-400/10 text-emerald-400 border border-emerald-400/20 flex-shrink-0">
                <Wifi className="w-2 h-2" /> IMAP
              </span>
            )}
          </div>
          <p className="font-mono text-[9px] text-muted-foreground/50">{item.sourceName}</p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {item.platform && (
            <Badge variant="outline" className="font-mono text-[9px] capitalize">{item.platform}</Badge>
          )}
          <Badge variant="outline" className={cn("font-mono text-[9px] border", sourceBadgeColor)}>
            {item.source}
          </Badge>
          <button
            onClick={e => { e.stopPropagation(); copyEmail(); }}
            className={cn("p-1 transition-colors", emailCopied ? "text-emerald-400" : "text-muted-foreground/40 hover:text-primary")}
            title="Copy email"
          >
            {emailCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          </button>
          {/* IMAP/SMTP toggle */}
          <button
            onClick={() => setConfigOpen(o => !o)}
            title={isConnected ? "Edit IMAP/SMTP" : "Configure IMAP/SMTP"}
            className={cn("p-1 rounded transition-colors", configOpen ? "text-primary bg-primary/10" : isConnected ? "text-emerald-400 hover:text-emerald-300" : "text-muted-foreground/30 hover:text-primary")}
          >
            <Settings className="w-3 h-3" />
          </button>
          {hasConfig && (
            <button onClick={() => setExpanded(x => !x)} className="p-1 text-muted-foreground/30 hover:text-primary transition-colors">
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          )}
        </div>
      </div>

      {/* Credentials panel */}
      {expanded && hasConfig && (
        <div className="px-4 pb-3 border-t border-border/30 pt-2 space-y-0.5 bg-muted/5">
          {item.password && <CredRow label="password" value={item.password} />}
          {item.recovery && <CredRow label="recovery" value={item.recovery} />}
          {item.recoveryPassword && <CredRow label="rec.pass" value={item.recoveryPassword} />}
          {item.twofa && <CredRow label="2fa" value={item.twofa} />}
        </div>
      )}

      {/* IMAP/SMTP config panel */}
      {configOpen && (
        <div className="border-t border-primary/10 bg-muted/5">
          <div className="px-4 py-2 flex items-center gap-2 border-b border-border/20">
            <Server className="w-3.5 h-3.5 text-primary" />
            <span className="font-mono text-[10px] font-bold text-primary uppercase tracking-wide">
              IMAP / SMTP Configuration
            </span>
            {isConnected && emailAccount && (
              <span className="font-mono text-[9px] text-muted-foreground/40 ml-auto">
                {emailAccount.imapHost} · {emailAccount.smtpHost}
              </span>
            )}
          </div>
          <ImapSmtpForm
            emailAddress={item.email}
            existingAccount={emailAccount}
            token={token}
            onSaved={() => { setConfigOpen(false); onRefresh(); }}
            onDeleted={() => { setConfigOpen(false); onRefresh(); }}
            compact
          />
        </div>
      )}
    </div>
  );
}

// ─── Full Account Manager (Config Tab) ────────────────────────────────────────
function AccountManager({
  token, emailAccounts, loading, onRefresh,
}: {
  token: string | null;
  emailAccounts: EmailAccount[];
  loading: boolean;
  onRefresh: () => void;
}) {
  const { toast } = useToast();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [deleting, setDeleting] = useState<number | null>(null);

  const remove = async (id: number) => {
    setDeleting(id);
    try {
      await fetch(`${BASE}/api/email-accounts/${id}`, {
        method: "DELETE", headers: { Authorization: `Bearer ${token}` },
      });
      toast({ title: "Account removed" });
      onRefresh();
    } catch {
      toast({ variant: "destructive", title: "Delete failed" });
    } finally { setDeleting(null); }
  };

  const setDefault = async (id: number) => {
    try {
      await fetch(`${BASE}/api/email-accounts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ isDefault: true }),
      });
      onRefresh();
    } catch {}
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="font-mono text-sm font-bold">Mail Accounts</p>
          <p className="font-mono text-[10px] text-muted-foreground/50">IMAP/SMTP configurations for each email address</p>
        </div>
        {!adding && (
          <Button size="sm" onClick={() => { setAdding(true); setNewEmail(""); }} className="font-mono text-xs gap-1.5 h-7">
            <Plus className="w-3 h-3" /> Add Account
          </Button>
        )}
      </div>

      {/* Add new account form */}
      {adding && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border/20 flex items-center justify-between">
            <span className="font-mono text-xs font-bold text-primary">New Mail Account</span>
            <button onClick={() => setAdding(false)} className="text-muted-foreground/40 hover:text-foreground">
              <XCircle className="w-4 h-4" />
            </button>
          </div>
          <div className="p-4 space-y-2">
            <Label className="font-mono text-[9px] uppercase text-muted-foreground/50">Email Address</Label>
            <Input
              value={newEmail} onChange={e => setNewEmail(e.target.value)}
              placeholder="you@gmail.com" className="font-mono text-xs h-8 bg-input max-w-xs"
            />
          </div>
          {newEmail && newEmail.includes("@") && (
            <ImapSmtpForm
              emailAddress={newEmail}
              existingAccount={null}
              token={token}
              onSaved={() => { setAdding(false); onRefresh(); }}
            />
          )}
        </div>
      )}

      {/* Account list */}
      {emailAccounts.length === 0 && !adding ? (
        <div className="text-center py-16 space-y-2">
          <Server className="w-8 h-8 text-muted-foreground/20 mx-auto" />
          <p className="font-mono text-xs text-muted-foreground/50">No mail accounts configured</p>
          <p className="font-mono text-[10px] text-muted-foreground/30">
            Click "Add Account" or use the ⚙ icon on any email in the Hub to configure IMAP/SMTP
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {emailAccounts.map(acct => (
            <div key={acct.id} className="rounded-xl border border-card-border bg-card overflow-hidden">
              {/* Account header */}
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="w-8 h-8 rounded-lg bg-muted/20 border border-border/30 flex items-center justify-center flex-shrink-0">
                  <Mail className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-mono text-xs font-bold truncate">{acct.emailAddress}</p>
                    {acct.isDefault && (
                      <span className="flex items-center gap-0.5 font-mono text-[8px] px-1 py-0.5 rounded bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 flex-shrink-0">
                        <Star className="w-2 h-2" /> Default
                      </span>
                    )}
                    {acct.imapHost && (
                      <span className="flex items-center gap-0.5 font-mono text-[8px] px-1 py-0.5 rounded bg-emerald-400/10 text-emerald-400 border border-emerald-400/20 flex-shrink-0">
                        <CheckCircle2 className="w-2 h-2" /> Connected
                      </span>
                    )}
                  </div>
                  <div className="font-mono text-[9px] text-muted-foreground/40 flex items-center gap-2">
                    {acct.imapHost && <span><Inbox className="w-2.5 h-2.5 inline mr-0.5 text-violet-400" />{acct.imapHost}:{acct.imapPort}</span>}
                    {acct.smtpHost && <span><Send className="w-2.5 h-2.5 inline mr-0.5 text-emerald-400" />{acct.smtpHost}:{acct.smtpPort}</span>}
                    {!acct.imapHost && !acct.smtpHost && <span className="text-muted-foreground/30">Not configured</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {!acct.isDefault && (
                    <button onClick={() => setDefault(acct.id)} title="Set as default"
                      className="p-1.5 text-muted-foreground/30 hover:text-yellow-400 transition-colors rounded">
                      <Star className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button onClick={() => setEditingId(editingId === acct.id ? null : acct.id)} title="Edit"
                    className={cn("p-1.5 rounded transition-colors", editingId === acct.id ? "text-primary bg-primary/10" : "text-muted-foreground/30 hover:text-primary")}>
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => remove(acct.id)} disabled={deleting === acct.id} title="Delete"
                    className="p-1.5 text-muted-foreground/30 hover:text-red-400 transition-colors rounded">
                    {deleting === acct.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
              {/* Edit panel */}
              {editingId === acct.id && (
                <div className="border-t border-border/20 bg-muted/5">
                  <ImapSmtpForm
                    emailAddress={acct.emailAddress}
                    existingAccount={acct}
                    token={token}
                    onSaved={() => { setEditingId(null); onRefresh(); }}
                    onDeleted={() => { setEditingId(null); onRefresh(); }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Info note */}
      <div className="flex items-start gap-2 p-3 bg-muted/10 border border-border/20 rounded-lg">
        <AlertCircle className="w-3.5 h-3.5 text-muted-foreground/40 mt-0.5 flex-shrink-0" />
        <p className="font-mono text-[9px] text-muted-foreground/40 leading-relaxed">
          Passwords are stored encrypted in the vault. Use Gmail/Outlook App Passwords instead of your main password.
          IMAP is used for reading mail; SMTP for sending. Configured emails show a <span className="text-emerald-400">IMAP</span> badge in the Hub view.
        </p>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function VaultMail() {
  const { token } = useAuth();
  const { data: vaultData, isLoading: vaultLoading } = useListVaultEntries();
  const [localAccounts, setLocalAccounts] = useState<any[]>([]);
  const [localLoading, setLocalLoading] = useState(true);
  const [emailAccounts, setEmailAccounts] = useState<EmailAccount[]>([]);
  const [emailAccountsLoading, setEmailAccountsLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "entity" | "local">("all");
  const [view, setView] = useState<"hub" | "accounts">("hub");

  const fetchEmailAccounts = useCallback(async () => {
    setEmailAccountsLoading(true);
    try {
      const res = await fetch(`${BASE}/api/email-accounts`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setEmailAccounts(await res.json());
    } catch {} finally { setEmailAccountsLoading(false); }
  }, [token]);

  useEffect(() => {
    fetch(`${BASE}/api/local-accounts`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : [])
      .then((d: any) => setLocalAccounts(Array.isArray(d) ? d : (d?.accounts ?? [])))
      .catch(() => {})
      .finally(() => setLocalLoading(false));
  }, [token]);

  useEffect(() => { fetchEmailAccounts(); }, [fetchEmailAccounts]);

  const entries: any[] = (vaultData as any[] | undefined) ?? [];

  // Build entity mail items
  const entityItems: MailItem[] = [];
  entries.forEach(e => {
    if (e.email) entityItems.push({ id: `${e.id}-main`, source: "entity", sourceName: e.projectName ?? "Entity", email: e.email, password: e.emailPassword, recovery: e.emailRecovery, recoveryPassword: e.emailRecoveryPassword });
    if (e.twitterEmail) entityItems.push({ id: `${e.id}-tw`, source: "entity", sourceName: `${e.projectName} · Twitter`, platform: "twitter", email: e.twitterEmail, password: e.twitterEmailPassword, recovery: e.twitterEmailRecovery, recoveryPassword: e.twitterEmailRecoveryPassword, twofa: e.twitter2fa });
    if (e.discordEmail) entityItems.push({ id: `${e.id}-dc`, source: "entity", sourceName: `${e.projectName} · Discord`, platform: "discord", email: e.discordEmail, password: e.discordEmailPassword, recovery: e.discordEmailRecovery, recoveryPassword: e.discordEmailRecoveryPassword, twofa: e.discord2fa });
    if (e.telegramLinkedEmail) entityItems.push({ id: `${e.id}-tg`, source: "entity", sourceName: `${e.projectName} · Telegram`, platform: "telegram", email: e.telegramLinkedEmail, password: e.telegramLinkedEmailPassword, twofa: e.telegram2fa });
  });

  // Build local account mail items
  const localItems: MailItem[] = [];
  localAccounts.forEach(a => {
    if (a.email) localItems.push({ id: `la-${a.id}-main`, source: "local", sourceName: `${a.label ?? a.username ?? a.category} · Main`, email: a.email, password: a.password, recovery: a.recovery_email, recoveryPassword: a.recovery_email_password, twofa: a.twofa });
    if (a.recovery_email && a.recovery_email !== a.email) localItems.push({ id: `la-${a.id}-rec`, source: "local", sourceName: `${a.label ?? a.username ?? a.category} · Recovery`, email: a.recovery_email, password: a.recovery_email_password, twofa: a.recovery_email_twofa });
  });

  const allItems = [...entityItems, ...localItems];
  const filtered = filter === "all" ? allItems : allItems.filter(i => i.source === filter);
  const loading = vaultLoading || localLoading;

  // Build emailAddress → EmailAccount map for Hub view
  const accountByEmail = new Map<string, EmailAccount>();
  emailAccounts.forEach(a => accountByEmail.set(a.emailAddress, a));

  const connectedCount = allItems.filter(i => accountByEmail.has(i.email)).length;

  return (
    <div className="space-y-4">
      {/* Header + view toggle */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-mono font-bold text-sm flex items-center gap-2">
            <Mail className="w-4 h-4 text-primary" /> Mail Hub
          </h2>
          <p className="font-mono text-[10px] text-muted-foreground/50 mt-0.5">
            Aggregated emails · per-email IMAP/SMTP vault
          </p>
        </div>
        <div className="flex items-center gap-1 bg-muted/20 rounded-lg p-1">
          <button onClick={() => setView("hub")} className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-md font-mono text-[10px] transition-all", view === "hub" ? "bg-card text-primary shadow-sm font-bold" : "text-muted-foreground/60 hover:text-muted-foreground")}>
            <AtSign className="w-3 h-3" /> Hub
          </button>
          <button onClick={() => setView("accounts")} className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-md font-mono text-[10px] transition-all", view === "accounts" ? "bg-card text-primary shadow-sm font-bold" : "text-muted-foreground/60 hover:text-muted-foreground")}>
            <Server className="w-3 h-3" /> IMAP/SMTP
            {emailAccounts.length > 0 && (
              <span className="ml-0.5 font-mono text-[8px] px-1 rounded-full bg-primary/20 text-primary">{emailAccounts.length}</span>
            )}
          </button>
        </div>
      </div>

      {view === "accounts" ? (
        <AccountManager token={token} emailAccounts={emailAccounts} loading={emailAccountsLoading} onRefresh={fetchEmailAccounts} />
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "Total Emails",   value: allItems.length,    icon: Mail,          color: "text-primary" },
              { label: "From Entities",  value: entityItems.length, icon: Shield,        color: "text-violet-400" },
              { label: "From Local",     value: localItems.length,  icon: Smartphone,    color: "text-cyan-400" },
              { label: "IMAP Connected", value: connectedCount,     icon: Wifi,          color: "text-emerald-400" },
            ].map(s => (
              <div key={s.label} className="bg-card border border-card-border rounded-xl p-3 flex items-center gap-2.5">
                <s.icon className={cn("w-4 h-4 flex-shrink-0", s.color)} />
                <div>
                  <p className={cn("font-mono text-base font-bold", s.color)}>{s.value}</p>
                  <p className="font-mono text-[9px] text-muted-foreground/50">{s.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Filter */}
          <div className="flex items-center gap-1 bg-muted/20 rounded-lg p-1 w-fit">
            {(["all", "entity", "local"] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)} className={cn("px-3 py-1.5 rounded-md font-mono text-xs transition-all capitalize", filter === f ? "bg-card text-primary shadow-sm font-bold" : "text-muted-foreground/60 hover:text-muted-foreground")}>
                {f}
              </button>
            ))}
          </div>

          {/* Mail list */}
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 space-y-2">
              <AtSign className="w-8 h-8 text-muted-foreground/30 mx-auto" />
              <p className="font-mono text-xs text-muted-foreground/50">No emails configured</p>
              <p className="font-mono text-[10px] text-muted-foreground/30">Add emails to entities or local accounts — they'll appear here</p>
            </div>
          ) : (
            <div className="space-y-3">
              {entityItems.length > 0 && (filter === "all" || filter === "entity") && (
                <div className="space-y-1.5">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/40 px-1">Entity Emails ({entityItems.length})</p>
                  {entityItems.map(item => (
                    <MailCard key={item.id} item={item} emailAccount={accountByEmail.get(item.email) ?? null} token={token} onRefresh={fetchEmailAccounts} />
                  ))}
                </div>
              )}
              {localItems.length > 0 && (filter === "all" || filter === "local") && (
                <div className="space-y-1.5 mt-4">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/40 px-1">Local Account Emails ({localItems.length})</p>
                  {localItems.map(item => (
                    <MailCard key={item.id} item={item} emailAccount={accountByEmail.get(item.email) ?? null} token={token} onRefresh={fetchEmailAccounts} />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
