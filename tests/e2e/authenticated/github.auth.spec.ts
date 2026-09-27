// ADR-019 / T-077: GitHub integration end to end, against the local stub API (tests/e2e/github-stub.mjs), never
// the real GitHub. Serial: the daily cron syncs every owner's linked project in one batch (least-recently-synced
// first, stopping early on a rate limit), so this file's tests must not race each other over that shared batch.
import { expect, test } from "@playwright/test";
import { e2eCronSecret, e2eOwner } from "../e2e-env";
import { captureServerAction, ready, replayAnonymously, retargetServerActions, unique, withE2eDb } from "./helpers";

test.describe.configure({ mode: "serial" });

// The stub embeds this in fields the app never stores (description, PR titles, release body, error bodies).
const STUB_SECRET = "SECRET-github-stub-must-never-leak-83f2ac";

const ownerA = () => withE2eDb(async (sql) => {
  const [row] = await sql<{ id: string }[]>`SELECT id FROM "user" WHERE email = ${e2eOwner.email}`;
  if (!row) throw new Error("The E2E owner does not exist.");
  return row.id;
});

async function seedOwnerProject(repository: string | null, slug: string) {
  const id = unique();
  const name = `E2E github ${slug} project ${id}`;
  return withE2eDb(async (sql) => {
    const [project] = await sql<{ id: string }[]>`INSERT INTO project (owner_id, name, slug, description, repository, visibility)
      VALUES (${await ownerA()}, ${name}, ${`e2e-github-${slug}-${id}`}, 'Seeded for T-077', ${repository}, 'PRIVATE') RETURNING id`;
    if (!project) throw new Error("Could not seed the project.");
    return { id: project.id, name };
  });
}

// Owner B's project already has a synced snapshot, so a scoping bug would show it straight away, with no refresh.
async function seedOtherOwnerGithub() {
  const id = unique();
  const ownerId = `e2e-owner-b-${id}`;
  const repoFullName = `ownerb-e2e/secret-repo-${id}`;
  const name = `Owner B github project ${id}`;
  return withE2eDb(async (sql) => {
    await sql`INSERT INTO "user" (id, name, email) VALUES (${ownerId}, 'E2E Owner B', ${`owner-b-${id}@e2e.test`})`;
    const [project] = await sql<{ id: string }[]>`INSERT INTO project (owner_id, name, slug, description, repository, visibility)
      VALUES (${ownerId}, ${name}, ${`owner-b-github-${id}`}, 'Owner B only', ${`https://github.com/${repoFullName}`}, 'PRIVATE') RETURNING id`;
    if (!project) throw new Error("Could not seed owner B's project.");
    await sql`INSERT INTO project_github (project_id, owner_id, repo_full_name, default_branch, last_push_at, open_issues, open_pull_requests, latest_release_tag, latest_release_at, synced_at)
      VALUES (${project.id}, ${ownerId}, ${repoFullName}, 'main', now(), 3, 1, 'v9.9.9', now(), now())`;
    return { ownerId, projectId: project.id, name, repoFullName };
  });
}

test("refresh shows the snapshot from the stub, and its body never reaches the page", async ({ page }) => {
  const project = await seedOwnerProject("https://github.com/e2e/ok", "ok");
  await ready(page, page.goto(`/private/projects/${project.id}`));
  const panel = page.getByRole("region", { name: "GitHub" });
  await expect(panel.getByRole("link", { name: "e2e/ok" })).toHaveAttribute("href", "https://github.com/e2e/ok");
  await expect(panel.getByText("Not synced yet.")).toBeVisible();

  await ready(page, panel.getByRole("button", { name: "Refresh from GitHub" }).click());
  await expect(panel.getByRole("status")).toHaveText("Refreshed from GitHub.");

  await expect(panel.locator("dl > div", { hasText: "Last push" }).locator("time")).toHaveText("2024-01-15");
  await expect(panel.locator("dl > div", { hasText: "Open issues" }).locator("dd")).toHaveText("5"); // 9 total − 4 open PRs
  await expect(panel.locator("dl > div", { hasText: "Open pull requests" }).locator("dd")).toHaveText("4");
  await expect(panel.locator("dl > div", { hasText: "Latest release" }).locator("dd")).toContainText("v2.0.0");

  expect(await withE2eDb((sql) => sql`SELECT repo_full_name, open_issues, open_pull_requests, latest_release_tag, sync_error FROM project_github WHERE project_id = ${project.id}`).then((rows) => [...rows]))
    .toEqual([{ repo_full_name: "e2e/ok", open_issues: 5, open_pull_requests: 4, latest_release_tag: "v2.0.0", sync_error: null }]);
  expect(await page.content()).not.toContain(STUB_SECRET);
});

