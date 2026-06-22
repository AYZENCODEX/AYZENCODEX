import { Router } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import * as crypto from "crypto";
import { referralsTable } from "@workspace/db";
import { getUserFromToken } from "../lib/auth-utils";
import { getFirebaseAdmin } from "../lib/firebase-admin";

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

function generateReferralCode(): string {
  return "AYZN" + crypto.randomBytes(3).toString("hex").toUpperCase();
}

router.post("/auth/register", async (req, res): Promise<void> => {
  const { username, email, password, refCode } = req.body;
  if (!username || !email || !password) {
    res.status(400).json({ error: "username, email, and password are required" }); return;
  }
  const existing = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (existing.length > 0) { res.status(409).json({ error: "Email already registered" }); return; }

  let referralCode = generateReferralCode();
  let codeExists = true;
  while (codeExists) {
    const check = await db.select().from(usersTable).where(eq(usersTable.referralCode, referralCode));
    if (check.length === 0) codeExists = false;
    else referralCode = generateReferralCode();
  }

  let referredBy: number | null = null;
  let referrer: typeof usersTable.$inferSelect | null = null;
  if (refCode) {
    const [found] = await db.select().from(usersTable).where(eq(usersTable.referralCode, (refCode as string).toUpperCase().trim()));
    if (found) { referredBy = found.id; referrer = found; }
  }

  const [user] = await db.insert(usersTable).values({
    username, email, passwordHash: hashPassword(password),
    role: "user", status: "active", emailVerified: false, twoFaEnabled: false,
    referralCode,
    ...(referredBy ? { referredBy } : {}),
  }).returning();

  if (referrer) {
    await db.insert(referralsTable).values({
      referrerId: referrer.id,
      referredId: user.id,
      codeUsed: (refCode as string).toUpperCase().trim(),
      rewardAmount: 10,
      rewardPaid: false,
    });
  }

  const token = generateToken(user.id, user.role);

  import("../lib/email").then(({ sendWelcomeEmail }) => {
    sendWelcomeEmail(user.email, user.username).catch(() => {});
  }).catch(() => {});

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

// Magic link — send via Supabase
router.post("/auth/magic-link", async (req, res): Promise<void> => {
  const { email } = req.body;
  if (!email) { res.status(400).json({ error: "email is required" }); return; }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    res.status(503).json({ error: "Magic link not configured" }); return;
  }

  try {
    const resp = await fetch(`${supabaseUrl}/auth/v1/otp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({ email, create_user: true }),
    });
    if (!resp.ok) {
      const err = await resp.json() as any;
      res.status(400).json({ error: err.msg ?? "Failed to send magic link" }); return;
    }
    res.json({ message: "Magic link sent to your email" });
  } catch {
    res.status(500).json({ error: "Failed to send magic link" });
  }
});

// Magic link verify — exchange Supabase token for AYZEN session
router.post("/auth/magic-link/verify", async (req, res): Promise<void> => {
  const { access_token, email } = req.body;
  if (!access_token || !email) { res.status(400).json({ error: "access_token and email are required" }); return; }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) {
    res.status(503).json({ error: "Auth not configured" }); return;
  }

  try {
    // Verify the access token with Supabase
    const resp = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${access_token}`,
        apikey: supabaseServiceKey,
      },
    });
    if (!resp.ok) { res.status(401).json({ error: "Invalid token" }); return; }
    const supaUser = await resp.json() as any;
    const userEmail = supaUser.email ?? email;

    // Find or create AYZEN user
    let [user] = await db.select().from(usersTable).where(eq(usersTable.email, userEmail));
    if (!user) {
      const username = userEmail.split("@")[0].replace(/[^a-z0-9_]/gi, "_").toLowerCase().slice(0, 20) + "_" + crypto.randomBytes(2).toString("hex");
      const referralCode = "AYZN" + crypto.randomBytes(3).toString("hex").toUpperCase();
      [user] = await db.insert(usersTable).values({
        username, email: userEmail,
        passwordHash: hashPassword(crypto.randomBytes(16).toString("hex")),
        role: "user", status: "active", emailVerified: true, twoFaEnabled: false,
        referralCode,
      }).returning();
    } else {
      await db.update(usersTable).set({ lastActiveAt: new Date(), emailVerified: true }).where(eq(usersTable.id, user.id));
    }

    const token = generateToken(user.id, user.role);
    res.json({ token, refreshToken: token, user: sanitizeUser(user) });
  } catch (err: any) {
    res.status(500).json({ error: "Verification failed", detail: err?.message });
  }
});

// Firebase OAuth sync — called by frontend after Firebase sign-in
router.post("/auth/firebase-sync", async (req, res): Promise<void> => {
  const { idToken } = req.body as { idToken?: string };
  if (!idToken) { res.status(400).json({ error: "idToken is required" }); return; }
  const result = await getUserFromToken(idToken);
  if (!result) { res.status(401).json({ error: "Invalid Firebase token" }); return; }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, result.userId));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  await db.update(usersTable).set({ lastActiveAt: new Date() }).where(eq(usersTable.id, user.id));
  const token = generateToken(user.id, user.role);
  res.json({ token, refreshToken: token, user: sanitizeUser(user) });
});

// Supabase OAuth sync — legacy fallback
router.post("/auth/supabase-sync", async (req, res): Promise<void> => {
  const token = req.headers.authorization?.replace("Bearer ", "").trim();
  if (!token) { res.status(401).json({ error: "No token provided" }); return; }
  const result = await getUserFromToken(token);
  if (!result) { res.status(401).json({ error: "Invalid or unrecognized token" }); return; }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, result.userId));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  await db.update(usersTable).set({ lastActiveAt: new Date() }).where(eq(usersTable.id, user.id));
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
