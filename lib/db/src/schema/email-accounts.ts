import { pgTable, serial, text, boolean, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const emailAccountsTable = pgTable("email_accounts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  label: text("label").notNull(),
  emailAddress: text("email_address").notNull(),
  protocol: text("protocol").notNull().default("IMAP"),
  imapHost: text("imap_host"),
  imapPort: integer("imap_port").default(993),
  smtpHost: text("smtp_host"),
  smtpPort: integer("smtp_port").default(587),
  username: text("username"),
  password: text("password"),
  useSSL: boolean("use_ssl").notNull().default(true),
  isDefault: boolean("is_default").notNull().default(false),
  notes: text("notes"),
  tags: text("tags"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertEmailAccountSchema = createInsertSchema(emailAccountsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertEmailAccount = z.infer<typeof insertEmailAccountSchema>;
export type EmailAccount = typeof emailAccountsTable.$inferSelect;
