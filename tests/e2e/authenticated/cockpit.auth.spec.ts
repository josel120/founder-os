import { expect, test, type Page } from "@playwright/test";
import { e2eOwner } from "../e2e-env";
import { captureServerAction, ready, replayAnonymously, retargetServerActions, unique, withE2eDb } from "./helpers";

// Other specs run in parallel against the same owner, so assertions target this spec's unique titles, never totals.
// Links are followed and mutations are checked in place, without reloads (T-061 fixed the lost client updates).
const letters = () => Array.from({ length: 2 }, () => String.fromCharCode(65 + Math.floor(Math.random() * 26))).join("");
const currencyCode = (prefix: "Q" | "Z") => `${prefix}${letters()}`; // fresh per attempt, so a retry never double-counts; A uses Q, B uses Z

async function captureProblem(page: Page, title: string) {
  await ready(page, page.goto("/private/problems"));
  await page.getByLabel("Problem", { exact: true }).fill(title);
  await page.getByLabel("Who experiences it and why does it matter?").fill(`Why ${title} matters`);
  await page.getByRole("button", { name: "Capture problem" }).click();
  await expect(page.getByText("Problem saved privately.")).toBeVisible();
}

// Each seed is older than every earlier one (base date minus the current epoch seconds), so the newest seed is always
// among the five oldest inbox ideas, even when the spec is repeated or retried against the same database.
const olderThanEverySeed = (base: string) => new Date(Date.parse(`${base}T00:00:00Z`) - Date.now()).toISOString();

const ownerA = () => withE2eDb(async (sql) => {
  const [row] = await sql<{ id: string }[]>`SELECT id FROM "user" WHERE email = ${e2eOwner.email}`;
  if (!row) throw new Error("The E2E owner does not exist.");
  return row.id;
});

const idOf = (table: "idea" | "problem", title: string) => withE2eDb(async (sql) => {
  const [row] = await sql<{ id: string }[]>`SELECT id FROM ${sql(table)} WHERE title = ${title}`;
  if (!row) throw new Error(`No ${table} titled ${title}`);
  return row.id;
});

// Owner A's attention items. The inbox idea is backdated so it stays among the five oldest while other specs add ideas.
async function seedOwnerAttention(ownerId: string, { withInbox = true } = {}) {
  const id = unique();
  const seeded = {
    blocked: `E2E blocked project ${id}`, nextAction: `Renew the signing key ${id}`,
    waiting: `E2E waiting project ${id}`, waitingReason: `Beta feedback ${id}`,
    inbox: `E2E oldest inbox idea ${id}`, contradicted: `E2E contradicted idea ${id}`, currency: currencyCode("Q"),
  };
  return withE2eDb(async (sql) => {
    const [blocked] = await sql<{ id: string }[]>`INSERT INTO project (owner_id, name, slug, description, lifecycle, operational_status, next_action, review_at, visibility)
      VALUES (${ownerId}, ${seeded.blocked}, ${`e2e-blocked-${id}`}, 'Seeded for the cockpit', 'BUILDING', 'BLOCKED', ${seeded.nextAction}, now() - interval '2 days', 'PRIVATE') RETURNING id`;
    const [waiting] = await sql<{ id: string }[]>`INSERT INTO project (owner_id, name, slug, description, operational_status, waiting_reason, waiting_since, visibility)
      VALUES (${ownerId}, ${seeded.waiting}, ${`e2e-waiting-${id}`}, 'Seeded for the cockpit', 'WAITING_USERS', ${seeded.waitingReason}, now() - interval '20 days', 'PRIVATE') RETURNING id`;
    const [inbox] = withInbox ? await sql<{ id: string }[]>`INSERT INTO idea (owner_id, title, description, visibility, created_at) VALUES (${ownerId}, ${seeded.inbox}, 'Seeded', 'PRIVATE', ${olderThanEverySeed("2001-01-01")}) RETURNING id` : [{ id: "" }];
    const [contradicted] = await sql<{ id: string }[]>`INSERT INTO idea (owner_id, title, description, status, visibility) VALUES (${ownerId}, ${seeded.contradicted}, 'Seeded', 'RESEARCHING', 'PRIVATE') RETURNING id`;
    if (!blocked || !waiting || !inbox || !contradicted) throw new Error("Could not seed owner A's attention items.");
    await sql`INSERT INTO evidence (owner_id, idea_id, title, summary, kind, signal, visibility) VALUES (${ownerId}, ${contradicted.id}, ${`E2E contradiction ${id}`}, 'Seeded', 'MARKET', 'CONTRADICTS', 'PRIVATE')`;
    // In the 30-day window: +100.00 and −30.50. The 60-day-old income must not count.
    await sql`INSERT INTO finance_transaction (owner_id, type, category, amount, currency, source, occurred_at, visibility) VALUES
      (${ownerId}, 'INCOME', 'Seeded income', '100.00', ${seeded.currency}, 'MANUAL', now() - interval '1 day', 'PRIVATE'),
      (${ownerId}, 'EXPENSE', 'Seeded expense', '30.50', ${seeded.currency}, 'MANUAL', now() - interval '2 days', 'PRIVATE'),
      (${ownerId}, 'INCOME', 'Seeded old income', '1000.00', ${seeded.currency}, 'MANUAL', now() - interval '60 days', 'PRIVATE')`;
    return { ...seeded, blockedId: blocked.id, waitingId: waiting.id, inboxId: inbox.id, contradictedId: contradicted.id };
  });
}

