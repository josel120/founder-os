const fallback = "/private";

/** Accepts only same-origin paths inside the private workspace, so `?next=` can never become an open redirect. */
export function safePrivatePath(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/private") || value.includes("\\") || value.startsWith("//")) return fallback;
  try {
    const base = "http://founder-os.invalid";
    const url = new URL(value, base);
    if (url.origin !== base) return fallback;
    if (url.pathname !== "/private" && !url.pathname.startsWith("/private/")) return fallback;
    return url.pathname + url.search;
  } catch {
    return fallback;
  }
}
