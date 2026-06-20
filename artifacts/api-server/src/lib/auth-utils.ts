import jwt from "jsonwebtoken";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { Request } from "express";

export function getTokenFromReq(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;
  return authHeader.replace("Bearer ", "").trim();
}

export function getUserIdSync(req: Request): number {
  const token = getTokenFromReq(req);
  if (!token) return 1;
  try {
    const payload = JSON.parse(Buffer.from(token, "base64").toString());
    if (payload.userId) return Number(payload.userId);
  } catch {}
  return 1;
}

export function isAdminSync(req: Request): boolean {
  const token = getTokenFromReq(req);
  if (!token) return false;
  try {
    const payload = JSON.parse(Buffer.from(token, "base64").toString());
    return payload.role === "admin";
  } catch {}
  return false;
}

export async function getUserFromToken(token: string): Promise<{ userId: number; role: string } | null> {
  // Try base64 JSON (demo / legacy accounts)
  try {
    const payload = JSON.parse(Buffer.from(token, "base64").toString());
    if (payload.userId) return { userId: Number(payload.userId), role: payload.role ?? "user" };
  } catch {}

  // Try Supabase / standard JWT
  const jwtSecret = process.env.SUPABASE_JWT_SECRET;
  if (jwtSecret) {
    try {
      const payload = jwt.verify(token, jwtSecret) as Record<string, unknown>;
      const email = payload.email as string | undefined;
      if (email) {
        const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email));
        if (existing) return { userId: existing.id, role: existing.role };
        // Auto-provision user from Supabase identity
        const meta = (payload.user_metadata ?? payload.raw_user_meta_data ?? {}) as Record<string, string>;
        const base = (meta.preferred_username ?? meta.user_name ?? email.split("@")[0]).replace(/[^a-zA-Z0-9]/g, "_");
        const username = `${base}_${Date.now()}`;
        const name = meta.full_name ?? meta.name ?? username;
        const [newUser] = await db.insert(usersTable).values({
          email, username, passwordHash: "", role: "user", status: "active",
          emailVerified: true, twoFaEnabled: false,
          avatarUrl: meta.avatar_url ?? meta.picture ?? null,
        }).returning();
        return { userId: newUser.id, role: "user" };
      }
    } catch {}
  }

  return null;
}

export async function getUserIdAsync(req: Request): Promise<number> {
  const token = getTokenFromReq(req);
  if (!token) return 1;
  const result = await getUserFromToken(token);
  return result?.userId ?? 1;
}

export async function isAdminAsync(req: Request): Promise<boolean> {
  const token = getTokenFromReq(req);
  if (!token) return false;
  const result = await getUserFromToken(token);
  return result?.role === "admin";
}
