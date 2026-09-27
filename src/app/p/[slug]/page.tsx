import type { Metadata } from "next";
import { cache } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicProjectArticle, PublicShell } from "@/modules/portfolio/components/public-project";
import { getPublishedProject } from "@/modules/portfolio/queries/publication.queries";

type Props = { params: Promise<{ slug: string }> };
// One lookup per request for metadata and page, so both always agree (and unpublishing cannot split them).
const findProject = cache(getPublishedProject);
// Explicit, although the root layout is dynamic too: unpublishing must take effect on the next request.
export const dynamic = "force-dynamic";
const noIndex = { index: false, follow: false };

// Metadata uses the same allowlisted query as the page. A private or unknown slug gets the same generic title,
// so neither the page nor its metadata reveals that a private project exists.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const project = await findProject((await params).slug);
  if (!project) return { title: "Page not found", robots: noIndex };
  return { title: project.name, description: project.summary.slice(0, 160), robots: noIndex };
}

export default async function PublishedProjectPage({ params }: Props) {
  const project = await findProject((await params).slug);
  if (!project) notFound();
  return <PublicShell>
    <PublicProjectArticle project={project} />
    <Link href="/portfolio" className="mt-6 inline-block text-sm text-slate-500 underline underline-offset-4">← All projects</Link>
  </PublicShell>;
}
