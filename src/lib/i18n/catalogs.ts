import type { Locale } from "./locale";
import { es } from "./es";
import type { Catalog } from "./translate";

/** English needs no catalog: its keys are the text. */
export function catalogFor(locale: Locale): Catalog | null {
  return locale === "es" ? es : null;
}
