import { Router } from "express";
import { db, vaultEntriesTable, usersTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import * as crypto from "crypto";
import { broadcastEvent } from "./events";
import { requireAuth, requireAdmin } from "../middlewares/auth";

const router = Router();

function generateSerial(userId: number): string {
  const ts = Date.now().toString(36).toUpperCase().slice(-4);
  const rand = crypto.randomBytes(2).toString("hex").toUpperCase();
  return `AYZN${userId}-${ts}${rand}`;
}

// ─── Seed-phrase encryption (AES-256-GCM, server-side key) ───────────────────
const SEED_KEY = process.env.SESSION_SECRET ?? "ayzen_default_seed_key_32bytes!!";
const KEY_BUF = crypto.scryptSync(SEED_KEY, "ayzen_seed_salt", 32);

function encryptSeedPhrase(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", KEY_BUF, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return iv.toString("hex") + ":" + tag.toString("hex") + ":" + enc.toString("hex");
}

function decryptSeedPhrase(stored: string): string | null {
  try {
    const [ivHex, tagHex, encHex] = stored.split(":");
    const iv = Buffer.from(ivHex, "hex");
    const tag = Buffer.from(tagHex, "hex");
    const enc = Buffer.from(encHex, "hex");
    const decipher = crypto.createDecipheriv("aes-256-gcm", KEY_BUF, iv);
    decipher.setAuthTag(tag);
    return decipher.update(enc).toString("utf8") + decipher.final("utf8");
  } catch { return null; }
}

// ─── SAFE_COLS — raw SQL fallback ────────────────────────────────────────────
const SAFE_COLS = `id, user_id, entity_serial, category, project_name,
  email, email_password,
  twitter_username, twitter_password,
  discord_username, discord_password,
  telegram_username, telegram_password,
  wallet_addresses, backup_codes, notes,
  created_at, updated_at,
  null::text as email_recovery, null::text as email_recovery_password,
  null::text as twitter_email, null::text as twitter_email_password,
  null::text as twitter_followers, null::text as twitter_2fa,
  null::text as twitter_email_recovery, null::text as twitter_email_recovery_password,
  null::text as discord_email, null::text as discord_email_password,
  null::text as discord_2fa, null::text as discord_email_recovery,
  null::text as discord_email_recovery_password,
  null::text as telegram_phone, null::text as telegram_2fa,
  null::text as telegram_linked_email, null::text as telegram_linked_email_password,
  null::text as encrypted_seed_phrase, null::text as status, null::timestamp as last_activity_at`;

async function selectVault(userId: number): Promise<Record<string, unknown>[]> {
  try {
    return (await db.select().from(vaultEntriesTable).where(eq(vaultEntriesTable.userId, userId))) as unknown as Record<string, unknown>[];
  } catch {
    const res = await db.execute(sql.raw(`SELECT ${SAFE_COLS} FROM vault_entries WHERE user_id = ${userId}`));
    return res.rows as Record<string, unknown>[];
  }
}

async function selectVaultOne(id: number, userId: number): Promise<Record<string, unknown> | null> {
  try {
    const rows = await db.select().from(vaultEntriesTable).where(and(eq(vaultEntriesTable.id, id), eq(vaultEntriesTable.userId, userId)));
    return (rows[0] as unknown as Record<string, unknown>) ?? null;
  } catch {
    const res = await db.execute(sql.raw(`SELECT ${SAFE_COLS} FROM vault_entries WHERE id = ${id} AND user_id = ${userId}`));
    return (res.rows[0] as Record<string, unknown>) ?? null;
  }
}

function formatRow(e: Record<string, unknown>, revealSeed = false) {
  const walStr = e.wallet_addresses ?? e.walletAddresses;
  const bkStr = e.backup_codes ?? e.backupCodes;
  const encSeed = e.encrypted_seed_phrase ?? e.encryptedSeedPhrase ?? null;
  return {
    id: e.id,
    userId: e.user_id ?? e.userId,
    entitySerial: e.entity_serial ?? e.entitySerial,
    category: e.category,
    projectName: e.project_name ?? e.projectName,
    email: e.email,
    emailPassword: e.email_password ?? e.emailPassword,
    emailRecovery: e.email_recovery ?? e.emailRecovery ?? null,
    emailRecoveryPassword: e.email_recovery_password ?? e.emailRecoveryPassword ?? null,
    twitterUsername: e.twitter_username ?? e.twitterUsername,
    twitterPassword: e.twitter_password ?? e.twitterPassword,
    twitterEmail: e.twitter_email ?? e.twitterEmail ?? null,
    twitterEmailPassword: e.twitter_email_password ?? e.twitterEmailPassword ?? null,
    twitterFollowers: e.twitter_followers ?? e.twitterFollowers ?? null,
    twitter2fa: e.twitter_2fa ?? e.twitter2fa ?? null,
    twitterEmailRecovery: e.twitter_email_recovery ?? e.twitterEmailRecovery ?? null,
    twitterEmailRecoveryPassword: e.twitter_email_recovery_password ?? e.twitterEmailRecoveryPassword ?? null,
    discordUsername: e.discord_username ?? e.discordUsername,
    discordPassword: e.discord_password ?? e.discordPassword,
    discordEmail: e.discord_email ?? e.discordEmail ?? null,
    discordEmailPassword: e.discord_email_password ?? e.discordEmailPassword ?? null,
    discord2fa: e.discord_2fa ?? e.discord2fa ?? null,
    discordEmailRecovery: e.discord_email_recovery ?? e.discordEmailRecovery ?? null,
    discordEmailRecoveryPassword: e.discord_email_recovery_password ?? e.discordEmailRecoveryPassword ?? null,
    telegramUsername: e.telegram_username ?? e.telegramUsername,
    telegramPassword: e.telegram_password ?? e.telegramPassword,
    telegramPhone: e.telegram_phone ?? e.telegramPhone ?? null,
    telegram2fa: e.telegram_2fa ?? e.telegram2fa ?? null,
    telegramLinkedEmail: e.telegram_linked_email ?? e.telegramLinkedEmail ?? null,
    telegramLinkedEmailPassword: e.telegram_linked_email_password ?? e.telegramLinkedEmailPassword ?? null,
    walletAddresses: walStr ? (() => { try { return JSON.parse(walStr as string); } catch { return []; } })() : [],
    backupCodes: bkStr ? (() => { try { return JSON.parse(bkStr as string); } catch { return []; } })() : [],
    notes: e.notes,
    otherAccounts: e.other_accounts ?? e.otherAccounts ?? null,
    status: e.status ?? "active",
    lastActivityAt: e.last_activity_at ?? e.lastActivityAt ?? null,
    // Seed phrase: only returned if explicitly revealed; always masked in lists
    hasSeedPhrase: !!encSeed,
    seedPhrase: revealSeed && encSeed ? decryptSeedPhrase(encSeed as string) : undefined,
    createdAt: e.created_at ? new Date(e.created_at as string).toISOString() : e.createdAt,
    updatedAt: e.updated_at ? new Date(e.updated_at as string).toISOString() : e.updatedAt,
  };
}

const NEW_VAULT_FIELDS: (keyof typeof vaultEntriesTable.$inferInsert)[] = [
  "emailRecovery", "emailRecoveryPassword",
  "twitterEmail", "twitterEmailPassword", "twitterFollowers", "twitter2fa",
  "twitterEmailRecovery", "twitterEmailRecoveryPassword",
  "discordEmail", "discordEmailPassword", "discord2fa",
  "discordEmailRecovery", "discordEmailRecoveryPassword",
  "telegramPhone", "telegram2fa", "telegramLinkedEmail", "telegramLinkedEmailPassword",
];

// ─── GET /vault — list user's vault entries ──────────────────────────────────
router.get("/vault", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const entries = await selectVault(userId);
  res.json(entries.map(e => formatRow(e)));
});

