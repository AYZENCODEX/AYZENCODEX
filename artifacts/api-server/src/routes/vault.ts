import { Router } from "express";
import { db, vaultEntriesTable, usersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import * as crypto from "crypto";

const router = Router();

function generateSerial(userId: number): string {
  const ts = Date.now().toString(36).toUpperCase().slice(-4);
  const rand = crypto.randomBytes(2).toString("hex").toUpperCase();
  return `AYZN${userId}-${ts}${rand}`;
}

function getUserId(req: { headers: { authorization?: string } }): number {
  const authHeader = req.headers.authorization;
  if (!authHeader) return 1;
  try {
    const payload = JSON.parse(Buffer.from(authHeader.replace("Bearer ", ""), "base64").toString());
    return payload.userId ?? 1;
  } catch { return 1; }
}

function isAdmin(req: { headers: { authorization?: string } }): boolean {
  const authHeader = req.headers.authorization;
  if (!authHeader) return false;
  try {
    const payload = JSON.parse(Buffer.from(authHeader.replace("Bearer ", ""), "base64").toString());
    return payload.role === "admin";
  } catch { return false; }
}

function formatEntry(e: typeof vaultEntriesTable.$inferSelect) {
  return {
    ...e,
    walletAddresses: e.walletAddresses ? JSON.parse(e.walletAddresses) : [],
    backupCodes: e.backupCodes ? JSON.parse(e.backupCodes) : [],
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
  };
}

router.get("/vault", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const entries = await db.select().from(vaultEntriesTable).where(eq(vaultEntriesTable.userId, userId));
  res.json(entries.map(formatEntry));
});

router.post("/vault", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const {
    category, projectName,
    email, emailPassword,
    twitterUsername, twitterPassword,
    discordUsername, discordPassword,
    telegramUsername, telegramPassword,
    walletAddresses, backupCodes, notes,
  } = req.body;
  if (!category || !projectName) { res.status(400).json({ error: "category and projectName are required" }); return; }
  const serial = generateSerial(userId);
  const [entry] = await db.insert(vaultEntriesTable).values({
    userId, entitySerial: serial, category, projectName,
    email: email || null, emailPassword: emailPassword || null,
    twitterUsername: twitterUsername || null, twitterPassword: twitterPassword || null,
    discordUsername: discordUsername || null, discordPassword: discordPassword || null,
    telegramUsername: telegramUsername || null, telegramPassword: telegramPassword || null,
    walletAddresses: walletAddresses ? JSON.stringify(walletAddresses) : null,
    backupCodes: backupCodes ? JSON.stringify(backupCodes) : null,
    notes: notes || null,
  }).returning();
  res.status(201).json(formatEntry(entry));
});

router.get("/vault/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const userId = getUserId(req);
  const [entry] = await db.select().from(vaultEntriesTable).where(and(eq(vaultEntriesTable.id, id), eq(vaultEntriesTable.userId, userId)));
  if (!entry) { res.status(404).json({ error: "Vault entry not found" }); return; }
  res.json(formatEntry(entry));
});

router.patch("/vault/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const userId = getUserId(req);
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  for (const f of [
    "category", "projectName",
    "email", "emailPassword",
    "twitterUsername", "twitterPassword",
    "discordUsername", "discordPassword",
    "telegramUsername", "telegramPassword",
    "notes",
  ]) {
    if (req.body[f] !== undefined) updates[f] = req.body[f];
  }
  if (req.body.walletAddresses !== undefined) updates.walletAddresses = JSON.stringify(req.body.walletAddresses);
  if (req.body.backupCodes !== undefined) updates.backupCodes = JSON.stringify(req.body.backupCodes);
  const [entry] = await db.update(vaultEntriesTable).set(updates).where(and(eq(vaultEntriesTable.id, id), eq(vaultEntriesTable.userId, userId))).returning();
  if (!entry) { res.status(404).json({ error: "Vault entry not found" }); return; }
  res.json(formatEntry(entry));
});

router.delete("/vault/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const userId = getUserId(req);
  await db.delete(vaultEntriesTable).where(and(eq(vaultEntriesTable.id, id), eq(vaultEntriesTable.userId, userId)));
  res.json({ message: "Vault entry deleted" });
});

router.get("/admin/vault", async (req, res): Promise<void> => {
  if (!isAdmin(req)) { res.status(403).json({ error: "Forbidden" }); return; }
  const entries = await db
    .select({ entry: vaultEntriesTable, username: usersTable.username, userEmail: usersTable.email })
    .from(vaultEntriesTable)
    .leftJoin(usersTable, eq(vaultEntriesTable.userId, usersTable.id));
  res.json(entries.map(({ entry, username, userEmail }) => ({
    ...formatEntry(entry),
    username,
    userEmail,
  })));
});

export default router;
