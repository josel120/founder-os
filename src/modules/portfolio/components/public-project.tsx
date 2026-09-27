import Link from "next/link";
import { projectLabel } from "@/modules/projects/components/project-labels";
import type { PublicProject } from "../queries/publication.queries";
import { publicHref } from "../services/public-url";

const isoDate = (value: Date) => value.toISOString().slice(0, 10);

export function publicLinks(project: Pick<PublicProject, "website" | "playStoreUrl" | "appStoreUrl">): { label: string; href: string }[] {
  const candidates: [string, string | null][] = [["Website", project.website], ["Google Play", project.playStoreUrl], ["App Store", project.appStoreUrl]];
  return candidates.flatMap(([label, value]) => {
    const href = publicHref(value);
    return href ? [{ label, href }] : [];
  });
}

/**
 * The public view of one project. It renders only ADR-018 allowlist fields, so the owner's preview (T-069) and the
 * public page show exactly the same thing.
 */
export function PublicProjectArticle({ project, headingLevel = 1 }: { project: PublicProject; headingLevel?: 1 | 2 }) {
  const Heading = headingLevel === 1 ? "h1" : "h2";
  const links = publicLinks(project);
  return <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
    <p className="text-xs font-semibold uppercase tracking-widest text-teal-700">{projectLabel(project.lifecycle)}</p>
    <Heading className="mt-2 break-words text-3xl font-semibold tracking-tight">{project.name}</Heading>
    <p className="mt-4 whitespace-pre-wrap break-words leading-7 text-slate-700">{project.summary}</p>
    {links.length > 0 && <ul className="mt-6 flex flex-wrap gap-3 text-sm">{links.map(({ label, href }) => <li key={label}><a href={href} target="_blank" rel="noopener noreferrer nofollow" className="inline-block rounded-lg border border-slate-300 px-3 py-1.5 font-medium text-slate-800 hover:border-slate-500">{label}</a></li>)}</ul>}
    <p className="mt-6 text-xs text-slate-500">{project.releasedAt && <>Released <time dateTime={project.releasedAt.toISOString()}>{isoDate(project.releasedAt)}</time> · </>}Published <time dateTime={project.publishedAt.toISOString()}>{isoDate(project.publishedAt)}</time></p>
  </article>;
}

export function PublicProjectListItem({ project }: { project: PublicProject }) {
  return <li className="py-5 first:pt-0 last:pb-0">
    <div className="flex items-baseline justify-between gap-4"><Link href={`/p/${project.slug}`} className="break-words text-lg font-semibold hover:text-indigo-700">{project.name}</Link><span className="shrink-0 text-xs font-semibold uppercase tracking-widest text-teal-700">{projectLabel(project.lifecycle)}</span></div>
    <p className="mt-1 line-clamp-3 break-words text-sm leading-6 text-slate-600">{project.summary}</p>
  </li>;
}

export function PublicShell({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto min-h-screen max-w-2xl px-4 py-10 sm:px-6">
    <nav aria-label="Site" className="mb-10 flex items-baseline justify-between gap-4"><Link href="/" className="text-xl font-semibold tracking-tight">Founder OS</Link><Link href="/portfolio" className="text-sm font-medium text-slate-600 hover:text-slate-900">Portfolio</Link></nav>
    {children}
  </main>;
}
