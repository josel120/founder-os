import {
  boolean,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const visibility = pgEnum("visibility", [
  "PRIVATE",
  "UNLISTED",
  "PUBLIC",
]);
export const ideaStatus = pgEnum("idea_status", [
  "INBOX",
  "RESEARCHING",
  "VALIDATING",
  "CANDIDATE",
  "PLANNING",
  "CONVERTED",
  "PAUSED",
  "REJECTED",
  "ARCHIVED",
]);
export const projectLifecycle = pgEnum("project_lifecycle", [
  "PLANNING",
  "BUILDING",
  "TESTING",
  "BETA",
  "RELEASED",
  "MONETIZING",
  "PAUSED",
  "ARCHIVED",
]);
export const operationalStatus = pgEnum("operational_status", [
  "READY",
  "ACTION_REQUIRED",
  "WAITING_PLATFORM",
  "WAITING_USERS",
  "WAITING_REVIEW",
  "WAITING_PAYMENT",
  "BLOCKED",
  "NO_ACTION_REQUIRED",
]);
export const transactionType = pgEnum("transaction_type", [
  "INCOME",
  "EXPENSE",
]);

export const users = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
export const sessions = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
});
export const accounts = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", {
    withTimezone: true,
  }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
    withTimezone: true,
  }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
export const verifications = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const problems = pgTable("problem", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  visibility: visibility("visibility").notNull().default("PRIVATE"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
export const ideas = pgTable("idea", {
  id: uuid("id").defaultRandom().primaryKey(),
  problemId: uuid("problem_id").references(() => problems.id),
  title: text("title").notNull(),
  description: text("description").notNull(),
  status: ideaStatus("status").notNull().default("INBOX"),
  source: text("source").notNull().default("OWN"),
  visibility: visibility("visibility").notNull().default("PRIVATE"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
export const projects = pgTable("project", {
  id: uuid("id").defaultRandom().primaryKey(),
  originIdeaId: uuid("origin_idea_id").references(() => ideas.id),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description").notNull(),
  lifecycle: projectLifecycle("lifecycle").notNull().default("PLANNING"),
  operationalStatus: operationalStatus("operational_status")
    .notNull()
    .default("NO_ACTION_REQUIRED"),
  visibility: visibility("visibility").notNull().default("PRIVATE"),
  nextAction: text("next_action"),
  waitingReason: text("waiting_reason"),
  waitingSince: timestamp("waiting_since", { withTimezone: true }),
  reviewAt: timestamp("review_at", { withTimezone: true }),
  currentVersion: text("current_version"),
  productionVersion: text("production_version"),
  repository: text("repository"),
  website: text("website"),
  playStoreUrl: text("play_store_url"),
  appStoreUrl: text("app_store_url"),
  releasedAt: timestamp("released_at", { withTimezone: true }),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
export const decisionLogs = pgTable("decision_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  ideaId: uuid("idea_id").references(() => ideas.id),
  projectId: uuid("project_id").references(() => projects.id),
  title: text("title").notNull(),
  decision: text("decision").notNull(),
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
export const financeTransactions = pgTable("finance_transaction", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").references(() => projects.id),
  type: transactionType("type").notNull(),
  category: text("category").notNull(),
  amount: numeric("amount", { precision: 18, scale: 4 }).notNull(),
  currency: text("currency").notNull(),
  source: text("source").notNull(),
  externalId: text("external_id"),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
