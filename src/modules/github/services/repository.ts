/**
 * ADR-019: a project is linked when its repository URL is exactly `https://github.com/<owner>/<repo>`, optionally with
 * `.git` or a trailing slash. Returns `owner/repo`, or null for anything else (other hosts, paths, queries, bad names).
 */
const OWNER = /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/;
const REPO = /^[A-Za-z0-9._-]{1,100}$/;

export function parseGitHubRepository(value: string | null | undefined): string | null {
  if (!value) return null;
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.hostname.toLowerCase() !== "github.com" || url.port || url.username || url.password || url.search || url.hash) return null;
  const parts = url.pathname.replace(/\/$/, "").split("/").slice(1);
  if (parts.length !== 2) return null;
  const owner = parts[0]!;
  const repo = parts[1]!.replace(/\.git$/, "");
  if (!OWNER.test(owner) || !REPO.test(repo) || repo === "." || repo === "..") return null;
  return `${owner}/${repo}`;
}
