---
name: Telegram bot 409 polling conflict
description: How the Telegram bot handles 409 conflicts on restart and what the residual behavior looks like.
---

# Telegram bot 409 on restart

## The rule
On restart, the new process will get a 409 from the old session for ~30-60s. This is normal and expected with long-polling mode.

**Why:** Telegram holds the getUpdates TCP connection for up to the polling timeout after a process dies. With 2s polling timeout, the old session should die within ~5s, but Telegram may hold it longer.

**How to apply:**
- `polling_error` handler for 409 calls `b.stopPolling()` then retries via `setTimeout(15000)` — no infinite spam
- On startup, bot waits 20s (deleteWebhook + delay) before calling `startPolling()`
- Polling timeout set to 2s so graceful shutdown (`stopPolling()`) completes well within SIGTERM grace period
- SIGTERM handler in `index.ts` calls `stopTelegramBot()` → `b.stopPolling()` before `process.exit(0)`
- After a couple of backoff cycles (30-60s total), the bot takes over cleanly

## Residual warning
You will see 1-2 lines of `WARN: Telegram 409: another polling session active. Stopping, will retry in 15s.` after each restart. This is normal and not a bug. If it persists for > 2 minutes, check for zombie node processes.
