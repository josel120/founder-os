/** Lowercase ASCII slug from free text. Accents are folded ("Café" → "cafe") instead of becoming hyphens. */
export function slugify(text: string, maxLength = 70): string {
  return text.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, maxLength).replace(/-+$/, "");
}
