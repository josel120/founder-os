import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ requireAuth: vi.fn(), insert: vi.fn(), update: vi.fn(), select: vi.fn(), values: vi.fn() }));
vi.mock("@/lib/require-auth", () => ({ requireAuth: mocks.requireAuth }));
vi.mock("@/db", () => ({ db: { insert: mocks.insert, update: mocks.update, select: mocks.select } }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { createIdea, updateIdeaStatus } from "../src/modules/ideas/actions/idea.actions";
import { getPrivateIdea, listPrivateIdeas } from "../src/modules/ideas/queries/idea.queries";
function input() {
  const data = new FormData();
  data.set("title", "Private test idea");
  data.set("ideaId", "00000000-0000-4000-8000-000000000001");
  data.set("status", "PUBLIC");
  data.set("visibility", "PUBLIC");
  return data;
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.requireAuth.mockResolvedValue(null);
  mocks.insert.mockReturnValue({ values: mocks.values });
  mocks.values.mockResolvedValue(undefined);
});
describe("idea server boundaries", () => {
  it("rejects anonymous creation before accessing the database", async () => {
    expect(await createIdea(input())).toEqual({ ok: false, error: "Unauthorized" });
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it("does not update without authentication", async () => {
    await updateIdeaStatus(input());
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("does not read private ideas without authentication", async () => {
    expect(await listPrivateIdeas()).toEqual([]);
    expect(await getPrivateIdea("00000000-0000-4000-8000-000000000001")).toBeNull();
    expect(mocks.select).not.toHaveBeenCalled();
  });
  it("ignores client attempts to publish or override initial status", async () => {
    mocks.requireAuth.mockResolvedValue({ id: "owner-a" });
    expect(await createIdea(input())).toEqual({ ok: true });
    expect(mocks.values).toHaveBeenCalledWith(expect.objectContaining({ visibility: "PRIVATE", status: "INBOX", ownerId: "owner-a" }));
  });
  it("reports idea insertion failures without exposing database details", async () => {
    mocks.requireAuth.mockResolvedValue({ id: "owner-a" });
    mocks.values.mockRejectedValue(new Error("private database detail"));

    const result = await createIdea(input());

    expect(result).toEqual({ ok: false, error: "Could not save the idea. Please try again." });
    expect(JSON.stringify(result)).not.toContain("private database detail");
  });
  it("rejects invalid status before updating", async () => {
    mocks.requireAuth.mockResolvedValue({ id: "owner-a" });
    await updateIdeaStatus(input());
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it.each(["missing", "database-error", "saved"])("reports confirmed update outcome: %s", async (outcome) => {
    mocks.requireAuth.mockResolvedValue({ id: "owner-a" });
    const returning = vi.fn();
    if (outcome === "database-error") returning.mockRejectedValue(new Error("private database detail"));
    else returning.mockResolvedValue(outcome === "saved" ? [{ id: "existing" }] : []);
    mocks.update.mockReturnValue({ set: () => ({ where: () => ({ returning }) }) });
    const data = input();
    data.set("status", "RESEARCHING");
    const result = await updateIdeaStatus(data);
    expect(result.ok).toBe(outcome === "saved");
    expect(JSON.stringify(result)).not.toContain("private database detail");
  });
});
