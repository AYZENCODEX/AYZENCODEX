import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Coins, ArrowRightLeft, Crown, Zap, Check, Loader2, Copy,
  RefreshCw, Clock, AlertCircle, Shield, ExternalLink, X,
  ChevronDown, ChevronUp, Sparkles, Star, Gift,
} from "lucide-react";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

interface CreditsData {
  credits: {
    balance: number;
    aznBalance: number;
    totalPurchased: number;
    totalSpent: number;
  };
  transactions: Array<{
    id: number;
    type: string;
    method: string | null;
    credits: number;
    aznAmount: number;
    amountBDT: number | null;
    amountUSDT: number | null;
    referenceId: string | null;
    status: string;
    notes: string | null;
    createdAt: string;
  }>;
  packages: Array<{
    id: string;
    label: string;
    credits: number;
    priceBDT: number;
    priceUSDT: number;
    bonus: number;
  }>;
  rates: { creditsPerAzn: number; aznForPro: number; aznForEnterprise: number };
  paymentInfo: { bkash: string; nagad: string; usdt: string; usdtNetwork: string };
}

const METHOD_ICONS: Record<string, string> = { bkash: "💳", nagad: "📱", binance_usdt: "₮" };
const METHOD_LABELS: Record<string, string> = { bkash: "bKash", nagad: "Naggad", binance_usdt: "Binance USDT" };
const STATUS_COLORS: Record<string, string> = {
  pending: "text-amber-400 border-amber-400/30 bg-amber-400/10",
  approved: "text-emerald-400 border-emerald-400/30 bg-emerald-400/10",
  rejected: "text-red-400 border-red-400/30 bg-red-400/10",
};

