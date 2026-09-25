import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/require-auth";
import { listPrivateProjects } from "@/modules/projects/queries/project.queries";
import { CaptureProjectForm } from "@/modules/projects/components/capture-project-form";
import { isWaiting, operationalTone, projectLabel } from "@/modules/projects/components/project-labels";

export default async function ProjectsPage() {
  if (!(await requireAuth())) redirect("/login");
  const projects = await listPrivateProjects();
  const needsAttention = projects.filter((project) => ["ACTION_REQUIRED", "BLOCKED"].includes(project.operationalStatus)).length;
  const waiting = projects.filter((project) => isWaiting(project.operationalStatus)).length;
  return <section>
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4"><div><p className="workspace-eyebrow">From a possibility to a product</p><h1 className="mt-3 text-4xl font-semibold tracking-tight">Your projects, in motion.</h1><p className="mt-3 text-sm leading-6 text-slate-500">Where each product is, and what it needs from you next.</p></div><a href="#capture-project" className="rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700">+ New project</a></div>
    <div className="mb-8 grid grid-cols-3 gap-3 sm:gap-5">{[{ label: "All projects", value: projects.length, note: "Your portfolio" }, { label: "Needs attention", value: needsAttention, note: "Action required or blocked" }, { label: "Waiting", value: waiting, note: "On a platform, users, review or payment" }].map((item) => <div key={item.label} className="workspace-panel p-4 sm:p-5"><p className="text-xs font-medium text-slate-500">{item.label}</p><p className="mt-3 text-3xl font-semibold tracking-tight">{item.value}</p><p className="mt-2 hidden text-xs text-slate-400 sm:block">{item.note}</p></div>)}</div>
    <div className="grid items-start gap-7 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0"><div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold">Projects</h2><span className="text-xs text-slate-500">Newest first</span></div>
        <div className="space-y-3">{projects.map((project) => <article key={project.id} className="workspace-panel p-5 transition-shadow hover:shadow-md">
          <div className="flex items-start justify-between gap-4"><h3 className="min-w-0 break-words font-semibold"><Link href={`/private/projects/${project.id}`} className="hover:text-indigo-700">{project.name}</Link></h3><div className="flex shrink-0 flex-wrap justify-end gap-2"><span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-700" title="Lifecycle">{projectLabel(project.lifecycle)}</span><span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${operationalTone(project.operationalStatus)}`} title="Operational status">{projectLabel(project.operationalStatus)}</span></div></div>
          <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-500">{project.description || "No description yet."}</p>
          {project.nextAction && <p className="mt-2 text-sm text-slate-700"><span className="font-medium">Next:</span> {project.nextAction}</p>}
          {isWaiting(project.operationalStatus) && project.waitingReason && <p className="mt-2 text-sm text-sky-700">Waiting: {project.waitingReason}</p>}
          <div className="mt-5 flex flex-wrap gap-3 border-t border-slate-100 pt-3 text-xs text-slate-400"><span>{project.slug}</span><span>Private</span><time className="ml-auto" dateTime={project.createdAt.toISOString()}>{project.createdAt.toISOString().slice(0, 10)}</time></div>
        </article>)}</div>
        {projects.length === 0 && <div className="workspace-panel px-6 py-14 text-center"><div aria-hidden="true" className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-indigo-50 text-2xl text-indigo-600">+</div><h3 className="font-semibold">No projects yet.</h3><p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-slate-500">Create a project when an idea is ready to be built. It stays private.</p></div>}
      </div><aside className="xl:sticky xl:top-8"><CaptureProjectForm /><p className="px-4 pt-4 text-xs leading-5 text-slate-400">Nothing here is published automatically.</p></aside>
    </div>
  </section>;
}
