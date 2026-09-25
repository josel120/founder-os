import { beforeEach, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ auth: vi.fn(), select: vi.fn(), from: vi.fn(), where: vi.fn(), limit: vi.fn(), orderBy: vi.fn(), insert: vi.fn(), values: vi.fn(), refresh: vi.fn() }));
vi.mock("@/lib/require-auth", () => ({ requireAuth: m.auth }));
vi.mock("@/db", () => ({ db: { select: m.select, insert: m.insert } }));
vi.mock("next/cache", () => ({ revalidatePath: m.refresh }));
import { createDecision } from "@/modules/decisions/actions/decision.actions";
import { listDecisionsForProject } from "@/modules/decisions/queries/decision.queries";

const projectId = "00000000-0000-4000-8000-000000000002";
function form(extra: Record<string, string> = {}) {
  const data = new FormData();
  data.set("title", "Distribution channel");
  data.set("decision", "Start with direct outreach");
  data.set("reason", "Fastest feedback loop");
  data.set("projectId", projectId);
  for (const [key, value] of Object.entries(extra)) data.set(key, value);
  return data;
}

beforeEach(() => {
  vi.resetAllMocks();
  m.auth.mockResolvedValue({ id: "owner-a" });
  m.select.mockReturnValue({ from: m.from });
  m.from.mockReturnValue({ where: m.where });
  m.where.mockReturnValue({ limit: m.limit, orderBy: m.orderBy });
  m.limit.mockResolvedValue([{ id: projectId }]);
  m.orderBy.mockResolvedValue([]);
  m.insert.mockReturnValue({ values: m.values });
  m.values.mockResolvedValue(undefined);
});

it("verifies a private owned project before saving a decision", async () => {
  expect(await createDecision(form())).toEqual({ ok: true });
  expect(m.values).toHaveBeenCalledWith(expect.objectContaining({ projectId, ideaId: null, ownerId: "owner-a", visibility: "PRIVATE" }));
  expect(m.refresh).toHaveBeenCalledWith(`/private/projects/${projectId}`);
});

it("rejects a missing or inaccessible project without inserting", async () => {
  m.limit.mockResolvedValue([]);
  expect(await createDecision(form())).toEqual({ ok: false, error: "Project not found. The decision was not saved." });
  expect(m.insert).not.toHaveBeenCalled();
});

it("does not allow a decision to link both an idea and a project", async () => {
  expect(await createDecision(form({ ideaId: "00000000-0000-4000-8000-000000000001" }))).toEqual({ ok: false, error: "A decision can link to one record only." });
  expect(m.insert).not.toHaveBeenCalled();
});

it("lists only owner-scoped private project decisions", async () => {
  await listDecisionsForProject(projectId);
  expect(m.orderBy).toHaveBeenCalledOnce();
  expect(m.where).toHaveBeenCalledOnce();
});

it("returns no project decisions for anonymous or malformed requests", async () => {
  expect(await listDecisionsForProject("bad")).toEqual([]);
  m.auth.mockResolvedValue(null);
  expect(await listDecisionsForProject(projectId)).toEqual([]);
  expect(m.select).not.toHaveBeenCalled();
});
