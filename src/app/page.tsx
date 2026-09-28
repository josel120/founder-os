import { LanguageSwitcher } from "@/components/language-switcher";
import { getT } from "@/lib/i18n/server";

export default async function HomePage() {
  const t = await getT();
  return <main className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-6"><div className="mb-3 flex items-center justify-between gap-4"><p className="text-sm font-medium uppercase tracking-widest text-slate-500">Founder OS</p><LanguageSwitcher /></div><h1 className="text-4xl font-semibold tracking-tight">{t("Build deliberately.")}</h1><p className="mt-4 max-w-xl text-lg text-slate-600">{t("A private system for moving products from problems and ideas to released, sustainable businesses.")}</p><div className="mt-8 flex flex-wrap items-center gap-4"><a className="w-fit rounded-md bg-slate-900 px-4 py-2 text-sm text-white" href="/login">{t("Enter Founder OS")}</a><a className="text-sm font-medium text-slate-700 underline-offset-4 hover:underline" href="/portfolio">{t("See the portfolio")}</a></div></main>;
}
