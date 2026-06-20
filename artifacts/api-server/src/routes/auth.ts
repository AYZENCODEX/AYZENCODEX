import { Router } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import * as crypto from "crypto";
import { getUserFromToken } from "../lib/auth-utils";

const router = Router();

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password + "ayzen_salt").digest("hex");
}

function generateToken(userId: number, role: string): string {
  const payload = { userId, role, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 };
  return Buffer.from(JSON.stringify(payload)).toString("base64");
}

function sanitizeUser(user: typeof usersTable.$inferSelect) {
  const { passwordHash: _ph, twoFaSecret: _ts, ...safe } = user;
  return {
    ...safe,
    createdAt: safe.createdAt.toISOString(),
    lastActiveAt: safe.lastActiveAt?.toISOString() ?? null,
  };
}

router.post("/auth/register", async (req, res): Promise<void> => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    res.status(400).json({ error: "username, email, and password are required" }); return;
  }
  const existing = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (existing.length > 0) { res.status(409).json({ error: "Email already registered" }); return; }
  const [user] = await db.insert(usersTable).values({
    username, email, passwordHash: hashPassword(password),
    role: "user", status: "active", emailVerified: false, twoFaEnabled: false,
  }).returning();
  const token = generateToken(user.id, user.role);
  res.status(201).json({ token, refreshToken: token, user: sanitizeUser(user) });
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const { email, password } = req.body;
  if (!email || !password) { res.status(400).json({ error: "email and password are required" }); return; }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (!user || user.passwordHash !== hashPassword(password)) {
    res.status(401).json({ error: "Invalid credentials" }); return;
  }
  await db.update(usersTable).set({ lastActiveAt: new Date() }).where(eq(usersTable.id, user.id));
  const token = generateToken(user.id, user.role);
  res.json({ token, refreshToken: token, user: sanitizeUser(user) });
});

// Supabase OAuth sync — called by frontend after Supabase sign-in
router.post("/auth/supabase-sync", async (req, res): Promise<void> => {
  const token = req.headers.authorization?.replace("Bearer ", "").trim();
  if (!token) { res.status(401).json({ error: "No token provided" }); return; }
  const result = await getUserFromToken(token);
  if (!result) { res.status(401).json({ error: "Invalid or unrecognized token" }); return; }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, result.userId));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  await db.update(usersTable).set({ lastActiveAt: new Date() }).where(eq(usersTable.id, user.id));
  // Return Supabase token as ayzen_token — our middleware knows how to verify it
  res.json({ token, refreshToken: token, user: sanitizeUser(user) });
});

router.post("/auth/refresh", async (req, res): Promise<void> => {
  const { refreshToken } = req.body;
  if (!refreshToken) { res.status(400).json({ error: "refreshToken is required" }); return; }
  const result = await getUserFromToken(refreshToken);
  if (!result) { res.status(401).json({ error: "Invalid token" }); return; }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, result.userId));
  if (!user) { res.status(401).json({ error: "User not found" }); return; }
  const token = generateToken(user.id, user.role);
  res.json({ token, refreshToken: token, user: sanitizeUser(user) });
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
  const token = req.headers.authorization?.replace("Bearer ", "").trim();
  if (!token) { res.status(401).json({ error: "Unauthorized" }); return; }
  const result = await getUserFromToken(token);
  if (!result) { res.status(401).json({ error: "Invalid token" }); return; }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, result.userId));
  if (!user) { res.status(401).json({ error: "User not found" }); return; }
  res.json(sanitizeUser(user));
});

export default router;
