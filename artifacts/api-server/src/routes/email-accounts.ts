import { Router } from "express";
import { db, emailAccountsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router = Router();

function getUserId(req: any): number {
  const auth = req.headers.authorization as string | undefined;
  if (!auth) return 1;
  try {
    const p = JSON.parse(Buffer.from(auth.replace("Bearer ", ""), "base64").toString());
    return p.userId ?? 1;
  } catch { return 1; }
}

function fmt(e: typeof emailAccountsTable.$inferSelect) {
  return {
    ...e,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
    password: e.password ? "••••••••" : null,
  };
}

router.get("/email-accounts", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const rows = await db.select().from(emailAccountsTable).where(eq(emailAccountsTable.userId, userId));
  res.json(rows.map(fmt));
});

router.get("/email-accounts/:id", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const id = parseInt(req.params.id as string, 10);
  const [row] = await db.select().from(emailAccountsTable)
    .where(and(eq(emailAccountsTable.id, id), eq(emailAccountsTable.userId, userId)));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ ...fmt(row), password: row.password });
});

router.post("/email-accounts", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const { label, emailAddress, protocol, imapHost, imapPort, smtpHost, smtpPort, username, password, useSSL, isDefault, notes, tags } = req.body;
  if (!label || !emailAddress) { res.status(400).json({ error: "label and emailAddress required" }); return; }

  if (isDefault) {
    await db.update(emailAccountsTable).set({ isDefault: false }).where(eq(emailAccountsTable.userId, userId));
  }

  const [row] = await db.insert(emailAccountsTable).values({
    userId, label, emailAddress, protocol: protocol ?? "IMAP",
    imapHost, imapPort: imapPort ? parseInt(imapPort, 10) : 993,
    smtpHost, smtpPort: smtpPort ? parseInt(smtpPort, 10) : 587,
    username, password, useSSL: useSSL !== false, isDefault: !!isDefault,
    notes, tags,
  }).returning();
  res.status(201).json(fmt(row));
});

router.put("/email-accounts/:id", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const id = parseInt(req.params.id as string, 10);
  const { label, emailAddress, protocol, imapHost, imapPort, smtpHost, smtpPort, username, password, useSSL, isDefault, notes, tags } = req.body;

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (label !== undefined) updates.label = label;
  if (emailAddress !== undefined) updates.emailAddress = emailAddress;
  if (protocol !== undefined) updates.protocol = protocol;
  if (imapHost !== undefined) updates.imapHost = imapHost;
  if (imapPort !== undefined) updates.imapPort = parseInt(imapPort, 10);
  if (smtpHost !== undefined) updates.smtpHost = smtpHost;
  if (smtpPort !== undefined) updates.smtpPort = parseInt(smtpPort, 10);
  if (username !== undefined) updates.username = username;
  if (password !== undefined && password !== "••••••••") updates.password = password;
  if (useSSL !== undefined) updates.useSSL = useSSL;
  if (isDefault !== undefined) updates.isDefault = isDefault;
  if (notes !== undefined) updates.notes = notes;
  if (tags !== undefined) updates.tags = tags;

  if (isDefault) {
    await db.update(emailAccountsTable).set({ isDefault: false }).where(eq(emailAccountsTable.userId, userId));
  }

  const [row] = await db.update(emailAccountsTable).set(updates)
    .where(and(eq(emailAccountsTable.id, id), eq(emailAccountsTable.userId, userId))).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(fmt(row));
});

router.delete("/email-accounts/:id", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const id = parseInt(req.params.id as string, 10);
  await db.delete(emailAccountsTable).where(and(eq(emailAccountsTable.id, id), eq(emailAccountsTable.userId, userId)));
  res.json({ ok: true });
});

export default router;
