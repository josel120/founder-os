"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
export function WorkspaceNav() {
  const pathname = usePathname();
  return <nav aria-label="Workspace" className="flex gap-2 lg:flex-col">
    {[{ href: "/private/ideas", label: "Ideas", mark: "01" }, { href: "/private/problems", label: "Problems", mark: "02" }, { href: "/private/decisions", label: "Decisions", mark: "03" }, { href: "/private/projects", label: "Projects", mark: "04" }, { href: "/private/finance", label: "Finance", mark: "05" }].map(({ href, label, mark }) => {
      const active = pathname === href || pathname.startsWith(href + "/");
      return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold ${active ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50"}`}><span aria-hidden="true" className="text-xs opacity-60">{mark}</span>{label}<span aria-hidden="true" className="ml-auto">{active ? "•" : ""}</span></Link>;
    })}
  </nav>;
}
