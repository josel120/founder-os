import { expect, test, type Locator, type Page } from "@playwright/test";
import { captureIdea, captureServerAction, ready, replayAnonymously, retargetServerActions, unique, withE2eDb } from "./helpers";

type Evidence = { title: string; kind: string; signal: string; about?: string; sourceUrl?: string };

async function captureProblem(page: Page, title: string) {
  await ready(page, page.goto("/private/problems"));
  await page.getByLabel("Problem", { exact: true }).fill(title);
  await page.getByLabel("Who experiences it and why does it matter?").fill(`Why ${title} matters`);
  await page.getByRole("button", { name: "Capture problem" }).click();
  await expect(page.getByText("Problem saved privately.")).toBeVisible();
}

// Fills the capture form without asserting the outcome, so callers can check success or the error shown.
async function submitEvidence(form: Locator, evidence: Evidence) {
  if (evidence.about) await form.getByLabel("About").selectOption({ label: evidence.about });
  await form.getByLabel("Evidence title").fill(evidence.title);
  await form.getByLabel("What did you learn?").fill(`${evidence.title}: what the research showed`);
  await form.getByLabel("Kind").selectOption(evidence.kind);
  await form.getByLabel("Signal").selectOption(evidence.signal);
  await form.getByLabel("Source link (optional)").fill(evidence.sourceUrl ?? "");
  await form.getByRole("button", { name: "Save evidence" }).click();
}

async function recordEvidence(page: Page, evidence: Evidence) {
  await submitEvidence(page.locator("#capture-evidence"), evidence);
  await expect(page.getByText("Evidence saved privately.")).toBeVisible();
}

const idOf = (table: "idea" | "problem" | "evidence", title: string) => withE2eDb(async (sql) => {
  const [row] = await sql<{ id: string }[]>`SELECT id FROM ${sql(table)} WHERE title = ${title}`;
  if (!row) throw new Error(`No ${table} titled ${title}`);
  return row.id;
});
const evidenceTitled = (title: string) => withE2eDb((sql) => sql`SELECT * FROM evidence WHERE title = ${title}`).then((rows) => [...rows]);

// Owner B exists only as rows in the disposable database; closed signup means B can never sign in.
async function seedOtherOwnerResearch() {
  const id = unique();
  const ownerId = `e2e-owner-b-${id}`;
  const seeded = { problemTitle: `Owner B problem ${id}`, ideaTitle: `Owner B idea ${id}`, evidenceTitle: `Owner B evidence ${id}` };
  return withE2eDb(async (sql) => {
    await sql`INSERT INTO "user" (id, name, email) VALUES (${ownerId}, 'E2E Owner B', ${`owner-b-${id}@e2e.test`})`;
    const [problem] = await sql<{ id: string }[]>`INSERT INTO problem (owner_id, title, description, visibility) VALUES (${ownerId}, ${seeded.problemTitle}, 'Owner B only', 'PRIVATE') RETURNING id`;
    const [idea] = await sql<{ id: string }[]>`INSERT INTO idea (owner_id, title, description, visibility) VALUES (${ownerId}, ${seeded.ideaTitle}, 'Owner B only', 'PRIVATE') RETURNING id`;
    if (!problem || !idea) throw new Error("Could not seed owner B's problem and idea.");
    const [evidence] = await sql<{ id: string }[]>`INSERT INTO evidence (owner_id, idea_id, title, summary, kind, signal, visibility) VALUES (${ownerId}, ${idea.id}, ${seeded.evidenceTitle}, 'Owner B private summary', 'INTERVIEW', 'SUPPORTS', 'PRIVATE') RETURNING id`;
    if (!evidence) throw new Error("Could not seed owner B's evidence.");
    return { ...seeded, ownerId, problemId: problem.id, ideaId: idea.id, evidenceId: evidence.id };
  });
}

const ownerSnapshot = (ownerId: string) => withE2eDb(async (sql) => ({
  evidence: [...(await sql`SELECT * FROM evidence WHERE owner_id = ${ownerId} ORDER BY id`)],
  ideas: [...(await sql`SELECT * FROM idea WHERE owner_id = ${ownerId} ORDER BY id`)],
  problems: [...(await sql`SELECT * FROM problem WHERE owner_id = ${ownerId} ORDER BY id`)],
}));

