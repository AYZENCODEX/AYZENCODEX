import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Crown, Zap, Shield, Check, Loader2, ExternalLink,
  RefreshCw, Star, Sparkles, Lock, Unlock,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

interface Plan {
  id: string;
  name: string;
  price: number;
  currency: string;
  vaultLimit: number;
  otherAccountsAllowed: boolean;
  mainAccountOnly: boolean;
  description: string;
  features: string[];
}

const PLAN_ICONS: Record<string, React.ElementType> = {
  free: Shield,
  pro: Zap,
  enterprise: Crown,
};

const PLAN_COLORS: Record<string, string> = {
  free: "text-muted-foreground border-border",
  pro: "text-primary border-primary/40",
  enterprise: "text-amber-400 border-amber-400/40",
};

const PLAN_BG: Record<string, string> = {
  free: "bg-muted/10",
  pro: "bg-primary/5",
  enterprise: "bg-amber-400/5",
};

export default function SubscriptionPage() {
  const { token } = useAuth();
  const { toast } = useToast();

  const [plans, setPlans] = useState<Plan[]>([]);
  const [currentSub, setCurrentSub] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);

  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [plansRes, subRes] = await Promise.all([
        fetch(`${BASE}/api/plans`, { headers }),
        fetch(`${BASE}/api/subscription`, { headers }),
      ]);
      if (plansRes.ok) setPlans(await plansRes.json());
      if (subRes.ok) {
        const sub = await subRes.json();
        setCurrentSub(sub);
        if (sub.coingateOrderId && sub.status === "pending") {
          setPendingOrderId(sub.coingateOrderId);
        }
      }
    } catch {
      toast({ variant: "destructive", title: "Failed to load plans" });
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleUpgrade = async (planId: string) => {
    if (planId === "free") {
      if (!confirm("Downgrade to Free plan? You'll lose Pro/Enterprise features.")) return;
    }
    setUpgrading(planId);
    try {
      const res = await fetch(`${BASE}/api/subscription/upgrade`, {
        method: "POST",
        headers,
        body: JSON.stringify({ plan: planId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ variant: "destructive", title: data.error ?? "Upgrade failed" });
        setUpgrading(null);
        return;
      }
      if (data.paymentUrl) {
        setPendingOrderId(data.orderId);
        window.open(data.paymentUrl, "_blank");
        toast({ title: "Payment page opened", description: "Complete payment to activate your plan." });
        await fetchData();
      } else {
        toast({ title: "Plan updated", description: `You're now on the ${planId} plan.` });
        await fetchData();
      }
    } catch {
      toast({ variant: "destructive", title: "Upgrade failed" });
    }
    setUpgrading(null);
  };

  const handleCheckPayment = async () => {
    if (!pendingOrderId) return;
    setChecking(true);
    try {
      const res = await fetch(`${BASE}/api/subscription/check`, {
        method: "POST",
        headers,
        body: JSON.stringify({ orderId: pendingOrderId }),
      });
      const data = await res.json();
      if (data.paid) {
        toast({ title: "Payment confirmed!", description: "Your plan is now active." });
        setPendingOrderId(null);
        await fetchData();
      } else {
        toast({ title: `Payment ${data.status}`, description: "Check again after completing payment." });
      }
    } catch {
      toast({ variant: "destructive", title: "Check failed" });
    }
    setChecking(false);
  };

  const currentPlan = currentSub?.plan ?? "free";

  return (
    <div className="space-y-6 page-enter">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-mono tracking-tighter uppercase flex items-center gap-2">
            <Star className="w-6 h-6 text-primary" /> Subscription
          </h1>
          <p className="text-muted-foreground font-mono text-xs mt-1">
            Upgrade your plan to unlock more vault power
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={cn("font-mono text-xs px-3 py-1 border", PLAN_COLORS[currentPlan])}>
            {currentPlan.toUpperCase()} PLAN
          </Badge>
          {currentSub?.status === "pending" && pendingOrderId && (
            <Button
              size="sm"
              variant="outline"
              className="font-mono text-xs gap-2"
              onClick={handleCheckPayment}
              disabled={checking}
            >
              {checking ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              Check Payment
            </Button>
          )}
        </div>
      </div>

      {currentSub?.status === "pending" && pendingOrderId && (
        <div className="border border-amber-400/30 bg-amber-400/5 rounded-xl p-4 flex items-center gap-3">
          <Loader2 className="w-4 h-4 text-amber-400 animate-spin flex-shrink-0" />
          <div>
            <div className="font-mono text-sm font-bold text-amber-400">Payment Pending</div>
            <div className="font-mono text-xs text-muted-foreground mt-0.5">
              Complete the payment in the opened tab, then click "Check Payment" to verify.
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-72 bg-card border border-card-border rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          {plans.map((plan) => {
            const Icon = PLAN_ICONS[plan.id] ?? Shield;
            const isCurrent = currentPlan === plan.id && currentSub?.status !== "pending";
            const isPending = currentSub?.coingateOrderId && currentSub.plan === plan.id && currentSub.status === "pending";

            return (
              <div
                key={plan.id}
                className={cn(
                  "relative rounded-xl border p-6 flex flex-col gap-4 transition-all duration-300",
                  PLAN_BG[plan.id],
                  isCurrent ? `border-2 ${PLAN_COLORS[plan.id]}` : "border-card-border hover:border-primary/20",
                )}
              >
                {plan.id === "pro" && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="font-mono text-[10px] bg-primary text-primary-foreground border-0 flex items-center gap-1">
                      <Sparkles className="w-2.5 h-2.5" /> Popular
                    </Badge>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={cn("w-8 h-8 rounded-lg border flex items-center justify-center", PLAN_COLORS[plan.id])}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className={cn("font-mono font-bold text-sm", PLAN_COLORS[plan.id])}>{plan.name}</span>
                  </div>
                  {isCurrent && (
                    <Badge variant="outline" className={cn("font-mono text-[10px]", PLAN_COLORS[plan.id])}>
                      Current
                    </Badge>
                  )}
                </div>

                <div>
                  <div className="flex items-end gap-1">
                    <span className="font-mono font-bold text-2xl text-foreground">${plan.price}</span>
                    <span className="font-mono text-xs text-muted-foreground mb-1">/month</span>
                  </div>
                  <p className="font-mono text-xs text-muted-foreground mt-1">{plan.description}</p>
                </div>

                <ul className="space-y-2 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-400 mt-0.5 flex-shrink-0" />
                      <span className="font-mono text-xs text-muted-foreground">{f}</span>
                    </li>
                  ))}
                  <li className="flex items-start gap-2">
                    {plan.otherAccountsAllowed ? (
                      <Unlock className="w-3.5 h-3.5 text-emerald-400 mt-0.5 flex-shrink-0" />
                    ) : (
                      <Lock className="w-3.5 h-3.5 text-muted-foreground/40 mt-0.5 flex-shrink-0" />
                    )}
                    <span className={cn("font-mono text-xs", plan.otherAccountsAllowed ? "text-muted-foreground" : "text-muted-foreground/40")}>
                      Other accounts in vault
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    {plan.vaultLimit === -1 ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400 mt-0.5 flex-shrink-0" />
                    ) : (
                      <span className="w-3.5 h-3.5 rounded-full border border-muted-foreground/40 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-[8px] font-mono text-muted-foreground">{plan.vaultLimit}</span>
                      </span>
                    )}
                    <span className="font-mono text-xs text-muted-foreground">
                      {plan.vaultLimit === -1 ? "Unlimited" : `${plan.vaultLimit} max`} vault entities
                    </span>
                  </li>
                </ul>

                <Button
                  className={cn(
                    "w-full font-mono text-xs uppercase tracking-wider",
                    isCurrent
                      ? "bg-transparent border border-border text-muted-foreground cursor-default hover:bg-transparent"
                      : plan.id === "enterprise"
                        ? "bg-amber-400 text-black hover:bg-amber-400/90"
                        : plan.id === "free"
                          ? "bg-muted text-muted-foreground hover:bg-muted/80"
                          : ""
                  )}
                  disabled={isCurrent || !!upgrading || isPending}
                  onClick={() => !isCurrent && handleUpgrade(plan.id)}
                >
                  {upgrading === plan.id ? (
                    <span className="flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin" /> Processing...</span>
                  ) : isPending ? (
                    <span className="flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin" /> Awaiting Payment</span>
                  ) : isCurrent ? (
                    "Active Plan"
                  ) : plan.price > 0 ? (
                    <span className="flex items-center gap-2">
                      Upgrade <ExternalLink className="w-3 h-3" />
                    </span>
                  ) : (
                    "Downgrade"
                  )}
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <div className="border border-card-border rounded-xl p-4 bg-card/50">
        <div className="font-mono text-xs font-bold text-muted-foreground/60 uppercase tracking-widest mb-3">Plan Comparison</div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 text-muted-foreground font-normal">Feature</th>
                <th className="text-center py-2 text-muted-foreground font-normal">Free</th>
                <th className="text-center py-2 text-primary font-normal">Pro</th>
                <th className="text-center py-2 text-amber-400 font-normal">Enterprise</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {[
                ["Vault Entities", "3 max", "Unlimited", "Unlimited"],
                ["Other Accounts in Vault", "✗", "✗", "✓"],
                ["Main Account Setup", "✓", "✓", "✓"],
                ["AI Assistant", "Basic", "Full", "Full"],
                ["Wallet Tracking", "✓", "✓", "✓"],
                ["Support", "Community", "Priority", "Dedicated"],
                ["AZN Token Rewards", "✗", "✗", "✓"],
              ].map(([feat, free, pro, ent]) => (
                <tr key={feat} className="hover:bg-muted/10">
                  <td className="py-2 text-muted-foreground">{feat}</td>
                  <td className="py-2 text-center text-muted-foreground/60">{free}</td>
                  <td className="py-2 text-center text-primary/80">{pro}</td>
                  <td className="py-2 text-center text-amber-400/80">{ent}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
