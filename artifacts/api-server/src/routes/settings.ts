import { Router } from "express";
import { db, settingsTable, errorLogsTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";

const router = Router();

router.get("/settings", async (_req, res): Promise<void> => {
  const rows = await db.select().from(settingsTable).limit(1);
  if (rows.length === 0) {
    const [s] = await db.insert(settingsTable).values({}).returning();
    res.json({ ...s, updatedAt: s.updatedAt.toISOString() });
    return;
  }
  const s = rows[0]!;
  res.json({ ...s, updatedAt: s.updatedAt.toISOString() });
});

router.patch("/settings", async (req, res): Promise<void> => {
  const existing = await db.select().from(settingsTable).limit(1);
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  const fields = ["platformName", "logoUrl", "primaryColor", "smtpHost", "smtpPort", "smtpUser", "telegramBotUsername", "telegramWebhookUrl", "twoFaIssuerName"];
  for (const f of fields) if (req.body[f] !== undefined) updates[f] = req.body[f];

  if (existing.length === 0) {
    const [s] = await db.insert(settingsTable).values(updates as Parameters<typeof settingsTable.$inferInsert>[0]).returning();
    res.json({ ...s, updatedAt: s.updatedAt.toISOString() });
    return;
  }
  const [s] = await db.update(settingsTable).set(updates).where(eq(settingsTable.id, existing[0]!.id)).returning();
  res.json({ ...s!, updatedAt: s!.updatedAt.toISOString() });
});

export default router;
