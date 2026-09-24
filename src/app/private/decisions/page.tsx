import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/require-auth";
import { listPrivateDecisions } from "@/modules/decisions/queries/decision.queries";
import { CaptureDecisionForm } from "@/modules/decisions/components/capture-decision-form";
import { DecisionList } from "@/modules/decisions/components/decision-list";

export default async function DecisionsPage() {
  if (!(await requireAuth())) redirect("/login");
  const decisions = await listPrivateDecisions();
  return <section>
    <div className="mb-8"><p className="workspace-eyebrow">Decision log</p><h1 className="mt-3 text-4xl font-semibold tracking-tight">Decisions, with their reasons.</h1><p className="mt-3 text-sm leading-6 text-slate-500">Write down what you decided and why, so future you can trust it or revisit it.</p></div>
    <div className="grid items-start gap-7 xl:grid-cols-[minmax(0,1fr)_380px]">
      <DecisionList decisions={decisions} empty="No decisions recorded yet." />
      <aside className="xl:sticky xl:top-8"><CaptureDecisionForm /></aside>
    </div>
  </section>;
}
