/**
 * Public pages link only to http(s) URLs. Project URLs are validated on write since T-043, but older rows are not
 * guaranteed, so the scheme is checked again at render: a `javascript:` or `data:` value renders no link at all, and
 * neither does a URL carrying credentials (`user:pass@host`).
 */
export function publicHref(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.username || url.password) return null;
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}
