import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const vaultEntriesTable = pgTable("vault_entries", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  entitySerial: text("entity_serial"),
  category: text("category").notNull(),
  projectName: text("project_name").notNull(),
  email: text("email"),
  emailPassword: text("email_password"),
  twitterUsername: text("twitter_username"),
  twitterPassword: text("twitter_password"),
  discordUsername: text("discord_username"),
  discordPassword: text("discord_password"),
  telegramUsername: text("telegram_username"),
  telegramPassword: text("telegram_password"),
  walletAddresses: text("wallet_addresses"),
  backupCodes: text("backup_codes"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertVaultEntrySchema = createInsertSchema(vaultEntriesTable).omit({ id: true, createdAt: true, updatedAt: true, entitySerial: true });
export type InsertVaultEntry = z.infer<typeof insertVaultEntrySchema>;
export type VaultEntry = typeof vaultEntriesTable.$inferSelect;