// Owner B's rows are built to win every home list if scoping ever broke: the oldest inbox idea, the newest decision,
// a blocked project due for review, an unresearched idea, recent finance, and a transaction on one of A's projects.
async function seedOtherOwner(ownerAProjectId: string) {
  const id = unique();
  const ownerId = `e2e-owner-b-${id}`;
  const seeded = {
    project: `Owner B blocked project ${id}`, inbox: `Owner B inbox idea ${id}`, research: `Owner B research idea ${id}`,
    decision: `Owner B decision ${id}`, problem: `Owner B problem ${id}`, category: `Owner B category ${id}`, currency: currencyCode("Z"),
  };
  return withE2eDb(async (sql) => {
    await sql`INSERT INTO "user" (id, name, email) VALUES (${ownerId}, 'E2E Owner B', ${`owner-b-${id}@e2e.test`})`;
    const [project] = await sql<{ id: string }[]>`INSERT INTO project (owner_id, name, slug, description, operational_status, next_action, review_at, visibility)
      VALUES (${ownerId}, ${seeded.project}, ${`owner-b-${id}`}, 'Owner B only', 'BLOCKED', 'Owner B next action', now() - interval '1 day', 'PRIVATE') RETURNING id`;
    const [problem] = await sql<{ id: string }[]>`INSERT INTO problem (owner_id, title, description, visibility) VALUES (${ownerId}, ${seeded.problem}, 'Owner B only', 'PRIVATE') RETURNING id`;
    const [research] = await sql<{ id: string }[]>`INSERT INTO idea (owner_id, title, description, status, visibility) VALUES (${ownerId}, ${seeded.research}, 'Owner B only', 'VALIDATING', 'PRIVATE') RETURNING id`;
    await sql`INSERT INTO idea (owner_id, title, description, visibility, created_at) VALUES (${ownerId}, ${seeded.inbox}, 'Owner B only', 'PRIVATE', ${olderThanEverySeed("1990-01-01")})`;
    await sql`INSERT INTO decision_log (owner_id, title, decision, reason, visibility, created_at) VALUES (${ownerId}, ${seeded.decision}, 'Owner B only', 'Owner B only', 'PRIVATE', now() + interval '1 day')`;
    await sql`INSERT INTO finance_transaction (owner_id, project_id, type, category, amount, currency, source, occurred_at, visibility) VALUES
      (${ownerId}, NULL, 'INCOME', ${seeded.category}, '5.00', ${seeded.currency}, 'MANUAL', now() - interval '1 day', 'PRIVATE'),
      (${ownerId}, ${ownerAProjectId}, 'EXPENSE', ${seeded.category}, '7.00', ${seeded.currency}, 'MANUAL', now() - interval '1 day', 'PRIVATE')`;
    if (!project || !problem || !research) throw new Error("Could not seed owner B.");
    return { ...seeded, ownerId, projectId: project.id, problemId: problem.id, researchId: research.id };
  });
}

