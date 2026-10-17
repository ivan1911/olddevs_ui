"use client";

// The origin of the input and Markdown parsing rules: `@tiptap/extension-code-block` (MIT,
// © 2025 Tiptap GmbH, https://github.com/ueberdosis/tiptap). The fence expressions and the
// parsing of the `code` token are carried over; the language is mapped to the Document's name.
// License: NOTICE at the package root.

import { textblockTypeInputRule } from "@tiptap/core";
import { CodeBlockLowlight } from "@tiptap/extension-code-block-lowlight";
import { Plugin, PluginKey, type EditorState } from "@tiptap/pm/state";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { CODE_LANGUAGE_TRIGGER, CodeBlockView } from "./CodeBlockView.js";
import { codeLanguageOf } from "./codeBlockTool.js";
import { CODE_LANGUAGE_IDS, normalizeCodeLanguage, type CodeLanguageId } from "./codeLanguages.js";
import { highlightCode, type HighlightTree } from "./lowlight.js";

/**
 * The node name is the same as the StarterKit code Block's: the Tool, the Toolbar and the Slash
 * menu rely on it.
 */
export const CODE_BLOCK_NODE = "codeBlock";

export interface RichCodeBlockOptions {
  /** Move focus to the Toolbar: `Alt+F10` from the language button (`extensions.ts`). */
  focusToolbar: () => boolean;
}

/** A Block without a language: the text as is, in one node, without tokens. */
const plain = (value: string): HighlightTree => ({
  type: "root",
  children: [{ type: "text", value }],
});

/**
 * What the extension gets instead of bare lowlight.
 *
 * WHY A WRAPPER. The Tiptap extension calls `highlightAuto` on a Block without a language: it
 * guesses the language from the text. A "Plain text" Block would then be colored as a guessed
 * language out of six, and the same text would be highlighted differently in the Editor and in
 * `RichTextView`, because the server helper does not guess: it highlights only Blocks with a
 * language. The wrapper hands such a Block over as plain text, and maps the Document's language
 * (`html`) to the grammar (`xml`) via `codeLanguages.ts`.
 */
const LOWLIGHT = {
  highlight: (language: string, code: string) => {
    const id = normalizeCodeLanguage(language);
    return id ? highlightCode(id, code) : plain(code);
  },
  highlightAuto: plain,
  listLanguages: () => [...CODE_LANGUAGE_IDS],
};

/** Code Blocks with a language that is not in the Document's form: an alias or an unknown name. */
function strayLanguages(state: EditorState): { pos: number; language: CodeLanguageId | null }[] {
  const found: { pos: number; language: CodeLanguageId | null }[] = [];
  state.doc.descendants((node, pos) => {
    if (node.type.name !== CODE_BLOCK_NODE) return !node.isTextblock;
    const language = normalizeCodeLanguage(node.attrs.language);
    if (language !== node.attrs.language) found.push({ pos, language });
    return false;
  });
  return found;
}

/**
 * A code Block with a language and syntax highlighting (ADR-0051), in place of the StarterKit
 * code Block. The node name, `Mod+Alt+C`, the ```` ``` ```` fence rule and the "Code block" items
 * in the Toolbar and the Slash menu stay as they were.
 *
 * THE LANGUAGE IS ONLY A NAME FROM `codeLanguages.ts`, OR NOTHING. It comes from five places:
 * `value` and HTML paste (`class="language-py"`), the ```` ```py ```` rule, Markdown
 * (```` ```yml ````), paste from VS Code (`vscode-editor-data`) and engine commands. The first
 * three are normalized on input; the rest by an appended transaction (`codeLanguageNormalizer`).
 * An unknown language becomes "Plain text", and the Document gets a `<code>` without a class.
 *
 * THE HIGHLIGHTING IS DECORATIONS. The extension marks tokens `span class="hljs-…"` over the
 * Block's text, and they are absent from `getHTML()`: the Document keeps only `class="language-…"`.
 * The token colors come from the theme in `codeTheme.ts`, through classes on the container.
 */
export const RichCodeBlock = CodeBlockLowlight.extend<RichCodeBlockOptions>({
  name: CODE_BLOCK_NODE,

  addOptions() {
    return {
      ...this.parent!(),
      lowlight: LOWLIGHT,
      focusToolbar: () => false,
    };
  },

  addAttributes() {
    return {
      language: {
        default: null,
        parseHTML: codeLanguageOf,
        rendered: false,
      },
    };
  },

  addInputRules() {
    // The same expressions as the Tiptap code Block; the language name is mapped to the Document's name.
    return [/^```([a-z]+)?[\s\n]$/, /^~~~([a-z]+)?[\s\n]$/].map((find) =>
      textblockTypeInputRule({
        find,
        type: this.type,
        getAttributes: (match) => ({ language: normalizeCodeLanguage(match[1]) }),
      })
    );
  },

  // A copy of the Tiptap code Block's parser: the fence language is mapped to the Document's name.
  parseMarkdown: (token, helpers) => {
    if (
      token.raw?.startsWith("```") === false &&
      token.raw?.startsWith("~~~") === false &&
      token.codeBlockStyle !== "indented"
    ) {
      return [];
    }
    return helpers.createNode(
      CODE_BLOCK_NODE,
      { language: normalizeCodeLanguage(token.lang) },
      token.text ? [helpers.createTextNode(token.text)] : []
    );
  },

  /*
    THE FENCE IS LONGER THAN ANY RUN OF BACKTICKS INSIDE. Tiptap's fence is always ```` ``` ````,
    and a Block that itself contains ```` ``` ```` (a README example in a Markdown Block, a template
    in a code Block) was exported with an inner fence that closed the outer one, so reloading broke
    it into pieces. CommonMark closes a Block only with a fence no shorter than the opening one, so
    we take one backtick more than the longest run, but not fewer than three.
  */
  renderMarkdown: (node, helpers) => {
    const text = node.content ? helpers.renderChildren(node.content) : "";
    const longest = Math.max(0, ...(text.match(/`+/g) ?? []).map((run) => run.length));
    const fence = "`".repeat(Math.max(3, longest + 1));
    const language = (node.attrs?.language as string | null) ?? "";
    return `${fence}${language}\n${text}\n${fence}`;
  },

  addKeyboardShortcuts() {
    return {
      ...this.parent?.(),
      /*
      /*
        `Alt+F10` in a code Block goes to its language button, the same way a selected image sends it
        to the image's panel: an action on the place of the caret is closer to the Toolbar than Tab.
        Tab does not suit here, since it moves focus out of the field, while from the button a repeated
        `Alt+F10` leads on, to the Toolbar. With no button (read-only) the shortcut passes on to the
        Toolbar.
      */
      "Alt-F10": ({ editor }) => {
        const { $from } = editor.state.selection;
        if ($from.parent.type !== this.type || !editor.isEditable) return false;
        const block = editor.view.nodeDOM($from.before());
        const trigger =
          block instanceof HTMLElement
            ? block.querySelector<HTMLElement>(`[${CODE_LANGUAGE_TRIGGER}]`)
            : null;
        if (!trigger) return false;
        trigger.focus();
        return true;
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      ...(this.parent?.() ?? []),
      new Plugin({
        key: new PluginKey("codeLanguageNormalizer"),
        appendTransaction: (transactions, _oldState, state) => {
          if (!transactions.some((transaction) => transaction.docChanged)) return null;
          const stray = strayLanguages(state);
          if (stray.length === 0) return null;
          const { tr } = state;
          for (const { pos, language } of stray) tr.setNodeAttribute(pos, "language", language);
          return tr;
        },
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockView);
  },
});
