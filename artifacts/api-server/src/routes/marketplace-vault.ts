import { Router } from "express";
import { pool } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router = Router();
const FEE_PCT = 5;

async function ensureWallet(userId: number): Promise<number> {
  await pool.query(
    `INSERT INTO marketplace_wallets (user_id, market_type, balance, locked_balance)
     VALUES ($1, 'vault', 0, 0) ON CONFLICT (user_id, market_type) DO NOTHING`,
    [userId]
  );
  const r = await pool.query(
    "SELECT balance FROM marketplace_wallets WHERE user_id=$1 AND market_type='vault'",
    [userId]
  );
  return Number(r.rows[0]?.balance ?? 0);
}

function maskVaultEntry(entry: any) {
  if (!entry) return null;
  return {
    project_name: entry.project_name,
    category: entry.category,
    has_twitter: !!entry.twitter_username,
    has_discord: !!entry.discord_username,
    has_telegram: !!entry.telegram_username,
    has_email: !!entry.email,
    has_wallet: !!(entry.wallet_addresses),
    entity_serial: entry.entity_serial,
    tier_hint: entry.other_accounts ? "multi" : "single",
  };
}

// ── 1. GET /marketplace/vault/listings ───────────────────────────────────────
router.get("/marketplace/vault/listings", requireAuth, async (req, res): Promise<void> => {
  const { limit = 50, offset = 0, category, min_price, max_price } = req.query as any;
  try {
    let q = `
      SELECT vl.*, u.username AS seller_username
      FROM vault_market_listings vl
      LEFT JOIN users u ON u.id = vl.seller_id
      WHERE vl.status = 'active'
    `;
    const params: any[] = [];
    if (category) { params.push(category); q += ` AND vl.category = $${params.length}`; }
    if (min_price) { params.push(Number(min_price)); q += ` AND vl.price >= $${params.length}`; }
    if (max_price) { params.push(Number(max_price)); q += ` AND vl.price <= $${params.length}`; }
    q += ` ORDER BY vl.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(Number(limit), Number(offset));
    const r = await pool.query(q, params);
    const cnt = await pool.query("SELECT COUNT(*) FROM vault_market_listings WHERE status='active'");
    const listings = r.rows.map(row => ({
      ...row,
      preview_data: row.preview_data ? JSON.parse(row.preview_data) : null,
    }));
    res.json({ listings, total: Number(cnt.rows[0].count), fee_pct: FEE_PCT });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── 2. POST /marketplace/vault/listings — list a vault entry for sale ─────────
router.post("/marketplace/vault/listings", requireAuth, async (req, res): Promise<void> => {
  const sellerId = req.user!.userId;
  const { vault_entry_id, title, description, price, category, tier = "basic" } = req.body;
  if (!title || !price) { res.status(400).json({ error: "title and price required" }); return; }
  try {
    let previewData = null;
    if (vault_entry_id) {
      const ve = await pool.query(
        "SELECT * FROM vault_entries WHERE id=$1 AND user_id=$2",
        [vault_entry_id, sellerId]
      );
      if (ve.rows[0]) previewData = JSON.stringify(maskVaultEntry(ve.rows[0]));
    }
    const r = await pool.query(
      `INSERT INTO vault_market_listings
         (seller_id, vault_entry_id, title, description, price, category, tier, preview_data)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [sellerId, vault_entry_id ?? null, title, description ?? null,
       Number(price), category ?? "Social", tier, previewData]
    );
    res.json({ ...r.rows[0], preview_data: previewData ? JSON.parse(previewData) : null });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── 3. POST /marketplace/vault/buy ────────────────────────────────────────────
router.post("/marketplace/vault/buy", requireAuth, async (req, res): Promise<void> => {
  const buyerId = req.user!.userId;
  const { listing_id } = req.body;
  if (!listing_id) { res.status(400).json({ error: "listing_id required" }); return; }
  try {
    const listR = await pool.query("SELECT * FROM vault_market_listings WHERE id=$1 AND status='active'", [listing_id]);
    if (!listR.rows[0]) { res.status(404).json({ error: "Listing not found or sold" }); return; }
    const listing = listR.rows[0];
    if (listing.seller_id === buyerId) { res.status(400).json({ error: "Cannot buy your own listing" }); return; }
    const balance = await ensureWallet(buyerId);
    if (balance < Number(listing.price)) { res.status(400).json({ error: "Insufficient vault wallet balance" }); return; }
    const fee = Number(listing.price) * (FEE_PCT / 100);
    const net = Number(listing.price) - fee;
    await pool.query("BEGIN");
    try {
      await pool.query(
        "UPDATE marketplace_wallets SET balance=balance-$1, updated_at=NOW() WHERE user_id=$2 AND market_type='vault'",
        [Number(listing.price), buyerId]
      );
      await pool.query(
        "UPDATE marketplace_wallets SET balance=balance+$1, updated_at=NOW() WHERE user_id=$2 AND market_type='vault'",
        [net, listing.seller_id]
      );
      await pool.query(
        "UPDATE vault_market_listings SET status='sold', buyer_id=$1, sold_at=NOW() WHERE id=$2",
        [buyerId, listing_id]
      );
      if (listing.vault_entry_id) {
        await pool.query(
          "UPDATE vault_entries SET user_id=$1 WHERE id=$2 AND user_id=$3",
          [buyerId, listing.vault_entry_id, listing.seller_id]
        );
      }
      await pool.query(
        `INSERT INTO marketplace_transactions (market_type,listing_id,buyer_id,seller_id,amount,fee,net_amount)
         VALUES ('vault',$1,$2,$3,$4,$5,$6)`,
        [listing_id, buyerId, listing.seller_id, Number(listing.price), fee, net]
      );
      await pool.query("COMMIT");
      res.json({ ok: true, title: listing.title, price: Number(listing.price), fee, net });
    } catch (e) { await pool.query("ROLLBACK"); throw e; }
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── 4. DELETE /marketplace/vault/listings/:id ─────────────────────────────────
router.delete("/marketplace/vault/listings/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const { id } = req.params;
  try {
    const r = await pool.query("SELECT * FROM vault_market_listings WHERE id=$1 AND status='active'", [id]);
    if (!r.rows[0]) { res.status(404).json({ error: "Not found" }); return; }
    const listing = r.rows[0];
    if (listing.seller_id !== userId && req.user!.role !== "admin") { res.status(403).json({ error: "Forbidden" }); return; }
    await pool.query("UPDATE vault_market_listings SET status='cancelled' WHERE id=$1", [id]);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── 5. GET /marketplace/vault/stats ──────────────────────────────────────────
router.get("/marketplace/vault/stats", requireAuth, async (_req, res): Promise<void> => {
  try {
    const [active, volume, cats] = await Promise.all([
      pool.query("SELECT COUNT(*) as cnt, MIN(price) as floor, AVG(price) as avg_price FROM vault_market_listings WHERE status='active'"),
      pool.query("SELECT SUM(amount) as vol, COUNT(*) as sales FROM marketplace_transactions WHERE market_type='vault'"),
      pool.query("SELECT category, COUNT(*) as cnt FROM vault_market_listings WHERE status='active' GROUP BY category"),
    ]);
    res.json({
      active_listings: Number(active.rows[0].cnt),
      floor_price: Number(active.rows[0].floor ?? 0),
      avg_price: Number(active.rows[0].avg_price ?? 0),
      total_volume: Number(volume.rows[0].vol ?? 0),
      total_sales: Number(volume.rows[0].sales),
      category_breakdown: cats.rows,
      fee_pct: FEE_PCT,
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
