import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Wallet, Send, ArrowUpRight, ArrowDownLeft, RefreshCw,
  Loader2, Copy, Check, Zap, DollarSign, Coins, TrendingUp,
  History, Plus, AlertCircle, User, BarChart2, Gem,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { Link } from "wouter";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

interface Balances {
  azn: number;
  usdt: number;
  xp: number;
  bdt: number;
  credits: number;
}

interface Transfer {
  id: number;
  from_user_id: number;
  to_user_id: number;
  currency: string;
  amount: number;
  note: string | null;
  created_at: string;
  from_username: string | null;
  to_username: string | null;
}

const CURRENCY_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; hex: string; icon: React.ElementType; desc: string; emoji: string }> = {
  AZN:  { label: "AZN",  color: "text-cyan-400",    bg: "bg-cyan-500/5",    border: "border-cyan-500/20",    hex: "#22d3ee", icon: Coins,      desc: "AYZEN Token",       emoji: "⚡" },
  USDT: { label: "USDT", color: "text-emerald-400", bg: "bg-emerald-500/5", border: "border-emerald-500/20", hex: "#34d399", icon: DollarSign, desc: "Tether USD",        emoji: "💵" },
  XP:   { label: "XP",   color: "text-violet-400",  bg: "bg-violet-500/5",  border: "border-violet-500/20",  hex: "#a78bfa", icon: Zap,         desc: "Experience Points", emoji: "✨" },
  BDT:  { label: "BDT",  color: "text-amber-400",   bg: "bg-amber-500/5",   border: "border-amber-500/20",   hex: "#fbbf24", icon: TrendingUp,  desc: "AYZEN BDT",         emoji: "💰" },
};

function BalanceCard({ currency, amount, onClick, selected }: { currency: string; amount: number; onClick?: () => void; selected?: boolean }) {
  const cfg = CURRENCY_CONFIG[currency];
  if (!cfg) return null;
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-xl border p-4 flex flex-col gap-1 text-left w-full transition-all",
        cfg.bg,
        selected ? cfg.border.replace("/20", "/50") : cfg.border,
        selected && "ring-1 ring-offset-1 ring-offset-background",
        !selected && "hover:border-opacity-60"
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-sm">{cfg.emoji}</span>
          <span className="font-mono text-[10px] text-muted-foreground">{cfg.desc}</span>
        </div>
        <Badge variant="outline" className={cn("font-mono text-[9px] uppercase px-1.5 py-0", cfg.color, cfg.border)}>{currency}</Badge>
      </div>
      <div className={cn("font-mono text-xl font-bold", cfg.color)}>
        {amount.toLocaleString(undefined, { maximumFractionDigits: 4 })}
      </div>
      <div className="font-mono text-[10px] text-muted-foreground/50">{cfg.label}</div>
    </button>
  );
}

