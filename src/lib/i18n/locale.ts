import { z } from "zod";

// ADR-023: the interface speaks English or Spanish. The owner's own records are never translated.
export const locales = ["en", "es"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";
export const LOCALE_COOKIE = "locale";
export const localeSchema = z.enum(locales);

/** The saved choice wins; otherwise the browser's most preferred supported language; otherwise English. */
export function negotiateLocale(saved: string | undefined, acceptLanguage: string | null): Locale {
  const chosen = localeSchema.safeParse(saved);
  if (chosen.success) return chosen.data;
  const ranked = (acceptLanguage ?? "")
    .split(",")
    .map((part, index) => {
      const [tag = "", ...params] = part.trim().toLowerCase().split(";");
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      const weight = q ? Number(q.slice(2)) : 1;
      return { primary: tag.split("-")[0] ?? "", weight: Number.isFinite(weight) ? weight : 0, index };
    })
    .filter(({ weight }) => weight > 0)
    .sort((a, b) => b.weight - a.weight || a.index - b.index);
  for (const { primary } of ranked) {
    const match = localeSchema.safeParse(primary);
    if (match.success) return match.data;
  }
  return defaultLocale;
}
