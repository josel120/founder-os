// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ set: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ set: m.set }) }));
import { setLocale } from "../src/lib/i18n/locale.actions";

const form = (value: string) => { const data = new FormData(); data.set("locale", value); return data; };
beforeEach(() => vi.resetAllMocks());

it("saves a supported language in an httpOnly, same-site cookie for a year", async () => {
  expect(await setLocale(form("es"))).toEqual({ ok: true });
  expect(m.set).toHaveBeenCalledWith("locale", "es", expect.objectContaining({ httpOnly: true, sameSite: "lax", path: "/", maxAge: 31_536_000 }));
});

it("refuses anything else without setting a cookie", async () => {
  for (const value of ["fr", "", "es; path=/admin", "EN"]) expect(await setLocale(form(value))).toEqual({ ok: false });
  expect(m.set).not.toHaveBeenCalled();
});
