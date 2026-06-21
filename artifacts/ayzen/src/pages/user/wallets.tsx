import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Wallet, Plus, Trash2, RefreshCw, Star, Copy, Check,
  ChevronDown, ChevronUp, ExternalLink, Shield, AlertCircle, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

interface WalletEntry {
  id: number;
  userId: number;
  label: string;
  address: string;
  chain: string;
  chainId: number | null;
  balance: number;
  balanceUsd: number;
  tokenCount: number;
  nftCount: number;
  txCount: number;
  isPrimary: boolean;
  lastSyncedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

const CHAINS = [
  { value: "ETH",    label: "Ethereum",       color: "#627EEA", prefix: "0x" },
  { value: "BSC",    label: "BNB Chain",      color: "#F3BA2F", prefix: "0x" },
  { value: "MATIC",  label: "Polygon",        color: "#8247E5", prefix: "0x" },
  { value: "ARB",    label: "Arbitrum",       color: "#28A0F0", prefix: "0x" },
  { value: "OP",     label: "Optimism",       color: "#FF0420", prefix: "0x" },
  { value: "BASE",   label: "Base",           color: "#0052FF", prefix: "0x" },
  { value: "AVAX",   label: "Avalanche",      color: "#E84142", prefix: "0x" },
  { value: "SOL",    label: "Solana",         color: "#9945FF", prefix: "" },
  { value: "BTC",    label: "Bitcoin",        color: "#F7931A", prefix: "" },
  { value: "TRX",    label: "TRON",           color: "#EF0027", prefix: "T" },
  { value: "LINEA",  label: "Linea",          color: "#61DFFF", prefix: "0x" },
  { value: "ZKSYNC", label: "zkSync Era",     color: "#8C8DFC", prefix: "0x" },
  { value: "SCROLL", label: "Scroll",         color: "#FFCF70", prefix: "0x" },
  { value: "FTM",    label: "Fantom",         color: "#13B5EC", prefix: "0x" },
];

function chainInfo(chain: string) {
  return CHAINS.find(c => c.value === chain) ?? { value: chain, label: chain, color: "#888", prefix: "" };
}

function shortenAddr(addr: string) {
  if (addr.length <= 12) return addr;
  return addr.slice(0, 6) + "…" + addr.slice(-4);
}

function explorerUrl(address: string, chain: string): string {
  const map: Record<string, string> = {
    ETH:    `https://etherscan.io/address/${address}`,
    BSC:    `https://bscscan.com/address/${address}`,
    MATIC:  `https://polygonscan.com/address/${address}`,
    ARB:    `https://arbiscan.io/address/${address}`,
    OP:     `https://optimistic.etherscan.io/address/${address}`,
    BASE:   `https://basescan.org/address/${address}`,
    AVAX:   `https://snowtrace.io/address/${address}`,
    SOL:    `https://solscan.io/account/${address}`,
    BTC:    `https://mempool.space/address/${address}`,
    TRX:    `https://tronscan.org/#/address/${address}`,
    LINEA:  `https://lineascan.build/address/${address}`,
    ZKSYNC: `https://explorer.zksync.io/address/${address}`,
    SCROLL: `https://scrollscan.com/address/${address}`,
    FTM:    `https://ftmscan.com/address/${address}`,
  };
  return map[chain] ?? `https://etherscan.io/address/${address}`;
}

export default function UserWallets() {
  const { token } = useAuth();
  const { toast } = useToast();

  const [wallets, setWallets] = useState<WalletEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const [form, setForm] = useState({ address: "", chain: "ETH", label: "", notes: "" });
  const [adding, setAdding] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  const fetchWallets = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${BASE}/api/wallets`, { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) setWallets(await r.json());
    } catch { }
    setLoading(false);
  }, [token]);

  useEffect(() => { fetchWallets(); }, [fetchWallets]);

  const copyAddr = (id: number, addr: string) => {
    navigator.clipboard.writeText(addr).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const handleAdd = async () => {
    if (!form.address.trim()) { toast({ variant: "destructive", title: "Enter a wallet address" }); return; }
    setAdding(true);
    try {
      const r = await fetch(`${BASE}/api/wallets`, {
        method: "POST", headers,
        body: JSON.stringify({ address: form.address.trim(), chain: form.chain, label: form.label.trim() || undefined, notes: form.notes.trim() || undefined }),
      });
      const data = await r.json();
      if (r.ok) {
        toast({ title: "✅ Wallet added", description: `${form.chain} · ${shortenAddr(form.address)}` });
        setForm({ address: "", chain: "ETH", label: "", notes: "" });
        setShowAdd(false);
        await fetchWallets();
      } else {
        toast({ variant: "destructive", title: data.error ?? "Failed to add wallet" });
      }
    } catch { toast({ variant: "destructive", title: "Connection error" }); }
    setAdding(false);
  };

  const handleSync = async (id: number) => {
    setSyncing(id);
    try {
      const r = await fetch(`${BASE}/api/wallets/${id}/sync`, { method: "POST", headers });
      if (r.ok) {
        const updated = await r.json();
        setWallets(ws => ws.map(w => w.id === id ? updated : w));
        toast({ title: "Wallet synced" });
      } else {
        toast({ variant: "destructive", title: "Sync failed" });
      }
    } catch { toast({ variant: "destructive", title: "Connection error" }); }
    setSyncing(null);
  };

  const handleSetPrimary = async (id: number) => {
    try {
      const r = await fetch(`${BASE}/api/wallets/${id}`, {
        method: "PATCH", headers, body: JSON.stringify({ isPrimary: true }),
      });
      if (r.ok) { await fetchWallets(); toast({ title: "Primary wallet updated" }); }
    } catch { }
  };

  const handleDelete = async (id: number) => {
    setDeleting(id);
    try {
      const r = await fetch(`${BASE}/api/wallets/${id}`, { method: "DELETE", headers });
      if (r.ok) {
        setWallets(ws => ws.filter(w => w.id !== id));
        toast({ title: "Wallet removed" });
      } else {
        toast({ variant: "destructive", title: "Failed to remove" });
      }
    } catch { }
    setDeleting(null);
  };

  const totalUsd = wallets.reduce((s, w) => s + (w.balanceUsd ?? 0), 0);
  const chains = [...new Set(wallets.map(w => w.chain))];

  return (
    <div className="max-w-3xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-mono tracking-tighter uppercase flex items-center gap-2">
            <Wallet className="w-6 h-6 text-primary" /> My Wallets
          </h1>
          <p className="text-muted-foreground font-mono text-xs mt-1">
            {wallets.length} wallet{wallets.length !== 1 ? "s" : ""} · {chains.length} chain{chains.length !== 1 ? "s" : ""}
            {totalUsd > 0 && <> · <span className="text-primary">${totalUsd.toFixed(2)} USD</span></>}
          </p>
        </div>
        <Button onClick={() => setShowAdd(s => !s)} className="font-mono text-xs gap-2">
          <Plus className="w-4 h-4" />
          Add Wallet
        </Button>
      </div>

      {/* Stats row */}
      {wallets.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Total Wallets", value: wallets.length.toString() },
            { label: "Total USD", value: `$${totalUsd.toFixed(2)}` },
            { label: "Chains", value: chains.join(", ") || "—" },
          ].map(({ label, value }) => (
            <div key={label} className="bg-card border border-card-border rounded-lg px-4 py-3">
              <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-1">{label}</div>
              <div className="font-mono font-bold text-sm text-primary truncate">{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Add Wallet Panel */}
      {showAdd && (
        <div className="bg-card border border-primary/20 rounded-lg overflow-hidden">
          <div className="bg-primary/5 border-b border-primary/15 px-5 py-4 flex items-center justify-between">
            <div className="font-mono font-bold text-sm text-primary">+ New Wallet</div>
            <button onClick={() => setShowAdd(false)} className="text-muted-foreground hover:text-foreground text-xs font-mono">✕ Cancel</button>
          </div>
          <div className="px-5 py-5 space-y-4">
            <div className="space-y-1.5">
              <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Network / Chain</label>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
                {CHAINS.map(c => (
                  <button
                    key={c.value}
                    onClick={() => setForm(f => ({ ...f, chain: c.value }))}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-md border px-2 py-2 transition-all font-mono text-[9px] uppercase tracking-wider",
                      form.chain === c.value
                        ? "border-primary/50 bg-primary/10 text-primary"
                        : "border-border bg-muted/20 text-muted-foreground hover:border-primary/20 hover:bg-primary/5"
                    )}
                  >
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: c.color }} />
                    {c.value}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  Wallet Address <span className="text-red-400">*</span>
                </label>
                <Input
                  value={form.address}
                  onChange={e => setForm(f => ({ ...f, address: e.target.value.trim() }))}
                  placeholder={chainInfo(form.chain).prefix + "address..."}
                  className="font-mono text-xs h-10 bg-input border-border focus-visible:ring-primary/50"
                  onKeyDown={e => e.key === "Enter" && handleAdd()}
                />
              </div>
              <div className="space-y-1.5">
                <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Label (optional)</label>
                <Input
                  value={form.label}
                  onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                  placeholder={`My ${chainInfo(form.chain).label} Wallet`}
                  className="font-mono text-xs h-10 bg-input border-border focus-visible:ring-primary/50"
                  onKeyDown={e => e.key === "Enter" && handleAdd()}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Notes (optional)</label>
              <Input
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="e.g. Main farming wallet, Hardware wallet..."
                className="font-mono text-xs h-10 bg-input border-border focus-visible:ring-primary/50"
              />
            </div>

            <Button onClick={handleAdd} disabled={adding || !form.address.trim()} className="font-mono text-xs gap-2">
              {adding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              {adding ? "Adding..." : "Add Wallet"}
            </Button>
          </div>
        </div>
      )}

      {/* Wallet List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-card border border-card-border rounded-lg h-20 animate-pulse" />
          ))}
        </div>
      ) : wallets.length === 0 ? (
        <div className="bg-card border border-card-border rounded-lg px-6 py-12 text-center">
          <Wallet className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="font-mono text-sm text-muted-foreground">No wallets added yet</p>
          <p className="font-mono text-xs text-muted-foreground/50 mt-1">Click "Add Wallet" to track your on-chain activity</p>
          <Button onClick={() => setShowAdd(true)} className="font-mono text-xs gap-2 mt-5">
            <Plus className="w-3.5 h-3.5" /> Add Your First Wallet
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {wallets.map(wallet => {
            const info = chainInfo(wallet.chain);
            const isExpanded = expandedId === wallet.id;
            const isSyncing = syncing === wallet.id;
            const isDeleting = deleting === wallet.id;
            const copied = copiedId === wallet.id;

            return (
              <div key={wallet.id} className={cn(
                "bg-card border rounded-lg overflow-hidden transition-all",
                wallet.isPrimary ? "border-primary/30" : "border-card-border"
              )}>
                <div className="px-4 py-4">
                  <div className="flex items-center gap-3">
                    {/* Chain dot */}
                    <div className="w-9 h-9 rounded-lg border flex items-center justify-center flex-shrink-0"
                      style={{ borderColor: info.color + "40", background: info.color + "15" }}>
                      <div className="w-3 h-3 rounded-full" style={{ background: info.color }} />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-sm text-foreground">{wallet.label}</span>
                        <Badge variant="outline" className="font-mono text-[9px] uppercase px-1.5 py-0" style={{ color: info.color, borderColor: info.color + "40" }}>
                          {info.label}
                        </Badge>
                        {wallet.isPrimary && (
                          <Badge className="font-mono text-[9px] uppercase px-1.5 py-0 bg-primary/10 text-primary border-primary/20">
                            ★ Primary
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="font-mono text-xs text-muted-foreground">{shortenAddr(wallet.address)}</span>
                        <button onClick={() => copyAddr(wallet.id, wallet.address)} className="text-muted-foreground hover:text-primary transition-colors">
                          {copied ? <Check className="w-3 h-3 text-primary" /> : <Copy className="w-3 h-3" />}
                        </button>
                        <a href={explorerUrl(wallet.address, wallet.chain)} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors">
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>

                    {/* Balance */}
                    <div className="text-right flex-shrink-0">
                      {wallet.balanceUsd > 0 ? (
                        <>
                          <div className="font-mono font-bold text-sm text-primary">${wallet.balanceUsd.toFixed(2)}</div>
                          <div className="font-mono text-[10px] text-muted-foreground">{wallet.balance.toFixed(4)} {wallet.chain}</div>
                        </>
                      ) : (
                        <div className="font-mono text-[10px] text-muted-foreground/50">Not synced</div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => handleSync(wallet.id)}
                        disabled={isSyncing}
                        className="w-7 h-7 rounded-md border border-border text-muted-foreground hover:text-primary hover:border-primary/30 flex items-center justify-center transition-all"
                        title="Sync balance"
                      >
                        <RefreshCw className={cn("w-3.5 h-3.5", isSyncing && "animate-spin")} />
                      </button>
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : wallet.id)}
                        className="w-7 h-7 rounded-md border border-border text-muted-foreground hover:text-foreground hover:border-border/80 flex items-center justify-center transition-all"
                      >
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="border-t border-card-border bg-muted/10 px-4 py-4 space-y-4">
                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { label: "Balance", value: wallet.balance > 0 ? `${wallet.balance.toFixed(6)} ${wallet.chain}` : "—" },
                        { label: "USD Value", value: wallet.balanceUsd > 0 ? `$${wallet.balanceUsd.toFixed(2)}` : "—" },
                        { label: "Transactions", value: wallet.txCount > 0 ? wallet.txCount.toLocaleString() : "—" },
                      ].map(({ label, value }) => (
                        <div key={label} className="bg-background border border-card-border rounded-md px-3 py-2">
                          <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground mb-0.5">{label}</div>
                          <div className="font-mono text-xs font-bold text-foreground">{value}</div>
                        </div>
                      ))}
                    </div>

                    {/* Full address */}
                    <div className="bg-background border border-card-border rounded-md px-3 py-2">
                      <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground mb-1">Full Address</div>
                      <div className="font-mono text-[11px] text-foreground break-all">{wallet.address}</div>
                    </div>

                    {wallet.notes && (
                      <div className="bg-background border border-card-border rounded-md px-3 py-2">
                        <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground mb-1">Notes</div>
                        <div className="font-mono text-[11px] text-foreground">{wallet.notes}</div>
                      </div>
                    )}

                    {wallet.lastSyncedAt && (
                      <p className="text-[9px] font-mono text-muted-foreground/40">
                        Last synced: {new Date(wallet.lastSyncedAt).toLocaleString()}
                      </p>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2 flex-wrap">
                      {!wallet.isPrimary && (
                        <Button variant="outline" size="sm" onClick={() => handleSetPrimary(wallet.id)} className="font-mono text-[10px] gap-1.5 h-7 px-3 border-primary/20 text-primary hover:bg-primary/10">
                          <Star className="w-3 h-3" /> Set Primary
                        </Button>
                      )}
                      <Button variant="outline" size="sm" onClick={() => handleSync(wallet.id)} disabled={isSyncing} className="font-mono text-[10px] gap-1.5 h-7 px-3">
                        <RefreshCw className={cn("w-3 h-3", isSyncing && "animate-spin")} />
                        {isSyncing ? "Syncing..." : "Sync Now"}
                      </Button>
                      <a href={explorerUrl(wallet.address, wallet.chain)} target="_blank" rel="noopener noreferrer">
                        <Button variant="outline" size="sm" className="font-mono text-[10px] gap-1.5 h-7 px-3">
                          <ExternalLink className="w-3 h-3" /> Explorer
                        </Button>
                      </a>
                      <Button
                        variant="outline" size="sm"
                        onClick={() => handleDelete(wallet.id)}
                        disabled={isDeleting}
                        className="font-mono text-[10px] gap-1.5 h-7 px-3 border-red-500/20 text-red-400 hover:bg-red-500/10 ml-auto"
                      >
                        {isDeleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                        {isDeleting ? "Removing..." : "Remove"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Security note */}
      {wallets.length > 0 && (
        <div className="flex items-start gap-2 text-[10px] font-mono text-muted-foreground/40">
          <Shield className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>Only public addresses are stored. No private keys or seed phrases are ever requested.</span>
        </div>
      )}
    </div>
  );
}
