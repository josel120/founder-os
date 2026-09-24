"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function WorkspaceNav() {
  const pathname = usePathname();
  return <nav aria-label="Workspace" className="flex gap-2 border-t border-slate-200 pt-4">
    {[{ href: "/private/ideas", label: "Ideas" }, { href: "/private/problems", label: "Problems" }].map(({ href, label }) => {
      const active = pathname === href || pathname.startsWith(href + "/");
      return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`rounded-lg px-4 py-2 text-sm font-medium ${active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}>{label}</Link>;
    })}
  </nav>;
}
