import app from "./app";
import { logger } from "./lib/logger";
import { logBus } from "./lib/log-bus";
import { initTelegramBot, stopTelegramBot } from "./lib/telegram";
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
  `CREATE TABLE IF NOT EXISTS wallets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    label TEXT NOT NULL DEFAULT 'My Wallet',
    address TEXT NOT NULL,
    chain TEXT NOT NULL DEFAULT 'ETH',
    chain_id INTEGER,
    balance REAL NOT NULL DEFAULT 0,
    balance_usd REAL NOT NULL DEFAULT 0,
    token_count INTEGER NOT NULL DEFAULT 0,
    nft_count INTEGER NOT NULL DEFAULT 0,
    tx_count INTEGER NOT NULL DEFAULT 0,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    last_synced_at TIMESTAMP,
    notes TEXT,
    encrypted_phrase TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
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
  // Earn links for link-click AZN income
  `CREATE TABLE IF NOT EXISTS earn_links (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL DEFAULT 'My Link',
    target_url TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    azn_per_click REAL NOT NULL DEFAULT 0.005,
    click_count INTEGER NOT NULL DEFAULT 0,
    earned_azn REAL NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  "CREATE INDEX IF NOT EXISTS idx_earn_links_user_id ON earn_links(user_id)",
  "CREATE INDEX IF NOT EXISTS idx_earn_links_code ON earn_links(code)",
  // Task priority field
  "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal'",
  // Task submission: cost_category and profit_category
  "ALTER TABLE task_submissions ADD COLUMN IF NOT EXISTS cost_category TEXT",
  "ALTER TABLE task_submissions ADD COLUMN IF NOT EXISTS profit_category TEXT",
  // Project completion percentage (cached)
  "ALTER TABLE projects ADD COLUMN IF NOT EXISTS completion_pct REAL DEFAULT 0",
  // User display color tag
  "ALTER TABLE users ADD COLUMN IF NOT EXISTS color_tag TEXT DEFAULT '#22d3ee'",
  // Task steps guide (JSON array of {title, description})
  "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS steps TEXT",
  // Cost entries JSON array on submissions (multiple line items)
  "ALTER TABLE task_submissions ADD COLUMN IF NOT EXISTS cost_entries TEXT",
  // Project meta fields
  "ALTER TABLE projects ADD COLUMN IF NOT EXISTS duration_type TEXT DEFAULT 'long'",
  "ALTER TABLE projects ADD COLUMN IF NOT EXISTS difficulty TEXT DEFAULT 'average'",
  "ALTER TABLE projects ADD COLUMN IF NOT EXISTS cost_type TEXT DEFAULT 'free'",
  "ALTER TABLE projects ADD COLUMN IF NOT EXISTS tutorial_notes TEXT",
  `CREATE TABLE IF NOT EXISTS local_account_points (
    id SERIAL PRIMARY KEY,
    account_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    amount REAL NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  "CREATE INDEX IF NOT EXISTS idx_local_account_points_account_id ON local_account_points(account_id)",
  "CREATE INDEX IF NOT EXISTS idx_local_account_points_user_id ON local_account_points(user_id)",
  // Task external link for in-app link completion flow
  "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS task_link TEXT",
  // Track link visits per user/task
  `CREATE TABLE IF NOT EXISTS task_link_visits (
    id SERIAL PRIMARY KEY,
    task_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    visited_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(task_id, user_id)
  )`,
  // ── Phase 5: request_metrics — real telemetry ────────────────────────────
  `CREATE TABLE IF NOT EXISTS request_metrics (
    id SERIAL PRIMARY KEY,
    route TEXT NOT NULL,
    method TEXT NOT NULL DEFAULT 'GET',
    status_code INTEGER NOT NULL DEFAULT 200,
    duration_ms REAL NOT NULL DEFAULT 0,
    user_id INTEGER,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  "CREATE INDEX IF NOT EXISTS idx_request_metrics_route ON request_metrics(route)",
  "CREATE INDEX IF NOT EXISTS idx_request_metrics_created_at ON request_metrics(created_at DESC)",
  // ── Phase 0: auth error_logs table (already defined in Drizzle schema) ───
  "CREATE TABLE IF NOT EXISTS error_logs (id SERIAL PRIMARY KEY, level TEXT NOT NULL DEFAULT 'ERROR', message TEXT NOT NULL, endpoint TEXT, stack TEXT, timestamp TIMESTAMP NOT NULL DEFAULT NOW())",
  "CREATE INDEX IF NOT EXISTS idx_error_logs_timestamp ON error_logs(timestamp DESC)",
  // ── Phase 1: categories + category_templates ─────────────────────────────
  `CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'task',
    parent_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
    is_custom BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS category_templates (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'task',
    sub_categories JSONB NOT NULL DEFAULT '[]',
    created_by INTEGER,
    is_global BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  // ── Phase 2: data integrity — entity_project_roi + health_rules ──────────
  `CREATE TABLE IF NOT EXISTS entity_project_roi (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    vault_entry_id INTEGER NOT NULL,
    project_id INTEGER NOT NULL,
    total_cost REAL NOT NULL DEFAULT 0,
    total_profit REAL NOT NULL DEFAULT 0,
    roi REAL GENERATED ALWAYS AS (total_profit - total_cost) STORED,
    recorded_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(vault_entry_id, project_id)
  )`,
  `CREATE TABLE IF NOT EXISTS health_rules (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    rule_type TEXT NOT NULL DEFAULT 'wallet',
    condition JSONB NOT NULL DEFAULT '{}',
    severity TEXT NOT NULL DEFAULT 'warning',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by INTEGER,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  // ── Phase 3: vault hub additions ─────────────────────────────────────────
  "ALTER TABLE vault_entries ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active'",
  "ALTER TABLE vault_entries ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMP",
  "ALTER TABLE vault_entries ADD COLUMN IF NOT EXISTS encrypted_seed_phrase TEXT",
  `CREATE TABLE IF NOT EXISTS other_two_factor_codes (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    vault_entry_id INTEGER,
    service_name TEXT NOT NULL,
    totp_secret TEXT,
    backup_codes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  // ── Phase 6: teams ────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS teams (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    owner_id INTEGER NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS team_members (
    id SERIAL PRIMARY KEY,
    team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL,
    role TEXT NOT NULL DEFAULT 'member',
    joined_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(team_id, user_id)
  )`,
  `CREATE TABLE IF NOT EXISTS team_messages (
    id SERIAL PRIMARY KEY,
    team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  "CREATE INDEX IF NOT EXISTS idx_team_messages_team_id ON team_messages(team_id)",
  "ALTER TABLE vault_entries ADD COLUMN IF NOT EXISTS team_id INTEGER",
  "ALTER TABLE projects ADD COLUMN IF NOT EXISTS team_id INTEGER",
  // ── Phase 7: content / AI generation ─────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS project_memory (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL,
    content_type TEXT NOT NULL DEFAULT 'context',
    content TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  "CREATE INDEX IF NOT EXISTS idx_project_memory_project_id ON project_memory(project_id)",
  `CREATE TABLE IF NOT EXISTS generated_content (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL,
    type TEXT NOT NULL DEFAULT 'post',
    prompt_used TEXT,
    output TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  "CREATE INDEX IF NOT EXISTS idx_generated_content_project_id ON generated_content(project_id)",
  // ── Phase 8: plan limits ──────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS plan_limits (
    id SERIAL PRIMARY KEY,
    plan TEXT NOT NULL UNIQUE,
    max_projects INTEGER NOT NULL DEFAULT 5,
    max_entities INTEGER NOT NULL DEFAULT 10,
    max_content_gen_per_day INTEGER NOT NULL DEFAULT 5,
    max_team_size INTEGER NOT NULL DEFAULT 3,
    max_vault_entries INTEGER NOT NULL DEFAULT 20,
    can_use_ai BOOLEAN NOT NULL DEFAULT FALSE,
    can_use_teams BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  "INSERT INTO plan_limits (plan, max_projects, max_entities, max_content_gen_per_day, max_team_size, max_vault_entries, can_use_ai, can_use_teams) VALUES ('free', 3, 5, 2, 2, 10, false, false) ON CONFLICT (plan) DO NOTHING",
  "INSERT INTO plan_limits (plan, max_projects, max_entities, max_content_gen_per_day, max_team_size, max_vault_entries, can_use_ai, can_use_teams) VALUES ('starter', 10, 25, 15, 5, 50, true, false) ON CONFLICT (plan) DO NOTHING",
  "INSERT INTO plan_limits (plan, max_projects, max_entities, max_content_gen_per_day, max_team_size, max_vault_entries, can_use_ai, can_use_teams) VALUES ('pro', 50, 100, 100, 20, 200, true, true) ON CONFLICT (plan) DO NOTHING",
  "INSERT INTO plan_limits (plan, max_projects, max_entities, max_content_gen_per_day, max_team_size, max_vault_entries, can_use_ai, can_use_teams) VALUES ('unlimited', 9999, 9999, 9999, 9999, 9999, true, true) ON CONFLICT (plan) DO NOTHING",
  // Extra project meta fields needed by teams / content modules
  "ALTER TABLE projects ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'airdrop'",
  "ALTER TABLE projects ADD COLUMN IF NOT EXISTS account_type_filter TEXT",
  // Networks table (DB-driven, replaces hardcoded NETWORKS array in tools.ts)
  `CREATE TABLE IF NOT EXISTS networks (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    network_id TEXT,
    chain TEXT NOT NULL,
    symbol TEXT,
    coingecko_id TEXT,
    rpc_url TEXT,
    gas_oracle_url TEXT,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  // Seed default networks
  "INSERT INTO networks (name, network_id, chain, symbol, coingecko_id, rpc_url, enabled) VALUES ('Ethereum', '1', 'ETH', 'ETH', 'ethereum', 'https://eth.llamarpc.com', true) ON CONFLICT (name) DO NOTHING",
  "INSERT INTO networks (name, network_id, chain, symbol, coingecko_id, rpc_url, enabled) VALUES ('BNB Chain', '56', 'BSC', 'BNB', 'binancecoin', 'https://bsc-dataseed.binance.org', true) ON CONFLICT (name) DO NOTHING",
  "INSERT INTO networks (name, network_id, chain, symbol, coingecko_id, rpc_url, enabled) VALUES ('Polygon', '137', 'MATIC', 'MATIC', 'matic-network', 'https://polygon-rpc.com', true) ON CONFLICT (name) DO NOTHING",
  "INSERT INTO networks (name, network_id, chain, symbol, coingecko_id, rpc_url, enabled) VALUES ('Arbitrum One', '42161', 'ARB', 'ETH', 'ethereum', 'https://arb1.arbitrum.io/rpc', true) ON CONFLICT (name) DO NOTHING",
  "INSERT INTO networks (name, network_id, chain, symbol, coingecko_id, rpc_url, enabled) VALUES ('Optimism', '10', 'OP', 'ETH', 'optimism', 'https://mainnet.optimism.io', true) ON CONFLICT (name) DO NOTHING",
  "INSERT INTO networks (name, network_id, chain, symbol, coingecko_id, rpc_url, enabled) VALUES ('Avalanche', '43114', 'AVAX', 'AVAX', 'avalanche-2', 'https://api.avax.network/ext/bc/C/rpc', true) ON CONFLICT (name) DO NOTHING",
  "INSERT INTO networks (name, network_id, chain, symbol, coingecko_id, rpc_url, enabled) VALUES ('Base', '8453', 'BASE', 'ETH', 'ethereum', 'https://mainnet.base.org', true) ON CONFLICT (name) DO NOTHING",
  "INSERT INTO networks (name, network_id, chain, symbol, coingecko_id, rpc_url, enabled) VALUES ('zkSync Era', '324', 'ZK', 'ETH', 'ethereum', 'https://mainnet.era.zksync.io', true) ON CONFLICT (name) DO NOTHING",
  "INSERT INTO networks (name, network_id, chain, symbol, coingecko_id, rpc_url, enabled) VALUES ('Scroll', '534352', 'SCROLL', 'ETH', 'ethereum', 'https://rpc.scroll.io', true) ON CONFLICT (name) DO NOTHING",
  "INSERT INTO networks (name, network_id, chain, symbol, coingecko_id, rpc_url, enabled) VALUES ('Linea', '59144', 'LINEA', 'ETH', 'ethereum', 'https://rpc.linea.build', true) ON CONFLICT (name) DO NOTHING",
  // Local account snapshots (progress tracking over time)
  `CREATE TABLE IF NOT EXISTS local_account_snapshots (
    id SERIAL PRIMARY KEY,
    local_account_id INTEGER NOT NULL,
    metric_value REAL NOT NULL DEFAULT 0,
    metric_type TEXT NOT NULL DEFAULT 'followers',
    captured_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  // request_metrics already created above — skip duplicate definition
  // Seed default health rules — use correct column names matching schema
  "CREATE UNIQUE INDEX IF NOT EXISTS health_rules_name_idx ON health_rules(name)",
  "INSERT INTO health_rules (name, description, rule_type, condition, severity, is_active) VALUES ('Missing 2FA', 'Entity does not have 2FA configured', 'entity', '{\"check\":\"missing_2fa\"}', 'warning', true) ON CONFLICT (name) DO NOTHING",
  "INSERT INTO health_rules (name, description, rule_type, condition, severity, is_active) VALUES ('Missing Wallet', 'Entity has no wallet address linked', 'entity', '{\"check\":\"missing_wallet\"}', 'warning', true) ON CONFLICT (name) DO NOTHING",
  "INSERT INTO health_rules (name, description, rule_type, condition, severity, is_active) VALUES ('Inactive 30 Days', 'Entity has not been active for 30+ days', 'entity', '{\"check\":\"inactive_days\",\"threshold\":30}', 'critical', true) ON CONFLICT (name) DO NOTHING",
  "INSERT INTO health_rules (name, description, rule_type, condition, severity, is_active) VALUES ('Missing Email', 'Entity has no email configured', 'entity', '{\"check\":\"missing_email\"}', 'warning', true) ON CONFLICT (name) DO NOTHING",
   // ── Phase 9: built-in wallet tokens ──────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS builtin_wallet_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    symbol TEXT NOT NULL DEFAULT 'USDT',
    name TEXT NOT NULL DEFAULT 'Tether USD',
    amount REAL NOT NULL DEFAULT 0,
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  "CREATE UNIQUE INDEX IF NOT EXISTS builtin_wallet_tokens_user_symbol ON builtin_wallet_tokens(user_id, symbol)",
  // ── Phase 7: referrals ──────────────────────────────────────────────────
  "ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code TEXT",
  "ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by INTEGER",
  "CREATE UNIQUE INDEX IF NOT EXISTS users_referral_code_idx ON users(referral_code) WHERE referral_code IS NOT NULL",
  `CREATE TABLE IF NOT EXISTS referrals (
    id SERIAL PRIMARY KEY,
    referrer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    referred_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code_used TEXT NOT NULL,
    reward_amount REAL NOT NULL DEFAULT 10,
    reward_paid BOOLEAN NOT NULL DEFAULT FALSE,
    paid_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  "ALTER TABLE teams ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'",
  "ALTER TABLE teams ADD COLUMN IF NOT EXISTS description TEXT",
  "ALTER TABLE team_members ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'",
  `CREATE TABLE IF NOT EXISTS team_missions (
    id SERIAL PRIMARY KEY,
    team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    target_value INTEGER DEFAULT 100,
    current_value INTEGER DEFAULT 0,
    reward_amount NUMERIC(12,2) DEFAULT 0,
    deadline TIMESTAMP,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS reward_links (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    url TEXT NOT NULL,
    reward_amount NUMERIC(12,2) DEFAULT 0,
    is_published BOOLEAN NOT NULL DEFAULT false,
    view_duration_seconds INTEGER DEFAULT 10,
    max_completions INTEGER DEFAULT 0,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS link_completions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    link_id INTEGER NOT NULL REFERENCES reward_links(id) ON DELETE CASCADE,
    completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, link_id)
  )`,
  `CREATE TABLE IF NOT EXISTS ad_tasks (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    ad_url TEXT NOT NULL,
    ad_image_url TEXT,
    reward_amount NUMERIC(12,2) DEFAULT 0,
    view_duration_seconds INTEGER DEFAULT 15,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS ad_completions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ad_task_id INTEGER NOT NULL REFERENCES ad_tasks(id) ON DELETE CASCADE,
    completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, ad_task_id)
  )`,
  // ── Phase 10: AYZEN Wallet — token balances + internal transfers ──────────
  "ALTER TABLE credits ADD COLUMN IF NOT EXISTS usdt_balance REAL NOT NULL DEFAULT 0",
  "ALTER TABLE credits ADD COLUMN IF NOT EXISTS bdt_balance REAL NOT NULL DEFAULT 0",
  "ALTER TABLE credits ADD COLUMN IF NOT EXISTS xp_balance REAL NOT NULL DEFAULT 0",
  `CREATE TABLE IF NOT EXISTS wallet_transfers (
    id SERIAL PRIMARY KEY,
    from_user_id INTEGER NOT NULL REFERENCES users(id),
    to_user_id INTEGER NOT NULL REFERENCES users(id),
    currency TEXT NOT NULL DEFAULT 'AZN',
    amount REAL NOT NULL,
    note TEXT,
    status TEXT NOT NULL DEFAULT 'completed',
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  "CREATE INDEX IF NOT EXISTS idx_wallet_transfers_from ON wallet_transfers(from_user_id)",
  "CREATE INDEX IF NOT EXISTS idx_wallet_transfers_to ON wallet_transfers(to_user_id)",
  // ── Phase 11: AYZEN built-in Mail ─────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS ayzen_mail (
    id SERIAL PRIMARY KEY,
    from_user_id INTEGER NOT NULL REFERENCES users(id),
    to_user_id INTEGER NOT NULL REFERENCES users(id),
    subject TEXT NOT NULL DEFAULT '(no subject)',
    body TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_by_sender BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_by_receiver BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  "CREATE INDEX IF NOT EXISTS idx_ayzen_mail_to ON ayzen_mail(to_user_id)",
  "CREATE INDEX IF NOT EXISTS idx_ayzen_mail_from ON ayzen_mail(from_user_id)",
  // ── Phase 12: Project types ───────────────────────────────────────────────
  "ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_type TEXT DEFAULT 'protocol'",
  "ALTER TABLE projects ADD COLUMN IF NOT EXISTS exchange_sub_type TEXT DEFAULT 'candydrop'",
  "ALTER TABLE projects ADD COLUMN IF NOT EXISTS account_category TEXT DEFAULT 'both'",
  "ALTER TABLE projects ADD COLUMN IF NOT EXISTS exchange_custom_categories TEXT",
  // ── Phase 13: Email accounts (per-email IMAP/SMTP vault) ──────────────────
  `CREATE TABLE IF NOT EXISTS email_accounts (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER NOT NULL,
    label       TEXT NOT NULL,
    email_address TEXT NOT NULL,
    protocol    TEXT NOT NULL DEFAULT 'IMAP',
    imap_host   TEXT,
    imap_port   INTEGER DEFAULT 993,
    smtp_host   TEXT,
    smtp_port   INTEGER DEFAULT 587,
    username    TEXT,
    password    TEXT,
    use_ssl     BOOLEAN NOT NULL DEFAULT TRUE,
    is_default  BOOLEAN NOT NULL DEFAULT FALSE,
    notes       TEXT,
    tags        TEXT,
    created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  "CREATE INDEX IF NOT EXISTS idx_email_accounts_user ON email_accounts(user_id)",
  // ── Phase 14: Task admin fields ───────────────────────────────────────────
  "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS difficulty_level TEXT DEFAULT 'medium'",
  "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS estimated_cost REAL DEFAULT 0",
  "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS estimated_profit REAL DEFAULT 0",
  // ── Phase 15: NFT Subscription system ─────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS nft_subscriptions (
    id SERIAL PRIMARY KEY,
    token_id TEXT NOT NULL UNIQUE,
    owner_id INTEGER NOT NULL REFERENCES users(id),
    original_owner_id INTEGER NOT NULL REFERENCES users(id),
    plan TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}',
    expires_at TIMESTAMP NOT NULL,
    is_listed BOOLEAN NOT NULL DEFAULT FALSE,
    list_price REAL,
    transfer_count INTEGER NOT NULL DEFAULT 0,
    is_burned BOOLEAN NOT NULL DEFAULT FALSE,
    minted_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  "CREATE INDEX IF NOT EXISTS idx_nft_subscriptions_owner ON nft_subscriptions(owner_id)",
  "CREATE INDEX IF NOT EXISTS idx_nft_subscriptions_listed ON nft_subscriptions(is_listed) WHERE is_listed = TRUE",
  // ── Phase 16: P2P Marketplace ─────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS marketplace_listings (
    id SERIAL PRIMARY KEY,
    seller_id INTEGER NOT NULL REFERENCES users(id),
    listing_type TEXT NOT NULL DEFAULT 'entity',
    item_id INTEGER,
    title TEXT NOT NULL,
    description TEXT,
    price_azn REAL NOT NULL DEFAULT 0,
    metadata JSONB NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'active',
    buyer_id INTEGER REFERENCES users(id),
    sold_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  "CREATE INDEX IF NOT EXISTS idx_marketplace_listings_status ON marketplace_listings(status)",
  "CREATE INDEX IF NOT EXISTS idx_marketplace_listings_seller ON marketplace_listings(seller_id)",
  `CREATE TABLE IF NOT EXISTS marketplace_orders (
    id SERIAL PRIMARY KEY,
    listing_id INTEGER NOT NULL REFERENCES marketplace_listings(id),
    buyer_id INTEGER NOT NULL REFERENCES users(id),
    seller_id INTEGER NOT NULL REFERENCES users(id),
    price_azn REAL NOT NULL,
    fee_pct REAL NOT NULL DEFAULT 5,
    fee_azn REAL,
    seller_receives REAL,
    status TEXT NOT NULL DEFAULT 'pending',
    message TEXT,
    admin_note TEXT,
    resolved_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  "CREATE INDEX IF NOT EXISTS idx_marketplace_orders_status ON marketplace_orders(status)",
  "CREATE INDEX IF NOT EXISTS idx_marketplace_orders_buyer ON marketplace_orders(buyer_id)",
  "CREATE INDEX IF NOT EXISTS idx_marketplace_orders_seller ON marketplace_orders(seller_id)",
  `CREATE TABLE IF NOT EXISTS marketplace_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    fee_pct REAL NOT NULL DEFAULT 5,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  // ── Phase 17: Security / 2FA codes ────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS user_backup_codes (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    code TEXT NOT NULL,
    is_used BOOLEAN NOT NULL DEFAULT FALSE,
    used_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  "CREATE INDEX IF NOT EXISTS idx_backup_codes_user ON user_backup_codes(user_id)",
  `CREATE TABLE IF NOT EXISTS user_magic_codes (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    code TEXT NOT NULL UNIQUE,
    label TEXT,
    is_used BOOLEAN NOT NULL DEFAULT FALSE,
    used_at TIMESTAMP,
    expires_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  "CREATE INDEX IF NOT EXISTS idx_magic_codes_code ON user_magic_codes(code)",
  "ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_secret TEXT",
  "ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN NOT NULL DEFAULT FALSE",
  "ALTER TABLE credit_transactions ADD COLUMN IF NOT EXISTS azn_amount REAL DEFAULT 0",
  // ── Phase 18: Daily Check-in ──────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS user_checkins (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    checked_in_date DATE NOT NULL,
    streak_day INTEGER NOT NULL DEFAULT 1,
    xp_earned INTEGER NOT NULL DEFAULT 10,
    azn_earned REAL NOT NULL DEFAULT 0.1,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, checked_in_date)
  )`,
  "CREATE INDEX IF NOT EXISTS idx_checkins_user ON user_checkins(user_id, checked_in_date DESC)",
  // ── Phase 18: Project Watchlist ───────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS user_watchlist (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, project_id)
  )`,
  "CREATE INDEX IF NOT EXISTS idx_watchlist_user ON user_watchlist(user_id)",
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
  initTelegramBot();

  // Graceful shutdown — stop Telegram polling before exit so the next start has no 409
  const shutdown = () => {
    stopTelegramBot().finally(() => process.exit(0));
  };
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
});
