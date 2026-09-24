"use client";

export default function ProjectsError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <section role="alert" className="workspace-panel px-6 py-14 text-center"><h1 className="font-semibold">Projects could not be loaded.</h1><p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-slate-500">Nothing was changed. Try again in a moment.</p><button type="button" onClick={reset} className="mt-5 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium hover:bg-slate-50">Try again</button></section>;
}
