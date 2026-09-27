import { describe, expect, it, vi } from "vitest";
import { fetchRepositorySnapshot, lastPageFromLink, type Fetch } from "../src/modules/github/services/github-client";
import { parseGitHubRepository } from "../src/modules/github/services/repository";
import { GITHUB_API_DEFAULT, parseEnv } from "../src/lib/env";

describe("parseGitHubRepository", () => {
  it.each([
    ["https://github.com/josel120/founder-os", "josel120/founder-os"],
    ["https://github.com/josel120/founder-os/", "josel120/founder-os"],
    ["https://github.com/josel120/founder-os.git", "josel120/founder-os"],
    ["  https://GitHub.com/Org-1/repo.name_x  ", "Org-1/repo.name_x"],
  ])("links %s", (url, expected) => expect(parseGitHubRepository(url)).toBe(expected));

  it.each([
    null, "", "not a url", "http://github.com/a/b", "https://gitlab.com/a/b", "https://github.com/a", "https://github.com/a/b/tree/main",
    "https://github.com/a/b?tab=x", "https://github.com/a/b#x", "https://user:pw@github.com/a/b", "https://github.com:8443/a/b",
    "https://github.com/-bad/b", "https://github.com/bad-/b", "https://github.com/ba--d/b", `https://github.com/${"a".repeat(40)}/b`,
    "https://github.com/a/..", "https://github.com/a/b%20c", "https://api.github.com/repos/a/b", "https://github.com.evil.example/a/b",
  ])("does not link %s", (url) => expect(parseGitHubRepository(url)).toBeNull());
});

describe("lastPageFromLink", () => {
  it("reads the last page, or null", () => {
    expect(lastPageFromLink('<https://api.github.com/repositories/1/pulls?state=open&per_page=1&page=2>; rel="next", <https://api.github.com/repositories/1/pulls?state=open&per_page=1&page=17>; rel="last"')).toBe(17);
    expect(lastPageFromLink(null)).toBeNull();
    expect(lastPageFromLink('<https://x?page=2>; rel="next"')).toBeNull();
  });
});

type Route = { status: number; body?: unknown; headers?: Record<string, string> };
function stub(routes: Record<string, Route | Error>) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchImpl: Fetch = async (url, init) => {
    calls.push({ url, init });
    const path = url.replace("https://api.test/repos/o/r", "");
    const route = routes[path];
    if (route instanceof Error) throw route;
    if (!route) return new Response("{}", { status: 500 });
    return new Response(route.body === undefined ? "" : JSON.stringify(route.body), { status: route.status, headers: route.headers });
  };
  return { calls, fetchImpl };
}
const repo = { status: 200, body: { default_branch: "main", pushed_at: "2026-09-01T10:00:00Z", open_issues_count: 20, full_name: "o/r", private: true, description: "SECRET description" } };
const pulls = { status: 200, body: [{ title: "SECRET PR title" }], headers: { link: '<https://api.test/repositories/1/pulls?state=open&per_page=1&page=7>; rel="last"' } };
const release = { status: 200, body: { tag_name: "v1.2.0", published_at: "2026-08-20T00:00:00Z", body: "SECRET notes" } };
const options = (fetchImpl: Fetch) => ({ token: "ghp_test_token_1234567890", apiUrl: "https://api.test", fetchImpl });

describe("fetchRepositorySnapshot", () => {
  it("builds the snapshot from counts and dates only, subtracting PRs from GitHub's issue count", async () => {
    const { calls, fetchImpl } = stub({ "": repo, "/pulls?state=open&per_page=1": pulls, "/releases/latest": release });
    const result = await fetchRepositorySnapshot("o/r", options(fetchImpl));
    expect(result).toEqual({ ok: true, snapshot: { defaultBranch: "main", lastPushAt: new Date("2026-09-01T10:00:00Z"), openIssues: 13, openPullRequests: 7, latestReleaseTag: "v1.2.0", latestReleaseAt: new Date("2026-08-20T00:00:00Z") } });
    expect(JSON.stringify(result)).not.toContain("SECRET");
    expect(calls.map((call) => call.url)).toEqual(["https://api.test/repos/o/r", "https://api.test/repos/o/r/pulls?state=open&per_page=1", "https://api.test/repos/o/r/releases/latest"]);
    for (const { init } of calls) {
      expect(init.method).toBe("GET");
      expect(init.redirect).toBe("error");
      expect((init.headers as Record<string, string>).authorization).toBe("Bearer ghp_test_token_1234567890");
      expect(init.signal).toBeInstanceOf(AbortSignal);
    }
  });

  it("treats a missing release as none and a short PR list without Link as its length", async () => {
    const { fetchImpl } = stub({ "": repo, "/pulls?state=open&per_page=1": { status: 200, body: [] }, "/releases/latest": { status: 404, body: { message: "Not Found" } } });
    expect(await fetchRepositorySnapshot("o/r", options(fetchImpl))).toMatchObject({ ok: true, snapshot: { openPullRequests: 0, openIssues: 20, latestReleaseTag: null, latestReleaseAt: null } });
  });

  it.each([
    [{ status: 404 }, "not_found"], [{ status: 401 }, "unauthorized"], [{ status: 403 }, "unauthorized"],
    [{ status: 403, headers: { "x-ratelimit-remaining": "0" } }, "rate_limited"], [{ status: 429 }, "rate_limited"],
    [{ status: 502 }, "unavailable"], [new TypeError("fetch failed"), "unavailable"], [{ status: 200, body: { default_branch: 42 } }, "unavailable"],
  ] as const)("maps a repository response %j to %s", async (route, error) => {
    const { fetchImpl } = stub({ "": route as Route | Error, "/pulls?state=open&per_page=1": pulls, "/releases/latest": release });
    expect(await fetchRepositorySnapshot("o/r", options(fetchImpl))).toEqual({ ok: false, error });
  });

  it("fails as unavailable on invalid JSON and never throws", async () => {
    const fetchImpl: Fetch = vi.fn(async () => new Response("<html>", { status: 200 }));
    expect(await fetchRepositorySnapshot("o/r", options(fetchImpl))).toEqual({ ok: false, error: "unavailable" });
  });
});

describe("GitHub environment", () => {
  const strict: NodeJS.ProcessEnv = { NODE_ENV: "production", VERCEL: "1", DATABASE_URL: "postgres://u:p@h/db", BETTER_AUTH_SECRET: "x".repeat(32), BETTER_AUTH_URL: "https://app.example", OWNER_EMAIL: "o@example.com" };

  it("is optional and defaults to the real API", () => {
    expect(parseEnv({ ...strict })).toMatchObject({ GITHUB_TOKEN: undefined, GITHUB_API_URL: GITHUB_API_DEFAULT, CRON_SECRET: undefined });
    expect(parseEnv({ ...strict, GITHUB_TOKEN: "", CRON_SECRET: "" }).GITHUB_TOKEN).toBeUndefined();
  });

  it("refuses an API override in production but allows it in tests", () => {
    expect(() => parseEnv({ ...strict, GITHUB_API_URL: "http://localhost:4010" })).toThrow("GITHUB_API_URL (must not be overridden in production)");
    expect(parseEnv({ NODE_ENV: "test", GITHUB_API_URL: "http://localhost:4010" }).GITHUB_API_URL).toBe("http://localhost:4010");
  });

  it("turns the feature off, without stopping the app, for a short cron secret or token", () => {
    expect(parseEnv({ ...strict, CRON_SECRET: "short", GITHUB_TOKEN: "short" })).toMatchObject({ CRON_SECRET: undefined, GITHUB_TOKEN: undefined });
  });
});
