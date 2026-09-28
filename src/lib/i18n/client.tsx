"use client";
import { createContext, useContext, useMemo } from "react";
import type { Locale } from "./locale";
import { createTranslator, type Catalog, type Translate } from "./translate";

const I18nContext = createContext<{ locale: Locale; catalog: Catalog | null }>({ locale: "en", catalog: null });

/** The root layout passes the viewer's catalog once; it holds interface text only, never owner records. */
export function I18nProvider({ locale, catalog, children }: Readonly<{ locale: Locale; catalog: Catalog | null; children: React.ReactNode }>) {
  const value = useMemo(() => ({ locale, catalog }), [locale, catalog]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useLocale(): Locale {
  return useContext(I18nContext).locale;
}

export function useT(): Translate {
  const { catalog } = useContext(I18nContext);
  return useMemo(() => createTranslator(catalog), [catalog]);
}
