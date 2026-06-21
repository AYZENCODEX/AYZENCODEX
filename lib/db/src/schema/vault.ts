import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const vaultEntriesTable = pgTable("vault_entries", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  entitySerial: text("entity_serial"),
  category: text("category").notNull(),
  projectName: text("project_name").notNull(),

  // Email (linked email for this identity)
  email: text("email"),
  emailPassword: text("email_password"),
  emailRecovery: text("email_recovery"),
  emailRecoveryPassword: text("email_recovery_password"),

  // Twitter / X — full multilayer
  twitterUsername: text("twitter_username"),
  twitterPassword: text("twitter_password"),
  twitterEmail: text("twitter_email"),
  twitterEmailPassword: text("twitter_email_password"),
  twitterFollowers: text("twitter_followers"),
  twitter2fa: text("twitter_2fa"),
  twitterEmailRecovery: text("twitter_email_recovery"),
  twitterEmailRecoveryPassword: text("twitter_email_recovery_password"),

  // Discord — full multilayer
  discordUsername: text("discord_username"),
  discordPassword: text("discord_password"),
  discordEmail: text("discord_email"),
  discordEmailPassword: text("discord_email_password"),
  discord2fa: text("discord_2fa"),
  discordEmailRecovery: text("discord_email_recovery"),
  discordEmailRecoveryPassword: text("discord_email_recovery_password"),

  // Telegram — full multilayer
  telegramUsername: text("telegram_username"),
  telegramPassword: text("telegram_password"),
  telegramPhone: text("telegram_phone"),
  telegram2fa: text("telegram_2fa"),
  telegramLinkedEmail: text("telegram_linked_email"),
  telegramLinkedEmailPassword: text("telegram_linked_email_password"),

  walletAddresses: text("wallet_addresses"),
  backupCodes: text("backup_codes"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertVaultEntrySchema = createInsertSchema(vaultEntriesTable).omit({ id: true, createdAt: true, updatedAt: true, entitySerial: true });
export type InsertVaultEntry = z.infer<typeof insertVaultEntrySchema>;
export type VaultEntry = typeof vaultEntriesTable.$inferSelect;
