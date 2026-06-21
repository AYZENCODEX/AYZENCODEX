import { pgTable, serial, text, integer, timestamp, real, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const walletsTable = pgTable("wallets", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  label: text("label").notNull().default("My Wallet"),
  address: text("address").notNull(),
  chain: text("chain").notNull().default("ETH"),
  chainId: integer("chain_id"),
  balance: real("balance").notNull().default(0),
  balanceUsd: real("balance_usd").notNull().default(0),
  tokenCount: integer("token_count").notNull().default(0),
  nftCount: integer("nft_count").notNull().default(0),
  txCount: integer("tx_count").notNull().default(0),
  isPrimary: boolean("is_primary").notNull().default(false),
  lastSyncedAt: timestamp("last_synced_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertWalletSchema = createInsertSchema(walletsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastSyncedAt: true,
});
export type InsertWallet = z.infer<typeof insertWalletSchema>;
export type Wallet = typeof walletsTable.$inferSelect;
