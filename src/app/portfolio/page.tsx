import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { PublicProjectListItem, PublicShell } from "@/modules/portfolio/components/public-project";
import { listPublicProjects } from "@/modules/portfolio/queries/publication.queries";

// ADR-018: search engines stay out until the owner decides otherwise (open question 1).
export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Portfolio"), description: t("Published projects."), robots: { index: false, follow: false } };
}

// Explicit, although the root layout is dynamic too: unpublishing must take effect on the next request.
export const dynamic = "force-dynamic";

export default async function PortfolioPage() {
  const t = await getT();
  const projects = await listPublicProjects();
  return <PublicShell t={t}>
    <p className="text-xs font-semibold uppercase tracking-widest text-teal-700">{t("Portfolio")}</p>
    <h1 className="mt-2 text-3xl font-semibold tracking-tight">{t("Published projects")}</h1>
    <p className="mt-3 text-slate-600">{t("Products built with Founder OS.")}</p>
    {projects.length === 0
      ? <p role="status" className="mt-8 rounded-xl bg-slate-50 px-4 py-6 text-sm text-slate-500">{t("Nothing is published yet.")}</p>
      : <ul className="mt-8 divide-y divide-slate-200">{projects.map((project) => <PublicProjectListItem key={project.slug} project={project} t={t} />)}</ul>}
  </PublicShell>;
}
