import { Router } from "express";
import { db, pool } from "@workspace/db";
import { sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import crypto from "crypto";

const router = Router();

// AZN costs per plan
const PLAN_AZN_COST: Record<string, number> = {
  pro: 30,
  enterprise: 60,
};

const PLAN_DURATION_DAYS: Record<string, number> = {
  pro: 30,
  enterprise: 30,
};

function generateTokenId(): string {
  return "AYZEN-" + crypto.randomBytes(8).toString("hex").toUpperCase();
}

function generateNftMetadata(plan: string, userId: number, tokenId: string) {
  return {
    name: `AYZEN ${plan.charAt(0).toUpperCase() + plan.slice(1)} Pass`,
    description: `AYZEN platform subscription NFT — ${plan} tier. Tradeable access pass.`,
    plan,
    token_id: tokenId,
    minted_for: userId,
    minted_at: new Date().toISOString(),
    attributes: [
      { trait_type: "Tier", value: plan.charAt(0).toUpperCase() + plan.slice(1) },
      { trait_type: "Type", value: "Subscription Pass" },
      { trait_type: "Platform", value: "AYZEN" },
    ],
  };
}

// POST /nft-subscriptions/mint — buy subscription with AZN, mint NFT
// All writes inside a single pg transaction with row-level locking
router.post("/nft-subscriptions/mint", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const { plan } = req.body as { plan?: string };

  if (!plan || !PLAN_AZN_COST[plan]) {
    res.status(400).json({ error: "Invalid plan. Choose: pro, enterprise" }); return;
  }

  const aznCost = PLAN_AZN_COST[plan];
  const tokenId = generateTokenId();
  const metadata = generateNftMetadata(plan, userId, tokenId);
  const expiresAt = new Date(Date.now() + PLAN_DURATION_DAYS[plan] * 24 * 60 * 60 * 1000);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Lock the credits row and check balance atomically
    const balResult = await client.query(
      "SELECT azn_balance FROM credits WHERE user_id = $1 FOR UPDATE",
      [userId]
    );
    const azn = parseFloat(balResult.rows[0]?.azn_balance ?? "0");
    if (azn < aznCost) {
      await client.query("ROLLBACK");
      res.status(400).json({ error: `Insufficient AZN. Need ${aznCost} AZN, have ${azn.toFixed(2)}` }); return;
    }

    // Check for existing active NFT for this plan
    const existing = await client.query(
      "SELECT id FROM nft_subscriptions WHERE owner_id = $1 AND plan = $2 AND is_burned = FALSE",
      [userId, plan]
    );
    if (existing.rows.length > 0) {
      await client.query("ROLLBACK");
      res.status(409).json({ error: `You already own an active ${plan} NFT pass` }); return;
    }

    // Deduct AZN (the FOR UPDATE lock above prevents concurrent overdraft)
    await client.query(
      "UPDATE credits SET azn_balance = azn_balance - $1, updated_at = NOW() WHERE user_id = $2",
      [aznCost, userId]
    );

    // Mint NFT
    const nftResult = await client.query(
      `INSERT INTO nft_subscriptions (
        token_id, owner_id, original_owner_id, plan, metadata, expires_at, is_listed, list_price, is_burned
      ) VALUES ($1, $2, $3, $4, $5::jsonb, $6, FALSE, NULL, FALSE) RETURNING *`,
      [tokenId, userId, userId, plan, JSON.stringify(metadata), expiresAt.toISOString()]
    );
    const nft = nftResult.rows[0];

    // Activate subscription
    await client.query(
      `INSERT INTO subscriptions (user_id, plan, status, expires_at)
       VALUES ($1, $2, 'active', $3)
       ON CONFLICT (user_id) DO UPDATE SET
         plan = EXCLUDED.plan, status = 'active', expires_at = EXCLUDED.expires_at,
         updated_at = NOW()`,
      [userId, plan, expiresAt.toISOString()]
    );

    // Log transaction
    await client.query(
      "INSERT INTO credit_transactions (user_id, type, method, azn_amount, status, notes) VALUES ($1, 'subscription_nft', 'azn', $2, 'completed', $3)",
      [userId, aznCost, `Minted ${plan} NFT pass: ${tokenId}`]
    );

    await client.query("COMMIT");
    res.status(201).json({ success: true, nft, aznSpent: aznCost, expiresAt });
  } catch (err: any) {
    await client.query("ROLLBACK").catch(() => {});
    res.status(500).json({ error: "Minting failed", detail: err?.message });
  } finally {
    client.release();
  }
});