test("evidence is captured on ideas and problems, edited, filtered and shown on the idea", async ({ page }) => {
  const id = unique();
  const problemTitle = `E2E research problem ${id}`;
  const ideaTitle = `E2E research idea ${id}`;
  const supports = `E2E supports ${id}`;
  const contradicts = `E2E contradicts ${id}`;
  await captureProblem(page, problemTitle);
  await captureIdea(page, ideaTitle);

  await ready(page, page.goto("/private/research"));
  await recordEvidence(page, { about: ideaTitle, title: supports, kind: "INTERVIEW", signal: "SUPPORTS", sourceUrl: "https://example.com/research" });
  await recordEvidence(page, { about: problemTitle, title: contradicts, kind: "COMPETITOR", signal: "CONTRADICTS" });
  const [ideaId, problemId] = await Promise.all([idOf("idea", ideaTitle), idOf("problem", problemTitle)]);
  expect(await evidenceTitled(supports)).toEqual([expect.objectContaining({ idea_id: ideaId, problem_id: null, kind: "INTERVIEW", signal: "SUPPORTS", visibility: "PRIVATE" })]);
  expect(await evidenceTitled(contradicts)).toEqual([expect.objectContaining({ idea_id: null, problem_id: problemId, kind: "COMPETITOR", signal: "CONTRADICTS", source_url: null })]);

  // The list updates in place after each save, without a reload (T-061).
  const supportsCard = page.locator("article", { hasText: supports });
  await expect(supportsCard.getByRole("link", { name: `Idea: ${ideaTitle}` })).toBeVisible();
  const source = supportsCard.getByRole("link", { name: "Source" });
  await expect(source).toHaveAttribute("href", "https://example.com/research");
  await expect(source).toHaveAttribute("rel", "noopener noreferrer nofollow");
  await expect(source).toHaveAttribute("target", "_blank");
  await expect(page.locator("article", { hasText: contradicts }).getByRole("link", { name: `Problem: ${problemTitle}` })).toBeVisible();

  const filters = page.getByRole("form", { name: "Filter evidence" });
  await filters.getByLabel("Signal").selectOption("CONTRADICTS");
  await filters.getByRole("button", { name: "Filter" }).click();
  await ready(page, page.waitForURL(/signal=CONTRADICTS/));
  await expect(page.locator("article", { hasText: contradicts })).toBeVisible();
  await expect(page.locator("article", { hasText: supports })).toHaveCount(0);
  await ready(page, page.getByRole("link", { name: "Clear filters" }).click());
  await expect(page.locator("article", { hasText: supports })).toBeVisible();

  await supportsCard.getByText("Edit", { exact: true }).click();
  await supportsCard.getByLabel("Evidence title").fill(`${supports} edited`);
  await supportsCard.getByLabel("Signal").selectOption("NEUTRAL");
  await supportsCard.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Evidence updated.")).toBeVisible();
  expect(await evidenceTitled(`${supports} edited`)).toEqual([expect.objectContaining({ idea_id: ideaId, signal: "NEUTRAL", kind: "INTERVIEW" })]);

  await ready(page, page.goto(`/private/ideas/${ideaId}`));
  const evidenceSection = page.getByRole("region", { name: "Evidence" });
  await expect(evidenceSection.getByText(`${supports} edited`)).toBeVisible();
  await expect(evidenceSection.getByText("0 supports")).toBeVisible();
  await expect(evidenceSection.getByText(contradicts)).toHaveCount(0);
  const fromIdeaPage = `E2E from the idea page ${id}`;
  await recordEvidence(page, { title: fromIdeaPage, kind: "MARKET", signal: "SUPPORTS" });
  await expect(evidenceSection.getByText("1 supports")).toBeVisible();
  expect(await evidenceTitled(fromIdeaPage)).toEqual([expect.objectContaining({ idea_id: ideaId, kind: "MARKET" })]);
});

test("a javascript: source link is rejected and nothing is saved", async ({ page }) => {
  const ideaTitle = `E2E unsafe link idea ${unique()}`;
  const title = `E2E unsafe link ${unique()}`;
  await captureIdea(page, ideaTitle);
  await ready(page, page.goto("/private/research"));
  const form = page.locator("#capture-evidence");
  await submitEvidence(form, { about: ideaTitle, title, kind: "SOURCE", signal: "NEUTRAL", sourceUrl: "javascript:alert(1)" });
  await expect(form.getByRole("alert")).toHaveText("Use a full http or https link, like https://example.com");
  expect(await evidenceTitled(title)).toHaveLength(0);
});

