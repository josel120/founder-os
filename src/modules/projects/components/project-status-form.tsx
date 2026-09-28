"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/client";
import { updateProjectStatus } from "../actions/project.actions";
import { isWaiting, lifecycles, operationalStatuses, projectLabel, type ProjectLifecycle, type ProjectOperationalStatus } from "./project-labels";

type ProjectStatusFormProps = {
  projectId: string;
  lifecycle: ProjectLifecycle;
  operationalStatus: ProjectOperationalStatus;
  nextAction: string;
  waitingReason: string;
  waitingSince: string;
  reviewAt: string;
};

const dateFields = ["waitingSince", "reviewAt"] as const;

export function ProjectStatusForm(props: ProjectStatusFormProps) {
  const router = useRouter();
  const t = useT();
  const inFlight = useRef(false);
  const [operationalStatus, setOperationalStatus] = useState(props.operationalStatus);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const waiting = isWaiting(operationalStatus);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    const data = new FormData(event.currentTarget);
    for (const field of dateFields) {
      const value = data.get(field);
      if (typeof value === "string" && value) data.set(field, `${value}T00:00:00.000Z`);
    }
    inFlight.current = true;
    setPending(true); setError(""); setMessage("");
    try {
      const result = await updateProjectStatus(data);
      if (!result.ok) { setError(t(result.error)); return; }
      setMessage(t("Status saved."));
      router.refresh();
    } catch {
      setError(t("Connection interrupted. Check the saved status before retrying."));
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} aria-busy={pending} className="workspace-panel mt-8 space-y-4 p-6">
      <h2 className="text-lg font-semibold">{t("Lifecycle and status")}</h2>
      <p className="text-sm text-slate-500">{t("Lifecycle is where the product is. Operational status is what it needs from you. Changing one never changes the other.")}</p>
      <input type="hidden" name="projectId" value={props.projectId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium">{t("Lifecycle")}
          <select name="lifecycle" defaultValue={props.lifecycle} disabled={pending} className="mt-2 block w-full rounded-md border p-3">{lifecycles.map((value) => <option key={value} value={value}>{t(projectLabel(value))}</option>)}</select>
        </label>
        <label className="block text-sm font-medium">{t("Operational status")}
          <select name="operationalStatus" value={operationalStatus} onChange={(event) => setOperationalStatus(event.target.value as ProjectOperationalStatus)} disabled={pending} className="mt-2 block w-full rounded-md border p-3">{operationalStatuses.map((value) => <option key={value} value={value}>{t(projectLabel(value))}</option>)}</select>
        </label>
      </div>
      <label className="block text-sm font-medium">{t("Next action (optional)")}
        <input name="nextAction" defaultValue={props.nextAction} maxLength={2000} readOnly={pending} className="mt-2 w-full rounded-md border p-3" />
      </label>
      {waiting && <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium">{t("Waiting reason")}
          <input name="waitingReason" defaultValue={props.waitingReason} required maxLength={2000} readOnly={pending} className="mt-2 w-full rounded-md border p-3" />
        </label>
        <label className="block text-sm font-medium">{t("Waiting since")}
          <input name="waitingSince" type="date" defaultValue={props.waitingSince} required readOnly={pending} className="mt-2 w-full rounded-md border p-3" />
        </label>
      </div>}
      <label className="block text-sm font-medium">{t("Review on (optional)")}
        <input name="reviewAt" type="date" defaultValue={props.reviewAt} readOnly={pending} className="mt-2 w-full rounded-md border p-3" />
      </label>
      <button disabled={pending} type="submit" className="rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">{pending ? t("Saving...") : t("Save status")}</button>
      <p role="status" className="text-sm text-green-700">{message}</p>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </form>
  );
}
