import { cookies, headers } from "next/headers";
import { catalogFor } from "./catalogs";
import { LOCALE_COOKIE, negotiateLocale, type Locale } from "./locale";
import { createTranslator, type Translate } from "./translate";

export async function getLocale(): Promise<Locale> {
  const [cookieStore, headerList] = await Promise.all([cookies(), headers()]);
  return negotiateLocale(cookieStore.get(LOCALE_COOKIE)?.value, headerList.get("accept-language"));
}

/** For server components, actions and metadata: translates into the viewer's language. */
export async function getT(): Promise<Translate> {
  return createTranslator(catalogFor(await getLocale()));
}
