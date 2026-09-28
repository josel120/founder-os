import { createTranslator, type Translate } from "@/lib/i18n/translate";
import type { GitHubSnapshotView } from "../queries/github.queries";
import { RefreshGitHubButton } from "./refresh-github-button";

const isoDate = (value: Date) => value.toISOString().slice(0, 10);
const errorText: Record<string, string> = {
  not_found: "GitHub could not find this repository, or the token cannot see it.",
  unauthorized: "GitHub refused the token.",
  rate_limited: "GitHub's rate limit was reached; the numbers below may be old.",
  unavailable: "GitHub did not answer at the last sync; the numbers below may be old.",
};

/**
 * ADR-019: the private GitHub snapshot on a project page. `repoFullName` is the repository parsed from the project's URL
 * (null when it is not a GitHub URL); `configured` is whether GITHUB_TOKEN is set. Counts and dates only.
 * `t` is optional so the page can pass the owner's locale while this stays a plain, synchronously-rendered component.
 */
export function GitHubPanel({ projectId, repoFullName, configured, snapshot, t = createTranslator(null) }: { projectId: string; repoFullName: string | null; configured: boolean; snapshot: GitHubSnapshotView | null; t?: Translate }) {
  return <section aria-labelledby="github-heading" className="workspace-panel mt-8 space-y-4 p-6">
    <h2 id="github-heading" className="text-lg font-semibold">{t("GitHub")}</h2>
    {!repoFullName ? <p className="text-sm text-slate-600">{t("Set the repository to a")} <code>https://github.com/owner/repo</code> {t("URL to see its activity here.")}</p>
      : !configured ? <p className="text-sm text-slate-600">{t("Linked to")} <span className="font-medium">{repoFullName}</span>. {t("GitHub is not connected yet: set")} <code>GITHUB_TOKEN</code> {t("(see task T-074).")}</p>
      : <>
        <p className="text-sm text-slate-600"><a href={`https://github.com/${repoFullName}`} target="_blank" rel="noopener noreferrer nofollow" className="font-medium text-indigo-700 underline-offset-4 hover:underline">{repoFullName}</a>{snapshot?.defaultBranch && <> · {snapshot.defaultBranch}</>}</p>
        {snapshot?.syncError && <p role="alert" className="text-sm text-amber-800">{t(errorText[snapshot.syncError] ?? errorText.unavailable!)}</p>}
        {snapshot && snapshot.openIssues !== null
          ? <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div><dt className="text-xs text-slate-500">{t("Last push")}</dt><dd className="mt-1 font-medium tabular-nums">{snapshot.lastPushAt ? <time dateTime={snapshot.lastPushAt.toISOString()}>{isoDate(snapshot.lastPushAt)}</time> : t("Never")}</dd></div>
            <div><dt className="text-xs text-slate-500">{t("Open issues")}</dt><dd className="mt-1 font-medium tabular-nums">{snapshot.openIssues}</dd></div>
            <div><dt className="text-xs text-slate-500">{t("Open pull requests")}</dt><dd className="mt-1 font-medium tabular-nums">{snapshot.openPullRequests}</dd></div>
            <div><dt className="text-xs text-slate-500">{t("Latest release")}</dt><dd className="mt-1 font-medium">{snapshot.latestReleaseTag ?? t("None")}{snapshot.latestReleaseAt && <span className="ml-1 text-xs text-slate-500 tabular-nums">{isoDate(snapshot.latestReleaseAt)}</span>}</dd></div>
          </dl>
          : !snapshot?.syncError && <p className="text-sm text-slate-600">{t("Not synced yet.")}</p>}
        {snapshot && <p className="text-xs text-slate-500">{t("Synced")} <time dateTime={snapshot.syncedAt.toISOString()}>{snapshot.syncedAt.toISOString().slice(0, 16).replace("T", " ")} UTC</time>. {t("Refreshes daily.")}</p>}
        <RefreshGitHubButton projectId={projectId} />
      </>}
  </section>;
}
