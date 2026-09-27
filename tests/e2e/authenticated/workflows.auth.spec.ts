import { expect, test, type Page } from "@playwright/test";
import { e2eBaseUrl, e2eOwner, e2eSetupToken } from "../e2e-env";
import { captureIdea, captureServerAction, ready, replayAnonymously, retargetServerActions, unique, withE2eDb } from "./helpers";

// Owner B exists only as rows in the disposable database; closed signup means B can never sign in.
async function seedOtherOwnerProject() {
  const id = unique();
  const ownerId = `e2e-owner-b-${id}`;
  const seeded = { name: `E2E owner B project ${id}`, description: `Owner B private description ${id}`, decision: `Owner B private decision ${id}` };
  return withE2eDb(async (sql) => {
    await sql`INSERT INTO "user" (id, name, email) VALUES (${ownerId}, 'E2E Owner B', ${`owner-b-${id}@e2e.test`})`;
    const [project] = await sql<{ id: string }[]>`INSERT INTO project (owner_id, name, slug, description, visibility) VALUES (${ownerId}, ${seeded.name}, ${`owner-b-${id}`}, ${seeded.description}, 'PRIVATE') RETURNING id`;
    if (!project) throw new Error("Could not seed owner B's project.");
    await sql`INSERT INTO decision_log (owner_id, project_id, title, decision, reason, visibility) VALUES (${ownerId}, ${project.id}, ${seeded.decision}, 'Keep it private', 'Owner B only', 'PRIVATE')`;
    return { ...seeded, projectId: project.id };
  });
}

async function projectSnapshot(projectId: string) {
  return withE2eDb(async (sql) => ({
    project: [...(await sql`SELECT * FROM project WHERE id = ${projectId}`)],
    decisions: [...(await sql`SELECT * FROM decision_log WHERE project_id = ${projectId} ORDER BY id`)],
  }));
}

async function createOwnProject(page: Page, name: string) {
  await ready(page, page.goto("/private/projects"));
  await page.locator('input[name="name"]').fill(name);
  await page.locator('input[name="slug"]').fill(`project-${unique()}`);
  await page.getByRole("button", { name: "+ Create project" }).click();
  await expect(page.getByText("Project created privately.")).toBeVisible();
  await page.getByRole("link", { name, exact: true }).click();
  await ready(page, page.waitForURL(/\/private\/projects\/[0-9a-f-]{36}$/));
  return new URL(page.url()).pathname.split("/").pop() ?? "";
}

test("captured ideas appear in the private inbox", async ({ page }) => {
  const title = `E2E idea ${unique()}`;
  await captureIdea(page, title);
  await expect(page.getByRole("link", { name: title })).toBeVisible(); // in place, without a reload (T-061)
  await ready(page, page.reload());
  await expect(page.getByRole("link", { name: title })).toBeVisible();
});

test("idea status changes persist after reload", async ({ page }) => {
  const title = `E2E status ${unique()}`;
  await captureIdea(page, title);
  await page.getByRole("link", { name: title }).click();
  await ready(page, page.waitForURL(/\/private\/ideas\/[0-9a-f-]{36}$/));
  await page.getByLabel("Status").selectOption("RESEARCHING");
  await expect(page.getByLabel("Status")).toHaveValue("RESEARCHING");
  await page.getByRole("button", { name: "Save status" }).click();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  await ready(page, page.reload());
  await expect(page.getByLabel("Status")).toHaveValue("RESEARCHING");
});

