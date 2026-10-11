---
category: api
status: stable
source: src/editor/index.ts
sourceHash: 2c7fdfa5b00e
---

# Editor extension API

## Summary for AI

A map of how a product extends `RichTextEditor` from `@olddevs/ui/editor`, and the stability boundary of this API. The unit of extension is a **custom Tool** (`CustomTool`): the description of one Editor capability, passed in `tools` mixed in with the kit's names. It carries Blocks and Marks with Schema rules (as data), an Engine part (Tiptap extensions, supplied directly or through a Loader) and UI contributions: buttons, Insert items, Block actions, Text cards. A custom Trigger character (`trigger`) is also available: `@` for mentions opens the same list as `/`. The screen's code controls the field through the Handle (`ref`) and the `useRichTextEditorState` hook, learns about Readiness and Field focus through the `onReady`, `onFocus` and `onBlur` callbacks, puts its own content into the Status line (`status`) and reports an error with the `showNotice` command. The same `tools` array is understood by server-side sanitizing (`sanitizeRichText`, `richTextSchema`) and by `RichTextView` with Islands. Everything listed follows the kit's semver from the first release, the HTML convention is frozen, and a Tiptap major is a kit major (section "Stability"). The details of each item live on the [RichTextEditor](../components/inputs/rich-text-editor.md) page; this page covers the map, the contract boundary and the recipes.

```tsx
import {
  RICH_TEXT_PRESETS,
  RichTextEditor,
  useRichTextEditorState,
  type CustomTool,
  type RichTextEditorHandle,
} from "@olddevs/ui/editor";
import { sanitizeRichText } from "@olddevs/ui/editor/schema";
```

