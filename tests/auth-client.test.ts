import { afterEach, beforeEach, expect, it, vi } from "vitest";

beforeEach(() => vi.resetModules());
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function firstRequestUrl(): Promise<string> {
  const fetchMock = vi.fn<typeof fetch>(async () => Response.json(null));
  vi.stubGlobal("fetch", fetchMock);
  const { authClient } = await import("../src/lib/auth-client");
  await authClient.getSession();
  const [input] = fetchMock.mock.calls[0] ?? [];
  if (input === undefined) throw new Error("The auth client sent no request.");
  return input instanceof Request ? input.url : String(input);
}

// Vitest's jsdom environment exposes its JSDOM instance, which can move the page to another origin.
const dom = (globalThis as { jsdom?: { reconfigure(options: { url: string }): void } }).jsdom;
const defaultPage = window.location.href;
afterEach(() => dom?.reconfigure({ url: defaultPage }));

it.each([undefined, ""])("uses the page's own origin when NEXT_PUBLIC_BETTER_AUTH_URL is %j (T-062)", async (value) => {
  if (!dom) throw new Error("This test needs Vitest's jsdom environment.");
  vi.stubEnv("NEXT_PUBLIC_BETTER_AUTH_URL", value);
  dom.reconfigure({ url: "https://founder-os-git-master-team.vercel.app/login" });
  expect(await firstRequestUrl()).toBe("https://founder-os-git-master-team.vercel.app/api/auth/get-session");
});

it("keeps local dev and E2E on http://localhost:3000", async () => {
  vi.stubEnv("NEXT_PUBLIC_BETTER_AUTH_URL", undefined);
  dom?.reconfigure({ url: "http://localhost:3000/login" });
  expect(await firstRequestUrl()).toBe("http://localhost:3000/api/auth/get-session");
});

it("ignores a stale NEXT_PUBLIC_BETTER_AUTH_URL and stays on the page's origin (T-064)", async () => {
  if (!dom) throw new Error("This test needs Vitest's jsdom environment.");
  for (const stale of ["https://founder-os.example.com", "http://localhost:3000"]) {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_BETTER_AUTH_URL", stale);
    dom.reconfigure({ url: "https://founder-fnkb0pxq8-team.vercel.app/login" });
    expect(await firstRequestUrl()).toBe("https://founder-fnkb0pxq8-team.vercel.app/api/auth/get-session");
  }
});
