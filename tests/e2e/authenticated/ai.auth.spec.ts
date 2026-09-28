// ADR-021 / ADR-024: AI execution end to end through the Groq path, against the local stub (tests/e2e/ai-stub.mjs), never
// a real provider. Serial: the daily cap counts every run of the owner, so these tests must not race each other.
import { expect, test, type Page } from "@playwright/test";
import { e2eAiStubUrl, e2eOwner } from "../e2e-env";
import { captureServerAction, ready, replayAnonymously, retargetServerActions, unique, withE2eDb } from "./helpers";

test.describe.configure({ mode: "serial" });

// The stub puts this in a text block and in error bodies; the app must never store or show it.
const STUB_SECRET = "SECRET-ai-stub-must-never-leak-5d1e07";

type StubRequest = { path: string; headers: Record<string, string>; body: { model: string; max_tokens: number; messages: { role: string; content: string }[]; tool_choice: { function: { name: string } } } };
const stubRequests = async (page: Page) => (await (await page.request.get(`${e2eAiStubUrl}/__requests`)).json()) as StubRequest[];

const ownerA = () => withE2eDb(async (sql) => {
  const [row] = await sql<{ id: string }[]>`SELECT id FROM "user" WHERE email = ${e2eOwner.email}`;
  if (!row) throw new Error("The E2E owner does not exist.");
  return row.id;
});

// An idea with a problem, evidence, a decision and a finance row, each carrying a marker that must never be sent.
async function seedIdea(label: string) {
  const id = unique();
  const owner = await ownerA();
  return withE2eDb(async (sql) => {
    const [problem] = await sql<{ id: string }[]>`INSERT INTO problem (owner_id, title, description) VALUES (${owner}, ${`E2E AI problem ${id}`}, 'Owners lose track of research') RETURNING id`;
    const [idea] = await sql<{ id: string }[]>`INSERT INTO idea (owner_id, problem_id, title, description, status)
      VALUES (${owner}, ${problem!.id}, ${`E2E AI ${label} ${id}`}, 'A tool that keeps research in one place', 'RESEARCHING') RETURNING id`;
    await sql`INSERT INTO evidence (owner_id, idea_id, title, summary, kind, signal, source_url)
      VALUES (${owner}, ${idea!.id}, ${`E2E interview ${id}`}, 'Two owners said they would pay', 'INTERVIEW', 'SUPPORTS', ${`https://leak.example/e2e-source-${id}`})`;
    await sql`INSERT INTO decision_log (owner_id, idea_id, title, decision, reason) VALUES (${owner}, ${idea!.id}, 'E2E decision', ${`E2E-DECISION-NOT-SENT-${id}`}, 'Because')`;
    await sql`INSERT INTO finance_transaction (owner_id, type, category, amount, currency, source, occurred_at)
      VALUES (${owner}, 'EXPENSE', ${`E2E-FINANCE-NOT-SENT-${id}`}, '10.00', 'USD', 'manual', now())`;
    return { id: idea!.id, marker: id, title: `E2E AI ${label} ${id}` };
  });
}

const runsFor = (ideaId: string) => withE2eDb((sql) => sql<{ kind: string; status: string; recommendation: string | null; error: string | null; model: string; input_tokens: number | null }[]>`
  SELECT kind, status, recommendation, error, model, input_tokens FROM ai_run WHERE idea_id = ${ideaId} ORDER BY created_at`).then((rows) => [...rows]);

test.beforeAll(async () => {
  const owner = await ownerA();
  await withE2eDb((sql) => sql`DELETE FROM ai_run WHERE owner_id = ${owner}`);
});

