import Link from "next/link";
import { WorkspaceNav } from "@/components/workspace-nav";
export default function PrivateLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <div className="mx-auto min-h-screen max-w-5xl px-4 py-6 sm:px-6 sm:py-10"><a href="#workspace-content" className="sr-only focus:not-sr-only">Skip to content</a><header className="mb-10 space-y-5"><div className="flex flex-wrap items-center justify-between gap-3"><Link className="text-xl font-semibold tracking-tight" href="/private/ideas">Founder OS</Link><span className="rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-medium text-teal-800">Private workspace</span></div><WorkspaceNav /></header><main id="workspace-content">{children}</main></div>;
}
