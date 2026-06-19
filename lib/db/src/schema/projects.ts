import { pgTable, serial, text, real, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const projectsTable = pgTable("projects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  twitterHandle: text("twitter_handle"),
  discordUrl: text("discord_url"),
  websiteUrl: text("website_url"),
  tutorialLink: text("tutorial_link"),
  experienceLevel: text("experience_level").notNull().default("Beginner"),
  tier: text("tier").notNull().default("1"),
  fundingAmount: real("funding_amount").notNull().default(0),
  rewardEstimate: real("reward_estimate").notNull().default(0),
  thumbnailUrl: text("thumbnail_url"),
  totalRoiDistributed: real("total_roi_distributed").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const userProjectsTable = pgTable("user_projects", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  projectId: integer("project_id").notNull(),
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
});

export const projectEnrollmentsTable = pgTable("project_enrollments", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  projectId: integer("project_id").notNull(),
  vaultEntryId: integer("vault_entry_id").notNull(),
  status: text("status").notNull().default("active"),
  enrolledAt: timestamp("enrolled_at").notNull().defaultNow(),
});

export const insertProjectSchema = createInsertSchema(projectsTable).omit({ id: true, createdAt: true, totalRoiDistributed: true });
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projectsTable.$inferSelect;
export type ProjectEnrollment = typeof projectEnrollmentsTable.$inferSelect;