// ─── POST /vault — create vault entry ────────────────────────────────────────
router.post("/vault", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const {
    category, projectName,
    email, emailPassword,
    twitterUsername, twitterPassword,
    discordUsername, discordPassword,
    telegramUsername, telegramPassword,
    walletAddresses, backupCodes, notes, otherAccounts,
    seedPhrase, // plaintext — will be encrypted before storage
    emailRecovery, emailRecoveryPassword,
    twitterEmail, twitterEmailPassword, twitterFollowers, twitter2fa,
    twitterEmailRecovery, twitterEmailRecoveryPassword,
    discordEmail, discordEmailPassword, discord2fa,
    discordEmailRecovery, discordEmailRecoveryPassword,
    telegramPhone, telegram2fa, telegramLinkedEmail, telegramLinkedEmailPassword,
  } = req.body;

  if (!category || !projectName) {
    res.status(400).json({ error: "category and projectName are required" });
    return;
  }

  const serial = generateSerial(userId);
  const encryptedSeedPhrase = seedPhrase ? encryptSeedPhrase(seedPhrase) : null;

  const baseValues: Record<string, unknown> = {
    userId, entitySerial: serial, category, projectName,
    email: email || null, emailPassword: emailPassword || null,
    twitterUsername: twitterUsername || null, twitterPassword: twitterPassword || null,
    discordUsername: discordUsername || null, discordPassword: discordPassword || null,
    telegramUsername: telegramUsername || null, telegramPassword: telegramPassword || null,
    walletAddresses: walletAddresses ? JSON.stringify(walletAddresses) : null,
    backupCodes: backupCodes ? JSON.stringify(backupCodes) : null,
    notes: notes || null,
    otherAccounts: otherAccounts || null,
  };

  let entry: Record<string, unknown>;
  try {
    const [row] = await db.insert(vaultEntriesTable).values({
      ...baseValues,
      encryptedSeedPhrase,
      emailRecovery: emailRecovery || null,
      emailRecoveryPassword: emailRecoveryPassword || null,
      twitterEmail: twitterEmail || null,
      twitterEmailPassword: twitterEmailPassword || null,
      twitterFollowers: twitterFollowers || null,
      twitter2fa: twitter2fa || null,
      twitterEmailRecovery: twitterEmailRecovery || null,
      twitterEmailRecoveryPassword: twitterEmailRecoveryPassword || null,
      discordEmail: discordEmail || null,
      discordEmailPassword: discordEmailPassword || null,
      discord2fa: discord2fa || null,
      discordEmailRecovery: discordEmailRecovery || null,
      discordEmailRecoveryPassword: discordEmailRecoveryPassword || null,
      telegramPhone: telegramPhone || null,
      telegram2fa: telegram2fa || null,
      telegramLinkedEmail: telegramLinkedEmail || null,
      telegramLinkedEmailPassword: telegramLinkedEmailPassword || null,
    } as typeof vaultEntriesTable.$inferInsert).returning();
    entry = row as unknown as Record<string, unknown>;
  } catch {
    // New columns not in Drizzle schema yet — insert without them
    const [row] = await db.insert(vaultEntriesTable).values(baseValues as typeof vaultEntriesTable.$inferInsert).returning();
    entry = row as unknown as Record<string, unknown>;
  }

  broadcastEvent("vault_updated", { action: "created", entryId: entry.id });
  res.status(201).json(formatRow(entry));
});

