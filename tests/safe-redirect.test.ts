import { expect, it } from "vitest";
import { safePrivatePath } from "../src/lib/safe-redirect";

it.each([
  ["/private/ideas", "/private/ideas"],
  ["/private/projects/00000000-0000-4000-8000-000000000002", "/private/projects/00000000-0000-4000-8000-000000000002"],
  ["/private/ideas?q=pricing&status=INBOX", "/private/ideas?q=pricing&status=INBOX"],
  ["/private", "/private"],
])("keeps the private path %s", (value, expected) => {
  expect(safePrivatePath(value)).toBe(expected);
});

it.each([
  undefined, ["/private/ideas"], "", "https://evil.example/private", "//evil.example/private", "/\\evil.example",
  "/private\\@evil.example", "/privately", "/private/../login", "/login", "javascript:alert(1)", "/private/%2e%2e/api",
])("falls back to the private home for %s", (value) => {
  expect(safePrivatePath(value)).toBe("/private");
});