const ownerSnapshot = (ownerId: string) => withE2eDb(async (sql) => ({
  projects: [...(await sql`SELECT * FROM project WHERE owner_id = ${ownerId} ORDER BY id`)],
  problems: [...(await sql`SELECT * FROM problem WHERE owner_id = ${ownerId} ORDER BY id`)],
  ideas: [...(await sql`SELECT * FROM idea WHERE owner_id = ${ownerId} ORDER BY id`)],
  decisions: [...(await sql`SELECT * FROM decision_log WHERE owner_id = ${ownerId} ORDER BY id`)],
  finance: [...(await sql`SELECT * FROM finance_transaction WHERE owner_id = ${ownerId} ORDER BY id`)],
}));

async function expectNoneOf(page: Page, texts: string[]) {
  for (const text of texts) await expect(page.getByText(text, { exact: text.length <= 3 })).toHaveCount(0); // a bare currency code must not match inside random IDs
}

test("the home lists the owner's attention items, links to them and never shows another owner's rows", async ({ page }) => {
  const own = await seedOwnerAttention(await ownerA());
  const other = await seedOtherOwner(own.blockedId);
  const before = await ownerSnapshot(other.ownerId);

  await ready(page, page.goto("/private"));
  await expect(page).toHaveTitle("Home · Founder OS");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("What needs your attention");
  await expect(page.getByRole("navigation", { name: "Workspace" }).getByRole("link", { name: "Home" })).toHaveAttribute("aria-current", "page");

  const projects = page.getByRole("region", { name: /^Projects/ });
  const action = projects.getByRole("group", { name: /^Action required or blocked/ });
  await expect(action.getByRole("link", { name: own.blocked })).toHaveAttribute("href", `/private/projects/${own.blockedId}`);
  await expect(action.getByText(own.nextAction)).toBeVisible();
  await expect(projects.getByRole("group", { name: /^Due for review/ }).getByRole("link", { name: own.blocked })).toBeVisible();
  const waiting = projects.getByRole("group", { name: /^Waiting too long/ });
  await expect(waiting.getByRole("link", { name: own.waiting })).toBeVisible();
  await expect(waiting.getByText(`Waiting 20 days: ${own.waitingReason}`)).toBeVisible();

  const research = page.getByRole("region", { name: /^Research gaps/ });
  await expect(research.getByRole("link", { name: own.contradicted })).toHaveAttribute("href", `/private/ideas/${own.contradictedId}#evidence-heading`);
  await expect(research.locator("li", { hasText: own.contradicted })).toContainText("1 contradicting item, nothing supporting.");
  await expect(page.getByRole("region", { name: /^Inbox/ }).getByRole("link", { name: own.inbox })).toHaveAttribute("href", `/private/ideas/${own.inboxId}`);
  const finance = page.getByRole("region", { name: /^Last 30 days/ }).locator("li", { hasText: own.currency });
  await expect(finance).toContainText("69.50");
  await expect(finance).toContainText("100.00");
  await expect(finance).toContainText("30.50");

  await expectNoneOf(page, [other.project, other.inbox, other.research, other.decision, other.currency, "Owner B next action"]);

  await ready(page, action.getByRole("link", { name: own.blocked }).click());
  await expect(page).toHaveURL(new RegExp(`/private/projects/${own.blockedId}$`));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(own.blocked);
  // B's transaction points at A's project; the project chain must still only show A's own finance.
  await expect(page.getByRole("region", { name: "Finance" }).getByText(other.category)).toHaveCount(0);

  await ready(page, page.goto("/private"));
  await ready(page, page.getByRole("region", { name: /^Research gaps/ }).getByRole("link", { name: own.contradicted }).click());
  await expect(page).toHaveURL(new RegExp(`/private/ideas/${own.contradictedId}#evidence-heading$`));
  await expect(page.getByRole("region", { name: "Evidence" }).getByText("1 contradicts")).toBeVisible();

  expect(await ownerSnapshot(other.ownerId)).toEqual(before);
});

