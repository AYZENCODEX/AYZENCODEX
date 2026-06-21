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
 * Supabase's direct DB host (db.PROJECT.supabase.co) has no DNS A records
 * from Replit. Redirect to the session pooler, which resolves correctly.
 * Parse URL into individual Pool options so ssl settings aren't overridden
 * by connection-string parsing.
 */
function buildPoolConfig(rawUrl: string): pg.PoolConfig {
  const u = new URL(rawUrl);
  const directMatch = u.hostname.match(/^db\.([^.]+)\.supabase\.co$/);

  if (directMatch) {
    const projectRef = directMatch[1];
    // Session pooler: different host + username prefix, SSL required but
    // Replit's trust store doesn't include Supabase's intermediate CA so we
    // skip verification (connection is still encrypted).
    return {
      host: "aws-0-us-east-1.pooler.supabase.com",
      port: 5432,
      user: `postgres.${projectRef}`,
      password: decodeURIComponent(u.password),
      database: u.pathname.replace(/^\//, "") || "postgres",
      ssl: { rejectUnauthorized: false },
    };
  }

  // Already a pooler URL or unknown format — use the string as-is
  return { connectionString: rawUrl };
}

const poolConfig = buildPoolConfig(process.env.DATABASE_URL);

export const pool = new Pool(poolConfig);
export const db = drizzle(pool, { schema });

export * from "./schema";