// ─── GET /vault/:id — get single entry ───────────────────────────────────────
router.get("/vault/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const userId = req.user!.userId;
  const entry = await selectVaultOne(id, userId);
  if (!entry) { res.status(404).json({ error: "Vault entry not found" }); return; }
  res.json(formatRow(entry));
});

// ─── GET /vault/:id/seed — reveal decrypted seed phrase (explicit opt-in) ───
router.get("/vault/:id/seed", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const userId = req.user!.userId;
  const entry = await selectVaultOne(id, userId);
  if (!entry) { res.status(404).json({ error: "Vault entry not found" }); return; }
  const encSeed = entry.encrypted_seed_phrase ?? entry.encryptedSeedPhrase ?? null;
  if (!encSeed) { res.status(404).json({ error: "No seed phrase stored for this entity" }); return; }
  const plaintext = decryptSeedPhrase(encSeed as string);
  if (!plaintext) { res.status(500).json({ error: "Failed to decrypt seed phrase" }); return; }
  res.json({ seedPhrase: plaintext });
});

// ─── PATCH /vault/:id — update vault entry ───────────────────────────────────
router.patch("/vault/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const userId = req.user!.userId;

  const baseFields = [
    "category", "projectName", "email", "emailPassword",
    "twitterUsername", "twitterPassword",
    "discordUsername", "discordPassword",
    "telegramUsername", "telegramPassword",
    "notes",
  ];
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  for (const f of baseFields) {
    if (req.body[f] !== undefined) updates[f] = req.body[f];
  }
  for (const f of NEW_VAULT_FIELDS) {
    if (req.body[f] !== undefined) updates[f] = req.body[f];
  }
  if (req.body.walletAddresses !== undefined) updates.walletAddresses = JSON.stringify(req.body.walletAddresses);
  if (req.body.backupCodes !== undefined) updates.backupCodes = JSON.stringify(req.body.backupCodes);
  if (req.body.seedPhrase !== undefined) {
    updates.encryptedSeedPhrase = req.body.seedPhrase ? encryptSeedPhrase(req.body.seedPhrase) : null;
  }
  if (req.body.status !== undefined) {
    const allowed = ["active", "warning", "banned", "suspended"];
    if (allowed.includes(req.body.status)) {
      updates.status = req.body.status;
      updates.lastActivityAt = new Date();
    }
  }

  let entry: Record<string, unknown>;
  try {
    const [row] = await db.update(vaultEntriesTable)
      .set(updates as Partial<typeof vaultEntriesTable.$inferInsert>)
      .where(and(eq(vaultEntriesTable.id, id), eq(vaultEntriesTable.userId, userId)))
      .returning();
    if (!row) { res.status(404).json({ error: "Vault entry not found" }); return; }
    entry = row as unknown as Record<string, unknown>;
  } catch {
    // Strip new fields and retry with base fields only
    for (const f of NEW_VAULT_FIELDS) delete updates[f];
    delete updates.encryptedSeedPhrase;
    delete updates.status;
    delete updates.lastActivityAt;
    const [row] = await db.update(vaultEntriesTable)
      .set(updates as Partial<typeof vaultEntriesTable.$inferInsert>)
      .where(and(eq(vaultEntriesTable.id, id), eq(vaultEntriesTable.userId, userId)))
      .returning();
    if (!row) { res.status(404).json({ error: "Vault entry not found" }); return; }
    entry = row as unknown as Record<string, unknown>;
  }

  broadcastEvent("vault_updated", { action: "updated", entryId: id });
  res.json(formatRow(entry));
});

