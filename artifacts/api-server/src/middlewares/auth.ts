import type { Request, Response, NextFunction } from "express";
import { getTokenFromReq, getUserFromToken } from "../lib/auth-utils";

export interface AuthUser { userId: number; role: string; }

declare module "express" {
  interface Request { user?: AuthUser; }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = getTokenFromReq(req);
  if (!token) { res.status(401).json({ error: "Unauthorized", code: "NO_TOKEN", solution: "Include a valid Authorization: Bearer <token> header." }); return; }
  const user = await getUserFromToken(token);
  if (!user) { res.status(401).json({ error: "Unauthorized", code: "INVALID_TOKEN", solution: "Token is invalid or expired. Please log in again." }); return; }
  req.user = user;
  next();
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = getTokenFromReq(req);
  if (!token) { res.status(401).json({ error: "Unauthorized", code: "NO_TOKEN", solution: "Include a valid Authorization: Bearer <token> header." }); return; }
  const user = await getUserFromToken(token);
  if (!user) { res.status(401).json({ error: "Unauthorized", code: "INVALID_TOKEN", solution: "Token is invalid or expired. Please log in again." }); return; }
  if (user.role !== "admin") { res.status(403).json({ error: "Forbidden", code: "NOT_ADMIN", solution: "This action requires admin privileges." }); return; }
  req.user = user;
  next();
}

export function getRequestUser(req: Request): AuthUser | null {
  if (req.user) return req.user;
  const token = getTokenFromReq(req);
  if (!token) return null;
  try {
    const payload = JSON.parse(Buffer.from(token, "base64").toString());
    if (payload.userId) return { userId: Number(payload.userId), role: payload.role ?? "user" };
  } catch {}
  return null;
}

export function getRequestUserId(req: Request): number | null {
  const user = getRequestUser(req);
  return user?.userId ?? null;
}
