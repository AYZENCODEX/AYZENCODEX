import { useState, useEffect } from "react";
import { customFetch } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import {
  Users, Award, Github, Linkedin, TrendingUp, TrendingDown,
  DollarSign, BarChart2, Star, RefreshCw, Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface LocalAccount {
  id: number;
  category: string;
  label: string | null;
  username: string | null;
  email: string | null;
  followers: string | null;
  account_worth: number;
  buy_price: number;
  account_create_date: string | null;
}

const PLATFORM_META: Record<string, {
  label: string;
  metricName: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  border: string;
}> = {
  Google:    { label: "Google / Gmail", metricName: "Points",      icon: Award,   color: "text-red-400",    bg: "bg-red-500/10",    border: "border-red-500/20" },
  Facebook:  { label: "Facebook",       metricName: "Followers",   icon: Users,   color: "text-blue-400",   bg: "bg-blue-500/10",   border: "border-blue-500/20" },
  Instagram: { label: "Instagram",      metricName: "Followers",   icon: Users,   color: "text-pink-400",   bg: "bg-pink-500/10",   border: "border-pink-500/20" },
  Twitter:   { label: "Twitter / X",    metricName: "Followers",   icon: Users,   color: "text-sky-400",    bg: "bg-sky-500/10",    border: "border-sky-500/20" },
  LinkedIn:  { label: "LinkedIn",       metricName: "Connections", icon: Linkedin,color: "text-blue-500",   bg: "bg-blue-600/10",   border: "border-blue-600/20" },
  GitHub:    { label: "GitHub",         metricName: "Repos",       icon: Github,  color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/20" },
  Reddit:    { label: "Reddit",         metricName: "Karma",       icon: Star,    color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/20" },
  Discord:   { label: "Discord",        metricName: "Servers",     icon: Users,   color: "text-indigo-400", bg: "bg-indigo-500/10", border: "border-indigo-500/20" },
};

function getMeta(cat: string) {
  return PLATFORM_META[cat] ?? { label: cat, metricName: "Metric", icon: BarChart2, color: "text-primary", bg: "bg-primary/10", border: "border-primary/20" };
}

function calcROI(worth: number, buy: number): number | null {
  if (!buy || buy === 0) return null;
  return ((worth - buy) / buy) * 100;
}

function ROIBadge({ worth, buy }: { worth: number; buy: number }) {
  const roi = calcROI(worth, buy);
  if (roi === null) return <span className="text-muted-foreground/40 font-mono text-[10px]">—</span>;
  const pos = roi >= 0;
  return (
    <span className={cn("font-mono text-[10px] font-bold", pos ? "text-emerald-400" : "text-red-400")}>
      {pos ? "+" : ""}{roi.toFixed(0)}%
    </span>
  );
}

function OverviewTab({ accounts }: { accounts: LocalAccount[] }) {
  const cats = [...new Set(accounts.map(a => a.category))].sort();
  const totalAccounts = accounts.length;
  const totalWorth = accounts.reduce((s, a) => s + (a.account_worth ?? 0), 0);
  const totalInvested = accounts.reduce((s, a) => s + (a.buy_price ?? 0), 0);
  const overallROI = calcROI(totalWorth, totalInvested);

  return (
    <div className="space-y-5">
      {/* Summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Accounts", value: totalAccounts.toString(), icon: Users, color: "text-cyan-400" },
          { label: "Total Worth", value: `$${totalWorth.toFixed(2)}`, icon: DollarSign, color: "text-emerald-400" },
          { label: "Total Invested", value: `$${totalInvested.toFixed(2)}`, icon: TrendingUp, color: "text-amber-400" },
          { label: "Overall ROI", value: overallROI !== null ? `${overallROI >= 0 ? "+" : ""}${overallROI.toFixed(1)}%` : "—", icon: BarChart2, color: overallROI !== null && overallROI >= 0 ? "text-emerald-400" : "text-red-400" },
        ].map(s => (
          <div key={s.label} className="bg-card border border-card-border rounded-xl p-3.5 flex items-start gap-3">
            <div className={cn("w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0", s.color.replace("text-", "bg-").replace("400", "400/10"))}>
              <s.icon className={cn("w-4 h-4", s.color)} />
            </div>
            <div>
              <p className={cn("text-base font-bold font-mono", s.color)}>{s.value}</p>
              <p className="text-[10px] text-muted-foreground/60 font-mono mt-0.5">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Per-category cards */}
      {cats.length === 0 && (
        <div className="text-center py-16 text-muted-foreground/50 font-mono text-xs">No local accounts yet</div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {cats.map(cat => {
          const group = accounts.filter(a => a.category === cat);
          const meta = getMeta(cat);
          const totalMetric = group.reduce((s, a) => s + (parseFloat(a.followers ?? "0") || 0), 0);
          const gWorth = group.reduce((s, a) => s + (a.account_worth ?? 0), 0);
          const gBuy = group.reduce((s, a) => s + (a.buy_price ?? 0), 0);
          const roi = calcROI(gWorth, gBuy);
          const Icon = meta.icon;
          return (
            <div key={cat} className={cn("bg-card border rounded-xl p-4 space-y-3", meta.border)}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center", meta.bg)}>
                    <Icon className={cn("w-3.5 h-3.5", meta.color)} />
                  </div>
                  <span className={cn("font-mono text-xs font-bold", meta.color)}>{meta.label}</span>
                </div>
                <Badge variant="outline" className="font-mono text-[10px]">{group.length} acc</Badge>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="font-mono text-sm font-bold text-foreground">{totalMetric > 0 ? totalMetric.toLocaleString() : "—"}</p>
                  <p className="font-mono text-[9px] text-muted-foreground/50 uppercase">{meta.metricName}</p>
                </div>
                <div>
                  <p className="font-mono text-sm font-bold text-emerald-400">${gWorth.toFixed(2)}</p>
                  <p className="font-mono text-[9px] text-muted-foreground/50 uppercase">Worth</p>
                </div>
                <div>
                  <p className={cn("font-mono text-sm font-bold", roi === null ? "text-muted-foreground/40" : roi >= 0 ? "text-emerald-400" : "text-red-400")}>
                    {roi !== null ? `${roi >= 0 ? "+" : ""}${roi.toFixed(0)}%` : "—"}
                  </p>
                  <p className="font-mono text-[9px] text-muted-foreground/50 uppercase">ROI</p>
                </div>
              </div>

              {/* Mini account bars */}
              <div className="space-y-1">
                {group.slice(0, 4).map(acc => {
                  const r = calcROI(acc.account_worth, acc.buy_price);
                  const pct = r !== null ? Math.max(0, Math.min(100, (r + 100) / 2)) : 50;
                  return (
                    <div key={acc.id} className="flex items-center gap-2">
                      <span className="font-mono text-[10px] text-muted-foreground/60 w-24 truncate">{acc.label ?? acc.username ?? `#${acc.id}`}</span>
                      <div className="flex-1 h-1 bg-muted/20 rounded-full overflow-hidden">
                        <div
                          className={cn("h-full rounded-full transition-all", r !== null && r >= 0 ? "bg-emerald-400" : "bg-red-400")}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-mono w-10 text-right">
                        <ROIBadge worth={acc.account_worth} buy={acc.buy_price} />
                      </span>
                    </div>
                  );
                })}
                {group.length > 4 && <p className="font-mono text-[9px] text-muted-foreground/40">+{group.length - 4} more</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CategoryTab({ accounts }: { accounts: LocalAccount[] }) {
  const cats = [...new Set(accounts.map(a => a.category))].sort();
  const [selected, setSelected] = useState(cats[0] ?? "");

  useEffect(() => {
    if (cats.length && !cats.includes(selected)) setSelected(cats[0]);
  }, [cats.join(",")]);

  const group = accounts.filter(a => a.category === selected);
  const meta = getMeta(selected);
  const Icon = meta.icon;

  if (cats.length === 0) {
    return <div className="text-center py-16 text-muted-foreground/50 font-mono text-xs">No local accounts yet</div>;
  }

  return (
    <div className="space-y-4">
      {/* Category picker */}
      <div className="flex flex-wrap gap-2">
        {cats.map(cat => {
          const m = getMeta(cat);
          const CIcon = m.icon;
          return (
            <button
              key={cat}
              onClick={() => setSelected(cat)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-mono text-xs transition-all",
                selected === cat
                  ? cn(m.bg, m.border, m.color, "font-bold")
                  : "border-border/40 text-muted-foreground/60 hover:text-foreground hover:border-border"
              )}
            >
              <CIcon className="w-3 h-3" />{cat}
            </button>
          );
        })}
      </div>

      {/* Selected category detail */}
      {selected && (
        <div className="space-y-3">
          {/* Header */}
          <div className={cn("rounded-xl border p-4 flex items-center gap-3", meta.border, meta.bg)}>
            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center bg-background/30")}>
              <Icon className={cn("w-5 h-5", meta.color)} />
            </div>
            <div>
              <p className={cn("font-mono text-sm font-bold", meta.color)}>{meta.label}</p>
              <p className="font-mono text-[10px] text-muted-foreground/60">
                {group.length} accounts · tracking <span className={meta.color}>{meta.metricName}</span>
              </p>
            </div>
            <div className="ml-auto text-right">
              <p className="font-mono text-base font-bold text-foreground">
                {group.reduce((s, a) => s + (parseFloat(a.followers ?? "0") || 0), 0).toLocaleString()}
              </p>
              <p className="font-mono text-[9px] text-muted-foreground/50">Total {meta.metricName}</p>
            </div>
          </div>

          {/* Per-account table */}
          <div className="bg-card border border-card-border rounded-xl overflow-hidden">
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 px-4 py-2 border-b border-border/30">
              <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/40">Account</span>
              <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/40">{meta.metricName}</span>
              <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/40">Worth</span>
              <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/40">ROI</span>
            </div>
            {group.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground/40 font-mono text-xs">No accounts in this category</div>
            ) : (
              group.map(acc => {
                const roi = calcROI(acc.account_worth, acc.buy_price);
                const metric = parseFloat(acc.followers ?? "0") || 0;
                const maxMetric = Math.max(...group.map(a => parseFloat(a.followers ?? "0") || 0));
                const pct = maxMetric > 0 ? (metric / maxMetric) * 100 : 0;
                return (
                  <div key={acc.id} className="grid grid-cols-[1fr_auto_auto_auto] gap-3 items-center px-4 py-3 border-b border-border/20 last:border-0 hover:bg-muted/10 transition-colors">
                    <div>
                      <p className="font-mono text-xs font-medium text-foreground">{acc.label ?? acc.username ?? `Account #${acc.id}`}</p>
                      {acc.email && <p className="font-mono text-[9px] text-muted-foreground/50">{acc.email}</p>}
                      <div className="mt-1.5 h-0.5 bg-muted/20 rounded-full w-32">
                        <div className={cn("h-full rounded-full", meta.color.replace("text-", "bg-"))} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <span className={cn("font-mono text-xs font-bold", meta.color)}>
                      {metric > 0 ? metric.toLocaleString() : "—"}
                    </span>
                    <span className="font-mono text-xs text-emerald-400">${(acc.account_worth ?? 0).toFixed(2)}</span>
                    <ROIBadge worth={acc.account_worth} buy={acc.buy_price} />
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function VaultLocalDashboard() {
  const [accounts, setAccounts] = useState<LocalAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"overview" | "category">("overview");

  const load = () => {
    setLoading(true);
    customFetch<any>("/local-accounts").then(d => {
      setAccounts(Array.isArray(d) ? d : (d?.accounts ?? []));
    }).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 bg-muted/20 rounded-lg p-1">
          {(["overview", "category"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "px-4 py-1.5 rounded-md font-mono text-xs transition-all capitalize",
                tab === t ? "bg-card text-primary shadow-sm font-bold" : "text-muted-foreground/60 hover:text-muted-foreground"
              )}
            >
              {t}
            </button>
          ))}
        </div>
        <button onClick={load} className="text-muted-foreground/40 hover:text-primary transition-colors p-1.5">
          <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-5 h-5 text-primary animate-spin" />
        </div>
      ) : tab === "overview" ? (
        <OverviewTab accounts={accounts} />
      ) : (
        <CategoryTab accounts={accounts} />
      )}
    </div>
  );
}
