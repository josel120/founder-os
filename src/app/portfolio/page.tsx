import type { Metadata } from "next";
import { PublicProjectListItem, PublicShell } from "@/modules/portfolio/components/public-project";
import { listPublicProjects } from "@/modules/portfolio/queries/publication.queries";

// ADR-018: search engines stay out until the owner decides otherwise (open question 1).
export const metadata: Metadata = { title: "Portfolio", description: "Published projects.", robots: { index: false, follow: false } };

// Explicit, although the root layout is dynamic too: unpublishing must take effect on the next request.
export const dynamic = "force-dynamic";

export default async function PortfolioPage() {
  const projects = await listPublicProjects();
  return <PublicShell>
    <p className="text-xs font-semibold uppercase tracking-widest text-teal-700">Portfolio</p>
    <h1 className="mt-2 text-3xl font-semibold tracking-tight">Published projects</h1>
    <p className="mt-3 text-slate-600">Products built with Founder OS.</p>
    {projects.length === 0
      ? <p role="status" className="mt-8 rounded-xl bg-slate-50 px-4 py-6 text-sm text-slate-500">Nothing is published yet.</p>
      : <ul className="mt-8 divide-y divide-slate-200">{projects.map((project) => <PublicProjectListItem key={project.slug} project={project} />)}</ul>}
  </PublicShell>;
}