test("an assessment sends only the allowlisted notes, shows plain-text advice and never changes the idea", async ({ page }) => {
  const idea = await seedIdea("assess");
  const before = (await stubRequests(page)).length;
  await ready(page, page.goto(`/private/ideas/${idea.id}`));
  const panel = page.getByRole("region", { name: "AI second opinion" });
  await expect(panel.getByText("Runs only when you click.", { exact: false })).toBeVisible();
  await expect(panel.getByText("0 of 20 runs used today (UTC).")).toBeVisible();

  await ready(page, panel.getByRole("button", { name: "Get an assessment" }).click());
  await expect(panel.getByRole("status")).toHaveText("Assessment ready. You decide what to do with it.");
  await expect(panel.getByText("Suggests: Investigate more")).toBeVisible();
  await expect(panel.getByText("Two interviews are not enough. <b>not bold</b>")).toBeVisible();
  await expect(panel.locator("b")).toHaveCount(0);
  await expect(panel.getByText("Who pays for it?")).toBeVisible();
  await expect(panel.getByRole("link", { name: "Record a decision" })).toHaveAttribute("href", "#decisions");
  await expect(panel.getByText("1 of 20 runs used today (UTC).")).toBeVisible();

  const sent = (await stubRequests(page)).slice(before);
  expect(sent).toHaveLength(1);
  const [request] = sent;
  expect(request!.path).toBe("/chat/completions");
  expect(request!.body.model).toBe("llama-3.3-70b-versatile");
  expect(request!.body.tool_choice.function.name).toBe("idea_assessment");
  const content = request!.body.messages.map((message) => message.content).join("\n");
  expect(content).toContain(idea.title);
  expect(content).toContain("Two owners said they would pay");
  expect(content).toContain(`E2E AI problem ${idea.marker}`);
  for (const forbidden of ["leak.example", "E2E-DECISION-NOT-SENT", "E2E-FINANCE-NOT-SENT", e2eOwner.email, idea.id]) expect(content).not.toContain(forbidden);

  expect(await runsFor(idea.id)).toEqual([{ kind: "ASSESSMENT", status: "SUCCEEDED", recommendation: "INVESTIGATE_MORE", error: null, model: "llama-e2e", input_tokens: 321 }]);
  const [status] = await withE2eDb((sql) => sql<{ status: string }[]>`SELECT status FROM idea WHERE id = ${idea.id}`);
  expect(status!.status).toBe("RESEARCHING");
  expect(await withE2eDb((sql) => sql`SELECT count(*)::int AS n FROM decision_log WHERE idea_id = ${idea.id}`).then((rows) => rows[0]!.n)).toBe(1);
  expect(await page.content()).not.toContain(STUB_SECRET);
});

test("a research summary shows the evidence overview; a provider failure stores only its code", async ({ page }) => {
  const idea = await seedIdea("summary");
  await ready(page, page.goto(`/private/ideas/${idea.id}`));
  const panel = page.getByRole("region", { name: "AI second opinion" });
  await ready(page, panel.getByRole("button", { name: "Summarize the evidence" }).click());
  await expect(panel.getByRole("status")).toHaveText("Research summary ready.");
  await expect(panel.getByText("The evidence leans positive.")).toBeVisible();

  const failing = await seedIdea("E2E-AI-FAIL-429");
  await ready(page, page.goto(`/private/ideas/${failing.id}`));
  const failingPanel = page.getByRole("region", { name: "AI second opinion" });
  await ready(page, failingPanel.getByRole("button", { name: "Get an assessment" }).click());
  await expect(failingPanel.getByRole("alert")).toHaveText("The AI provider's rate limit was reached. Try again later.");
  await expect(failingPanel.getByText("The AI provider's rate limit was reached.", { exact: true })).toBeVisible();
  expect(await runsFor(failing.id)).toEqual([{ kind: "ASSESSMENT", status: "FAILED", recommendation: null, error: "rate_limited", model: "llama-3.3-70b-versatile", input_tokens: null }]);
  expect(await page.content()).not.toContain(STUB_SECRET);
});

test("at the daily limit the buttons are disabled and a replayed run is refused without a call", async ({ page }) => {
  const idea = await seedIdea("cap");
  const owner = await ownerA();
  await withE2eDb((sql) => sql`INSERT INTO ai_run (owner_id, idea_id, kind, status, error, finished_at, model, prompt_version)
    SELECT ${owner}, ${idea.id}, 'SUMMARY', 'FAILED', 'unavailable', now(), 'm', 'v' FROM generate_series(1, 20 - (SELECT count(*)::int FROM ai_run WHERE owner_id = ${owner} AND created_at >= date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'))`);
  try {
    await ready(page, page.goto(`/private/ideas/${idea.id}`));
    const panel = page.getByRole("region", { name: "AI second opinion" });
    await expect(panel.getByText("20 of 20 runs used today (UTC). The limit resets at 00:00 UTC.")).toBeVisible();
    await expect(panel.getByRole("button", { name: "Get an assessment" })).toBeDisabled();
    await expect(panel.getByRole("button", { name: "Summarize the evidence" })).toBeDisabled();
  } finally {
    await withE2eDb((sql) => sql`DELETE FROM ai_run WHERE owner_id = ${owner}`);
  }
});

