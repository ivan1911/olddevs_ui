import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, test } from "vitest";

/**
 * Ворота RSC: раскладка директив `"use client"` по файлам зафиксирована.
 *
 * Зачем. Пакет обещает потребителю, что его компонент импортируется прямо в
 * серверный компонент Next.js App Router — без обёртки. Обещание держится
 * ровно на том, что у каждого файла с клиентским кодом директива стоит первой
 * строкой. Забыть её легко и **незаметно**: у себя в витрине и в jsdom всё
 * работает одинаково, потому что там весь код клиентский. Ломается это у
 * потребителя, в чужой сборке, сообщением про хуки в серверном компоненте.
 *
 * Проверка идёт в обе стороны, и вторая не менее важна первой. Лишняя директива
 * на чистом модуле `lib/` уводит утилиту в клиентский граф: серверный код,
 * которому нужна одна функция форматирования, начинает тянуть за собой границу
 * клиента. Разбор цены — ADR-0029.
 *
 * Список серверно-безопасных модулей — ПЕРЕЧИСЛЕНИЕ С ОБОСНОВАНИЕМ, а не
 * правило «всё в lib/ без директивы». Правило по каталогу разрешало бы завести
 * в `lib/` хук и не заметить этого; перечисление заставляет автора объяснить,
 * почему конкретный файл серверно-безопасен.
 *
 * Собранный `dist` этот тест НЕ смотрит: директиву теряет сборщик, и проверять
 * её надо после сборки. Это делает `npm run check:dist` — он же стоит в джобе
 * `build` и в `release:check`.
 */

const SRC = resolve(import.meta.dirname, "..", "src");

