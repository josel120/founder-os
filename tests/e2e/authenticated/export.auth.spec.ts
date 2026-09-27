// ADR-022 / T-092: the owner's data export holds their own rows and nobody else's, and needs a session.
import { expect, test } from "@playwright/test";
import { e2eOwner } from "../e2e-env";
import { ready, unique, withE2eDb } from "./helpers";

type Export = { format: string; version: number; counts: Record<string, number>; data: Record<string, Record<string, unknown>[]> };

test("the export has the owner's records, never owner B's, and is not cached", async ({ page }) => {
  const id = unique();
  const { ownerA, ownIdea, otherIdea } = await withE2eDb(async (sql) => {
    const [owner] = await sql<{ id: string }[]>`SELECT id FROM "user" WHERE email = ${e2eOwner.email}`;
    const [own] = await sql<{ id: string }[]>`INSERT INTO idea (owner_id, title, description) VALUES (${owner!.id}, ${`E2E export own ${id}`}, 'mine') RETURNING id`;
    const ownerB = `e2e-owner-b-${id}`;
    await sql`INSERT INTO "user" (id, name, email) VALUES (${ownerB}, 'E2E Owner B', ${`owner-b-${id}@e2e.test`})`;
    const [other] = await sql<{ id: string }[]>`INSERT INTO idea (owner_id, title, description) VALUES (${ownerB}, ${`OWNER-B-EXPORT-SECRET-${id}`}, 'not yours') RETURNING id`;
    return { ownerA: owner!.id, ownIdea: own!.id, otherIdea: other!.id };
  });

  await ready(page, page.goto("/private"));
  await expect(page.getByRole("link", { name: "Export data" })).toHaveAttribute("href", "/private/export");

  const response = await page.request.get("/private/export");
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toBe("no-store");
  expect(response.headers()["content-disposition"]).toMatch(/^attachment; filename="founder-os-export-/);
  const text = await response.text();
  const body = JSON.parse(text) as Export;
  expect(body.format).toBe("founder-os-export");
  expect(body.data.ideas!.map((idea) => idea.id)).toContain(ownIdea);
  expect(body.data.ideas!.every((idea) => idea.ownerId === ownerA)).toBe(true);
  expect(text).not.toContain(otherIdea);
  expect(text).not.toContain(`OWNER-B-EXPORT-SECRET-${id}`);
  for (const secret of ["\"password\"", "\"accessToken\"", "\"refreshToken\"", "\"ipAddress\"", "\"sessions\""]) expect(text).not.toContain(secret);
});

test("without a session the export redirects to sign in", async ({ browser }) => {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  try {
    const response = await context.request.get("/private/export", { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    expect(response.headers()["location"]).toContain("/login?next=%2Fprivate%2Fexport");
  } finally {
    await context.close();
  }
});
