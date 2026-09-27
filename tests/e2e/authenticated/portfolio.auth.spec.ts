import { expect, request as apiRequest, test, type Page } from "@playwright/test";
import { e2eBaseUrl, e2eOwner } from "../e2e-env";
import { captureServerAction, ready, replayAnonymously, retargetServerActions, unique, withE2eDb } from "./helpers";

// ADR-018: only what the owner publishes is public, only allowlisted fields, and unpublishing is immediate.
// Other specs run in parallel, so assertions target this spec's unique names, never counts.

const ownerA = () => withE2eDb(async (sql) => {
  const [row] = await sql<{ id: string }[]>`SELECT id FROM "user" WHERE email = ${e2eOwner.email}`;
  if (!row) throw new Error("The E2E owner does not exist.");
  return row.id;
});

// Every private field gets a sentinel that must never appear in anything served anonymously.
async function seedProject(ownerId: string, label: string) {
  const id = unique();
  const seeded = {
    name: `${label} ${id}`, slug: `e2e-${label.toLowerCase().replaceAll(" ", "-")}-${id}`,
    secrets: [`secret-description-${id}`, `secret-next-action-${id}`, `secret-repo-${id}`, `secret-waiting-${id}`, `secret-version-${id}`, `secret-decision-${id}`, `secret-category-${id}`],
  };
  const [description, nextAction, repo, waiting, version, decision, category] = seeded.secrets;
  const projectId = await withE2eDb(async (sql) => {
    const [project] = await sql<{ id: string }[]>`INSERT INTO project (owner_id, name, slug, description, lifecycle, next_action, repository, website, waiting_reason, current_version, visibility)
      VALUES (${ownerId}, ${seeded.name}, ${seeded.slug}, ${description!}, 'RELEASED', ${nextAction!}, ${`https://${repo}.example`}, 'https://portfolio-site.example', ${waiting!}, ${version!}, 'PRIVATE') RETURNING id`;
    if (!project) throw new Error("Could not seed the project.");
    await sql`INSERT INTO decision_log (owner_id, project_id, title, decision, reason, visibility) VALUES (${ownerId}, ${project.id}, ${decision!}, 'Private', 'Private', 'PRIVATE')`;
    await sql`INSERT INTO finance_transaction (owner_id, project_id, type, category, amount, currency, source, occurred_at, visibility) VALUES (${ownerId}, ${project.id}, 'INCOME', ${category!}, '9.00', 'EUR', 'MANUAL', now(), 'PRIVATE')`;
    return project.id;
  });
  return { ...seeded, projectId };
}

// A cookieless client that sees exactly what any visitor gets, including the inline RSC payload.
async function visit(path: string) {
  const api = await apiRequest.newContext({ baseURL: e2eBaseUrl, storageState: { cookies: [], origins: [] } });
  try {
    const response = await api.get(path, { maxRedirects: 0 });
    return { status: response.status(), html: await response.text(), robots: response.headers()["x-robots-tag"] ?? "" };
  } finally {
    await api.dispose();
  }
}

function expectNoSecrets(html: string, secrets: string[]) {
  for (const secret of secrets) expect(html, `leaked ${secret}`).not.toContain(secret);
}

const panel = (page: Page) => page.getByRole("region", { name: "Public portfolio" });

async function publish(page: Page, projectId: string, { summary, visibility, update = false }: { summary: string; visibility: "Public" | "Unlisted"; update?: boolean }) {
  await ready(page, page.goto(`/private/projects/${projectId}`));
  const section = panel(page);
  await section.getByLabel("Public summary").fill(summary);
  await section.getByRole("radio", { name: new RegExp(`^${visibility}`) }).check();
  await expect(section.getByRole("article").getByRole("heading", { level: 3 })).toBeVisible(); // the preview
  await section.getByRole("button", { name: update ? "Review and update" : "Review and publish" }).click();
  await section.getByRole("button", { name: "Confirm" }).click();
  await expect(section.getByRole("status")).toHaveText(update ? "Publication updated." : "Project published.");
}

