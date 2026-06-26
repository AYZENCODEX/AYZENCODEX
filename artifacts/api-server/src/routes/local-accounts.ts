import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();

const DEFAULT_CATEGORIES = [
  { id: "facebook",  name: "Facebook",  color: "#1877F2", icon: "facebook" },
  { id: "github",    name: "GitHub",    color: "#24292e", icon: "github" },
  { id: "google",    name: "Google",    color: "#EA4335", icon: "google" },
  { id: "twitter",   name: "Twitter",   color: "#1DA1F2", icon: "twitter" },
  { id: "discord",   name: "Discord",   color: "#5865F2", icon: "discord" },
];

// Safely escape a string for SQL — only used for string values; integers are coerced with Number()
const safe = (v: unknown) => v === null || v === undefined ? "NULL" : `'${String(v).replace(/'/g, "''")}'`;
const safeNum = (v: unknown) => isNaN(Number(v)) ? 0 : Number(v);
const safeDate = (v: unknown) => v ? `'${String(v).replace(/'/g, "''")}'` : "NULL";

// ─── GET /local-accounts — list user's accounts ───────────────────────────────
router.get("/local-accounts", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const category = (req.query.category as string) || null;
  try {
    const q = category
      ? sql.raw(`SELECT * FROM local_accounts WHERE user_id = ${userId} AND category = ${safe(category)} ORDER BY created_at DESC`)
      : sql.raw(`SELECT * FROM local_accounts WHERE user_id = ${userId} ORDER BY created_at DESC`);
    const result = await db.execute(q);
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: "DB error", detail: err?.message });
  }
});

// ─── POST /local-accounts — create account ────────────────────────────────────
router.post("/local-accounts", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const {
    category = "Other", label = null, username = null,
    email = null, password = null,
    recoveryEmail = null, recoveryEmailPassword = null,
    backupCodes = null, twofa = null, recoveryEmailTwofa = null,
    followers = null, accountWorth = 0, buyPrice = 0,
    accountCreateDate = null, accountBuyDate = null, accountLastLoginDate = null,
    notes = null,
  } = req.body;

  if (!category) { res.status(400).json({ error: "Category required" }); return; }

  try {
    const result = await db.execute(sql.raw(`
      INSERT INTO local_accounts
        (user_id, category, label, username, email, password, recovery_email, recovery_email_password,
         backup_codes, twofa, recovery_email_twofa, followers, account_worth, buy_price,
         account_create_date, account_buy_date, account_last_login_date, notes)
      VALUES
        (${userId}, ${safe(category)}, ${safe(label)}, ${safe(username)}, ${safe(email)}, ${safe(password)},
         ${safe(recoveryEmail)}, ${safe(recoveryEmailPassword)}, ${safe(backupCodes)}, ${safe(twofa)},
         ${safe(recoveryEmailTwofa)}, ${safe(followers)}, ${safeNum(accountWorth)}, ${safeNum(buyPrice)},
         ${safeDate(accountCreateDate)}, ${safeDate(accountBuyDate)}, ${safeDate(accountLastLoginDate)},
         ${safe(notes)})
      RETURNING *
    `));
    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: "DB error", detail: err?.message });
  }
});

// ─── PUT /local-accounts/:id — update account ────────────────────────────────
router.put("/local-accounts/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const {
    category, label, username, email, password,
    recoveryEmail, recoveryEmailPassword,
    backupCodes, twofa, recoveryEmailTwofa,
    followers, accountWorth, buyPrice,
    accountCreateDate, accountBuyDate, accountLastLoginDate, notes,
  } = req.body;

  try {
    const result = await db.execute(sql.raw(`
      UPDATE local_accounts SET
        category = ${safe(category)}, label = ${safe(label)}, username = ${safe(username)},
        email = ${safe(email)}, password = ${safe(password)},
        recovery_email = ${safe(recoveryEmail)}, recovery_email_password = ${safe(recoveryEmailPassword)},
        backup_codes = ${safe(backupCodes)}, twofa = ${safe(twofa)},
        recovery_email_twofa = ${safe(recoveryEmailTwofa)},
        followers = ${safe(followers)}, account_worth = ${safeNum(accountWorth)},
        buy_price = ${safeNum(buyPrice)},
        account_create_date = ${safeDate(accountCreateDate)},
        account_buy_date = ${safeDate(accountBuyDate)},
        account_last_login_date = ${safeDate(accountLastLoginDate)},
        notes = ${safe(notes)}, updated_at = NOW()
      WHERE id = ${id} AND user_id = ${userId}
      RETURNING *
    `));
    if (!result.rows.length) { res.status(404).json({ error: "Not found or forbidden" }); return; }
    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: "DB error", detail: err?.message });
  }
});

