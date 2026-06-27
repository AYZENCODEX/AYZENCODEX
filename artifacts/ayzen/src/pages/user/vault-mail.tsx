import { useState, useEffect } from "react";
import { useListVaultEntries, customFetch } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import {
  Mail, Eye, EyeOff, Copy, Check, Shield,
  Smartphone, AtSign, RefreshCw, Loader2, Twitter,
  MessageSquare, Phone,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

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

export default function VaultMail() {
  const { data: vaultData, isLoading: vaultLoading } = useListVaultEntries();
  const [localAccounts, setLocalAccounts] = useState<any[]>([]);
  const [localLoading, setLocalLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "entity" | "local">("all");

  useEffect(() => {
    customFetch<any>("/local-accounts").then(d => {
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
    </div>
  );
}
