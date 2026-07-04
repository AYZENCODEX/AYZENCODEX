---
name: Swallowed error aborts pg transaction
description: A caught/ignored query error inside a manual BEGIN/COMMIT transaction silently turns COMMIT into a no-op ROLLBACK.
---

## Rule
In Postgres, once any statement inside a transaction fails, the transaction enters an "aborted" state. Every subsequent statement — including `COMMIT` — is rejected by the server as a no-op equivalent to `ROLLBACK`, but **the pg driver does not throw an error for this**. Code that does `await client.query(...).catch(() => {})` on a query that might fail (e.g. writing to a column/table that doesn't actually match the current schema) will silently abort the whole transaction, and the final `await client.query("COMMIT")` will succeed without error while nothing was actually persisted.

**Why:** Found while debugging a "daily check-in claim doesn't save" bug — the route returned `ok: true` every time (even on repeated calls that should have hit a UNIQUE constraint violation), but `user_checkins` stayed empty. The real cause was two `.catch(() => {})`-wrapped queries in the middle of the transaction (`UPDATE users SET xp = ...` on a non-existent `xp` column, and an `INSERT INTO credits` using the wrong column names) that failed and aborted the transaction before the real `COMMIT`.

**How to apply:**
- Never wrap a query inside a manual `BEGIN`/`COMMIT` transaction with `.catch(() => {})` "just in case the column/table doesn't exist." If it's optional, verify the schema first, or catch the error and explicitly `ROLLBACK` + report failure — never let it be silently swallowed and let the outer `COMMIT` proceed.
- When behavior looks like "write succeeds (`ok:true`) but data never persists" and a repeat write doesn't even hit a UNIQUE violation, suspect an aborted transaction from an earlier silently-caught error, not a connection-pooling issue. Verify by temporarily removing all `.catch(() => {})` on statements inside the transaction and rechecking the real thrown error.
- Also always double check actual column names in the live DB (`information_schema.columns`) before writing raw SQL against tables like `credits`/`users` — schema names can drift from what a route file assumes.
