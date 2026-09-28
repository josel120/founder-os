// ADR-023: English text is the key. A catalog maps it to Spanish; anything missing falls back to English.
// Keys may hold {name} placeholders, always separated by literal text (tests/i18n.test.ts enforces it). A translated string also matches an already-filled English message
// (for example a Zod message with a number in it), so server messages translate where they are shown.
export type Catalog = Readonly<Record<string, string>>;
export type Values = Readonly<Record<string, string | number>>;
export type Translate = (text: string, values?: Values) => string;

const PLACEHOLDER = /\{(\w+)\}/g;
const HAS_PLACEHOLDER = /\{\w+\}/;
const fill = (text: string, values: Values) => text.replace(PLACEHOLDER, (whole, name: string) => (name in values ? String(values[name]) : whole));
const escape = (text: string) => text.replace(/[.*+?^$()|[\]\\]/g, "\\$&");

function compilePatterns(catalog: Catalog) {
  return Object.keys(catalog)
    .filter((key) => HAS_PLACEHOLDER.test(key))
    .map((key) => {
      const names: string[] = [];
      const source = key.split(PLACEHOLDER).map((part, i) => (i % 2 ? (names.push(part), "(.+?)") : escape(part))).join("");
      return { key, names, regex: new RegExp(`^${source}$`) };
    });
}

export function createTranslator(catalog: Catalog | null): Translate {
  if (!catalog) return (text, values) => (values ? fill(text, values) : text);
  const patterns = compilePatterns(catalog);
  return (text, values) => {
    const exact = catalog[text];
    if (exact !== undefined) return values ? fill(exact, values) : exact;
    for (const { key, names, regex } of patterns) {
      const match = regex.exec(text);
      if (match) return fill(catalog[key]!, Object.fromEntries(names.map((name, i) => [name, match[i + 1]!])));
    }
    return values ? fill(text, values) : text;
  };
}
