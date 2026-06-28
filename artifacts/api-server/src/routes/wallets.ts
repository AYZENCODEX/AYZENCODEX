import { Router } from "express";
import { db, walletsTable, usersTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { broadcastEvent } from "./events";
import { getUserFromToken, getTokenFromReq } from "../lib/auth-utils";
import crypto from "crypto";

const PHRASE_KEY = (process.env["PHRASE_ENCRYPTION_KEY"] ?? "ayzen_phrase_key_32bytes_default!").slice(0, 32).padEnd(32, "0");

function encryptPhrase(plain: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", Buffer.from(PHRASE_KEY), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return iv.toString("hex") + ":" + enc.toString("hex");
}

function decryptPhrase(encrypted: string): string {
  const [ivHex, encHex] = encrypted.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const enc = Buffer.from(encHex, "hex");
  const decipher = crypto.createDecipheriv("aes-256-cbc", Buffer.from(PHRASE_KEY), iv);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}

const router = Router();

function getAuthUser(req: any): { id: number; role: string } | null {
  const auth = req.headers.authorization as string | undefined;
  if (!auth) return null;
  try {
    const p = JSON.parse(Buffer.from(auth.replace("Bearer ", ""), "base64").toString());
    return { id: p.userId, role: p.role ?? "user" };
  } catch { return null; }
}

function formatWallet(w: typeof walletsTable.$inferSelect) {
  return {
    ...w,
    createdAt: w.createdAt.toISOString(),
    updatedAt: w.updatedAt.toISOString(),
    lastSyncedAt: w.lastSyncedAt?.toISOString() ?? null,
  };
}

// GET /wallets — list wallets for current user (or userId= for admin)
router.get("/wallets", async (req, res): Promise<void> => {
  const authUser = getAuthUser(req);
  if (!authUser) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { userId } = req.query as Record<string, string>;
  const targetId = (authUser.role === "admin" && userId)
    ? parseInt(userId, 10)
    : authUser.id;

  const wallets = await db.select().from(walletsTable).where(eq(walletsTable.userId, targetId));
  res.json(wallets.map(formatWallet));
});

// POST /wallets — add a new wallet
router.post("/wallets", async (req, res): Promise<void> => {
  const authUser = getAuthUser(req);
  if (!authUser) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { address, chain, label, notes, chainId } = req.body as {
    address?: string; chain?: string; label?: string; notes?: string; chainId?: number;
  };
  if (!address) { res.status(400).json({ error: "address is required" }); return; }
  if (!isValidAddress(address, chain ?? "ETH")) {
    res.status(400).json({ error: "Invalid wallet address format" }); return;
  }

  // Check duplicate for this user
  const existing = await db.select({ id: walletsTable.id })
    .from(walletsTable)
    .where(and(eq(walletsTable.userId, authUser.id), eq(walletsTable.address, address.toLowerCase())));
  if (existing.length > 0) {
    res.status(409).json({ error: "This wallet address is already added" }); return;
  }

  // If first wallet, make primary
  const count = await db.select({ id: walletsTable.id }).from(walletsTable).where(eq(walletsTable.userId, authUser.id));
  const isPrimary = count.length === 0;

  const [wallet] = await db.insert(walletsTable).values({
    userId: authUser.id,
    address: address.toLowerCase(),
    chain: (chain ?? "ETH").toUpperCase(),
    label: label?.trim() || `${(chain ?? "ETH").toUpperCase()} Wallet`,
    notes: notes?.trim() || null,
    chainId: chainId ?? getDefaultChainId(chain ?? "ETH"),
    isPrimary,
  }).returning();

  // Update user walletCount
  await db.update(usersTable)
    .set({ walletCount: count.length + 1 })
    .where(eq(usersTable.id, authUser.id));

  broadcastEvent("wallets_updated", { action: "added", userId: authUser.id, walletId: wallet.id });
  res.status(201).json(formatWallet(wallet));
});

// PATCH /wallets/:id — update wallet label/notes/primary
router.patch("/wallets/:id", async (req, res): Promise<void> => {
  const authUser = getAuthUser(req);
  if (!authUser) { res.status(401).json({ error: "Unauthorized" }); return; }

  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [existing] = await db.select().from(walletsTable)
    .where(and(eq(walletsTable.id, id), eq(walletsTable.userId, authUser.id)));
  if (!existing) { res.status(404).json({ error: "Wallet not found" }); return; }

  const updates: Partial<typeof walletsTable.$inferInsert> = {};
  if (req.body.label !== undefined) updates.label = req.body.label;
  if (req.body.notes !== undefined) updates.notes = req.body.notes;
  if (req.body.isPrimary === true) {
    // Unset all other primaries first
    await db.update(walletsTable).set({ isPrimary: false }).where(eq(walletsTable.userId, authUser.id));
    updates.isPrimary = true;
  }
  updates.updatedAt = new Date();

  const [updated] = await db.update(walletsTable).set(updates).where(eq(walletsTable.id, id)).returning();
  broadcastEvent("wallets_updated", { action: "updated", userId: authUser.id, walletId: id });
  res.json(formatWallet(updated));
});

// DELETE /wallets/:id — remove wallet
router.delete("/wallets/:id", async (req, res): Promise<void> => {
  const authUser = getAuthUser(req);
  if (!authUser) { res.status(401).json({ error: "Unauthorized" }); return; }

  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [existing] = await db.select().from(walletsTable)
    .where(and(eq(walletsTable.id, id), eq(walletsTable.userId, authUser.id)));
  if (!existing) { res.status(404).json({ error: "Wallet not found" }); return; }

  await db.delete(walletsTable).where(eq(walletsTable.id, id));

  // Update walletCount
  const remaining = await db.select({ id: walletsTable.id }).from(walletsTable).where(eq(walletsTable.userId, authUser.id));
  await db.update(usersTable).set({ walletCount: remaining.length }).where(eq(usersTable.id, authUser.id));

  // If deleted was primary, make first remaining primary
  if (existing.isPrimary && remaining.length > 0) {
    await db.update(walletsTable).set({ isPrimary: true }).where(eq(walletsTable.id, remaining[0].id));
  }

  broadcastEvent("wallets_updated", { action: "deleted", userId: authUser.id, walletId: id });
  res.json({ success: true });
});

// POST /wallets/:id/sync — refresh on-chain data (mock for now, real integration via Cloudflare)
router.post("/wallets/:id/sync", async (req, res): Promise<void> => {
  const authUser = getAuthUser(req);
  if (!authUser) { res.status(401).json({ error: "Unauthorized" }); return; }

  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [wallet] = await db.select().from(walletsTable)
    .where(and(eq(walletsTable.id, id), eq(walletsTable.userId, authUser.id)));
  if (!wallet) { res.status(404).json({ error: "Wallet not found" }); return; }

  // Fetch real data from public APIs
  const chainData = await fetchChainData(wallet.address, wallet.chain);
  const updated = await db.update(walletsTable).set({
    balance: chainData.balance,
    balanceUsd: chainData.balanceUsd,
    tokenCount: chainData.tokenCount,
    txCount: chainData.txCount,
    lastSyncedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(walletsTable.id, id)).returning();

  broadcastEvent("wallets_updated", { action: "synced", userId: authUser.id, walletId: id });
  res.json(formatWallet(updated[0]));
});

// POST /wallets/:id/phrase — save encrypted seed phrase
router.post("/wallets/:id/phrase", async (req, res): Promise<void> => {
  const authUser = getAuthUser(req);
  if (!authUser) { res.status(401).json({ error: "Unauthorized" }); return; }

  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [wallet] = await db.select().from(walletsTable)
    .where(and(eq(walletsTable.id, id), eq(walletsTable.userId, authUser.id)));
  if (!wallet) { res.status(404).json({ error: "Wallet not found" }); return; }

  const { phrase } = req.body as { phrase?: string };
  if (!phrase?.trim()) { res.status(400).json({ error: "phrase is required" }); return; }

  const encrypted = encryptPhrase(phrase.trim());
  await db.update(walletsTable).set({ encryptedPhrase: encrypted, updatedAt: new Date() }).where(eq(walletsTable.id, id));
  res.json({ success: true });
});

// GET /wallets/:id/phrase — decrypt and return seed phrase
router.get("/wallets/:id/phrase", async (req, res): Promise<void> => {
  const authUser = getAuthUser(req);
  if (!authUser) { res.status(401).json({ error: "Unauthorized" }); return; }

  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [wallet] = await db.select().from(walletsTable)
    .where(and(eq(walletsTable.id, id), eq(walletsTable.userId, authUser.id)));
  if (!wallet) { res.status(404).json({ error: "Wallet not found" }); return; }
  if (!wallet.encryptedPhrase) { res.status(404).json({ error: "No phrase saved for this wallet" }); return; }

  try {
    const phrase = decryptPhrase(wallet.encryptedPhrase);
    res.json({ phrase });
  } catch {
    res.status(500).json({ error: "Failed to decrypt phrase" });
  }
});

// POST /wallets/:id/send — broadcast a send transaction (queues/logs for now)
router.post("/wallets/:id/send", async (req, res): Promise<void> => {
  const authUser = getAuthUser(req);
  if (!authUser) { res.status(401).json({ error: "Unauthorized" }); return; }

  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [wallet] = await db.select().from(walletsTable)
    .where(and(eq(walletsTable.id, id), eq(walletsTable.userId, authUser.id)));
  if (!wallet) { res.status(404).json({ error: "Wallet not found" }); return; }

  const { to, amount, token } = req.body as { to?: string; amount?: number; token?: string };
  if (!to?.trim()) { res.status(400).json({ error: "to is required" }); return; }
  if (!amount || amount <= 0) { res.status(400).json({ error: "amount must be > 0" }); return; }

  // In production this would sign + broadcast via a connected wallet provider.
  // For now we log the intent and return a pending status.
  broadcastEvent("wallet_send", { userId: authUser.id, walletId: id, to, amount, token: token ?? wallet.chain });
  res.json({ success: true, status: "pending", txHash: null, message: "Transaction queued. Connect wallet provider to broadcast." });
});

// GET /wallets/tokens — get AZN + USDT balances for current user
router.get("/wallets/tokens", async (req, res): Promise<void> => {
  const tokenStr = getTokenFromReq(req);
  const authUser = tokenStr ? await getUserFromToken(tokenStr) : null;
  if (!authUser) { res.status(401).json({ error: "Unauthorized" }); return; }
  const userId = authUser.userId;
  try {
    const creditsResult = await db.execute(
      sql`SELECT azn_balance, balance FROM credits WHERE user_id = ${userId}`
    );
    const credits = (creditsResult.rows[0] as Record<string, unknown>) ?? {};
    const usdtResult = await db.execute(
      sql`SELECT COALESCE(SUM(amount), 0) as usdt FROM builtin_wallet_tokens WHERE user_id = ${userId} AND symbol = 'USDT'`
    );
    const usdt = parseFloat(String((usdtResult.rows[0] as Record<string, unknown>)?.usdt ?? 0));
    res.json({
      azn: parseFloat(String(credits["azn_balance"] ?? 0)),
      credits: parseInt(String(credits["balance"] ?? 0), 10),
      usdt,
    });
  } catch { res.json({ azn: 0, credits: 0, usdt: 0 }); }
});

// POST /wallets/builtin/create — create a built-in AYZEN watch-only wallet address
router.post("/wallets/builtin/create", async (req, res): Promise<void> => {
  const tokenStr = getTokenFromReq(req);
  const authUser = tokenStr ? await getUserFromToken(tokenStr) : null;
  if (!authUser) { res.status(401).json({ error: "Unauthorized" }); return; }
  const userId = authUser.userId;

  // Check if user already has a built-in wallet (use parameterized query via drizzle)
  const existing = await db.select({ id: walletsTable.id }).from(walletsTable)
    .where(eq(walletsTable.userId, userId))
    .limit(1);
  const hasBuiltin = existing.length > 0 &&
    (await db.execute(sql`SELECT id FROM wallets WHERE user_id = ${userId} AND label LIKE ${'AYZEN Built-in%'} LIMIT 1`)).rows.length > 0;
  if (hasBuiltin) {
    res.status(409).json({ error: "Built-in wallet already exists" }); return;
  }

  // Generate a random 20-byte ETH-format address (watch-only — no private key stored)
  const bytes = crypto.randomBytes(20);
  const address = "0x" + bytes.toString("hex");

  const count = await db.select({ id: walletsTable.id }).from(walletsTable).where(eq(walletsTable.userId, userId));
  const isPrimary = count.length === 0;

  const [wallet] = await db.insert(walletsTable).values({
    userId,
    address: address.toLowerCase(),
    chain: "ETH",
    label: "AYZEN Built-in Wallet",
    notes: "Watch-only address managed by AYZEN. AZN/USDT balances are tracked internally.",
    chainId: 1,
    isPrimary,
  }).returning();

  await db.update(usersTable).set({ walletCount: count.length + 1 }).where(eq(usersTable.id, userId));
  broadcastEvent("wallets_updated", { action: "added", userId, walletId: wallet.id });
  res.status(201).json({ ...formatWallet(wallet), isBuiltin: true, watchOnly: true });
});

// GET /wallets/ayzen-balance — all AYZEN token balances for current user
router.get("/wallets/ayzen-balance", async (req, res): Promise<void> => {
  const tokenStr = getTokenFromReq(req);
  const authUser = tokenStr ? await getUserFromToken(tokenStr) : null;
  if (!authUser) { res.status(401).json({ error: "Unauthorized" }); return; }
  const userId = authUser.userId;
  try {
    const cr = await db.execute(sql`SELECT azn_balance, balance, usdt_balance, bdt_balance, xp_balance FROM credits WHERE user_id = ${userId}`);
    const row = (cr.rows[0] as Record<string, unknown>) ?? {};
    res.json({
      azn: parseFloat(String(row.azn_balance ?? 0)),
      credits: parseInt(String(row.balance ?? 0), 10),
      usdt: parseFloat(String(row.usdt_balance ?? 0)),
      bdt: parseFloat(String(row.bdt_balance ?? 0)),
      xp: parseFloat(String(row.xp_balance ?? 0)),
    });
  } catch { res.json({ azn: 0, credits: 0, usdt: 0, bdt: 0, xp: 0 }); }
});

// GET /wallets/transfers — transfer history for current user
router.get("/wallets/transfers", async (req, res): Promise<void> => {
  const tokenStr = getTokenFromReq(req);
  const authUser = tokenStr ? await getUserFromToken(tokenStr) : null;
  if (!authUser) { res.status(401).json({ error: "Unauthorized" }); return; }
  const userId = authUser.userId;
  try {
    const result = await db.execute(sql`
      SELECT wt.*, 
        fu.username as from_username, fu.email as from_email,
        tu.username as to_username, tu.email as to_email
      FROM wallet_transfers wt
      LEFT JOIN users fu ON fu.id = wt.from_user_id
      LEFT JOIN users tu ON tu.id = wt.to_user_id
      WHERE wt.from_user_id = ${userId} OR wt.to_user_id = ${userId}
      ORDER BY wt.created_at DESC
      LIMIT 50
    `);
    res.json(result.rows);
  } catch { res.json([]); }
});

// POST /wallets/transfer — send tokens to another AYZEN user
router.post("/wallets/transfer", async (req, res): Promise<void> => {
  const tokenStr = getTokenFromReq(req);
  const authUser = tokenStr ? await getUserFromToken(tokenStr) : null;
  if (!authUser) { res.status(401).json({ error: "Unauthorized" }); return; }
  const fromUserId = authUser.userId;
  const { toUsername, currency, amount, note } = req.body;
  if (!toUsername || !currency || !amount || amount <= 0) {
    res.status(400).json({ error: "toUsername, currency, and amount > 0 are required" }); return;
  }
  const ALLOWED = ["AZN", "USDT", "BDT", "XP"];
  if (!ALLOWED.includes(String(currency).toUpperCase())) {
    res.status(400).json({ error: `Currency must be one of: ${ALLOWED.join(", ")}` }); return;
  }
  const cur = String(currency).toUpperCase();
  const amt = parseFloat(String(amount));
  // Find target user
  const targetResult = await db.execute(sql`SELECT id, username, email FROM users WHERE username = ${toUsername} OR email = ${toUsername} LIMIT 1`);
  if (targetResult.rows.length === 0) { res.status(404).json({ error: "User not found" }); return; }
  const toUser = targetResult.rows[0] as any;
  if (toUser.id === fromUserId) { res.status(400).json({ error: "Cannot transfer to yourself" }); return; }
  // Column map
  const colMap: Record<string, string> = { AZN: "azn_balance", USDT: "usdt_balance", BDT: "bdt_balance", XP: "xp_balance" };
  const col = colMap[cur];
  // Check sender balance
  const senderRow = await db.execute(sql`SELECT ${sql.raw(col)} as bal FROM credits WHERE user_id = ${fromUserId}`);
  const senderBal = parseFloat(String((senderRow.rows[0] as any)?.bal ?? 0));
  if (senderBal < amt) { res.status(400).json({ error: `Insufficient ${cur} balance (have ${senderBal.toFixed(4)})` }); return; }
  // Deduct from sender
  await db.execute(sql.raw(`INSERT INTO credits (user_id, ${col}) VALUES (${fromUserId}, 0) ON CONFLICT (user_id) DO NOTHING`));
  await db.execute(sql.raw(`UPDATE credits SET ${col} = ${col} - ${amt} WHERE user_id = ${fromUserId}`));
  // Add to receiver
  await db.execute(sql.raw(`INSERT INTO credits (user_id, ${col}) VALUES (${toUser.id}, 0) ON CONFLICT (user_id) DO NOTHING`));
  await db.execute(sql.raw(`UPDATE credits SET ${col} = ${col} + ${amt} WHERE user_id = ${toUser.id}`));
  // Record transfer
  await db.execute(sql`INSERT INTO wallet_transfers (from_user_id, to_user_id, currency, amount, note) VALUES (${fromUserId}, ${toUser.id}, ${cur}, ${amt}, ${note ?? null})`);
  res.json({ success: true, currency: cur, amount: amt, to: toUser.username ?? toUser.email });
});

// GET /wallets/stats — aggregated stats for current user
router.get("/wallets/stats", async (req, res): Promise<void> => {
  const authUser = getAuthUser(req);
  if (!authUser) { res.status(401).json({ error: "Unauthorized" }); return; }

  const wallets = await db.select().from(walletsTable).where(eq(walletsTable.userId, authUser.id));
  const totalUsd = wallets.reduce((s, w) => s + (w.balanceUsd ?? 0), 0);
  const chains = [...new Set(wallets.map(w => w.chain))];
  res.json({
    count: wallets.length,
    totalUsd,
    chains,
    primary: wallets.find(w => w.isPrimary) ?? null,
  });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isValidAddress(address: string, chain: string): boolean {
  const ch = chain.toUpperCase();
  if (["ETH", "BSC", "MATIC", "ARB", "OP", "BASE", "AVAX", "FTM", "LINEA", "ZKSYNC", "SCROLL"].includes(ch)) {
    return /^0x[0-9a-fA-F]{40}$/.test(address);
  }
  if (ch === "SOL") return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
  if (ch === "BTC") return /^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,62}$/.test(address);
  if (ch === "TRX") return /^T[0-9A-Za-z]{33}$/.test(address);
  // Default: allow any non-empty
  return address.trim().length > 5;
}

function getDefaultChainId(chain: string): number | null {
  const map: Record<string, number> = {
    ETH: 1, BSC: 56, MATIC: 137, ARB: 42161, OP: 10, BASE: 8453,
    AVAX: 43114, FTM: 250, LINEA: 59144, ZKSYNC: 324, SCROLL: 534352,
  };
  return map[chain.toUpperCase()] ?? null;
}

async function fetchChainData(address: string, chain: string): Promise<{
  balance: number; balanceUsd: number; tokenCount: number; txCount: number;
}> {
  try {
    // Use free public APIs
    if (["ETH", "MATIC", "BSC", "ARB", "OP", "BASE"].includes(chain.toUpperCase())) {
      // Etherscan-compatible endpoint for native balance
      const apiMap: Record<string, string> = {
        ETH: "https://api.etherscan.io/api",
        MATIC: "https://api.polygonscan.com/api",
        BSC: "https://api.bscscan.com/api",
        ARB: "https://api.arbiscan.io/api",
        OP: "https://api-optimistic.etherscan.io/api",
        BASE: "https://api.basescan.org/api",
      };
      const base = apiMap[chain.toUpperCase()];
      if (base) {
        const r = await fetch(`${base}?module=account&action=balance&address=${address}&tag=latest`);
        const d = await r.json() as { status: string; result: string };
        if (d.status === "1") {
          const balance = parseInt(d.result, 10) / 1e18;
          // Rough USD estimate from coingecko
          const priceR = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd");
          const priceD = await priceR.json() as { ethereum?: { usd?: number } };
          const price = priceD?.ethereum?.usd ?? 0;
          return { balance: parseFloat(balance.toFixed(6)), balanceUsd: parseFloat((balance * price).toFixed(2)), tokenCount: 0, txCount: 0 };
        }
      }
    }
  } catch { /* fallback below */ }
  return { balance: 0, balanceUsd: 0, tokenCount: 0, txCount: 0 };
}

export default router;
