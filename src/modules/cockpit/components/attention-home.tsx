import Link from "next/link";
import type { ReactNode } from "react";
import type { Translate } from "@/lib/i18n/translate";
import { ideaStatusKey } from "@/modules/ideas/services/inbox";
import { operationalTone, projectLabel } from "@/modules/projects/components/project-labels";
import type { Attention } from "../queries/attention.queries";
import { FINANCE_WINDOW_DAYS, STALE_REPOSITORY_DAYS, WAITING_THRESHOLD_DAYS } from "../services/attention";

type AttentionProject = Attention["actionProjects"][number];
const day = 24 * 60 * 60 * 1000;
const isoDate = (value: Date) => value.toISOString().slice(0, 10);

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

function ProjectRow({ project, detail, t }: { project: AttentionProject; detail: string; t: Translate }) {
  return <li className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
    <div className="min-w-0"><Link href={`/private/projects/${project.id}`} className="break-words font-medium hover:text-indigo-700">{project.name}</Link><p className="mt-1 break-words text-sm text-slate-500">{detail}</p></div>
    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${operationalTone(project.operationalStatus)}`}>{t(projectLabel(project.operationalStatus))}</span>
  </li>;
}

/** One reason a project is listed; hidden when no project has that reason. */
function ProjectGroup({ id, title, projects, detail, t }: { id: string; title: string; projects: AttentionProject[]; detail: (project: AttentionProject) => string; t: Translate }) {
  if (projects.length === 0) return null;
  return <div role="group" aria-labelledby={id}>
    <h3 id={id} className="mb-2 flex items-baseline justify-between gap-3 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}<span className="tabular-nums">{projects.length}</span></h3>
    <List>{projects.map((project) => <ProjectRow key={project.id} project={project} detail={detail(project)} t={t} />)}</List>
  </div>;
}

function waitedFor(t: Translate, project: AttentionProject, now: Date) {
  if (!project.waitingSince) return project.waitingReason ?? t("Waiting");
  const days = Math.floor((now.getTime() - project.waitingSince.getTime()) / day);
  const base = t(days === 1 ? "Waiting {count} day" : "Waiting {count} days", { count: days });
  return project.waitingReason ? `${base}: ${project.waitingReason}` : base;
}

function researchGap(t: Translate, signals: Attention["researchIdeas"][number]["signals"]) {
  if (signals.supports + signals.contradicts + signals.neutral === 0) return t("No evidence yet.");
  return t(signals.contradicts === 1 ? "{count} contradicting item, nothing supporting." : "{count} contradicting items, nothing supporting.", { count: signals.contradicts });
}

/** Everything that needs the owner, counted from their own records. Read-only: it lists and links, the owner decides. */
export function AttentionHome({ attention, now, t }: { attention: Attention; now: Date; t: Translate }) {
  const { actionProjects, waitingProjects, reviewProjects, inbox, researchIdeas, decisions, finance, staleRepositories } = attention;
  const projectIds = new Set([...actionProjects, ...waitingProjects, ...reviewProjects].map((project) => project.id));
  const needs = projectIds.size + researchIdeas.length + inbox.total;
  const statusParts = [
    projectIds.size > 0 && t(projectIds.size === 1 ? "{count} project" : "{count} projects", { count: projectIds.size }),
    researchIdeas.length > 0 && t(researchIdeas.length === 1 ? "{count} research gap" : "{count} research gaps", { count: researchIdeas.length }),
    inbox.total > 0 && t(inbox.total === 1 ? "{count} idea in the inbox" : "{count} ideas in the inbox", { count: inbox.total }),
  ];
  return <section>
    <div className="mb-8"><p className="workspace-eyebrow">{t("Home")}</p><h1 className="mt-3 text-4xl font-semibold tracking-tight">{t("What needs your attention")}</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">{t("Counted from your own records. Nothing here is scored or ranked for you: you decide what comes next.")}</p>
      <p role="status" className="mt-4 text-sm font-medium text-slate-700">{needs === 0 ? t("Nothing needs your attention right now.") : statusParts.filter(Boolean).join(" · ")}</p>
    </div>
    <div className="grid items-start gap-6 xl:grid-cols-2">
      <div className="min-w-0 space-y-6">
        <Section id="home-projects" title={t("Projects")} count={projectIds.size} hint={t("Action required or blocked, waiting on someone else for {days} days or more, or due for review.", { days: WAITING_THRESHOLD_DAYS })}>
          {projectIds.size === 0 ? <Empty>{t("No project needs an action, has waited more than {days} days or is due for review.", { days: WAITING_THRESHOLD_DAYS })}</Empty>
            : <div className="space-y-5">
              <ProjectGroup id="home-action" title={t("Action required or blocked")} projects={actionProjects} detail={(project) => project.nextAction ?? t("No next action written yet.")} t={t} />
              <ProjectGroup id="home-waiting" title={t("Waiting too long")} projects={waitingProjects} detail={(project) => waitedFor(t, project, now)} t={t} />
              <ProjectGroup id="home-review" title={t("Due for review")} projects={reviewProjects} detail={(project) => project.reviewAt ? t("Review was due {date}", { date: isoDate(project.reviewAt) }) : t("Review due")} t={t} />
            </div>}
        </Section>
        <Section id="home-research" title={t("Research gaps")} count={researchIdeas.length} hint={t("Ideas in Researching or Validating with no evidence, or only contradicting evidence.")}>
          {researchIdeas.length === 0 ? <Empty>{t("Every idea under research has supporting evidence.")}</Empty>
            : <List>{researchIdeas.map((idea) => <li key={idea.id} className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
              <div className="min-w-0"><Link href={`/private/ideas/${idea.id}#evidence-heading`} className="break-words font-medium hover:text-indigo-700">{idea.title}</Link><p className="mt-1 text-sm text-slate-500">{researchGap(t, idea.signals)}</p></div>
              <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">{t(ideaStatusKey(idea.status))}</span>
            </li>)}</List>}
        </Section>
        {staleRepositories.length > 0 && <Section id="home-repositories" title={t("Quiet repositories")} count={staleRepositories.length} hint={t("Linked GitHub repositories with no push for {days} days or more.", { days: STALE_REPOSITORY_DAYS })}>
          <List>{staleRepositories.map((repo) => <li key={repo.id} className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
            <div className="min-w-0"><Link href={`/private/projects/${repo.id}`} className="break-words font-medium hover:text-indigo-700">{repo.name}</Link><p className="mt-1 break-words text-sm text-slate-500">{repo.repoFullName}</p></div>
            {repo.lastPushAt && <time className="shrink-0 text-xs tabular-nums text-slate-500" dateTime={repo.lastPushAt.toISOString()}>{t("Last push")} {isoDate(repo.lastPushAt)}</time>}
          </li>)}</List>
        </Section>}
      </div>
      <div className="min-w-0 space-y-6">
        <Section id="home-inbox" title={t("Inbox")} count={inbox.total} hint={inbox.total > inbox.ideas.length ? t("The {shown} oldest of {total}.", { shown: inbox.ideas.length, total: inbox.total }) : t("Oldest first.")}
          footer={inbox.total > 0 ? <MoreLink href="/private/ideas?status=INBOX">{t("Open the inbox")}</MoreLink> : <MoreLink href="/private/ideas">{t("Capture an idea")}</MoreLink>}>
          {inbox.ideas.length === 0 ? <Empty>{t("The inbox is empty.")}</Empty>
            : <List>{inbox.ideas.map((idea) => <li key={idea.id} className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
              <Link href={`/private/ideas/${idea.id}`} className="min-w-0 break-words font-medium hover:text-indigo-700">{idea.title}</Link>
              <time className="shrink-0 text-xs tabular-nums text-slate-500" dateTime={idea.createdAt.toISOString()}>{isoDate(idea.createdAt)}</time>
            </li>)}</List>}
        </Section>
        <Section id="home-decisions" title={t("Latest decisions")} footer={<MoreLink href="/private/decisions">{t("Open the decision log")}</MoreLink>}>
          {decisions.length === 0 ? <Empty>{t("No decisions logged yet.")}</Empty>
            : <List>{decisions.map((decision) => <li key={decision.id} className="py-3 first:pt-0 last:pb-0">
              <p className="break-words font-medium">{decision.title}</p>
              <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-slate-500"><time className="tabular-nums" dateTime={decision.createdAt.toISOString()}>{isoDate(decision.createdAt)}</time>
                {decision.projectId ? <Link href={`/private/projects/${decision.projectId}`} className="text-indigo-700 hover:text-indigo-900">{t("Project")}</Link>
                  : decision.ideaId ? <Link href={`/private/ideas/${decision.ideaId}`} className="text-indigo-700 hover:text-indigo-900">{t("Idea")}</Link> : null}</p>
            </li>)}</List>}
        </Section>
        <Section id="home-finance" title={t("Last {days} days", { days: FINANCE_WINDOW_DAYS })} hint={t("Per currency. Currencies are never converted.")} footer={<MoreLink href="/private/finance">{t("Open the ledger")}</MoreLink>}>
          {finance.length === 0 ? <Empty>{t("No transactions in the last {days} days.", { days: FINANCE_WINDOW_DAYS })}</Empty>
            : <List>{finance.map((total) => <li key={total.currency} className="py-3 first:pt-0 last:pb-0">
              <div className="flex items-baseline justify-between gap-4"><span className="text-xs font-semibold tracking-widest text-slate-500">{total.currency}</span><span className={`text-lg font-semibold tabular-nums ${total.netNegative ? "text-red-700" : "text-slate-900"}`}>{total.net}<span className="ml-2 text-xs font-medium text-slate-500">{t("net")}</span></span></div>
              <dl className="mt-1 flex flex-wrap justify-end gap-x-4 text-xs tabular-nums"><div className="flex gap-1"><dt className="text-slate-500">{t("Income")}</dt><dd className="font-medium text-emerald-700">{total.income}</dd></div><div className="flex gap-1"><dt className="text-slate-500">{t("Expenses")}</dt><dd className="font-medium text-slate-700">{total.expense}</dd></div></dl>
            </li>)}</List>}
        </Section>
      </div>
    </div>
  </section>;
}
