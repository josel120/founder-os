import { expect, it } from "vitest";
import { isUniqueViolation } from "../src/db/errors";
import { createProjectSchema } from "../src/modules/projects/schemas/project.schema";
import { slugify } from "../src/modules/projects/services/slug";

it.each([
  ["Café para niños", "cafe-para-ninos"],
  ["  Founder OS: v2!  ", "founder-os-v2"],
  ["Ünïcödé — Ñandú", "unicode-nandu"],
  ["日本語", ""],
])("slugifies %s", (title, expected) => {
  expect(slugify(title)).toBe(expected);
});

it("never ends a truncated slug with a hyphen, so the owner can still save the project", () => {
  const title = `${"a".repeat(69)} tail`;
  const slug = `${slugify(title)}-0000abcd`;
  expect(slug).toBe(`${"a".repeat(69)}-0000abcd`);
  expect(createProjectSchema.safeParse({ name: "App", slug }).success).toBe(true);
});

it("recognizes a unique violation on a named constraint, including when Drizzle wraps it", () => {
  const pgError = Object.assign(new Error("duplicate key"), { code: "23505", constraint_name: "project_slug_unique" });
  expect(isUniqueViolation(pgError, "project_slug_unique")).toBe(true);
  expect(isUniqueViolation(Object.assign(new Error("Failed query"), { cause: pgError }), "project_slug_unique")).toBe(true);
  expect(isUniqueViolation(pgError, "other_constraint")).toBe(false);
  expect(isUniqueViolation(new Error("connection refused"))).toBe(false);
  expect(isUniqueViolation(null)).toBe(false);
});
