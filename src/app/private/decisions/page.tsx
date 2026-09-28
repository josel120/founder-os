import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getT } from "@/lib/i18n/server";
import { requireAuth } from "@/lib/require-auth";
import { listPrivateDecisions } from "@/modules/decisions/queries/decision.queries";
import { listPrivateIdeas } from "@/modules/ideas/queries/idea.queries";
import { listPrivateProjects } from "@/modules/projects/queries/project.queries";
import { CaptureDecisionForm } from "@/modules/decisions/components/capture-decision-form";
import { DecisionList } from "@/modules/decisions/components/decision-list";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Decisions") };
}

export default async function DecisionsPage() {
  if (!(await requireAuth())) redirect("/login");
  const t = await getT();
  const [decisions, ideas, projects] = await Promise.all([listPrivateDecisions(), listPrivateIdeas(), listPrivateProjects()]);
  // Names come from the owner's own lists, so a link can only point at a record the owner can open.
  const ideaNames = new Map(ideas.map((idea) => [idea.id, idea.title]));
  const projectNames = new Map(projects.map((project) => [project.id, project.name]));
  const withContext = decisions.map((item) => {
    const idea = item.ideaId ? ideaNames.get(item.ideaId) : undefined;
    const project = item.projectId ? projectNames.get(item.projectId) : undefined;
    const context = idea !== undefined ? { href: `/private/ideas/${item.ideaId}`, label: t("Idea: {name}", { name: idea }) }
      : project !== undefined ? { href: `/private/projects/${item.projectId}`, label: t("Project: {name}", { name: project }) } : undefined;
    return { ...item, context };
  });
  return <section>
    <div className="mb-8"><p className="workspace-eyebrow">{t("Decision log")}</p><h1 className="mt-3 text-4xl font-semibold tracking-tight">{t("Decisions, with their reasons.")}</h1><p className="mt-3 text-sm leading-6 text-slate-500">{t("Write down what you decided and why, so future you can trust it or revisit it.")}</p></div>
    <div className="grid items-start gap-7 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="min-w-0"><DecisionList decisions={withContext} empty={t("No decisions recorded yet.")} t={t} /></div>
      <aside className="xl:sticky xl:top-8"><CaptureDecisionForm /></aside>
    </div>
  </section>;
}