test("the owner publishes Unlisted then Public, visitors see only allowlisted fields, and making it private is immediate", async ({ page }) => {
  const project = await seedProject(await ownerA(), "Portfolio project");
  const summary = `A calm habit tracker ${unique()}`;

  await ready(page, page.goto(`/private/projects/${project.projectId}`));
  await expect(panel(page).getByText("Current state: Private")).toBeVisible();
  // The preview shows the allowlisted view before anything is public.
  await panel(page).getByLabel("Public summary").fill(summary);
  await expect(panel(page).getByText(summary, { exact: true }).last()).toBeVisible();
  expect(await visit(`/p/${project.slug}`)).toMatchObject({ status: 404 });

  await publish(page, project.projectId, { summary, visibility: "Unlisted" });
  const unlisted = await visit(`/p/${project.slug}`);
  expect(unlisted.status).toBe(200);
  expect(unlisted.html).toContain(project.name);
  expect(unlisted.html).toContain(summary);
  expect(unlisted.html).toContain("https://portfolio-site.example");
  expect(unlisted.robots).toContain("noindex");
  expectNoSecrets(unlisted.html, project.secrets);
  expect((await visit("/portfolio")).html).not.toContain(project.name);

  await publish(page, project.projectId, { summary, visibility: "Public", update: true });
  const listed = await visit("/portfolio");
  expect(listed.status).toBe(200);
  expect(listed.html).toContain(project.name);
  expect(listed.html).toContain(`/p/${project.slug}`);
  expectNoSecrets(listed.html, project.secrets);
  expectNoSecrets((await visit(`/p/${project.slug}`)).html, project.secrets);

  // The public page is also clean when opened in a real browser (client navigation, hydration payload).
  const visitor = await page.context().browser()!.newContext({ storageState: { cookies: [], origins: [] } });
  const visitorPage = await visitor.newPage();
  await ready(visitorPage, visitorPage.goto("/portfolio"));
  await visitorPage.getByRole("link", { name: project.name }).click();
  await expect(visitorPage.getByRole("heading", { level: 1, name: project.name })).toBeVisible();
  expectNoSecrets(await visitorPage.content(), project.secrets);
  await visitor.close();

  await ready(page, page.goto(`/private/projects/${project.projectId}`));
  await panel(page).getByRole("button", { name: "Make private" }).click();
  await panel(page).getByRole("button", { name: "Confirm" }).click();
  await expect(panel(page).getByRole("status")).toHaveText("Project is private again.");
  const gone = await visit(`/p/${project.slug}`);
  expect(gone.status).toBe(404);
  expect(gone.html).not.toContain(project.name);
  expect((await visit("/portfolio")).html).not.toContain(project.name);
});

test("a private or unknown slug gets the same 404, and a publication whose owner differs from the project's publishes nothing", async () => {
  const project = await seedProject(await ownerA(), "Private project");
  const otherOwner = `e2e-portfolio-b-${unique()}`;
  await withE2eDb(async (sql) => {
    await sql`INSERT INTO "user" (id, name, email) VALUES (${otherOwner}, 'E2E Owner B', ${`${otherOwner}@e2e.test`})`;
    // A forged row: owner B "publishes" owner A's project. The public join requires matching owners.
    await sql`INSERT INTO project_publication (project_id, owner_id, visibility, summary) VALUES (${project.projectId}, ${otherOwner}, 'PUBLIC', 'Forged by owner B')`;
  });
  const forged = await visit(`/p/${project.slug}`);
  const unknown = await visit(`/p/e2e-never-existed-${unique()}`);
  expect([forged.status, unknown.status]).toEqual([404, 404]);
  const title = (html: string) => /<title>([^<]*)<\/title>/.exec(html)?.[1];
  expect(title(forged.html)).toBe(title(unknown.html));
  expect(forged.html).not.toContain(project.name);
  expect((await visit("/portfolio")).html).not.toContain("Forged by owner B");
});

test("owner A cannot publish or unpublish owner B's project, and anonymous calls are refused", async ({ page }) => {
  const own = await seedProject(await ownerA(), "Owner A project");
  const otherOwner = `e2e-portfolio-b-${unique()}`;
  const other = await withE2eDb(async (sql) => {
    await sql`INSERT INTO "user" (id, name, email) VALUES (${otherOwner}, 'E2E Owner B', ${`${otherOwner}@e2e.test`})`;
    return seedProject(otherOwner, "Owner B project");
  });
  await withE2eDb((sql) => sql`INSERT INTO project_publication (project_id, owner_id, visibility, summary) VALUES (${other.projectId}, ${otherOwner}, 'UNLISTED', 'Owner B summary')`);
  const publication = () => withE2eDb(async (sql) => [...(await sql`SELECT visibility, summary FROM project_publication WHERE project_id = ${other.projectId}`)]);

  await ready(page, page.goto(`/private/projects/${own.projectId}`));
  const publishRetarget = await retargetServerActions(page, own.projectId, other.projectId);
  await panel(page).getByLabel("Public summary").fill("Hijacked by owner A");
  await panel(page).getByRole("button", { name: "Review and publish" }).click();
  await panel(page).getByRole("button", { name: "Confirm" }).click();
  await expect(panel(page).getByRole("alert")).toHaveText("Project not found. Nothing was published.");
  expect(publishRetarget.count).toBe(1);
  await page.unroute("**/*");
  expect(await publication()).toEqual([{ visibility: "UNLISTED", summary: "Owner B summary" }]);

  // Unpublishing is retargeted from A's own published project.
  await publish(page, own.projectId, { summary: "Owner A summary", visibility: "Unlisted" });
  await ready(page, page.goto(`/private/projects/${own.projectId}`));
  const unpublishRetarget = await retargetServerActions(page, own.projectId, other.projectId);
  await panel(page).getByRole("button", { name: "Make private" }).click();
  await panel(page).getByRole("button", { name: "Confirm" }).click();
  await expect(panel(page).getByRole("alert")).toHaveText("This project is not published.");
  expect(unpublishRetarget.count).toBe(1);
  await page.unroute("**/*");
  expect(await publication()).toEqual([{ visibility: "UNLISTED", summary: "Owner B summary" }]);

  await ready(page, page.goto(`/private/projects/${own.projectId}`));
  const action = await captureServerAction(page, async () => {
    await panel(page).getByRole("button", { name: "Review and update" }).click();
    await panel(page).getByRole("button", { name: "Confirm" }).click();
  });
  const replay = await replayAnonymously(action);
  expect(replay.status).toBe(200);
  expect(replay.body).toContain("Sign in again to save changes.");
  expect(replay.body).not.toContain('"ok":true');
});