test("owner B's idea and runs never reach owner A, and retargeting the run action fails", async ({ page }) => {
  const own = await seedIdea("cross-owner");
  const id = unique();
  const other = await withE2eDb(async (sql) => {
    const ownerId = `e2e-owner-b-${id}`;
    await sql`INSERT INTO "user" (id, name, email) VALUES (${ownerId}, 'E2E Owner B', ${`owner-b-${id}@e2e.test`})`;
    const [idea] = await sql<{ id: string }[]>`INSERT INTO idea (owner_id, title, description) VALUES (${ownerId}, ${`Owner B idea ${id}`}, 'Owner B only') RETURNING id`;
    await sql`INSERT INTO ai_run (owner_id, idea_id, kind, status, recommendation, output, finished_at, model, prompt_version)
      VALUES (${ownerId}, ${idea!.id}, 'ASSESSMENT', 'SUCCEEDED', 'REJECT', ${sql.json({ recommendation: "REJECT", rationale: `OWNER-B-AI-SECRET-${id}`, risks: [], openQuestions: [] })}, now(), 'm', 'v')`;
    return { ownerId, ideaId: idea!.id };
  });
  const before = (await stubRequests(page)).length;

  await ready(page, page.goto(`/private/ideas/${other.ideaId}`));
  await expect(page.getByRole("heading", { name: "Nothing here." })).toBeVisible();
  expect(await page.content()).not.toContain(`OWNER-B-AI-SECRET-${id}`);

  await ready(page, page.goto(`/private/ideas/${own.id}`));
  const retargeted = await retargetServerActions(page, own.id, other.ideaId);
  await page.getByRole("button", { name: "Get an assessment" }).click();
  await expect(page.getByText("Idea not found.", { exact: true })).toBeVisible();
  expect(retargeted.count).toBe(1);
  await page.unroute("**/*");

  expect((await stubRequests(page)).length).toBe(before);
  expect(await withE2eDb((sql) => sql`SELECT count(*)::int AS n FROM ai_run WHERE idea_id = ${other.ideaId}`).then((rows) => rows[0]!.n)).toBe(1);
  expect(await runsFor(own.id)).toEqual([]);
});

test("an anonymous replay of the run action is refused and sends nothing", async ({ page }) => {
  const idea = await seedIdea("anonymous");
  await ready(page, page.goto(`/private/ideas/${idea.id}`));
  const action = await captureServerAction(page, () => page.getByRole("button", { name: "Get an assessment" }).click());
  const before = (await stubRequests(page)).length;
  const result = await replayAnonymously(action);
  expect(result.status).toBe(200);
  expect(result.body).toContain("Sign in again to run this.");
  expect(result.body).not.toContain('"ok":true');
  expect((await stubRequests(page)).length).toBe(before);
  expect(await runsFor(idea.id)).toEqual([]);
});

test("public pages never carry AI output", async ({ page }) => {
  const owner = await ownerA();
  const idea = await seedIdea("public-check");
  const marker = `PUBLIC-CHECK-AI-${unique()}`;
  await withE2eDb((sql) => sql`INSERT INTO ai_run (owner_id, idea_id, kind, status, output, finished_at, model, prompt_version)
    VALUES (${owner}, ${idea.id}, 'SUMMARY', 'SUCCEEDED', ${sql.json({ overview: marker, supports: [], contradicts: [], openQuestions: [] })}, now(), 'm', 'v')`);
  try {
    for (const path of ["/portfolio", "/", "/login", "/register", "/p/e2e-ai-public-check"]) {
      const text = await (await page.request.get(path)).text();
      expect(text).not.toContain(marker);
      expect(text).not.toContain(idea.title);
    }
  } finally {
    await withE2eDb((sql) => sql`DELETE FROM ai_run WHERE owner_id = ${owner}`);
  }
});
