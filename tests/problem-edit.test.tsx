import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";

const m = vi.hoisted(() => ({ auth: vi.fn(), update: vi.fn(), set: vi.fn(), where: vi.fn(), returning: vi.fn(), revalidate: vi.fn(), refresh: vi.fn() }));
vi.mock("@/lib/require-auth", () => ({ requireAuth: m.auth }));
vi.mock("@/db", () => ({ db: { update: m.update } }));
vi.mock("next/cache", () => ({ revalidatePath: m.revalidate }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: m.refresh }) }));
import { updateProblemContent } from "../src/modules/problems/actions/problem.actions";
import { EditProblemForm } from "../src/modules/problems/components/edit-problem-form";

const problemId = "00000000-0000-4000-8000-0000000000aa";
function form(extra: Record<string, string> = {}) {
  const data = new FormData();
  Object.entries({ problemId, title: "Context loss", description: "Founders juggle tools", ...extra }).forEach(([key, value]) => data.set(key, value));
  return data;
}

beforeEach(() => {
  vi.resetAllMocks();
  m.auth.mockResolvedValue({ id: "owner-a" });
  m.update.mockReturnValue({ set: m.set });
  m.set.mockReturnValue({ where: m.where });
  m.where.mockReturnValue({ returning: m.returning });
  m.returning.mockResolvedValue([{ id: problemId }]);
});

describe("updateProblemContent", () => {
  it("updates title and description only, scoped to id, session owner and PRIVATE", async () => {
    expect(await updateProblemContent(form({ ownerId: "attacker", visibility: "PUBLIC" }))).toEqual({ ok: true });
    expect(Object.keys(m.set.mock.calls[0]![0]).sort()).toEqual(["description", "title", "updatedAt"]);
    const query = new PgDialect().sqlToQuery(m.where.mock.calls[0]![0] as SQL);
    expect(query.sql).toContain('"problem"."owner_id"');
    expect(query.sql).toContain('"problem"."visibility"');
    expect(query.params).toEqual([problemId, "owner-a", "PRIVATE"]);
    expect(m.revalidate).toHaveBeenCalledWith(`/private/problems/${problemId}`);
  });

  it("reports another owner's or a missing problem as not found", async () => {
    m.returning.mockResolvedValue([]);
    expect(await updateProblemContent(form())).toEqual({ ok: false, error: "Problem not found. Changes were not saved." });
  });

  it.each([[{ problemId: "../x" }], [{ title: " " }], [{ description: "" }]])("rejects invalid input %o before touching the database", async (extra) => {
    expect((await updateProblemContent(form(extra))).ok).toBe(false);
    expect(m.update).not.toHaveBeenCalled();
  });

  it("rejects anonymous callers and hides database errors", async () => {
    m.auth.mockResolvedValue(null);
    expect(await updateProblemContent(form())).toEqual({ ok: false, error: "Sign in again to save changes." });
    m.auth.mockResolvedValue({ id: "owner-a" });
    m.returning.mockRejectedValue(new Error("private database detail"));
    expect(await updateProblemContent(form())).toEqual({ ok: false, error: "Could not save changes. Please try again." });
  });
});

describe("EditProblemForm", () => {
  let container: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { value: true, configurable: true });
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });
  afterEach(async () => { await act(async () => root.unmount()); container.remove(); });

  // The form calls the real action (server-only code runs against the mocked db), so the whole path is exercised.
  it("saves the problem content through the action and confirms", async () => {
    await act(async () => root.render(<EditProblemForm problemId={problemId} initialTitle="Context loss" initialDescription="Founders juggle tools" />));
    await act(async () => container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    expect(new PgDialect().sqlToQuery(m.where.mock.calls[0]![0] as SQL).params).toEqual([problemId, "owner-a", "PRIVATE"]);
    expect(container.querySelector('[role="status"]')?.textContent).toBe("Problem updated.");
    expect(Object.keys(m.set.mock.calls[0]![0]).sort()).toEqual(["description", "title", "updatedAt"]);
    expect(m.refresh).toHaveBeenCalledOnce();
  });
});
