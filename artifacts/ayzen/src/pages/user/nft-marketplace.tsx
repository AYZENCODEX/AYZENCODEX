import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Gem, ShoppingCart, Tag, RefreshCw, Loader2, Coins, Crown,
  Zap, Shield, Star, ArrowUpRight, TrendingUp, ExternalLink, X,
  CheckCircle2, Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

interface NftSubscription {
  id: number;
  token_id: string;
  owner_id: number;
  original_owner_id: number;
  plan: string;
  metadata: any;
  expires_at: string;
  is_listed: boolean;
  list_price: number | null;
  transfer_count: number;
  minted_at: string;
  seller_username?: string;
  original_owner_username?: string;
}

interface Stats {
  totalMinted: number;
  listed: number;
  tradingVolume: number;
}

const PLAN_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string; bg: string; aznCost: number; isLifetime?: boolean; durationLabel: string }> = {
  pro: {
    label: "Pro",
    icon: Zap,
    color: "text-primary border-primary/40",
    bg: "bg-primary/5",
    aznCost: 30,
    durationLabel: "30-day pass",
  },
  enterprise: {
    label: "Enterprise",
    icon: Crown,
    color: "text-amber-400 border-amber-400/40",
    bg: "bg-amber-400/5",
    aznCost: 60,
    durationLabel: "30-day pass",
  },
  lifetime_pro: {
    label: "Lifetime Pro",
    icon: Star,
    color: "text-violet-400 border-violet-400/40",
    bg: "bg-violet-400/5",
    aznCost: 500,
    isLifetime: true,
    durationLabel: "Lifetime pass",
  },
  lifetime_enterprise: {
    label: "Lifetime Enterprise",
    icon: Shield,
    color: "text-rose-400 border-rose-400/40",
    bg: "bg-rose-400/5",
    aznCost: 1000,
    isLifetime: true,
    durationLabel: "Lifetime pass",
  },
};

function PlanBadge({ plan }: { plan: string }) {
  const cfg = PLAN_CONFIG[plan] ?? { label: plan, icon: Shield, color: "text-muted-foreground border-border", bg: "" };
  const Icon = cfg.icon;
  return (
    <Badge variant="outline" className={cn("font-mono text-[10px] gap-1", cfg.color)}>
      <Icon className="w-3 h-3" />
      {cfg.label.toUpperCase()}
    </Badge>
  );
}

