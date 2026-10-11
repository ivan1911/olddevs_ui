"use client";

// Происхождение правил ввода и разбора Markdown: `@tiptap/extension-code-block`
// (MIT, © 2025 Tiptap GmbH, https://github.com/ueberdosis/tiptap) — выражения
// ограды и разбор токена `code` перенесены, язык приводится к имени Документа.
// Лицензия — NOTICE в корне пакета.

import { textblockTypeInputRule } from "@tiptap/core";
import { CodeBlockLowlight } from "@tiptap/extension-code-block-lowlight";
import { Plugin, PluginKey, type EditorState } from "@tiptap/pm/state";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { CODE_LANGUAGE_TRIGGER, CodeBlockView } from "./CodeBlockView.js";
import { codeLanguageOf } from "./codeBlockTool.js";
import { CODE_LANGUAGE_IDS, normalizeCodeLanguage, type CodeLanguageId } from "./codeLanguages.js";
import { highlightCode, type HighlightTree } from "./lowlight.js";

/** Имя узла — то же, что у блока кода StarterKit: на нём держатся `Tool`, Панель и Меню вставки. */
export const CODE_BLOCK_NODE = "codeBlock";

export interface RichCodeBlockOptions {
  /** Перевести фокус в Панель — `Alt+F10` с кнопки языка (`extensions.ts`). */
  focusToolbar: () => boolean;
}

/** Блок без языка — текст как есть, одним узлом, без токенов. */
const plain = (value: string): HighlightTree => ({
  type: "root",
  children: [{ type: "text", value }],
});

/**
 * Что получает расширение вместо голого lowlight.
 *
 * ПОЧЕМУ ОБЁРТКА. Расширение Tiptap на блоке без языка зовёт `highlightAuto` —
 * угадывает язык по тексту. «Обычный текст» тогда раскрашивался бы как
 * случайный из шести, а у одинакового текста в Редакторе и в `RichTextView`
 * была бы разная подсветка: серверный хелпер не угадывает, он подсвечивает
 * только блоки с языком. Обёртка отдаёт такой блок текстом, а язык Документа
 * (`html`) переводит в грамматику (`xml`) по `codeLanguages.ts`.
 */
const LOWLIGHT = {
  highlight: (language: string, code: string) => {
    const id = normalizeCodeLanguage(language);
    return id ? highlightCode(id, code) : plain(code);
  },
  highlightAuto: plain,
  listLanguages: () => [...CODE_LANGUAGE_IDS],
};

/** Блоки кода с языком не в форме Документа: псевдоним или неизвестное имя. */
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
 * Блок кода с языком и подсветкой (ADR-0051) вместо блока кода
 * StarterKit. Имя узла, `Mod+Alt+C`, правило ```` ``` ```` и пункты «Блок кода»
 * в Панели и в Меню вставки остаются прежними.
 *
 * ЯЗЫК — ТОЛЬКО ИМЯ ИЗ `codeLanguages.ts` ИЛИ НИЧЕГО. Он приходит из пяти
 * мест: `value` и вставка HTML (`class="language-py"`), правило ```` ```py ````,
 * Markdown (```` ```yml ````), вставка из VS Code (`vscode-editor-data`) и
 * команды движка. Первые три приводятся на входе, остальные — дописанной
 * транзакцией (`codeLanguageNormalizer`); неизвестный язык становится
 * «Обычным текстом», и в Документ уходит `<code>` без класса.
 *
 * ПОДСВЕТКА — ДЕКОРАЦИИ. Расширение размечает токены `span class="hljs-…"`
 * поверх текста блока, и в `getHTML()` их нет: в Документе остаётся только
 * `class="language-…"`. Цвета токенов — тема в `codeTheme.ts`, классами на
 * контейнере.
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
    // Те же выражения, что у блока кода Tiptap; имя языка — к имени Документа.
    return [/^```([a-z]+)?[\s\n]$/, /^~~~([a-z]+)?[\s\n]$/].map((find) =>
      textblockTypeInputRule({
        find,
        type: this.type,
        getAttributes: (match) => ({ language: normalizeCodeLanguage(match[1]) }),
      })
    );
  },

  // Копия разбора блока кода Tiptap: язык ограды — к имени Документа.
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
    ОГРАДА ДЛИННЕЕ ЛЮБОЙ СЕРИИ ОБРАТНЫХ КАВЫЧЕК ВНУТРИ. У Tiptap ограда всегда
    ```` ``` ````, и блок, который сам содержит ```` ``` ```` (пример README в
    блоке Markdown, шаблон в блоке кода), выгружался с внутренней оградой,
    закрывающей внешнюю: обратная загрузка разваливала его на куски. CommonMark
    закрывает блок только оградой не короче открывающей — поэтому берём на одну
    кавычку больше самой длинной серии, но не меньше трёх.
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
        `Alt+F10` в блоке кода — в кнопку его языка, как на выделенной
        картинке — в её панель: действие над тем, где стоит каретка, ближе
        Панели форматирования. Tab для этого не годится: он уводит фокус из
        поля, а с кнопки повторный `Alt+F10` ведёт дальше, в Панель. Кнопки
        нет (только чтение) — сочетание уходит дальше, к Панели.
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
