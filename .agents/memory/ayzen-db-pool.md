---
name: AYZEN DB Pool Config
description: Supabase pooler URL handling and SSL config for Drizzle ORM in lib/db/src/index.ts
---

## Rule
`buildPoolConfig()` in `lib/db/src/index.ts` normalises DATABASE_URL to always work with Drizzle:
1. Supabase direct URL (`db.PROJECT.supabase.co`) → redirects to session pooler host
2. Supabase transaction pooler (port 6543) → switches to port 5432 (session pooler)
3. All Supabase / hosted DBs → adds `ssl: { rejectUnauthorized: false }`

**Why:** Drizzle ORM uses named prepared statements (`pool.query({ name, text, values })`). Supabase's **transaction pooler (port 6543)** does NOT support prepared statements — every Drizzle select/insert/update fails with "Failed query". The session pooler (port 5432) supports them. SSL rejection also fails in Replit's sandboxed network.

**How to apply:** This is already handled in `lib/db/src/index.ts`. When a user reports a new DATABASE_URL and queries fail, check: (a) Is the port 6543? (b) Is it a Supabase URL missing SSL config? The `buildPoolConfig` function handles both.

## Debugging tip
Drizzle wraps the real pg error in a `DrizzleQueryError` with a `.cause` property. The pino logger does NOT log `.cause`. To expose the real error, temporarily add:
```ts
} catch (e: any) {
  console.error("cause:", e?.cause?.message, "code:", e?.cause?.code);
  throw e;
}
```
The "Failed query" message alone is NOT the real error.
