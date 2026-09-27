import { expect, test } from "@playwright/test";

// Anonymous: the portfolio is public, stays out of search engines and never redirects to sign-in (ADR-018).
test("the portfolio is public and noindex, and an unknown project is a plain 404", async ({ request }) => {
  const portfolio = await request.get("/portfolio", { maxRedirects: 0 });
  expect(portfolio.status()).toBe(200);
  expect(portfolio.headers()["x-robots-tag"]).toContain("noindex");
  expect(portfolio.headers()["content-security-policy"]).toContain("'nonce-");
  expect(await portfolio.text()).toContain("Published projects");
  const unknown = await request.get("/p/e2e-no-such-project", { maxRedirects: 0 });
  expect(unknown.status()).toBe(404);
  expect(unknown.headers()["x-robots-tag"]).toContain("noindex");
});
