import { beforeEach, expect, it, vi } from "vitest";
import { resolve } from "node:path";

const mocks = vi.hoisted(() => ({ existsSync: vi.fn(), loadEnvFile: vi.fn() }));
vi.mock("node:fs", () => ({ existsSync: mocks.existsSync, default: { existsSync: mocks.existsSync } }));
vi.mock("node:process", () => ({ loadEnvFile: mocks.loadEnvFile, default: { loadEnvFile: mocks.loadEnvFile } }));
import { loadDatabaseEnvironment } from "../src/db/load-environment";

beforeEach(() => vi.resetAllMocks());
it("loads local settings before shared defaults", () => {
  mocks.existsSync.mockReturnValue(true);
  loadDatabaseEnvironment("/test-project");
  expect(mocks.loadEnvFile.mock.calls).toEqual([
    [resolve("/test-project", ".env.local")],
    [resolve("/test-project", ".env")],
  ]);
});
it("does not require environment files in CI", () => {
  mocks.existsSync.mockReturnValue(false);
  loadDatabaseEnvironment("/test-project");
  expect(mocks.loadEnvFile).not.toHaveBeenCalled();
});
