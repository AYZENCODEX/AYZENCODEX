import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import {
  Vault, Plus, X, ShoppingCart, Shield, Tag,
  Star, BarChart3, RefreshCw, Lock, Check,
  Mail, Facebook, Github, Linkedin, MessageCircle,
  Database, Smartphone, ChevronRight,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
const tok = () => localStorage.getItem("ayzen_token") ?? "";
const api = (p: string, o?: RequestInit) =>
  fetch(`${BASE}/api${p}`, { ...o, headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok()}`, ...(o?.headers ?? {}) } });

// ── Account categories ─────────────────────────────────────────────────────
const ACCOUNT_CATEGORIES = [
  { id: "gmail",    label: "Gmail",    icon: Mail,         color: "text-red-400",    border: "border-red-400/30",    bg: "bg-red-400/10" },
  { id: "facebook", label: "Facebook", icon: Facebook,     color: "text-blue-400",   border: "border-blue-400/30",   bg: "bg-blue-400/10" },
  { id: "github",   label: "GitHub",   icon: Github,       color: "text-purple-400", border: "border-purple-400/30", bg: "bg-purple-400/10" },
  { id: "linkedin", label: "LinkedIn", icon: Linkedin,     color: "text-cyan-400",   border: "border-cyan-400/30",   bg: "bg-cyan-400/10" },
  { id: "reddit",   label: "Reddit",   icon: MessageCircle,color: "text-orange-400", border: "border-orange-400/30", bg: "bg-orange-400/10" },
];

// Category-specific fields for buy orders
const CATEGORY_BUY_FIELDS: Record<string, Array<{ key: string; label: string; type: "text" | "number" | "boolean"; placeholder?: string }>> = {
  gmail: [
    { key: "account_create_date", label: "Account Created (date)", type: "text", placeholder: "e.g. 2020-01-15" },
    { key: "points",               label: "Points",                 type: "number", placeholder: "e.g. 1000" },
    { key: "has_2fa",              label: "2FA Access Included",    type: "boolean" },
  ],
  facebook: [
    { key: "account_create_date", label: "Account Created (date)", type: "text", placeholder: "e.g. 2019-06-01" },
    { key: "followers",            label: "Min Followers",          type: "number", placeholder: "e.g. 500" },
    { key: "has_2fa",              label: "2FA Access Included",    type: "boolean" },
  ],
  github: [
    { key: "account_age_years",   label: "Min Account Age (years)", type: "number", placeholder: "e.g. 3" },
    { key: "account_create_date", label: "Account Created (date)",  type: "text",   placeholder: "e.g. 2021-03-10" },
    { key: "repo_count",           label: "Min Repositories",        type: "number", placeholder: "e.g. 10" },
  ],
  linkedin: [
    { key: "account_create_date", label: "Account Created (date)", type: "text",   placeholder: "e.g. 2018-09-20" },
    { key: "account_age_years",   label: "Min Account Age (years)", type: "number", placeholder: "e.g. 2" },
    { key: "connections",          label: "Min Connections",         type: "number", placeholder: "e.g. 100" },
  ],
  reddit: [
    { key: "account_create_date", label: "Account Created (date)", type: "text",   placeholder: "e.g. 2020-11-01" },
    { key: "account_age_years",   label: "Min Account Age (years)", type: "number", placeholder: "e.g. 1" },
    { key: "followers",            label: "Min Followers",           type: "number", placeholder: "e.g. 50" },
  ],
};

// ── Create Buy Order Modal ────────────────────────────────────────────────────
function BuyOrderModal({ vaultType, onClose, onSuccess }: { vaultType: "entity" | "local"; onClose: () => void; onSuccess: () => void }) {
  const { toast } = useToast();
  const [step, setStep] = useState<"category" | "details" | "price">("category");
  const [category, setCategory] = useState("");
  const [details, setDetails] = useState<Record<string, any>>({});
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [creating, setCreating] = useState(false);

  const fields = CATEGORY_BUY_FIELDS[category] ?? [];
  const catDef = ACCOUNT_CATEGORIES.find(c => c.id === category);

  const handleCreate = async () => {
    if (!priceMin || !priceMax) { toast({ title: "Set price range" }); return; }
    setCreating(true);
    try {
      const r = await api("/marketplace/vault/listings", {
        method: "POST",
        body: JSON.stringify({
          order_type: "buy",
          vault_type: vaultType,
          account_type: category,
          account_details: details,
          price_min: Number(priceMin),
          price_max: Number(priceMax),
          price: Number(priceMin),
        }),
      });
      const d = await r.json();
      if (r.ok) { toast({ title: "Buy order created!" }); onSuccess(); onClose(); }
      else toast({ variant: "destructive", title: d.error });
    } catch { toast({ variant: "destructive", title: "Network error" }); }
    setCreating(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card border border-primary/20 rounded-xl w-full max-w-md mx-4 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/40 sticky top-0 bg-card">
          <div>
            <span className="font-mono font-bold text-sm">Create Buy Order</span>
            <div className="text-[10px] font-mono text-muted-foreground capitalize">{vaultType} account · {step}</div>
          </div>
          <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>
        <div className="p-5 space-y-4">
          {/* Step 1: Category */}
          {step === "category" && (
            <>
              <p className="text-[11px] font-mono text-muted-foreground">Select the account type you want to buy:</p>
              <div className="space-y-2">
                {ACCOUNT_CATEGORIES.map(cat => {
                  const Icon = cat.icon;
                  return (
                    <button key={cat.id} onClick={() => setCategory(cat.id)}
                      className={cn("w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left",
                        category === cat.id ? `${cat.bg} ${cat.border} ${cat.color}` : "border-border/30 hover:border-primary/20")}>
                      <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0", category === cat.id ? cat.bg : "bg-muted/20")}>
                        <Icon className={cn("w-5 h-5", cat.color)} />
                      </div>
                      <span className="font-mono text-sm font-bold">{cat.label}</span>
                      {category === cat.id && <Check className="w-4 h-4 ml-auto" />}
                    </button>
                  );
                })}
              </div>
              <Button onClick={() => setStep("details")} disabled={!category} className="w-full font-mono text-xs">
                Next: Account Requirements <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </>
          )}

          {/* Step 2: Details */}
          {step === "details" && catDef && (
            <>
              <div className="flex items-center gap-2 bg-muted/20 rounded-lg px-3 py-2">
                <catDef.icon className={cn("w-4 h-4", catDef.color)} />
                <span className="font-mono text-sm font-bold">{catDef.label} Requirements</span>
              </div>
              <div className="space-y-3">
                {fields.map(field => (
                  <div key={field.key}>
                    <label className="block text-[10px] font-mono text-muted-foreground/60 mb-1 uppercase tracking-wider">{field.label}</label>
                    {field.type === "boolean" ? (
                      <div className="flex gap-2">
                        {["Yes", "No"].map(v => (
                          <button key={v} onClick={() => setDetails(d => ({ ...d, [field.key]: v === "Yes" }))}
                            className={cn("flex-1 py-2 rounded-lg border font-mono text-xs transition-all",
                              details[field.key] === (v === "Yes") ? "bg-primary/10 border-primary/40 text-primary" : "border-border/40 text-muted-foreground hover:border-border")}>
                            {v}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <Input
                        type={field.type}
                        value={details[field.key] ?? ""}
                        onChange={e => setDetails(d => ({ ...d, [field.key]: e.target.value }))}
                        placeholder={field.placeholder}
                        className="font-mono text-sm"
                      />
                    )}
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep("category")} className="flex-1 font-mono text-xs">Back</Button>
                <Button onClick={() => setStep("price")} className="flex-1 font-mono text-xs">
                  Next: Price Range <ChevronRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </div>
            </>
          )}

          {/* Step 3: Price */}
          {step === "price" && (
            <>
              <p className="text-[11px] font-mono text-muted-foreground">Set your price range (in AZN):</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-mono text-muted-foreground/60 mb-1 uppercase tracking-wider">Min Price (AZN)</label>
                  <Input type="number" value={priceMin} onChange={e => setPriceMin(e.target.value)} placeholder="e.g. 500" className="font-mono text-sm" />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-muted-foreground/60 mb-1 uppercase tracking-wider">Max Price (AZN)</label>
                  <Input type="number" value={priceMax} onChange={e => setPriceMax(e.target.value)} placeholder="e.g. 2000" className="font-mono text-sm" />
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep("details")} className="flex-1 font-mono text-xs">Back</Button>
                <Button onClick={handleCreate} disabled={creating} className="flex-1 font-mono text-xs bg-amber-600 hover:bg-amber-700 text-white border-0">
                  {creating ? "Creating..." : "Create Buy Order"}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Create Sell Order Modal ───────────────────────────────────────────────────
function SellOrderModal({ vaultType, onClose, onSuccess }: { vaultType: "entity" | "local"; onClose: () => void; onSuccess: () => void }) {
  const { toast } = useToast();
  const [step, setStep] = useState<"category" | "vault" | "details" | "price">("category");
  const [category, setCategory] = useState("");
  const [vaultEntries, setVaultEntries] = useState<any[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<any>(null);
  const [details, setDetails] = useState<Record<string, any>>({});
  const [price, setPrice] = useState("");
  const [creating, setCreating] = useState(false);

  const catDef = ACCOUNT_CATEGORIES.find(c => c.id === category);
  const fields = CATEGORY_BUY_FIELDS[category] ?? [];

  useEffect(() => {
    if (step === "vault" && vaultType === "entity") {
      api("/vault").then(r => r.json()).then(d => setVaultEntries(Array.isArray(d) ? d : []));
    } else if (step === "vault" && vaultType === "local") {
      api("/local-accounts").then(r => r.json()).then(d => setVaultEntries(Array.isArray(d) ? d : []));
    }
  }, [step, vaultType]);

  useEffect(() => {
    if (selectedEntry) {
      // Auto-fill from vault entry
      const autoFilled: Record<string, any> = {};
      if (vaultType === "entity") {
        if (selectedEntry.account_create_date) autoFilled.account_create_date = selectedEntry.account_create_date;
        if (selectedEntry.twitter_followers) autoFilled.followers = selectedEntry.twitter_followers;
      } else {
        if (selectedEntry.account_create_date) autoFilled.account_create_date = selectedEntry.account_create_date;
        if (selectedEntry.followers) autoFilled.followers = selectedEntry.followers;
        if (selectedEntry.twofa) autoFilled.has_2fa = true;
      }
      setDetails(autoFilled);
    }
  }, [selectedEntry]);

  const handleCreate = async () => {
    if (!price) { toast({ title: "Price required" }); return; }
    setCreating(true);
    try {
      const payload: any = {
        order_type: "sell",
        vault_type: vaultType,
        account_type: category,
        account_details: details,
        price: Number(price),
        title: `${catDef?.label ?? category} Account`,
        category,
      };
      if (selectedEntry) {
        if (vaultType === "entity") payload.vault_entry_id = selectedEntry.id;
        else payload.local_account_id = selectedEntry.id;
      }
      const r = await api("/marketplace/vault/listings", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const d = await r.json();
      if (r.ok) { toast({ title: "Sell listing created!" }); onSuccess(); onClose(); }
      else toast({ variant: "destructive", title: d.error });
    } catch { toast({ variant: "destructive", title: "Network error" }); }
    setCreating(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card border border-amber-500/20 rounded-xl w-full max-w-md mx-4 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/40 sticky top-0 bg-card">
          <div>
            <span className="font-mono font-bold text-sm">Create Sell Order</span>
            <div className="text-[10px] font-mono text-muted-foreground capitalize">{vaultType} account · {step}</div>
          </div>
          <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>
        <div className="p-5 space-y-4">
          {/* Category */}
          {step === "category" && (
            <>
              <p className="text-[11px] font-mono text-muted-foreground">Select the account category you are selling:</p>
              <div className="space-y-2">
                {ACCOUNT_CATEGORIES.map(cat => {
                  const Icon = cat.icon;
                  return (
                    <button key={cat.id} onClick={() => setCategory(cat.id)}
                      className={cn("w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left",
                        category === cat.id ? `${cat.bg} ${cat.border} ${cat.color}` : "border-border/30 hover:border-primary/20")}>
                      <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0", category === cat.id ? cat.bg : "bg-muted/20")}>
                        <Icon className={cn("w-5 h-5", cat.color)} />
                      </div>
                      <span className="font-mono text-sm font-bold">{cat.label}</span>
                      {category === cat.id && <Check className="w-4 h-4 ml-auto" />}
                    </button>
                  );
                })}
              </div>
              <Button onClick={() => setStep("vault")} disabled={!category} className="w-full font-mono text-xs">
                Next: Select from Vault <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </>
          )}

          {/* Vault Entry Selection */}
          {step === "vault" && (
            <>
              <p className="text-[11px] font-mono text-muted-foreground">Select the {vaultType} account from your vault (optional — skip to enter manually):</p>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {vaultEntries.length === 0 ? (
                  <p className="text-center py-4 font-mono text-sm text-muted-foreground/50">No {vaultType} accounts in vault</p>
                ) : (
                  vaultEntries.map(entry => (
                    <button key={entry.id} onClick={() => setSelectedEntry(entry)}
                      className={cn("w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left",
                        selectedEntry?.id === entry.id ? "border-primary/40 bg-primary/5" : "border-border/30 hover:border-primary/20")}>
                      <div className="w-8 h-8 rounded-lg bg-muted/20 flex items-center justify-center flex-shrink-0">
                        {vaultType === "entity" ? <Database className="w-4 h-4 text-muted-foreground" /> : <Smartphone className="w-4 h-4 text-muted-foreground" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-mono text-xs font-bold truncate">
                          {vaultType === "entity" ? (entry.projectName ?? entry.project_name ?? `Entity #${entry.id}`) : (entry.label ?? entry.category ?? `Account #${entry.id}`)}
                        </div>
                        <div className="font-mono text-[9px] text-muted-foreground">{entry.category ?? "—"}</div>
                      </div>
                      {selectedEntry?.id === entry.id && <Check className="w-4 h-4 text-primary flex-shrink-0" />}
                    </button>
                  ))
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep("category")} className="flex-1 font-mono text-xs">Back</Button>
                <Button onClick={() => setStep("details")} className="flex-1 font-mono text-xs">
                  {selectedEntry ? "Next: Review Details" : "Skip: Enter Manually"} <ChevronRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </div>
            </>
          )}

          {/* Account Details */}
          {step === "details" && catDef && (
            <>
              <div className="flex items-center gap-2 bg-muted/20 rounded-lg px-3 py-2">
                <catDef.icon className={cn("w-4 h-4", catDef.color)} />
                <span className="font-mono text-sm font-bold">{catDef.label} Account Details</span>
              </div>
              {selectedEntry && (
                <div className="bg-emerald-400/5 border border-emerald-400/20 rounded-lg px-3 py-2 text-[10px] font-mono text-emerald-400/80 flex items-center gap-2">
                  <Check className="w-3 h-3" /> Some fields auto-filled from vault
                </div>
              )}
              <div className="space-y-3">
                {fields.map(field => (
                  <div key={field.key}>
                    <label className="block text-[10px] font-mono text-muted-foreground/60 mb-1 uppercase tracking-wider">{field.label}</label>
                    {field.type === "boolean" ? (
                      <div className="flex gap-2">
                        {["Yes", "No"].map(v => (
                          <button key={v} onClick={() => setDetails(d => ({ ...d, [field.key]: v === "Yes" }))}
                            className={cn("flex-1 py-2 rounded-lg border font-mono text-xs transition-all",
                              details[field.key] === (v === "Yes") ? "bg-primary/10 border-primary/40 text-primary" : "border-border/40 text-muted-foreground hover:border-border")}>
                            {v}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <Input
                        type={field.type}
                        value={details[field.key] ?? ""}
                        onChange={e => setDetails(d => ({ ...d, [field.key]: e.target.value }))}
                        placeholder={field.placeholder}
                        className={cn("font-mono text-sm", details[field.key] ? "border-emerald-400/30" : "")}
                      />
                    )}
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep("vault")} className="flex-1 font-mono text-xs">Back</Button>
                <Button onClick={() => setStep("price")} className="flex-1 font-mono text-xs">
                  Next: Set Price <ChevronRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </div>
            </>
          )}

          {/* Price */}
          {step === "price" && (
            <>
              <div>
                <label className="block text-[10px] font-mono text-muted-foreground/60 mb-1 uppercase tracking-wider">Price (AZN) *</label>
                <Input type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="e.g. 1500" className="font-mono text-sm" />
                {price && <p className="text-[10px] font-mono text-muted-foreground/50 mt-1">Platform fee: 5% · You receive: {(Number(price) * 0.95).toFixed(0)} AZN</p>}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep("details")} className="flex-1 font-mono text-xs">Back</Button>
                <Button onClick={handleCreate} disabled={creating} className="flex-1 font-mono text-xs bg-amber-600 hover:bg-amber-700 text-white border-0">
                  {creating ? "Creating..." : "List for Sale"}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
type VaultTab = "entity" | "local";
type ViewMode = "sell" | "buy";

export default function MarketplaceVault() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [vaultTab, setVaultTab] = useState<VaultTab>("entity");
  const [viewMode, setViewMode] = useState<ViewMode>("sell");
  const [listings, setListings] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [wallet, setWallet] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [catFilter, setCatFilter] = useState("all");
  const [buying, setBuying] = useState<number | null>(null);
  const [showBuyOrder, setShowBuyOrder] = useState(false);
  const [showSellOrder, setShowSellOrder] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        vault_type: vaultTab,
        order_type: viewMode,
        limit: "50",
      });
      if (catFilter !== "all") params.set("account_type", catFilter);
      const [l, s, w] = await Promise.all([
        api(`/marketplace/vault/listings?${params}`).then(r => r.json()),
        api("/marketplace/vault/stats").then(r => r.json()),
        api("/marketplace/wallet").then(r => r.json()),
      ]);
      setListings(l.listings ?? []);
      setStats(s);
      setWallet(w?.vault ?? null);
    } catch {}
    setLoading(false);
  }, [vaultTab, viewMode, catFilter]);

  useEffect(() => { load(); }, [load]);

  const handleBuy = async (id: number) => {
    setBuying(id);
    try {
      const r = await api("/marketplace/vault/buy", { method: "POST", body: JSON.stringify({ listing_id: id }) });
      const d = await r.json();
      if (!r.ok) toast({ variant: "destructive", title: d.error });
      else { toast({ title: `Purchased!`, description: `Cost: ${d.price} AZN` }); load(); }
    } catch { toast({ variant: "destructive", title: "Network error" }); }
    setBuying(null);
  };

  const handleCancel = async (id: number) => {
    await api(`/marketplace/vault/listings/${id}`, { method: "DELETE" });
    toast({ title: "Listing removed" }); load();
  };

  return (
    <div className="space-y-5 page-enter">
      {showBuyOrder && <BuyOrderModal vaultType={vaultTab} onClose={() => setShowBuyOrder(false)} onSuccess={load} />}
      {showSellOrder && <SellOrderModal vaultType={vaultTab} onClose={() => setShowSellOrder(false)} onSuccess={load} />}

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
          <p className="text-muted-foreground font-mono text-sm">Buy & sell crypto accounts · Escrow protected</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading} className="font-mono text-xs h-8">
            <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
          </Button>
          <Button size="sm" variant="outline" onClick={() => setShowBuyOrder(true)} className="font-mono text-xs h-8 gap-1.5 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10">
            <Plus className="w-3.5 h-3.5" /> Buy Order
          </Button>
          <Button size="sm" onClick={() => setShowSellOrder(true)} className="font-mono text-xs h-8 gap-1.5 bg-amber-600 hover:bg-amber-700 text-white border-0">
            <Plus className="w-3.5 h-3.5" /> Sell Order
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "For Sale",      value: stats?.active_listings ?? "—",    icon: Vault,     color: "text-amber-400" },
          { label: "Buy Orders",    value: stats?.active_buy_orders ?? "—",  icon: ShoppingCart, color: "text-emerald-400" },
          { label: "Floor Price",   value: `${stats?.floor_price?.toFixed(0) ?? "—"} AZN`, icon: Tag, color: "text-primary" },
          { label: "Vault Wallet",  value: `${wallet?.balance?.toFixed(0) ?? "0"} AZN`, icon: Star, color: "text-violet-400" },
        ].map(s => (
          <div key={s.label} className="bg-card border border-card-border rounded-xl p-3 flex items-center gap-3">
            <div className={cn("w-8 h-8 rounded-lg bg-muted/20 flex items-center justify-center flex-shrink-0", s.color)}>
              <s.icon className="w-4 h-4" />
            </div>
            <div>
              <div className={cn("font-mono font-bold text-base", s.color)}>{loading ? <Skeleton className="h-5 w-12" /> : s.value}</div>
              <div className="font-mono text-[9px] text-muted-foreground">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Vault Type Tabs */}
      <div className="flex gap-1 bg-muted/20 rounded-lg p-1 w-fit">
        {([
          { id: "entity" as VaultTab, label: "Entity", icon: Database },
          { id: "local"  as VaultTab, label: "Local",  icon: Smartphone },
        ] as const).map(t => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setVaultTab(t.id)}
              className={cn("flex items-center gap-1.5 px-4 py-2 text-xs font-mono rounded transition-all",
                vaultTab === t.id ? "bg-amber-500/20 text-amber-400" : "text-muted-foreground hover:text-foreground")}>
              <Icon className="w-3.5 h-3.5" />
              {t.label} Accounts
            </button>
          );
        })}
      </div>

      {/* View Mode: Sell listings vs Buy orders */}
      <div className="flex gap-1.5">
        {([
          { id: "sell" as ViewMode, label: "For Sale" },
          { id: "buy"  as ViewMode, label: "Buy Requests" },
        ] as const).map(m => (
          <button key={m.id} onClick={() => setViewMode(m.id)}
            className={cn("px-3 py-1.5 text-[10px] font-mono rounded-full border transition-all",
              viewMode === m.id ? "bg-amber-500/15 text-amber-400 border-amber-400/30" : "border-border/40 text-muted-foreground hover:border-border")}>
            {m.label}
          </button>
        ))}
      </div>

      {/* Category Filters */}
      <div className="flex gap-1.5 flex-wrap">
        <button onClick={() => setCatFilter("all")}
          className={cn("px-2.5 py-1 rounded text-[10px] font-mono uppercase tracking-wider border transition-all",
            catFilter === "all" ? "bg-amber-500/15 text-amber-400 border-amber-400/30" : "text-muted-foreground border-border/30 hover:border-border")}>
          All
        </button>
        {ACCOUNT_CATEGORIES.map(cat => {
          const Icon = cat.icon;
          return (
            <button key={cat.id} onClick={() => setCatFilter(cat.id)}
              className={cn("flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-mono uppercase tracking-wider border transition-all",
                catFilter === cat.id ? `${cat.bg} ${cat.border} ${cat.color}` : "text-muted-foreground border-border/30 hover:border-border")}>
              <Icon className="w-3 h-3" /> {cat.label}
            </button>
          );
        })}
      </div>

      {/* Listings */}
      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}</div>
      ) : listings.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground/40 font-mono text-sm bg-card border border-border/30 rounded-xl">
          <Vault className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p>No {viewMode === "sell" ? "listings" : "buy requests"} found</p>
          <Button size="sm" className="mt-4 font-mono text-xs gap-1.5 bg-amber-600 hover:bg-amber-700 text-white border-0"
            onClick={() => viewMode === "sell" ? setShowSellOrder(true) : setShowBuyOrder(true)}>
            <Plus className="w-3.5 h-3.5" /> Create {viewMode === "sell" ? "Sell" : "Buy"} Order
          </Button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {listings.map(l => {
            const catDef = ACCOUNT_CATEGORIES.find(c => c.id === l.account_type);
            const CatIcon = catDef?.icon ?? Shield;
            const isMine = l.seller_id === user?.id;
            const isBuyOrder = l.order_type === "buy";
            const details: Record<string, any> = l.account_details ?? {};
            return (
              <div key={l.id} className={cn(
                "bg-card border rounded-xl overflow-hidden transition-all",
                isMine ? "border-amber-400/20" : "border-card-border hover:border-amber-400/30"
              )}>
                <div className="bg-gradient-to-r from-amber-500/5 to-transparent border-b border-border/30 px-4 py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CatIcon className={cn("w-3.5 h-3.5", catDef?.color ?? "text-muted-foreground")} />
                    <span className="font-mono text-xs text-muted-foreground/70">#{l.id}</span>
                    {catDef && <Badge variant="outline" className={cn("font-mono text-[8px] uppercase", catDef.color, catDef.border)}>{catDef.label}</Badge>}
                    {isBuyOrder && <Badge variant="outline" className="font-mono text-[8px] border-emerald-400/30 text-emerald-400">BUY REQUEST</Badge>}
                    {isMine && <Badge variant="outline" className="font-mono text-[8px] border-amber-400/30 text-amber-400">MINE</Badge>}
                  </div>
                  <div className="font-mono font-bold text-sm text-primary">
                    {isBuyOrder && l.price_min && l.price_max
                      ? `${l.price_min}–${l.price_max} AZN`
                      : `${Number(l.price).toLocaleString()} AZN`}
                  </div>
                </div>
                <div className="p-4 space-y-2">
                  <h3 className="font-mono font-bold text-sm">{l.title}</h3>
                  {/* Account details */}
                  {Object.keys(details).length > 0 && (
                    <div className="grid grid-cols-2 gap-1.5">
                      {Object.entries(details).map(([k, v]) => (
                        <div key={k} className="bg-muted/20 rounded px-2 py-1 font-mono text-[9px]">
                          <div className="text-muted-foreground/60 uppercase tracking-wider mb-0.5">{k.replace(/_/g, " ")}</div>
                          <div className="text-foreground font-bold">{String(v)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  {l.description && <p className="font-mono text-[11px] text-muted-foreground/60 line-clamp-2">{l.description}</p>}
                  <div className="flex items-center justify-between pt-1">
                    <div className="text-[9px] font-mono text-muted-foreground/40">
                      {isBuyOrder ? "Requested" : "Listed"} by {l.seller_username} · {new Date(l.created_at).toLocaleDateString()}
                    </div>
                    {isMine ? (
                      <Button size="sm" variant="outline" onClick={() => handleCancel(l.id)}
                        className="font-mono text-[9px] h-6 border-red-500/20 text-red-400 hover:bg-red-500/10">
                        <X className="w-2.5 h-2.5 mr-1" /> Remove
                      </Button>
                    ) : isBuyOrder ? (
                      <Button size="sm" className="font-mono text-[9px] h-7 bg-emerald-600 hover:bg-emerald-700 text-white border-0 gap-1">
                        <Lock className="w-3 h-3" /> Fulfill Request
                      </Button>
                    ) : (
                      <Button size="sm" onClick={() => handleBuy(l.id)} disabled={buying === l.id}
                        className="font-mono text-[9px] h-7 bg-amber-600 hover:bg-amber-700 text-white border-0 gap-1">
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
