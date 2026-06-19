import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

export const settingsTable = pgTable("settings", {
  id: serial("id").primaryKey(),
  platformName: text("platform_name").notNull().default("AYZEN"),
  logoUrl: text("logo_url"),
  primaryColor: text("primary_color").notNull().default("#06b6d4"),
  smtpHost: text("smtp_host"),
  smtpPort: integer("smtp_port"),
  smtpUser: text("smtp_user"),
  telegramBotUsername: text("telegram_bot_username"),
  telegramWebhookUrl: text("telegram_webhook_url"),
  twoFaIssuerName: text("two_fa_issuer_name").notNull().default("AYZEN"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const errorLogsTable = pgTable("error_logs", {
  id: serial("id").primaryKey(),
  level: text("level").notNull().default("ERROR"),
  message: text("message").notNull(),
  endpoint: text("endpoint"),
  stack: text("stack"),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});
