// Shared E2E helpers (from T-038): cross-owner and anonymous checks. Import them; do not rebuild them per spec.
import { expect, request as apiRequest, type Page } from "@playwright/test";
import postgres from "postgres";
import { e2eBaseUrl, requireDisposableDatabase } from "../e2e-env";

// Interacting before React hydrates lets hydration reset controlled inputs; wait for the page to settle first.
export async function ready(page: Page, action: Promise<unknown>) {
  await action;
  await page.waitForLoadState("networkidle");
}

export const unique = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

// Direct SQL only ever touches the guarded disposable *_e2e database.
export async function withE2eDb<T>(run: (sql: postgres.Sql) => Promise<T>): Promise<T> {
  const sql = postgres(requireDisposableDatabase(), { max: 1, onnotice: () => {} });
  try {
    return await run(sql);
  } finally {
    await sql.end();
  }
}

// Rewrites an ID inside outgoing server action bodies, bypassing whatever the client UI sends.
export async function retargetServerActions(page: Page, fromId: string, toId: string) {
  const retargeted = { count: 0 };
  await page.route("**/*", async (route) => {
    const request = route.request();
    if (request.method() !== "POST" || !request.headers()["next-action"]) return route.continue();
    const body = request.postDataBuffer()?.toString("utf8") ?? "";
    if (!body.includes(fromId)) return route.abort(); // never let an un-retargeted mutation through; the count check fails
    retargeted.count += 1;
    return route.continue({ postData: body.split(fromId).join(toId) });
  });
  return retargeted;
}

export type CapturedAction = { url: string; headers: Record<string, string>; body: Buffer };

// Records the server action request a form sends and aborts it, so the signed-in owner persists nothing.
export async function captureServerAction(page: Page, submit: () => Promise<void>): Promise<CapturedAction> {
  let captured: CapturedAction | undefined;
  await page.route("**/*", async (route) => {
    const request = route.request();
    const headers = request.headers();
    if (request.method() !== "POST" || !headers["next-action"]) return route.continue();
    const forwarded = ["next-action", "next-router-state-tree", "content-type", "accept"].filter((name) => headers[name]);
    captured = { url: request.url(), headers: Object.fromEntries(forwarded.map((name) => [name, headers[name] ?? ""])), body: request.postDataBuffer() ?? Buffer.alloc(0) };
    return route.abort();
  });
  await submit();
  await expect.poll(() => captured !== undefined).toBe(true);
  await page.unroute("**/*");
  if (!captured) throw new Error("No server action request was captured.");
  return captured;
}

// Replays a captured server action with no cookies at all.
export async function replayAnonymously(action: CapturedAction) {
  const api = await apiRequest.newContext({ baseURL: e2eBaseUrl, storageState: { cookies: [], origins: [] } });
  try {
    const response = await api.post(action.url, { headers: { ...action.headers, origin: e2eBaseUrl }, data: action.body, maxRedirects: 0 });
    return { status: response.status(), body: await response.text() };
  } finally {
    await api.dispose();
  }
}

export async function captureIdea(page: Page, title: string) {
  await ready(page, page.goto("/private/ideas"));
  await page.getByLabel("Idea", { exact: true }).fill(title);
  await page.getByRole("button", { name: "+ Capture idea" }).click();
  await expect(page.getByText("Idea saved privately to your inbox.")).toBeVisible();
}
