import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  update: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/require-auth", () => ({ requireAuth: mocks.requireAuth }));
vi.mock("@/db", () => ({ db: { update: mocks.update } }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { updateIdeaContent } from "../src/modules/ideas/actions/idea.actions";

const ideaId = "00000000-0000-4000-8000-000000000001";

function form(values: Record<string, string> = {}) {
  const data = new FormData();
  data.set("ideaId", ideaId);
  data.set("title", "Refined idea");
  data.set("description", "A clearer description");
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.requireAuth.mockResolvedValue({ id: "owner-a" });
  mocks.update.mockReturnValue({
    set: () => ({
      where: () => ({ returning: vi.fn().mockResolvedValue([{ id: ideaId }]) }),
    }),
  });
});

describe("updateIdeaContent", () => {
  it("rejects anonymous requests before updating", async () => {
    mocks.requireAuth.mockResolvedValue(null);
    expect(await updateIdeaContent(form())).toEqual({ ok: false, error: "Sign in again to save changes." });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("rejects invalid input before updating", async () => {
    expect(await updateIdeaContent(form({ title: " " }))).toEqual({ ok: false, error: "Title is required" });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("updates the editable fields and revalidates both idea views", async () => {
    expect(await updateIdeaContent(form())).toEqual({ ok: true });
    expect(mocks.update).toHaveBeenCalledOnce();
    expect(mocks.revalidatePath).toHaveBeenNthCalledWith(1, "/private/ideas");
    expect(mocks.revalidatePath).toHaveBeenNthCalledWith(2, `/private/ideas/${ideaId}`);
  });

  it.each(["missing", "database-error"])("reports a confirmed failure: %s", async (outcome) => {
    const returning = vi.fn();
    if (outcome === "missing") returning.mockResolvedValue([]);
    else returning.mockRejectedValue(new Error("private database detail"));
    mocks.update.mockReturnValue({ set: () => ({ where: () => ({ returning }) }) });

    const result = await updateIdeaContent(form());

    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain("private database detail");
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
