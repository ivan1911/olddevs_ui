/**
 * Языки блока кода ДАННЫМИ (ADR-0051): единственное место, где
 * Редактор знает, какие языки бывают.
 *
 * НОВЫЙ ЯЗЫК — СТРОКА ЗДЕСЬ И ГРАММАТИКА В `lowlight.ts`. Схема
 * (`RICH_TEXT_SCHEMA.codeLanguages`), меню языка у блока, разбор вставки и
 * Markdown, серверный хелпер подсветки читают этот список, а не свои копии.
 * Забытую грамматику ловит тип: `lowlight.ts` держит `Record` по `grammar`.
 *
 * `id` — то, что уходит в Документ (`class="language-<id>"`) и в Markdown
 * (```` ```<id> ````); `grammar` — имя грамматики highlight.js, когда оно не
 * совпадает с `id` (HTML подсвечивает грамматика `xml`). `aliases` — короткие
 * и чужие имена, которые приходят из Markdown, вставки и сохранённого HTML и
 * приводятся к `id` при загрузке: `py` в Документе не остаётся.
 *
 * ИМЕНА ЯЗЫКОВ — ДАННЫЕ, А НЕ СТРОКИ КАТАЛОГА. «Python» и «YAML» не
 * переводятся; через каталог идёт только «Обычный текст» — блок без языка.
 *
 * Модуль серверно-безопасен: данные и чистая функция, без импортов.
 */
export const CODE_LANGUAGES = [
  { id: "python", label: "Python", grammar: "python", aliases: ["py"] },
  { id: "typescript", label: "TypeScript", grammar: "typescript", aliases: ["ts"] },
  { id: "javascript", label: "JavaScript", grammar: "javascript", aliases: ["js"] },
  { id: "go", label: "Go", grammar: "go", aliases: ["golang"] },
  { id: "html", label: "HTML", grammar: "xml", aliases: ["htm"] },
  // JSON — рядом с YAML: оба про данные. Псевдонимов нет намеренно:
  // `jsonc` и `json5` — это комментарии и хвостовые запятые, которых грамматика
  // JSON не знает, и такой блок честнее показать «Обычным текстом», чем
  // подсвеченным с ошибками.
  { id: "json", label: "JSON", grammar: "json", aliases: [] },
  { id: "yaml", label: "YAML", grammar: "yaml", aliases: ["yml"] },
  { id: "markdown", label: "Markdown", grammar: "markdown", aliases: ["md"] },
] as const;

export type CodeLanguage = (typeof CODE_LANGUAGES)[number];
export type CodeLanguageId = CodeLanguage["id"];
export type CodeLanguageGrammar = CodeLanguage["grammar"];

/** Имена языков в порядке меню — то, что бывает в `class="language-…"`. */
export const CODE_LANGUAGE_IDS: readonly CodeLanguageId[] = CODE_LANGUAGES.map(({ id }) => id);

/**
 * Имя языка из чужого источника — к имени Документа. Регистр и пробелы по
 * краям не важны (```` ```Python ````), псевдоним становится именем (`yml` →
 * `yaml`). Неизвестный язык — `null`, то есть «Обычный текст»: блок остаётся,
 * класса у него нет, и санитайзеру такой класс пропускать незачем.
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

/** Описание языка по имени Документа; `null` — «Обычный текст». */
export function codeLanguage(id: CodeLanguageId | null): CodeLanguage | null {
  return CODE_LANGUAGES.find((language) => language.id === id) ?? null;
}