// ─── DELETE /local-accounts/:id — delete account ─────────────────────────────
router.delete("/local-accounts/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  try {
    await db.execute(sql.raw(`DELETE FROM local_accounts WHERE id = ${id} AND user_id = ${userId}`));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "DB error", detail: err?.message });
  }
});

// ─── GET /local-accounts/categories — list categories ────────────────────────
router.get("/local-accounts/categories", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  try {
    const result = await db.execute(sql.raw(
      `SELECT * FROM local_account_categories WHERE user_id = ${userId} ORDER BY created_at ASC`
    ));
    res.json({ defaults: DEFAULT_CATEGORIES, custom: result.rows });
  } catch (err: any) {
    res.status(500).json({ error: "DB error", detail: err?.message });
  }
});

// ─── POST /local-accounts/categories — create category ───────────────────────
router.post("/local-accounts/categories", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const { name } = req.body;
  if (!name?.trim()) { res.status(400).json({ error: "Category name required" }); return; }
  try {
    const result = await db.execute(sql.raw(
      `INSERT INTO local_account_categories (user_id, name) VALUES (${userId}, ${safe(name.trim())}) RETURNING *`
    ));
    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: "DB error", detail: err?.message });
  }
});

// ─── DELETE /local-accounts/categories/:id — delete category ─────────────────
router.delete("/local-accounts/categories/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  try {
    await db.execute(sql.raw(`DELETE FROM local_account_categories WHERE id = ${id} AND user_id = ${userId}`));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "DB error", detail: err?.message });
  }
});

// ─── GET /local-accounts/:id/points ──────────────────────────────────────────
router.get("/local-accounts/:id/points", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const accountId = parseInt(req.params.id as string);
  if (isNaN(accountId)) { res.status(400).json({ error: "Invalid ID" }); return; }
  try {
    const result = await db.execute(sql.raw(
      `SELECT * FROM local_account_points WHERE account_id = ${accountId} AND user_id = ${userId} ORDER BY created_at DESC`
    ));
    const rows = result.rows as any[];
    const total = rows.reduce((s: number, r: any) => s + Number(r.amount ?? 0), 0);
    res.json({ entries: rows, total });
  } catch (err: any) {
    res.status(500).json({ error: "DB error", detail: err?.message });
  }
});

// ─── POST /local-accounts/:id/points ─────────────────────────────────────────
router.post("/local-accounts/:id/points", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const accountId = parseInt(req.params.id as string);
  if (isNaN(accountId)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const { amount, notes = null } = req.body;
  if (!amount || isNaN(Number(amount))) { res.status(400).json({ error: "amount required" }); return; }
  try {
    const result = await db.execute(sql.raw(
      `INSERT INTO local_account_points (account_id, user_id, amount, notes) VALUES (${accountId}, ${userId}, ${Number(amount)}, ${safe(notes)}) RETURNING *`
    ));
    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: "DB error", detail: err?.message });
  }
});

// ─── DELETE /local-accounts/points/:pointId ──────────────────────────────────
router.delete("/local-accounts/points/:pointId", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const pointId = parseInt(req.params.pointId as string);
  if (isNaN(pointId)) { res.status(400).json({ error: "Invalid ID" }); return; }
  try {
    await db.execute(sql.raw(`DELETE FROM local_account_points WHERE id = ${pointId} AND user_id = ${userId}`));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "DB error", detail: err?.message });
  }
});

export default router;