export default function CreditsPage() {
  const { token } = useAuth();
  const { toast } = useToast();
  const [data, setData] = useState<CreditsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"buy" | "swap" | "history">("buy");

  const [selectedPkg, setSelectedPkg] = useState<string | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<string>("bkash");
  const [refId, setRefId] = useState("");
  const [senderNum, setSenderNum] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [swapAmount, setSwapAmount] = useState("");
  const [swapping, setSwapping] = useState(false);

  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${BASE}/api/credits`, { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) setData(await r.json());
    } catch { }
    setLoading(false);
  }, [token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const copyText = (key: string, text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    });
  };

  const handlePurchase = async () => {
    if (!selectedPkg) { toast({ variant: "destructive", title: "Select a package" }); return; }
    if (!refId.trim()) { toast({ variant: "destructive", title: "Enter your transaction ID" }); return; }
    setSubmitting(true);
    try {
      const r = await fetch(`${BASE}/api/credits/purchase`, {
        method: "POST", headers,
        body: JSON.stringify({ packageId: selectedPkg, method: selectedMethod, referenceId: refId.trim(), senderNumber: senderNum.trim() || undefined }),
      });
      const d = await r.json();
      if (r.ok) {
        setSubmitted(true);
        toast({ title: "✅ Payment submitted!", description: "Credits will be added after admin approval." });
        await fetchData();
      } else {
        toast({ variant: "destructive", title: d.error ?? "Failed to submit" });
      }
    } catch { toast({ variant: "destructive", title: "Connection error" }); }
    setSubmitting(false);
  };

  const handleSwap = async () => {
    const n = parseInt(swapAmount, 10);
    if (!n || n < (data?.rates.creditsPerAzn ?? 100)) {
      toast({ variant: "destructive", title: `Minimum ${data?.rates.creditsPerAzn ?? 100} credits` }); return;
    }
    setSwapping(true);
    try {
      const r = await fetch(`${BASE}/api/credits/swap`, { method: "POST", headers, body: JSON.stringify({ credits: n }) });
      const d = await r.json();
      if (r.ok) {
        toast({ title: `⚡ Swapped! Got ${d.aznReceived} AZN`, description: `New AZN Balance: ${d.newAznBalance}` });
        setSwapAmount("");
        await fetchData();
      } else {
        toast({ variant: "destructive", title: d.error ?? "Swap failed" });
      }
    } catch { toast({ variant: "destructive", title: "Connection error" }); }
    setSwapping(false);
  };

  const pkg = selectedPkg ? data?.packages.find(p => p.id === selectedPkg) : null;
  const aznPreview = Math.floor(parseInt(swapAmount || "0", 10) / (data?.rates.creditsPerAzn ?? 100));

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        {[1, 2, 3].map(i => <div key={i} className="bg-card border border-card-border rounded-lg h-24 animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header balances */}
      <div>
        <h1 className="text-2xl font-bold font-mono tracking-tighter uppercase flex items-center gap-2">
          <Coins className="w-6 h-6 text-primary" /> Credits & AZN
        </h1>
        <p className="text-muted-foreground font-mono text-xs mt-1">Buy credits → swap for AZN → pay subscriptions</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Credit Balance", value: (data?.credits.balance ?? 0).toLocaleString(), suffix: "CR", color: "text-primary" },
          { label: "AZN Balance", value: (data?.credits.aznBalance ?? 0).toFixed(2), suffix: "AZN", color: "text-amber-400" },
          { label: "Total Bought", value: (data?.credits.totalPurchased ?? 0).toLocaleString(), suffix: "CR", color: "text-emerald-400" },
          { label: "Swap Rate", value: `${data?.rates.creditsPerAzn ?? 100} CR`, suffix: "= 1 AZN", color: "text-violet-400" },
        ].map(({ label, value, suffix, color }) => (
          <div key={label} className="bg-card border border-card-border rounded-lg px-4 py-3">
            <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest mb-1">{label}</div>
            <div className={cn("font-mono font-bold text-lg leading-none", color)}>{value}</div>
            <div className="font-mono text-[10px] text-muted-foreground mt-0.5">{suffix}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex border border-border rounded-lg overflow-hidden bg-card">
        {(["buy", "swap", "history"] as const).map(t => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={cn(
              "flex-1 py-2.5 text-xs font-mono uppercase tracking-widest transition-colors",
              activeTab === t ? "bg-primary/15 text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t === "buy" ? "💳 Buy Credits" : t === "swap" ? "⚡ Swap → AZN" : "📋 History"}
          </button>
        ))}
      </div>

      {/* ── BUY TAB ────────────────────────────────────────────────────── */}
      {activeTab === "buy" && !submitted && (
        <div className="space-y-5">
          {/* Packages */}
          <div>
            <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-3">Select Package</div>
            <div className="grid grid-cols-2 gap-3">
              {data?.packages.map(pkg => (
                <button
                  key={pkg.id}
                  onClick={() => setSelectedPkg(pkg.id)}
                  className={cn(
                    "text-left rounded-lg border px-4 py-4 transition-all",
                    selectedPkg === pkg.id
                      ? "border-primary/50 bg-primary/10"
                      : "border-card-border bg-card hover:border-primary/20 hover:bg-primary/5"
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono font-bold text-sm text-foreground">{pkg.label}</span>
                    {pkg.bonus > 0 && (
                      <Badge className="font-mono text-[8px] px-1.5 py-0 bg-emerald-500/15 text-emerald-400 border-emerald-500/20">
                        +{pkg.bonus}%
                      </Badge>
                    )}
                  </div>
                  <div className="font-mono text-xl font-bold text-primary">{pkg.credits.toLocaleString()}<span className="text-xs text-muted-foreground ml-1">CR</span></div>
                  <div className="font-mono text-[10px] text-muted-foreground mt-1.5 space-y-0.5">
                    <div>৳ {pkg.priceBDT.toLocaleString()} BDT</div>
                    <div>${pkg.priceUSDT} USDT</div>
                  </div>
                  {selectedPkg === pkg.id && <Check className="w-4 h-4 text-primary mt-2" />}
                </button>
              ))}
            </div>
          </div>

          {/* Payment Method */}
          <div>
            <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-3">Payment Method</div>
            <div className="grid grid-cols-3 gap-2">
              {["bkash", "nagad", "binance_usdt"].map(m => (
                <button
                  key={m}
                  onClick={() => setSelectedMethod(m)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-lg border px-3 py-3 transition-all",
                    selectedMethod === m
                      ? "border-primary/50 bg-primary/10 text-primary"
                      : "border-card-border bg-card text-muted-foreground hover:border-primary/20"
                  )}
                >
                  <span className="text-xl">{METHOD_ICONS[m]}</span>
                  <span className="font-mono text-[10px] uppercase tracking-wider">{METHOD_LABELS[m]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Payment Instructions */}
          {pkg && (
            <div className="bg-card border border-primary/20 rounded-lg overflow-hidden">
              <div className="bg-primary/5 border-b border-primary/15 px-5 py-3">
                <div className="font-mono text-xs font-bold text-primary">
                  {METHOD_ICONS[selectedMethod]} {selectedMethod === "binance_usdt" ? "Send USDT" : `Send via ${METHOD_LABELS[selectedMethod]}`}
                </div>
              </div>
              <div className="px-5 py-4 space-y-3">
                {selectedMethod !== "binance_usdt" ? (
                  <>
                    <div className="flex items-center justify-between bg-background border border-card-border rounded-md px-3 py-2.5">
                      <div>
                        <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground">
                          {selectedMethod === "bkash" ? "bKash Number" : "Naggad Number"}
                        </div>
                        <div className="font-mono font-bold text-sm text-foreground mt-0.5">
                          {selectedMethod === "bkash" ? data?.paymentInfo.bkash : data?.paymentInfo.nagad}
                        </div>
                      </div>
                      <button
                        onClick={() => copyText("num", selectedMethod === "bkash" ? (data?.paymentInfo.bkash ?? "") : (data?.paymentInfo.nagad ?? ""))}
                        className="text-muted-foreground hover:text-primary"
                      >
                        {copiedKey === "num" ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                    <div className="flex items-center justify-between bg-background border border-card-border rounded-md px-3 py-2.5">
                      <div>
                        <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground">Amount (BDT)</div>
                        <div className="font-mono font-bold text-sm text-primary">৳ {pkg.priceBDT.toLocaleString()}</div>
                      </div>
                      <button onClick={() => copyText("bdt", String(pkg.priceBDT))} className="text-muted-foreground hover:text-primary">
                        {copiedKey === "bdt" ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="font-mono text-[10px] text-muted-foreground">
                      Send <span className="text-primary font-bold">৳{pkg.priceBDT}</span> to the number above via {METHOD_LABELS[selectedMethod]}. Use "Send Money" (not Payment).
                    </p>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between bg-background border border-card-border rounded-md px-3 py-2.5">
                      <div>
                        <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground">
                          USDT Address ({data?.paymentInfo.usdtNetwork})
                        </div>
                        <div className="font-mono text-[11px] text-foreground mt-0.5 break-all">{data?.paymentInfo.usdt}</div>
                      </div>
                      <button onClick={() => copyText("usdt", data?.paymentInfo.usdt ?? "")} className="text-muted-foreground hover:text-primary flex-shrink-0 ml-2">
                        {copiedKey === "usdt" ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                    <div className="flex items-center justify-between bg-background border border-card-border rounded-md px-3 py-2.5">
                      <div>
                        <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground">Amount (USDT)</div>
                        <div className="font-mono font-bold text-sm text-primary">${pkg.priceUSDT} USDT</div>
                      </div>
                      <button onClick={() => copyText("usdt_amt", String(pkg.priceUSDT))} className="text-muted-foreground hover:text-primary">
                        {copiedKey === "usdt_amt" ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="font-mono text-[10px] text-amber-300/80">
                      Send exactly <span className="text-primary font-bold">${pkg.priceUSDT} USDT</span> on {data?.paymentInfo.usdtNetwork} network to the address above.
                    </p>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Proof fields */}
          {pkg && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  {selectedMethod === "binance_usdt" ? "TX Hash / Transaction ID" : "Transaction ID (TrxID)"} <span className="text-red-400">*</span>
                </label>
                <Input
                  value={refId}
                  onChange={e => setRefId(e.target.value)}
                  placeholder={selectedMethod === "binance_usdt" ? "0x... or TXID" : "e.g. 8AB23DF1E0..."}
                  className="font-mono text-xs h-10 bg-input border-border focus-visible:ring-primary/50"
                />
              </div>
              {selectedMethod !== "binance_usdt" && (
                <div className="space-y-1.5">
                  <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    Your {METHOD_LABELS[selectedMethod]} Number
                  </label>
                  <Input
                    value={senderNum}
                    onChange={e => setSenderNum(e.target.value)}
                    placeholder="+880 1X XXXX XXXX"
                    className="font-mono text-xs h-10 bg-input border-border focus-visible:ring-primary/50"
                  />
                </div>
              )}
              <Button
                onClick={handlePurchase}
                disabled={submitting || !refId.trim() || !selectedPkg}
                className="w-full font-mono text-xs gap-2 h-11"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {submitting ? "Submitting..." : `Submit Payment Proof — ${pkg?.credits.toLocaleString()} CR`}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Submitted success */}
      {activeTab === "buy" && submitted && (
        <div className="bg-card border border-emerald-500/20 rounded-xl px-6 py-10 text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto">
            <Check className="w-7 h-7 text-emerald-400" />
          </div>
          <div>
            <div className="font-mono font-bold text-lg text-foreground">Payment Submitted!</div>
            <div className="font-mono text-xs text-muted-foreground mt-1">Credits will be added after admin verification (1–2 hours).</div>
          </div>
          <Button variant="outline" onClick={() => { setSubmitted(false); setRefId(""); setSenderNum(""); setSelectedPkg(null); }} className="font-mono text-xs gap-2">
            <RefreshCw className="w-3.5 h-3.5" /> Submit Another
          </Button>
        </div>
      )}

      {/* ── SWAP TAB ──────────────────────────────────────────────────────── */}
      {activeTab === "swap" && (
        <div className="space-y-5">
          <div className="bg-card border border-primary/20 rounded-xl overflow-hidden">
            <div className="bg-primary/5 border-b border-primary/15 px-5 py-4">
              <div className="font-mono font-bold text-sm text-primary flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4" /> Credits → AZN Token
              </div>
              <div className="font-mono text-[10px] text-muted-foreground mt-1">
                Rate: {data?.rates.creditsPerAzn ?? 100} Credits = 1 AZN · You have {(data?.credits.balance ?? 0).toLocaleString()} CR
              </div>
            </div>
            <div className="px-5 py-5 space-y-4">
              <div className="space-y-1.5">
                <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Credits to Swap</label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    value={swapAmount}
                    onChange={e => setSwapAmount(e.target.value)}
                    placeholder={`Min ${data?.rates.creditsPerAzn ?? 100}`}
                    min={data?.rates.creditsPerAzn ?? 100}
                    step={data?.rates.creditsPerAzn ?? 100}
                    className="font-mono text-xs h-10 bg-input border-border focus-visible:ring-primary/50"
                  />
                  <div className="flex gap-1">
                    {[100, 500, 1000, 5000].map(amt => (
                      <button
                        key={amt}
                        onClick={() => setSwapAmount(String(amt))}
                        className="px-2 h-10 rounded-md border border-border text-[9px] font-mono text-muted-foreground hover:border-primary/30 hover:text-primary transition-all"
                      >
                        {amt >= 1000 ? `${amt / 1000}K` : amt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-background border border-card-border rounded-md px-4 py-3 flex items-center justify-between">
                <div>
                  <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground mb-1">You Receive</div>
                  <div className="font-mono font-bold text-2xl text-amber-400">{aznPreview}<span className="text-sm ml-1.5 text-muted-foreground">AZN</span></div>
                </div>
                <Sparkles className="w-8 h-8 text-amber-400/30" />
              </div>

              <Button
                onClick={handleSwap}
                disabled={swapping || !swapAmount || parseInt(swapAmount, 10) < (data?.rates.creditsPerAzn ?? 100)}
                className="w-full font-mono text-xs gap-2 h-11 bg-amber-500 hover:bg-amber-500/90 text-black"
              >
                {swapping ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRightLeft className="w-4 h-4" />}
                {swapping ? "Swapping..." : `Swap ${swapAmount || "0"} Credits → ${aznPreview} AZN`}
              </Button>
            </div>
          </div>

          {/* AZN use cases */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-card border border-primary/20 rounded-lg px-4 py-4">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-4 h-4 text-primary" />
                <span className="font-mono font-bold text-xs text-primary">Pro Plan</span>
              </div>
              <div className="font-mono text-2xl font-bold text-foreground">{data?.rates.aznForPro ?? 200}<span className="text-sm text-muted-foreground ml-1">AZN</span></div>
              <div className="font-mono text-[10px] text-muted-foreground mt-1">per month</div>
            </div>
            <div className="bg-card border border-amber-400/20 rounded-lg px-4 py-4">
              <div className="flex items-center gap-2 mb-2">
                <Crown className="w-4 h-4 text-amber-400" />
                <span className="font-mono font-bold text-xs text-amber-400">Enterprise Plan</span>
              </div>
              <div className="font-mono text-2xl font-bold text-foreground">{data?.rates.aznForEnterprise ?? 1000}<span className="text-sm text-muted-foreground ml-1">AZN</span></div>
              <div className="font-mono text-[10px] text-muted-foreground mt-1">per month</div>
            </div>
          </div>

          <div className="flex items-start gap-2 text-[10px] font-mono text-muted-foreground/50">
            <Shield className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span>AZN tokens are stored server-side. On-chain AZN (Base L2) can be claimed after KYC is complete.</span>
          </div>
        </div>
      )}

      {/* ── HISTORY TAB ────────────────────────────────────────────────────── */}
      {activeTab === "history" && (
        <div className="space-y-3">
          {data?.transactions.length === 0 ? (
            <div className="bg-card border border-card-border rounded-lg px-6 py-10 text-center">
              <Clock className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
              <p className="font-mono text-sm text-muted-foreground">No transactions yet</p>
            </div>
          ) : (
            data?.transactions.map(tx => (
              <div key={tx.id} className="bg-card border border-card-border rounded-lg px-4 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="text-xl">{tx.method ? METHOD_ICONS[tx.method] ?? "⚙️" : "⚙️"}</div>
                    <div>
                      <div className="font-mono text-xs font-bold text-foreground capitalize">
                        {tx.type.replace(/_/g, " ")}
                      </div>
                      <div className="font-mono text-[10px] text-muted-foreground mt-0.5">
                        {tx.notes ?? (tx.referenceId ? `Ref: ${tx.referenceId.slice(0, 16)}…` : "")}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    {tx.credits !== 0 && (
                      <div className={cn("font-mono font-bold text-sm", tx.credits > 0 ? "text-emerald-400" : "text-red-400")}>
                        {tx.credits > 0 ? "+" : ""}{tx.credits.toLocaleString()} CR
                      </div>
                    )}
                    {tx.aznAmount !== 0 && (
                      <div className={cn("font-mono text-xs", tx.aznAmount > 0 ? "text-amber-400" : "text-red-400")}>
                        {tx.aznAmount > 0 ? "+" : ""}{tx.aznAmount} AZN
                      </div>
                    )}
                    <Badge className={cn("font-mono text-[8px] uppercase px-1.5 py-0 mt-1 border", STATUS_COLORS[tx.status] ?? "")}>
                      {tx.status}
                    </Badge>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
