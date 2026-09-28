"use server";

import { cookies } from "next/headers";
import { LOCALE_COOKIE, localeSchema } from "./locale";

const ONE_YEAR = 60 * 60 * 24 * 365;

/** Saves the interface language. Public: it changes no data, only which language pages render in. */
export async function setLocale(formData: FormData): Promise<{ ok: boolean }> {
  const parsed = localeSchema.safeParse(formData.get("locale"));
  if (!parsed.success) return { ok: false };
  (await cookies()).set(LOCALE_COOKIE, parsed.data, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: ONE_YEAR });
  return { ok: true };
}
