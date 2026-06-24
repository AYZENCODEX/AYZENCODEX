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
  "CREATE TABLE IF NOT EXISTS local_accounts (id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL, category TEXT NOT NULL DEFAULT 'Other', label TEXT, username TEXT, email TEXT, password TEXT, recovery_email TEXT, recovery_email_password TEXT, backup_codes TEXT, twofa TEXT, recovery_email_twofa TEXT, followers TEXT, account_worth REAL DEFAULT 0, buy_price REAL DEFAULT 0, account_create_date TIMESTAMP, account_buy_date TIMESTAMP, account_last_login_date TIMESTAMP, notes TEXT, created_at TIMESTAMP NOT NULL DEFAULT NOW(), updated_at TIMESTAMP NOT NULL DEFAULT NOW())",
  "CREATE TABLE IF NOT EXISTS local_account_categories (id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL, name TEXT NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT NOW())",
  "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS cost REAL DEFAULT 0",
  "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS profit REAL DEFAULT 0",
  "ALTER TABLE task_submissions ADD COLUMN IF NOT EXISTS cost REAL DEFAULT 0",
  "ALTER TABLE task_submissions ADD COLUMN IF NOT EXISTS profit REAL DEFAULT 0",
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
  "CREATE TABLE IF NOT EXISTS credits (id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL UNIQUE, balance INTEGER NOT NULL DEFAULT 0, azn_balance REAL NOT NULL DEFAULT 0, total_purchased INTEGER NOT NULL DEFAULT 0, total_spent INTEGER NOT NULL DEFAULT 0, created_at TIMESTAMP NOT NULL DEFAULT NOW(), updated_at TIMESTAMP NOT NULL DEFAULT NOW())",
  "CREATE TABLE IF NOT EXISTS credit_transactions (id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL, type TEXT NOT NULL, method TEXT, credits INTEGER NOT NULL DEFAULT 0, azn_amount REAL NOT NULL DEFAULT 0, amount_bdt REAL, amount_usdt REAL, reference_id TEXT, status TEXT NOT NULL DEFAULT 'pending', notes TEXT, admin_note TEXT, approved_at TIMESTAMP, created_at TIMESTAMP NOT NULL DEFAULT NOW(), updated_at TIMESTAMP NOT NULL DEFAULT NOW())",
  "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Social'",
  "ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS payment_method TEXT",
  "ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS sender_number TEXT",
  "ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS rejection_reason TEXT",
  // Timer columns for projects
  "ALTER TABLE projects ADD COLUMN IF NOT EXISTS deadline TIMESTAMP",
  "ALTER TABLE projects ADD COLUMN IF NOT EXISTS started_at TIMESTAMP",
  "ALTER TABLE projects ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active'",
  // Timer columns for tasks
  "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS deadline TIMESTAMP",
  "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS time_limit_minutes INTEGER",
  // User-to-user messages
  `CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    from_user_id INTEGER NOT NULL,
    to_user_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  // ROI tracking on submissions
  "ALTER TABLE task_submissions ADD COLUMN IF NOT EXISTS roi REAL DEFAULT 0",
  // Task category using A/B1/B2/C system
  "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS task_category TEXT DEFAULT 'B1'",
  // User total ROI field
  "ALTER TABLE users ADD COLUMN IF NOT EXISTS total_roi REAL DEFAULT 0",
  // XP on tasks + project XP price
  "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS xp_amount REAL DEFAULT 0",
  "ALTER TABLE tasks ALTER COLUMN project_id DROP NOT NULL",
  "ALTER TABLE projects ADD COLUMN IF NOT EXISTS xp_price REAL DEFAULT 0.01",
  // Notifications table
  `CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL DEFAULT 'system',
    title TEXT NOT NULL,
    message TEXT,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    data TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  // Rejection reason on task_submissions
  "ALTER TABLE task_submissions ADD COLUMN IF NOT EXISTS rejection_reason TEXT",
  // Project category (DeFi, NFT, GameFi, Layer2, Testnet, CEX, Social, Other)
  "ALTER TABLE projects ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Other'",
  // Entity IDs on task submissions (JSON array)
  "ALTER TABLE task_submissions ADD COLUMN IF NOT EXISTS entity_ids TEXT",
  // User activity log
  `CREATE TABLE IF NOT EXISTS user_activity (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id INTEGER,
    entity_name TEXT,
    meta TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  "CREATE INDEX IF NOT EXISTS idx_user_activity_user_id ON user_activity(user_id)",
  "CREATE INDEX IF NOT EXISTS idx_user_activity_created_at ON user_activity(created_at DESC)",
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
