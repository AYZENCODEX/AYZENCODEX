import { useState, useEffect } from "react";
import { useListVaultEntries, customFetch } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import {
  Mail, Eye, EyeOff, Copy, Check, Shield,
  Smartphone, AtSign, Loader2, Twitter,
  MessageSquare, Phone, Settings, Server, Send, Inbox,
  Save, AlertCircle, CheckCircle2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

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

function CredRow({ label, value }: { label: string; value: string }) {
  const [shown, setShown] = useState(false);
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="flex items-center gap-2 py-0.5 group">
      <span className="font-mono text-[9px] text-muted-foreground/40 uppercase tracking-wider w-14 flex-shrink-0">{label}</span>
      <span className="flex-1 font-mono text-[10px] truncate text-foreground/70">
        {shown ? value : "•".repeat(Math.min(value.length, 12))}
      </span>
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

function MailCard({ item }: { item: MailItem }) {
  const [expanded, setExpanded] = useState(false);
  const [emailCopied, setEmailCopied] = useState(false);

  const copyEmail = async () => {
    await navigator.clipboard.writeText(item.email);
    setEmailCopied(true);
    setTimeout(() => setEmailCopied(false), 1500);
  };

  const hasConfig = item.password || item.recovery || item.recoveryPassword || item.twofa;

  const platformIcon = () => {
    if (item.platform === "twitter") return <Twitter className="w-3 h-3 text-sky-400" />;
    if (item.platform === "discord") return <MessageSquare className="w-3 h-3 text-indigo-400" />;
    if (item.platform === "telegram") return <Phone className="w-3 h-3 text-blue-400" />;
    if (item.source === "entity") return <Shield className="w-3 h-3 text-primary" />;
    return <Smartphone className="w-3 h-3 text-cyan-400" />;
  };

  const sourceBadgeColor = item.source === "entity"
    ? "text-primary bg-primary/10 border-primary/20"
    : "text-cyan-400 bg-cyan-400/10 border-cyan-400/20";

  return (
    <div className="bg-card border border-card-border rounded-xl overflow-hidden hover:border-primary/20 transition-all">
      <button
        className="w-full text-left px-4 py-3 flex items-center gap-3"
        onClick={() => hasConfig && setExpanded(x => !x)}
      >
        <div className="w-7 h-7 rounded-lg bg-muted/20 border border-border/30 flex items-center justify-center flex-shrink-0">
          {platformIcon()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-mono text-xs text-foreground font-medium truncate">{item.email}</p>
          <p className="font-mono text-[9px] text-muted-foreground/50">{item.sourceName}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {item.platform && (
            <Badge variant="outline" className="font-mono text-[9px] capitalize">{item.platform}</Badge>
          )}
          <Badge variant="outline" className={cn("font-mono text-[9px] border", sourceBadgeColor)}>
            {item.source}
          </Badge>
          <button
            onClick={e => { e.stopPropagation(); copyEmail(); }}
            className={cn("p-1 transition-colors", emailCopied ? "text-emerald-400" : "text-muted-foreground/40 hover:text-primary")}
          >
            {emailCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          </button>
        </div>
      </button>

      {expanded && hasConfig && (
        <div className="px-4 pb-3 border-t border-border/30 pt-2 space-y-0.5 bg-muted/5">
          {item.password && <CredRow label="password" value={item.password} />}
          {item.recovery && <CredRow label="recovery" value={item.recovery} />}
          {item.recoveryPassword && <CredRow label="rec.pass" value={item.recoveryPassword} />}
          {item.twofa && <CredRow label="2fa" value={item.twofa} />}
        </div>
      )}
    </div>
  );
}

// ─── IMAP/SMTP Config Component ───────────────────────────────────────────────
interface MailConfig {
  imapHost: string; imapPort: string; imapUser: string; imapPassword: string; imapSsl: boolean;
  smtpHost: string; smtpPort: string; smtpUser: string; smtpPassword: string; smtpTls: boolean;
}

function ImapSmtpConfig() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<"smtp" | "imap" | null>(null);
  const [config, setConfig] = useState<MailConfig>({
    imapHost: "", imapPort: "993", imapUser: "", imapPassword: "", imapSsl: true,
    smtpHost: "", smtpPort: "587", smtpUser: "", smtpPassword: "", smtpTls: true,
  });
  const [testResult, setTestResult] = useState<{ smtp?: boolean; imap?: boolean }>({});

  useEffect(() => {
    customFetch<any>("/settings/mail-config").then((d: any) => {
      if (d) setConfig(c => ({
        ...c,
        imapHost: d.imapHost ?? "", imapPort: String(d.imapPort ?? 993),
        imapUser: d.imapUser ?? "", imapPassword: d.imapPassword ?? "",
        smtpHost: d.smtpHost ?? "", smtpPort: String(d.smtpPort ?? 587),
        smtpUser: d.smtpUser ?? "", smtpPassword: d.smtpPassword ?? "",
      }));
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const set = (key: keyof MailConfig) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setConfig(c => ({ ...c, [key]: e.target.value }));

  const save = async () => {
    setSaving(true);
    try {
      await customFetch("/settings/mail-config", {
        method: "POST",
        body: JSON.stringify({
          imapHost: config.imapHost, imapPort: Number(config.imapPort),
          imapUser: config.imapUser, imapPassword: config.imapPassword,
          smtpHost: config.smtpHost, smtpPort: Number(config.smtpPort),
          smtpUser: config.smtpUser, smtpPassword: config.smtpPassword,
        }),
      });
      toast({ title: "Mail config saved", description: "IMAP & SMTP settings updated." });
    } catch {
      toast({ variant: "destructive", title: "Failed to save", description: "Check your settings." });
    } finally { setSaving(false); }
  };

  const testSMTP = async () => {
    setTesting("smtp");
    try {
      const res = await customFetch<any>("/settings/mail-config/test-smtp", { method: "POST" });
      setTestResult(r => ({ ...r, smtp: res?.ok === true }));
      toast({ title: res?.ok ? "SMTP connected ✓" : "SMTP failed", variant: res?.ok ? "default" : "destructive" });
    } catch {
      setTestResult(r => ({ ...r, smtp: false }));
      toast({ variant: "destructive", title: "SMTP test failed" });
    } finally { setTesting(null); }
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6 max-w-2xl">
      {/* IMAP Config */}
      <div className="rounded-xl border border-card-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border/30 flex items-center gap-2">
          <Inbox className="w-4 h-4 text-violet-400" />
          <div>
            <p className="font-mono text-sm font-bold text-foreground">IMAP — Incoming Mail</p>
            <p className="font-mono text-[10px] text-muted-foreground/50">Configure your mail server for reading emails</p>
          </div>
        </div>
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1">
              <Label className="font-mono text-[10px] uppercase text-muted-foreground">IMAP Host</Label>
              <Input value={config.imapHost} onChange={set("imapHost")} placeholder="imap.gmail.com" className="font-mono text-xs h-8 bg-input" />
            </div>
            <div className="space-y-1">
              <Label className="font-mono text-[10px] uppercase text-muted-foreground">Port</Label>
              <Input value={config.imapPort} onChange={set("imapPort")} placeholder="993" type="number" className="font-mono text-xs h-8 bg-input" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="font-mono text-[10px] uppercase text-muted-foreground">Username / Email</Label>
              <Input value={config.imapUser} onChange={set("imapUser")} placeholder="you@gmail.com" className="font-mono text-xs h-8 bg-input" />
            </div>
            <div className="space-y-1">
              <Label className="font-mono text-[10px] uppercase text-muted-foreground">Password / App Password</Label>
              <Input value={config.imapPassword} onChange={set("imapPassword")} type="password" placeholder="••••••••" className="font-mono text-xs h-8 bg-input" />
            </div>
          </div>
          <div className="flex items-center gap-2 p-2 bg-muted/10 rounded-lg border border-border/20">
            <Server className="w-3.5 h-3.5 text-muted-foreground/40" />
            <p className="font-mono text-[10px] text-muted-foreground/50">Common ports: 993 (SSL) · 143 (STARTTLS). Use App Passwords for Gmail/Outlook.</p>
          </div>
        </div>
      </div>

      {/* SMTP Config */}
      <div className="rounded-xl border border-card-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border/30 flex items-center gap-2">
          <Send className="w-4 h-4 text-emerald-400" />
          <div>
            <p className="font-mono text-sm font-bold text-foreground">SMTP — Outgoing Mail</p>
            <p className="font-mono text-[10px] text-muted-foreground/50">Configure your mail server for sending emails</p>
          </div>
          <div className="ml-auto">
            {testResult.smtp === true && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
            {testResult.smtp === false && <AlertCircle className="w-4 h-4 text-red-400" />}
          </div>
        </div>
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1">
              <Label className="font-mono text-[10px] uppercase text-muted-foreground">SMTP Host</Label>
              <Input value={config.smtpHost} onChange={set("smtpHost")} placeholder="smtp.gmail.com" className="font-mono text-xs h-8 bg-input" />
            </div>
            <div className="space-y-1">
              <Label className="font-mono text-[10px] uppercase text-muted-foreground">Port</Label>
              <Input value={config.smtpPort} onChange={set("smtpPort")} placeholder="587" type="number" className="font-mono text-xs h-8 bg-input" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="font-mono text-[10px] uppercase text-muted-foreground">Username / Email</Label>
              <Input value={config.smtpUser} onChange={set("smtpUser")} placeholder="you@gmail.com" className="font-mono text-xs h-8 bg-input" />
            </div>
            <div className="space-y-1">
              <Label className="font-mono text-[10px] uppercase text-muted-foreground">Password / App Password</Label>
              <Input value={config.smtpPassword} onChange={set("smtpPassword")} type="password" placeholder="••••••••" className="font-mono text-xs h-8 bg-input" />
            </div>
          </div>
          <div className="flex items-center gap-2 p-2 bg-muted/10 rounded-lg border border-border/20">
            <Server className="w-3.5 h-3.5 text-muted-foreground/40" />
            <p className="font-mono text-[10px] text-muted-foreground/50">Common ports: 465 (SSL) · 587 (STARTTLS) · 25 (plain). Use App Passwords for Gmail.</p>
          </div>
          <Button variant="outline" size="sm" onClick={testSMTP} disabled={testing !== null || !config.smtpHost} className="font-mono text-xs gap-2 h-8">
            {testing === "smtp" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
            Test SMTP Connection
          </Button>
        </div>
      </div>

      {/* Common providers */}
      <div className="rounded-xl border border-dashed border-border/40 p-4 space-y-3">
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50">Quick-fill common providers</p>
        <div className="flex flex-wrap gap-2">
          {[
            { label: "Gmail", imap: "imap.gmail.com", smtp: "smtp.gmail.com", iport: "993", sport: "587" },
            { label: "Outlook", imap: "outlook.office365.com", smtp: "smtp.office365.com", iport: "993", sport: "587" },
            { label: "Yahoo", imap: "imap.mail.yahoo.com", smtp: "smtp.mail.yahoo.com", iport: "993", sport: "587" },
            { label: "ProtonMail", imap: "127.0.0.1", smtp: "127.0.0.1", iport: "1143", sport: "1025" },
            { label: "iCloud", imap: "imap.mail.me.com", smtp: "smtp.mail.me.com", iport: "993", sport: "587" },
          ].map(p => (
            <button
              key={p.label}
              onClick={() => setConfig(c => ({ ...c, imapHost: p.imap, smtpHost: p.smtp, imapPort: p.iport, smtpPort: p.sport }))}
              className="px-3 py-1.5 rounded-lg border border-border/50 font-mono text-[10px] hover:border-primary/40 hover:text-primary transition-all text-muted-foreground/60"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <Button onClick={save} disabled={saving} className="font-mono text-xs uppercase gap-2">
        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
        Save Mail Configuration
      </Button>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function VaultMail() {
  const { data: vaultData, isLoading: vaultLoading } = useListVaultEntries();
  const [localAccounts, setLocalAccounts] = useState<any[]>([]);
  const [localLoading, setLocalLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "entity" | "local">("all");
  const [view, setView] = useState<"hub" | "config">("hub");

  useEffect(() => {
    customFetch<any>("/local-accounts").then((d: any) => {
      setLocalAccounts(Array.isArray(d) ? d : (d?.accounts ?? []));
    }).catch(() => {}).finally(() => setLocalLoading(false));
  }, []);

  const entries: any[] = (vaultData as any[] | undefined) ?? [];

  // Build mail items from entity vault entries
  const entityItems: MailItem[] = [];
  entries.forEach(e => {
    if (e.email) entityItems.push({
      id: `${e.id}-main`, source: "entity", sourceName: e.projectName ?? "Entity",
      email: e.email,
      password: e.emailPassword,
      recovery: e.emailRecovery,
      recoveryPassword: e.emailRecoveryPassword,
    });
    if (e.twitterEmail) entityItems.push({
      id: `${e.id}-tw`, source: "entity", sourceName: `${e.projectName} · Twitter`,
      platform: "twitter",
      email: e.twitterEmail,
      password: e.twitterEmailPassword,
      recovery: e.twitterEmailRecovery,
      recoveryPassword: e.twitterEmailRecoveryPassword,
      twofa: e.twitter2fa,
    });
    if (e.discordEmail) entityItems.push({
      id: `${e.id}-dc`, source: "entity", sourceName: `${e.projectName} · Discord`,
      platform: "discord",
      email: e.discordEmail,
      password: e.discordEmailPassword,
      recovery: e.discordEmailRecovery,
      recoveryPassword: e.discordEmailRecoveryPassword,
      twofa: e.discord2fa,
    });
    if (e.telegramLinkedEmail) entityItems.push({
      id: `${e.id}-tg`, source: "entity", sourceName: `${e.projectName} · Telegram`,
      platform: "telegram",
      email: e.telegramLinkedEmail,
      password: e.telegramLinkedEmailPassword,
      twofa: e.telegram2fa,
    });
  });

  // Build mail items from local accounts
  const localItems: MailItem[] = [];
  localAccounts.forEach(a => {
    if (a.email) localItems.push({
      id: `la-${a.id}-main`, source: "local",
      sourceName: `${a.label ?? a.username ?? a.category} · Main`,
      email: a.email,
      password: a.password,
      recovery: a.recovery_email,
      recoveryPassword: a.recovery_email_password,
      twofa: a.twofa,
    });
    if (a.recovery_email && a.recovery_email !== a.email) localItems.push({
      id: `la-${a.id}-rec`, source: "local",
      sourceName: `${a.label ?? a.username ?? a.category} · Recovery`,
      email: a.recovery_email,
      password: a.recovery_email_password,
      twofa: a.recovery_email_twofa,
    });
  });

  const allItems = [...entityItems, ...localItems];
  const filtered = filter === "all" ? allItems : allItems.filter(i => i.source === filter);
  const loading = vaultLoading || localLoading;

  return (
    <div className="space-y-4">
      {/* View toggle */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-mono font-bold text-sm flex items-center gap-2"><Mail className="w-4 h-4 text-primary" /> Mail Hub</h2>
          <p className="font-mono text-[10px] text-muted-foreground/50 mt-0.5">Aggregated emails from all vault sources</p>
        </div>
        <div className="flex items-center gap-1 bg-muted/20 rounded-lg p-1">
          <button onClick={() => setView("hub")} className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-md font-mono text-[10px] transition-all", view === "hub" ? "bg-card text-primary shadow-sm font-bold" : "text-muted-foreground/60 hover:text-muted-foreground")}>
            <AtSign className="w-3 h-3" /> Hub
          </button>
          <button onClick={() => setView("config")} className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-md font-mono text-[10px] transition-all", view === "config" ? "bg-card text-primary shadow-sm font-bold" : "text-muted-foreground/60 hover:text-muted-foreground")}>
            <Settings className="w-3 h-3" /> IMAP/SMTP
          </button>
        </div>
      </div>

      {view === "config" ? (
        <ImapSmtpConfig />
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Total Emails", value: allItems.length, icon: Mail, color: "text-primary" },
              { label: "From Entities", value: entityItems.length, icon: Shield, color: "text-violet-400" },
              { label: "From Local", value: localItems.length, icon: Smartphone, color: "text-cyan-400" },
            ].map(s => (
              <div key={s.label} className="bg-card border border-card-border rounded-xl p-3 flex items-center gap-3">
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
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "px-3 py-1.5 rounded-md font-mono text-xs transition-all capitalize",
                  filter === f ? "bg-card text-primary shadow-sm font-bold" : "text-muted-foreground/60 hover:text-muted-foreground"
                )}
              >
                {f}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 space-y-2">
              <AtSign className="w-8 h-8 text-muted-foreground/30 mx-auto" />
              <p className="font-mono text-xs text-muted-foreground/50">No emails configured</p>
              <p className="font-mono text-[10px] text-muted-foreground/30">
                Add emails to your entities or local accounts and they'll appear here
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {entityItems.length > 0 && (filter === "all" || filter === "entity") && (
                <div className="space-y-1.5">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/40 px-1">
                    Entity Emails ({entityItems.length})
                  </p>
                  {entityItems.map(item => <MailCard key={item.id} item={item} />)}
                </div>
              )}
              {localItems.length > 0 && (filter === "all" || filter === "local") && (
                <div className="space-y-1.5 mt-4">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/40 px-1">
                    Local Account Emails ({localItems.length})
                  </p>
                  {localItems.map(item => <MailCard key={item.id} item={item} />)}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
