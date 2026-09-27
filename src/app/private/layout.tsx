import type { Metadata } from "next";
import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";
import { WorkspaceNav, WorkspaceSection } from "@/components/workspace-nav";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function PrivateLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <div className="min-h-screen lg:grid lg:grid-cols-[232px_minmax(0,1fr)]">
    <a href="#workspace-content" className="sr-only focus:not-sr-only">Skip to content</a>
    <aside className="border-b border-slate-200 bg-white px-5 py-5 lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:border-r lg:border-b-0 lg:py-6">
      <Link href="/private" className="mb-4 flex items-center gap-3 text-lg font-bold tracking-tight lg:mb-0">
        <span aria-hidden="true" className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-600 text-sm text-white">F.</span>Founder OS
      </Link>
      <p className="mb-7 mt-3 hidden text-xs text-slate-500 lg:block">Your space to build deliberately.</p>
      <p className="workspace-eyebrow mb-3 hidden lg:block">Workspace</p>
      <WorkspaceNav />
      <div className="mt-6 hidden rounded-xl bg-slate-50 p-4 lg:mt-auto lg:block"><p className="text-xs font-semibold text-slate-700">Private workspace</p><p className="mt-2 text-xs leading-5 text-slate-500">Ideas stay yours. Publishing is always a separate decision.</p></div>
    </aside>
    <div className="min-w-0"><header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/70 px-5 py-3 sm:px-8 lg:px-10"><WorkspaceSection /><span className="flex items-center gap-3"><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800">Private</span><a href="/private/export" download className="text-sm font-medium text-slate-600 underline-offset-4 hover:text-slate-900 hover:underline">Export data</a><SignOutButton /></span></header>
    <main id="workspace-content" className="mx-auto max-w-[1440px] px-5 py-8 sm:px-8 lg:p-10">{children}</main></div>
  </div>;
}
