/**
 * Code Block languages as DATA (ADR-0051): the only place where the Editor knows which languages exist.
 *
 * A NEW LANGUAGE IS A ROW HERE AND A GRAMMAR IN `lowlight.ts`. The Schema
 * (`RICH_TEXT_SCHEMA.codeLanguages`), the Block's language menu, paste and Markdown parsing, and
 * the server-side highlighting helper all read this list rather than keeping copies. A forgotten
 * grammar is caught by the type: `lowlight.ts` keeps a `Record` keyed by `grammar`.
 *
 * `id` is what goes into the Document (`class="language-<id>"`) and into Markdown
 * (```` ```<id> ````). `grammar` is the highlight.js grammar name when it differs from `id` (HTML
 * is highlighted by the `xml` grammar). `aliases` are the short and foreign names that come from
 * Markdown, paste and saved HTML, and they are mapped to `id` on load: `py` does not stay in the
 * Document.
 *
 * LANGUAGE NAMES ARE DATA, NOT CATALOG STRINGS. "Python" and "YAML" are not translated; only
 * "Plain text", a Block without a language, goes through the message catalog.
 *
 * The module is safe for the server: data and a pure function, no imports.
 */
export const CODE_LANGUAGES = [
  { id: "python", label: "Python", grammar: "python", aliases: ["py"] },
  { id: "typescript", label: "TypeScript", grammar: "typescript", aliases: ["ts"] },
  { id: "javascript", label: "JavaScript", grammar: "javascript", aliases: ["js"] },
  { id: "go", label: "Go", grammar: "go", aliases: ["golang"] },
  { id: "html", label: "HTML", grammar: "xml", aliases: ["htm"] },
  // JSON sits next to YAML: both are about data. The aliases are left out on purpose:
  // `jsonc` and `json5` mean comments and trailing commas, which the JSON grammar does not know,
  // and such a Block is more honest shown as "Plain text" than highlighted with errors.
  { id: "json", label: "JSON", grammar: "json", aliases: [] },
  { id: "yaml", label: "YAML", grammar: "yaml", aliases: ["yml"] },
  { id: "markdown", label: "Markdown", grammar: "markdown", aliases: ["md"] },
] as const;

export type CodeLanguage = (typeof CODE_LANGUAGES)[number];
export type CodeLanguageId = CodeLanguage["id"];
export type CodeLanguageGrammar = CodeLanguage["grammar"];

/** Language names in menu order: what appears in `class="language-…"`. */
export const CODE_LANGUAGE_IDS: readonly CodeLanguageId[] = CODE_LANGUAGES.map(({ id }) => id);

/**
 * A language name from a foreign source, mapped to the Document's name. Case and surrounding
 * spaces do not matter (```` ```Python ````), and an alias becomes its name (`yml` → `yaml`).
 * An unknown language gives `null`, that is "Plain text": the Block stays, it has no class, and
 * the sanitizer has no reason to let such a class through.
 */
export function normalizeCodeLanguage(raw: unknown): CodeLanguageId | null {
  if (typeof raw !== "string") return null;
  const name = raw.trim().toLowerCase();
  if (!name) return null;
  const found = CODE_LANGUAGES.find(
    ({ id, aliases }) => id === name || (aliases as readonly string[]).includes(name)
  );
  return found?.id ?? null;
}

/** Description of a language by the Document's name; `null` means "Plain text". */
export function codeLanguage(id: CodeLanguageId | null): CodeLanguage | null {
  return CODE_LANGUAGES.find((language) => language.id === id) ?? null;
}
