import app from "./app";
import { logger } from "./lib/logger";
import { logBus } from "./lib/log-bus";
import { initTelegramBot } from "./lib/telegram";
import { getFirebaseAdmin } from "./lib/firebase-admin";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const MIGRATIONS = [
  "CREATE TABLE IF NOT EXISTS subscriptions (id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL UNIQUE, plan TEXT NOT NULL DEFAULT 'free', status TEXT NOT NULL DEFAULT 'active', coingate_order_id TEXT, coingate_payment_url TEXT, expires_at TIMESTAMP, cancelled_at TIMESTAMP, is_lifetime BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMP NOT NULL DEFAULT NOW(), updated_at TIMESTAMP NOT NULL DEFAULT NOW())",
  "ALTER TABLE vault_entries ADD COLUMN IF NOT EXISTS other_accounts TEXT",
  "ALTER TABLE projects ADD COLUMN IF NOT EXISTS xp_name TEXT",
  "ALTER TABLE vault_entries ADD COLUMN IF NOT EXISTS email_recovery TEXT",
  "ALTER TABLE vault_entries ADD COLUMN IF NOT EXISTS email_recovery_password TEXT",
  "ALTER TABLE vault_entries ADD COLUMN IF NOT EXISTS twitter_email TEXT",
  "ALTER TABLE vault_entries ADD COLUMN IF NOT EXISTS twitter_email_password TEXT",
  "ALTER TABLE vault_entries ADD COLUMN IF NOT EXISTS twitter_followers TEXT",
  "ALTER TABLE vault_entries ADD COLUMN IF NOT EXISTS twitter_2fa TEXT",
  "ALTER TABLE vault_entries ADD COLUMN IF NOT EXISTS twitter_email_recovery TEXT",
  "ALTER TABLE vault_entries ADD COLUMN IF NOT EXISTS twitter_email_recovery_password TEXT",
  "ALTER TABLE vault_entries ADD COLUMN IF NOT EXISTS discord_email TEXT",
  "ALTER TABLE vault_entries ADD COLUMN IF NOT EXISTS discord_email_password TEXT",
  "ALTER TABLE vault_entries ADD COLUMN IF NOT EXISTS discord_2fa TEXT",
  "ALTER TABLE vault_entries ADD COLUMN IF NOT EXISTS discord_email_recovery TEXT",
  "ALTER TABLE vault_entries ADD COLUMN IF NOT EXISTS discord_email_recovery_password TEXT",
  "ALTER TABLE vault_entries ADD COLUMN IF NOT EXISTS telegram_phone TEXT",
  "ALTER TABLE vault_entries ADD COLUMN IF NOT EXISTS telegram_2fa TEXT",
  "ALTER TABLE vault_entries ADD COLUMN IF NOT EXISTS telegram_linked_email TEXT",
  "ALTER TABLE vault_entries ADD COLUMN IF NOT EXISTS telegram_linked_email_password TEXT",
  "ALTER TABLE wallets ADD COLUMN IF NOT EXISTS encrypted_phrase TEXT",
];

async function waitForDbThenMigrate(): Promise<void> {
  logBus.system("DB probe started — waiting for connection...");
  let attempts = 0;
  while (true) {
    try {
      await db.execute(sql`SELECT 1`);
      break;
    } catch (err: any) {
      attempts++;
      if (attempts % 5 === 0) {
        logBus.warn(`DB still offline after ${attempts} probes: ${err?.message ?? err}`);
      }
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  logBus.system("✅ Database connected — running startup migrations");
  for (const q of MIGRATIONS) {
    try {
      await db.execute(sql.raw(q));
      logBus.system(`Migration OK: ${q.replace("ALTER TABLE ", "").slice(0, 60)}`);
    } catch (err: any) {
      logger.warn({ err, q }, "Migration statement warning (column may already exist)");
      logBus.warn(`Migration skip (exists): ${q.slice(0, 60)}`);
    }
  }
  logBus.system("✅ All startup migrations complete");
  logger.info("Startup migrations complete");
}

setTimeout(waitForDbThenMigrate, 2000);

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    logBus.error(`Server failed to start: ${(err as Error).message}`);
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  logBus.system(`🚀 AYZEN API Server started on port ${port}`);
  getFirebaseAdmin();
  initTelegramBot();
});
