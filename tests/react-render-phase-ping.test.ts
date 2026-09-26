// Regression test for T-061 (ADR-017): Next's vendored React DOM must not drop a ping that fires during render.
// It loads the same React build the App Router bundles (next/dist/compiled/*), in both development and production.
import { createRequire } from "node:module";
import { afterEach, expect, it } from "vitest";
import type { ReactNode } from "react";

type ReactModule = typeof import("react");
type ReactDomClientModule = typeof import("react-dom/client");

const load = createRequire(import.meta.url);

// Loads a fresh copy of the vendored React + React DOM client for one build mode.
function loadVendoredReact(mode: "development" | "production") {
  for (const key of Object.keys(load.cache)) if (key.includes("/next/dist/compiled/")) delete load.cache[key];
  const previous = process.env.NODE_ENV;
  Object.assign(process.env, { NODE_ENV: mode });
  try {
    const react: ReactModule = load("next/dist/compiled/react");
    const client: ReactDomClientModule = load("next/dist/compiled/react-dom/client");
    return { react, client };
  } finally {
    Object.assign(process.env, { NODE_ENV: previous });
  }
}

// Mimics a React Flight chunk: when its row arrives with nobody listening it becomes "resolved_model",
// and it is only parsed by the next read or then(), which then calls the listener synchronously.
class FlightLikeChunk {
  status: "pending" | "resolved_model" | "fulfilled" = "pending";
  value: unknown = null;
  private listeners: ((value: unknown) => void)[] = [];
  constructor(private readonly parse: () => unknown) {}
  arrive() {
    this.status = "resolved_model";
    if (this.listeners.length > 0) this.initialize();
  }
  then(resolve?: (value: unknown) => void) {
    this.initialize();
    if (this.status === "fulfilled") resolve?.(this.value);
    else if (resolve) this.listeners.push(resolve);
  }
  read() {
    this.initialize();
    if (this.status === "fulfilled") return this.value;
    throw this;
  }
  private initialize() {
    if (this.status !== "resolved_model") return;
    this.value = this.parse();
    this.status = "fulfilled";
    for (const listener of this.listeners.splice(0)) listener(this.value);
  }
}

async function waitForText(container: HTMLElement, text: string, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  while (container.textContent !== text && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 10));
  return container.textContent;
}

let unmount: (() => void) | undefined;
afterEach(() => unmount?.());

it.each(["development", "production"] as const)("commits a transition whose lazy Flight chunk arrives while React yields (%s build)", async (mode) => {
  const { react, client } = loadVendoredReact(mode);
  const { createElement, startTransition, Suspense } = react;
  const container = document.createElement("div");
  const root = client.createRoot(container);
  unmount = () => root.unmount();
  const page = (content: ReactNode) => createElement(Suspense, { fallback: createElement("p", null, "loading") }, content);

  // The boundary already shows content, like Next's loading.tsx boundary around a page.
  root.render(page(createElement("p", null, "old")));
  expect(await waitForText(container, "old", 1_000)).toBe("old");

  // The server action / navigation tree: a lazy reference whose row is still streaming.
  const chunk = new FlightLikeChunk(() => createElement("p", null, "new"));
  let reads = 0;
  const lazy = { $$typeof: Symbol.for("react.lazy"), _payload: chunk, _init: (payload: FlightLikeChunk) => {
    if (reads++ === 0) queueMicrotask(() => payload.arrive()); // the row lands right after React yields
    return payload.read();
  } };
  startTransition(() => root.render(page(lazy as unknown as ReactNode)));

  // Unpatched React 19.2 canary drops the synchronous ping and never commits "new".
  expect(await waitForText(container, "new", 1_000)).toBe("new");
  expect(reads).toBeGreaterThan(1);
});