function MintModal({ onClose, onSuccess, token }: { onClose: () => void; onSuccess: () => void; token: string }) {
  const { toast } = useToast();
  const [plan, setPlan] = useState("pro");
  const [minting, setMinting] = useState(false);

  const handleMint = async () => {
    setMinting(true);
    try {
      const r = await fetch(`${BASE}/api/nft-subscriptions/mint`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ plan }),
      });
      const d = await r.json();
      if (r.ok) {
        toast({
          title: `🎉 NFT Minted! Token: ${d.nft?.token_id}`,
          description: `${PLAN_CONFIG[plan]?.aznCost} AZN spent. Expires ${new Date(d.expiresAt).toLocaleDateString()}.`,
        });
        onSuccess();
        onClose();
      } else {
        toast({ variant: "destructive", title: d.error ?? "Minting failed" });
      }
    } catch {
      toast({ variant: "destructive", title: "Connection error" });
    }
    setMinting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card border border-primary/20 rounded-xl w-full max-w-md mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-card-border">
          <div className="flex items-center gap-2">
            <Gem className="w-4 h-4 text-primary" />
            <span className="font-mono font-bold text-sm">Mint Subscription NFT</span>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-5 py-5 space-y-4">
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 font-mono text-[11px] text-muted-foreground leading-relaxed">
            Mint a tradeable subscription NFT. Your plan activates immediately. You can sell it on the marketplace — the buyer gets the subscription, you get AZN.
          </div>
          <div className="space-y-2">
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Select Plan</div>
            {Object.entries(PLAN_CONFIG).map(([key, cfg]) => {
              const Icon = cfg.icon;
              return (
                <button
                  key={key}
                  onClick={() => setPlan(key)}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left",
                    plan === key ? `${cfg.color} ${cfg.bg}` : "border-border hover:border-primary/20"
                  )}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="font-mono font-bold text-sm">{cfg.label} Plan</div>
                    <div className="font-mono text-[10px] text-muted-foreground">{cfg.durationLabel} {cfg.isLifetime ? "· Never expires" : "· 30-day access"}</div>
                  </div>
                  <div className="font-mono text-sm font-bold text-primary">{cfg.aznCost} AZN</div>
                </button>
              );
            })}
          </div>
          <Button
            onClick={handleMint}
            disabled={minting}
            className="w-full font-mono text-xs gap-2"
          >
            {minting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Gem className="w-3.5 h-3.5" />}
            {minting ? "Minting..." : `Mint NFT — ${PLAN_CONFIG[plan]?.aznCost} AZN`}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ListModal({ nft, onClose, onSuccess, token }: {
  nft: NftSubscription; onClose: () => void; onSuccess: () => void; token: string;
}) {
  const { toast } = useToast();
  const [price, setPrice] = useState("");
  const [listing, setListing] = useState(false);

  const handleList = async () => {
    const p = parseFloat(price);
    if (!p || p <= 0) { toast({ variant: "destructive", title: "Enter a valid price" }); return; }
    setListing(true);
    try {
      const r = await fetch(`${BASE}/api/nft-subscriptions/${nft.id}/list`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ price: p }),
      });
      const d = await r.json();
      if (r.ok) {
        toast({ title: `📋 Listed for ${p} AZN!` });
        onSuccess();
        onClose();
      } else {
        toast({ variant: "destructive", title: d.error ?? "Failed to list" });
      }
    } catch {
      toast({ variant: "destructive", title: "Connection error" });
    }
    setListing(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card border border-primary/20 rounded-xl w-full max-w-sm mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-card-border">
          <span className="font-mono font-bold text-sm">List on Marketplace</span>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-5 py-5 space-y-4">
          <div className="bg-background border border-border rounded-lg p-3">
            <div className="font-mono text-[10px] text-muted-foreground mb-1">NFT</div>
            <div className="font-mono text-sm font-bold">{nft.token_id}</div>
            <PlanBadge plan={nft.plan} />
          </div>
          <div className="space-y-1.5">
            <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Sale Price (AZN)</label>
            <Input
              type="number"
              value={price}
              onChange={e => setPrice(e.target.value)}
              placeholder="e.g. 25"
              className="font-mono text-xs h-10 bg-input"
            />
          </div>
          <Button onClick={handleList} disabled={listing || !price} className="w-full font-mono text-xs gap-2">
            {listing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Tag className="w-3.5 h-3.5" />}
            List for Sale
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function NftMarketplace() {
  const { token } = useAuth();
  const { toast } = useToast();

  const [listings, setListings] = useState<NftSubscription[]>([]);
  const [myNfts, setMyNfts] = useState<NftSubscription[]>([]);
  const [stats, setStats] = useState<Stats>({ totalMinted: 0, listed: 0, tradingVolume: 0 });
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState<number | null>(null);
  const [tab, setTab] = useState<"marketplace" | "my-nfts">("marketplace");
  const [showMint, setShowMint] = useState(false);
  const [listNft, setListNft] = useState<NftSubscription | null>(null);
  const [planFilter, setPlanFilter] = useState("all");

  const headers = { Authorization: `Bearer ${token}` };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const planQ = planFilter !== "all" ? `?plan=${planFilter}` : "";
      const [marketRes, myRes, statsRes] = await Promise.all([
        fetch(`${BASE}/api/nft-subscriptions/marketplace${planQ}`, { headers }),
        fetch(`${BASE}/api/nft-subscriptions/my-nfts`, { headers }),
        fetch(`${BASE}/api/nft-subscriptions/stats`),
      ]);
      if (marketRes.ok) setListings(await marketRes.json());
      if (myRes.ok) setMyNfts(await myRes.json());
      if (statsRes.ok) setStats(await statsRes.json());
    } catch {
      toast({ variant: "destructive", title: "Failed to load NFT data" });
    }
    setLoading(false);
  }, [token, planFilter]);

  useEffect(() => { load(); }, [load]);

  const handleBuy = async (nft: NftSubscription) => {
    setBuying(nft.id);
    try {
      const r = await fetch(`${BASE}/api/nft-subscriptions/${nft.id}/buy`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      const d = await r.json();
      if (r.ok) {
        toast({
          title: `✅ NFT Purchased! ${d.plan} plan activated.`,
          description: `Spent ${d.aznSpent} AZN. Token: ${d.tokenId}`,
        });
        await load();
      } else {
        toast({ variant: "destructive", title: d.error ?? "Purchase failed" });
      }
    } catch {
      toast({ variant: "destructive", title: "Connection error" });
    }
    setBuying(null);
  };

  const handleDelist = async (nft: NftSubscription) => {
    try {
      const r = await fetch(`${BASE}/api/nft-subscriptions/${nft.id}/delist`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      if (r.ok) {
        toast({ title: "Delisted from marketplace" });
        await load();
      }
    } catch {
      toast({ variant: "destructive", title: "Connection error" });
    }
  };

  const { user } = useAuth();
  const currentUserId = user?.id ?? null;

  return (
    <div className="space-y-6 page-enter">
      {showMint && <MintModal onClose={() => setShowMint(false)} onSuccess={load} token={token ?? ""} />}
      {listNft && <ListModal nft={listNft} onClose={() => setListNft(null)} onSuccess={load} token={token ?? ""} />}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold font-mono tracking-tighter uppercase flex items-center gap-2">
            <Gem className="w-6 h-6 text-primary" /> NFT Subscription Market
          </h1>
          <p className="text-muted-foreground font-mono text-xs mt-1">
            Buy, sell, and trade subscription NFTs for AYZEN platform access
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading} className="font-mono text-xs gap-2">
            <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} /> Refresh
          </Button>
          <Button size="sm" onClick={() => setShowMint(true)} className="font-mono text-xs gap-2">
            <Gem className="w-3.5 h-3.5" /> Mint NFT
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total Minted", value: stats.totalMinted, icon: Gem, color: "text-primary" },
          { label: "Listed", value: stats.listed, icon: Tag, color: "text-emerald-400" },
          { label: "Volume (AZN)", value: stats.tradingVolume.toFixed(1), icon: TrendingUp, color: "text-amber-400" },
        ].map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="bg-card border border-card-border rounded-xl p-4 flex items-center gap-3">
              <div className={cn("w-9 h-9 rounded-lg bg-muted/30 flex items-center justify-center", s.color)}>
                <Icon className="w-4 h-4" />
              </div>
              <div>
                <div className={cn("font-mono text-xl font-bold", s.color)}>{s.value}</div>
                <div className="font-mono text-[10px] text-muted-foreground">{s.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-card border border-border/40 rounded-lg p-1 w-fit">
        {[
          { id: "marketplace" as const, label: "Marketplace", icon: ShoppingCart },
          { id: "my-nfts" as const, label: "My NFTs", icon: Gem },
        ].map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 text-xs font-mono rounded transition-all",
                tab === t.id ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
              {t.id === "my-nfts" && myNfts.length > 0 && (
                <span className="bg-primary/20 text-primary text-[9px] rounded-full px-1.5 py-0.5">{myNfts.length}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Plan filter (marketplace only) */}
      {tab === "marketplace" && (
        <div className="flex gap-2 flex-wrap">
          {["all", "pro", "enterprise"].map(f => (
            <button
              key={f}
              onClick={() => setPlanFilter(f)}
              className={cn(
                "px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider border rounded-full transition-all",
                planFilter === f
                  ? "bg-primary/10 border-primary/40 text-primary"
                  : "border-border/40 text-muted-foreground hover:border-primary/20"
              )}
            >
              {f}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <div key={i} className="h-48 bg-card border border-card-border rounded-xl animate-pulse" />)}
        </div>
      ) : tab === "marketplace" ? (
        listings.length === 0 ? (
          <div className="py-16 text-center bg-card border border-card-border rounded-xl">
            <ShoppingCart className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
            <p className="font-mono text-sm text-muted-foreground">No NFTs listed for sale</p>
            <p className="font-mono text-[11px] text-muted-foreground/50 mt-1">Mint an NFT and list it here to earn AZN</p>
            <Button size="sm" onClick={() => setShowMint(true)} className="mt-5 font-mono text-xs gap-2">
              <Gem className="w-3.5 h-3.5" /> Mint First NFT
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {listings.map(nft => {
              const isOwnListing = nft.owner_id === currentUserId;
              const cfg = PLAN_CONFIG[nft.plan] ?? { label: nft.plan, icon: Shield, color: "", bg: "" };
              const Icon = cfg.icon;
              return (
                <div key={nft.id} className={cn("bg-card border rounded-xl overflow-hidden transition-all hover:border-primary/30", cfg.bg)}>
                  <div className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className={cn("w-10 h-10 rounded-xl border flex items-center justify-center", cfg.color, cfg.bg)}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="font-mono font-bold text-sm">{cfg.label} Pass</div>
                          <div className="font-mono text-[9px] text-muted-foreground/60">{nft.token_id}</div>
                        </div>
                      </div>
                      <PlanBadge plan={nft.plan} />
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                      <div className="bg-background/60 border border-border/40 rounded p-2">
                        <div className="text-muted-foreground/60 mb-0.5">Seller</div>
                        <div className="text-foreground font-medium">{nft.seller_username ?? "—"}</div>
                      </div>
                      <div className="bg-background/60 border border-border/40 rounded p-2">
                        <div className="text-muted-foreground/60 mb-0.5">Transfers</div>
                        <div className="text-foreground font-medium">{nft.transfer_count ?? 0}×</div>
                      </div>
                    </div>

                    <div className="bg-background/60 border border-border/40 rounded p-2 font-mono text-[10px]">
                      <div className="text-muted-foreground/60 mb-0.5">Expires after purchase</div>
                      <div className="text-foreground">30 days from today</div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-mono text-xl font-bold text-primary">{nft.list_price} AZN</div>
                      </div>
                      {isOwnListing ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelist(nft)}
                          className="font-mono text-[10px] gap-1 border-red-500/20 text-red-400 hover:bg-red-500/10"
                        >
                          <X className="w-3 h-3" /> Delist
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => handleBuy(nft)}
                          disabled={buying === nft.id}
                          className="font-mono text-[10px] gap-1"
                        >
                          {buying === nft.id
                            ? <Loader2 className="w-3 h-3 animate-spin" />
                            : <ShoppingCart className="w-3 h-3" />}
                          Buy
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        /* My NFTs */
        myNfts.length === 0 ? (
          <div className="py-16 text-center bg-card border border-card-border rounded-xl">
            <Lock className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
            <p className="font-mono text-sm text-muted-foreground">No NFTs in your wallet</p>
            <p className="font-mono text-[11px] text-muted-foreground/50 mt-1">Mint a subscription NFT to get started</p>
            <Button size="sm" onClick={() => setShowMint(true)} className="mt-5 font-mono text-xs gap-2">
              <Gem className="w-3.5 h-3.5" /> Mint NFT
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {myNfts.map(nft => {
              const cfg = PLAN_CONFIG[nft.plan] ?? { label: nft.plan, icon: Shield, color: "", bg: "" };
              const Icon = cfg.icon;
              const expiry = new Date(nft.expires_at);
              const daysLeft = Math.max(0, Math.floor((expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
              return (
                <div key={nft.id} className={cn("bg-card border rounded-xl overflow-hidden", cfg.bg, nft.is_listed ? "border-amber-500/30" : "border-card-border")}>
                  <div className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className={cn("w-10 h-10 rounded-xl border flex items-center justify-center", cfg.color, cfg.bg)}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="font-mono font-bold text-sm">{cfg.label} Pass</div>
                          <div className="font-mono text-[9px] text-muted-foreground/60">{nft.token_id}</div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <PlanBadge plan={nft.plan} />
                        {nft.is_listed && (
                          <Badge className="font-mono text-[9px] bg-amber-500/10 text-amber-400 border-amber-500/20">
                            Listed {nft.list_price} AZN
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                      <div className="bg-background/60 border border-border/40 rounded p-2">
                        <div className="text-muted-foreground/60 mb-0.5">Expires In</div>
                        <div className={cn("font-bold", daysLeft < 7 ? "text-red-400" : "text-foreground")}>
                          {daysLeft}d left
                        </div>
                      </div>
                      <div className="bg-background/60 border border-border/40 rounded p-2">
                        <div className="text-muted-foreground/60 mb-0.5">Transfers</div>
                        <div className="text-foreground font-medium">{nft.transfer_count ?? 0}×</div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      {nft.is_listed ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelist(nft)}
                          className="flex-1 font-mono text-[10px] gap-1 border-red-500/20 text-red-400 hover:bg-red-500/10"
                        >
                          <X className="w-3 h-3" /> Remove Listing
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setListNft(nft)}
                          className="flex-1 font-mono text-[10px] gap-1 border-primary/20 text-primary hover:bg-primary/10"
                        >
                          <Tag className="w-3 h-3" /> List for Sale
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}
