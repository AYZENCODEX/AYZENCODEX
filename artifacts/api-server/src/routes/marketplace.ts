import { Router } from "express";
import { pool } from "@workspace/db";
import { requireAuth, requireAdmin } from "../middlewares/auth";

const router = Router();

const PLATFORM_FEE_PCT = 5; // 5% fee by default

// ── DB init (called from startup migrations in index.ts) ─────────────────────
// Tables created in MIGRATIONS array in index.ts

// ─── GET /marketplace/settings — get fee settings ────────────────────────────
router.get("/marketplace/settings", async (_req, res): Promise<void> => {
  try {
    const r = await pool.query("SELECT * FROM marketplace_settings LIMIT 1");
    if (r.rows[0]) { res.json(r.rows[0]); return; }
    res.json({ fee_pct: PLATFORM_FEE_PCT, enabled: true });
  } catch { res.json({ fee_pct: PLATFORM_FEE_PCT, enabled: true }); }
});

// ─── PATCH /marketplace/settings — admin update fee ──────────────────────────
router.patch("/marketplace/settings", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const { fee_pct, enabled } = req.body;
  try {
    await pool.query(`
      INSERT INTO marketplace_settings (id, fee_pct, enabled, updated_at)
      VALUES (1, $1, $2, NOW())
      ON CONFLICT (id) DO UPDATE SET fee_pct = $1, enabled = $2, updated_at = NOW()
    `, [fee_pct ?? PLATFORM_FEE_PCT, enabled ?? true]);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ─── GET /marketplace/listings — browse all active listings ──────────────────
router.get("/marketplace/listings", async (req, res): Promise<void> => {
  const { type, limit = 50, offset = 0 } = req.query as any;
  try {
    let q = `
      SELECT ml.*, u.username as seller_username
      FROM marketplace_listings ml
      LEFT JOIN users u ON u.id = ml.seller_id
      WHERE ml.status = 'active'
        AND (ml.listing_expires_at IS NULL OR ml.listing_expires_at > NOW())
    `;
    const params: any[] = [];
    if (type) { q += ` AND ml.listing_type = $${params.length + 1}`; params.push(type); }
    q += ` ORDER BY ml.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(Number(limit), Number(offset));
    const r = await pool.query(q, params);
    const countR = await pool.query(
      `SELECT COUNT(*) FROM marketplace_listings WHERE status = 'active'${type ? " AND listing_type = $1" : ""}`,
      type ? [type] : []
    );
    res.json({ listings: r.rows, total: Number(countR.rows[0].count) });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ─── GET /marketplace/my-listings — user's own listings ──────────────────────
router.get("/marketplace/my-listings", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  try {
    const r = await pool.query(
      `SELECT ml.*, u.username as buyer_username
       FROM marketplace_listings ml
       LEFT JOIN users u ON u.id = ml.buyer_id
       WHERE ml.seller_id = $1
       ORDER BY ml.created_at DESC`,
      [userId]
    );
    res.json(r.rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ─── POST /marketplace/listings — create a listing ───────────────────────────
router.post("/marketplace/listings", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const { listing_type, item_id, title, description, price_azn, metadata, image_url, condition, tags, listing_expires_at } = req.body;

  if (!listing_type || !title || !price_azn) {
    res.status(400).json({ error: "listing_type, title, price_azn required" }); return;
  }

  const validTypes = ["entity", "local_account", "nft", "azn", "username_nft", "badge_nft"];
  if (!validTypes.includes(listing_type)) {
    res.status(400).json({ error: `listing_type must be one of: ${validTypes.join(", ")}` }); return;
  }

  try {
    const userRow = await pool.query("SELECT username FROM users WHERE id=$1", [userId]);
    const username = userRow.rows[0]?.username ?? "user";

    const r = await pool.query(
      `INSERT INTO marketplace_listings
        (seller_id, listing_type, item_id, title, description, price_azn, metadata, status, image_url, condition, tags, listing_expires_at, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'active',$8,$9,$10,$11,NOW(),NOW())
       RETURNING *`,
      [userId, listing_type, item_id || null, title, description || null, Number(price_azn),
        JSON.stringify(metadata || {}), image_url || null, condition || "good", tags || null,
        listing_expires_at || null]
    );

    await pool.query(
      `INSERT INTO marketplace_activity_log (event_type, actor_id, actor_username, target_id, target_type, title, amount_azn, status)
       VALUES ('listing_created', $1, $2, $3, $4, $5, $6, 'active')`,
      [userId, username, r.rows[0].id, listing_type, title, Number(price_azn)]
    ).catch(() => {});

    res.status(201).json(r.rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ─── DELETE /marketplace/listings/:id — cancel own listing ───────────────────
router.delete("/marketplace/listings/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const id = Number(req.params.id);
  try {
    const r = await pool.query(
      "UPDATE marketplace_listings SET status='cancelled', updated_at=NOW() WHERE id=$1 AND seller_id=$2 AND status='active' RETURNING id",
      [id, userId]
    );
    if (r.rows.length === 0) { res.status(404).json({ error: "Listing not found or not yours" }); return; }
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ─── POST /marketplace/listings/:id/buy — place buy order ────────────────────
router.post("/marketplace/listings/:id/buy", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const listingId = Number(req.params.id);
  const { message } = req.body;

  try {
    const listingR = await pool.query("SELECT * FROM marketplace_listings WHERE id=$1 AND status='active'", [listingId]);
    if (listingR.rows.length === 0) { res.status(404).json({ error: "Listing not found or no longer active" }); return; }
    const listing = listingR.rows[0];
    if (listing.seller_id === userId) { res.status(400).json({ error: "Cannot buy your own listing" }); return; }

    // Check buyer has enough AZN
    const credR = await pool.query("SELECT azn_balance FROM credits WHERE user_id=$1", [userId]);
    const buyerAzn = credR.rows[0]?.azn_balance ?? 0;
    if (buyerAzn < listing.price_azn) {
      res.status(400).json({ error: `Insufficient AZN balance. Need ${listing.price_azn} AZN, have ${buyerAzn.toFixed(2)} AZN` }); return;
    }

    // Create order (pending admin approval)
    const orderR = await pool.query(
      `INSERT INTO marketplace_orders
        (listing_id, buyer_id, seller_id, price_azn, fee_pct, status, message, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,'pending',$6,NOW(),NOW()) RETURNING *`,
      [listingId, userId, listing.seller_id, listing.price_azn, PLATFORM_FEE_PCT, message || null]
    );

    // Reserve AZN from buyer (escrow — deduct now, refund on reject)
    await pool.query(
      "UPDATE credits SET azn_balance = azn_balance - $1, updated_at=NOW() WHERE user_id=$2",
      [listing.price_azn, userId]
    );

    res.status(201).json({ order: orderR.rows[0], message: "Order placed. Pending admin approval." });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ─── GET /marketplace/orders/my — buyer's orders ─────────────────────────────
router.get("/marketplace/orders/my", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  try {
    const r = await pool.query(
      `SELECT mo.*, ml.title, ml.listing_type, ml.description, ml.metadata,
              su.username as seller_username
       FROM marketplace_orders mo
       JOIN marketplace_listings ml ON ml.id = mo.listing_id
       LEFT JOIN users su ON su.id = mo.seller_id
       WHERE mo.buyer_id = $1
       ORDER BY mo.created_at DESC`,
      [userId]
    );
    res.json(r.rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ─── GET /marketplace/orders/sales — seller's orders ────────────────────────
router.get("/marketplace/orders/sales", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  try {
    const r = await pool.query(
      `SELECT mo.*, ml.title, ml.listing_type, bu.username as buyer_username
       FROM marketplace_orders mo
       JOIN marketplace_listings ml ON ml.id = mo.listing_id
       LEFT JOIN users bu ON bu.id = mo.buyer_id
       WHERE mo.seller_id = $1
       ORDER BY mo.created_at DESC`,
      [userId]
    );
    res.json(r.rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ─── ADMIN: GET /admin/marketplace/orders — all orders ───────────────────────
router.get("/admin/marketplace/orders", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const { status, limit = 50, offset = 0 } = req.query as any;
  try {
    let q = `
      SELECT mo.*, ml.title, ml.listing_type, ml.metadata,
             bu.username as buyer_username, su.username as seller_username
      FROM marketplace_orders mo
      JOIN marketplace_listings ml ON ml.id = mo.listing_id
      LEFT JOIN users bu ON bu.id = mo.buyer_id
      LEFT JOIN users su ON su.id = mo.seller_id
    `;
    const params: any[] = [];
    if (status) { q += ` WHERE mo.status = $${params.length + 1}`; params.push(status); }
    q += ` ORDER BY mo.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(Number(limit), Number(offset));
    const r = await pool.query(q, params);

    const countQ = `SELECT COUNT(*) FROM marketplace_orders${status ? " WHERE status=$1" : ""}`;
    const countR = await pool.query(countQ, status ? [status] : []);

    res.json({ orders: r.rows, total: Number(countR.rows[0].count) });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ─── ADMIN: GET /admin/marketplace/listings — all listings ───────────────────
router.get("/admin/marketplace/listings", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  try {
    const r = await pool.query(
      `SELECT ml.*, u.username as seller_username
       FROM marketplace_listings ml
       LEFT JOIN users u ON u.id = ml.seller_id
       ORDER BY ml.created_at DESC LIMIT 100`
    );
    res.json(r.rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ─── ADMIN: PATCH /admin/marketplace/orders/:id — approve or reject ──────────
router.patch("/admin/marketplace/orders/:id", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const { action, admin_note } = req.body; // action: "approve" | "reject"

  if (!["approve", "reject"].includes(action)) {
    res.status(400).json({ error: "action must be 'approve' or 'reject'" }); return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const orderR = await client.query("SELECT * FROM marketplace_orders WHERE id=$1 FOR UPDATE", [id]);
    if (orderR.rows.length === 0) { res.status(404).json({ error: "Order not found" }); return; }
    const order = orderR.rows[0];

    if (order.status !== "pending") {
      await client.query("ROLLBACK");
      res.status(400).json({ error: `Order already ${order.status}` }); return;
    }

    if (action === "reject") {
      // Refund AZN to buyer
      await client.query(
        "UPDATE credits SET azn_balance = azn_balance + $1, updated_at=NOW() WHERE user_id=$2",
        [order.price_azn, order.buyer_id]
      );
      await client.query(
        "UPDATE marketplace_orders SET status='rejected', admin_note=$1, resolved_at=NOW(), updated_at=NOW() WHERE id=$2",
        [admin_note || null, id]
      );
    } else {
      // Approve: calculate fee, pay seller net amount
      const feePct = order.fee_pct ?? PLATFORM_FEE_PCT;
      const feeAzn = (order.price_azn * feePct) / 100;
      const sellerReceives = order.price_azn - feeAzn;

      // Pay seller
      await client.query(
        "INSERT INTO credits (user_id, balance, azn_balance, total_purchased, total_spent) VALUES ($1,0,$2,0,0) ON CONFLICT (user_id) DO UPDATE SET azn_balance = credits.azn_balance + $2, updated_at=NOW()",
        [order.seller_id, sellerReceives]
      );

      // Mark listing as sold
      await client.query(
        "UPDATE marketplace_listings SET status='sold', buyer_id=$1, sold_at=NOW(), updated_at=NOW() WHERE id=$2",
        [order.buyer_id, order.listing_id]
      );

      await client.query(
        "UPDATE marketplace_orders SET status='approved', fee_azn=$1, seller_receives=$2, admin_note=$3, resolved_at=NOW(), updated_at=NOW() WHERE id=$4",
        [feeAzn, sellerReceives, admin_note || null, id]
      );

      // Record platform fee transaction
      await client.query(
        `INSERT INTO credit_transactions (user_id, type, azn_amount, notes, status, created_at, updated_at)
         VALUES ($1, 'marketplace_fee', $2, 'P2P marketplace fee', 'completed', NOW(), NOW())`,
        [order.seller_id, feeAzn]
      );
    }

    await client.query("COMMIT");

    // Notify buyer and seller
    const notifMsg = action === "approve"
      ? `Your order has been approved!`
      : `Your order was rejected.${admin_note ? ` Reason: ${admin_note}` : ""}`;

    pool.query(
      `INSERT INTO notifications (user_id, type, title, message, is_read) VALUES ($1,'marketplace',$2,$3,false)`,
      [order.buyer_id, `Order ${action === "approve" ? "Approved" : "Rejected"}`, notifMsg]
    ).catch(() => {});

    res.json({ ok: true, action });
  } catch (e: any) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

// ─── GET /marketplace/vault-items — user's vault items available to sell ─────
router.get("/marketplace/vault-items", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  try {
    const [entities, localAccounts] = await Promise.all([
      pool.query(
        `SELECT id, name, 'entity' as item_type, platform_type, notes FROM vault_entries WHERE user_id = $1 ORDER BY name`,
        [userId]
      ).catch(() => ({ rows: [] })),
      pool.query(
        `SELECT id, username, 'local_account' as item_type, platform_name, notes FROM local_accounts WHERE user_id = $1 ORDER BY username`,
        [userId]
      ).catch(() => ({ rows: [] })),
    ]);
    res.json({
      entities: entities.rows,
      local_accounts: localAccounts.rows,
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ─── POST /marketplace/listings — create a listing (with image support) ───────
// (override the existing one below this comment — the existing route will be removed)

// ─── GET /admin/marketplace/activity — marketplace activity log ───────────────
router.get("/admin/marketplace/activity", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const { event_type, limit = 50, offset = 0 } = req.query as any;
  try {
    let q = `SELECT * FROM marketplace_activity_log`;
    const params: any[] = [];
    if (event_type) { q += ` WHERE event_type = $${params.length + 1}`; params.push(event_type); }
    q += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(Number(limit), Number(offset));
    const r = await pool.query(q, params);
    const countQ = `SELECT COUNT(*) FROM marketplace_activity_log${event_type ? " WHERE event_type=$1" : ""}`;
    const countR = await pool.query(countQ, event_type ? [event_type] : []);
    res.json({ entries: r.rows, total: Number(countR.rows[0].count) });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ─── GET /marketplace/stats — public stats ────────────────────────────────────
router.get("/marketplace/stats", async (_req, res): Promise<void> => {
  try {
    const r = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM marketplace_listings WHERE status='active') as active_listings,
        (SELECT COUNT(*) FROM marketplace_orders WHERE status='approved') as completed_trades,
        (SELECT COALESCE(SUM(price_azn),0) FROM marketplace_orders WHERE status='approved') as total_volume_azn,
        (SELECT COALESCE(SUM(fee_azn),0) FROM marketplace_orders WHERE status='approved') as total_fees_azn
    `);
    res.json(r.rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ─── GET /marketplace/azn/chart — AZN price chart data ───────────────────────
router.get("/marketplace/azn/chart", async (_req, res): Promise<void> => {
  try {
    // Generate deterministic daily OHLCV data for AZN
    // 100 AZN = $1 USD so base price = 0.01 USD per AZN
    const BASE_PRICE = 0.01; // USD per AZN
    const days = 30;
    const now = new Date();
    const data = [];

    let price = BASE_PRICE;
    for (let i = days; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().slice(0, 10);

      // Seed based on date for determinism
      const seed = date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
      const pseudoRand = (s: number) => ((s * 1664525 + 1013904223) & 0x7FFFFFFF) / 0x7FFFFFFF;

      const r1 = pseudoRand(seed);
      const r2 = pseudoRand(seed + 1);
      const r3 = pseudoRand(seed + 2);
      const r4 = pseudoRand(seed + 3);

      // Daily swing: up to ±8% intraday but close within ±2% of open
      const intraSwing = (r1 - 0.5) * 0.08;
      const closeAdj = (r2 - 0.5) * 0.02;

      const open = price;
      const high = price * (1 + Math.abs(intraSwing) + r3 * 0.02);
      const low = price * (1 - Math.abs(intraSwing) - r4 * 0.02);
      const close = price * (1 + closeAdj);

      data.push({
        date: dateStr,
        open: Number(open.toFixed(5)),
        high: Number(high.toFixed(5)),
        low: Number(low.toFixed(5)),
        close: Number(close.toFixed(5)),
        volume: Math.floor(10000 + r1 * 90000),
        price_usd: Number(close.toFixed(5)),
        azn_per_usd: Math.round(1 / close),
      });

      price = close; // next day opens where today closed
    }

    // Always ensure latest price stays near base (stable)
    const last = data[data.length - 1];
    last.close = BASE_PRICE * (1 + (Math.random() - 0.5) * 0.01);
    last.price_usd = last.close;
    last.azn_per_usd = Math.round(1 / last.close);

    res.json({ base_usd: BASE_PRICE, azn_per_usd: 100, data });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