test("owner A cannot read, edit or attach evidence to owner B's records", async ({ page }) => {
  const other = await seedOtherOwnerResearch();
  const before = await ownerSnapshot(other.ownerId);
  expect(before.evidence).toHaveLength(1);

  await ready(page, page.goto("/private/research"));
  await expect(page.getByText(other.evidenceTitle)).toHaveCount(0);
  await expect(page.locator('select[name="parent"] option', { hasText: other.ideaTitle })).toHaveCount(0);
  await expect(page.locator('select[name="parent"] option', { hasText: other.problemTitle })).toHaveCount(0);
  await ready(page, page.goto(`/private/ideas/${other.ideaId}`));
  await expect(page.getByText(other.evidenceTitle)).toHaveCount(0);
  await expect(page.locator(`input[name="parent"][value="idea:${other.ideaId}"]`)).toHaveCount(0);

  // A tampered client: A's own parent and evidence IDs are rewritten to B's inside the server action body.
  const id = unique();
  const ownIdeaTitle = `E2E owner A idea ${id}`;
  const ownProblemTitle = `E2E owner A problem ${id}`;
  await captureIdea(page, ownIdeaTitle);
  await captureProblem(page, ownProblemTitle);
  const [ownIdeaId, ownProblemId] = await Promise.all([idOf("idea", ownIdeaTitle), idOf("problem", ownProblemTitle)]);
  const form = page.locator("#capture-evidence");

  await ready(page, page.goto("/private/research"));
  let retargeted = await retargetServerActions(page, ownIdeaId, other.ideaId);
  await submitEvidence(form, { about: ownIdeaTitle, title: `E2E injected on B's idea ${id}`, kind: "NOTE", signal: "SUPPORTS" });
  await expect(form.getByRole("alert")).toHaveText("Idea not found. The evidence was not saved.");
  expect(retargeted.count).toBe(1);
  await page.unroute("**/*");

  retargeted = await retargetServerActions(page, ownProblemId, other.problemId);
  await submitEvidence(form, { about: ownProblemTitle, title: `E2E injected on B's problem ${id}`, kind: "NOTE", signal: "SUPPORTS" });
  await expect(form.getByRole("alert")).toHaveText("Problem not found. The evidence was not saved.");
  expect(retargeted.count).toBe(1);
  await page.unroute("**/*");

  const ownEvidence = `E2E owner A evidence ${id}`;
  await ready(page, page.goto("/private/research"));
  await recordEvidence(page, { about: ownIdeaTitle, title: ownEvidence, kind: "NOTE", signal: "NEUTRAL" });
  const ownEvidenceId = await idOf("evidence", ownEvidence);
  const card = page.locator("article", { hasText: ownEvidence });
  await card.getByText("Edit", { exact: true }).click();
  retargeted = await retargetServerActions(page, ownEvidenceId, other.evidenceId);
  await card.getByLabel("Evidence title").fill("Hijacked by owner A");
  await card.getByRole("button", { name: "Save changes" }).click();
  await expect(card.getByRole("alert")).toHaveText("Evidence not found. Changes were not saved.");
  expect(retargeted.count).toBe(1);
  await page.unroute("**/*");

  expect(await ownerSnapshot(other.ownerId)).toEqual(before);
  expect(await evidenceTitled(`E2E injected on B's idea ${id}`)).toHaveLength(0);
  expect(await evidenceTitled(`E2E injected on B's problem ${id}`)).toHaveLength(0);
  expect(await evidenceTitled("Hijacked by owner A")).toHaveLength(0);
});

test("anonymous evidence mutations are rejected and leave rows unchanged", async ({ page }) => {
  const id = unique();
  const ideaTitle = `E2E anonymous research idea ${id}`;
  const existing = `E2E existing evidence ${id}`;
  await captureIdea(page, ideaTitle);
  await ready(page, page.goto("/private/research"));
  await recordEvidence(page, { about: ideaTitle, title: existing, kind: "NOTE", signal: "NEUTRAL" });
  const before = await evidenceTitled(existing);

  const anonymousTitle = `E2E anonymous evidence ${id}`;
  const create = await captureServerAction(page, () => submitEvidence(page.locator("#capture-evidence"), { about: ideaTitle, title: anonymousTitle, kind: "NOTE", signal: "SUPPORTS" }));
  const card = page.locator("article", { hasText: existing });
  await card.getByText("Edit", { exact: true }).click();
  const update = await captureServerAction(page, async () => {
    await card.getByLabel("Evidence title").fill("Renamed anonymously");
    await card.getByRole("button", { name: "Save changes" }).click();
  });

  for (const action of [create, update]) {
    const result = await replayAnonymously(action);
    expect(result.status).toBe(200);
    expect(result.body).toContain("unauthorized");
    expect(result.body).not.toContain('"ok":true');
  }
  expect(await evidenceTitled(anonymousTitle)).toHaveLength(0);
  expect(await evidenceTitled(existing)).toEqual(before);
  expect(await evidenceTitled("Renamed anonymously")).toHaveLength(0);
});
