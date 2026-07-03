import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Wallet, Send, ArrowUpRight, ArrowDownLeft, RefreshCw,
  Loader2, Copy, Check, Zap, DollarSign, Coins, TrendingUp,
  History, Plus, AlertCircle, User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

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

const CURRENCY_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType; desc: string }> = {
  AZN: { label: "AZN", color: "text-primary border-primary/30 bg-primary/5", icon: Coins, desc: "AYZEN Token" },
  USDT: { label: "USDT", color: "text-emerald-400 border-emerald-400/30 bg-emerald-400/5", icon: DollarSign, desc: "Tether USD" },
  XP:   { label: "XP",   color: "text-violet-400 border-violet-400/30 bg-violet-400/5", icon: Zap, desc: "Experience Points" },
  BDT:  { label: "BDT",  color: "text-amber-400 border-amber-400/30 bg-amber-400/5", icon: TrendingUp, desc: "AYZEN BDT" },
};

function BalanceCard({ currency, amount, currentUserId }: { currency: string; amount: number; currentUserId?: number }) {
  const cfg = CURRENCY_CONFIG[currency];
  if (!cfg) return null;
  const Icon = cfg.icon;
  return (
    <div className={cn("rounded-xl border p-4 space-y-2 transition-all hover:scale-[1.01]", cfg.color)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={cn("w-7 h-7 rounded-full border flex items-center justify-center", cfg.color)}>
            <Icon className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest opacity-70">{cfg.desc}</div>
          </div>
        </div>
        <Badge variant="outline" className={cn("font-mono text-[9px] uppercase", cfg.color)}>{currency}</Badge>
      </div>
      <div className="font-mono text-2xl font-bold">
        {amount.toLocaleString(undefined, { maximumFractionDigits: 4 })}
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
  const [_txLoading, _setTxLoading] = useState(false);
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
        fetch(`${BASE}/api/wallets/transfers`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${BASE}/api/wallets`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${BASE}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } }),
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
        // If already exists, reload
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
          <p className="text-muted-foreground font-mono text-sm">AYZEN built-in wallet · Transfer AZN, USDT, XP between users</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading} className="font-mono text-xs gap-2">
          <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} /> Refresh
        </Button>
      </div>

      {/* Built-in Wallet Address */}
      <div className="rounded-xl border border-card-border bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Wallet className="w-4 h-4 text-primary" />
          <span className="font-mono text-xs uppercase tracking-widest text-primary font-bold">AYZEN Wallet Address</span>
        </div>
        {walletAddress ? (
          <div className="flex items-center gap-2 bg-background/60 border border-border/60 rounded-lg px-3 py-2.5">
            <span className="font-mono text-xs text-primary/90 truncate flex-1">{walletAddress}</span>
            <button
              onClick={copyAddress}
              className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground hover:text-primary transition-colors shrink-0"
            >
              {copying ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between bg-muted/20 border border-border/40 rounded-lg px-4 py-3">
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
      </div>

      {/* Balances */}
      {loading ? (
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl border border-border/40 bg-card animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <BalanceCard currency="AZN" amount={balances.azn} />
          <BalanceCard currency="USDT" amount={balances.usdt} />
          <BalanceCard currency="XP" amount={balances.xp} />
          <BalanceCard currency="BDT" amount={balances.bdt} />
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
                      "px-3 py-1.5 rounded-full font-mono text-[10px] uppercase tracking-wider border transition-all font-bold",
                      currency === cur ? cfg.color : "border-border/40 text-muted-foreground/60 hover:border-primary/30"
                    )}
                  >
                    {cur}
                  </button>
                );
              })}
            </div>
            <p className="font-mono text-[10px] text-muted-foreground/50">
              Balance: <span className={currency === "AZN" ? "text-primary" : currency === "USDT" ? "text-emerald-400" : currency === "XP" ? "text-violet-400" : "text-amber-400"}>
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

          {_txLoading ? (
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
                      <div className={cn("font-mono text-[9px]", cfg.color)}>{tx.currency}</div>
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
