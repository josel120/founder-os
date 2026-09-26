import { and, asc, count, desc, eq, gte, inArray, lte, or } from "drizzle-orm";
import { db } from "@/db";
import { decisionLogs, evidence, financeTransactions, ideas, projects } from "@/db/schema";
import { requireAuth } from "@/lib/require-auth";
import { totalsByCurrency } from "@/modules/finance/services/totals";
import { FINANCE_WINDOW_DAYS, WAITING_THRESHOLD_DAYS, daysAgo, needsResearch, type SignalCounts } from "../services/attention";

const projectColumns = { id: projects.id, name: projects.name, lifecycle: projects.lifecycle, operationalStatus: projects.operationalStatus, nextAction: projects.nextAction, waitingReason: projects.waitingReason, waitingSince: projects.waitingSince, reviewAt: projects.reviewAt };
// Postgres enums have no LIKE operator, so the waiting statuses are listed explicitly (ADR-009).
const waitingStatuses = ["WAITING_PLATFORM", "WAITING_USERS", "WAITING_REVIEW", "WAITING_PAYMENT"] as const;
const ideaColumns = { id: ideas.id, title: ideas.title, status: ideas.status, createdAt: ideas.createdAt };

/**
 * Everything the /private home shows, for the session owner only. Every query repeats owner + PRIVATE on its
 * own table (ADR-015); nothing joins across owners. Returns null for anonymous callers.
 */
export async function getAttention(now: Date = new Date()) {
  const owner = await requireAuth();
  if (!owner || !db) return null;
  const ownProjects = and(eq(projects.ownerId, owner.id), eq(projects.visibility, "PRIVATE"));
  const ownIdeas = and(eq(ideas.ownerId, owner.id), eq(ideas.visibility, "PRIVATE"));
  const [actionProjects, waitingProjects, reviewProjects, inboxIdeas, [inboxTotal], researchIdeas, decisions, transactions] = await Promise.all([
    db.select(projectColumns).from(projects).where(and(ownProjects, inArray(projects.operationalStatus, ["ACTION_REQUIRED", "BLOCKED"]))).orderBy(asc(projects.updatedAt)),
    db.select(projectColumns).from(projects).where(and(ownProjects, inArray(projects.operationalStatus, waitingStatuses), lte(projects.waitingSince, daysAgo(now, WAITING_THRESHOLD_DAYS)))).orderBy(asc(projects.waitingSince)),
    db.select(projectColumns).from(projects).where(and(ownProjects, lte(projects.reviewAt, now))).orderBy(asc(projects.reviewAt)),
    db.select(ideaColumns).from(ideas).where(and(ownIdeas, eq(ideas.status, "INBOX"))).orderBy(asc(ideas.createdAt)).limit(5),
    db.select({ total: count() }).from(ideas).where(and(ownIdeas, eq(ideas.status, "INBOX"))),
    db.select(ideaColumns).from(ideas).where(and(ownIdeas, or(eq(ideas.status, "RESEARCHING"), eq(ideas.status, "VALIDATING")))).orderBy(asc(ideas.createdAt)),
    db.select({ id: decisionLogs.id, title: decisionLogs.title, ideaId: decisionLogs.ideaId, projectId: decisionLogs.projectId, createdAt: decisionLogs.createdAt }).from(decisionLogs)
      .where(and(eq(decisionLogs.ownerId, owner.id), eq(decisionLogs.visibility, "PRIVATE"))).orderBy(desc(decisionLogs.createdAt)).limit(5),
    db.select({ type: financeTransactions.type, amount: financeTransactions.amount, currency: financeTransactions.currency }).from(financeTransactions)
      .where(and(eq(financeTransactions.ownerId, owner.id), eq(financeTransactions.visibility, "PRIVATE"), gte(financeTransactions.occurredAt, daysAgo(now, FINANCE_WINDOW_DAYS)))),
  ]);
  const counts = new Map<string, SignalCounts>();
  if (researchIdeas.length > 0) {
    const rows = await db.select({ ideaId: evidence.ideaId, signal: evidence.signal, total: count() }).from(evidence)
      .where(and(eq(evidence.ownerId, owner.id), eq(evidence.visibility, "PRIVATE"), inArray(evidence.ideaId, researchIdeas.map((idea) => idea.id))))
      .groupBy(evidence.ideaId, evidence.signal);
    for (const { ideaId, signal, total } of rows) {
      if (!ideaId) continue;
      const entry = counts.get(ideaId) ?? { supports: 0, contradicts: 0, neutral: 0 };
      entry[signal === "SUPPORTS" ? "supports" : signal === "CONTRADICTS" ? "contradicts" : "neutral"] += total;
      counts.set(ideaId, entry);
    }
  }
  return {
    actionProjects,
    waitingProjects,
    reviewProjects,
    inbox: { ideas: inboxIdeas, total: inboxTotal?.total ?? 0 },
    researchIdeas: researchIdeas.filter((idea) => needsResearch(counts.get(idea.id))).map((idea) => ({ ...idea, signals: counts.get(idea.id) ?? { supports: 0, contradicts: 0, neutral: 0 } })),
    decisions,
    finance: totalsByCurrency(transactions),
  };
}

export type Attention = NonNullable<Awaited<ReturnType<typeof getAttention>>>;
