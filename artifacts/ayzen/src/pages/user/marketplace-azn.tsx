import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import {
  Zap, Plus, X, ShoppingCart, Tag, RefreshCw,
  Wallet, BarChart3, TrendingUp, TrendingDown,
  CreditCard, Banknote, Building2, Check,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
const tok = () => localStorage.getItem("ayzen_token") ?? "";
const api = (path: string, opts?: RequestInit) =>
  fetch(`${BASE}/api${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok()}`, ...(opts?.headers ?? {}) },
  });

// ── Buy Confirm Button with inline quantity selector ──────────────────────────
function BuyConfirmButton({ listing, onSuccess, toast }: { listing: any; onSuccess: () => void; toast: any }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [buying, setBuying] = useState(false);

  const handleBuy = async () => {
    if (!amount || Number(amount) <= 0) { toast({ title: "Enter amount to buy" }); return; }
    setBuying(true);
    try {
      const r = await api("/marketplace/azn/buy", {
        method: "POST",
        body: JSON.stringify({ listing_id: listing.id, amount: Number(amount) }),
      });
      const d = await r.json();
      if (!r.ok) { toast({ variant: "destructive", title: d.error }); }
      else {
        toast({ title: `Bought ${amount} AZN!`, description: `Payment via ${d.payment_method?.toUpperCase()} · ${d.payment_details ?? ""}` });
        setOpen(false);
        onSuccess();
      }
    } catch { toast({ variant: "destructive", title: "Network error" }); }
    setBuying(false);
  };

  if (!open) {
    return (
      <Button size="sm" onClick={() => { setAmount(""); setOpen(true); }} className="font-mono text-[10px] gap-1 h-8">
        <ShoppingCart className="w-3 h-3" /> Buy AZN
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <Input
        value={amount}
        onChange={e => setAmount(e.target.value)}
        placeholder="Amount"
        className="font-mono text-xs h-8 w-20"
        type="number"
        autoFocus
      />
      <Button size="sm" onClick={handleBuy} disabled={buying} className="font-mono text-[10px] h-8">
        {buying ? "..." : <Check className="w-3 h-3" />}
      </Button>
      <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

const PAYMENT_METHODS = [
  { id: "binance", label: "Binance", icon: Building2, color: "text-amber-400", border: "border-amber-400/30", bg: "bg-amber-400/10" },
  { id: "bkash", label: "bKash", icon: Banknote, color: "text-pink-400", border: "border-pink-400/30", bg: "bg-pink-400/10" },
  { id: "nagad", label: "Nagad", icon: CreditCard, color: "text-orange-400", border: "border-orange-400/30", bg: "bg-orange-400/10" },
];

function PaymentBadge({ method }: { method: string }) {
  const m = PAYMENT_METHODS.find(p => p.id === method);
  if (!m) return <Badge variant="outline" className="font-mono text-[9px]">{method}</Badge>;
  const Icon = m.icon;
  return (
    <Badge variant="outline" className={cn("font-mono text-[9px] gap-1", m.color, m.border)}>
      <Icon className="w-2.5 h-2.5" />{m.label}
    </Badge>
  );
}

type OrderTab = "buy" | "sell";

interface CreateForm {
  amount: string;
  price_per_unit: string;
  payment_method: string;
  payment_details: string;
}

const defaultForm: CreateForm = { amount: "", price_per_unit: "", payment_method: "binance", payment_details: "" };

export default function MarketplaceAzn() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [tab, setTab] = useState<OrderTab>("buy");
  const [sellListings, setSellListings] = useState<any[]>([]);
  const [buyListings, setBuyListings] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [wallet, setWallet] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [cancelling, setCancelling] = useState<number | null>(null);
  const [form, setForm] = useState<CreateForm>(defaultForm);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sell, buy, s, w] = await Promise.all([
        api("/marketplace/azn/listings?order_type=sell").then(r => r.json()),
        api("/marketplace/azn/listings?order_type=buy").then(r => r.json()),
        api("/marketplace/azn/stats").then(r => r.json()),
        api("/marketplace/wallet").then(r => r.json()),
      ]);
      setSellListings(sell.listings ?? []);
      setBuyListings(buy.listings ?? []);
      setStats(s);
      setWallet(w?.azn ?? null);
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!form.amount || !form.price_per_unit) { toast({ title: "Amount and price required" }); return; }
    if (!form.payment_details.trim()) { toast({ title: "Payment details required (account number/ID)" }); return; }
    setCreating(true);
    try {
      const r = await api("/marketplace/azn/listings", {
        method: "POST",
        body: JSON.stringify({
          amount: Number(form.amount),
          price_per_unit: Number(form.price_per_unit),
          order_type: tab,
          payment_method: form.payment_method,
          payment_details: form.payment_details.trim(),
        }),
      });
      const d = await r.json();
      if (!r.ok) { toast({ variant: "destructive", title: d.error }); }
      else {
        toast({ title: `${tab === "sell" ? "Sell" : "Buy"} order created!` });
        setShowCreate(false);
        setForm(defaultForm);
        load();
      }
    } catch { toast({ variant: "destructive", title: "Network error" }); }
    setCreating(false);
  };

  const handleCancel = async (id: number) => {
    setCancelling(id);
    try {
      await api(`/marketplace/azn/listings/${id}`, { method: "DELETE" });
      toast({ title: "Order cancelled" });
      load();
    } catch { toast({ variant: "destructive", title: "Failed to cancel" }); }
    setCancelling(null);
  };

  const listings = tab === "buy" ? sellListings : buyListings;
  const myId = user?.id;

  return (
    <div className="space-y-5 page-enter">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center">
              <Zap className="w-4 h-4 text-primary" />
            </div>
            <h1 className="text-2xl font-bold font-mono tracking-tighter uppercase text-glow">AZN Market</h1>
            <Badge variant="outline" className="font-mono text-[10px] border-emerald-400/30 text-emerald-400 bg-emerald-400/5">P2P</Badge>
          </div>
          <p className="text-muted-foreground font-mono text-sm">Peer-to-peer AZN exchange · Binance · bKash · Nagad</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading} className="font-mono text-xs h-8 gap-1">
            <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
          </Button>
          <Button onClick={() => { setShowCreate(v => !v); }} size="sm" className="font-mono text-xs gap-1.5 h-8">
            <Plus className="w-3.5 h-3.5" /> Create Order
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Sell Orders", value: stats?.active_sell_listings ?? "—", icon: TrendingDown, color: "text-primary" },
          { label: "Buy Orders", value: stats?.active_buy_listings ?? "—", icon: TrendingUp, color: "text-emerald-400" },
          { label: "AZN Available", value: stats?.available_azn?.toLocaleString() ?? "—", icon: Zap, color: "text-amber-400" },
          { label: "My Balance", value: `${wallet?.balance?.toFixed(0) ?? "0"} AZN`, icon: Wallet, color: "text-violet-400" },
        ].map(s => (
          <div key={s.label} className="bg-card border border-card-border rounded-xl p-3 flex items-center gap-3">
            <div className={cn("w-8 h-8 rounded-lg bg-muted/20 flex items-center justify-center flex-shrink-0", s.color)}>
              <s.icon className="w-4 h-4" />
            </div>
            <div>
              <div className={cn("font-mono text-base font-bold", s.color)}>
                {loading ? <Skeleton className="h-5 w-14" /> : s.value}
              </div>
              <div className="font-mono text-[9px] text-muted-foreground">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 bg-muted/20 rounded-lg p-1 w-fit">
        {([
          { id: "buy" as OrderTab, label: "Buy AZN", sublabel: "Browse sell orders", icon: ShoppingCart },
          { id: "sell" as OrderTab, label: "Sell AZN", sublabel: "Browse buy requests", icon: Tag },
        ] as const).map(t => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={cn("flex items-center gap-2 px-4 py-2 text-xs font-mono rounded transition-all",
                tab === t.id ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground")}>
              <Icon className="w-3.5 h-3.5" />
              <div className="text-left">
                <div className="font-bold">{t.label}</div>
                <div className="text-[9px] opacity-60">{t.sublabel}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Create Order Panel */}
      {showCreate && (
        <div className="bg-card border border-primary/30 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-mono text-xs uppercase tracking-widest text-primary font-bold flex items-center gap-2">
              <Tag className="w-3.5 h-3.5" />
              Create {tab === "sell" ? "Sell" : "Buy"} Order
            </h3>
            <button onClick={() => setShowCreate(false)}><X className="w-4 h-4 text-muted-foreground" /></button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-mono text-muted-foreground/60 mb-1 uppercase tracking-wider">
                AZN Amount *
              </label>
              <Input
                value={form.amount}
                onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
                placeholder="e.g. 500"
                className="font-mono text-sm"
                type="number"
              />
            </div>
            <div>
              <label className="block text-[10px] font-mono text-muted-foreground/60 mb-1 uppercase tracking-wider">
                Price / AZN (AZN) *
              </label>
              <Input
                value={form.price_per_unit}
                onChange={e => setForm(p => ({ ...p, price_per_unit: e.target.value }))}
                placeholder="e.g. 0.01"
                className="font-mono text-sm"
                type="number"
              />
            </div>
          </div>

          {/* Payment Method Pills */}
          <div>
            <label className="block text-[10px] font-mono text-muted-foreground/60 mb-2 uppercase tracking-wider">
              Payment Method *
            </label>
            <div className="flex gap-2 flex-wrap">
              {PAYMENT_METHODS.map(m => {
                const Icon = m.icon;
                const selected = form.payment_method === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => setForm(p => ({ ...p, payment_method: m.id }))}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-2 rounded-lg border font-mono text-xs transition-all",
                      selected ? `${m.bg} ${m.border} ${m.color}` : "border-border/40 text-muted-foreground hover:border-border"
                    )}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {m.label}
                    {selected && <Check className="w-3 h-3 ml-0.5" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Payment Details */}
          <div>
            <label className="block text-[10px] font-mono text-muted-foreground/60 mb-1 uppercase tracking-wider">
              {form.payment_method === "binance" ? "Binance UID / Pay ID" :
               form.payment_method === "bkash" ? "bKash Account Number" :
               "Nagad Account Number"} *
            </label>
            <Input
              value={form.payment_details}
              onChange={e => setForm(p => ({ ...p, payment_details: e.target.value }))}
              placeholder={
                form.payment_method === "binance" ? "e.g. 123456789" :
                form.payment_method === "bkash" ? "e.g. 01XXXXXXXXX" :
                "e.g. 01XXXXXXXXX"
              }
              className="font-mono text-sm"
            />
          </div>

          {form.amount && form.price_per_unit && (
            <div className="bg-muted/20 rounded-lg p-3 font-mono text-[11px] text-muted-foreground flex items-center gap-4">
              <span>Total: <span className="text-primary font-bold">{(Number(form.amount) * Number(form.price_per_unit)).toFixed(4)} AZN</span></span>
              <span>·</span>
              <span>{tab === "sell" ? "AZN will be locked until sold" : "Buy request will be visible to sellers"}</span>
            </div>
          )}

          <Button onClick={handleCreate} disabled={creating} className="w-full font-mono text-xs">
            {creating ? "Creating..." : `Create ${tab === "sell" ? "Sell" : "Buy"} Order`}
          </Button>
        </div>
      )}

      {/* Listings */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            {tab === "buy" ? "Available Sell Orders" : "Active Buy Requests"}
          </h2>
          <span className="font-mono text-[10px] text-muted-foreground/50">{listings.length} orders</span>
        </div>

        {loading ? (
          <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
        ) : listings.length === 0 ? (
          <div className="text-center py-16 bg-card border border-border/30 rounded-xl">
            <Zap className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
            <p className="font-mono text-sm text-muted-foreground">No orders available</p>
            <p className="font-mono text-[11px] text-muted-foreground/50 mt-1">
              {tab === "buy" ? "No one is selling AZN right now" : "No buy requests posted yet"}
            </p>
            <Button size="sm" className="mt-4 font-mono text-xs gap-1.5" onClick={() => setShowCreate(true)}>
              <Plus className="w-3.5 h-3.5" /> Create {tab === "sell" ? "Sell" : "Buy"} Order
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {listings.map(l => {
              const isMine = l.seller_id === myId;
              return (
                <div
                  key={l.id}
                  className={cn(
                    "bg-card border rounded-xl p-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between transition-all",
                    isMine ? "border-primary/20" : "border-card-border hover:border-primary/30"
                  )}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                      <Zap className="w-4 h-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-mono font-bold text-sm flex items-center gap-2 flex-wrap">
                        {Number(l.amount).toLocaleString()} AZN
                        {isMine && <Badge variant="outline" className="text-[8px] border-primary/30 text-primary/70">MINE</Badge>}
                        <PaymentBadge method={l.payment_method ?? "binance"} />
                      </div>
                      <div className="font-mono text-[10px] text-muted-foreground/70 mt-0.5 flex items-center gap-3 flex-wrap">
                        <span className="text-primary font-bold">{Number(l.price_per_unit).toFixed(4)} AZN/unit</span>
                        <span>· by {l.seller_username}</span>
                        <span>· {new Date(l.created_at).toLocaleDateString()}</span>
                      </div>
                      {isMine && l.payment_details && (
                        <div className="mt-1 font-mono text-[9px] bg-muted/30 rounded px-2 py-0.5 inline-flex items-center gap-1 text-muted-foreground">
                          <BarChart3 className="w-2.5 h-2.5" /> {l.payment_details}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {isMine ? (
                      <Button
                        size="sm" variant="outline"
                        onClick={() => handleCancel(l.id)}
                        disabled={cancelling === l.id}
                        className="font-mono text-[10px] border-red-500/20 text-red-400 hover:bg-red-500/10 h-8"
                      >
                        <X className="w-3 h-3 mr-1" />
                        {cancelling === l.id ? "..." : "Cancel"}
                      </Button>
                    ) : (
                      <div className="text-right">
                        <div className="font-mono text-[10px] text-muted-foreground mb-1">
                          Payment: <span className="text-foreground">{l.payment_details || "Contact seller"}</span>
                        </div>
                        {tab === "buy" ? (
                          <BuyConfirmButton listing={l} onSuccess={load} toast={toast} />
                        ) : (
                          <Button size="sm" className="font-mono text-[10px] gap-1 h-8">
                            <ShoppingCart className="w-3 h-3" /> Fulfill Order
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
