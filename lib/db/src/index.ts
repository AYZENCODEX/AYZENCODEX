import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Normalise to sslmode=verify-full so the pg library doesn't emit a
// deprecation warning about 'prefer'/'require'/'verify-ca' aliases.
const connectionString = process.env.DATABASE_URL.replace(
  /sslmode=(prefer|require|verify-ca)/g,
  "sslmode=verify-full",
);

export const pool = new Pool({ connectionString });
export const db = drizzle(pool, { schema });

export * from "./schema";
