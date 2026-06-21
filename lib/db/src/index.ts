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
 * Normalise the DATABASE_URL so it always works with Drizzle's prepared-statement queries.
 *
 * Common problems:
 * 1. Supabase direct URL (db.PROJECT.supabase.co) → DNS not reachable from Replit.
 *    Fix: redirect to session pooler.
 *
 * 2. Supabase Transaction Pooler (port 6543) → does NOT support prepared statements.
 *    Drizzle uses prepared statements, so every query fails.
 *    Fix: switch port to 5432 (Session Pooler) which supports prepared statements.
 *
 * 3. Any Supabase URL → requires SSL but Replit's trust store may reject the cert.
 *    Fix: always use ssl: { rejectUnauthorized: false } for Supabase hosts.
 */
function buildPoolConfig(rawUrl: string): pg.PoolConfig {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    // Fallback: try as-is
    return { connectionString: rawUrl };
  }

  const host = u.hostname;

  // ── Supabase direct DB host ──────────────────────────────────────────────
  const directMatch = host.match(/^db\.([^.]+)\.supabase\.co$/);
  if (directMatch) {
    const projectRef = directMatch[1];
    return {
      host: `aws-0-us-east-1.pooler.supabase.com`,
      port: 5432,                               // session pooler (supports prepared stmts)
      user: `postgres.${projectRef}`,
      password: decodeURIComponent(u.password),
      database: u.pathname.replace(/^\//, "") || "postgres",
      ssl: { rejectUnauthorized: false },
    };
  }

  // ── Supabase pooler URL (any region) ─────────────────────────────────────
  const isSupabasePooler = /\.pooler\.supabase\.com$/.test(host);
  if (isSupabasePooler) {
    // Switch from transaction pooler (6543) → session pooler (5432) if needed
    if (u.port === "6543") {
      u.port = "5432";
    }
    return {
      connectionString: u.toString(),
      ssl: { rejectUnauthorized: false },
    };
  }

  // ── Other Supabase hosts (e.g. legacy) ────────────────────────────────────
  if (host.endsWith(".supabase.co")) {
    return {
      connectionString: rawUrl,
      ssl: { rejectUnauthorized: false },
    };
  }

  // ── Non-Supabase databases (Neon, Railway, etc.) ─────────────────────────
  // Add ssl: rejectUnauthorized: false as a safe default for hosted DBs
  return {
    connectionString: rawUrl,
    ssl: { rejectUnauthorized: false },
  };
}

const poolConfig = buildPoolConfig(process.env.DATABASE_URL);

export const pool = new Pool(poolConfig);
export const db = drizzle(pool, { schema });

export * from "./schema";
