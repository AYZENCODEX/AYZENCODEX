import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import {
  Vault, Plus, X, ShoppingCart, Shield, Twitter,
  Users, Phone, Mail, Wallet as WalletIcon, Tag,
  Globe, Star, BarChart3, RefreshCw, CheckCircle2, Lock,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
const token = () => localStorage.getItem("ayzen_token") ?? "";
const api = (path: string, opts?: RequestInit) =>
  fetch(`${BASE}/api${path}`, { ...opts, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}`, ...(opts?.headers ?? {}) } });

const TIER_CONFIG = {
  basic:     { label: "Basic",     color: "text-muted-foreground border-border/40" },
  standard:  { label: "Standard",  color: "text-emerald-400 border-emerald-400/30 bg-emerald-400/5" },
  premium:   { label: "Premium",   color: "text-amber-400 border-amber-400/30 bg-amber-400/5" },
  elite:     { label: "Elite",     color: "text-violet-400 border-violet-400/30 bg-violet-400/10" },
};

function PlatformIcon({ type }: { type: string }) {
  const icons: Record<string, React.ElementType> = {
    twitter: Twitter, discord: Users, telegram: Phone, email: Mail,
    wallet: WalletIcon, social: Globe,
  };
  const Ic = icons[type] ?? Shield;
  return <Ic className="w-3 h-3" />;
}

function VaultPreviewBadges({ preview }: { preview: any }) {
  if (!preview) return null;
  const platforms = [
    preview.has_twitter && "twitter",
    preview.has_discord && "discord",
    preview.has_telegram && "telegram",
    preview.has_email && "email",
    preview.has_wallet && "wallet",
  ].filter(Boolean) as string[];
  return (
    <div className="flex items-center gap-1 flex-wrap mt-1">
      {platforms.map(p => (
        <div key={p} className="flex items-center gap-0.5 px-1.5 py-0.5 bg-primary/10 border border-primary/20 rounded text-[8px] font-mono text-primary/70">
          <PlatformIcon type={p} />
          <span className="capitalize">{p}</span>
        </div>
      ))}
    </div>
  );
}

export default function MarketplaceVault() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [listings, setListings] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [wallet, setWallet] = useState<any>(null);
  const [vaultEntries, setVaultEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [buying, setBuying] = useState<number | null>(null);
  const [filter, setFilter] = useState("all");
  const [form, setForm] = useState({ vault_entry_id: "", title: "", description: "", price: "", category: "Social", tier: "basic" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (filter !== "all") params.set("category", filter);
      const [l, s, w, v] = await Promise.all([
        api(`/marketplace/vault/listings?${params}`).then(r => r.json()),
        api("/marketplace/vault/stats").then(r => r.json()),
        api("/marketplace/wallet").then(r => r.json()),
        api("/vault").then(r => r.json()),
      ]);
      setListings(l.listings ?? []);
      setStats(s);
      setWallet(w?.vault ?? null);
      setVaultEntries(Array.isArray(v) ? v : []);
    } catch {}
    setLoading(false);
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!form.title || !form.price) { toast({ title: "Title and price required" }); return; }
    setCreating(true);
    try {
      const r = await api("/marketplace/vault/listings", {
        method: "POST",
        body: JSON.stringify({ ...form, price: Number(form.price), vault_entry_id: form.vault_entry_id ? Number(form.vault_entry_id) : undefined }),
      });
      const d = await r.json();
      if (!r.ok) toast({ variant: "destructive", title: d.error });
      else { toast({ title: "Vault listing created!" }); setShowCreate(false); setForm({ vault_entry_id: "", title: "", description: "", price: "", category: "Social", tier: "basic" }); load(); }
    } catch { toast({ variant: "destructive", title: "Network error" }); }
    setCreating(false);
  };

  const handleBuy = async (id: number) => {
    setBuying(id);
    try {
      const r = await api("/marketplace/vault/buy", { method: "POST", body: JSON.stringify({ listing_id: id }) });
      const d = await r.json();
      if (!r.ok) toast({ variant: "destructive", title: d.error });
      else { toast({ title: `Purchased "${d.title}"!`, description: `Cost: ${d.price} AZN` }); load(); }
    } catch { toast({ variant: "destructive", title: "Network error" }); }
    setBuying(null);
  };

  const handleCancel = async (id: number) => {
    await api(`/marketplace/vault/listings/${id}`, { method: "DELETE" });
    toast({ title: "Listing removed" }); load();
  };

  const CATEGORIES = ["All", "DeFi", "NFT", "GameFi", "Layer2", "Testnet", "CEX", "Social", "Other"];

  return (
    <div className="space-y-6 page-enter">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
              <Vault className="w-4 h-4 text-amber-400" />
            </div>
            <h1 className="text-2xl font-bold font-mono tracking-tighter uppercase">Vault Market</h1>
            <Badge variant="outline" className="font-mono text-[10px] border-amber-400/30 text-amber-400 bg-amber-400/5">SECURE</Badge>
          </div>
          <p className="text-muted-foreground font-mono text-sm">Buy & sell verified crypto accounts · Escrow-protected</p>
        </div>
        <Button onClick={() => setShowCreate(v => !v)} className="font-mono text-xs gap-2 bg-amber-600 hover:bg-amber-700 text-white border-0">
          <Plus className="w-3.5 h-3.5" /> List Account
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Listed", value: stats?.active_listings ?? "—", icon: Vault, color: "text-amber-400" },
          { label: "Floor Price", value: `${stats?.floor_price?.toFixed(0) ?? "—"} AZN`, icon: Tag, color: "text-primary" },
          { label: "Avg Price", value: `${stats?.avg_price?.toFixed(0) ?? "—"} AZN`, icon: BarChart3, color: "text-emerald-400" },
          { label: "Vault Wallet", value: `${wallet?.balance?.toFixed(0) ?? "0"} AZN`, icon: WalletIcon, color: "text-violet-400" },
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

      {/* Create form */}
      {showCreate && (
        <div className="bg-card border border-amber-500/30 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-mono text-xs uppercase tracking-widest text-amber-400 font-bold flex items-center gap-2"><Tag className="w-3.5 h-3.5" />List Vault Account</h3>
            <button onClick={() => setShowCreate(false)}><X className="w-4 h-4 text-muted-foreground" /></button>
          </div>
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3 text-[10px] font-mono text-amber-400/80 flex items-start gap-2">
            <Lock className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            Account details are masked in the listing. Buyer gets access only after payment is confirmed.
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-[10px] font-mono text-muted-foreground/60 mb-1 uppercase tracking-wider">Link Vault Entity (optional)</label>
              <select value={form.vault_entry_id} onChange={e => setForm(p => ({ ...p, vault_entry_id: e.target.value }))} className="w-full h-10 bg-input border border-border rounded-md font-mono text-sm px-3 text-foreground">
                <option value="">— Manual listing —</option>
                {vaultEntries.map((v: any) => (
                  <option key={v.id} value={v.id}>{v.entitySerial || `#${v.id}`} — {v.projectName}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-[10px] font-mono text-muted-foreground/60 mb-1 uppercase tracking-wider">Title *</label>
              <Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="DeFi farming account — 2yr old" className="font-mono text-sm" />
            </div>
            <div>
              <label className="block text-[10px] font-mono text-muted-foreground/60 mb-1 uppercase tracking-wider">Price (AZN) *</label>
              <Input value={form.price} onChange={e => setForm(p => ({ ...p, price: e.target.value }))} placeholder="1500" className="font-mono text-sm" />
            </div>
            <div>
              <label className="block text-[10px] font-mono text-muted-foreground/60 mb-1 uppercase tracking-wider">Tier</label>
              <select value={form.tier} onChange={e => setForm(p => ({ ...p, tier: e.target.value }))} className="w-full h-10 bg-input border border-border rounded-md font-mono text-sm px-3 text-foreground">
                {Object.entries(TIER_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-mono text-muted-foreground/60 mb-1 uppercase tracking-wider">Category</label>
              <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} className="w-full h-10 bg-input border border-border rounded-md font-mono text-sm px-3 text-foreground">
                {["DeFi","NFT","GameFi","Layer2","Testnet","CEX","Social","Other"].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-mono text-muted-foreground/60 mb-1 uppercase tracking-wider">Description</label>
              <Input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Account details..." className="font-mono text-sm" />
            </div>
          </div>
          <Button onClick={handleCreate} disabled={creating} className="w-full font-mono text-xs bg-amber-600 hover:bg-amber-700 text-white border-0">
            {creating ? "Creating..." : "Create Listing"}
          </Button>
        </div>
      )}

      {/* Category filter */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {CATEGORIES.map(c => (
          <button key={c} onClick={() => setFilter(c.toLowerCase() === "all" ? "all" : c)} className={cn("px-2.5 py-1 rounded text-[10px] font-mono uppercase tracking-wider border transition-all", (filter === "all" && c === "All") || filter === c ? "bg-amber-500/15 text-amber-400 border-amber-400/30" : "text-muted-foreground border-border/30 hover:border-border")}>
            {c}
          </button>
        ))}
      </div>

      {/* Listings */}
      {loading ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
      ) : listings.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground/40 font-mono text-sm">No vault accounts listed</div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {listings.map(l => {
            const tCfg = TIER_CONFIG[l.tier as keyof typeof TIER_CONFIG] ?? TIER_CONFIG.basic;
            const isMine = l.seller_id === user?.id;
            return (
              <div key={l.id} className={cn("bg-card border rounded-xl overflow-hidden transition-all card-lift", isMine ? "border-amber-400/20" : "border-card-border hover:border-amber-400/30")}>
                <div className="bg-gradient-to-r from-amber-500/5 to-transparent border-b border-border/30 px-4 py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield className="w-3.5 h-3.5 text-amber-400/60" />
                    <span className="font-mono text-xs text-muted-foreground/70">#{l.id}</span>
                    <Badge variant="outline" className={cn("font-mono text-[8px] uppercase", tCfg.color)}>{tCfg.label}</Badge>
                    <Badge variant="outline" className="font-mono text-[8px] text-muted-foreground border-border/40">{l.category}</Badge>
                    {isMine && <Badge variant="outline" className="font-mono text-[8px] border-amber-400/30 text-amber-400">MINE</Badge>}
                  </div>
                  <div className="font-mono font-bold text-sm text-primary">{Number(l.price).toLocaleString()} AZN</div>
                </div>
                <div className="p-4 space-y-2">
                  <h3 className="font-mono font-bold text-sm text-foreground">{l.title}</h3>
                  {l.description && <p className="font-mono text-[11px] text-muted-foreground/60 line-clamp-2">{l.description}</p>}
                  {l.preview_data && <VaultPreviewBadges preview={l.preview_data} />}
                  <div className="flex items-center justify-between pt-1">
                    <div className="text-[9px] font-mono text-muted-foreground/40">by {l.seller_username} · {new Date(l.created_at).toLocaleDateString()}</div>
                    {isMine ? (
                      <Button size="sm" variant="outline" onClick={() => handleCancel(l.id)} className="font-mono text-[9px] h-6 border-red-500/20 text-red-400 hover:bg-red-500/10">
                        <X className="w-2.5 h-2.5 mr-1" /> Remove
                      </Button>
                    ) : (
                      <Button size="sm" onClick={() => handleBuy(l.id)} disabled={buying === l.id} className="font-mono text-[9px] h-7 bg-amber-600 hover:bg-amber-700 text-white border-0 gap-1">
                        <ShoppingCart className="w-3 h-3" />
                        {buying === l.id ? "Buying..." : "Buy Securely"}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