test("idea content edits persist and decisions stay with their idea", async ({ page }) => {
  const firstTitle = `E2E editable ${unique()}`;
  const secondTitle = `E2E separate ${unique()}`;
  await captureIdea(page, firstTitle);
  await captureIdea(page, secondTitle);

  await page.getByRole("link", { name: firstTitle }).click();
  await ready(page, page.waitForURL(/\/private\/ideas\/[0-9a-f-]{36}$/));
  await page.getByLabel("Title", { exact: true }).fill(`${firstTitle} refined`);
  await page.getByLabel("Description", { exact: true }).fill("A persisted description");
  await page.getByRole("button", { name: "Save idea" }).click();
  await expect(page.getByText("Idea updated.")).toBeVisible();
  await expect(page.getByRole("heading", { name: `${firstTitle} refined` })).toBeVisible();
  await ready(page, page.reload());
  await expect(page.getByRole("heading", { name: `${firstTitle} refined` })).toBeVisible();
  await expect(page.locator("p").filter({ hasText: "A persisted description" })).toBeVisible();
  await ready(page, page.goto("/private/ideas"));
  await expect(page.getByRole("link", { name: `${firstTitle} refined` })).toBeVisible();
  await page.getByRole("link", { name: `${firstTitle} refined` }).click();
  await ready(page, page.waitForURL(/\/private\/ideas\/[0-9a-f-]{36}$/));

  const decision = `E2E isolated decision ${unique()}`;
  await page.getByLabel("What was decided about?").fill(decision);
  await page.getByLabel("Decision", { exact: true }).fill("Interview the target user");
  await page.getByLabel("Why").fill("Validate the refined idea");
  await page.getByRole("button", { name: "Record decision" }).click();
  await expect(page.getByText("Decision recorded privately.")).toBeVisible();
  await ready(page, page.goto("/private/decisions"));
  await expect(page.getByText(decision)).toBeVisible();
  await expect(page.locator("article", { hasText: decision }).getByRole("link", { name: `Idea: ${firstTitle} refined` })).toBeVisible();

  await ready(page, page.goto("/private/ideas"));
  await page.getByRole("link", { name: secondTitle }).click();
  await ready(page, page.waitForURL(/\/private\/ideas\/[0-9a-f-]{36}$/));
  await expect(page.getByText(decision)).not.toBeVisible();
});

test("an idea converts into a private project with an isolated decision log", async ({ page, browser }) => {
  const ideaTitle = `E2E project idea ${unique()}`;
  await captureIdea(page, ideaTitle);
  await page.getByRole("link", { name: ideaTitle }).click();
  await ready(page, page.waitForURL(/\/private\/ideas\/[0-9a-f-]{36}$/));
  const ideaUrl = page.url();
  await page.getByRole("button", { name: "Turn into project" }).click();
  await ready(page, page.waitForURL(/\/private\/projects\/[0-9a-f-]{36}$/));
  await expect(page.getByRole("heading", { level: 1, name: ideaTitle })).toBeVisible();
  await expect(page.locator("dl").getByText("Planning", { exact: true })).toBeVisible();

  // The converted idea now links to its project instead of offering a second conversion.
  const convertedUrl = page.url();
  await ready(page, page.goto(ideaUrl));
  await expect(page.getByRole("button", { name: "Turn into project" })).toHaveCount(0);
  await page.getByRole("link", { name: ideaTitle, exact: true }).click();
  await ready(page, page.waitForURL(convertedUrl));

  await page.getByLabel("Name", { exact: true }).fill(`${ideaTitle} edited`);
  await page.getByLabel("Description", { exact: true }).fill("A project description that survives reload");
  await page.getByRole("button", { name: "Save project" }).click();
  await expect(page.getByText("Project updated.")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: `${ideaTitle} edited` })).toBeVisible();

  await page.locator('select[name="lifecycle"]').selectOption("BETA");
  await page.locator('select[name="operationalStatus"]').selectOption("WAITING_REVIEW");
  await page.locator('input[name="waitingReason"]').fill("Review the beta onboarding flow");
  await page.locator('input[name="waitingSince"]').fill("2026-09-24");
  await page.getByRole("button", { name: "Save status" }).click();
  await expect(page.getByText("Status saved.")).toBeVisible();

  const projectUrl = page.url();
  await ready(page, page.reload());
  await expect(page.getByRole("heading", { level: 1, name: `${ideaTitle} edited` })).toBeVisible();
  await expect(page.locator("section > p.whitespace-pre-wrap")).toHaveText("A project description that survives reload");
  // The label's accessible name includes the textarea's content, so select the textbox by field name.
  await expect(page.locator('textarea[name="description"]')).toHaveValue("A project description that survives reload");
  await expect(page.locator('select[name="lifecycle"]')).toHaveValue("BETA");
  await expect(page.locator('select[name="operationalStatus"]')).toHaveValue("WAITING_REVIEW");
  await expect(page.locator('input[name="waitingReason"]')).toHaveValue("Review the beta onboarding flow");

  const decision = `E2E project decision ${unique()}`;
  await page.getByLabel("What was decided about?").fill(decision);
  await page.getByLabel("Decision", { exact: true }).fill("Ship the smallest useful version");
  await page.getByLabel("Why").fill("Keep the first release focused");
  await page.getByRole("button", { name: "Record decision" }).click();
  await expect(page.getByText("Decision recorded privately.")).toBeVisible();
  await expect(page.getByText(decision)).toBeVisible();

  await ready(page, page.goto("/private/ideas"));
  const secondIdeaTitle = `E2E second project ${unique()}`;
  await captureIdea(page, secondIdeaTitle);
  await page.getByRole("link", { name: secondIdeaTitle }).click();
  await ready(page, page.waitForURL(/\/private\/ideas\/[0-9a-f-]{36}$/));
  await page.getByRole("button", { name: "Turn into project" }).click();
  await ready(page, page.waitForURL(/\/private\/projects\/[0-9a-f-]{36}$/));
  await expect(page.getByText(decision)).not.toBeVisible();

  const anonymous = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const stranger = await anonymous.newPage();
  await stranger.goto(projectUrl);
  await expect(stranger).toHaveURL(/\/login(?:\?.*)?$/);
  await anonymous.close();
});

