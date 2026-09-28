// @vitest-environment node
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { es, esAreas } from "../src/lib/i18n/es";
import { negotiateLocale } from "../src/lib/i18n/locale";
import { createTranslator } from "../src/lib/i18n/translate";

const files = (dir: string): string[] => readdirSync(dir).flatMap((name) => {
  const path = join(dir, name);
  return statSync(path).isDirectory() ? files(path) : /\.tsx?$/.test(name) ? [path] : [];
});
const source = files(join(__dirname, "../src")).filter((path) => !path.includes(join("lib", "i18n", "es")));
// Every literal passed to t(): "…", '…' or `…` without ${}.
const CALL = /\bt\(\s*(?:"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'|`([^`$]*)`)/g;
const keys = new Map<string, string>();
for (const path of source) for (const match of readFileSync(path, "utf8").matchAll(CALL)) {
  const key = match[1] !== undefined ? (JSON.parse(`"${match[1]}"`) as string) : match[2] !== undefined ? match[2].replace(/\\'/g, "'") : match[3]!;
  keys.set(key, path);
}
const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("Spanish catalog (ADR-023)", () => {
  it("translates every literal the interface passes to t()", () => {
    expect(keys.size).toBeGreaterThan(20);
    const missing = [...keys].filter(([key]) => es[key] === undefined).map(([key, path]) => `${path.split("src/")[1]}: ${key}`);
    expect(missing).toEqual([]);
  });

  it("has no empty entries, keeps each placeholder, and never gives one key two translations", () => {
    for (const [key, value] of Object.entries(es)) {
      expect(value.trim(), key).not.toBe("");
      expect(placeholders(value), key).toEqual(placeholders(key));
      // Adjacent placeholders ("{a}{b}") compile to back-to-back lazy groups that can backtrack badly.
      expect(key, "separate placeholders with literal text").not.toMatch(/\}\{/);
    }
    const seen = new Map<string, string>();
    for (const catalog of Object.values(esAreas)) for (const [key, value] of Object.entries(catalog)) {
      if (seen.has(key)) expect(value, `duplicate key with a different translation: ${key}`).toBe(seen.get(key));
      seen.set(key, value);
    }
  });
});

describe("translator", () => {
  const t = createTranslator({ "Save": "Guardar", "Keep it under {max} characters": "Menos de {max} caracteres", "{count} of {limit} used": "{count} de {limit} usadas" });
  it("translates exact text, fills placeholders and falls back to English", () => {
    expect(t("Save")).toBe("Guardar");
    expect(t("{count} of {limit} used", { count: 2, limit: 20 })).toBe("2 de 20 usadas");
    expect(t("Not in the catalog")).toBe("Not in the catalog");
    expect(t("Hello {name}", { name: "Ana" })).toBe("Hello Ana");
  });
  it("translates an already-filled English message, such as a Zod error", () => {
    expect(t("Keep it under 160 characters")).toBe("Menos de 160 caracteres");
    expect(t("Keep it under")).toBe("Keep it under");
  });
  it("leaves English untouched without a catalog", () => {
    expect(createTranslator(null)("{n} runs", { n: 3 })).toBe("3 runs");
  });
  it("treats catalog text as literal, not as a pattern", () => {
    expect(createTranslator({ "Cost (USD) {n}.": "Coste (USD) {n}." })("Cost (USD) 5.")).toBe("Coste (USD) 5.");
    expect(createTranslator({ "Cost (USD) {n}.": "Coste (USD) {n}." })("Cost xUSDx 5!")).toBe("Cost xUSDx 5!");
  });
});

describe("negotiateLocale", () => {
  it("prefers the saved choice, then the browser's ranked languages, then English", () => {
    expect(negotiateLocale("es", "en-US")).toBe("es");
    expect(negotiateLocale("fr", "es-MX,es;q=0.9,en;q=0.8")).toBe("es");
    expect(negotiateLocale(undefined, "fr-FR, en;q=0.5, es;q=0.7")).toBe("es");
    expect(negotiateLocale(undefined, "de, fr")).toBe("en");
    expect(negotiateLocale(undefined, "es;q=0, en")).toBe("en");
    expect(negotiateLocale(undefined, null)).toBe("en");
  });
});
