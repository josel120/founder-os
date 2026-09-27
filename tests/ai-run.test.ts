// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";

// A chainable stand-in for Drizzle: each select resolves to the next queued result; writes are recorded.
const m = vi.hoisted(() => {
  const state = {
    selects: [] as unknown[][],
    wheres: [] as unknown[],
    sets: [] as Record<string, unknown>[],
    inserts: [] as Record<string, unknown>[],
    executes: [] as unknown[],
    insertError: null as unknown,
    finished: [{ id: "run-1" }] as { id: string }[],
    order: [] as string[],
    report: vi.fn(),
  };
  const nextSelect = () => Promise.resolve(state.selects.shift() ?? []);
  const selectChain = () => {
    const chain = {
      from: () => chain, innerJoin: () => chain, orderBy: () => chain,
      where: (where: unknown) => { state.wheres.push(where); return chain; },
      limit: () => nextSelect(),
      then: (resolve: (value: unknown[]) => unknown, reject: (error: unknown) => unknown) => { state.order.push("count"); return nextSelect().then(resolve, reject); },
    };
    return chain;
  };
  const update = () => ({ set: (values: Record<string, unknown>) => { state.sets.push(values); state.order.push(`update:${String(values.status)}`); return { where: (where: unknown) => { state.wheres.push(where); return Object.assign(Promise.resolve(), { returning: () => Promise.resolve(state.finished) }); } }; } });
  const insert = () => ({ values: (values: Record<string, unknown>) => { state.inserts.push(values); state.order.push("insert"); return { returning: () => (state.insertError ? Promise.reject(state.insertError) : Promise.resolve([{ id: "run-1" }])) }; } });
  const tx = { select: selectChain, update, insert, execute: (query: unknown) => { state.executes.push(query); state.order.push("lock"); return Promise.resolve(); } };
  const db = { ...tx, transaction: async <T>(callback: (t: typeof tx) => Promise<T>) => callback(tx) };
  return { state, db };
});
vi.mock("@/db", () => ({ db: m.db }));
vi.mock("@/lib/report-error", () => ({ reportError: m.state.report }));
vi.mock("@/lib/env", () => ({ env: { ANTHROPIC_API_KEY: undefined, AI_MODEL: "claude-sonnet-5", AI_API_URL: "https://api.anthropic.com" } }));
import { DAILY_RUN_LIMIT, runIdeaAI, startOfUtcDay } from "@/modules/ai/services/run";
import { ASSESSMENT_TOOL_NAME } from "@/modules/ai/services/output";

const ideaId = "00000000-0000-4000-8000-000000000001";
const now = new Date("2026-09-27T15:00:00Z");
const fetchImpl = vi.fn();
const options = { apiKey: "sk-ant-test-key-1234567890", apiUrl: "https://api.test", model: "claude-sonnet-5", fetchImpl, now: () => now };
const idea = { title: "Idea", description: "Desc", status: "INBOX", source: "OWN", problemId: "00000000-0000-4000-8000-0000000000aa" };
const answer = { model: "claude-sonnet-5", content: [{ type: "tool_use", name: ASSESSMENT_TOOL_NAME, input: { recommendation: "PAUSE", rationale: "Why", risks: [], openQuestions: [] } }], usage: { input_tokens: 10, output_tokens: 5 } };
const params = (where: unknown) => new PgDialect().sqlToQuery(where as SQL);

beforeEach(() => {
  vi.resetAllMocks();
  Object.assign(m.state, { selects: [], wheres: [], sets: [], inserts: [], executes: [], insertError: null, finished: [{ id: "run-1" }], order: [] });
  fetchImpl.mockResolvedValue(new Response(JSON.stringify(answer), { status: 200 }));
});
// Queue: idea, problem, evidence, today's count.
const rows = (used = 0, found = true) => m.state.selects.push(found ? [idea] : [], [{ title: "P", description: "PD" }], [{ title: "E", summary: "S", kind: "NOTE", signal: "SUPPORTS" }], [{ used }]);

