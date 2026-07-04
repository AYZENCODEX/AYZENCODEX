import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Gem, ShoppingCart, Tag, RefreshCw, Loader2, Coins, Crown,
  Zap, Shield, Star, TrendingUp, X, CheckCircle2, Lock, User, Award,
  Infinity as InfinityIcon, Filter,
} from "lucide-react";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

interface NftSubscription {
  id: number;
  token_id: string;
  owner_id: number;
  original_owner_id: number;
  plan: string;
  nft_type: string;
  nft_category: string;
  image_url: string | null;
  badge_name: string | null;
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
  byType: Record<string, number>;
}

// ── Plan config ────────────────────────────────────────────────────────────────

const PLAN_CONFIG: Record<string, {
  label: string; icon: React.ElementType; color: string; bg: string; border: string;
  aznCost: number; isLifetime?: boolean; durationLabel: string; description: string;
}> = {
  pro: {
    label: "Pro Pass", icon: Zap, color: "text-cyan-400", bg: "bg-cyan-400/5", border: "border-cyan-400/30",
    aznCost: 30, durationLabel: "30-day subscription", description: "Unlock Pro features for 30 days. Tradeable.",
  },
  enterprise: {
    label: "Enterprise Pass", icon: Crown, color: "text-violet-400", bg: "bg-violet-400/5", border: "border-violet-400/30",
    aznCost: 60, durationLabel: "30-day subscription", description: "Full enterprise access for 30 days. Tradeable.",
  },
  lifetime_pro: {
    label: "Lifetime Pro", icon: Star, color: "text-teal-400", bg: "bg-teal-400/5", border: "border-teal-400/30",
    aznCost: 500, isLifetime: true, durationLabel: "Never expires", description: "Permanent Pro access. Genesis-tier NFT.",
  },
  lifetime_enterprise: {
    label: "Lifetime Enterprise", icon: Shield, color: "text-rose-400", bg: "bg-rose-400/5", border: "border-rose-400/30",
    aznCost: 1000, isLifetime: true, durationLabel: "Never expires", description: "Diamond-tier. Full lifetime access + priority.",
  },
  username: {
    label: "Username NFT", icon: User, color: "text-cyan-300", bg: "bg-cyan-300/5", border: "border-cyan-300/30",
    aznCost: 50, isLifetime: true, durationLabel: "Permanent", description: "Mint your username as a unique NFT. One per account.",
  },
  achievement_badge: {
    label: "Achievement Badge", icon: Award, color: "text-amber-400", bg: "bg-amber-400/5", border: "border-amber-400/30",
    aznCost: 0, isLifetime: true, durationLabel: "Permanent", description: "Collectible achievement badge NFT. Unique to your journey.",
  },
};

const BADGE_OPTIONS = ["Pioneer", "Whale", "Diamond Hand", "Alpha Hunter", "Top Trader", "Airdrop King", "Network Guru", "Vault Master"];

// ── Category filters ────────────────────────────────────────────────────────────

const CATEGORY_FILTERS = [
  { id: "all",               label: "All NFTs",       icon: Gem },
  { id: "subscription_pass", label: "Sub Passes",     icon: Zap },
  { id: "lifetime_pass",     label: "Lifetime",       icon: InfinityIcon },
  { id: "username",          label: "Username NFTs",  icon: User },
  { id: "badge",             label: "Badges",         icon: Award },
];

// ── NFT Image Display ──────────────────────────────────────────────────────────

function NftImage({ imageUrl, plan, size = "lg" }: { imageUrl?: string | null; plan: string; size?: "sm" | "lg" }) {
  const cfg = PLAN_CONFIG[plan] ?? PLAN_CONFIG.pro;
  const Icon = cfg.icon;
  const dim = size === "lg" ? "w-full aspect-square" : "w-10 h-10";
  if (imageUrl) {
    return (
      <div className={cn(dim, "rounded-xl overflow-hidden flex-shrink-0")}>
        <img src={imageUrl} alt={cfg.label} className="w-full h-full object-cover" />
      </div>
    );
  }
  return (
    <div className={cn(dim, "rounded-xl flex items-center justify-center flex-shrink-0", cfg.bg, `border ${cfg.border}`)}>
      <Icon className={cn(size === "lg" ? "w-10 h-10" : "w-5 h-5", cfg.color)} />
    </div>
  );
}

// ── Plan Badge ─────────────────────────────────────────────────────────────────