test("a missing or rate-limited repository shows an error, never the stub's body", async ({ page }) => {
  const missing = await seedOwnerProject("https://github.com/e2e/missing", "missing");
  await ready(page, page.goto(`/private/projects/${missing.id}`));
  await ready(page, page.getByRole("button", { name: "Refresh from GitHub" }).click());
  await expect(page.getByText("GitHub could not find that repository, or the token cannot see it.")).toBeVisible();
  expect(await page.content()).not.toContain(STUB_SECRET);

  const limited = await seedOwnerProject("https://github.com/e2e/limited", "limited");
  await ready(page, page.goto(`/private/projects/${limited.id}`));
  await ready(page, page.getByRole("button", { name: "Refresh from GitHub" }).click());
  await expect(page.getByText("GitHub's rate limit was reached. Try again later.")).toBeVisible();
  expect(await page.content()).not.toContain(STUB_SECRET);
});

test("a non-GitHub repository URL only shows the linking hint, with no refresh button", async ({ page }) => {
  const project = await seedOwnerProject("https://gitlab.com/e2e/not-github", "gitlab");
  await ready(page, page.goto(`/private/projects/${project.id}`));
  await expect(page.getByText("Set the repository to a", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Refresh from GitHub" })).toHaveCount(0);
});

test("owner B's GitHub snapshot never reaches owner A, and retargeting the refresh action fails", async ({ page }) => {
  const own = await seedOwnerProject("https://github.com/e2e/ok", "cross-owner");
  const other = await seedOtherOwnerGithub();
  const before = await withE2eDb((sql) => sql`SELECT * FROM project_github WHERE project_id = ${other.projectId}`).then((rows) => [...rows]);

  await ready(page, page.goto("/private/projects"));
  await expect(page.getByText(other.repoFullName)).toHaveCount(0);
  await expect(page.getByText(other.name)).toHaveCount(0);
  await ready(page, page.goto(`/private/projects/${other.projectId}`));
  await expect(page.getByRole("heading", { name: "Nothing here." })).toBeVisible();

  await ready(page, page.goto(`/private/projects/${own.id}`));
  const retargeted = await retargetServerActions(page, own.id, other.projectId);
  await page.getByRole("button", { name: "Refresh from GitHub" }).click();
  await expect(page.getByText("Project not found.", { exact: true })).toBeVisible();
  expect(retargeted.count).toBe(1);
  await page.unroute("**/*");

  expect(await withE2eDb((sql) => sql`SELECT sync_error FROM project_github WHERE project_id = ${own.id}`).then((rows) => [...rows])).toEqual([]);
  expect(await withE2eDb((sql) => sql`SELECT * FROM project_github WHERE project_id = ${other.projectId}`).then((rows) => [...rows])).toEqual(before);
});

test("an anonymous replay of the refresh action is rejected", async ({ page }) => {
  const project = await seedOwnerProject("https://github.com/e2e/ok", "anonymous");
  await ready(page, page.goto(`/private/projects/${project.id}`));
  const refresh = await captureServerAction(page, () => page.getByRole("button", { name: "Refresh from GitHub" }).click());
  const result = await replayAnonymously(refresh);
  expect(result.status).toBe(200);
  expect(result.body).toContain("Sign in again to refresh.");
  expect(result.body).not.toContain('"ok":true');
  expect(await withE2eDb((sql) => sql`SELECT * FROM project_github WHERE project_id = ${project.id}`).then((rows) => [...rows])).toHaveLength(0);
});

test("the cron route requires the secret, returns counts only, and quiet repositories show on the home", async ({ page }) => {
  const missingAuth = await page.request.get("/api/cron/github");
  expect(missingAuth.status()).toBe(401);

  const wrongAuth = await page.request.get("/api/cron/github", { headers: { authorization: "Bearer wrong-cron-secret-not-real-0123456789" } });
  expect(wrongAuth.status()).toBe(401);

  const quiet = await seedOwnerProject("https://github.com/e2e/quiet", "quiet");
  const ok = await page.request.get("/api/cron/github", { headers: { authorization: `Bearer ${e2eCronSecret}` } });
  expect(ok.status()).toBe(200);
  const text = await ok.text();
  const body = JSON.parse(text) as Record<string, unknown>;
  expect(Object.keys(body).sort()).toEqual(["failed", "skipped", "synced", "unlinked"]);
  expect(Object.values(body).every((value) => typeof value === "number")).toBe(true);
  expect(text).not.toContain(STUB_SECRET);
  expect(text).not.toContain(quiet.name);
  expect(text).not.toContain("e2e/quiet");

  await ready(page, page.goto("/private"));
  const quietSection = page.getByRole("region", { name: "Quiet repositories" });
  await expect(quietSection.getByRole("link", { name: quiet.name })).toHaveAttribute("href", `/private/projects/${quiet.id}`);
  await expect(quietSection.getByText("e2e/quiet")).toBeVisible();
});

test("the public /portfolio page never mentions a repository", async ({ page }) => {
  const project = await seedOwnerProject("https://github.com/e2e/ok", "public-check");
  const other = await seedOtherOwnerGithub();
  const response = await page.request.get("/portfolio");
  const text = await response.text();
  expect(text).not.toContain("e2e/ok");
  expect(text).not.toContain(other.repoFullName);
  expect(text).not.toContain(project.name);
  expect(text).not.toContain(STUB_SECRET);
});
