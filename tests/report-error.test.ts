import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { describeError, reportError } from "../src/lib/report-error";

let log: ReturnType<typeof vi.spyOn>;
beforeEach(() => { log = vi.spyOn(console, "error").mockImplementation(() => {}); });
afterEach(() => log.mockRestore());

const secret = "INSERT INTO idea (title) VALUES ('my secret startup') -- owner@example.com";

it("keeps the scope, error class, SQLSTATE and digest from a wrapped driver error", () => {
  const driver = Object.assign(new Error(`duplicate key: ${secret}`), { name: "PostgresError", code: "23505", detail: secret, parameters: ["my secret startup"] });
  const wrapped = Object.assign(new Error(`Failed query: ${secret}`), { name: "DrizzleQueryError", cause: driver, digest: "3141592653" });
  expect(describeError("ideas.create", wrapped)).toEqual({ scope: "ideas.create", error: "DrizzleQueryError", code: "23505", digest: "3141592653" });
});

it("never writes messages, SQL, parameters or details to the log", () => {
  const driver = Object.assign(new Error(secret), { name: "PostgresError", code: "23505", detail: secret, query: secret, parameters: ["my secret startup"] });
  reportError("ideas.create", Object.assign(new Error(secret), { cause: driver }));
  expect(log).toHaveBeenCalledOnce();
  const written = JSON.stringify(log.mock.calls);
  expect(written).not.toContain("secret");
  expect(written).not.toContain("owner@example.com");
  expect(written).not.toContain("INSERT");
  expect(written).toContain('\\"code\\":\\"23505\\"');
});

it.each([
  ["a string", "boom: my secret startup", "Unknown"],
  ["an object", { message: "my secret startup" }, "Error"],
  ["an error with a crafted name", Object.assign(new Error("x"), { name: "my secret startup; DROP" }), "Error"],
  ["null", null, "Unknown"],
])("reduces %s to a fixed-shape report", (_label, error, expected) => {
  const report = describeError("finance.create", error);
  expect(report.error).toBe(expected);
  expect(JSON.stringify(report)).not.toContain("secret");
});

it("ignores codes and digests that are not identifiers", () => {
  expect(describeError("x", Object.assign(new Error("e"), { code: "my secret", digest: "a b c" }))).toEqual({ scope: "x", error: "Error" });
});