describe("runIdeaAI (ADR-021)", () => {
  it("is off without a key: reads and sends nothing", async () => {
    expect(await runIdeaAI("owner-a", ideaId, "ASSESSMENT", { ...options, apiKey: undefined })).toEqual({ status: "not_configured" });
    expect(m.state.wheres).toHaveLength(0);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("reads only the owner's PRIVATE idea, problem and evidence, and sends nothing for someone else's idea", async () => {
    rows(0, false);
    expect(await runIdeaAI("owner-a", ideaId, "ASSESSMENT", options)).toEqual({ status: "not_found" });
    expect(params(m.state.wheres[0]).params).toEqual([ideaId, "owner-a", "PRIVATE"]);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(m.state.inserts).toHaveLength(0);

    m.state.wheres = []; m.state.selects = []; rows();
    await runIdeaAI("owner-a", ideaId, "ASSESSMENT", options);
    expect(params(m.state.wheres[1]).params).toEqual([idea.problemId, "owner-a", "PRIVATE"]);
    expect(params(m.state.wheres[2]).params).toEqual([ideaId, "owner-a", "PRIVATE"]);
  });

  it("locks per owner, finishes stale runs and checks the cap before inserting the RUNNING row", async () => {
    rows(DAILY_RUN_LIMIT - 1);
    expect(await runIdeaAI("owner-a", ideaId, "ASSESSMENT", options)).toEqual({ status: "succeeded", runId: "run-1" });
    expect(m.state.order.slice(0, 4)).toEqual(["lock", "update:FAILED", "count", "insert"]);
    expect(params(m.state.executes[0]).params).toEqual(["ai_run:owner-a"]);
    expect(m.state.sets[0]).toEqual({ status: "FAILED", error: "interrupted", finishedAt: now });
    const stale = params(m.state.wheres[3]);
    expect(stale.params).toEqual(["owner-a", "RUNNING", new Date(now.getTime() - 5 * 60 * 1000).toISOString()]);
    expect(params(m.state.wheres[4]).params).toEqual(["owner-a", startOfUtcDay(now).toISOString()]);
    expect(m.state.inserts[0]).toEqual({ ownerId: "owner-a", ideaId, kind: "ASSESSMENT", model: "claude-sonnet-5", promptVersion: "2026-09-27.1", createdAt: now });
  });

  it("refuses at the daily cap without storing or sending anything", async () => {
    rows(DAILY_RUN_LIMIT);
    expect(await runIdeaAI("owner-a", ideaId, "ASSESSMENT", options)).toEqual({ status: "daily_limit" });
    expect(m.state.inserts).toHaveLength(0);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("refuses a second run on the same idea while one is RUNNING", async () => {
    rows();
    m.state.insertError = Object.assign(new Error("dup"), { code: "23505", constraint_name: "ai_run_one_running_per_idea_idx" });
    expect(await runIdeaAI("owner-a", ideaId, "ASSESSMENT", options)).toEqual({ status: "in_progress" });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(m.state.report).not.toHaveBeenCalled();
  });

  it("stores a succeeded assessment with its recommendation on the owner's RUNNING row only", async () => {
    rows();
    await runIdeaAI("owner-a", ideaId, "ASSESSMENT", options);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const body = JSON.parse((fetchImpl.mock.calls[0]![1] as RequestInit).body as string) as { messages: { content: string }[] };
    expect(body.messages[0]!.content).toContain("Idea title: Idea");
    expect(body.messages[0]!.content).not.toContain(ideaId);
    const finish = m.state.sets.at(-1)!;
    expect(finish).toMatchObject({ status: "SUCCEEDED", recommendation: "PAUSE", inputTokens: 10, outputTokens: 5, finishedAt: now });
    expect(params(m.state.wheres.at(-1)).params).toEqual(["run-1", "owner-a", "RUNNING"]);
  });

  it("reports interrupted, not succeeded, when the stale sweep already finished the run", async () => {
    rows();
    m.state.finished = [];
    expect(await runIdeaAI("owner-a", ideaId, "ASSESSMENT", options)).toEqual({ status: "failed", runId: "run-1", error: "interrupted" });
  });

  it("stores the error code when the provider fails", async () => {
    rows();
    fetchImpl.mockResolvedValue(new Response("{}", { status: 429 }));
    expect(await runIdeaAI("owner-a", ideaId, "SUMMARY", options)).toEqual({ status: "failed", runId: "run-1", error: "rate_limited" });
    expect(m.state.sets.at(-1)).toEqual({ status: "FAILED", error: "rate_limited", finishedAt: now });
  });

  it("passes the provider reason to the caller but stores only the allowed code", async () => {
    rows();
    fetchImpl.mockResolvedValue(new Response(JSON.stringify({ type: "error", error: { type: "billing_error" } }), { status: 402 }));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await runIdeaAI("owner-a", ideaId, "ASSESSMENT", options)).toEqual({ status: "failed", runId: "run-1", error: "unavailable", reason: "billing" });
    warn.mockRestore();
    expect(m.state.sets.at(-1)).toEqual({ status: "FAILED", error: "unavailable", finishedAt: now });
  });

  it("refuses notes that are too large before storing anything", async () => {
    m.state.selects.push([{ ...idea, description: "x".repeat(41_000) }], [], []);
    expect(await runIdeaAI("owner-a", ideaId, "ASSESSMENT", options)).toEqual({ status: "too_large" });
    expect(m.state.inserts).toHaveLength(0);
  });

  it("reports a database failure by scope only and sends nothing", async () => {
    const error = new Error("secret sql");
    m.state.selects.push([idea], [], []);
    m.state.insertError = error;
    m.state.selects.push([{ used: 0 }]);
    expect(await runIdeaAI("owner-a", ideaId, "ASSESSMENT", options)).toEqual({ status: "unavailable" });
    expect(m.state.report).toHaveBeenCalledWith("ai.run.start", error);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