function AssetPieChart({ balances }: { balances: Balances }) {
  const total = balances.azn + balances.usdt + balances.xp + balances.bdt;
  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-32 text-center">
        <BarChart2 className="w-8 h-8 text-muted-foreground/20 mb-2" />
        <p className="font-mono text-xs text-muted-foreground/50">No assets yet</p>
      </div>
    );
  }

  const data = [
    { name: "AZN",  value: balances.azn,  color: "#22d3ee" },
    { name: "USDT", value: balances.usdt, color: "#34d399" },
    { name: "XP",   value: balances.xp,   color: "#a78bfa" },
    { name: "BDT",  value: balances.bdt,  color: "#fbbf24" },
  ].filter(d => d.value > 0);

  const pct = (v: number) => total > 0 ? ((v / total) * 100).toFixed(1) : "0.0";

  return (
    <div className="flex flex-col gap-3">
      <div className="h-36">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={40}
              outerRadius={65}
              dataKey="value"
              strokeWidth={0}
            >
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number, name: string) => [
                `${value.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${name}`,
                `${pct(value)}%`,
              ]}
              contentStyle={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                fontFamily: "monospace",
                fontSize: "11px",
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="grid grid-cols-2 gap-1.5">
        {data.map(d => (
          <div key={d.name} className="flex items-center gap-2 px-2 py-1.5 rounded bg-muted/20">
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: d.color }} />
            <span className="font-mono text-[10px] text-muted-foreground flex-1">{d.name}</span>
            <span className="font-mono text-[10px] font-bold" style={{ color: d.color }}>{pct(d.value)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function WalletHub() {
  const { toast } = useToast();
  const token = localStorage.getItem("ayzen_token") ?? "";

  const [balances, setBalances] = useState<Balances>({ azn: 0, usdt: 0, xp: 0, bdt: 0, credits: 0 });
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [copying, setCopying] = useState(false);

  // Built-in wallet address
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [creatingWallet, setCreatingWallet] = useState(false);

  // Transfer form
  const [currency, setCurrency] = useState("AZN");
  const [toUser, setToUser] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);

  // Current user id from token
  const [myUserId, setMyUserId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [balRes, txRes, walRes, meRes] = await Promise.all([
        fetch(`${BASE}/api/wallets/ayzen-balance`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${BASE}/api/wallets/transfers`,     { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${BASE}/api/wallets`,               { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${BASE}/api/auth/me`,               { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (balRes.ok) setBalances(await balRes.json());
      if (txRes.ok) setTransfers(await txRes.json());
      if (walRes.ok) {
        const wallets = await walRes.json();
        const builtin = wallets.find((w: any) => w.label?.includes("Built-in") || w.label?.includes("AYZEN Built-in"));
        setWalletAddress(builtin?.address ?? null);
      }
      if (meRes.ok) {
        const me = await meRes.json();
        setMyUserId(me?.id ?? null);
      }
    } catch {
      toast({ variant: "destructive", title: "Failed to load wallet data" });
    }
    setLoading(false);
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const createBuiltinWallet = async () => {
    setCreatingWallet(true);
    try {
      const res = await fetch(`${BASE}/api/wallets/builtin/create`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await res.json();
      if (res.ok) {
        setWalletAddress(d.address);
        toast({ title: "Built-in wallet created ✓", description: "Your AYZEN wallet address is ready." });
      } else {
        toast({ variant: "destructive", title: d.error ?? "Failed to create wallet" });
        await load();
      }
    } catch {
      toast({ variant: "destructive", title: "Connection error" });
    }
    setCreatingWallet(false);
  };

  const copyAddress = async () => {
    if (!walletAddress) return;
    await navigator.clipboard.writeText(walletAddress);
    setCopying(true);
    setTimeout(() => setCopying(false), 1500);
    toast({ title: "Copied!", description: "Wallet address copied to clipboard." });
  };

  const handleSend = async () => {
    if (!toUser.trim()) { toast({ variant: "destructive", title: "Enter recipient username or email" }); return; }
    if (!amount || parseFloat(amount) <= 0) { toast({ variant: "destructive", title: "Enter a valid amount" }); return; }
    setSending(true);
    try {
      const res = await fetch(`${BASE}/api/wallets/transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ toUsername: toUser.trim(), currency, amount: parseFloat(amount), note: note.trim() || undefined }),
      });
      const d = await res.json();
      if (res.ok) {
        toast({ title: `${currency} Sent ✓`, description: `${amount} ${currency} → ${d.to}` });
        setToUser(""); setAmount(""); setNote("");
        await load();
      } else {
        toast({ variant: "destructive", title: d.error ?? "Transfer failed" });
      }
    } catch {
      toast({ variant: "destructive", title: "Connection error" });
    }
    setSending(false);
  };

  const selectedBalance = {
    AZN: balances.azn, USDT: balances.usdt, XP: balances.xp, BDT: balances.bdt,
  }[currency] ?? 0;

  const isInsufficient = amount && parseFloat(amount) > selectedBalance;

  return (
    <div className="space-y-6 page-enter">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-mono tracking-tighter uppercase flex items-center gap-2">
            <Wallet className="w-6 h-6 text-primary" /> My Wallet
          </h1>
          <p className="text-muted-foreground font-mono text-xs mt-1">AYZEN built-in wallet · Transfer AZN, USDT, XP between users</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/nft-marketplace">
            <Button variant="outline" className="font-mono text-xs gap-2 border-primary/30 text-primary hover:bg-primary/10">
              <Gem className="w-3.5 h-3.5" /> NFT Market
            </Button>
          </Link>
          <Button onClick={load} disabled={loading} className="font-mono text-xs gap-2">
            <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} /> Refresh
          </Button>
        </div>
      </div>

      {/* Built-in Wallet Address */}
      {walletAddress ? (
        <div className="bg-card border border-primary/30 rounded-lg overflow-hidden">
          <div className="px-4 py-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg border flex items-center justify-center flex-shrink-0"
              style={{ borderColor: "#22d3ee40", background: "#22d3ee15" }}>
              <div className="w-3 h-3 rounded-full" style={{ background: "#22d3ee" }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono font-bold text-sm text-foreground">AYZEN Built-in Wallet</span>
                <Badge className="font-mono text-[9px] uppercase px-1.5 py-0 bg-primary/10 text-primary border-primary/20">
                  ★ Watch-only
                </Badge>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="font-mono text-xs text-muted-foreground truncate">{walletAddress}</span>
                <button onClick={copyAddress} className="text-muted-foreground hover:text-primary transition-colors shrink-0">
                  {copying ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-card border border-card-border rounded-lg px-4 py-3 flex items-center justify-between">
          <div>
            <p className="font-mono text-xs text-muted-foreground/70">No wallet address yet</p>
            <p className="font-mono text-[10px] text-muted-foreground/40 mt-0.5">Create your watch-only AYZEN wallet</p>
          </div>
          <Button size="sm" onClick={createBuiltinWallet} disabled={creatingWallet} className="font-mono text-xs gap-2">
            {creatingWallet ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            {creatingWallet ? "Creating..." : "Create"}
          </Button>
        </div>
      )}

      {/* Balances + Asset Chart */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl border border-border/40 bg-card animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Balance Cards — 2 col */}
          <div className="lg:col-span-2 grid grid-cols-2 gap-3">
            <BalanceCard currency="AZN"  amount={balances.azn}  onClick={() => setCurrency("AZN")}  selected={currency === "AZN"} />
            <BalanceCard currency="USDT" amount={balances.usdt} onClick={() => setCurrency("USDT")} selected={currency === "USDT"} />
            <BalanceCard currency="XP"   amount={balances.xp}   onClick={() => setCurrency("XP")}   selected={currency === "XP"} />
            <BalanceCard currency="BDT"  amount={balances.bdt}  onClick={() => setCurrency("BDT")}  selected={currency === "BDT"} />
          </div>

          {/* Asset Allocation Pie Chart */}
          <div className="rounded-xl border border-card-border bg-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <BarChart2 className="w-4 h-4 text-primary" />
              <span className="font-mono text-xs uppercase tracking-widest text-primary font-bold">Asset Allocation</span>
            </div>
            <AssetPieChart balances={balances} />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Transfer Form */}
        <div className="rounded-xl border border-card-border bg-card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Send className="w-4 h-4 text-primary" />
            <span className="font-mono text-xs uppercase tracking-widest text-primary font-bold">Send Tokens</span>
          </div>

          {/* Currency selector */}
          <div className="space-y-1.5">
            <Label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Currency</Label>
            <div className="flex gap-2 flex-wrap">
              {["AZN", "USDT", "XP", "BDT"].map(cur => {
                const cfg = CURRENCY_CONFIG[cur];
                return (
                  <button
                    key={cur}
                    type="button"
                    onClick={() => setCurrency(cur)}
                    className={cn(
                      "flex items-center gap-1 px-3 py-1.5 rounded-full font-mono text-[10px] uppercase tracking-wider border transition-all font-bold",
                      currency === cur ? cn(cfg.bg, cfg.color, cfg.border.replace("/20", "/50")) : "border-border/40 text-muted-foreground/60 hover:border-primary/30"
                    )}
                  >
                    <span>{cfg.emoji}</span> {cur}
                  </button>
                );
              })}
            </div>
            <p className="font-mono text-[10px] text-muted-foreground/50">
              Balance:{" "}
              <span className={CURRENCY_CONFIG[currency]?.color}>
                {selectedBalance.toLocaleString(undefined, { maximumFractionDigits: 4 })} {currency}
              </span>
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1">
              <User className="w-3 h-3" /> Recipient (username or email)
            </Label>
            <Input
              value={toUser}
              onChange={e => setToUser(e.target.value)}
              className="font-mono text-xs h-9 bg-input"
              placeholder="e.g. alice or alice@example.com"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Amount</Label>
            <div className="relative">
              <Input
                value={amount}
                onChange={e => setAmount(e.target.value)}
                type="number"
                step="0.0001"
                min="0"
                className={cn("font-mono text-xs h-9 bg-input pr-16", isInsufficient && "border-red-500/50 focus-visible:ring-red-500/30")}
                placeholder="0.00"
              />
              <button
                type="button"
                onClick={() => setAmount(String(selectedBalance))}
                className="absolute right-2 top-1/2 -translate-y-1/2 font-mono text-[9px] uppercase text-primary hover:text-primary/80 border border-primary/30 hover:border-primary/50 rounded px-1.5 py-0.5 transition-all"
              >
                Max
              </button>
            </div>
            {isInsufficient && (
              <p className="font-mono text-[10px] text-red-400 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> Insufficient balance
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Note (optional)</Label>
            <Input
              value={note}
              onChange={e => setNote(e.target.value)}
              className="font-mono text-xs h-9 bg-input"
              placeholder="e.g. Task reward payment"
            />
          </div>

          {/* Preview */}
          {toUser && amount && parseFloat(amount) > 0 && !isInsufficient && (
            <div className="rounded-lg bg-primary/5 border border-primary/20 px-4 py-3 space-y-1">
              <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Transfer Preview</div>
              <div className="flex items-center justify-between font-mono text-xs">
                <span className="text-muted-foreground">To</span>
                <span className="font-bold text-foreground">{toUser}</span>
              </div>
              <div className="flex items-center justify-between font-mono text-xs">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-bold text-primary">{parseFloat(amount).toLocaleString()} {currency}</span>
              </div>
              <div className="flex items-center justify-between font-mono text-xs">
                <span className="text-muted-foreground">Remaining</span>
                <span className="text-muted-foreground">{(selectedBalance - parseFloat(amount)).toLocaleString(undefined, { maximumFractionDigits: 4 })} {currency}</span>
              </div>
            </div>
          )}

          <Button
            onClick={handleSend}
            disabled={sending || !toUser || !amount || parseFloat(amount) <= 0 || !!isInsufficient}
            className="w-full font-mono text-xs gap-2 h-10"
          >
            {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            {sending ? "Sending..." : `Send ${currency}`}
          </Button>
        </div>

        {/* Transfer History */}
        <div className="rounded-xl border border-card-border bg-card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-primary" />
            <span className="font-mono text-xs uppercase tracking-widest text-primary font-bold">Transfer History</span>
          </div>

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-14 rounded-lg bg-muted/30 animate-pulse" />
              ))}
            </div>
          ) : transfers.length === 0 ? (
            <div className="py-12 text-center">
              <History className="w-8 h-8 mx-auto mb-3 text-muted-foreground/20" />
              <p className="font-mono text-sm text-muted-foreground/50">No transfers yet</p>
              <p className="font-mono text-[10px] text-muted-foreground/30 mt-1">Send tokens to see history here</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {transfers.map(tx => {
                const isOut = tx.from_user_id === myUserId;
                const other = isOut ? (tx.to_username ?? `User #${tx.to_user_id}`) : (tx.from_username ?? `User #${tx.from_user_id}`);
                const cfg = CURRENCY_CONFIG[tx.currency] ?? { color: "text-muted-foreground", label: tx.currency };
                return (
                  <div key={tx.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/20 border border-border/30 hover:border-border/60 transition-colors">
                    <div className={cn(
                      "w-8 h-8 rounded-full border flex items-center justify-center flex-shrink-0",
                      isOut ? "border-red-500/30 bg-red-500/10" : "border-emerald-500/30 bg-emerald-500/10"
                    )}>
                      {isOut
                        ? <ArrowUpRight className="w-3.5 h-3.5 text-red-400" />
                        : <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-400" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60">{isOut ? "TO" : "FROM"}</span>
                        <span className="font-mono text-xs font-medium truncate">{other}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {tx.note && <span className="font-mono text-[9px] text-muted-foreground/50 truncate">{tx.note}</span>}
                        <span className="font-mono text-[9px] text-muted-foreground/30">
                          {new Date(tx.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className={cn("font-mono text-sm font-bold", isOut ? "text-red-400" : "text-emerald-400")}>
                        {isOut ? "-" : "+"}{tx.amount.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                      </div>
                      <div className={cn("font-mono text-[9px]", (cfg as any).color)}>{tx.currency}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
