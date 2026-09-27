"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { publishProject, unpublishProject } from "../actions/publication.actions";
import type { PublicProject } from "../queries/publication.queries";
import { PublicProjectArticle } from "./public-project";
import { PUBLIC_SUMMARY_MAX } from "../schemas/publication.limits";

export type PublishPanelPublication = { visibility: "PUBLIC" | "UNLISTED"; summary: string; publishedAt: Date } | null;
export type PublishPanelPreview = Omit<PublicProject, "summary" | "publishedAt">;

const stateLabel = { PRIVATE: "Private", PUBLIC: "Public", UNLISTED: "Unlisted" } as const;

/**
 * Owner-only publish panel (ADR-018, T-069). The preview is built from `preview` (an ADR-018 allowlist projection
 * the caller must pass) plus the summary being edited, and is rendered with the same `PublicProjectArticle` the
 * public page uses, so it never diverges from what actually becomes public.
 */
export function PublishPanel({ projectId, publication, preview }: { projectId: string; publication: PublishPanelPublication; preview: PublishPanelPreview }) {
  const router = useRouter();
  const inFlight = useRef(false);
  const [summary, setSummary] = useState(publication?.summary ?? "");
  const [visibility, setVisibility] = useState<"PUBLIC" | "UNLISTED">(publication?.visibility ?? "PUBLIC");
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [confirmUnpublish, setConfirmUnpublish] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const previewProject: PublicProject = { ...preview, summary: summary || "Your public summary will appear here.", publishedAt: publication?.publishedAt ?? new Date() };
  const currentState = publication ? publication.visibility : "PRIVATE";

  async function doPublish() {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true); setError(""); setMessage("");
    try {
      const data = new FormData();
      data.set("projectId", projectId);
      data.set("visibility", visibility);
      data.set("summary", summary);
      const result = await publishProject(data);
      if (!result.ok) { setError(result.error); return; }
      setMessage(publication ? "Publication updated." : "Project published.");
      setConfirmPublish(false);
      router.refresh();
    } catch {
      setError("Could not confirm the change. Check the project before retrying.");
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  async function doUnpublish() {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true); setError(""); setMessage("");
    try {
      const data = new FormData();
      data.set("projectId", projectId);
      const result = await unpublishProject(data);
      if (!result.ok) { setError(result.error); return; }
      setMessage("Project is private again.");
      setConfirmUnpublish(false);
      router.refresh();
    } catch {
      setError("Could not confirm the change. Check the project before retrying.");
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return (
    <section aria-labelledby="publish-heading" aria-busy={pending} className="workspace-panel mt-8 space-y-4 p-6">
      <h2 id="publish-heading" className="text-lg font-semibold">Public portfolio</h2>
      <p className="text-sm text-slate-600">
        Current state: <span className="font-medium">{stateLabel[currentState]}</span>
        {publication && <> · <a href={`/p/${preview.slug}`} className="text-indigo-700 underline-offset-4 hover:underline">/p/{preview.slug}</a></>}
      </p>
      {publication && <p className="text-xs text-slate-500">While published, changes to the name, slug, lifecycle, release date and website or store links show on the public page right away.</p>}

      <label className="block text-sm font-medium">Public summary
        <textarea name="summary" value={summary} onChange={(event) => setSummary(event.target.value)} maxLength={PUBLIC_SUMMARY_MAX} readOnly={pending} className="mt-2 min-h-24 w-full rounded-md border p-3" />
      </label>
      <p className="text-xs text-slate-500">{summary.length}/{PUBLIC_SUMMARY_MAX}</p>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Visibility</legend>
        <label className="flex items-start gap-2 text-sm">
          <input type="radio" name="visibility" value="PUBLIC" checked={visibility === "PUBLIC"} onChange={() => setVisibility("PUBLIC")} disabled={pending} />
          <span><span className="font-medium">Public</span> — listed on the portfolio</span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input type="radio" name="visibility" value="UNLISTED" checked={visibility === "UNLISTED"} onChange={() => setVisibility("UNLISTED")} disabled={pending} />
          <span><span className="font-medium">Unlisted</span> — only people with the link</span>
        </label>
      </fieldset>

      <div>
        <p className="mb-2 text-sm font-medium">Preview</p>
        <PublicProjectArticle project={previewProject} headingLevel={3} />
      </div>

      {!confirmPublish && <button type="button" disabled={pending} onClick={() => setConfirmPublish(true)} className="rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">{publication ? "Review and update" : "Review and publish"}</button>}
      {confirmPublish && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-sm">
          <p>This will be visible to anyone {visibility === "PUBLIC" ? "who visits the portfolio" : "with the link"}.</p>
          <div className="mt-3 flex gap-3">
            <button type="button" disabled={pending} onClick={doPublish} className="rounded-lg bg-indigo-600 px-3 py-2 font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">Confirm</button>
            <button type="button" disabled={pending} onClick={() => setConfirmPublish(false)} className="rounded-lg border px-3 py-2 font-medium">Cancel</button>
          </div>
        </div>
      )}

      {publication && !confirmUnpublish && <button type="button" disabled={pending} onClick={() => setConfirmUnpublish(true)} className="rounded-xl border border-red-300 px-4 py-3 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">Make private</button>}
      {confirmUnpublish && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm">
          <p>This removes the public page. Visitors will get a 404.</p>
          <div className="mt-3 flex gap-3">
            <button type="button" disabled={pending} onClick={doUnpublish} className="rounded-lg bg-red-600 px-3 py-2 font-semibold text-white hover:bg-red-700 disabled:opacity-50">Confirm</button>
            <button type="button" disabled={pending} onClick={() => setConfirmUnpublish(false)} className="rounded-lg border px-3 py-2 font-medium">Cancel</button>
          </div>
        </div>
      )}

      <p role="status" aria-live="polite" className="text-sm text-green-700">{message}</p>
      {error && <p role="alert" aria-live="assertive" className="text-sm text-red-700">{error}</p>}
    </section>
  );
}
