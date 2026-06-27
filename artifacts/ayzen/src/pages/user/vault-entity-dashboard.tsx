import { useState } from "react";
import { useListVaultEntries } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import {
  Shield, AlertTriangle, CheckCircle2, XCircle,
  Mail, Twitter, MessageSquare, Phone, Wallet,
  Key, FileText, Smartphone, Loader2, TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

type EntryAny = any;

interface CheckItem {
  key: string;
  label: string;
  icon: React.ElementType;
  color: string;
  getValue: (e: EntryAny) => boolean;
}

const CHECKS: CheckItem[] = [
  { key: "email",      label: "Main Email",      icon: Mail,         color: "text-cyan-400",    getValue: e => !!e.email },
  { key: "emailPass",  label: "Email Password",  icon: Key,          color: "text-amber-400",   getValue: e => !!e.emailPassword },
  { key: "twitter",    label: "Twitter",         icon: Twitter,      color: "text-sky-400",     getValue: e => !!e.twitterUsername },
  { key: "twitter2fa", label: "Twitter 2FA",     icon: Smartphone,   color: "text-sky-300",     getValue: e => !!e.twitter2fa },
  { key: "discord",    label: "Discord",         icon: MessageSquare,color: "text-indigo-400",  getValue: e => !!e.discordUsername },
  { key: "discord2fa", label: "Discord 2FA",     icon: Smartphone,   color: "text-indigo-300",  getValue: e => !!e.discord2fa },
  { key: "telegram",   label: "Telegram",        icon: Phone,        color: "text-blue-400",    getValue: e => !!e.telegramUsername || !!e.telegramPhone },
  { key: "telegram2fa","label": "Telegram 2FA",  icon: Smartphone,   color: "text-blue-300",    getValue: e => !!e.telegram2fa },
  { key: "wallet",     label: "Wallet Address",  icon: Wallet,       color: "text-emerald-400", getValue: e => Array.isArray(e.walletAddresses) ? e.walletAddresses.length > 0 : !!e.walletAddresses },
  { key: "seed",       label: "Seed Phrase",     icon: Shield,       color: "text-violet-400",  getValue: e => !!e.hasSeedPhrase },
  { key: "backup",     label: "Backup Codes",    icon: Key,          color: "text-orange-400",  getValue: e => Array.isArray(e.backupCodes) ? e.backupCodes.length > 0 : !!e.backupCodes },
  { key: "notes",      label: "Notes",           icon: FileText,     color: "text-muted-foreground", getValue: e => !!e.notes },
];

function healthScore(e: EntryAny): number {
  const filled = CHECKS.filter(c => c.getValue(e)).length;
  return Math.round((filled / CHECKS.length) * 100);
}

function healthColor(score: number) {
  if (score >= 80) return "text-emerald-400";
  if (score >= 50) return "text-amber-400";
  return "text-red-400";
}

function healthBarColor(score: number) {
  if (score >= 80) return "bg-emerald-400";
  if (score >= 50) return "bg-amber-400";
  return "bg-red-400";
}

function healthLabel(score: number) {
  if (score >= 80) return { label: "Healthy", color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20" };
  if (score >= 50) return { label: "Partial",  color: "text-amber-400 bg-amber-400/10 border-amber-400/20" };
  return { label: "At Risk", color: "text-red-400 bg-red-400/10 border-red-400/20" };
}

function EntityCard({ entry }: { entry: EntryAny }) {
  const [expanded, setExpanded] = useState(false);
  const score = healthScore(entry);
  const { label, color: badgeColor } = healthLabel(score);
  const missing = CHECKS.filter(c => !c.getValue(entry));
  const present = CHECKS.filter(c => c.getValue(entry));

  return (
    <div className="bg-card border border-card-border rounded-xl overflow-hidden transition-all">
      <button
        className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-muted/10 transition-colors"
        onClick={() => setExpanded(x => !x)}
      >
        {/* Category badge */}
        <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
          <Shield className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-mono text-xs font-bold text-foreground truncate">{entry.projectName}</p>
          <p className="font-mono text-[10px] text-muted-foreground/50">{entry.category} · {entry.entitySerial}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={cn("font-mono text-xs font-bold", healthColor(score))}>{score}%</span>
          <Badge variant="outline" className={cn("font-mono text-[9px] px-1.5 border", badgeColor)}>{label}</Badge>
        </div>
      </button>

      {/* Progress bar */}
      <div className="px-4 pb-1">
        <div className="h-1 bg-muted/20 rounded-full overflow-hidden">
          <div className={cn("h-full rounded-full transition-all", healthBarColor(score))} style={{ width: `${score}%` }} />
        </div>
      </div>

      {expanded && (
        <div className="px-4 pt-2 pb-4 border-t border-border/30 mt-2">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            {CHECKS.map(check => {
              const has = check.getValue(entry);
              const Icon = check.icon;
              return (
                <div
                  key={check.key}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 border",
                    has
                      ? "bg-emerald-400/5 border-emerald-400/15"
                      : "bg-red-400/5 border-red-400/15"
                  )}
                >
                  <Icon className={cn("w-3 h-3 flex-shrink-0", has ? check.color : "text-red-400/60")} />
                  <span className={cn("font-mono text-[9px] truncate", has ? "text-foreground/80" : "text-muted-foreground/50")}>{check.label}</span>
                  {has
                    ? <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400 flex-shrink-0 ml-auto" />
                    : <XCircle className="w-2.5 h-2.5 text-red-400/60 flex-shrink-0 ml-auto" />
                  }
                </div>
              );
            })}
          </div>

          {missing.length > 0 && (
            <div className="mt-3 p-2.5 rounded-lg bg-amber-400/5 border border-amber-400/20">
              <div className="flex items-center gap-1.5 mb-1">
                <AlertTriangle className="w-3 h-3 text-amber-400" />
                <span className="font-mono text-[9px] uppercase tracking-widest text-amber-400 font-bold">Missing ({missing.length})</span>
              </div>
              <p className="font-mono text-[9px] text-muted-foreground/60 leading-relaxed">
                {missing.map(m => m.label).join(" · ")}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function VaultEntityDashboard() {
  const { data, isLoading } = useListVaultEntries();
  const entries: EntryAny[] = (data as EntryAny[] | undefined) ?? [];

  const healthy = entries.filter(e => healthScore(e) >= 80).length;
  const partial  = entries.filter(e => { const s = healthScore(e); return s >= 50 && s < 80; }).length;
  const atRisk   = entries.filter(e => healthScore(e) < 50).length;
  const avgScore = entries.length > 0
    ? Math.round(entries.reduce((s, e) => s + healthScore(e), 0) / entries.length)
    : 0;

  if (isLoading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-5 h-5 text-primary animate-spin" />
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Entities", value: entries.length.toString(), icon: Shield, color: "text-primary" },
          { label: "Healthy (80%+)", value: healthy.toString(), icon: CheckCircle2, color: "text-emerald-400" },
          { label: "Partial",        value: partial.toString(),  icon: AlertTriangle, color: "text-amber-400" },
          { label: "At Risk",        value: atRisk.toString(),   icon: XCircle, color: "text-red-400" },
        ].map(s => (
          <div key={s.label} className="bg-card border border-card-border rounded-xl p-3.5 flex items-start gap-3">
            <s.icon className={cn("w-5 h-5 mt-0.5 flex-shrink-0", s.color)} />
            <div>
              <p className={cn("text-lg font-bold font-mono", s.color)}>{s.value}</p>
              <p className="text-[10px] text-muted-foreground/60 font-mono">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Average health bar */}
      {entries.length > 0 && (
        <div className="bg-card border border-card-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-3.5 h-3.5 text-primary" />
              <span className="font-mono text-xs font-bold text-primary">Portfolio Health</span>
            </div>
            <span className={cn("font-mono text-sm font-bold", healthColor(avgScore))}>{avgScore}%</span>
          </div>
          <Progress value={avgScore} className="h-2" />
          <p className="font-mono text-[10px] text-muted-foreground/50 mt-2">
            Average completeness across all {entries.length} entities
          </p>
        </div>
      )}

      {/* Entity list */}
      {entries.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground/50 font-mono text-xs">
          No entities in vault · Add entities to see health status
        </div>
      ) : (
        <div className="space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/40 px-1">
            Entity Completeness · Click to expand
          </p>
          {[...entries].sort((a, b) => healthScore(a) - healthScore(b)).map(e => (
            <EntityCard key={e.id} entry={e} />
          ))}
        </div>
      )}
    </div>
  );
}
