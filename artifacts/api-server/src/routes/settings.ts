import { Router } from "express";
import { db, settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

function formatSettings(s: typeof settingsTable.$inferSelect) {
  return {
    ...s,
    smtpPassword: s.smtpPassword ? "••••••••" : null, // never expose password
    updatedAt: s.updatedAt.toISOString(),
  };
}

async function getOrCreate() {
  const rows = await db.select().from(settingsTable).limit(1);
  if (rows.length === 0) {
    const [s] = await db.insert(settingsTable).values({}).returning();
    return s;
  }
  return rows[0]!;
}

router.get("/settings", async (_req, res): Promise<void> => {
  const s = await getOrCreate();
  res.json(formatSettings(s));
});

router.patch("/settings", async (req, res): Promise<void> => {
  const existing = await getOrCreate();
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  const fields = ["platformName", "logoUrl", "primaryColor", "smtpHost", "smtpPort", "smtpUser", "smtpPassword", "smtpFrom", "telegramBotUsername", "telegramWebhookUrl", "customDomain", "twoFaIssuerName"];
  for (const f of fields) if (req.body[f] !== undefined) updates[f] = req.body[f];
  const [s] = await db.update(settingsTable).set(updates).where(eq(settingsTable.id, existing.id)).returning();
  res.json(formatSettings(s!));
});

// ── Mail Config (IMAP + SMTP) for Vault Mail Hub ─────────────────────────────
router.get("/settings/mail-config", async (req: any, res): Promise<void> => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    let userId = 0;
    if (token) {
      try {
        const p = JSON.parse(Buffer.from(token, "base64").toString());
        userId = p.userId ?? 0;
      } catch {}
    }
    const { db: dbInstance } = await import("@workspace/db");
    const { sql } = await import("drizzle-orm");
    await dbInstance.execute(sql`
      CREATE TABLE IF NOT EXISTS user_mail_config (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL UNIQUE,
        imap_host TEXT, imap_port INTEGER DEFAULT 993,
        imap_user TEXT, imap_password TEXT,
        smtp_host TEXT, smtp_port INTEGER DEFAULT 587,
        smtp_user TEXT, smtp_password TEXT,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    const rows = await dbInstance.execute(sql`SELECT * FROM user_mail_config WHERE user_id = ${userId} LIMIT 1`);
    const row = rows.rows[0] as any;
    res.json({
      imapHost: row?.imap_host ?? "",
      imapPort: row?.imap_port ?? 993,
      imapUser: row?.imap_user ?? "",
      imapPassword: row?.imap_password ? "••••••••" : "",
      smtpHost: row?.smtp_host ?? "",
      smtpPort: row?.smtp_port ?? 587,
      smtpUser: row?.smtp_user ?? "",
      smtpPassword: row?.smtp_password ? "••••••••" : "",
    });
  } catch (e: any) {
    res.json({ imapHost: "", imapPort: 993, imapUser: "", imapPassword: "", smtpHost: "", smtpPort: 587, smtpUser: "", smtpPassword: "" });
  }
});

router.post("/settings/mail-config", async (req: any, res): Promise<void> => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    let userId = 0;
    if (token) {
      try {
        const p = JSON.parse(Buffer.from(token, "base64").toString());
        userId = p.userId ?? 0;
      } catch {}
    }
    const { imapHost, imapPort, imapUser, imapPassword, smtpHost, smtpPort, smtpUser, smtpPassword } = req.body;
    const { db: dbInstance } = await import("@workspace/db");
    const { sql } = await import("drizzle-orm");
    const existing = await dbInstance.execute(sql`SELECT id FROM user_mail_config WHERE user_id = ${userId} LIMIT 1`);
    if (existing.rows.length === 0) {
      await dbInstance.execute(sql`
        INSERT INTO user_mail_config (user_id, imap_host, imap_port, imap_user, imap_password, smtp_host, smtp_port, smtp_user, smtp_password)
        VALUES (${userId}, ${imapHost||null}, ${imapPort||993}, ${imapUser||null}, ${imapPassword&&imapPassword!=="••••••••"?imapPassword:null}, ${smtpHost||null}, ${smtpPort||587}, ${smtpUser||null}, ${smtpPassword&&smtpPassword!=="••••••••"?smtpPassword:null})
      `);
    } else {
      const updates: any[] = [];
      if (imapHost !== undefined) await dbInstance.execute(sql`UPDATE user_mail_config SET imap_host = ${imapHost}, updated_at = NOW() WHERE user_id = ${userId}`);
      if (imapPort !== undefined) await dbInstance.execute(sql`UPDATE user_mail_config SET imap_port = ${imapPort} WHERE user_id = ${userId}`);
      if (imapUser !== undefined) await dbInstance.execute(sql`UPDATE user_mail_config SET imap_user = ${imapUser} WHERE user_id = ${userId}`);
      if (imapPassword && imapPassword !== "••••••••") await dbInstance.execute(sql`UPDATE user_mail_config SET imap_password = ${imapPassword} WHERE user_id = ${userId}`);
      if (smtpHost !== undefined) await dbInstance.execute(sql`UPDATE user_mail_config SET smtp_host = ${smtpHost} WHERE user_id = ${userId}`);
      if (smtpPort !== undefined) await dbInstance.execute(sql`UPDATE user_mail_config SET smtp_port = ${smtpPort} WHERE user_id = ${userId}`);
      if (smtpUser !== undefined) await dbInstance.execute(sql`UPDATE user_mail_config SET smtp_user = ${smtpUser} WHERE user_id = ${userId}`);
      if (smtpPassword && smtpPassword !== "••••••••") await dbInstance.execute(sql`UPDATE user_mail_config SET smtp_password = ${smtpPassword} WHERE user_id = ${userId}`);
    }
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? "Failed to save" });
  }
});

router.post("/settings/mail-config/test-smtp", async (req: any, res): Promise<void> => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    let userId = 0;
    if (token) {
      try {
        const p = JSON.parse(Buffer.from(token, "base64").toString());
        userId = p.userId ?? 0;
      } catch {}
    }
    const { db: dbInstance } = await import("@workspace/db");
    const { sql } = await import("drizzle-orm");
    const rows = await dbInstance.execute(sql`SELECT * FROM user_mail_config WHERE user_id = ${userId} LIMIT 1`);
    const cfg = rows.rows[0] as any;
    if (!cfg?.smtp_host || !cfg?.smtp_user || !cfg?.smtp_password) {
      res.status(400).json({ ok: false, error: "SMTP not configured" }); return;
    }
    const nodemailer = await import("nodemailer");
    const transport = nodemailer.default.createTransport({
      host: cfg.smtp_host, port: cfg.smtp_port ?? 587,
      secure: (cfg.smtp_port ?? 587) === 465,
      auth: { user: cfg.smtp_user, pass: cfg.smtp_password },
    });
    await transport.verify();
    res.json({ ok: true });
  } catch (e: any) {
    res.json({ ok: false, error: e?.message ?? "Connection failed" });
  }
});

router.post("/settings/email/test", async (req, res): Promise<void> => {
  const { to } = req.body;
  if (!to) { res.status(400).json({ error: "to is required" }); return; }
  const s = await getOrCreate();
  if (!s.smtpHost || !s.smtpUser || !s.smtpPassword) {
    res.status(400).json({ error: "SMTP not configured. Set host, user, and password first." });
    return;
  }
  try {
    // Dynamic import so nodemailer isn't required at startup
    const nodemailer = await import("nodemailer");
    const transport = nodemailer.default.createTransport({
      host: s.smtpHost,
      port: s.smtpPort ?? 587,
      secure: (s.smtpPort ?? 587) === 465,
      auth: { user: s.smtpUser, pass: s.smtpPassword },
    });
    await transport.sendMail({
      from: s.smtpFrom ?? s.smtpUser,
      to,
      subject: "AYZEN — Email Config Test",
      html: `<div style="font-family:monospace;background:#0a0a0a;color:#06b6d4;padding:24px;border:1px solid #1a1a2e">
        <h2>AYZEN Email Test</h2>
        <p style="color:#ccc">If you received this, your SMTP configuration is working correctly.</p>
        <p style="color:#555;font-size:12px">Sent at ${new Date().toISOString()}</p>
      </div>`,
    });
    res.json({ message: "Test email sent successfully", to });
  } catch (err: any) {
    res.status(500).json({ error: `SMTP error: ${err?.message ?? "Unknown error"}` });
  }
});

export default router;
