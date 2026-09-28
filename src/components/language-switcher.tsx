"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLocale, useT } from "@/lib/i18n/client";
import { setLocale } from "@/lib/i18n/locale.actions";
import { locales, type Locale } from "@/lib/i18n/locale";

const names: Record<Locale, string> = { en: "English", es: "Español" };

export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const current = useLocale();
  const t = useT();
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function choose(locale: Locale) {
    if (pending || locale === current) return;
    setPending(true);
    try {
      const data = new FormData();
      data.set("locale", locale);
      if ((await setLocale(data)).ok) router.refresh();
    } finally {
      setPending(false);
    }
  }

  return <span role="group" aria-label={t("Language")} className={`inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs font-semibold ${className}`}>
    {locales.map((locale) => <button key={locale} type="button" lang={locale} aria-pressed={locale === current} title={names[locale]} disabled={pending} onClick={() => choose(locale)}
      className={`min-h-8 min-w-10 rounded-md px-2 uppercase ${locale === current ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"}`}>
      <span aria-hidden="true">{locale}</span><span className="sr-only">{names[locale]}</span>
    </button>)}
  </span>;
}