// GET /nft-subscriptions/my-nfts — list user's NFTs
router.get("/nft-subscriptions/my-nfts", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const result = await db.execute(sql`
    SELECT ns.*, u.username AS original_owner_username
    FROM nft_subscriptions ns
    LEFT JOIN users u ON u.id = ns.original_owner_id
    WHERE ns.owner_id = ${userId} AND ns.is_burned = FALSE
    ORDER BY ns.minted_at DESC
  `);
  res.json(result.rows);
});

// GET /nft-subscriptions/marketplace — all listed NFTs (parameterized)
router.get("/nft-subscriptions/marketplace", requireAuth, async (req, res): Promise<void> => {
  const { plan } = req.query as Record<string, string>;
  try {
    let queryText = `
      SELECT ns.*, u.username AS seller_username, u.avatar_url AS seller_avatar
      FROM nft_subscriptions ns
      JOIN users u ON u.id = ns.owner_id
      WHERE ns.is_listed = TRUE AND ns.is_burned = TRUE
    `;
    const params: unknown[] = [];
    if (plan) {
      params.push(plan);
      queryText += ` AND ns.plan = $${params.length}`;
    }
    queryText += " ORDER BY ns.list_price ASC, ns.minted_at DESC LIMIT 50";
    // Fix: should be is_burned = FALSE
    queryText = queryText.replace("is_burned = TRUE", "is_burned = FALSE");
    const result = await pool.query(queryText, params);
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: err?.message });
  }
});

// POST /nft-subscriptions/:id/list — list NFT on marketplace
router.post("/nft-subscriptions/:id/list", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const nftId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { price } = req.body as { price?: number };

  if (!price || price <= 0) {
    res.status(400).json({ error: "price must be > 0 AZN" }); return;
  }

  const result = await pool.query(
    "SELECT id FROM nft_subscriptions WHERE id = $1 AND owner_id = $2 AND is_burned = FALSE",
    [nftId, userId]
  );
  if (result.rows.length === 0) {
    res.status(404).json({ error: "NFT not found or not yours" }); return;
  }

  await pool.query(
    "UPDATE nft_subscriptions SET is_listed = TRUE, list_price = $1 WHERE id = $2 AND owner_id = $3",
    [price, nftId, userId]
  );
  res.json({ success: true, listed: true, price });
});

// POST /nft-subscriptions/:id/delist — remove from marketplace
router.post("/nft-subscriptions/:id/delist", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const nftId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);

  await pool.query(
    "UPDATE nft_subscriptions SET is_listed = FALSE, list_price = NULL WHERE id = $1 AND owner_id = $2",
    [nftId, userId]
  );
  res.json({ success: true });
});

