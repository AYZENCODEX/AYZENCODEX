import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Store, CheckCircle2, XCircle, Clock, RefreshCw, Loader2,
  DollarSign, Tag, Coins, Shield, Smartphone, Gem, Package,
  Settings, TrendingUp, Users, ShoppingCart, Filter,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

interface Order {
  id: number;
  listing_id: number;
  title: string;
  listing_type: string;
  metadata?: any;
  buyer_id: number;
  seller_id: number;
  buyer_username: string;
  seller_username: string;
  price_azn: number;
  fee_pct: number;
  fee_azn?: number;
  seller_receives?: number;
  status: string;
  message?: string;
  admin_note?: string;
  created_at: string;
  resolved_at?: string;
}

interface Listing {
  id: number;
  seller_id: number;
  seller_username: string;
  listing_type: string;
  title: string;
  description?: string;
  price_azn: number;
  status: string;
  created_at: string;
}

const TYPE_ICON: Record<string, React.ElementType> = {
  entity: Shield, local_account: Smartphone, nft: Gem, azn: Coins,
};

function TypeBadge({ type }: { type: string }) {
  const Icon = TYPE_ICON[type] ?? Package;
  return (
    <Badge variant="outline" className="font-mono text-[10px] gap-1 text-cyan-400 border-cyan-400/30">
      <Icon className="w-3 h-3" /> {type.replace("_", " ")}
    </Badge>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { label: string; cls: string }> = {
    pending:   { label: "Pending",   cls: "text-amber-400 border-amber-400/30" },
    approved:  { label: "Approved",  cls: "text-emerald-400 border-emerald-400/30" },
    rejected:  { label: "Rejected",  cls: "text-red-400 border-red-400/30" },
    active:    { label: "Active",    cls: "text-cyan-400 border-cyan-400/30" },
    sold:      { label: "Sold",      cls: "text-muted-foreground border-border" },
    cancelled: { label: "Cancelled", cls: "text-muted-foreground border-border" },
  };
  const s = cfg[status] ?? { label: status, cls: "text-muted-foreground" };
  return <Badge variant="outline" className={cn("font-mono text-[10px]", s.cls)}>{s.label}</Badge>;
}

// ─── Order Action Modal ───────────────────────────────────────────────────────
function OrderActionModal({ order, action, onClose, onDone }: {
  order: Order; action: "approve" | "reject"; onClose: () => void; onDone: () => void;
}) {
  const { token } = useAuth() as any;
  const { toast } = useToast();
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  const feePct = order.fee_pct ?? 5;
  const feeAzn = (order.price_azn * feePct) / 100;
  const sellerReceives = order.price_azn - feeAzn;

  const submit = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${BASE}/api/admin/marketplace/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action, admin_note: note }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      toast({ title: `Order ${action === "approve" ? "approved" : "rejected"}!` });
      onClose(); onDone();
    } catch (e: any) { toast({ title: e.message, variant: "destructive" }); }
    setLoading(false);
  };

  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm bg-card border border-border font-mono">
        <DialogHeader>
          <DialogTitle className={cn("font-mono text-sm flex items-center gap-2", action === "approve" ? "text-emerald-400" : "text-red-400")}>
            {action === "approve" ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
            {action === "approve" ? "Approve Order" : "Reject Order"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="bg-muted/30 rounded-lg p-3 border border-border/40 space-y-1.5 text-xs">
            <div className="flex justify-between"><span className="text-muted-foreground">Item</span><span className="font-bold truncate max-w-[60%]">{order.title}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Buyer</span><span>{order.buyer_username}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Seller</span><span>{order.seller_username}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Price</span><span className="text-primary font-bold">{order.price_azn} AZN</span></div>
            {action === "approve" && (
              <>
                <div className="flex justify-between text-amber-400"><span>Platform fee ({feePct}%)</span><span>{feeAzn.toFixed(2)} AZN</span></div>
                <div className="flex justify-between text-emerald-400"><span>Seller receives</span><span className="font-bold">{sellerReceives.toFixed(2)} AZN</span></div>
              </>
            )}
            {action === "reject" && (
              <div className="flex justify-between text-cyan-400"><span>Buyer refund</span><span className="font-bold">{order.price_azn} AZN</span></div>
            )}
          </div>
          {order.message && (
            <div className="bg-muted/20 rounded-lg p-2 text-xs">
              <span className="text-muted-foreground">Buyer note: </span>
              <span>{order.message}</span>
            </div>
          )}
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-widest block mb-1">Admin Note (shown to user)</label>
            <Input value={note} onChange={e => setNote(e.target.value)} placeholder="Reason or comment..." className="font-mono text-xs h-8" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose} className="text-xs">Cancel</Button>
          <Button size="sm" onClick={submit} disabled={loading}
            className={cn("text-xs gap-1", action === "approve" ? "bg-emerald-600 hover:bg-emerald-500" : "bg-red-600 hover:bg-red-500")}>
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : action === "approve" ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
            {action === "approve" ? "Approve & Transfer" : "Reject & Refund"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Settings Panel ───────────────────────────────────────────────────────────
function SettingsPanel({ token }: { token: string }) {
  const { toast } = useToast();
  const [feePct, setFeePct] = useState("5");
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`${BASE}/api/marketplace/settings`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { setFeePct(String(d.fee_pct ?? 5)); setEnabled(d.enabled ?? true); })
      .catch(() => {});
  }, [token]);

  const save = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${BASE}/api/marketplace/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ fee_pct: Number(feePct), enabled }),
      });
      if (!r.ok) throw new Error("Failed");
      toast({ title: "Settings saved" });
    } catch (e: any) { toast({ title: e.message, variant: "destructive" }); }
    setLoading(false);
  };

  return (
    <div className="bg-card border border-border/40 rounded-xl p-5 space-y-4 max-w-sm">
      <h3 className="font-mono text-sm font-bold text-foreground flex items-center gap-2">
        <Settings className="w-4 h-4 text-primary" /> Marketplace Settings
      </h3>
      <div>
        <label className="text-[10px] text-muted-foreground uppercase tracking-widest block mb-1">Platform Fee (%)</label>
        <Input value={feePct} onChange={e => setFeePct(e.target.value)} type="number" min="0" max="50" step="0.5" className="font-mono text-xs h-8 w-32" />
        <p className="text-[10px] text-muted-foreground/50 mt-1">Deducted from seller on each approved trade.</p>
      </div>
      <div className="flex items-center gap-3">
        <button onClick={() => setEnabled(e => !e)}
          className={cn("w-9 h-5 rounded-full transition-colors relative", enabled ? "bg-primary" : "bg-muted")}>
          <span className={cn("absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all", enabled ? "right-0.5" : "left-0.5")} />
        </button>
        <span className="text-xs font-mono text-muted-foreground">Marketplace {enabled ? "enabled" : "disabled"}</span>
      </div>
      <Button size="sm" onClick={save} disabled={loading} className="text-xs gap-1">
        {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />} Save Settings
      </Button>
    </div>
  );
}

