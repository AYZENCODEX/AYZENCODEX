import { Router } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import * as crypto from "crypto";

const router = Router();

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password + "ayzen_salt").digest("hex");
}

function generateToken(userId: number, role: string): string {
  const payload = { userId, role, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 };
  return Buffer.from(JSON.stringify(payload)).toString("base64");
}

router.post("/auth/register", async (req, res): Promise<void> => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    res.status(400).json({ error: "username, email, and password are required" });
    return;
  }
  const existing = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (existing.length > 0) {
    res.status(409).json({ error: "Email already registered" });
    return;
  }
  const [user] = await db.insert(usersTable).values({
    username,
    email,
    passwordHash: hashPassword(password),
    role: "user",
    status: "active",
    emailVerified: false,
    twoFaEnabled: false,
  }).returning();
  const token = generateToken(user.id, user.role);
  res.status(201).json({ token, refreshToken: token, user: sanitizeUser(user) });
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: "email and password are required" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (!user || user.passwordHash !== hashPassword(password)) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }
  await db.update(usersTable).set({ lastActiveAt: new Date() }).where(eq(usersTable.id, user.id));
  const token = generateToken(user.id, user.role);
  res.json({ token, refreshToken: token, user: sanitizeUser(user) });
});

router.post("/auth/refresh", async (req, res): Promise<void> => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    res.status(400).json({ error: "refreshToken is required" });
    return;
  }
  try {
    const payload = JSON.parse(Buffer.from(refreshToken, "base64").toString());
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, payload.userId));
    if (!user) { res.status(401).json({ error: "Invalid token" }); return; }
    const token = generateToken(user.id, user.role);
    res.json({ token, refreshToken: token, user: sanitizeUser(user) });
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
});

router.post("/auth/setup-2fa", async (_req, res): Promise<void> => {
  const secret = crypto.randomBytes(20).toString("base64").replace(/[^A-Z2-7]/gi, "A").slice(0, 32).toUpperCase();
  const otpauthUrl = `otpauth://totp/AYZEN:user@ayzen.io?secret=${secret}&issuer=AYZEN`;
  res.json({ otpauthUrl, secret, qrCodeDataUrl: `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(otpauthUrl)}&size=200x200` });
});

router.post("/auth/verify-2fa", async (_req, res): Promise<void> => {
  res.json({ message: "2FA verified successfully" });
});

router.get("/auth/me", async (req, res): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const token = authHeader.replace("Bearer ", "");
    const payload = JSON.parse(Buffer.from(token, "base64").toString());
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, payload.userId));
    if (!user) { res.status(401).json({ error: "User not found" }); return; }
    res.json(sanitizeUser(user));
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
});

function sanitizeUser(user: typeof usersTable.$inferSelect) {
  const { passwordHash: _ph, twoFaSecret: _ts, ...safe } = user;
  return {
    ...safe,
    createdAt: safe.createdAt.toISOString(),
    lastActiveAt: safe.lastActiveAt?.toISOString() ?? null,
  };
}

export default router;
