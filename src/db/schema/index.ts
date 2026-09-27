import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  index,
  integer,
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

export const evidenceKind = pgEnum("evidence_kind", [
  "NOTE",
  "INTERVIEW",
  "MARKET",
  "COMPETITOR",
  "SOURCE",
]);
export const evidenceSignal = pgEnum("evidence_signal", [
  "SUPPORTS",
  "CONTRADICTS",
  "NEUTRAL",
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
// Better Auth "rateLimit" model (rateLimit.storage = "database"): one row per `ip|path` key, lastRequest in epoch ms.
export const rateLimits = pgTable("rate_limit", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});

export const problems = pgTable("problem", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerId: text("owner_id").references(() => users.id, { onDelete: "restrict" }),
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
  ownerId: text("owner_id").references(() => users.id, { onDelete: "restrict" }),
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
  ownerId: text("owner_id").references(() => users.id, { onDelete: "restrict" }),
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
  ownerId: text("owner_id").references(() => users.id, { onDelete: "restrict" }),
  ideaId: uuid("idea_id").references(() => ideas.id),
  projectId: uuid("project_id").references(() => projects.id),
  title: text("title").notNull(),
  decision: text("decision").notNull(),
  reason: text("reason").notNull(),
  visibility: visibility("visibility").notNull().default("PRIVATE"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
export const financeTransactions = pgTable("finance_transaction", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerId: text("owner_id").references(() => users.id, { onDelete: "restrict" }),
  projectId: uuid("project_id").references(() => projects.id),
  type: transactionType("type").notNull(),
  category: text("category").notNull(),
  amount: numeric("amount", { precision: 18, scale: 4 }).notNull(),
  currency: text("currency").notNull(),
  source: text("source").notNull(),
  externalId: text("external_id"),
  visibility: visibility("visibility").notNull().default("PRIVATE"),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
export const evidence = pgTable(
  "evidence",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    // New table (ADR-012): no historical rows, so ownership is mandatory.
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    problemId: uuid("problem_id").references(() => problems.id, {
      onDelete: "restrict",
    }),
    ideaId: uuid("idea_id").references(() => ideas.id, { onDelete: "restrict" }),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    // No defaults (T-040): an insert that omits kind or signal must fail, not record NOTE/NEUTRAL silently.
    kind: evidenceKind("kind").notNull(),
    signal: evidenceSignal("signal").notNull(),
    sourceUrl: text("source_url"),
    visibility: visibility("visibility").notNull().default("PRIVATE"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    check(
      "evidence_exactly_one_parent",
      sql`num_nonnulls(${table.problemId}, ${table.ideaId}) = 1`,
    ),
    index("evidence_owner_id_idx").on(table.ownerId),
    index("evidence_problem_id_idx").on(table.problemId),
    index("evidence_idea_id_idx").on(table.ideaId),
  ],
);
// ADR-018: a published project. The project row stays PRIVATE; this record holds the public choice and the
// owner-written summary. Unpublishing deletes the row. PRIVATE is not a valid value here.
export const projectPublications = pgTable(
  "project_publication",
  {
    projectId: uuid("project_id")
      .primaryKey()
      .references(() => projects.id, { onDelete: "cascade" }),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    visibility: visibility("visibility").notNull(),
    summary: text("summary").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    check("project_publication_not_private", sql`${table.visibility} <> 'PRIVATE'`),
    check("project_publication_summary_length", sql`char_length(btrim(${table.summary})) BETWEEN 1 AND 500`),
    index("project_publication_list_idx").on(table.visibility, table.publishedAt),
    index("project_publication_owner_id_idx").on(table.ownerId),
  ],
);
// ADR-019: a private, read-only snapshot of a project's GitHub repository. Counts, dates and the release tag only;
// never code, commit messages, issue titles or bodies. The error column holds a code, never a response body.
// No visibility column on purpose: GitHub data is always PRIVATE and no publish path reads this table.
export const projectGithub = pgTable(
  "project_github",
  {
    projectId: uuid("project_id")
      .primaryKey()
      .references(() => projects.id, { onDelete: "cascade" }),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    repoFullName: text("repo_full_name").notNull(),
    defaultBranch: text("default_branch"),
    lastPushAt: timestamp("last_push_at", { withTimezone: true }),
    openIssues: integer("open_issues"),
    openPullRequests: integer("open_pull_requests"),
    latestReleaseTag: text("latest_release_tag"),
    latestReleaseAt: timestamp("latest_release_at", { withTimezone: true }),
    syncedAt: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
    syncError: text("sync_error"),
  },
  (table) => [
    check("project_github_repo_format", sql`${table.repoFullName} ~ '^[A-Za-z0-9-]{1,39}/[A-Za-z0-9._-]{1,100}$'`),
    check("project_github_counts", sql`coalesce(${table.openIssues}, 0) >= 0 AND coalesce(${table.openPullRequests}, 0) >= 0`),
    check("project_github_sync_error", sql`${table.syncError} IS NULL OR ${table.syncError} IN ('not_found', 'unauthorized', 'rate_limited', 'unavailable')`),
    index("project_github_owner_id_idx").on(table.ownerId),
  ],
);