test("a problem is edited on its page, gathers ideas and evidence, and a project shows its idea and finance", async ({ page }) => {
  const id = unique();
  const title = `E2E cockpit problem ${id}`;
  const edited = `E2E cockpit problem edited ${id}`;
  await captureProblem(page, title);
  const problemId = await idOf("problem", title);

  await expect(page.getByRole("link", { name: title })).toHaveAttribute("href", `/private/problems/${problemId}`);
  await ready(page, page.getByRole("link", { name: title }).click());
  await expect(page).toHaveURL(new RegExp(`/private/problems/${problemId}$`));
  await expect(page).toHaveTitle("Problem · Founder OS");
  await page.locator("summary", { hasText: "Edit problem" }).click();
  const form = page.locator("form", { hasText: "Refine problem" });
  await form.getByLabel("Problem", { exact: true }).fill(edited);
  await form.getByLabel("Who experiences it and why does it matter?").fill(`Refined why ${id}`);
  await form.getByRole("button", { name: "Save problem" }).click();
  await expect(form.getByText("Problem updated.")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(edited);
  expect(await withE2eDb((sql) => sql`SELECT title, description, visibility FROM problem WHERE id = ${problemId}`).then((rows) => [...rows]))
    .toEqual([{ title: edited, description: `Refined why ${id}`, visibility: "PRIVATE" }]);

  const evidenceTitle = `E2E problem evidence ${id}`;
  const capture = page.locator("#capture-evidence");
  await expect(capture.getByText(`About this problem. Stays private.`)).toBeVisible();
  await capture.getByLabel("Evidence title").fill(evidenceTitle);
  await capture.getByLabel("What did you learn?").fill("Seen in three interviews");
  await capture.getByLabel("Kind").selectOption("INTERVIEW");
  await capture.getByLabel("Signal").selectOption("SUPPORTS");
  await capture.getByRole("button", { name: "Save evidence" }).click();
  await expect(page.getByText("Evidence saved privately.")).toBeVisible();
  await expect(page.getByRole("region", { name: "Evidence" }).getByText("1 supports")).toBeVisible();
  expect(await withE2eDb((sql) => sql`SELECT problem_id, idea_id FROM evidence WHERE title = ${evidenceTitle}`).then((rows) => [...rows]))
    .toEqual([{ problem_id: problemId, idea_id: null }]);

  await ready(page, page.getByRole("button", { name: "Turn into idea" }).click());
  await ready(page, page.waitForURL(/\/private\/ideas\/[0-9a-f-]{36}$/));
  const ideaId = new URL(page.url()).pathname.split("/").pop() ?? "";
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(edited);
  await ready(page, page.goto(`/private/problems/${problemId}`));
  await expect(page.getByRole("region", { name: "Ideas from this problem" }).getByRole("link", { name: edited })).toHaveAttribute("href", `/private/ideas/${ideaId}`);

  const currency = currencyCode("Q");
  const projectName = `E2E chain project ${id}`;
  const projectId = await withE2eDb(async (sql) => {
    const [project] = await sql<{ id: string }[]>`INSERT INTO project (owner_id, origin_idea_id, name, slug, description, visibility)
      VALUES (${await ownerA()}, ${ideaId}, ${projectName}, ${`e2e-chain-${id}`}, 'Seeded chain', 'PRIVATE') RETURNING id`;
    if (!project) throw new Error("Could not seed the chain project.");
    await sql`INSERT INTO finance_transaction (owner_id, project_id, type, category, amount, currency, source, occurred_at, visibility)
      SELECT owner_id, id, 'INCOME', 'Chain income', '12.00', ${currency}, 'MANUAL', now(), 'PRIVATE' FROM project WHERE id = ${project.id}`;
    return project.id;
  });
  await ready(page, page.goto(`/private/projects/${projectId}`));
  await expect(page.getByText("From idea:").getByRole("link", { name: edited })).toHaveAttribute("href", `/private/ideas/${ideaId}`);
  const finance = page.getByRole("region", { name: "Finance" });
  await expect(finance.getByText("Income · Chain income")).toBeVisible();
  await expect(finance.getByText(`+12.00 ${currency}`)).toBeVisible();
});

test("owner A cannot open or edit owner B's problem or project, and B's origin idea never leaks", async ({ page }) => {
  const own = await seedOwnerAttention(await ownerA(), { withInbox: false });
  const other = await seedOtherOwner(own.blockedId);
  // A's project claims B's idea as its origin: the chain must not follow it across owners.
  await withE2eDb((sql) => sql`UPDATE project SET origin_idea_id = ${other.researchId} WHERE id = ${own.waitingId}`);
  const before = await ownerSnapshot(other.ownerId);

  for (const path of [`/private/problems/${other.problemId}`, `/private/projects/${other.projectId}`]) {
    await ready(page, page.goto(path));
    await expect(page.getByRole("heading", { name: "Nothing here." })).toBeVisible();
    await expectNoneOf(page, [other.problem, other.project]);
  }
  await ready(page, page.goto(`/private/projects/${own.waitingId}`));
  await expect(page.getByText("From idea:")).toHaveCount(0);
  await expectNoneOf(page, [other.research]);

  const title = `E2E owner A problem ${unique()}`;
  await captureProblem(page, title);
  const problemId = await idOf("problem", title);
  await ready(page, page.goto(`/private/problems/${problemId}`));
  const retargeted = await retargetServerActions(page, problemId, other.problemId);
  await page.locator("summary", { hasText: "Edit problem" }).click();
  const form = page.locator("form", { hasText: "Refine problem" });
  await form.getByLabel("Problem", { exact: true }).fill("Hijacked by owner A");
  await form.getByRole("button", { name: "Save problem" }).click();
  await expect(form.getByRole("alert")).toHaveText("Problem not found. Changes were not saved.");
  expect(retargeted.count).toBe(1);
  await page.unroute("**/*");

  expect(await ownerSnapshot(other.ownerId)).toEqual(before);
  expect(await withE2eDb((sql) => sql`SELECT title FROM problem WHERE id = ${problemId}`).then((rows) => [...rows])).toEqual([{ title }]);
});

test("an anonymous replay of a problem edit is rejected and changes nothing", async ({ page }) => {
  const title = `E2E anonymous problem ${unique()}`;
  await captureProblem(page, title);
  const problemId = await idOf("problem", title);
  const before = await withE2eDb((sql) => sql`SELECT * FROM problem WHERE id = ${problemId}`).then((rows) => [...rows]);

  await ready(page, page.goto(`/private/problems/${problemId}`));
  await page.locator("summary", { hasText: "Edit problem" }).click();
  const form = page.locator("form", { hasText: "Refine problem" });
  const update = await captureServerAction(page, async () => {
    await form.getByLabel("Problem", { exact: true }).fill("Renamed anonymously");
    await form.getByRole("button", { name: "Save problem" }).click();
  });
  const result = await replayAnonymously(update);
  expect(result.status).toBe(200);
  expect(result.body).toContain("Sign in again to save changes.");
  expect(result.body).not.toContain('"ok":true');
  expect(await withE2eDb((sql) => sql`SELECT * FROM problem WHERE id = ${problemId}`).then((rows) => [...rows])).toEqual(before);
});
