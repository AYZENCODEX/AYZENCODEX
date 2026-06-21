import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const queries = [
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
];

(async () => {
  for (const q of queries) {
    await pool.query(q);
    console.log("OK:", q.slice(0, 70));
  }
  await pool.end();
  console.log("Migration complete!");
})().catch(e => { console.error("ERROR:", e.message); process.exit(1); });
