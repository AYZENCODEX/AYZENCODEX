import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import {
  Zap, TrendingUp, TrendingDown, Plus, X, ArrowUpDown,
  DollarSign, ShoppingCart, Tag, AlertCircle, RefreshCw,
  Wallet, BarChart3, Clock,
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
const token = () => localStorage.getItem("ayzen_token") ?? "";
const api = (path: string, opts?: RequestInit) =>
  fetch(`${BASE}/api${path}`, { ...opts, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}`, ...(opts?.headers ?? {}) } });

const AZN_USD = 0.01; // 100 AZN = $1

function genChart() {
  const now = Date.now();
  return Array.from({ length: 30 }, (_, i) => ({
    t: new Date(now - (29 - i) * 86400000).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    price: 0.008 + Math.random() * 0.006,
    vol: Math.floor(Math.random() * 50000),
  }));
}

const CHART_DATA = genChart();

export default function MarketplaceAzn() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [listings, setListings] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [wallet, setWallet] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [buying, setBuying] = useState<number | null>(null);
  const [form, setForm] = useState({ amount: "", price_per_unit: "", currency: "USDT", min_buy: "" });
  const [buyAmt, setBuyAmt] = useState<Record<number, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [l, s, w] = await Promise.all([
        api("/marketplace/azn/listings").then(r => r.json()),
        api("/marketplace/azn/stats").then(r => r.json()),
        api("/marketplace/wallet").then(r => r.json()),
      ]);
      setListings(l.listings ?? []);
      setStats(s);
      setWallet(w?.azn ?? null);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!form.amount || !form.price_per_unit) { toast({ title: "Fill all fields" }); return; }
    setCreating(true);
    try {
      const r = await api("/marketplace/azn/listings", {
        method: "POST",
        body: JSON.stringify({ amount: Number(form.amount), price_per_unit: Number(form.price_per_unit), currency: form.currency, min_buy: Number(form.min_buy ?? 0) }),
      });
      const d = await r.json();
      if (!r.ok) { toast({ variant: "destructive", title: d.error }); }
      else { toast({ title: "Listing created!" }); setShowCreate(false); setForm({ amount: "", price_per_unit: "", currency: "USDT", min_buy: "" }); load(); }
    } catch { toast({ variant: "destructive", title: "Network error" }); }
    setCreating(false);
  };

  const handleBuy = async (listingId: number) => {
    const amt = Number(buyAmt[listingId] ?? 0);
    if (!amt) { toast({ title: "Enter amount to buy" }); return; }
    setBuying(listingId);
    try {
      const r = await api("/marketplace/azn/buy", { method: "POST", body: JSON.stringify({ listing_id: listingId, amount: amt }) });
      const d = await r.json();
      if (!r.ok) toast({ variant: "destructive", title: d.error });
      else { toast({ title: `Bought ${amt} AZN`, description: `Cost: ${d.cost?.toFixed(4)} USDT` }); load(); }
    } catch { toast({ variant: "destructive", title: "Network error" }); }
    setBuying(null);
  };

  const handleCancel = async (id: number) => {
    await api(`/marketplace/azn/listings/${id}`, { method: "DELETE" });
    toast({ title: "Listing cancelled" }); load();
  };

  const totalCost = (l: any) => (Number(buyAmt[l.id] ?? 0) * Number(l.price_per_unit)).toFixed(4);

  return (
    <div className="space-y-6 page-enter">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center">
              <Zap className="w-4 h-4 text-primary" />
            </div>
            <h1 className="text-2xl font-bold font-mono tracking-tighter uppercase text-glow">AZN Market</h1>
            <Badge variant="outline" className="font-mono text-[10px] border-emerald-400/30 text-emerald-400 bg-emerald-400/5">LIVE</Badge>
          </div>
          <p className="text-muted-foreground font-mono text-sm">Peer-to-peer AZN token exchange · Dedicated wallet</p>
        </div>
        <Button onClick={() => setShowCreate(v => !v)} className="font-mono text-xs gap-2">
          <Plus className="w-3.5 h-3.5" /> Sell AZN
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Active Listings", value: stats?.active_listings ?? "—", icon: Tag, color: "text-primary" },
          { label: "Available AZN", value: stats?.available_azn?.toLocaleString() ?? "—", icon: Zap, color: "text-amber-400" },
          { label: "24h Volume", value: `${stats?.total_volume?.toFixed(0) ?? "—"} AZN`, icon: BarChart3, color: "text-violet-400" },
          { label: "Last Price", value: `$${stats?.last_price?.toFixed(4) ?? "—"}`, icon: DollarSign, color: "text-emerald-400" },
        ].map(s => (
          <div key={s.label} className="bg-card border border-card-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/60">{s.label}</span>
              <s.icon className={cn("w-3.5 h-3.5", s.color)} />
            </div>
            <div className={cn("font-mono font-bold text-lg", s.color)}>{loading ? <Skeleton className="h-6 w-16" /> : s.value}</div>
          </div>
        ))}
      </div>

      {/* Wallet + Chart */}
      <div className="grid md:grid-cols-3 gap-4">
        {/* Wallet */}
        <div className="bg-card border border-card-border rounded-xl p-5 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Wallet className="w-4 h-4 text-primary" />
            <span className="font-mono text-xs uppercase tracking-widest text-primary font-bold">AZN Wallet</span>
          </div>
          <div>
            <div className="text-3xl font-bold font-mono text-primary">{wallet?.balance?.toLocaleString() ?? "0"} <span className="text-lg text-muted-foreground">AZN</span></div>
            <div className="text-xs font-mono text-muted-foreground mt-0.5">≈ ${((wallet?.balance ?? 0) * AZN_USD).toFixed(2)} USD</div>
          </div>
          <div className="bg-muted/20 rounded-lg p-2.5 text-[10px] font-mono space-y-1">
            <div className="flex justify-between"><span className="text-muted-foreground">Available</span><span className="text-foreground">{wallet?.available?.toFixed(2) ?? "0"} AZN</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Locked</span><span className="text-amber-400">{wallet?.locked_balance?.toFixed(2) ?? "0"} AZN</span></div>
          </div>
          <div className="flex gap-2 mt-auto">
            <Button size="sm" variant="outline" className="flex-1 font-mono text-[10px] gap-1" onClick={() => window.location.href = "/marketplace/wallet"}>
              <Wallet className="w-3 h-3" /> Wallet Hub
            </Button>
            <Button size="sm" variant="outline" className="flex-1 font-mono text-[10px] gap-1" onClick={load}>
              <RefreshCw className="w-3 h-3" /> Refresh
            </Button>
          </div>
        </div>
        {/* Chart */}
        <div className="md:col-span-2 bg-card border border-card-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">AZN/USD Price</span>
            <div className="flex items-center gap-1.5 text-emerald-400">
              <TrendingUp className="w-3.5 h-3.5" />
              <span className="font-mono text-[10px]">+2.4%</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={120}>
            <AreaChart data={CHART_DATA}>
              <defs>
                <linearGradient id="aznGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="t" tick={{ fontSize: 8, fontFamily: "monospace" }} hide />
              <YAxis tick={{ fontSize: 8, fontFamily: "monospace" }} width={45} tickFormatter={v => `$${v.toFixed(3)}`} />
              <Tooltip contentStyle={{ background: "#0a0a0a", border: "1px solid #1f2937", borderRadius: 8, fontFamily: "monospace", fontSize: 10 }} formatter={(v: any) => [`$${Number(v).toFixed(4)}`, "Price"]} />
              <Area type="monotone" dataKey="price" stroke="#22d3ee" strokeWidth={1.5} fill="url(#aznGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Create listing panel */}
      {showCreate && (
        <div className="bg-card border border-primary/30 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-mono text-xs uppercase tracking-widest text-primary font-bold flex items-center gap-2"><Tag className="w-3.5 h-3.5" />New AZN Listing</h3>
            <button onClick={() => setShowCreate(false)}><X className="w-4 h-4 text-muted-foreground" /></button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-mono text-muted-foreground/60 mb-1 uppercase tracking-wider">AZN Amount *</label>
              <Input value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} placeholder="1000" className="font-mono text-sm" />
            </div>
            <div>
              <label className="block text-[10px] font-mono text-muted-foreground/60 mb-1 uppercase tracking-wider">Price / AZN (USDT) *</label>
              <Input value={form.price_per_unit} onChange={e => setForm(p => ({ ...p, price_per_unit: e.target.value }))} placeholder="0.010" className="font-mono text-sm" />
            </div>
            <div>
              <label className="block text-[10px] font-mono text-muted-foreground/60 mb-1 uppercase tracking-wider">Min Buy (AZN)</label>
              <Input value={form.min_buy} onChange={e => setForm(p => ({ ...p, min_buy: e.target.value }))} placeholder="100" className="font-mono text-sm" />
            </div>
            <div>
              <label className="block text-[10px] font-mono text-muted-foreground/60 mb-1 uppercase tracking-wider">Currency</label>
              <select value={form.currency} onChange={e => setForm(p => ({ ...p, currency: e.target.value }))} className="w-full h-10 bg-input border border-border rounded-md font-mono text-sm px-3 text-foreground">
                {["USDT", "BDT", "AZN"].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          {form.amount && form.price_per_unit && (
            <div className="bg-muted/20 rounded-lg p-3 font-mono text-[11px] text-muted-foreground">
              Total: <span className="text-primary font-bold">{(Number(form.amount) * Number(form.price_per_unit)).toFixed(4)} {form.currency}</span>
              {" · "}Platform fee: <span className="text-amber-400">2.5%</span>
            </div>
          )}
          <Button onClick={handleCreate} disabled={creating} className="w-full font-mono text-xs">
            {creating ? "Creating..." : "Create Listing"}
          </Button>
        </div>
      )}

      {/* Listings */}
      <div>
        <h2 className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-3">Open Orders</h2>
        {loading ? (
          <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
        ) : listings.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground/40 font-mono text-sm">No active listings</div>
        ) : (
          <div className="space-y-3">
            {listings.map(l => {
              const isMine = l.seller_id === user?.id;
              const cost = totalCost(l);
              return (
                <div key={l.id} className={cn("bg-card border rounded-xl p-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between transition-all", isMine ? "border-primary/20" : "border-card-border hover:border-primary/30")}>
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                      <Zap className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <div className="font-mono font-bold text-sm flex items-center gap-2">
                        {Number(l.amount).toLocaleString()} AZN
                        {isMine && <Badge variant="outline" className="text-[8px] border-primary/30 text-primary/70">MINE</Badge>}
                      </div>
                      <div className="flex items-center gap-3 text-[10px] font-mono text-muted-foreground/70 mt-0.5">
                        <span className="text-primary font-bold">${Number(l.price_per_unit).toFixed(4)}/AZN</span>
                        <span>· Min: {l.min_buy || 0} AZN</span>
                        <span>· {l.currency}</span>
                        <span>· by {l.seller_username}</span>
                      </div>
                    </div>
                  </div>
                  {isMine ? (
                    <Button size="sm" variant="outline" onClick={() => handleCancel(l.id)} className="font-mono text-[10px] border-red-500/20 text-red-400 hover:bg-red-500/10">
                      <X className="w-3 h-3 mr-1" /> Cancel
                    </Button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div>
                        <Input
                          value={buyAmt[l.id] ?? ""}
                          onChange={e => setBuyAmt(p => ({ ...p, [l.id]: e.target.value }))}
                          placeholder={`Min ${l.min_buy || 0}`}
                          className="font-mono text-xs w-28 h-8"
                        />
                        {buyAmt[l.id] && <div className="text-[9px] font-mono text-muted-foreground text-right">{cost} {l.currency}</div>}
                      </div>
                      <Button size="sm" onClick={() => handleBuy(l.id)} disabled={buying === l.id} className="font-mono text-[10px] gap-1 h-8">
                        <ShoppingCart className="w-3 h-3" />
                        {buying === l.id ? "..." : "Buy"}
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
