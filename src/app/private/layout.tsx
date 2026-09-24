import Link from "next/link";
import { WorkspaceNav } from "@/components/workspace-nav";
export default function PrivateLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <div className="min-h-screen lg:grid lg:grid-cols-[232px_minmax(0,1fr)]">
    <a href="#workspace-content" className="sr-only focus:not-sr-only">Skip to content</a>
    <aside className="border-b border-slate-200 bg-white px-5 py-6 lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:border-r lg:border-b-0">
      <Link href="/private/ideas" className="flex items-center gap-3 text-lg font-bold tracking-tight">
        <span aria-hidden="true" className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-600 text-sm text-white">F.</span>Founder OS
      </Link>
      <p className="mb-7 mt-3 text-xs text-slate-500">Your space to build deliberately.</p>
      <p className="workspace-eyebrow mb-3">Workspace</p>
      <WorkspaceNav />
      <div className="mt-6 rounded-xl bg-slate-50 p-4 lg:mt-auto"><p className="text-xs font-semibold text-slate-700">Private workspace</p><p className="mt-2 text-xs leading-5 text-slate-500">Ideas stay yours. Publishing is always a separate decision.</p></div>
    </aside>
    <div className="min-w-0"><header className="flex items-center justify-between border-b border-slate-200/70 px-6 py-4 lg:px-10"><span className="text-xs font-medium text-slate-500">Personal workspace / Idea OS</span><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800">Private</span></header>
    <main id="workspace-content" className="mx-auto max-w-[1440px] px-5 py-8 sm:px-8 lg:p-10">{children}</main></div>
  </div>;
}
