"use client";

import type { Editor } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { NodeSelection, TextSelection, type EditorState } from "@tiptap/pm/state";
import { BLOCK_FORMULA_NODE, INLINE_FORMULA_NODE, isFormulaNodeName } from "./mathNames.js";

/** Узел — формула, строчная или блочная. */
export function isFormulaNode(node: ProseMirrorNode): boolean {
  return isFormulaNodeName(node.type.name);
}

/**
 * Выделенная формула: узел с позицией. Выделена она, когда выделен узел целиком
 * (щелчок) или когда выделение — ровно её диапазон, как у `Shift+→` от каретки
 * перед ней. С клавиатуры формулу выделяет только второе: ProseMirror переносит
 * каретку через строчный атом без выделения, а выделение узла программой Chromium
 * сбрасывает в каретку при следующем `selectionchange` — стрелка, перехваченная
 * ради этого, не двигала бы каретку вовсе. `null` — выделено что-то другое.
 */
export function selectedFormula(state: EditorState): { node: ProseMirrorNode; pos: number } | null {
  const { selection } = state;
  if (selection instanceof NodeSelection) {
    return isFormulaNode(selection.node) ? { node: selection.node, pos: selection.from } : null;
  }
  const node = selection.empty ? null : state.doc.nodeAt(selection.from);
  return node && isFormulaNode(node) && selection.to === selection.from + node.nodeSize
    ? { node, pos: selection.from }
    : null;
}

/**
 * Вставить формулу на место каретки (Поповер Меню вставки). Строчная заменяет
 * выделение; блочная встаёт на место пустого абзаца с кареткой или сразу за
 * Блоком, в котором стоит каретка, — как Блок из пункта «Добавить»: внутри абзаца
 * Блоку не место. После блочной формулы каретка уходит в абзац за ней; если
 * Блок остался последним, абзац дописывается, иначе писать после формулы было бы
 * негде. Одна транзакция — одна отмена.
 */
export function insertFormula(editor: Editor, kind: "inline" | "block", latex: string): boolean {
  if (kind === "inline") {
    return editor
      .chain()
      .focus()
      .insertContent({ type: INLINE_FORMULA_NODE, attrs: { latex } })
      .run();
  }
  return editor
    .chain()
    .focus()
    .command(({ tr }) => {
      const type = tr.doc.type.schema.nodes[BLOCK_FORMULA_NODE];
      const paragraph = tr.doc.type.schema.nodes.paragraph;
      if (!type || !paragraph) return false;
      const { selection } = tr;
      const { $from } = selection;
      // Место: выделенный Блок — за ним; пустой абзац — вместо него; иначе — за
      // Блоком, где каретка, на самом глубоком уровне, куда формула годится.
      let from: number | null = null;
      let to: number | null = null;
      if (selection instanceof NodeSelection && selection.node.isBlock) {
        const index = $from.indexAfter();
        if ($from.parent.canReplaceWith(index, index, type)) from = to = selection.to;
      } else {
        const replacing =
          selection.empty && $from.parent.isTextblock && $from.parent.childCount === 0;
        for (let depth = $from.depth; depth > 0 && from === null; depth--) {
          const container = $from.node(depth - 1);
          // Пустой абзац заменяется; иначе формула встаёт сразу за Блоком уровня `depth`.
          const swap = replacing && depth === $from.depth;
          const index = swap ? $from.index(depth - 1) : $from.indexAfter(depth - 1);
          if (container.canReplaceWith(index, swap ? index + 1 : index, type)) {
            from = swap ? $from.before(depth) : $from.after(depth);
            to = swap ? $from.after(depth) : from;
          }
        }
      }
      if (from === null || to === null) return false;
      const formula = type.create({ latex });
      const nodes = [formula];
      // Блок последний в своём контейнере — после него нужен абзац для каретки.
      if (!tr.doc.resolve(to).nodeAfter) nodes.push(paragraph.create());
      tr.replaceWith(from, to, nodes);
      tr.setSelection(TextSelection.near(tr.doc.resolve(from + formula.nodeSize), 1));
      return true;
    })
    .run();
}
