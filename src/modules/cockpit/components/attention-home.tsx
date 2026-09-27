import Link from "next/link";
import type { ReactNode } from "react";
import { statusLabel } from "@/modules/ideas/services/inbox";
import { operationalTone, projectLabel } from "@/modules/projects/components/project-labels";
import type { Attention } from "../queries/attention.queries";
import { FINANCE_WINDOW_DAYS, STALE_REPOSITORY_DAYS, WAITING_THRESHOLD_DAYS } from "../services/attention";

type AttentionProject = Attention["actionProjects"][number];
const day = 24 * 60 * 60 * 1000;
const isoDate = (value: Date) => value.toISOString().slice(0, 10);
const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

function Section({ id, title, count, hint, footer, children }: { id: string; title: string; count?: number; hint?: string; footer?: ReactNode; children: ReactNode }) {
  return <section aria-labelledby={id} className="workspace-panel p-5 sm:p-6">
    <div className="flex items-baseline justify-between gap-3"><h2 id={id} className="text-lg font-semibold">{title}</h2>{count !== undefined && <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-slate-600">{count}</span>}</div>
    {hint && <p className="mt-1 text-xs leading-5 text-slate-500">{hint}</p>}
    <div className="mt-4">{children}</div>
    {footer && <div className="mt-4 border-t border-slate-100 pt-3 text-sm font-medium">{footer}</div>}
  </section>;
}

const Empty = ({ children }: { children: ReactNode }) => <p className="rounded-xl bg-slate-50 px-4 py-4 text-sm text-slate-500">{children}</p>;
const List = ({ children }: { children: ReactNode }) => <ul className="divide-y divide-slate-100">{children}</ul>;
const MoreLink = ({ href, children }: { href: string; children: ReactNode }) => <Link href={href} className="text-indigo-700 hover:text-indigo-900">{children} →</Link>;

function ProjectRow({ project, detail }: { project: AttentionProject; detail: string }) {
  return <li className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
    <div className="min-w-0"><Link href={`/private/projects/${project.id}`} className="break-words font-medium hover:text-indigo-700">{project.name}</Link><p className="mt-1 break-words text-sm text-slate-500">{detail}</p></div>
    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${operationalTone(project.operationalStatus)}`}>{projectLabel(project.operationalStatus)}</span>
  </li>;
}

/** One reason a project is listed; hidden when no project has that reason. */
function ProjectGroup({ id, title, projects, detail }: { id: string; title: string; projects: AttentionProject[]; detail: (project: AttentionProject) => string }) {
  if (projects.length === 0) return null;
  return <div role="group" aria-labelledby={id}>
    <h3 id={id} className="mb-2 flex items-baseline justify-between gap-3 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}<span className="tabular-nums">{projects.length}</span></h3>
    <List>{projects.map((project) => <ProjectRow key={project.id} project={project} detail={detail(project)} />)}</List>
  </div>;
}

function waitedFor(project: AttentionProject, now: Date) {
  if (!project.waitingSince) return project.waitingReason ?? "Waiting";
  const days = Math.floor((now.getTime() - project.waitingSince.getTime()) / day);
  return `Waiting ${plural(days, "day")}${project.waitingReason ? `: ${project.waitingReason}` : ""}`;
}

function researchGap(signals: Attention["researchIdeas"][number]["signals"]) {
  if (signals.supports + signals.contradicts + signals.neutral === 0) return "No evidence yet.";
  return `${plural(signals.contradicts, "contradicting item")}, nothing supporting.`;
}

/** Everything that needs the owner, counted from their own records. Read-only: it lists and links, the owner decides. */
export function AttentionHome({ attention, now }: { attention: Attention; now: Date }) {
  const { actionProjects, waitingProjects, reviewProjects, inbox, researchIdeas, decisions, finance, staleRepositories } = attention;
  const projectIds = new Set([...actionProjects, ...waitingProjects, ...reviewProjects].map((project) => project.id));
  const needs = projectIds.size + researchIdeas.length + inbox.total;
  return <section>
    <div className="mb-8"><p className="workspace-eyebrow">Home</p><h1 className="mt-3 text-4xl font-semibold tracking-tight">What needs your attention</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">Counted from your own records. Nothing here is scored or ranked for you: you decide what comes next.</p>
      <p role="status" className="mt-4 text-sm font-medium text-slate-700">{needs === 0 ? "Nothing needs your attention right now." : [projectIds.size > 0 && plural(projectIds.size, "project"), researchIdeas.length > 0 && plural(researchIdeas.length, "research gap"), inbox.total > 0 && `${plural(inbox.total, "idea")} in the inbox`].filter(Boolean).join(" · ")}</p>
    </div>
    <div className="grid items-start gap-6 xl:grid-cols-2">
      <div className="min-w-0 space-y-6">
        <Section id="home-projects" title="Projects" count={projectIds.size} hint={`Action required or blocked, waiting on someone else for ${WAITING_THRESHOLD_DAYS} days or more, or due for review.`}>
          {projectIds.size === 0 ? <Empty>No project needs an action, has waited more than {WAITING_THRESHOLD_DAYS} days or is due for review.</Empty>
            : <div className="space-y-5">
              <ProjectGroup id="home-action" title="Action required or blocked" projects={actionProjects} detail={(project) => project.nextAction ?? "No next action written yet."} />
              <ProjectGroup id="home-waiting" title="Waiting too long" projects={waitingProjects} detail={(project) => waitedFor(project, now)} />
              <ProjectGroup id="home-review" title="Due for review" projects={reviewProjects} detail={(project) => project.reviewAt ? `Review was due ${isoDate(project.reviewAt)}` : "Review due"} />
            </div>}
        </Section>
        <Section id="home-research" title="Research gaps" count={researchIdeas.length} hint="Ideas in Researching or Validating with no evidence, or only contradicting evidence.">
          {researchIdeas.length === 0 ? <Empty>Every idea under research has supporting evidence.</Empty>
            : <List>{researchIdeas.map((idea) => <li key={idea.id} className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
              <div className="min-w-0"><Link href={`/private/ideas/${idea.id}#evidence-heading`} className="break-words font-medium hover:text-indigo-700">{idea.title}</Link><p className="mt-1 text-sm text-slate-500">{researchGap(idea.signals)}</p></div>
              <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">{statusLabel(idea.status)}</span>
            </li>)}</List>}
        </Section>
        {staleRepositories.length > 0 && <Section id="home-repositories" title="Quiet repositories" count={staleRepositories.length} hint={`Linked GitHub repositories with no push for ${STALE_REPOSITORY_DAYS} days or more.`}>
          <List>{staleRepositories.map((repo) => <li key={repo.id} className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
            <div className="min-w-0"><Link href={`/private/projects/${repo.id}`} className="break-words font-medium hover:text-indigo-700">{repo.name}</Link><p className="mt-1 break-words text-sm text-slate-500">{repo.repoFullName}</p></div>
            {repo.lastPushAt && <time className="shrink-0 text-xs tabular-nums text-slate-500" dateTime={repo.lastPushAt.toISOString()}>Last push {isoDate(repo.lastPushAt)}</time>}
          </li>)}</List>
        </Section>}
      </div>
      <div className="min-w-0 space-y-6">
        <Section id="home-inbox" title="Inbox" count={inbox.total} hint={inbox.total > inbox.ideas.length ? `The ${inbox.ideas.length} oldest of ${inbox.total}.` : "Oldest first."}
          footer={inbox.total > 0 ? <MoreLink href="/private/ideas?status=INBOX">Open the inbox</MoreLink> : <MoreLink href="/private/ideas">Capture an idea</MoreLink>}>
          {inbox.ideas.length === 0 ? <Empty>The inbox is empty.</Empty>
            : <List>{inbox.ideas.map((idea) => <li key={idea.id} className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
              <Link href={`/private/ideas/${idea.id}`} className="min-w-0 break-words font-medium hover:text-indigo-700">{idea.title}</Link>
              <time className="shrink-0 text-xs tabular-nums text-slate-500" dateTime={idea.createdAt.toISOString()}>{isoDate(idea.createdAt)}</time>
            </li>)}</List>}
        </Section>
        <Section id="home-decisions" title="Latest decisions" footer={<MoreLink href="/private/decisions">Open the decision log</MoreLink>}>
          {decisions.length === 0 ? <Empty>No decisions logged yet.</Empty>
            : <List>{decisions.map((decision) => <li key={decision.id} className="py-3 first:pt-0 last:pb-0">
              <p className="break-words font-medium">{decision.title}</p>
              <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-slate-500"><time className="tabular-nums" dateTime={decision.createdAt.toISOString()}>{isoDate(decision.createdAt)}</time>
                {decision.projectId ? <Link href={`/private/projects/${decision.projectId}`} className="text-indigo-700 hover:text-indigo-900">Project</Link>
                  : decision.ideaId ? <Link href={`/private/ideas/${decision.ideaId}`} className="text-indigo-700 hover:text-indigo-900">Idea</Link> : null}</p>
            </li>)}</List>}
        </Section>
        <Section id="home-finance" title={`Last ${FINANCE_WINDOW_DAYS} days`} hint="Per currency. Currencies are never converted." footer={<MoreLink href="/private/finance">Open the ledger</MoreLink>}>
          {finance.length === 0 ? <Empty>No transactions in the last {FINANCE_WINDOW_DAYS} days.</Empty>
            : <List>{finance.map((total) => <li key={total.currency} className="py-3 first:pt-0 last:pb-0">
              <div className="flex items-baseline justify-between gap-4"><span className="text-xs font-semibold tracking-widest text-slate-500">{total.currency}</span><span className={`text-lg font-semibold tabular-nums ${total.netNegative ? "text-red-700" : "text-slate-900"}`}>{total.net}<span className="ml-2 text-xs font-medium text-slate-500">net</span></span></div>
              <dl className="mt-1 flex flex-wrap justify-end gap-x-4 text-xs tabular-nums"><div className="flex gap-1"><dt className="text-slate-500">Income</dt><dd className="font-medium text-emerald-700">{total.income}</dd></div><div className="flex gap-1"><dt className="text-slate-500">Expenses</dt><dd className="font-medium text-slate-700">{total.expense}</dd></div></dl>
            </li>)}</List>}
        </Section>
      </div>
    </div>
  </section>;
}
