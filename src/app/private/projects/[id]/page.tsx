import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireAuth } from "@/lib/require-auth";
import { getPrivateProject } from "@/modules/projects/queries/project.queries";
import { listDecisionsForProject } from "@/modules/decisions/queries/decision.queries";
import { CaptureDecisionForm } from "@/modules/decisions/components/capture-decision-form";
import { DecisionList } from "@/modules/decisions/components/decision-list";
import { EditProjectForm } from "@/modules/projects/components/edit-project-form";
import { ProjectStatusForm } from "@/modules/projects/components/project-status-form";
import { isWaiting, operationalTone, projectLabel, toDateInput } from "@/modules/projects/components/project-labels";
import { ProjectFinance } from "@/modules/projects/components/project-finance";
import { getPrivateIdea } from "@/modules/ideas/queries/idea.queries";
import { listPrivateFinanceTransactions } from "@/modules/finance/queries/finance.queries";
import { env } from "@/lib/env";
import { GitHubPanel } from "@/modules/github/components/github-panel";
import { getPrivateGitHubSnapshot } from "@/modules/github/queries/github.queries";
import { parseGitHubRepository } from "@/modules/github/services/repository";
import { getPrivatePublication } from "@/modules/portfolio/queries/publication.queries";
import { PublishPanel } from "@/modules/portfolio/components/publish-panel";

// Generic on purpose: private names never go into metadata.
export const metadata: Metadata = { title: "Project" };

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAuth())) redirect("/login");
  const { id } = await params;
  const [project, decisions, transactions, publication, github] = await Promise.all([getPrivateProject(id), listDecisionsForProject(id), listPrivateFinanceTransactions(id), getPrivatePublication(id), getPrivateGitHubSnapshot(id)]);
  if (!project) notFound();
  // The publication row is only ever PUBLIC or UNLISTED (DB CHECK, ADR-018); the shared enum type is broader.
  const publicationForPanel = publication && publication.visibility !== "PRIVATE" ? { visibility: publication.visibility, summary: publication.summary, publishedAt: publication.publishedAt } : null;
  // getPrivateIdea is owner-scoped: an origin idea that is not the owner's own PRIVATE idea renders nothing.
  const originIdea = project.originIdeaId ? await getPrivateIdea(project.originIdeaId) : null;
  const links = [["Repository", project.repository], ["Website", project.website], ["Play Store", project.playStoreUrl], ["App Store", project.appStoreUrl]].filter((link): link is [string, string] => Boolean(link[1]));
  const waiting = isWaiting(project.operationalStatus);
  return <section className="max-w-2xl"><Link href="/private/projects" className="text-sm text-slate-500 underline">← Back to projects</Link>
    <p className="mt-8 text-sm uppercase tracking-widest text-slate-500">Project detail</p>
    <h1 className="mt-2 break-words text-3xl font-semibold">{project.name}</h1>
    <p className="mt-1 text-sm text-slate-500">{project.slug}</p>
    {originIdea && <p className="mt-3 text-sm text-slate-500">From idea: <Link href={`/private/ideas/${originIdea.id}`} className="font-medium text-indigo-700 underline-offset-4 hover:underline">{originIdea.title}</Link></p>}
    <dl className="mt-5 grid gap-3 sm:grid-cols-2">
      <div className="rounded-xl border border-slate-200 p-4"><dt className="text-xs font-medium text-slate-500">Lifecycle</dt><dd className="mt-2"><span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">{projectLabel(project.lifecycle)}</span></dd></div>
      <div className="rounded-xl border border-slate-200 p-4"><dt className="text-xs font-medium text-slate-500">Operational status</dt><dd className="mt-2"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${operationalTone(project.operationalStatus)}`}>{projectLabel(project.operationalStatus)}</span>{waiting && project.waitingReason && <p className="mt-2 text-sm text-slate-600">{project.waitingReason}{project.waitingSince && <> · since <time dateTime={project.waitingSince.toISOString()}>{toDateInput(project.waitingSince)}</time></>}</p>}</dd></div>
    </dl>
    {(project.nextAction || project.reviewAt) && <p className="mt-4 text-sm text-slate-700">{project.nextAction && <><span className="font-medium">Next action:</span> {project.nextAction}</>}{project.reviewAt && <span className="ml-2 text-slate-500">Review on <time dateTime={project.reviewAt.toISOString()}>{toDateInput(project.reviewAt)}</time></span>}</p>}
    <p className="mt-5 whitespace-pre-wrap text-slate-700">{project.description || "No description yet."}</p>
    {links.length > 0 && <ul className="mt-4 flex flex-wrap gap-3 text-sm">{links.map(([label, href]) => <li key={label}><a href={href} target="_blank" rel="noopener noreferrer nofollow" className="font-medium text-indigo-700 underline-offset-4 hover:underline">{label}</a></li>)}</ul>}
    {(project.currentVersion || project.productionVersion) && <p className="mt-3 text-sm text-slate-500">{project.currentVersion && <>Current {project.currentVersion}</>}{project.currentVersion && project.productionVersion && " · "}{project.productionVersion && <>Production {project.productionVersion}</>}</p>}
    <ProjectStatusForm projectId={project.id} lifecycle={project.lifecycle} operationalStatus={project.operationalStatus} nextAction={project.nextAction ?? ""} waitingReason={project.waitingReason ?? ""} waitingSince={toDateInput(project.waitingSince)} reviewAt={toDateInput(project.reviewAt)} />
    <EditProjectForm project={{ id: project.id, name: project.name, slug: project.slug, description: project.description, repository: project.repository, website: project.website, playStoreUrl: project.playStoreUrl, appStoreUrl: project.appStoreUrl, currentVersion: project.currentVersion, productionVersion: project.productionVersion }} />
    <ProjectFinance transactions={transactions} />
    <PublishPanel projectId={project.id} publication={publicationForPanel} preview={{ name: project.name, slug: project.slug, lifecycle: project.lifecycle, releasedAt: project.releasedAt, website: project.website, playStoreUrl: project.playStoreUrl, appStoreUrl: project.appStoreUrl }} />
    <GitHubPanel projectId={project.id} repoFullName={parseGitHubRepository(project.repository)} configured={Boolean(env.GITHUB_TOKEN)} snapshot={github} />
    <div className="mt-12 space-y-5"><h2 className="text-xl font-semibold tracking-tight">Decisions</h2><DecisionList decisions={decisions} empty="No decisions about this project yet." /><CaptureDecisionForm projectId={project.id} /></div>
  </section>;
}