test("owner A cannot read or change owner B's project or add a decision to it", async ({ page }) => {
  const other = await seedOtherOwnerProject();
  const before = await projectSnapshot(other.projectId);
  expect(before.project).toHaveLength(1);
  expect(before.decisions).toHaveLength(1);

  await ready(page, page.goto(`/private/projects/${other.projectId}`));
  await expect(page.getByText(other.name)).toHaveCount(0);
  await expect(page.getByText(other.description)).toHaveCount(0);
  await expect(page.getByText(other.decision)).toHaveCount(0);
  await expect(page.locator('input[name="projectId"]')).toHaveCount(0);
  await ready(page, page.goto("/private/projects"));
  await expect(page.getByText(other.name)).toHaveCount(0);
  await ready(page, page.goto("/private/decisions"));
  await expect(page.getByText(other.decision)).toHaveCount(0);

  // A tampered client: every server action sent from A's own project page is rewritten to target B's project.
  const ownProjectId = await createOwnProject(page, `E2E owner A project ${unique()}`);
  const ownBefore = await projectSnapshot(ownProjectId);
  const retargeted = await retargetServerActions(page, ownProjectId, other.projectId);

  const editForm = page.locator("form", { has: page.getByRole("button", { name: "Save project" }) });
  await page.getByLabel("Name", { exact: true }).fill("Hijacked by owner A");
  await page.getByLabel("Description", { exact: true }).fill("Owner A overwrote this");
  await page.getByRole("button", { name: "Save project" }).click();
  await expect(editForm.getByRole("alert")).toHaveText("Project not found. Changes were not saved.");

  const statusForm = page.locator("form", { has: page.getByRole("button", { name: "Save status" }) });
  await page.locator('select[name="lifecycle"]').selectOption("ARCHIVED");
  await page.locator('select[name="operationalStatus"]').selectOption("BLOCKED");
  await page.locator('input[name="nextAction"]').fill("Owner A took over");
  await page.getByRole("button", { name: "Save status" }).click();
  await expect(statusForm.getByRole("alert")).toHaveText("Project not found. Changes were not saved.");

  const decisionForm = page.locator("form", { has: page.getByRole("button", { name: "Record decision" }) });
  const injected = `E2E cross-owner decision ${unique()}`;
  await page.getByLabel("What was decided about?").fill(injected);
  await page.getByLabel("Decision", { exact: true }).fill("Write into owner B's log");
  await page.getByLabel("Why").fill("Cross-owner attempt");
  await page.getByRole("button", { name: "Record decision" }).click();
  await expect(decisionForm.getByRole("alert")).toHaveText("Project not found. The decision was not saved.");

  expect(retargeted.count).toBe(3);
  await page.unroute("**/*");
  expect(await projectSnapshot(other.projectId)).toEqual(before);
  expect(await projectSnapshot(ownProjectId)).toEqual(ownBefore);
  const injectedRows = await withE2eDb((sql) => sql`SELECT id FROM decision_log WHERE title = ${injected}`);
  expect(injectedRows).toHaveLength(0);
});