The decision is ADR-0058, which supplements ADR-0050. Capitalized terms come from the [Editor glossary](../glossary.md#редактор).

## When to use

- The Document needs a custom Block, Atom or Mark: a merge tag, an embed, a product card, a comment on a fragment. Their Schema, HTML, Markdown and display in `RichTextView` are described by one Tool.
- Your own command in the Editor's interface: a button on the Toolbar, an Insert item in "/" and "+", a Block action in the Block handle menu, a Text card next to a fragment of text.
- The screen controls the field: it inserts a template at the caret, renders its own panel, saves on focus loss, and shows "Saved" and the word count.
- The server stores a Document with custom Blocks and must sanitize it with the same set of rules as the Editor.

## When not to use

- What you need is already among the kit's Tools (["Tools and Presets"](../components/inputs/rich-text-editor.md#инструменты-и-пресеты)): pass the name in `tools`, do not write a custom Tool.
- To hide a built-in button or item, narrow `tools`. A built-in Tool cannot be replaced by name: turn it off and add a custom Tool under your own name.
- You cannot put arbitrary React in the Toolbar row or in a menu: the kit renders the UI contributions itself. React is allowed only in the content of a popover (of a button, Insert item or Block action) and in a Text card.
- You cannot intercept paste and drop through a prop: the Engine part of a custom Tool handles them (["Paste and drop order"](../components/inputs/rich-text-editor.md#порядок-вставки-и-drop)).
- What is not provided until consumers ask for it (ADR-0058, section 13): `insertImage` and the selection's HTML in the Handle, `onSelectionChange`, `onPaste`, `onDrop`, `onEmpty`, `onDestroy`, history events, a signal about removed images, locked template Blocks, a "menu" UI contribution kind, Text cards and the Status line in `RichTextView`. Until then the screen has `ref.current.editor` and its events.
- Custom Trigger characters like `@` are no longer on this list: they are supported by the `trigger` field of a Tool (ADR-0064, section "Trigger character" below).

## API map

| What                                         | Where in the API                                                                    | Details                                                                                                                                                                                                                                 |
| -------------------------------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Custom Tool                                  | `CustomTool` in `tools`; Presets — `RICH_TEXT_PRESETS`                              | ["Custom Tool"](../components/inputs/rich-text-editor.md#свой-инструмент)                                                                                                                                                               |
| Schema rules and the HTML convention         | `blocks` (`CustomBlock`), `marks` (`CustomMark`), `CustomAttribute`, `PrefixedName` | ["Custom Tool"](../components/inputs/rich-text-editor.md#свой-инструмент)                                                                                                                                                               |
| Button                                       | `buttons` (`CustomToolButton`, `CustomToolPopover`, `CustomToolLabel`)              | ["Custom Tool's button"](../components/inputs/rich-text-editor.md#кнопка-своего-инструмента)                                                                                                                                            |
| Insert item, Block action                    | `insertItems` (`CustomInsertItem`), `blockActions` (`CustomBlockAction`)            | ["Insert items and Block actions"](../components/inputs/rich-text-editor.md#пункты-вставки-и-действия-над-блоком)                                                                                                                       |
| Trigger character                            | `trigger` (`CustomTrigger`, `TriggerItem`, `TriggerContext`)                        | ["Custom Trigger character"](../components/inputs/rich-text-editor.md#свой-символ-триггер)                                                                                                                                              |
| Text card                                    | `textCards` (`CustomTextCard`), the `markRange` helper                              | ["Text card"](../components/inputs/rich-text-editor.md#карточка-у-текста)                                                                                                                                                               |
| Handle and your own panel                    | `RichTextEditorHandle`, `useRichTextEditorState(ref, selector)`                     | ["Handle (`ref`) and your own toolbar outside the field"](../components/inputs/rich-text-editor.md#хэндл-ref-и-своя-панель-вне-поля)                                                                                                    |
| Events                                       | `onReady`, `onFocus`, `onBlur`; paste and drop — by the Engine part                 | ["Events"](../components/inputs/rich-text-editor.md#события)                                                                                                                                                                            |
| Status line and Field notice                 | the `status` prop; the engine command `showNotice`, the `FieldNotice` type          | ["Status line and Field notice"](../components/inputs/rich-text-editor.md#строка-статуса-и-сообщение-поля)                                                                                                                              |
| Loader, Readiness and Skeleton               | `engine: () => import(…)`                                                           | ["Engine part Loader"](../components/inputs/rich-text-editor.md#загрузчик-части-для-движка), ["Skeleton"](../components/inputs/rich-text-editor.md#скелет)                                                                              |
| Atom text: `getText`, `maxLength`, emptiness | `renderText` of the Engine part                                                     | ["Atom text"](../components/inputs/rich-text-editor.md#текст-атома)                                                                                                                                                                     |
| Server, Markdown, View                       | `sanitizeRichText(html, DOMPurify, tools)`, `richTextSchema(tools)`, `RichTextView` | ["Outside the Editor"](../components/inputs/rich-text-editor.md#вне-редактора-сервер-markdown-и-просмотр), [RichTextView, "Custom Tools: the third argument"](../components/content/rich-text-view.md#свои-инструменты-третий-аргумент) |
| Island of a custom Block                     | `CustomBlock.island`, `CustomIslandProps`, the `tools` prop of `RichTextView`       | [RichTextView, "Custom Block's Island"](../components/content/rich-text-view.md#остров-своего-блока)                                                                                                                                    |

## Custom Tool and the HTML convention

There is one description, with two parts inside. The **Schema rules** are plain data with no Tiptap: the Editor, server-side sanitizing and the View read them. The **Engine part** consists entirely of Tiptap extensions (Node, Mark, Extension, ProseMirror plugins, a React node view): behavior only, while the kit sets up HTML parsing and output. The name, the Engine part and a Schema rule for each of its Nodes and Marks are required; everything else has defaults: a plain Block with no traits, exported to Markdown as its content, paragraph rhythm in the View, no UI contributions. A Tool may carry no Block at all — for example, only a paste filter.

Every custom name starts with a Consumer prefix followed by an underscore: the Tool `acme_mergeTag`, the attribute `acme_size`. The kit's names have no underscores, so custom and built-in names do not collide, either in the `tools` array or in a saved Document. The kit writes and reads custom HTML:

| What              | HTML                                                                    |
| ----------------- | ----------------------------------------------------------------------- |
| Block-level Block | `<div data-block="acme_card">…</div>`                                   |
| Inline Atom       | `<span data-block="acme_mergeTag"></span>`                              |
| Mark              | `<span data-mark="acme_comment">…</span>`                               |
| Attribute         | `data-acme_size="m"` — the value follows the rule: list, pattern or URL |

The `tools` array is checked once, when the engine is created (with Loaders, after they have run). A name without a prefix, a name clash, an Engine part with a Node or Mark that has no Schema rule (or the reverse), or a UI contribution without a required field produces an "Editor failed to start" field error, not a silent loss of Blocks on the first save. An unknown **string** in `tools` is still dropped silently.

## UI contributions

The kit renders, the Tool describes. So the ARIA roles, the Toolbar's single Tab stop, `aria-pressed` (only with `isActive`), the tooltip with `Kbd`, the popover frame and the Escape stack are the same for custom UI contributions as for built-in ones. Each surface has **one Slot**, and custom UI contributions appear in it **in the order of `tools`**, and within a Tool in array order:

| UI contribution | Field          | Slot                                                                                                 |
| --------------- | -------------- | ---------------------------------------------------------------------------------------------------- |
| Button          | `buttons`      | A Toolbar group before "Undo" and "Redo"; with `selectionMenu: true`, also the Selection menu        |
| Insert item     | `insertItems`  | The end of its section ("Add" or "Turn into") in "/", "+", "Add ›" and the Block handle's "Format ›" |
| Block action    | `blockActions` | A section of the Block handle menu before "Delete" — for Blocks from `blocks`                        |
| Text card       | `textCards`    | A frame under the text range where the caret is; no more than one is open                            |

- **The label** is a string or a function that receives `{ locale }` (the `UiProvider` locale); the `UiProvider` message catalog is not extended for third-party Tools, and overriding is through the Tool factory's options (recipe below).
- **The icon** is required for a button, item and action: a component with the `IconProps` contract from `@olddevs/ui/icons`, or your own.
- **The popover** — a button, Insert item and Block action have exactly one of `run` and `popover`. The content is a function that receives `{ editor, close }` (for an action, also the Block's `pos`), and the kit provides the frame: the overlay layer, the Editor's popover Glass, the Escape stack, the name (the UI contribution's label), and returning focus and selection to the Document. A Text card sits on the same Glass, so your content does not need a solid background: it would cover the Glass backing. When the system transparency or contrast setting is on, the backing becomes solid on its own anyway. The popover opens at the button (click), at the caret (the button's shortcut, an item from "/", "+", "Add ›", "Format ›" and its shortcut) or at the Block (an action from the Block handle menu and its shortcut).
- **The shortcut** (`shortcut`) is the single source: the kit binds the keyboard shortcut and writes it into the tooltip, `aria-keyshortcuts` and the Shortcuts reference. Keyboard shortcuts of the Engine part do not reach the reference.
- **A disabled Tool** removes its UI contributions from every surface.

## Trigger character

A Tool's `trigger` is not a UI contribution of a Slot but another way into the same list as "/": typing the `char` character (`@`, `#`) at the start of a Block or after a space opens a list of items at the caret, which the Tool returns on demand (`items(query)`, synchronously or as a promise). The kit renders the list: it is the same component as the Insert menu, with search as you type, arrow keys, `Enter`, `Escape` and a "Nothing found" row. Picking an item calls `onSelect(item, { editor, range, query })`, and the handler replaces `range` (the typed `@query`) with a custom node. Inside a word (`a@b.com`) and in code, the list does not open. The character is one printable character, not `/` and not a space, unique in `tools`; a violation produces an error in the `tools` array (ADR-0064, details on the [RichTextEditor](../components/inputs/rich-text-editor.md#свой-символ-триггер) page).

## Handle (`ref`), events, Status line

- **The Handle** (`ref`) — insertion at the caret (`insertHTML`, `insertText` → `boolean`), reading (`getText`, `getSelectedText`, `isEmpty`, `getHTML`, `getMarkdown`, `getJSON`), focus (`focus("start" | "end" | "restore")`, `blur`), history (`undo`, `redo`, `canUndo`, `canRedo`), plus `clear`, `setMarkdown` and `setJSON` (a JSON envelope → `boolean`) and `openSearch({ replace? })`, which opens the find and replace panel. Insertion is an Author edit: a history step, `onChange` after a delay, the `maxLength` limit; past the limit, the insertion does not happen. Before Readiness the methods do not throw and change nothing: `insertHTML` and `insertText` return `false`. `editor` is the raw Tiptap for commands of Marks, Blocks and custom Tools; its API follows the Tiptap major.
- **`useRichTextEditorState(ref, selector)`** — the state of your own panel: re-renders only when the slice changes, `null` before the engine and on the server.
- **`onReady()`** — once per mount, when Readiness arrives; **`onFocus()`** and **`onBlur()`** — report focus on the field as a whole (Document, Toolbar, the kit's popovers, the HTML field); before `onBlur`, a pending `onChange` is flushed.
- **`status`** — the screen's React node in the line under the Document, at the start; the kit's counter is at the end. The kit does not announce the line.
- **`showNotice({ tone: "status" | "error", text } | null)`** — an engine command: one Field notice, a new one replaces the previous; `status` is only announced, `error` is visible as a `role="alert"` line until the next Author edit. The kit's image messages go through the same channel.

## Loaders, Readiness and Skeleton

The Engine part can be supplied by a Loader — `engine: () => import("./engine.js").then((m) => m.engine)`: the server then imports the module with the description, and Tiptap goes into a separate chunk. Loading starts on the first render in the browser, and the promise is cached on the Loader function (so a Loader is one function per module). **Readiness** is when the engine is created and the Loaders of all enabled Tools — custom and the heavy built-in ones (`codeBlock`, `table`) — have run. Before it, the field is a **Skeleton**: the frame, the place of the Toolbar and the Document cleaned by the Schema, with no input and no height jump; on the server, the frame without the Document. A Loader failure is a field error with "Retry", and the Document stays visible. For details, see ["Engine part Loader"](../components/inputs/rich-text-editor.md#загрузчик-части-для-движка) and ["Skeleton"](../components/inputs/rich-text-editor.md#скелет).

## Server, Markdown, View and Island

- **The server** sanitizes the Document with the same `tools` array: `sanitizeRichText(html, DOMPurify, tools)`, the rules as data — `richTextSchema(tools)`. Both are also in the lightweight `@olddevs/ui/editor/schema` without Tiptap and React — together with `markRange`: the description of a custom Tool with a Text card can be built in a server module too. The names of the kit's Tools in `tools` do not narrow the allowlist: sanitizing accepts everything the kit accepts. Without the third argument sanitizing works as before, and custom Blocks are stripped.
- **Markdown** — rules in the Engine part (`renderMarkdown`, `markdownTokenizer`, `parseMarkdown`). Without them a Block is exported as its content, an Atom as Atom text, and the text is not lost.
- **`RichTextView`** shows a custom Block as sanitized HTML with paragraph rhythm; styling is your CSS, keyed on `data-block`. An **Island** is a client component in the Block's `island` field: it comes to life after mounting and only if such a Block is in the Document; for this, `RichTextView` receives the same `tools`.

## Stability

The contract boundary per ADR-0058, item 12. The reviewer checks the changeset type against this section; entries about the extension API begin with the words "Editor, extension:".

**There is no experimental label, and semver applies from the first release.** The contract includes:

- the description of a custom Tool (`CustomTool` and its fields, `trigger` included), UI contributions and their Slots, Schema rules (`CustomBlock`, `CustomMark`, `CustomAttribute`), Block traits;
- the HTML convention (`data-block`, `data-mark`, `data-<prefix>_<name>`);
- the Handle's methods, `useRichTextEditorState`, the `onReady`, `onFocus`, `onBlur` callbacks, the `status` prop, the `showNotice` command and the `FieldNotice` type;
- the third argument of `sanitizeRichText` and `richTextSchema`, the `tools` prop and the Island of `RichTextView`, `markRange`;
- the names of built-in Tools (`ToolName`) and the existence of the Preset arrays `RICH_TEXT_PRESETS` — but not their composition (below).

**Not included:** the kit's DOM and classes around a Slot; the ids of built-in buttons and items; the internal description of built-in Tools (a superset of the public shape) — it is not exported; the exact place of a UI contribution inside a surface; the look of the Skeleton; file and chunk names in `dist`, like any path inside the package (["Public contract"](../conventions.md#публичный-контракт)). The API of the raw `editor` and of the Engine part is Tiptap's API, and it follows the engine's major.

**Neither a minor nor a patch breaks a saved Document.** The HTML convention is frozen: `data-block` and `data-mark` are extended only by addition. If the form has to change, that is a major, and until the next major the kit reads both forms — both in engine parsing and in the sanitizer.

**What counts as breaking is a violation of the contract, not a pixel shift:**

| Change                                                                                         | Version                                             |
| ---------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| A new required field of the description                                                        | major                                               |
| A new Block trait or a default that changes the behavior of already described Blocks           | major                                               |
| Abandoning "one Slot per surface" or "custom UI contributions in the order of `tools`"         | major                                               |
| Moving a UI contribution kind to another surface                                               | major                                               |
| Changing the form of the HTML convention                                                       | major, and both forms are read until the next major |
| A new Tiptap major — even with no changes in the kit's code: the consumer's Engine parts break | major                                               |
| Removing a Tool from a Preset, renaming a Tool                                                 | major                                               |
| Removing a public name                                                                         | major, after `@deprecated` in a minor (below)       |
| A new optional field, a new UI contribution kind, a Handle method or a callback                | minor                                               |
| A new built-in Tool in a Preset                                                                | minor, the changeset line is in bold                |
| A shift of a Slot inside a surface                                                             | minor with a changeset line                         |
| Raising Tiptap's lower bound within a major                                                    | minor                                               |
| Tightening sanitizing for security                                                             | patch or minor with a note in migration-notes       |
| The look of the Skeleton, DOM and classes around a Slot                                        | outside the contract                                |

- **A Tiptap major is a kit major.** The kit supports one Tiptap major at a time; the engine is not in the kit manifest, and the consumer maintains the version range (`^3.31.4`) given on the [RichTextEditor](../components/inputs/rich-text-editor.md#установка) page.
- **A Preset** is "what the kit considers a full set", not a frozen list. If you need a stable composition, pass an exact list of names.
- **Tightening sanitizing** is released with a note in [migration-notes](migration-notes.md): what is now stripped and how to find such Documents. Loosening sanitizing is a separate decision, not a question of version.
- **Deprecate first, remove later.** A replacement comes out in a minor, the old name gets `@deprecated` and one development warning, and is removed in the next major.

## Recipes

### Your own panel outside the field: `preventDefault` on `mousedown`

The buttons of your own panel outside the field call `event.preventDefault()` on `mousedown`: focus stays in the Document, and the floating Toolbar, the Selection menu and the image panel do not hide. The state of the buttons comes from `useRichTextEditorState`, the commands are `ref.current?.editor?.chain().focus()…run()`. The example and details are in [RichTextEditor, "Your own panel"](../components/inputs/rich-text-editor.md#своя-панель-userichtexteditorstate). The rule "a click into your own panel does not clear the selection" is a recipe, not a property of the field.

### "Saved" in the Status line

Autosave on focus loss and announcing the result. The live region stays in the Status line **permanently**, and only its text changes: screen readers often do not read a region that is inserted together with its text. The word count next to it has no `role`, so it is not announced on every edit.

```tsx
import { useRef, useState } from "react";
import { RichTextEditor, type RichTextEditorHandle } from "@olddevs/ui/editor";

function ArticleBody({
  initial,
  save,
}: {
  initial: string;
  save: (html: string) => Promise<void>;
}) {
  const ref = useRef<RichTextEditorHandle>(null);
  const [html, setHtml] = useState(initial);
  const [saved, setSaved] = useState(false);

  return (
    <RichTextEditor
      ref={ref}
      aria-label="Article text"
      value={html}
      onChange={(next) => {
        setHtml(next);
        setSaved(false);
      }}
      // Before onBlur the pending onChange has already been flushed, but the state
      // has not re-rendered yet: take the fresh Document from the Handle.
      onBlur={async () => {
        await save(ref.current?.getHTML() ?? html);
        setSaved(true);
      }}
      status={
        <span className="flex gap-3">
          <span role="status">{saved ? "Saved" : ""}</span>
          <span>{countWords(html)} words</span>
        </span>
      }
    />
  );
}
```

Show a save error where the screen shows form errors: `showNotice` is for the field's own events (a refused paste, a file upload), and the `error` line goes away with the first Author edit. For details about the line, see ["Status line: `status`"](../components/inputs/rich-text-editor.md#строка-статуса-status).

### Removed images: comparing `src` on the server

The Editor has no "image removed from the Document" signal and will not have one until consumers ask for it: undo, cut-and-paste and a co-author's edit would give false positives, and a Document can also change without going through the Editor: through an API request, a migration or another client. So the server finds uploaded files the Document no longer references: on save, it compares the image URLs of the sanitized Document with the previous version.

```ts
import { JSDOM } from "jsdom";
import createDOMPurify from "dompurify";
import { sanitizeRichText } from "@olddevs/ui/editor/schema";
import { EDITOR_TOOLS } from "./editor-tools"; // the same array as in the Editor's `tools`

const { window } = new JSDOM("");
const DOMPurify = createDOMPurify(window);

/** Image URLs of a Document. Parsed in an inert `template`: scripts do not run. */
function imageSources(html: string): Set<string> {
  const template = window.document.createElement("template");
  template.innerHTML = html;
  return new Set(
    [...template.content.querySelectorAll("figure > img[src]")].map((img) =>
      img.getAttribute("src")!
    )
  );
}

export async function saveDocument(id: string, dirty: string) {
  const html = sanitizeRichText(dirty, DOMPurify, EDITOR_TOOLS);
  const before = imageSources((await documents.get(id))?.html ?? "");
  const after = imageSources(html);
  await documents.put(id, html);
  // Do not delete right away: the same file may also be used in another Document, a draft or
  // a version the author brings back with undo. Mark it and decide in a deferred job.
  await uploads.markUnreferenced(
    [...before].filter((src) => !after.has(src)),
    { documentId: id }
  );
}
```

Compare the **sanitized** HTML: only in it is an image guaranteed to be `figure > img` with an absolute `http`/`https` URL. The URL of a custom Block (an attribute of kind `url`) is found the same way: select `[data-block="acme_video"]` and read its `data-acme_src`.

### Labels through factory options

The `UiProvider` message catalog is closed to third-party Tools, so translations and label overrides of a custom Tool are options of its factory. A label function receives `{ locale }` and re-renders when the locale changes; a string suits a single-language app.

```tsx
import { RICH_TEXT_PRESETS, type CustomTool, type CustomToolLabel } from "@olddevs/ui/editor";
import { MentionIcon } from "@olddevs/ui/icons";

interface MentionLabels {
  insert: CustomToolLabel;
}

const DEFAULT_LABELS: MentionLabels = {
  insert: ({ locale }) => (locale.startsWith("ru") ? "Упоминание" : "Mention"),
};

// A Loader is one function per module: the promise is cached on it.
const loadEngine = () => import("./mention-engine.js").then((module) => module.engine);

export function mentionTool(options: { labels?: Partial<MentionLabels> } = {}): CustomTool {
  const labels = { ...DEFAULT_LABELS, ...options.labels };
  return {
    name: "acme_mention",
    engine: loadEngine,
    blocks: {
      acme_mention: {
        kind: "inline",
        attributes: { acme_id: { kind: "pattern", pattern: "[0-9]+" } },
      },
    },
    insertItems: [
      {
        section: "insert",
        label: labels.insert,
        icon: MentionIcon,
        aliases: ["mention", "user"],
        run: (chain) => chain.insertContent({ type: "acme_mention", attrs: { acme_id: null } }),
      },
    ],
  };
}

// The screen: the array is built once per module, not in render:
// `tools` is read when the engine is created.
export const EDITOR_TOOLS = [
  ...RICH_TEXT_PRESETS.full,
  mentionTool({ labels: { insert: "Mention a colleague" } }),
];
```

An empty label does not crash the field: in development there is a `console.error` with the name of the Tool and the UI contribution, and the Tool's name goes into the name and the tooltip.

### `modulepreload` for lazy chunks

The kit does not publish preloads. The chunks of Engine parts (of custom Loaders and of the built-in `codeBlock` and `table` in `full`) start loading on the Editor's first render, and the Skeleton is shown in the meantime. To have a chunk arrive with the page, add a `<link rel="modulepreload">` for it (in React 19, `preloadModule(url)` from `react-dom`); take the hashed URL from your bundler's manifest: the kit's chunk names are not part of the contract. For an example, see [RichTextEditor, "Engine part Loader"](../components/inputs/rich-text-editor.md#загрузчик-части-для-движка); the cost of the "start" and "full" scenarios is in ["Import size"](../getting-started.md#размер-импорта).

## Links

- Pages: [RichTextEditor](../components/inputs/rich-text-editor.md), [RichTextView](../components/content/rich-text-view.md), [Editor glossary](../glossary.md#редактор), [migration-notes](migration-notes.md).
- Decisions: ADR-0058 — the extension API, ADR-0050 — the Editor.
- Source: the entry point `src/editor/index.ts`, the public form of a custom Tool `src/editor/core/customTool.ts`, validation of the `tools` array and wiring `src/editor/core/customToolEngine.ts`, the Handle `src/editor/core/handle.ts`, the hook `src/editor/hooks/useRichTextEditorState.ts`, the Field notice `src/editor/core/fieldNotice.ts`, the Schema and sanitizing `src/editor/core/schema.ts`, Islands `src/editor/core/viewIsland.ts`.
- Tests: `tests/rich-text-editor-custom-tool.test.tsx` (description, Schema, `tools` array validation), `tests/rich-text-editor-custom-button.test.tsx`, `tests/rich-text-editor-custom-ui.test.tsx` and `tests/rich-text-editor-text-card.test.tsx` (UI contributions), `tests/rich-text-editor-handle.test.tsx` and `tests/rich-text-editor-handle-ssr.test.tsx` (the Handle and the hook), `tests/rich-text-editor-events.test.tsx` (callbacks, paste and drop order), `tests/rich-text-editor-notice.test.tsx` (Status line and Field notice), `tests/rich-text-editor-loaders.test.tsx`, `tests/rich-text-editor-skeleton.test.tsx` and `tests/rich-text-editor-lazy-builtins.test.tsx` (Loaders, Skeleton, lazy built-ins), `tests/rich-text-editor-atom-text.test.tsx` (Atom text), `tests/rich-text-editor-custom-markdown.test.tsx`, `tests/editor-sanitize-tools.test.tsx`, `tests/rich-text-view-island.test.tsx`, `tests/editor-entry.test.ts`; test Tools — `tests/editor-test-tools.ts`.
