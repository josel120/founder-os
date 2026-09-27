import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("../src/modules/github/actions/github.actions", () => ({ refreshProjectGitHub: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
import { GitHubPanel } from "../src/modules/github/components/github-panel";

const projectId = "00000000-0000-4000-8000-000000000001";
const snapshot = { repoFullName: "o/r", defaultBranch: "main", lastPushAt: new Date("2026-09-01T10:00:00Z"), openIssues: 3, openPullRequests: 2, latestReleaseTag: "v1.2.0", latestReleaseAt: new Date("2026-08-20T00:00:00Z"), syncedAt: new Date("2026-09-27T06:00:00Z"), syncError: null };
let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { value: true, configurable: true });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
const render = (props: Parameters<typeof GitHubPanel>[0]) => act(async () => root.render(<GitHubPanel {...props} />));

it("asks for a GitHub URL when the project is not linked", async () => {
  await render({ projectId, repoFullName: null, configured: true, snapshot: null });
  expect(container.textContent).toContain("https://github.com/owner/repo");
  expect(container.querySelector("button")).toBeNull();
});

it("says GitHub is not connected without a token, and offers no refresh", async () => {
  await render({ projectId, repoFullName: "o/r", configured: false, snapshot: null });
  expect(container.textContent).toContain("GITHUB_TOKEN");
  expect(container.querySelector("button")).toBeNull();
});

it("shows the snapshot's counts and dates, the repository link and a refresh button", async () => {
  await render({ projectId, repoFullName: "o/r", configured: true, snapshot });
  const values = [...container.querySelectorAll("dd")].map((dd) => dd.textContent);
  expect(values).toEqual(["2026-09-01", "3", "2", "v1.2.02026-08-20"]);
  expect(container.querySelector('a[href="https://github.com/o/r"]')?.getAttribute("rel")).toBe("noopener noreferrer nofollow");
  expect(container.textContent).toContain("Synced 2026-09-27 06:00 UTC");
  expect(container.querySelector("button")?.textContent).toBe("Refresh from GitHub");
});

it("explains a failed sync while keeping the last known numbers", async () => {
  await render({ projectId, repoFullName: "o/r", configured: true, snapshot: { ...snapshot, syncError: "rate_limited" } });
  expect(container.querySelector('[role="alert"]')?.textContent).toContain("rate limit");
  expect(container.querySelectorAll("dd")).toHaveLength(4);
});

it("shows only the error before the first successful sync", async () => {
  await render({ projectId, repoFullName: "o/r", configured: true, snapshot: { ...snapshot, openIssues: null, openPullRequests: null, lastPushAt: null, latestReleaseTag: null, latestReleaseAt: null, defaultBranch: null, syncError: "not_found" } });
  expect(container.querySelector('[role="alert"]')?.textContent).toContain("could not find");
  expect(container.querySelector("dl")).toBeNull();
});