test("anonymous project mutations are rejected and leave rows unchanged", async ({ page }) => {
  const ownProjectId = await createOwnProject(page, `E2E anonymous target ${unique()}`);
  const before = await projectSnapshot(ownProjectId);

  const content = await captureServerAction(page, async () => {
    await page.getByLabel("Name", { exact: true }).fill("Renamed anonymously");
    await page.getByRole("button", { name: "Save project" }).click();
  });
  const status = await captureServerAction(page, async () => {
    await page.locator('select[name="lifecycle"]').selectOption("ARCHIVED");
    await page.getByRole("button", { name: "Save status" }).click();
  });
  const anonymousDecision = `E2E anonymous decision ${unique()}`;
  const decision = await captureServerAction(page, async () => {
    await page.getByLabel("What was decided about?").fill(anonymousDecision);
    await page.getByLabel("Decision", { exact: true }).fill("Anonymous write");
    await page.getByLabel("Why").fill("No session");
    await page.getByRole("button", { name: "Record decision" }).click();
  });

  const anonymousName = `E2E anonymous create ${unique()}`;
  await ready(page, page.goto("/private/projects"));
  const create = await captureServerAction(page, async () => {
    await page.locator('input[name="name"]').fill(anonymousName);
    await page.locator('input[name="slug"]').fill(`anonymous-${unique()}`);
    await page.getByRole("button", { name: "+ Create project" }).click();
  });

  for (const action of [content, status, decision, create]) {
    const result = await replayAnonymously(action);
    expect(result.status).toBe(200);
    expect(result.body).toContain("Sign in again");
    expect(result.body).not.toContain('"ok":true');
  }

  expect(await projectSnapshot(ownProjectId)).toEqual(before);
  const leaked = await withE2eDb(async (sql) => ({
    projects: [...(await sql`SELECT id FROM project WHERE name = ${anonymousName}`)],
    decisions: [...(await sql`SELECT id FROM decision_log WHERE title = ${anonymousDecision}`)],
  }));
  expect(leaked.projects).toHaveLength(0);
  expect(leaked.decisions).toHaveLength(0);
});

test("a problem becomes a linked idea that records decisions", async ({ page, browser }) => {
  const title = `E2E problem ${unique()}`;
  await ready(page, page.goto("/private/problems"));
  await page.getByLabel("Problem", { exact: true }).fill(title);
  await page.getByLabel("Who experiences it and why does it matter?").fill("Founders lose context between tools");
  await page.getByRole("button", { name: "Capture problem" }).click();
  await expect(page.getByText("Problem saved privately.")).toBeVisible();
  await page.locator("article", { hasText: title }).getByRole("button", { name: "Turn into idea" }).click();
  await ready(page, page.waitForURL(/\/private\/ideas\/[0-9a-f-]{36}$/));
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await expect(page.getByText("From problem:")).toBeVisible();
  const ideaUrl = page.url();

  const decision = `E2E decision ${unique()}`;
  await page.getByLabel("What was decided about?").fill(decision);
  await page.getByLabel("Decision", { exact: true }).fill("Interview five founders first");
  await page.getByLabel("Why").fill("Cheapest way to validate the problem");
  await page.getByRole("button", { name: "Record decision" }).click();
  await expect(page.getByText("Decision recorded privately.")).toBeVisible();
  await ready(page, page.goto("/private/decisions"));
  await expect(page.getByText(decision)).toBeVisible();

  const anonymous = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const stranger = await anonymous.newPage();
  await stranger.goto(ideaUrl);
  await expect(stranger).toHaveURL(/\/login(?:\?.*)?$/);
  await anonymous.close();
});

