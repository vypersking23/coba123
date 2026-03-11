import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, decimal, timestamp, pgEnum, serial } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const keyStatusEnum = pgEnum("key_status", ["unused", "active", "expired", "blacklisted"]);
export const showcaseTypeEnum = pgEnum("showcase_type", ["free", "premium"]);

export const admins = pgTable("admins", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const keys = pgTable("keys", {
  id: serial("id").primaryKey(),
  keyCode: varchar("key_code", { length: 19 }).notNull().unique(),
  durationMonths: integer("duration_months").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  status: keyStatusEnum("status").default("unused").notNull(),
  hwid: text("hwid"),
  hwidResetAt: timestamp("hwid_reset_at"),
  robloxUsername: text("roblox_username"),
  executionCount: integer("execution_count").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  activatedAt: timestamp("activated_at"),
  expiresAt: timestamp("expires_at"),
  notes: text("notes"),
});

export const logs = pgTable("logs", {
  id: serial("id").primaryKey(),
  action: text("action").notNull(),
  keyId: integer("key_id").references(() => keys.id),
  details: text("details"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const showcase = pgTable("showcase", {
  id: serial("id").primaryKey(),
  scriptName: text("script_name").notNull(),
  gameName: text("game_name").notNull(),
  type: showcaseTypeEnum("type").notNull(),
  youtubeUrl: text("youtube_url"),
  feature1Icon: text("feature_1_icon"),
  feature1Text: text("feature_1_text").notNull(),
  feature2Icon: text("feature_2_icon"),
  feature2Text: text("feature_2_text").notNull(),
  feature3Icon: text("feature_3_icon"),
  feature3Text: text("feature_3_text").notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  buttonLabel: text("button_label"),
  buttonUrl: text("button_url"),
  likeCount: integer("like_count").default(0).notNull(),
  viewCount: integer("view_count").default(0).notNull(),
  tipCount: integer("tip_count").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const packages = pgTable("packages", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  durationDays: integer("duration_days").notNull(),
  price: decimal("price", { precision: 12, scale: 2 }).notNull(),
  feature1: text("feature_1"),
  feature2: text("feature_2"),
  feature3: text("feature_3"),
  feature4: text("feature_4"),
  buyLink: text("buy_link").notNull(),
  imageUrl: text("image_url"),
  isPopular: integer("is_popular").default(0).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const teams = pgTable("teams", {
  id: serial("id").primaryKey(),
  fullName: text("full_name").notNull(),
  role: text("role").notNull(),
  photoUrl: text("photo_url").notNull(),
  accent: text("accent").default("primary").notNull(),
  description: text("description"),
  instagram: text("instagram"),
  linkedin: text("linkedin"),
  github: text("github"),
  twitter: text("twitter"),
  skill1: text("skill_1"),
  skill2: text("skill_2"),
  skill3: text("skill_3"),
  skill4: text("skill_4"),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const keysRelations = relations(keys, ({ many }) => ({
  logs: many(logs),
}));

export const logsRelations = relations(logs, ({ one }) => ({
  key: one(keys, {
    fields: [logs.keyId],
    references: [keys.id],
  }),
}));

export const insertAdminSchema = createInsertSchema(admins).omit({
  id: true,
  createdAt: true,
});

export const insertKeySchema = createInsertSchema(keys).omit({
  id: true,
  keyCode: true,
  status: true,
  hwid: true,
  robloxUsername: true,
  executionCount: true,
  createdAt: true,
  activatedAt: true,
  expiresAt: true,
});

export const insertLogSchema = createInsertSchema(logs).omit({
  id: true,
  timestamp: true,
});

export const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export const validateKeySchema = z.object({
  key: z.string().min(1, "Key is required"),
  hwid: z.string().min(1, "HWID is required"),
  robloxUsername: z.string().optional(),
});

export const generateKeysSchema = z.object({
  durationMonths: z.number().min(1).max(12),
  price: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid price format"),
  quantity: z.number().min(1).max(100),
  notes: z.string().optional(),
});

export const scriptExecuteSchema = z.object({
  key: z.string().min(1, "Key is required"),
  hwid: z.string().min(1, "HWID is required"),
  robloxUsername: z.string().optional(),
});

export const insertShowcaseSchema = createInsertSchema(showcase).omit({
  id: true,
  createdAt: true,
});

export const insertPackageSchema = createInsertSchema(packages).omit({
  id: true,
  createdAt: true,
});

export const insertTeamSchema = createInsertSchema(teams).omit({
  id: true,
  createdAt: true,
});

export type Admin = typeof admins.$inferSelect;
export type InsertAdmin = z.infer<typeof insertAdminSchema>;
export type Key = typeof keys.$inferSelect;
export type InsertKey = z.infer<typeof insertKeySchema>;
export type Log = typeof logs.$inferSelect;
export type InsertLog = z.infer<typeof insertLogSchema>;
export type Showcase = typeof showcase.$inferSelect;
export type InsertShowcase = z.infer<typeof insertShowcaseSchema>;
export type Package = typeof packages.$inferSelect;
export type InsertPackage = z.infer<typeof insertPackageSchema>;
export type Team = typeof teams.$inferSelect;
export type InsertTeam = z.infer<typeof insertTeamSchema>;
