import { Router } from "express";
import { db } from "@workspace/db";
import { subscriptionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { sql } from "drizzle-orm";

const router = Router();

export const PLANS = {
  free: {
    id: "free",
    name: "Free",
    price: 0,
    currency: "USD",
    vaultLimit: 3,
    otherAccountsAllowed: false,
    mainAccountOnly: false,
    description: "Get started with limited vault",
    features: ["3 vault entities", "Basic wallet tracking", "AYZEN email", "Community access"],
  },
  pro: {
    id: "pro",
    name: "Pro",
    price: 3,
    currency: "USD",
    vaultLimit: -1,
    otherAccountsAllowed: false,
    mainAccountOnly: true,
    description: "For serious airdrop hunters",
    features: ["Unlimited vault entities", "Main account setup only", "All wallets", "Priority support", "AI assistant"],
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    price: 6,
    currency: "USD",
    vaultLimit: -1,
    otherAccountsAllowed: true,
    mainAccountOnly: false,
    description: "Full platform access",
    features: ["Unlimited vault entities", "All account types", "Other accounts unlocked", "Dedicated support", "API access", "AZN token rewards"],
  },
};

function getUserId(req: any): number {
  const authHeader = req.headers.authorization;
  if (!authHeader) return 1;
  try {
    const payload = JSON.parse(Buffer.from(authHeader.replace("Bearer ", ""), "base64").toString());
    return payload.userId ?? 1;
  } catch { return 1; }
}

router.get("/plans", async (_req, res): Promise<void> => {
  res.json(Object.values(PLANS));
});

router.get("/subscription", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  try {
    const [sub] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.userId, userId));
    if (!sub) {
      res.json({ plan: "free", status: "active", ...PLANS.free });
      return;
    }
    const planInfo = PLANS[sub.plan as keyof typeof PLANS] ?? PLANS.free;
    res.json({ ...sub, ...planInfo });
  } catch {
    res.json({ plan: "free", status: "active", ...PLANS.free });
  }
});

router.post("/subscription/upgrade", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const { plan } = req.body;
  if (!plan || !PLANS[plan as keyof typeof PLANS]) {
    res.status(400).json({ error: "Invalid plan" });
    return;
  }
  if (plan === "free") {
    await db.delete(subscriptionsTable).where(eq(subscriptionsTable.userId, userId));
    res.json({ plan: "free", status: "active" });
    return;
  }
  const planInfo = PLANS[plan as keyof typeof PLANS];
  const coingateKey = process.env.COINGATE_API_KEY;
  if (!coingateKey) {
    res.status(503).json({ error: "Payment gateway not configured. Contact admin." });
    return;
  }
  try {
    const baseUrl = process.env.REPLIT_DEV_DOMAIN
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : "https://ayzen.replit.app";
    const resp = await fetch("https://api.coingate.com/v2/orders", {
      method: "POST",
      headers: {
        Authorization: `Token ${coingateKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        order_id: `ayzen_sub_${userId}_${Date.now()}`,
        price_amount: planInfo.price,
        price_currency: "USD",
        receive_currency: "USDT",
        title: `AYZEN ${planInfo.name} Plan`,
        description: `AYZEN ${planInfo.name} monthly subscription`,
        callback_url: `${baseUrl}/api/payments/coingate/webhook`,
        success_url: `${baseUrl}/?payment=success`,
        cancel_url: `${baseUrl}/?payment=cancelled`,
      }),
    });
    if (!resp.ok) {
      const err = await resp.text();
      res.status(500).json({ error: "Payment creation failed", detail: err });
      return;
    }
    const order = await resp.json() as any;
    const expiresAt = new Date(Date.now() + 31 * 24 * 60 * 60 * 1000);
    const existing = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.userId, userId));
    if (existing.length > 0) {
      await db.update(subscriptionsTable).set({
        plan, status: "pending",
        coingateOrderId: String(order.id),
        coingatePaymentUrl: order.payment_url,
        expiresAt, updatedAt: new Date(),
      }).where(eq(subscriptionsTable.userId, userId));
    } else {
      await db.insert(subscriptionsTable).values({
        userId, plan, status: "pending",
        coingateOrderId: String(order.id),
        coingatePaymentUrl: order.payment_url,
        expiresAt,
      });
    }
    res.json({ paymentUrl: order.payment_url, orderId: order.id, plan });
  } catch (err: any) {
    res.status(500).json({ error: "Payment gateway error", detail: err?.message });
  }
});

router.post("/subscription/check", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const { orderId } = req.body;
  const coingateKey = process.env.COINGATE_API_KEY;
  if (!coingateKey || !orderId) {
    res.status(400).json({ error: "Missing params" });
    return;
  }
  try {
    const resp = await fetch(`https://api.coingate.com/v2/orders/${orderId}`, {
      headers: { Authorization: `Token ${coingateKey}` },
    });
    const order = await resp.json() as any;
    if (order.status === "paid" || order.status === "confirming") {
      await db.update(subscriptionsTable).set({ status: "active", updatedAt: new Date() })
        .where(eq(subscriptionsTable.userId, userId));
      res.json({ paid: true, status: "active" });
    } else {
      res.json({ paid: false, status: order.status });
    }
  } catch {
    res.status(500).json({ error: "Check failed" });
  }
});

export default router;
