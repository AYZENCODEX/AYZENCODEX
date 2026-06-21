import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

/**
 * Normalise the DATABASE_URL so it always works with Drizzle.
 *
 * Problems handled:
 * 1. Supabase direct URL (db.PROJECT.supabase.co) → DNS unreachable from Replit.
 *    Fix: redirect to session pooler (port 5432).
 *
 * 2. Supabase Transaction Pooler (port 6543) → does NOT support prepared statements.
 *    Fix: switch port to 5432 (Session Pooler).
 *
 * 3. Any Supabase / hosted DB → may reject Replit's SSL cert.
 *    Fix: ssl: { rejectUnauthorized: false }.
 */
function buildPoolConfig(rawUrl: string): pg.PoolConfig {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    return { connectionString: rawUrl };
  }

  const host = u.hostname;

  const directMatch = host.match(/^db\.([^.]+)\.supabase\.co$/);
  if (directMatch) {
    const projectRef = directMatch[1];
    return {
      host: `aws-0-us-east-1.pooler.supabase.com`,
      port: 5432,
      user: `postgres.${projectRef}`,
      password: decodeURIComponent(u.password),
      database: u.pathname.replace(/^\//, "") || "postgres",
      ssl: { rejectUnauthorized: false },
    };
  }

  const isSupabasePooler = /\.pooler\.supabase\.com$/.test(host);
  if (isSupabasePooler) {
    if (u.port === "6543") u.port = "5432";
    return { connectionString: u.toString(), ssl: { rejectUnauthorized: false } };
  }

  if (host.endsWith(".supabase.co")) {
    return { connectionString: rawUrl, ssl: { rejectUnauthorized: false } };
  }

  return { connectionString: rawUrl, ssl: { rejectUnauthorized: false } };
}

const poolConfig = buildPoolConfig(process.env.DATABASE_URL);
export const pool = new Pool(poolConfig);
export const db = drizzle(pool, { schema });

export * from "./schema";
