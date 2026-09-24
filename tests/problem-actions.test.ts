import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ owner: vi.fn(), insert: vi.fn(), values: vi.fn(), revalidate: vi.fn(), db: { current: true } }));
vi.mock("@/lib/require-auth", () => ({ requireAuth: mocks.owner }));
vi.mock("@/db", () => ({ get db() { return mocks.db.current ? { insert: mocks.insert } : null; } }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
import { createProblem } from "../src/modules/problems/actions/problem.actions";

function form(title = "Hard onboarding", description = "New founders get lost in setup") {
  const data = new FormData();
  data.set("title", title);
  data.set("description", description);
  return data;
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.db.current = true;
  mocks.owner.mockResolvedValue({ id: "owner-a" });
  mocks.insert.mockReturnValue({ values: mocks.values });
  mocks.values.mockResolvedValue(undefined);
});

it("rejects without an allowed session and does not insert", async () => {
  mocks.owner.mockResolvedValue(null);
  expect(await createProblem(form())).toEqual({ ok: false, error: expect.any(String) });
  expect(mocks.insert).not.toHaveBeenCalled();
});

it("rejects invalid input and does not insert", async () => {
  const result = await createProblem(form("Title", ""));
  expect(result.ok).toBe(false);
  expect(mocks.insert).not.toHaveBeenCalled();
});

it("reports an unavailable database", async () => {
  mocks.db.current = false;
  expect(await createProblem(form())).toEqual({ ok: false, error: "Database is unavailable." });
});

it("reports insert failures without revalidating", async () => {
  mocks.values.mockRejectedValue(new Error("connection reset"));
  expect(await createProblem(form())).toEqual({ ok: false, error: "Could not save the problem. Please try again." });
  expect(mocks.revalidate).not.toHaveBeenCalled();
});

it("confirms success after a private, owner-scoped insert", async () => {
  expect(await createProblem(form())).toEqual({ ok: true });
  expect(mocks.values).toHaveBeenCalledWith(expect.objectContaining({ ownerId: "owner-a", visibility: "PRIVATE" }));
  expect(mocks.revalidate).toHaveBeenCalledWith("/private/problems");
});