// ─── DELETE /vault/:id — delete vault entry ──────────────────────────────────
router.delete("/vault/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const userId = req.user!.userId;
  await db.delete(vaultEntriesTable).where(and(eq(vaultEntriesTable.id, id), eq(vaultEntriesTable.userId, userId)));
  broadcastEvent("vault_updated", { action: "deleted", entryId: id });
  res.json({ message: "Vault entry deleted" });
});

// ─── GET /admin/vault — admin view of all entries ────────────────────────────
router.get("/admin/vault", requireAdmin, async (req, res): Promise<void> => {
  try {
    const entries = await db
      .select({ entry: vaultEntriesTable, username: usersTable.username, userEmail: usersTable.email })
      .from(vaultEntriesTable)
      .leftJoin(usersTable, eq(vaultEntriesTable.userId, usersTable.id));
    res.json(entries.map(({ entry, username, userEmail }) => ({
      ...formatRow(entry as unknown as Record<string, unknown>),
      username,
      userEmail,
    })));
  } catch {
    const rows = await selectVault(0);
    res.json(rows.map(e => formatRow(e)));
  }
});

// ─── GET /admin/vault/full — full unencrypted vault for admin ─────────────────
router.get("/admin/vault/full", requireAdmin, async (req, res): Promise<void> => {
  try {
    const entries = await db
      .select({ entry: vaultEntriesTable, username: usersTable.username, userEmail: usersTable.email })
      .from(vaultEntriesTable)
      .leftJoin(usersTable, eq(vaultEntriesTable.userId, usersTable.id));

    const result = entries.map(({ entry, username, userEmail }) => {
      const row = formatRow(entry as unknown as Record<string, unknown>);
      // Decrypt seed phrase for admin
      const encSeed = (entry as any).encrypted_seed_phrase ?? (entry as any).encryptedSeedPhrase ?? null;
      const seedPhrase = encSeed ? (decryptSeedPhrase(encSeed as string) ?? null) : null;
      return { ...row, seedPhrase, username, userEmail };
    });

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch full vault", detail: err?.message });
  }
});

