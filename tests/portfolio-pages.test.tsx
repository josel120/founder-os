import { act } from "react";
import type { ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicProject } from "../src/modules/portfolio/queries/publication.queries";

const m = vi.hoisted(() => ({ list: vi.fn(), one: vi.fn() }));
vi.mock("@/modules/portfolio/queries/publication.queries", () => ({ listPublicProjects: m.list, getPublishedProject: m.one }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NEXT_NOT_FOUND"); }, useRouter: () => ({ refresh: () => {} }) }));
vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => <a href={href} {...rest}>{children}</a> }));
// These pages now call getT() for ADR-023 translations; next/headers has no request context in this unit test, so
// the catalog is mocked to English-only (createTranslator(null)), matching the assertions below (T-098).
vi.mock("@/lib/i18n/server", async () => {
  const { createTranslator } = await import("../src/lib/i18n/translate");
  return { getT: async () => createTranslator(null), getLocale: async () => "en" };
});
import PortfolioPage, { generateMetadata as portfolioMetadata } from "../src/app/portfolio/page";
import PublishedProjectPage, { generateMetadata } from "../src/app/p/[slug]/page";
import nextConfig from "../next.config";
import { publicHref } from "../src/modules/portfolio/services/public-url";

const project = (extra: Partial<PublicProject> = {}): PublicProject => ({
  name: "Habit Garden", slug: "habit-garden", lifecycle: "RELEASED", releasedAt: new Date("2026-08-01T00:00:00Z"),
  website: "https://habit.example", playStoreUrl: null, appStoreUrl: "javascript:alert(1)",
  summary: "A calm habit tracker.", publishedAt: new Date("2026-09-20T00:00:00Z"), ...extra,
});
const params = (slug: string) => ({ params: Promise.resolve({ slug }) });

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.resetAllMocks();
  Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { value: true, configurable: true });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
const render = async (element: ReactNode) => act(async () => root.render(element));

describe("/portfolio", () => {
  it("lists published projects with a link to each, and stays out of search engines", async () => {
    m.list.mockResolvedValue([project(), project({ name: "Second", slug: "second", summary: "Another one." })]);
    await render(await PortfolioPage());
    expect([...container.querySelectorAll("li a")].map((link) => link.getAttribute("href"))).toEqual(["/p/habit-garden", "/p/second"]);
    expect(container.textContent).toContain("A calm habit tracker.");
    expect((await portfolioMetadata()).robots).toEqual({ index: false, follow: false });
  });

  it("shows a calm empty state", async () => {
    m.list.mockResolvedValue([]);
    await render(await PortfolioPage());
    expect(container.querySelector('[role="status"]')?.textContent).toBe("Nothing is published yet.");
  });
});

describe("/p/[slug]", () => {
  it("renders the allowlisted fields and only safe http(s) links", async () => {
    m.one.mockResolvedValue(project());
    await render(await PublishedProjectPage(params("habit-garden")));
    expect(m.one).toHaveBeenCalledWith("habit-garden");
    expect(container.querySelector("h1")?.textContent).toBe("Habit Garden");
    expect(container.textContent).toContain("Released");
    const external = [...container.querySelectorAll('a[target="_blank"]')];
    expect(external.map((link) => [link.textContent, link.getAttribute("href"), link.getAttribute("rel")])).toEqual([["Website", "https://habit.example/", "noopener noreferrer nofollow"]]);
    expect(container.innerHTML).not.toContain("javascript:");
  });

  it("gives private and unknown slugs the same 404 and the same generic metadata", async () => {
    m.one.mockResolvedValue(null);
    await expect(PublishedProjectPage(params("private-project"))).rejects.toThrow("NEXT_NOT_FOUND");
    expect(await generateMetadata(params("private-project"))).toEqual({ title: "Page not found", robots: { index: false, follow: false } });
  });

  it("puts only the name and summary in metadata", async () => {
    m.one.mockResolvedValue(project({ summary: "x".repeat(300) }));
    expect(await generateMetadata(params("habit-garden"))).toEqual({ title: "Habit Garden", description: "x".repeat(160), robots: { index: false, follow: false } });
  });
});

describe("public links and headers", () => {
  it.each([["https://a.example/x", "https://a.example/x"], ["http://a.example", "http://a.example/"], ["javascript:alert(1)", null], ["https://user:pass@a.example", null], ["data:text/html,x", null], ["not a url", null], [null, null]])("publicHref(%s)", (value, expected) => {
    expect(publicHref(value)).toBe(expected);
  });

  it("sends X-Robots-Tag noindex on the portfolio and project pages", async () => {
    const rules = await nextConfig.headers!();
    const noIndexSources = rules.filter((rule) => rule.headers.some((header) => header.key === "X-Robots-Tag")).map((rule) => rule.source);
    expect(noIndexSources).toEqual(expect.arrayContaining(["/portfolio", "/p/:path*"]));
  });
});
