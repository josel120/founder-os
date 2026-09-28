"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@/lib/i18n/client";

const sections = [
  { href: "/private", label: "Home", mark: "00" },
  { href: "/private/ideas", label: "Ideas", mark: "01" },
  { href: "/private/problems", label: "Problems", mark: "02" },
  { href: "/private/research", label: "Research", mark: "03" },
  { href: "/private/decisions", label: "Decisions", mark: "04" },
  { href: "/private/projects", label: "Projects", mark: "05" },
  { href: "/private/finance", label: "Finance", mark: "06" },
] as const;

// Home is active only on /private itself; every other section also covers its detail pages.
function isActive(pathname: string, href: string) {
  return pathname === href || (href !== "/private" && pathname.startsWith(href + "/"));
}

export function WorkspaceNav() {
  const pathname = usePathname();
  const t = useT();
  // Wraps on narrow screens so every section stays visible without overflowing the page.
  return <nav aria-label={t("Workspace")} className="flex flex-wrap gap-1.5 lg:flex-col lg:flex-nowrap lg:gap-2">
    {sections.map(({ href, label, mark }) => {
      const active = isActive(pathname, href);
      return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold lg:px-4 lg:py-3 ${active ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50"}`}><span aria-hidden="true" className="hidden text-xs opacity-60 lg:inline">{mark}</span>{t(label)}<span aria-hidden="true" className="ml-auto hidden lg:inline">{active ? "•" : ""}</span></Link>;
    })}
  </nav>;
}

export function WorkspaceSection() {
  const pathname = usePathname();
  const t = useT();
  const section = sections.find(({ href }) => isActive(pathname, href));
  return <span className="text-xs font-medium text-slate-500">{t("Personal workspace")}{section ? ` / ${t(section.label)}` : ""}</span>;
}
