CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'user' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"avatar_url" text,
	"ayzen_email" text,
	"two_fa_enabled" boolean DEFAULT false NOT NULL,
	"two_fa_secret" text,
	"email_verified" boolean DEFAULT false NOT NULL,
	"total_roi" real DEFAULT 0 NOT NULL,
	"wallet_count" integer DEFAULT 0 NOT NULL,
	"streak" integer DEFAULT 0 NOT NULL,
	"longest_streak" integer DEFAULT 0 NOT NULL,
	"bio" text,
	"twitter_handle" text,
	"discord_handle" text,
	"website_url" text,
	"telegram_handle" text,
	"telegram_chat_id" text,
	"telegram_username" text,
	"referral_code" text,
	"referred_by" integer,
	"last_active_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_referral_code_unique" UNIQUE("referral_code")
);
--> statement-breakpoint
CREATE TABLE "project_enrollments" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"project_id" integer NOT NULL,
	"vault_entry_id" integer NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"enrolled_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"xp_name" text,
	"xp_price" real DEFAULT 0.01 NOT NULL,
	"twitter_handle" text,
	"discord_url" text,
	"website_url" text,
	"tutorial_link" text,
	"experience_level" text DEFAULT 'Beginner' NOT NULL,
	"tier" text DEFAULT '1' NOT NULL,
	"funding_amount" real DEFAULT 0 NOT NULL,
	"reward_estimate" real DEFAULT 0 NOT NULL,
	"thumbnail_url" text,
	"total_roi_distributed" real DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"project_id" integer NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_submissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"task_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"proof_url" text,
	"notes" text,
	"rejection_reason" text,
	"submitted_at" timestamp DEFAULT now() NOT NULL,
	"reviewed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer,
	"name" text NOT NULL,
	"description" text,
	"reward_amount" real,
	"xp_amount" real DEFAULT 0 NOT NULL,
	"verification_type" text DEFAULT 'manual' NOT NULL,
	"task_type" text DEFAULT 'One-time' NOT NULL,
	"completion_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vault_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"entity_serial" text,
	"category" text NOT NULL,
	"project_name" text NOT NULL,
	"email" text,
	"email_password" text,
	"email_recovery" text,
	"email_recovery_password" text,
	"twitter_username" text,
	"twitter_password" text,
	"twitter_email" text,
	"twitter_email_password" text,
	"twitter_followers" text,
	"twitter_2fa" text,
	"twitter_email_recovery" text,
	"twitter_email_recovery_password" text,
	"discord_username" text,
	"discord_password" text,
	"discord_email" text,
	"discord_email_password" text,
	"discord_2fa" text,
	"discord_email_recovery" text,
	"discord_email_recovery_password" text,
	"telegram_username" text,
	"telegram_password" text,
	"telegram_phone" text,
	"telegram_2fa" text,
	"telegram_linked_email" text,
	"telegram_linked_email_password" text,
	"wallet_addresses" text,
	"backup_codes" text,
	"notes" text,
	"other_accounts" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "broadcasts" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"channel" text DEFAULT 'email' NOT NULL,
	"recipient_filter" text DEFAULT 'all' NOT NULL,
	"recipient_count" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'sent' NOT NULL,
	"scheduled_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "error_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"level" text DEFAULT 'ERROR' NOT NULL,
	"message" text NOT NULL,
	"endpoint" text,
	"stack" text,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plugins" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"config" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "plugins_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"platform_name" text DEFAULT 'AYZEN' NOT NULL,
	"logo_url" text,
	"primary_color" text DEFAULT '#06b6d4' NOT NULL,
	"smtp_host" text,
	"smtp_port" integer,
	"smtp_user" text,
	"smtp_password" text,
	"smtp_from" text,
	"telegram_bot_username" text,
	"telegram_webhook_url" text,
	"two_fa_issuer_name" text DEFAULT 'AYZEN' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"label" text NOT NULL,
	"email_address" text NOT NULL,
	"protocol" text DEFAULT 'IMAP' NOT NULL,
	"imap_host" text,
	"imap_port" integer DEFAULT 993,
	"smtp_host" text,
	"smtp_port" integer DEFAULT 587,
	"username" text,
	"password" text,
	"use_ssl" boolean DEFAULT true NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"notes" text,
	"tags" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticket_id" integer NOT NULL,
	"author_id" integer NOT NULL,
	"author_role" text DEFAULT 'user' NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_tickets" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"title" text NOT NULL,
	"category" text DEFAULT 'general' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "referrals" (
	"id" serial PRIMARY KEY NOT NULL,
	"referrer_id" integer NOT NULL,
	"referred_id" integer NOT NULL,
	"code_used" text NOT NULL,
	"reward_amount" real DEFAULT 10 NOT NULL,
	"reward_paid" boolean DEFAULT false NOT NULL,
	"paid_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wallets" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"label" text DEFAULT 'My Wallet' NOT NULL,
	"address" text NOT NULL,
	"chain" text DEFAULT 'ETH' NOT NULL,
	"chain_id" integer,
	"balance" real DEFAULT 0 NOT NULL,
	"balance_usd" real DEFAULT 0 NOT NULL,
	"token_count" integer DEFAULT 0 NOT NULL,
	"nft_count" integer DEFAULT 0 NOT NULL,
	"tx_count" integer DEFAULT 0 NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"last_synced_at" timestamp,
	"notes" text,
	"encrypted_phrase" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"plan" text DEFAULT 'free' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"coingate_order_id" text,
	"coingate_payment_url" text,
	"expires_at" timestamp,
	"cancelled_at" timestamp,
	"is_lifetime" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "credit_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"type" text NOT NULL,
	"method" text,
	"credits" integer DEFAULT 0 NOT NULL,
	"azn_amount" real DEFAULT 0 NOT NULL,
	"amount_bdt" real,
	"amount_usdt" real,
	"reference_id" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"notes" text,
	"admin_note" text,
	"approved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credits" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"balance" integer DEFAULT 0 NOT NULL,
	"azn_balance" real DEFAULT 0 NOT NULL,
	"total_purchased" integer DEFAULT 0 NOT NULL,
	"total_spent" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "credits_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"type" text DEFAULT 'system' NOT NULL,
	"title" text NOT NULL,
	"message" text,
	"is_read" boolean DEFAULT false NOT NULL,
	"data" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referrer_id_users_id_fk" FOREIGN KEY ("referrer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referred_id_users_id_fk" FOREIGN KEY ("referred_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;