export default function PrivateLoading() {
  return <section aria-busy="true" aria-live="polite" className="animate-pulse motion-reduce:animate-none"><p className="workspace-eyebrow">Loading</p><div className="mt-4 h-9 w-2/3 max-w-md rounded-lg bg-slate-200" /><div className="mt-8 space-y-3"><div className="workspace-panel h-24" /><div className="workspace-panel h-24" /></div><p className="sr-only">Loading your workspace…</p></section>;
}