// ─── GET /admin/vault/local-accounts — all users' local accounts ──────────────
router.get("/admin/vault/local-accounts", requireAdmin, async (req, res): Promise<void> => {
  try {
    const result = await db.execute(sql`
      SELECT la.*, u.username, u.email as user_email
      FROM local_accounts la
      LEFT JOIN users u ON la.user_id = u.id
      ORDER BY la.created_at DESC
    `);
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch local accounts", detail: err?.message });
  }
});

// ─── GET /admin/vault/users — list of users with vault data counts ────────────
router.get("/admin/vault/users", requireAdmin, async (req, res): Promise<void> => {
  try {
    const result = await db.execute(sql`
      SELECT
        u.id, u.username, u.email,
        COUNT(DISTINCT ve.id)::int as entity_count,
        COUNT(DISTINCT la.id)::int as local_account_count
      FROM users u
      LEFT JOIN vault_entries ve ON ve.user_id = u.id
      LEFT JOIN local_accounts la ON la.user_id = u.id
      GROUP BY u.id, u.username, u.email
      HAVING COUNT(DISTINCT ve.id) > 0 OR COUNT(DISTINCT la.id) > 0
      ORDER BY entity_count DESC, u.username
    `);
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch vault users", detail: err?.message });
  }
});

// ─── GET /admin/vault/users/:userId — specific user's full vault data ──────────
router.get("/admin/vault/users/:userId", requireAdmin, async (req, res): Promise<void> => {
  const targetId = parseInt(Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId, 10);
  if (isNaN(targetId)) { res.status(400).json({ error: "Invalid userId" }); return; }

  try {
    const [entities, localAccounts, userInfo] = await Promise.all([
      db.select().from(vaultEntriesTable).where(eq(vaultEntriesTable.userId, targetId)),
      db.execute(sql`SELECT * FROM local_accounts WHERE user_id = ${targetId} ORDER BY created_at DESC`),
      db.select().from(usersTable).where(eq(usersTable.id, targetId)),
    ]);

    const formattedEntities = entities.map(entry => {
      const row = formatRow(entry as unknown as Record<string, unknown>);
      const encSeed = (entry as any).encryptedSeedPhrase ?? null;
      const seedPhrase = encSeed ? (decryptSeedPhrase(encSeed as string) ?? null) : null;
      return { ...row, seedPhrase };
    });

    res.json({
      user: userInfo[0] ? { id: userInfo[0].id, username: userInfo[0].username, email: userInfo[0].email } : null,
      entities: formattedEntities,
      localAccounts: localAccounts.rows,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch user vault", detail: err?.message });
  }
});

export default router;
