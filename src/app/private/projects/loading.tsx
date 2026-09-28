import { getT } from "@/lib/i18n/server";

export default async function ProjectsLoading() {
  const t = await getT();
  return <section aria-busy="true" aria-live="polite"><p className="workspace-eyebrow">{t("Projects")}</p><p className="mt-3 text-sm text-slate-500">{t("Loading your projects…")}</p></section>;
}
