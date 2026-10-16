"use client";

import { Extension, type Editor, type Extensions } from "@tiptap/core";
import { BlockMath, InlineMath } from "@tiptap/extension-mathematics";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { ReactNode } from "react";
import type { ToolPopoverRequest } from "../../core/toolButtons.js";
import { katexOptionsFor } from "./katexEngine.js";
import { MathForm, type MathFormProps } from "./MathForm.js";
import { selectedFormula } from "./mathCommands.js";
import {
  blockMathTokenizer,
  inlineMathTokenizer,
  renderBlockMath,
  renderInlineMath,
} from "./mathMarkdown.js";
import { safeLatexSource } from "./mathHtml.js";
import { BLOCK_FORMULA_NODE, FORMULA_SOURCE_ATTRIBUTE } from "./mathNames.js";
import type { MathRenderOptions } from "./mathOptions.js";

/*
  Чанк формул (ADR-0070, п. 5; ADR-0058, п. 11.1): расширение Mathematics из
  Tiptap, KaTeX и его CSS (`katexEngine.ts`), Поповер формулы и Markdown. Всё это
  тяжелее 10 кБ gzip, а `basic` и `full` формул не несут, поэтому чанк грузит
  Загрузчик Инструмента (`mathematicsTool.ts`) и только у Редактора, где
  `mathematics` назван в `tools`.
*/

/** Форма Поповера как узел: рамку, имя и якорь даёт кит. */
export function renderMathForm(props: MathFormProps): ReactNode {
  return <MathForm {...props} />;
}

/** Запрос Поповера на правку формулы: Поповер стоит у самой формулы и следует за ней. */
function editRequest(node: ProseMirrorNode, pos: number): ToolPopoverRequest {
  const block = node.type.name === BLOCK_FORMULA_NODE;
  return {
    label: ({ messages }) => (block ? messages.mathBlock : messages.mathInline),
    popover: ({ editor, close, pos: current }) => (
      <MathForm editor={editor} kind={block ? "block" : "inline"} pos={current} close={close} />
    ),
    block: pos,
  };
}

export interface MathExtensionsContext {
  /** Опции KaTeX этого Редактора. */
  options: MathRenderOptions;
  /** Открыть Поповер у выделения или у Блока (мост `RichTextEditor`). */
  openPopover: (request: ToolPopoverRequest) => void;
}

/**
 * Extensions Инструмента: узлы `inlineMath` и `blockMath` и правка с клавиатуры.
 *
 * - **Правка.** Щелчок (`onClick` расширения) и Enter на выделенной формуле открывают
 *   Поповер кита вместо встроенной правки Tiptap. С клавиатуры строчную формулу
 *   выделяет `Shift+→` или `Shift+←` от каретки рядом с ней (`selectedFormula`).
 *   В нередактируемом поле формула только показывается.
 * - **Текст атома — LaTeX.** `renderText` даёт исходник счётчику, копированию текстом
 *   и поиску (ADR-0058, п. 4), как `data-latex` даёт его HTML.
 * - **Markdown.** Токенизаторы и выгрузка — `mathMarkdown.ts`.
 * - **Блочная формула отрисовывается в режиме `display`**: расширение Tiptap одни
 *   опции KaTeX отдаёт обоим узлам, а блоку нужна формула крупно и по центру.
 */
export function mathExtensions({ options, openPopover }: MathExtensionsContext): Extensions {
  const edit = (node: ProseMirrorNode, pos: number) => openPopover(editRequest(node, pos));
  const latexText = ({ node }: { node: ProseMirrorNode }) => String(node.attrs.latex ?? "");
  // Редактор узла — для проверки «поле правится» в обработчике щелчка: он знает только узел.
  let host: Editor | null = null;
  const bind = {
    onBeforeCreate(this: { editor: Editor }) {
      host = this.editor;
    },
  };
  /*
    `data-latex` в HTML Редактор пишет с пробелом в парах, которые DOMPurify режет
    (`safeLatexSource`): сохранённый HTML проходит санитайзер потребителя целым и при
    втором проходе не меняется. Узел хранит набранное автором как есть.
  */
  const source = {
    addAttributes() {
      return {
        latex: {
          default: "",
          parseHTML: (element: HTMLElement) => element.getAttribute(FORMULA_SOURCE_ATTRIBUTE),
          renderHTML: (attributes: Record<string, unknown>) => ({
            [FORMULA_SOURCE_ATTRIBUTE]: safeLatexSource(String(attributes.latex ?? "")),
          }),
        },
      };
    },
  };
  const open = (node: ProseMirrorNode, pos: number) => {
    if (!host?.isEditable) return;
    // Щелчок выделяет узел сам; выделение нужно и Enter-у, и тому, кто вернётся в поле.
    host.commands.setNodeSelection(pos);
    edit(node, pos);
  };
  const inline = InlineMath.extend({
    ...bind,
    ...source,
    renderText: latexText,
    markdownTokenizer: inlineMathTokenizer,
    renderMarkdown: (node) => renderInlineMath(String(node.attrs?.latex ?? "")),
  }).configure({
    katexOptions: katexOptionsFor(options, false),
    onClick: open,
  });
  const block = BlockMath.extend({
    ...bind,
    ...source,
    renderText: latexText,
    markdownTokenizer: blockMathTokenizer,
    renderMarkdown: (node) => renderBlockMath(String(node.attrs?.latex ?? "")),
  }).configure({
    katexOptions: katexOptionsFor(options, true),
    onClick: open,
  });
  const keyboard = Extension.create({
    name: "mathKeyboard",
    addKeyboardShortcuts() {
      return {
        // Enter на выделенной формуле — щелчком или `Shift+→` — открывает Поповер, а не рвёт абзац.
        Enter: ({ editor }) => {
          const found = editor.isEditable ? selectedFormula(editor.state) : null;
          if (!found) return false;
          edit(found.node, found.pos);
          return true;
        },
      };
    },
  });
  return [block, inline, keyboard];
}
