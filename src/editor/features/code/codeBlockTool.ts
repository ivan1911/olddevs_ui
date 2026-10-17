"use client";

import { Node } from "@tiptap/core";
import { CodeBlockIcon } from "../../../icons.js";
// Type only: a static import of the module would pull the chunk into the "start" bundle.
import type * as CodeBlockChunk from "./codeBlock.js";
import { normalizeCodeLanguage, type CodeLanguageId } from "./codeLanguages.js";
import { SHORTCUT_KEYS, shortcutKeys } from "../../core/shortcuts.js";
import type { ToolDescriptor } from "../../core/toolDescriptor.js";
import { loaded } from "../../core/toolLoader.js";

/*
  The code block chunk: the extension with language and highlighting, the node view with the
  header (`CodeBlockView`), lowlight and the highlight.js grammars: about 30 kB gzip, which
  `basic` does not pay for (ADR-0058, item 11.1).
*/
const loadCodeBlock = () => import("./codeBlock.js");

/**
 * The language of a code Block from the `<pre><code class="…">` markup: the first `language-*`
 * class that the Editor knows. `evil language-js` gives JavaScript, `language-rust` gives
 * "Plain text". One parser serves the engine (`codeBlock.ts`) and the Block's shape in the
 * Skeleton (here). It is not in `codeLanguages.ts`: that file also goes to `RichTextView` and to
 * the server-side Schema input, and they need no DOM parsing.
 */
export function codeLanguageOf(pre: Element): CodeLanguageId | null {
  for (const name of pre.firstElementChild?.classList ?? []) {
    if (!name.startsWith("language-")) continue;
    const language = normalizeCodeLanguage(name.slice("language-".length));
    if (language) return language;
  }
  return null;
}

/**
 * The shape of the code Block for the Skeleton: the same `codeBlock` node, with the same language
 * parsing and the same `<pre><code class="language-…">` markup, but without highlighting, the node
 * view and lowlight. The Skeleton adds the header above it itself (`withCodeHeaders`, `skeleton.ts`).
 */
const CodeBlockShape = Node.create({
  name: "codeBlock",
  group: "block",
  content: "text*",
  marks: "",
  code: true,
  defining: true,
  addAttributes: () => ({
    language: { default: null, parseHTML: codeLanguageOf, rendered: false },
  }),
  parseHTML: () => [{ tag: "pre", preserveWhitespace: "full" }],
  renderHTML: ({ node }) => [
    "pre",
    ["code", node.attrs.language ? { class: `language-${node.attrs.language}` } : {}, 0],
  ],
});

/**
 * The code Block as a built-in Tool's description (ADR-0058, item 11.1): it is absent from `basic`,
 * and its Extensions weigh more than 10 kB, so they are loaded by the same Loader a custom Tool
 * uses. Until it loads, the Editor with a code Block shows the Skeleton (`RichTextEditor.tsx`).
 *
 * The `Mod+Alt+C` shortcut is bound by the extension, so the reference row is only a label
 * (`shortcuts`); the keys of the menu items and of "Format ›" come from `SHORTCUT_KEYS`, and the
 * row's place from `SHORTCUT_ORDER`. The "Code block" button in the "…" menu and in "¶" are Toolbar
 * widgets and remain the kit's.
 */
export const CODE_BLOCK_TOOL: ToolDescriptor = {
  name: "codeBlock",
  load: loadCodeBlock,
  shortcuts: [
    {
      id: "codeBlock",
      group: "blockType",
      tool: "codeBlock",
      keys: SHORTCUT_KEYS.codeBlock,
      label: (m) => m.codeBlock,
    },
  ],
  /*
    The `Alt+F10` of the code Block (into the language button) must fire before the general
    `ToolbarFocus`: the descriptors' Extensions are registered after it (`extensions.ts`), and among
    equal-priority Tiptap extensions the one registered last is asked first.
  */
  engine: ({ focusToolbar }) => [
    (loaded(loadCodeBlock) as typeof CodeBlockChunk).RichCodeBlock.configure({
      focusToolbar,
    }),
  ],
  skeleton: () => [CodeBlockShape],
  kitTags: ["pre", "code"],
  insertItems: [
    {
      id: "codeBlock",
      section: "insert",
      label: (m) => m.codeBlock,
      icon: CodeBlockIcon,
      aliases: ["```", "pre"],
      markdown: "```",
      keys: shortcutKeys("codeBlock"),
      run: (chain) => chain.setCodeBlock(),
    },
    {
      id: "codeBlockFromText",
      section: "turnInto",
      label: (m) => m.codeBlock,
      icon: CodeBlockIcon,
      aliases: ["```", "pre"],
      keys: shortcutKeys("codeBlock"),
      run: (chain) => chain.setCodeBlock(),
    },
  ],
};
