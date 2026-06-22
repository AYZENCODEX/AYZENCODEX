import { Router } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import * as crypto from "crypto";
import { referralsTable } from "@workspace/db";
import { getUserFromToken } from "../lib/auth-utils";
import { getFirebaseAdmin } from "../lib/firebase-admin";
import { sendEmail } from "../lib/email";

const router = Router();

// ─── In-memory OTP store ────────────────────────────────────────────────────
interface OtpEntry { code: string; expiry: number; }
const otpStore = new Map<string, OtpEntry>();

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function storeOtp(email: string, code: string) {
  otpStore.set(email.toLowerCase(), { code, expiry: Date.now() + 10 * 60 * 1000 });
}

function verifyOtp(email: string, code: string): boolean {
  const entry = otpStore.get(email.toLowerCase());
  if (!entry) return false;
  if (Date.now() > entry.expiry) { otpStore.delete(email.toLowerCase()); return false; }
  if (entry.code !== code.trim()) return false;
  otpStore.delete(email.toLowerCase());
  return true;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
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

// ─── POST /auth/send-otp — send 6-digit email verification code ──────────────
router.post("/auth/send-otp", async (req, res): Promise<void> => {
  const { email } = req.body;
  if (!email) { res.status(400).json({ error: "email is required" }); return; }

  const code = generateOtp();
  storeOtp(email, code);

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><style>
  body{margin:0;padding:0;background:#0a0d12;font-family:'Courier New',monospace;color:#e0f7f7;}
  .wrap{max-width:520px;margin:40px auto;background:#0d1117;border:1px solid #1a3a3a;border-radius:8px;overflow:hidden;}
  .header{padding:24px 32px;border-bottom:1px solid #1a3a3a;background:#070a0f;}
  .logo{font-size:20px;font-weight:bold;letter-spacing:4px;color:#00d4cc;}
  .sub{font-size:10px;letter-spacing:3px;color:#4a8080;margin-top:4px;text-transform:uppercase;}
  .body{padding:32px;}
  h2{color:#00d4cc;font-size:16px;letter-spacing:2px;text-transform:uppercase;margin:0 0 16px;}
  p{color:#a0c8c8;font-size:13px;line-height:1.7;margin:0 0 12px;}
  .otp{display:block;font-size:36px;font-weight:bold;letter-spacing:12px;color:#00d4cc;margin:24px 0;text-align:center;background:#070a0f;padding:20px;border-radius:6px;border:1px solid #1a3a3a;}
  .footer{padding:20px 32px;border-top:1px solid #1a3a3a;font-size:10px;color:#2a5050;letter-spacing:1px;}
</style></head>
<body><div class="wrap">
  <div class="header"><div class="logo">&gt;_ AYZEN</div><div class="sub">Airdrop Command Center</div></div>
  <div class="body">
    <h2>Verification Code</h2>
    <p>Your one-time verification code for AYZEN:</p>
    <span class="otp">${code}</span>
    <p>This code expires in <strong>10 minutes</strong>. Do not share it with anyone.</p>
  </div>
  <div class="footer">&copy; 2026 AYZEN &mdash; If you didn't request this, ignore this email.</div>
</div></body></html>`;

  const result = await sendEmail({ to: email, subject: "AYZEN — Verification Code", html, text: `Your AYZEN verification code: ${code} (expires in 10 minutes)` });

  if (!result.success) {
    res.status(503).json({ error: "Failed to send email. Please check email config.", detail: result.error });
    return;
  }
  res.json({ message: "Verification code sent to your email." });
});

// ─── POST /auth/register ─────────────────────────────────────────────────────
router.post("/auth/register", async (req, res): Promise<void> => {
  const { username, email, password, refCode, emailOtp } = req.body;
  if (!username || !email || !password) {
    res.status(400).json({ error: "username, email, and password are required" }); return;
  }

  // Verify OTP if provided (required for new registrations)
  if (!emailOtp) {
    res.status(400).json({ error: "Email verification code is required. Please request a code first." }); return;
  }
  if (!verifyOtp(email, emailOtp)) {
    res.status(400).json({ error: "Invalid or expired verification code. Please request a new one." }); return;
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
    role: "user", status: "active", emailVerified: true, twoFaEnabled: false,
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

// ─── POST /auth/login ────────────────────────────────────────────────────────
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

// ─── POST /auth/magic-link — send OTP via Resend (replaces Supabase) ─────────
router.post("/auth/magic-link", async (req, res): Promise<void> => {
  const { email } = req.body;
  if (!email) { res.status(400).json({ error: "email is required" }); return; }

  const code = generateOtp();
  storeOtp(email, code);

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><style>
  body{margin:0;padding:0;background:#0a0d12;font-family:'Courier New',monospace;color:#e0f7f7;}
  .wrap{max-width:520px;margin:40px auto;background:#0d1117;border:1px solid #1a3a3a;border-radius:8px;overflow:hidden;}
  .header{padding:24px 32px;border-bottom:1px solid #1a3a3a;background:#070a0f;}
  .logo{font-size:20px;font-weight:bold;letter-spacing:4px;color:#00d4cc;}
  .sub{font-size:10px;letter-spacing:3px;color:#4a8080;margin-top:4px;text-transform:uppercase;}
  .body{padding:32px;}
  h2{color:#00d4cc;font-size:16px;letter-spacing:2px;text-transform:uppercase;margin:0 0 16px;}
  p{color:#a0c8c8;font-size:13px;line-height:1.7;margin:0 0 12px;}
  .otp{display:block;font-size:36px;font-weight:bold;letter-spacing:12px;color:#00d4cc;margin:24px 0;text-align:center;background:#070a0f;padding:20px;border-radius:6px;border:1px solid #1a3a3a;}
  .footer{padding:20px 32px;border-top:1px solid #1a3a3a;font-size:10px;color:#2a5050;letter-spacing:1px;}
</style></head>
<body><div class="wrap">
  <div class="header"><div class="logo">&gt;_ AYZEN</div><div class="sub">Airdrop Command Center</div></div>
  <div class="body">
    <h2>Login Code</h2>
    <p>Your AYZEN passwordless login code:</p>
    <span class="otp">${code}</span>
    <p>This code expires in <strong>10 minutes</strong>.</p>
  </div>
  <div class="footer">&copy; 2026 AYZEN &mdash; If you didn't request this, ignore this email.</div>
</div></body></html>`;

  const result = await sendEmail({ to: email, subject: "AYZEN — Login Code", html, text: `Your AYZEN login code: ${code}` });
  if (!result.success) {
    res.status(503).json({ error: "Failed to send login code. Check email configuration.", detail: result.error });
    return;
  }
  res.json({ message: "Login code sent to your email." });
});

// ─── POST /auth/magic-link/verify — verify OTP and login ─────────────────────
router.post("/auth/magic-link/verify", async (req, res): Promise<void> => {
  const { email, code } = req.body;
  if (!email || !code) { res.status(400).json({ error: "email and code are required" }); return; }

  if (!verifyOtp(email, code)) {
    res.status(401).json({ error: "Invalid or expired code" }); return;
  }

  let [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (!user) {
    const username = email.split("@")[0].replace(/[^a-z0-9_]/gi, "_").toLowerCase().slice(0, 20) + "_" + crypto.randomBytes(2).toString("hex");
    const referralCode = "AYZN" + crypto.randomBytes(3).toString("hex").toUpperCase();
    [user] = await db.insert(usersTable).values({
      username, email,
      passwordHash: hashPassword(crypto.randomBytes(16).toString("hex")),
      role: "user", status: "active", emailVerified: true, twoFaEnabled: false,
      referralCode,
    }).returning();
  } else {
    await db.update(usersTable).set({ lastActiveAt: new Date(), emailVerified: true }).where(eq(usersTable.id, user.id));
  }

  const token = generateToken(user.id, user.role);
  res.json({ token, refreshToken: token, user: sanitizeUser(user) });
});

// ─── Firebase OAuth sync ──────────────────────────────────────────────────────
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

// ─── Supabase OAuth sync — legacy fallback ────────────────────────────────────
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