// ─── Main Admin Marketplace ────────────────────────────────────────────────────
export default function AdminMarketplace() {
  const { token } = useAuth() as any;
  const [tab, setTab] = useState<"orders" | "listings" | "settings">("orders");
  const [orders, setOrders] = useState<Order[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [actionModal, setActionModal] = useState<{ order: Order; action: "approve" | "reject" } | null>(null);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const q = statusFilter ? `?status=${statusFilter}` : "";
      const r = await fetch(`${BASE}/api/admin/marketplace/orders${q}`, { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) { const d = await r.json(); setOrders(d.orders ?? []); }
    } catch { } finally { setLoading(false); }
  }, [token, statusFilter]);

  const loadListings = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${BASE}/api/admin/marketplace/listings`, { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) setListings(await r.json());
    } catch { } finally { setLoading(false); }
  }, [token]);

  const loadStats = useCallback(async () => {
    try {
      const r = await fetch(`${BASE}/api/marketplace/stats`, { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) setStats(await r.json());
    } catch { }
  }, [token]);

  useEffect(() => {
    loadStats();
    if (tab === "orders") loadOrders();
    else if (tab === "listings") loadListings();
  }, [tab, loadOrders, loadListings, loadStats]);

  useEffect(() => { if (tab === "orders") loadOrders(); }, [statusFilter, loadOrders, tab]);

  const TABS = [
    { id: "orders",   label: "Orders",   icon: ShoppingCart },
    { id: "listings", label: "Listings", icon: Tag },
    { id: "settings", label: "Settings", icon: Settings },
  ] as const;

  const pendingCount = orders.filter(o => o.status === "pending").length;

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-mono font-bold text-xl text-foreground flex items-center gap-2">
            <Store className="w-5 h-5 text-primary" /> P2P Marketplace Admin
          </h1>
          <p className="text-xs text-muted-foreground font-mono mt-1">Approve trades, manage listings, configure fees</p>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Active Listings",   val: stats.active_listings,    icon: Tag,          color: "text-cyan-400" },
            { label: "Completed Trades",  val: stats.completed_trades,   icon: CheckCircle2, color: "text-emerald-400" },
            { label: "Total Volume",      val: `${Number(stats.total_volume_azn ?? 0).toFixed(0)} AZN`, icon: Coins, color: "text-amber-400" },
            { label: "Fees Collected",    val: `${Number(stats.total_fees_azn ?? 0).toFixed(0)} AZN`,  icon: DollarSign, color: "text-violet-400" },
          ].map(s => (
            <div key={s.label} className="bg-card/60 border border-border/40 rounded-xl p-3 flex items-center gap-3">
              <s.icon className={cn("w-4 h-4 flex-shrink-0", s.color)} />
              <div>
                <div className={cn("text-sm font-mono font-bold", s.color)}>{s.val}</div>
                <div className="text-[9px] text-muted-foreground/50 font-mono">{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-muted/30 rounded-lg p-1">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={cn("flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-mono font-bold transition-all relative flex-1 justify-center",
                tab === t.id ? "bg-card text-primary shadow-sm border border-primary/20" : "text-muted-foreground hover:text-foreground")}>
              <Icon className="w-3.5 h-3.5" /> {t.label}
              {t.id === "orders" && pendingCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 text-white rounded-full text-[9px] font-bold flex items-center justify-center">
                  {pendingCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Orders Tab */}
      {tab === "orders" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {["all", "pending", "approved", "rejected"].map(s => (
              <button key={s} onClick={() => setStatusFilter(s === "all" ? "" : s)}
                className={cn("px-3 py-1.5 rounded-lg border text-xs font-mono font-bold transition-all capitalize",
                  (s === "all" ? !statusFilter : statusFilter === s)
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border/40 text-muted-foreground hover:border-primary/20")}>
                {s}
              </button>
            ))}
            <Button variant="ghost" size="sm" onClick={loadOrders} className="h-8 text-xs gap-1 ml-auto">
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary/30" /></div>
          ) : orders.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingCart className="w-8 h-8 text-muted-foreground/20 mx-auto mb-3" />
              <p className="font-mono text-sm text-muted-foreground/40">No orders found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map(o => (
                <div key={o.id} className={cn(
                  "bg-card/60 border rounded-xl p-4 transition-all",
                  o.status === "pending" ? "border-amber-500/30 bg-amber-500/3" : "border-border/40"
                )}>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-bold text-foreground">{o.title}</span>
                        <TypeBadge type={o.listing_type} />
                        <StatusBadge status={o.status} />
                      </div>
                      <div className="text-xs font-mono text-muted-foreground/60 flex flex-wrap gap-3">
                        <span>Buyer: <span className="text-foreground">{o.buyer_username}</span></span>
                        <span>Seller: <span className="text-foreground">{o.seller_username}</span></span>
                        <span>{new Date(o.created_at).toLocaleDateString()}</span>
                      </div>
                      {o.message && (
                        <div className="text-[11px] font-mono text-muted-foreground italic">&quot;{o.message}&quot;</div>
                      )}
                      {o.admin_note && (
                        <div className="text-[11px] font-mono text-amber-400">Admin: {o.admin_note}</div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      <div className="font-mono text-lg font-bold text-primary">{o.price_azn} AZN</div>
                      <div className="text-[10px] text-muted-foreground/50 font-mono">${(o.price_azn / 100).toFixed(2)} USD</div>
                      {o.status === "pending" && (
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => setActionModal({ order: o, action: "approve" })}
                            className="h-7 text-xs gap-1 bg-emerald-600 hover:bg-emerald-500">
                            <CheckCircle2 className="w-3 h-3" /> Approve
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => setActionModal({ order: o, action: "reject" })}
                            className="h-7 text-xs gap-1">
                            <XCircle className="w-3 h-3" /> Reject
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Listings Tab */}
      {tab === "listings" && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" onClick={loadListings} className="h-8 text-xs gap-1">
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </Button>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary/30" /></div>
          ) : listings.length === 0 ? (
            <div className="text-center py-12">
              <Tag className="w-8 h-8 text-muted-foreground/20 mx-auto mb-3" />
              <p className="font-mono text-sm text-muted-foreground/40">No listings yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {listings.map(l => (
                <div key={l.id} className="flex items-center gap-3 bg-card/60 border border-border/40 rounded-xl p-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="font-mono text-sm font-bold text-foreground">{l.title}</span>
                      <TypeBadge type={l.listing_type} />
                      <StatusBadge status={l.status} />
                    </div>
                    <div className="text-[10px] font-mono text-muted-foreground/60">
                      Seller: {l.seller_username} · {new Date(l.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="font-mono font-bold text-primary">{l.price_azn} AZN</div>
                    <div className="text-[10px] text-muted-foreground/50">${(l.price_azn / 100).toFixed(2)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Settings Tab */}
      {tab === "settings" && <SettingsPanel token={token ?? ""} />}

      {/* Action Modal */}
      {actionModal && (
        <OrderActionModal
          order={actionModal.order}
          action={actionModal.action}
          onClose={() => setActionModal(null)}
          onDone={() => { setActionModal(null); loadOrders(); loadStats(); }}
        />
      )}
    </div>
  );
}
