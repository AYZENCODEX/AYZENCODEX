import { Router } from "express";
import { db, emailAccountsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import * as imaps from "imap-simple";
import { requireAuth } from "../middlewares/auth";

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

// ─── POST /email-accounts/:id/fetch-inbox — fetch emails via IMAP ─────────────
router.post("/email-accounts/:id/fetch-inbox", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const id = parseInt(req.params.id as string, 10);
  const limit = Math.min(parseInt(req.body?.limit ?? "50", 10), 100);
  const mailbox = (req.body?.mailbox as string) || "INBOX";

  const [account] = await db.select().from(emailAccountsTable)
    .where(and(eq(emailAccountsTable.id, id), eq(emailAccountsTable.userId, userId)));
  if (!account) { res.status(404).json({ error: "Account not found" }); return; }
  if (!account.imapHost || !account.password) {
    res.status(400).json({ error: "IMAP not fully configured — host and password required" }); return;
  }

  const imapConfig = {
    imap: {
      user: account.username ?? account.emailAddress,
      password: account.password,
      host: account.imapHost,
      port: account.imapPort ?? 993,
      tls: account.useSSL !== false,
      tlsOptions: { rejectUnauthorized: false },
      authTimeout: 15000,
      connTimeout: 15000,
    },
  };

  let connection: any = null;
  try {
    connection = await (imaps as any).connect(imapConfig);
    const box = await connection.openBox(mailbox);
    const total = box.messages?.total ?? 0;

    if (total === 0) {
      connection.end();
      res.json({ messages: [], total: 0 });
      return;
    }

    // Fetch latest N messages by sequence range
    const start = Math.max(1, total - limit + 1);
    const fetchOptions = {
      bodies: ["HEADER.FIELDS (FROM TO SUBJECT DATE MESSAGE-ID)"],
      struct: false,
      markSeen: false,
    };
    const messages = await connection.fetchMessages(`${start}:*`, fetchOptions);

    const result = (messages as any[]).reverse().map((msg: any) => {
      const headerPart = msg.parts.find((p: any) => p.which.startsWith("HEADER"));
      const hdr = headerPart?.body ?? {};
      const parseAddresses = (raw: string | string[] | undefined): string => {
        if (!raw) return "";
        const s = Array.isArray(raw) ? raw[0] : raw;
        return s.replace(/\r?\n\s*/g, " ").trim();
      };
      return {
        uid: msg.attributes?.uid ?? msg.seqno,
        seqno: msg.seqno,
        seen: !!(msg.attributes?.flags ?? []).includes("\\Seen"),
        date: parseAddresses(hdr.date),
        from: parseAddresses(hdr.from),
        to: parseAddresses(hdr.to),
        subject: parseAddresses(hdr.subject) || "(no subject)",
      };
    });

    connection.end();
    res.json({ messages: result, total });
  } catch (err: any) {
    try { connection?.end(); } catch {}
    const msg = err?.message ?? "Unknown error";
    res.status(500).json({ error: "IMAP connection failed", detail: msg });
  }
});

// ─── POST /email-accounts/:id/fetch-body — fetch full body of a single email ──
router.post("/email-accounts/:id/fetch-body", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const id = parseInt(req.params.id as string, 10);
  const { seqno, mailbox = "INBOX" } = req.body;
  if (!seqno) { res.status(400).json({ error: "seqno required" }); return; }

  const [account] = await db.select().from(emailAccountsTable)
    .where(and(eq(emailAccountsTable.id, id), eq(emailAccountsTable.userId, userId)));
  if (!account || !account.imapHost || !account.password) {
    res.status(404).json({ error: "Account not found or not configured" }); return;
  }

  const imapConfig = {
    imap: {
      user: account.username ?? account.emailAddress,
      password: account.password,
      host: account.imapHost,
      port: account.imapPort ?? 993,
      tls: account.useSSL !== false,
      tlsOptions: { rejectUnauthorized: false },
      authTimeout: 15000,
      connTimeout: 15000,
    },
  };

  let connection: any = null;
  try {
    connection = await (imaps as any).connect(imapConfig);
    await connection.openBox(mailbox);

    const messages = await connection.fetchMessages(`${seqno}:${seqno}`, {
      bodies: ["TEXT", "HEADER"],
      markSeen: false,
      struct: false,
    });

    const msg = messages[0];
    const textPart = msg?.parts?.find((p: any) => p.which === "TEXT");
    const headerPart = msg?.parts?.find((p: any) => p.which === "HEADER");
    const hdr = headerPart?.body ?? {};

    // Strip HTML tags for plain text display
    let body = (textPart?.body as string) ?? "";
    // Remove base64 encoded sections (usually attachments) and trim
    body = body.replace(/Content-Transfer-Encoding: base64[\s\S]*?(?=--|\z)/gm, "[attachment]");
    body = body.substring(0, 8000);

    connection.end();
    res.json({
      seqno,
      subject: (Array.isArray(hdr.subject) ? hdr.subject[0] : hdr.subject) || "(no subject)",
      from: (Array.isArray(hdr.from) ? hdr.from[0] : hdr.from) || "",
      date: (Array.isArray(hdr.date) ? hdr.date[0] : hdr.date) || "",
      body,
    });
  } catch (err: any) {
    try { connection?.end(); } catch {}
    res.status(500).json({ error: "Failed to fetch email body", detail: err?.message });
  }
});

export default router;