test("Finance records private income and expenses with project context", async ({ page, browser }) => {
  const projectName = `E2E finance project ${unique()}`;
  // Unique sources keep the ledger assertions exact when the spec is repeated against the same database.
  const expenseSource = `Cloud provider ${unique()}`;
  const incomeSource = `Customer ${unique()}`;
  await ready(page, page.goto("/private/projects"));
  await page.locator('input[name="name"]').fill(projectName);
  await page.locator('input[name="slug"]').fill(`finance-${unique()}`);
  await page.getByRole("button", { name: "+ Create project" }).click();
  await expect(page.getByText("Project created privately.")).toBeVisible();

  await ready(page, page.goto("/private/finance"));
  await expect(page.locator('select[name="projectId"] option', { hasText: projectName })).toHaveCount(1);
  await page.locator('input[name="amount"]').fill("12.3400");
  await page.locator('input[name="category"]').fill("Hosting");
  await page.locator('input[name="source"]').fill(expenseSource);
  await page.locator('input[name="occurredAt"]').fill("2026-09-24T12:00");
  await page.locator('select[name="projectId"]').selectOption({ label: projectName });
  await page.getByRole("button", { name: "Record transaction" }).click();
  await expect(page.getByText("Transaction recorded privately.")).toBeVisible();

  await page.locator('select[name="type"]').selectOption("INCOME");
  await page.locator('input[name="amount"]').fill("99.9900");
  await page.locator('input[name="category"]').fill("First sale");
  await page.locator('input[name="source"]').fill(incomeSource);
  await page.locator('input[name="occurredAt"]').fill("2026-09-25T09:30");
  await page.locator('select[name="projectId"]').selectOption("");
  await page.getByRole("button", { name: "Record transaction" }).click();
  await expect(page.getByText("Transaction recorded privately.")).toBeVisible();

  await expect(page.locator("article", { hasText: expenseSource })).toContainText("12.34 USD");
  await expect(page.locator("article", { hasText: incomeSource })).toContainText("99.99 USD");
  await expect(page.getByRole("region", { name: "Totals by currency" })).toContainText("USD");
  await expect(page.locator("article", { hasText: expenseSource }).getByText(`Project: ${projectName}`)).toBeVisible();

  const anonymous = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const stranger = await anonymous.newPage();
  await stranger.goto("/private/finance");
  await expect(stranger).toHaveURL(/\/login(?:\?.*)?$/);
  await expect(stranger.locator('input[name="amount"]')).toHaveCount(0);
  await anonymous.close();
});

test("closed registration rejects other accounts and a second owner", async ({ playwright }) => {
  const api = await playwright.request.newContext({ baseURL: e2eBaseUrl });
  for (const email of ["intruder@e2e.test", e2eOwner.email]) {
    const response = await api.post("/api/auth/sign-up/email", {
      headers: { "x-founder-setup-token": e2eSetupToken, origin: e2eBaseUrl },
      data: { email, password: "another-password-0123", name: "Someone else" },
    });
    expect(response.ok()).toBe(false);
  }
  const intruder = await api.post("/api/auth/sign-in/email", {
    headers: { origin: e2eBaseUrl },
    data: { email: "intruder@e2e.test", password: "another-password-0123" },
  });
  expect(intruder.ok()).toBe(false);
  await api.dispose();
});

test("private pages run under the nonce policy without CSP violations", async ({ page }) => {
  const violations: string[] = [];
  page.on("console", (message) => { if (/Content Security Policy/i.test(message.text())) violations.push(message.text()); });
  for (const path of ["/private/ideas", "/private/problems", "/private/research", "/private/decisions", "/private/projects", "/private/finance"]) {
    const response = await page.goto(path);
    await page.waitForLoadState("networkidle");
    expect(response?.headers()["content-security-policy"]).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/);
  }
  // Scripts ran: the capture form is interactive after hydration.
  await captureIdea(page, `E2E CSP idea ${unique()}`);
  expect(violations).toEqual([]);
});