// POST /nft-subscriptions/:id/buy — buy NFT from marketplace (atomic transaction)
router.post("/nft-subscriptions/:id/buy", requireAuth, async (req, res): Promise<void> => {
  const buyerId = req.user!.userId;
  const nftId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Lock the NFT row to prevent double-purchase
    const nftResult = await client.query(
      "SELECT * FROM nft_subscriptions WHERE id = $1 AND is_listed = TRUE AND is_burned = FALSE FOR UPDATE",
      [nftId]
    );
    const nft = nftResult.rows[0];
    if (!nft) {
      await client.query("ROLLBACK");
      res.status(404).json({ error: "NFT not listed or not found" }); return;
    }
    if (nft.owner_id === buyerId) {
      await client.query("ROLLBACK");
      res.status(400).json({ error: "Cannot buy your own NFT" }); return;
    }

    const price = parseFloat(nft.list_price);
    const sellerId = nft.owner_id;
    const planKey = nft.plan as string;

    // Lock buyer's credits row and check balance
    const buyerCreditRes = await client.query(
      "INSERT INTO credits (user_id, azn_balance) VALUES ($1, 0) ON CONFLICT (user_id) DO NOTHING",
      [buyerId]
    );
    const buyerBalRes = await client.query(
      "SELECT azn_balance FROM credits WHERE user_id = $1 FOR UPDATE",
      [buyerId]
    );
    const buyerAzn = parseFloat(buyerBalRes.rows[0]?.azn_balance ?? "0");
    if (buyerAzn < price) {
      await client.query("ROLLBACK");
      res.status(400).json({ error: `Insufficient AZN. Need ${price}, have ${buyerAzn.toFixed(2)}` }); return;
    }

    // Deduct from buyer
    await client.query(
      "UPDATE credits SET azn_balance = azn_balance - $1, updated_at = NOW() WHERE user_id = $2",
      [price, buyerId]
    );

    // Ensure seller has a credits row then credit them
    await client.query(
      "INSERT INTO credits (user_id, azn_balance) VALUES ($1, 0) ON CONFLICT (user_id) DO NOTHING",
      [sellerId]
    );
    await client.query(
      "UPDATE credits SET azn_balance = azn_balance + $1, updated_at = NOW() WHERE user_id = $2",
      [price, sellerId]
    );

    // Transfer NFT ownership; set new expiry
    const newExpiry = new Date(Date.now() + (PLAN_DURATION_DAYS[planKey] ?? 30) * 24 * 60 * 60 * 1000);
    await client.query(
      `UPDATE nft_subscriptions
       SET owner_id = $1, is_listed = FALSE, list_price = NULL,
           expires_at = $2, transfer_count = transfer_count + 1
       WHERE id = $3`,
      [buyerId, newExpiry.toISOString(), nftId]
    );

    // Revoke seller's subscription if they have no other active NFTs of this plan
    const sellerOtherNfts = await client.query(
      "SELECT id FROM nft_subscriptions WHERE owner_id = $1 AND plan = $2 AND is_burned = FALSE LIMIT 1",
      [sellerId, planKey]
    );
    if (sellerOtherNfts.rows.length === 0) {
      await client.query(
        "UPDATE subscriptions SET plan = 'free', status = 'active', updated_at = NOW() WHERE user_id = $1",
        [sellerId]
      );
    }

    // Activate buyer's subscription
    await client.query(
      `INSERT INTO subscriptions (user_id, plan, status, expires_at)
       VALUES ($1, $2, 'active', $3)
       ON CONFLICT (user_id) DO UPDATE SET
         plan = EXCLUDED.plan, status = 'active', expires_at = EXCLUDED.expires_at,
         updated_at = NOW()`,
      [buyerId, planKey, newExpiry.toISOString()]
    );

    await client.query("COMMIT");
    res.json({
      success: true,
      plan: planKey,
      tokenId: nft.token_id,
      aznSpent: price,
      expiresAt: newExpiry,
    });
  } catch (err: any) {
    await client.query("ROLLBACK").catch(() => {});
    res.status(500).json({ error: "Purchase failed", detail: err?.message });
  } finally {
    client.release();
  }
});

// GET /nft-subscriptions/stats — platform stats
router.get("/nft-subscriptions/stats", async (_req, res): Promise<void> => {
  try {
    const [total, listed, volume] = await Promise.all([
      pool.query("SELECT COUNT(*) AS count FROM nft_subscriptions WHERE is_burned = FALSE"),
      pool.query("SELECT COUNT(*) AS count FROM nft_subscriptions WHERE is_listed = TRUE AND is_burned = FALSE"),
      pool.query("SELECT COALESCE(SUM(list_price), 0) AS vol FROM nft_subscriptions WHERE transfer_count > 0"),
    ]);
    res.json({
      totalMinted: parseInt(total.rows[0]?.count ?? "0"),
      listed: parseInt(listed.rows[0]?.count ?? "0"),
      tradingVolume: parseFloat(volume.rows[0]?.vol ?? "0"),
    });
  } catch {
    res.json({ totalMinted: 0, listed: 0, tradingVolume: 0 });
  }
});

export default router;