function PlanBadge({ plan }: { plan: string }) {
  const cfg = PLAN_CONFIG[plan] ?? { label: plan, icon: Shield, color: "text-muted-foreground", border: "border-border" };
  const Icon = cfg.icon;
  return (
    <Badge variant="outline" className={cn("font-mono text-[10px] gap-1", cfg.color, cfg.border)}>
      <Icon className="w-3 h-3" />{cfg.label.toUpperCase()}
    </Badge>
  );
}

// ── Mint Modal ─────────────────────────────────────────────────────────────────

function MintModal({ onClose, onSuccess, token }: { onClose: () => void; onSuccess: () => void; token: string }) {
  const { toast } = useToast();
  const [plan, setPlan] = useState("pro");
  const [badgeName, setBadgeName] = useState("Pioneer");
  const [minting, setMinting] = useState(false);

  const cfg = PLAN_CONFIG[plan];

  const handleMint = async () => {
    setMinting(true);
    try {
      const r = await fetch(`${BASE}/api/nft-subscriptions/mint`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ plan, badge_name: plan === "achievement_badge" ? badgeName : undefined }),
      });
      const d = await r.json();
      if (r.ok) {
        toast({
          title: `🎉 NFT Minted!`,
          description: `${cfg.label} — Token: ${d.nft?.token_id}`,
        });
        onSuccess(); onClose();
      } else {
        toast({ variant: "destructive", title: d.error ?? "Minting failed" });
      }
    } catch {
      toast({ variant: "destructive", title: "Connection error" });
    }
    setMinting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card border border-primary/20 rounded-xl w-full max-w-lg mx-4 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
          <div className="flex items-center gap-2">
            <Gem className="w-4 h-4 text-primary" />
            <span className="font-mono font-bold text-sm">Mint NFT</span>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div className="bg-primary/5 border border-primary/15 rounded-lg p-3 font-mono text-[11px] text-muted-foreground leading-relaxed">
            Choose an NFT type to mint. Subscription passes grant platform access and can be resold. Username and badge NFTs are permanent collectibles.
          </div>

          {/* Category groups */}
          {[
            { heading: "Subscription Passes", plans: ["pro", "enterprise"] },
            { heading: "Lifetime Passes", plans: ["lifetime_pro", "lifetime_enterprise"] },
            { heading: "Collectible NFTs", plans: ["username", "achievement_badge"] },
          ].map(group => (
            <div key={group.heading}>
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60 mb-2">{group.heading}</div>
              <div className="space-y-1.5">
                {group.plans.map(key => {
                  const c = PLAN_CONFIG[key];
                  const Icon = c.icon;
                  return (
                    <button key={key} onClick={() => setPlan(key)}
                      className={cn("w-full flex items-center gap-3 p-2.5 rounded-lg border transition-all text-left",
                        plan === key ? `${c.color} ${c.bg} ${c.border}` : "border-border/40 hover:border-primary/20")}>
                      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0", c.bg)}>
                        <Icon className={cn("w-4 h-4", c.color)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-mono font-bold text-sm">{c.label}</div>
                        <div className="font-mono text-[10px] text-muted-foreground truncate">{c.description}</div>
                      </div>
                      <div className="font-mono text-sm font-bold text-primary flex-shrink-0">
                        {c.aznCost === 0 ? "FREE" : `${c.aznCost} AZN`}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Badge name picker */}
          {plan === "achievement_badge" && (
            <div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2">Badge Name</div>
              <div className="flex flex-wrap gap-1.5">
                {BADGE_OPTIONS.map(b => (
                  <button key={b} onClick={() => setBadgeName(b)}
                    className={cn("px-2.5 py-1 text-[10px] font-mono rounded-full border transition-all",
                      badgeName === b ? "bg-amber-400/10 border-amber-400/40 text-amber-400" : "border-border/40 text-muted-foreground hover:border-amber-400/20")}>
                    {b}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Selected plan preview */}
          <div className={cn("rounded-lg border p-3 flex items-center gap-3", cfg.bg, cfg.border)}>
            <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", cfg.bg)}>
              <cfg.icon className={cn("w-5 h-5", cfg.color)} />
            </div>
            <div className="flex-1">
              <div className="font-mono font-bold text-sm">{cfg.label}{plan === "achievement_badge" ? ` — ${badgeName}` : ""}</div>
              <div className="font-mono text-[10px] text-muted-foreground">{cfg.durationLabel}</div>
            </div>
            <div className={cn("font-mono text-lg font-bold", cfg.color)}>{cfg.aznCost === 0 ? "FREE" : `${cfg.aznCost} AZN`}</div>
          </div>

          <Button onClick={handleMint} disabled={minting} className="w-full font-mono text-xs gap-2">
            {minting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Gem className="w-3.5 h-3.5" />}
            {minting ? "Minting…" : `Mint NFT${cfg.aznCost > 0 ? ` — ${cfg.aznCost} AZN` : " (Free)"}`}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── List Modal ─────────────────────────────────────────────────────────────────

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
      if (r.ok) { toast({ title: `Listed for ${p} AZN!` }); onSuccess(); onClose(); }
      else toast({ variant: "destructive", title: d.error ?? "Failed to list" });
    } catch { toast({ variant: "destructive", title: "Connection error" }); }
    setListing(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card border border-primary/20 rounded-xl w-full max-w-sm mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
          <span className="font-mono font-bold text-sm">List on Marketplace</span>
          <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>
        <div className="px-5 py-4 space-y-4">
          {nft.image_url ? (
            <div className="w-full aspect-video rounded-lg overflow-hidden">
              <img src={nft.image_url} alt={nft.plan} className="w-full h-full object-cover" />
            </div>
          ) : null}
          <div className="bg-muted/20 rounded-lg p-3 space-y-1">
            <div className="font-mono text-sm font-bold">{PLAN_CONFIG[nft.plan]?.label ?? nft.plan}</div>
            <div className="font-mono text-[10px] text-muted-foreground">{nft.token_id}</div>
            <PlanBadge plan={nft.plan} />
          </div>
          <div>
            <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground block mb-1">Sale Price (AZN)</label>
            <Input type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="e.g. 45" className="font-mono text-xs h-10" />
            {price && <p className="text-[10px] text-muted-foreground/50 mt-1">≈ ${(Number(price) / 100).toFixed(2)} USD</p>}
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

// ── NFT Card ───────────────────────────────────────────────────────────────────

function NftCard({
  nft, isOwn, buying, onBuy, onDelist, onList, showListBtn,
}: {
  nft: NftSubscription; isOwn: boolean; buying: boolean;
  onBuy: () => void; onDelist: () => void; onList?: () => void; showListBtn?: boolean;
}) {
  const cfg = PLAN_CONFIG[nft.plan] ?? { label: nft.plan, icon: Shield, color: "text-muted-foreground", bg: "", border: "border-border" };
  const expiry = new Date(nft.expires_at);
  const isLifetime = cfg.isLifetime;
  const daysLeft = isLifetime ? Infinity : Math.max(0, Math.floor((expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));

  return (
    <div className={cn("bg-card border rounded-xl overflow-hidden transition-all hover:border-primary/30 flex flex-col", cfg.bg, cfg.border)}>
      {/* NFT Image */}
      {nft.image_url ? (
        <div className="aspect-square overflow-hidden">
          <img src={nft.image_url} alt={cfg.label} className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className={cn("aspect-square flex items-center justify-center", cfg.bg)}>
          <cfg.icon className={cn("w-16 h-16 opacity-20", cfg.color)} />
        </div>
      )}

      <div className="p-3 space-y-2.5 flex flex-col flex-1">
        <div className="flex items-start justify-between gap-1">
          <div>
            <div className="font-mono font-bold text-sm">{cfg.label}</div>
            {nft.badge_name && <div className="font-mono text-[10px] text-amber-400">{nft.badge_name}</div>}
            <div className="font-mono text-[9px] text-muted-foreground/50 mt-0.5 truncate">{nft.token_id}</div>
          </div>
          <PlanBadge plan={nft.plan} />
        </div>

        <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono">
          {nft.seller_username && (
            <div className="bg-background/60 border border-border/30 rounded p-1.5">
              <div className="text-muted-foreground/60 mb-0.5">Seller</div>
              <div className="truncate">{nft.seller_username}</div>
            </div>
          )}
          {!isOwn && (
            <div className="bg-background/60 border border-border/30 rounded p-1.5">
              <div className="text-muted-foreground/60 mb-0.5">Transfers</div>
              <div>{nft.transfer_count ?? 0}×</div>
            </div>
          )}
          <div className="bg-background/60 border border-border/30 rounded p-1.5">
            <div className="text-muted-foreground/60 mb-0.5">Validity</div>
            <div className={cn("font-bold", isLifetime ? "text-teal-400" : daysLeft < 7 ? "text-red-400" : "")}>
              {isLifetime ? "∞" : `${daysLeft}d`}
            </div>
          </div>
          {isOwn && nft.is_listed && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded p-1.5">
              <div className="text-amber-400/60 mb-0.5">Listed</div>
              <div className="text-amber-400 font-bold">{nft.list_price} AZN</div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between mt-auto pt-1">
          {nft.is_listed && nft.list_price ? (
            <div>
              <div className="font-mono text-lg font-bold text-primary">{nft.list_price} AZN</div>
              <div className="font-mono text-[9px] text-muted-foreground/50">${(nft.list_price / 100).toFixed(2)}</div>
            </div>
          ) : <div />}
          <div className="flex gap-1.5">
            {isOwn ? (
              nft.is_listed ? (
                <Button variant="outline" size="sm" onClick={onDelist}
                  className="h-7 text-[10px] gap-1 border-red-500/20 text-red-400 hover:bg-red-500/10">
                  <X className="w-3 h-3" /> Delist
                </Button>
              ) : showListBtn ? (
                <Button variant="outline" size="sm" onClick={onList}
                  className="h-7 text-[10px] gap-1 border-primary/20 text-primary hover:bg-primary/10">
                  <Tag className="w-3 h-3" /> List
                </Button>
              ) : null
            ) : (
              <Button size="sm" onClick={onBuy} disabled={buying}
                className="h-7 text-[10px] gap-1">
                {buying ? <Loader2 className="w-3 h-3 animate-spin" /> : <ShoppingCart className="w-3 h-3" />}
                Buy
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Export ────────────────────────────────────────────────────────────────

export default function NftMarketplace() {
  const { token, user } = useAuth();
  const { toast } = useToast();

  const [listings, setListings] = useState<NftSubscription[]>([]);
  const [myNfts, setMyNfts] = useState<NftSubscription[]>([]);
  const [stats, setStats] = useState<Stats>({ totalMinted: 0, listed: 0, tradingVolume: 0, byType: {} });
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState<number | null>(null);
  const [tab, setTab] = useState<"marketplace" | "my-nfts">("marketplace");
  const [showMint, setShowMint] = useState(false);
  const [listNft, setListNft] = useState<NftSubscription | null>(null);
  const [catFilter, setCatFilter] = useState("all");

  const headers = { Authorization: `Bearer ${token}` };
  const currentUserId = user?.id ?? null;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const catQ = catFilter !== "all" ? `?category=${catFilter}` : "";
      const [marketRes, myRes, statsRes] = await Promise.all([
        fetch(`${BASE}/api/nft-subscriptions/marketplace${catQ}`, { headers }),
        fetch(`${BASE}/api/nft-subscriptions/my-nfts`, { headers }),
        fetch(`${BASE}/api/nft-subscriptions/stats`),
      ]);
      if (marketRes.ok) setListings(await marketRes.json());
      if (myRes.ok) setMyNfts(await myRes.json());
      if (statsRes.ok) setStats(await statsRes.json());
    } catch { toast({ variant: "destructive", title: "Failed to load NFT data" }); }
    setLoading(false);
  }, [token, catFilter]);

  useEffect(() => { load(); }, [load]);

  const handleBuy = async (nft: NftSubscription) => {
    setBuying(nft.id);
    try {
      const r = await fetch(`${BASE}/api/nft-subscriptions/${nft.id}/buy`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      const d = await r.json();
      if (r.ok) { toast({ title: `✅ NFT Purchased! ${PLAN_CONFIG[d.plan]?.label ?? d.plan} activated.` }); await load(); }
      else toast({ variant: "destructive", title: d.error ?? "Purchase failed" });
    } catch { toast({ variant: "destructive", title: "Connection error" }); }
    setBuying(null);
  };

  const handleDelist = async (nft: NftSubscription) => {
    try {
      const r = await fetch(`${BASE}/api/nft-subscriptions/${nft.id}/delist`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      if (r.ok) { toast({ title: "Delisted" }); await load(); }
    } catch { toast({ variant: "destructive", title: "Connection error" }); }
  };

  return (
    <div className="space-y-5 page-enter">
      {showMint && <MintModal onClose={() => setShowMint(false)} onSuccess={load} token={token ?? ""} />}
      {listNft && <ListModal nft={listNft} onClose={() => setListNft(null)} onSuccess={load} token={token ?? ""} />}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold font-mono tracking-tighter uppercase flex items-center gap-2">
            <Gem className="w-5 h-5 text-primary" /> NFT Market
          </h2>
          <p className="text-muted-foreground font-mono text-[11px] mt-0.5">Mint, buy, and trade AYZEN NFTs</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading} className="font-mono text-xs gap-1.5 h-8">
            <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} /> Refresh
          </Button>
          <Button size="sm" onClick={() => setShowMint(true)} className="font-mono text-xs gap-1.5 h-8">
            <Gem className="w-3.5 h-3.5" /> Mint NFT
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Minted", value: stats.totalMinted, icon: Gem, color: "text-primary" },
          { label: "Listed",        value: stats.listed,       icon: Tag, color: "text-emerald-400" },
          { label: "Volume (AZN)",  value: stats.tradingVolume.toFixed(0), icon: TrendingUp, color: "text-amber-400" },
          { label: "Types",         value: Object.keys(stats.byType ?? {}).length, icon: Filter, color: "text-violet-400" },
        ].map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="bg-card border border-border/30 rounded-xl p-3 flex items-center gap-3">
              <div className={cn("w-8 h-8 rounded-lg bg-muted/20 flex items-center justify-center", s.color)}>
                <Icon className="w-4 h-4" />
              </div>
              <div>
                <div className={cn("font-mono text-base font-bold", s.color)}>{s.value}</div>
                <div className="font-mono text-[9px] text-muted-foreground">{s.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted/20 rounded-lg p-1 w-fit">
        {[
          { id: "marketplace" as const, label: "Marketplace", icon: ShoppingCart },
          { id: "my-nfts" as const,     label: "My NFTs",     icon: Gem },
        ].map(t => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={cn("flex items-center gap-1.5 px-4 py-2 text-xs font-mono rounded transition-all",
                tab === t.id ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground")}>
              <Icon className="w-3.5 h-3.5" />
              {t.label}
              {t.id === "my-nfts" && myNfts.length > 0 && (
                <span className="bg-primary/20 text-primary text-[9px] rounded-full px-1.5 py-0.5">{myNfts.length}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Category filter */}
      {tab === "marketplace" && (
        <div className="flex gap-2 flex-wrap">
          {CATEGORY_FILTERS.map(f => {
            const Icon = f.icon;
            return (
              <button key={f.id} onClick={() => setCatFilter(f.id)}
                className={cn("flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-mono rounded-full border transition-all",
                  catFilter === f.id ? "bg-primary/10 border-primary/40 text-primary" : "border-border/40 text-muted-foreground hover:border-primary/20")}>
                <Icon className="w-3 h-3" /> {f.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="aspect-square bg-card border border-border/30 rounded-xl animate-pulse" />)}
        </div>
      ) : tab === "marketplace" ? (
        listings.length === 0 ? (
          <div className="py-12 text-center bg-card border border-border/30 rounded-xl">
            <ShoppingCart className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
            <p className="font-mono text-sm text-muted-foreground">No NFTs listed for sale</p>
            <p className="font-mono text-[11px] text-muted-foreground/50 mt-1">Mint an NFT and list it to earn AZN</p>
            <Button size="sm" onClick={() => setShowMint(true)} className="mt-4 font-mono text-xs gap-1.5">
              <Gem className="w-3.5 h-3.5" /> Mint First NFT
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {listings.map(nft => (
              <NftCard
                key={nft.id}
                nft={nft}
                isOwn={nft.owner_id === currentUserId}
                buying={buying === nft.id}
                onBuy={() => handleBuy(nft)}
                onDelist={() => handleDelist(nft)}
              />
            ))}
          </div>
        )
      ) : (
        myNfts.length === 0 ? (
          <div className="py-12 text-center bg-card border border-border/30 rounded-xl">
            <Lock className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
            <p className="font-mono text-sm text-muted-foreground">No NFTs in your wallet</p>
            <Button size="sm" onClick={() => setShowMint(true)} className="mt-4 font-mono text-xs gap-1.5">
              <Gem className="w-3.5 h-3.5" /> Mint Your First NFT
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {myNfts.map(nft => (
              <NftCard
                key={nft.id}
                nft={nft}
                isOwn
                buying={false}
                onBuy={() => {}}
                onDelist={() => handleDelist(nft)}
                onList={() => setListNft(nft)}
                showListBtn={!nft.is_listed}
              />
            ))}
          </div>
        )
      )}
    </div>
  );
}