/** Файлы, у которых директивы не должно быть, и почему. */
const SERVER_SAFE = [
  {
    file: "index.ts",
    why:
      "The root barrel. It runs no code of its own, it only re-exports; " +
      "a directive here would drag the pure utilities into the client graph too.",
  },
  {
    file: "color.ts",
    why:
      "The colour entry point. Like the root barrel it runs no code of its own and only " +
      're-exports; the component behind it carries "use client" itself. A directive here ' +
      "would say the module is a boundary, which it is not.",
  },
  {
    file: "editor/index.ts",
    why:
      "The editor entry point (ADR-0050). Like the colour entry it only re-exports; the editor " +
      'component carries "use client" itself, and the entry will also serve the server-safe ' +
      "RichTextView, which a directive here would drag into the client graph.",
  },
  {
    file: "editor/schema-entry.ts",
    why:
      "The light entry point `@olddevs/ui/editor/schema` (OLDSUI-48): it only re-exports the schema " +
      "data and the sanitise config from schema.ts, so a Node server can read them without React " +
      "or Tiptap. tests/editor-schema-entry.test.ts walks its module graph.",
  },
  {
    file: "editor/core/schema.ts",
    why:
      "The editor schema as data: the allow list of tags and attributes. A constant object, " +
      "no React and no Tiptap — a server may read it to configure its sanitiser.",
  },
  {
    file: "editor/core/customTool.ts",
    why:
      "The public form of a custom editor tool: types and one check of an attribute value " +
      "over data. Tiptap appears only as a type, erased in the build, so a server imports " +
      "the description of a custom tool to sanitise with the same rules.",
  },
  {
    file: "editor/core/toolOptions.ts",
    why:
      "tool() and the RichTextTools map (OLDSUI-268): a Configured Tool is plain data, and the " +
      "helper is a function over it. One type-only import, no React and no Tiptap — a server " +
      "module that assembles `tools` imports it next to the custom tool descriptions.",
  },
  {
    file: "editor/core/toolCommands.ts",
    why:
      "The types of the Commands of a tool (OLDSUI-268): interfaces and one conditional type " +
      "over the RichTextTools map, with type-only imports, so nothing is left in the build. " +
      "It sits in the graph of `toolOptions.ts`, which a server module imports.",
  },
  {
    file: "editor/core/handleWatchers.ts",
    why:
      "Subscribers to the Editor handle's engine (watchHandleEditor, notifyHandleEditor) and the " +
      "tool signals next to them: two WeakMaps and a few functions, no React and no Tiptap. Split " +
      "from handle.ts so that RichTextToc can wait for the engine without importing Tiptap (OLDSUI-264).",
  },
  {
    file: "editor/core/toolState.ts",
    why:
      "The snapshots of the built-in tools' State (OLDSUI-268) as interfaces: nothing but types, " +
      "one type-only import. The RichTextTools map refers to them, and a server module that " +
      "declares its own tool in the map imports that map.",
  },
  {
    file: "editor/features/toc/headings.ts",
    why:
      "Collects the headings of a Document for RichTextToc: a DOM walk over a node it is given, " +
      "no React, no Tiptap and nothing at import time. RichTextToc.tsx, the client component, " +
      "carries its own directive.",
  },
  {
    file: "editor/core/viewIsland.ts",
    why:
      "Picks the islands of custom blocks a document needs from `tools` for the server component " +
      "RichTextView (OLDSUI-114): plain data and one function over strings, React only as a type. " +
      "The client island that renders them, BlockIsland.tsx, carries its own directive.",
  },
  {
    file: "editor/features/emoji/emoji.ts",
    why:
      "The curated emoji set of the editor (OLDSUI-68) as data: categories, symbols and message " +
      "keys. A constant object with one type-only import — no React, no DOM, no Tiptap — so a " +
      "server may read it.",
  },
  {
    file: "editor/features/layout/columnLayouts.ts",
    why:
      "The layout variants of the editor (OLDSUI-74) as data and pure functions: names, column " +
      "counts and the nearest variant for foreign widths. One type-only import, no React and no " +
      "Tiptap — schema.ts publishes the variants, so a server reading the schema must import it.",
  },
  {
    file: "editor/features/wrapper/wrapperTones.ts",
    why:
      "The wrapper tones of the editor (OLDSUI-78) as data: tone names, the check of a data-tone " +
      "value and the GitHub alert label of each tone. One type-only import, no React and no " +
      "Tiptap — schema.ts publishes the tones, and scripts/contrast.mjs loads the file directly.",
  },
  {
    file: "editor/core/sourceFormat.ts",
    why:
      "The HTML mode formatter of the editor (OLDSUI-76): a string of document HTML in, the " +
      "same HTML laid out by block out. Pure string scanning — no imports, no DOM, no React and " +
      "no Tiptap — so the formatting is the same on a server as in the browser.",
  },
  {
    file: "editor/ui/focusWithin.ts",
    why:
      "A pure focus predicate for the editor's floating panels: one type-only import, no React, " +
      "no runtime Tiptap — it reads the active element from the panel's own document.",
  },
  {
    file: "editor/styles/palette.ts",
    why:
      "The editor palette and alignments as data: colour names with the kit tokens behind them. " +
      "No imports, no React and no Tiptap — schema.ts reads the names, and scripts/contrast.mjs " +
      "loads the file directly to measure the contrast.",
  },
  {
    file: "editor/features/color/customColor.ts",
    why:
      "The custom colour contract as data and pure functions (OLDSUI-46): the single allowed style " +
      "form, its patterns and the strict parser. No imports, no React and no Tiptap — schema.ts " +
      "publishes the patterns, so a server reading the schema must be able to import it.",
  },
  {
    file: "editor/core/toolDescriptor.ts",
    why:
      "The internal description of an editor tool (OLDSUI-99, ADR-0058): types and pure " +
      "projections of the tool list. Type-only imports — React and Tiptap are erased in the " +
      "build — and the server-safe shortcut table reads its projection, so a directive here " +
      "would drag that table into the client graph.",
  },
  {
    file: "editor/core/shortcuts.ts",
    why:
      "The editor's shortcut table (OLDSUI-67): commands with their keys and catalogue labels, plus " +
      "three pure functions for the labels. Type-only imports, no React and no Tiptap — the toolbar, " +
      "the reference and the selection menu read it, and a server may too.",
  },
  {
    file: "editor/features/color/contrast.ts",
    why:
      "WCAG contrast of two hex colours: two pure functions and a threshold, no imports. " +
      "Server-safe by construction; it carries no state and touches no DOM.",
  },
  {
    file: "editor/styles/tokens.ts",
    why:
      "The mapping from shadcn variables to kit tokens as one class string of Tailwind " +
      "arbitrary properties. Data only; the server-rendered RichTextView applies it too.",
  },
  {
    file: "editor/styles/surface.ts",
    why:
      "The document surface (OLDSUI-52): a type and a function returning the paper sheet's " +
      "data attributes. No imports, no state; the server-rendered RichTextView applies it.",
  },
  {
    file: "editor/styles/glass.ts",
    why:
      "The glass surface classes of the editor's popups (OLDSUI-118): three class strings. " +
      "No imports, no state; data only.",
  },
  {
    file: "editor/highlight-entry.ts",
    why:
      "The light entry point `@olddevs/ui/editor/highlight` (OLDSUI-50, ADR-0051): it only " +
      "re-exports highlightCodeBlocks and highlightCodeNodes (OLDSUI-58), so a server component or a " +
      "Node script highlights code without Tiptap; React comes in only for the nodes helper. " +
      "tests/editor-highlight-entry.test.ts walks its graph.",
  },
  {
    file: "editor/features/code/highlight.ts",
    why:
      "highlightCodeBlocks: a string-to-string function over saved HTML — a regular expression, " +
      "lowlight and a ten-line serialiser. No DOM, no React, no Tiptap; it runs on the server.",
  },
  {
    file: "editor/features/code/highlightNodes.ts",
    why:
      "highlightCodeNodes (OLDSUI-58, ADR-0052): lowlight's token tree turned into React elements " +
      "with createElement — no hooks, no state, no DOM. A server component highlights code for " +
      "CodeView with it, so a directive would push the highlighter into the client bundle.",
  },
  {
    file: "editor/features/code/lowlight.ts",
    why:
      "The lowlight instance with the eight highlight.js grammars the editor knows. Plain JS without " +
      "DOM or React, shared by the editor's decorations and the server-side helper.",
  },
  {
    file: "editor/features/code/codeLanguages.ts",
    why:
      "The code block languages as data: ids, labels, grammars and aliases, plus a pure " +
      "normaliser. No imports — schema.ts publishes the ids, so a server must be able to load it.",
  },
  {
    file: "editor/styles/codeTheme.ts",
    why:
      "The highlighting theme (GitHub Light / Dark) as one class string of Tailwind arbitrary " +
      "properties and variants. Data only; the server-rendered RichTextView carries it via prose.ts.",
  },
  {
    file: "editor/highlight-grammars.d.ts",
    why:
      "Type declarations for highlight.js grammar modules, which ship without .d.ts. Types only: " +
      "nothing of it reaches the runtime, so there is no boundary to declare.",
  },
  {
    file: "editor/RichTextView.tsx",
    why:
      "The server-rendered view of a saved Document: a div with prose classes and the html as " +
      "innerHTML, no state, no effects (useId is the one hook, and server components may call it). " +
      "The only client code in its graph is the CodeCopyIsland file, which carries its own " +
      "directive; no Tiptap, no highlighter — tests/rich-text-view.test.tsx walks the graph.",
  },
  {
    file: "editor/features/code/codeHeader.ts",
    why:
      "The code block header as class strings plus withCodeHeaders, a string-to-string function " +
      "that wraps saved code blocks in the header markup. Imports only codeLanguages.ts; no React " +
      "and no DOM, so the server-rendered RichTextView calls it.",
  },
  {
    file: "editor/styles/prose.ts",
    why:
      "Document typography as a class string, shared by the editor and the server-rendered " +
      "RichTextView. It imports only editor/styles/tokens.ts and carries no React.",
  },
  {
    file: "icons.ts",
    why:
      "A dictionary of meanings over lucide-react. Re-exporting client components from " +
      "a server module is allowed: lucide declares the boundary itself, it has " +
      '"use client" in Icon.mjs.',
  },
  {
    file: "i18n/defaults.ts",
    why:
      "The English fallback of the message catalog. Data, not behaviour: the provider " +
      "reads it, but the module itself runs nothing.",
  },
  {
    file: "i18n/messages.ts",
    why:
      "Catalog types and the merge of user messages with the fallback. It does not " +
      "import React and holds no state.",
  },
  {
    file: "locales/en.ts",
    why:
      "The English locale as its own package entry. An object of strings; it reaches the bundle " +
      "only if it was imported.",
  },
  {
    file: "locales/ru.ts",
    why:
      "The Russian locale as its own package entry. An object of strings; it reaches the bundle " +
      "only if it was imported.",
  },
  {
    file: "components/content/keyboardEditing.ts",
    why:
      "Pure operations over the string and the selection of the on-screen keyboard. It sits next " +
      "to the component, but carries no React; the client part is in Keyboard.tsx.",
  },
  {
    file: "lib/button.ts",
    why:
      "Button classes across the size, tone and variant axes — pure functions over strings, " +
      "shared by Button and by everything that looks like a button.",
  },
  {
    file: "lib/overlay-layer.ts",
    why:
      "The overlay layer registry, the foreign-layer predicate and the z-index scale. No React " +
      "and no module-level side effect: the document is touched inside function bodies only, " +
      "behind a typeof guard. The scale is plain data, and lib/menu.ts — itself server-safe — " +
      "reads it.",
  },
  {
    file: "lib/accessible-name.ts",
    why:
      "The shared accessible-name prop type (exactly one of aria-label and aria-labelledby). " +
      "Types only: the compiled module is empty, so there is nothing to run on either side.",
  },
  {
    file: "lib/empty.ts",
    why:
      "Two pure predicates over a value: what counts as empty in markup, and what counts as a " +
      "showable number. No React, no state, no DOM — a server component calls them like a client one.",
  },
  {
    file: "lib/date.ts",
    why:
      "Guarded ISO date parsing — a pure function over a string, wrapping parseDate in a " +
      "try/catch. table-state parses the address on the server, and the guard has to be " +
      "reachable from there: a directive here would make a malformed link a 500 again.",
  },
  {
    file: "lib/choice-card.ts",
    why:
      "Class strings and the selected-border table of the choice cards, shared by Radio and " +
      "Checkbox and read by scripts/contrast.mjs. Data and a type; no React, no state.",
  },
  {
    file: "lib/dev-warn.ts",
    why:
      "A dev-only console warning, deduplicated by text. No React and no DOM; the only state is " +
      "a module-level Set of shown messages, which is harmless on a server (the warning is " +
      "written once per process). The mode is read from process.env.NODE_ENV inside a try/catch " +
      "at call time, so the module has no load-time side effect.",
  },
  {
    file: "lib/clamp.ts",
    why:
      "A single pure function over numbers. No React, no state, no DOM: " +
      "a server component calls it on a route just like a client one.",
  },
  {
    file: "lib/cn.ts",
    why:
      "Class merging on clsx and tailwind-merge. A public utility that " +
      "a server component calls on a route just like a client one.",
  },
  {
    file: "lib/field.ts",
    why:
      "Field classes and layout constants shared by the text controls. Strings and " +
      "numbers, without React and without touching the document.",
  },
  {
    file: "lib/mask.ts",
    why:
      "Mask formatting, capacity and the format skeleton — pure functions over " +
      "strings, public from the root and testable without rendering.",
  },
  {
    file: "lib/menu.ts",
    why:
      "The menu appearance table, shared by Menu on react-aria and ContextMenu on Radix. " +
      "Class strings and state variants — data; the module carries no React.",
  },
  {
    file: "lib/period.ts",
    why:
      "Date periods over @internationalized/date — pure computations over " +
      "calendar values, without React and without the DOM.",
  },
  {
    file: "lib/progress-status.ts",
    why:
      "The dictionary of work states and its tone table. A type and a constant object: " +
      "it does not import React, holds no state, and a server component may " +
      "lay out backend statuses without moving into the client graph.",
  },
  {
    file: "lib/filter-range.ts",
    why:
      "The label of a range filter token from its bounds and the message catalogue. Pure " +
      "functions over strings and Intl, without React: FilterBar and FilterBarAdd call them, " +
      "and a server component may label a token from a saved address the same way.",
  },
  {
    file: "lib/reorder.ts",
    why:
      "Reordering list items on drag — a pure function over " +
      "an array, called both from a handler and from a test without a DOM.",
  },
  {
    file: "lib/state.ts",
    why:
      "The shared geometry of EmptyState and ErrorState as class strings. Data that " +
      "both components apply; the module itself renders nothing.",
  },
  {
    file: "lib/responsive.ts",
    why:
      "The breakpoint list and the resolver from a per-breakpoint value to classes of a " +
      "component dictionary. Types and a pure function over strings, without React: Grid " +
      "and Carousel apply it, and a server component may lay out the same classes.",
  },
  {
    file: "lib/table-state.ts",
    why:
      "Table state and its serialisation into address parameters. Exactly what " +
      "a server component computes on a route — a directive here would be harmful.",
  },
  {
    file: "lib/tag.ts",
    why:
      "The tag capsule as class strings, shared by TagGroup and TagInput. Data only: " +
      "the module imports nothing and renders nothing.",
  },
  {
    file: "lib/themes.ts",
    why:
      "The theme registry and applying preferences to the document root. It does not " +
      "import React; the document access lives inside a function, not at module level, " +
      "so importing it on the server is safe.",
  },
  {
    file: "lib/interaction-modality.ts",
    why:
      "The input modality tracker: plain functions over document and window, no React. " +
      "Listeners go up only on the first explicit call and the module guards against SSR, " +
      "so importing it runs nothing.",
  },
  {
    file: "lib/time.ts",
    why:
      "Parsing and formatting the time of day — pure functions over strings and " +
      "numbers, without React.",
  },
  {
    file: "lib/touch.ts",
    why:
      "The touch-screen class (hover: none and pointer: coarse) that hides keyboard hints — " +
      "one class string, data; the module carries no React.",
  },
  {
    file: "lib/variants.ts",
    why:
      "Three prop axes and their tokens: class tables plus a pure function " +
      "resolving the variant. The foundation of the whole layout, without React.",
  },
];

