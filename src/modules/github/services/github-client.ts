import { z } from "zod";

/** ADR-019 error codes: the only thing stored or shown when a sync fails. Never a response body. */
export type GitHubSyncError = "not_found" | "unauthorized" | "rate_limited" | "unavailable";
export type GitHubSnapshot = {
  defaultBranch: string | null;
  lastPushAt: Date | null;
  openIssues: number;
  openPullRequests: number;
  latestReleaseTag: string | null;
  latestReleaseAt: Date | null;
};
export type GitHubResult = { ok: true; snapshot: GitHubSnapshot } | { ok: false; error: GitHubSyncError };
export type Fetch = (url: string, init: RequestInit) => Promise<Response>;

const TIMEOUT_MS = 10_000;
const MAX_COUNT = 1_000_000; // far above any real repository, far below the integer column's limit
const isoDate = z.iso.datetime({ offset: true }).nullable().transform((value) => (value ? new Date(value) : null));
const repositorySchema = z.object({ default_branch: z.string().max(255).nullable(), pushed_at: isoDate, open_issues_count: z.number().int().min(0) });
const releaseSchema = z.object({ tag_name: z.string().max(255), published_at: isoDate });

class SyncFailure extends Error {
  constructor(readonly code: GitHubSyncError) {
    super(code);
  }
}

function failureFor(response: Response): GitHubSyncError {
  if (response.status === 404) return "not_found";
  if (response.status === 429 || (response.status === 403 && response.headers.get("x-ratelimit-remaining") === "0")) return "rate_limited";
  if (response.status === 401 || response.status === 403) return "unauthorized";
  return "unavailable";
}

/** The last page number from a `Link` header (`rel="last"`), i.e. the item count when `per_page=1`. */
export function lastPageFromLink(link: string | null): number | null {
  const match = link?.split(",").find((part) => /rel="last"/.test(part))?.match(/[?&]page=(\d+)/);
  return match ? Number(match[1]) : null;
}

/**
 * Reads one repository's snapshot: repository metadata, the open pull request count and the latest release.
 * Read-only, with a timeout; the token goes only to `apiUrl`. Bodies are parsed with Zod and never logged.
 */
export async function fetchRepositorySnapshot(fullName: string, options: { token: string; apiUrl: string; fetchImpl?: Fetch }): Promise<GitHubResult> {
  const fetchImpl = options.fetchImpl ?? ((url, init) => fetch(url, init));
  const base = options.apiUrl.replace(/\/$/, "");
  const [owner, repo] = fullName.split("/").map(encodeURIComponent);
  const get = async (path: string, allowNotFound = false) => {
    let response: Response;
    try {
      response = await fetchImpl(`${base}/repos/${owner}/${repo}${path}`, {
        method: "GET",
        redirect: "error",
        cache: "no-store",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { accept: "application/vnd.github+json", authorization: `Bearer ${options.token}`, "x-github-api-version": "2022-11-28", "user-agent": "founder-os" },
      });
    } catch {
      throw new SyncFailure("unavailable");
    }
    if (allowNotFound && response.status === 404) return null;
    if (!response.ok) throw new SyncFailure(failureFor(response));
    return response;
  };
  const json = async (response: Response) => {
    try {
      return (await response.json()) as unknown;
    } catch {
      throw new SyncFailure("unavailable");
    }
  };

  try {
    const repository = repositorySchema.safeParse(await json((await get(""))!));
    if (!repository.success) return { ok: false, error: "unavailable" };
    const pulls = (await get("/pulls?state=open&per_page=1"))!;
    const pullPage = await json(pulls);
    // With per_page=1 the last page number is the count; without a Link header there are 0 or 1 open PRs.
    const openPullRequests = Math.min(MAX_COUNT, lastPageFromLink(pulls.headers.get("link")) ?? (Array.isArray(pullPage) ? pullPage.length : 0));
    const releaseResponse = await get("/releases/latest", true);
    const release = releaseResponse ? releaseSchema.safeParse(await json(releaseResponse)) : null;
    if (release && !release.success) return { ok: false, error: "unavailable" };
    return {
      ok: true,
      snapshot: {
        defaultBranch: repository.data.default_branch,
        lastPushAt: repository.data.pushed_at,
        // GitHub counts open pull requests as issues too.
        openIssues: Math.min(MAX_COUNT, Math.max(0, repository.data.open_issues_count - openPullRequests)),
        openPullRequests,
        latestReleaseTag: release?.data.tag_name ?? null,
        latestReleaseAt: release?.data.published_at ?? null,
      },
    };
  } catch (error) {
    if (error instanceof SyncFailure) return { ok: false, error: error.code };
    return { ok: false, error: "unavailable" };
  }
}