const SERVER_SAFE_FILES = new Set(SERVER_SAFE.map((entry) => entry.file));

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    if (!/\.tsx?$/.test(entry.name)) return [];
    // Истории и файлы Code Connect в пакет не уезжают (tsconfig.build.json),
    // контракта RSC не несут: первые живут в витрине, вторые — только у CLI
    // Figma, и ни те, ни другие не импортируются рантаймом потребителя.
    if (entry.name.includes(".stories.") || entry.name.includes(".figma.")) return [];
    return [full];
  });
}

/** Первая значащая строка файла: директива обязана стоять до импортов. */
function firstStatement(file: string): string {
  return readFileSync(file, "utf8").trimStart().split("\n", 1)[0]!.trim();
}

const FILES = sourceFiles(SRC).map((full) => ({
  path: relative(SRC, full).split("\\").join("/"),
  directive: firstStatement(full).startsWith('"use client"'),
}));

describe("the RSC gate", () => {
  test("a client file carries the directive on its first line", () => {
    const missing = FILES.filter(
      (file) => !file.directive && !SERVER_SAFE_FILES.has(file.path)
    ).map((file) => file.path);

    expect(
      missing,
      `A file without "use client". Either put the directive on the first line, or ` +
        `add the file to SERVER_SAFE with a justification of why it is server-safe.` +
        `\n${missing.join("\n")}`
    ).toEqual([]);
  });

  test("a server-safe module has no directive", () => {
    const extra = FILES.filter((file) => file.directive && SERVER_SAFE_FILES.has(file.path)).map(
      (file) => file.path
    );

    expect(
      extra,
      `A stray "use client" on a server-safe module: it will move into the client ` +
        `graph together with everyone importing it.\n${extra.join("\n")}`
    ).toEqual([]);
  });

  test("the list of server-safe modules has not drifted from the tree", () => {
    const known = new Set(FILES.map((file) => file.path));
    const stale = SERVER_SAFE.map((entry) => entry.file).filter((file) => !known.has(file));

    expect(
      stale,
      `A SERVER_SAFE module is missing from src: the list outlived the file and now ` +
        `permits something that does not exist.\n${stale.join("\n")}`
    ).toEqual([]);
  });

  test("every entry in the list carries a justification", () => {
    const empty = SERVER_SAFE.filter((entry) => entry.why.trim().length < 40).map(
      (entry) => entry.file
    );

    expect(empty, `An entry without an explanation:\n${empty.join("\n")}`).toEqual([]);
  });
});
