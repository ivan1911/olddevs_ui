"use client";

import { Extension, mergeAttributes, Node, type Extensions } from "@tiptap/core";
import type { Node as PmNode } from "@tiptap/pm/model";
import {
  NodeSelection,
  Selection,
  TextSelection,
  type EditorState,
  type Transaction,
} from "@tiptap/pm/state";
import { containerFreeContext, placeContainerBlock, WRAPPER_NODE } from "../../core/containers.js";
import type { EditorWrapperTone } from "../../../i18n/messages.js";
import { WRAPPER_TONE_ALERTS, wrapperToneFrom } from "./wrapperTones.js";

/**
 * Обёртка — Блок, собирающий группу Блоков: `div[data-block="wrapper"]`,
 * внутри — Блоки. Без тона своего вида у неё нет, как у Wrapper в Redactor: в
 * Редакторе её показывает серый пунктир, читателю граница не нужна.
 *
 * РАЗМЕТКА — КАК У REDACTOR, БУКВА В БУКВУ: его HTML с обёрткой читается без
 * перевода, а наш — им. Единственный свой атрибут — тон:
 * `data-tone` с именем словаря `Tone` кита (`wrapperTones.ts`), вид для
 * читателя — мягкая подложка и полоса тона (`prose.ts`), в Markdown — GitHub
 * alert. Тон — оформление: роли и `aria-*` он в разметку не добавляет.
 *
 * ВЛОЖЕННОСТИ НЕТ НА УРОВНЕ СХЕМЫ ДВИЖКА, как у Раскладки (ADR-0056).
 * Обёртка не входит в группу `block`: её принимают Документ и колонка
 * Раскладки (их content-выражения называют её поимённо — `document.ts` и
 * `layout.ts`), а сама она держит `block+`. Значит, ни Обёртки в Обёртке, ни
 * Раскладки в Обёртке, ни Обёртки в списке, цитате или ячейке не получить ни
 * вставкой, ни `value`, ни командой. Разбор HTML на такой случай снимает
 * обёртку и отдаёт её Блоки подряд — правилом с `skip` в контексте контейнера.
 * Вставка из буфера разбирается в контексте места вставки, поэтому то же
 * правило разворачивает и её: своего `transformPasted`, как у Раскладки, не
 * нужно.
 *
 * `isolating`, как у колонки: Backspace в начале Обёртки не выводит текст
 * наружу и не сливает его с Блоком выше, а «Превратить в» не перешагивает её
 * границу. Флаг `blockContainer` (`blockCommands.ts`): Блоки внутри — со своей
 * ручкой у левого края Обёртки, и их команды из неё не выходят.
 *
 * Решение — ADR-0057.
 */

/** Имя узла Обёртки в Схеме движка (определено в `containers.ts`). */
export { WRAPPER_NODE };

const WRAPPER_TAG = 'div[data-block="wrapper"]';

/**
 * Контейнеры, где Обёртки нет: другая Обёртка, цитата, пункт списка и ячейка
 * (`containers.ts`). Колонки Раскладки здесь нет — Обёртку она принимает.
 */
const NO_WRAPPER_CONTEXT = containerFreeContext();

export const Wrapper = Node.create({
  name: WRAPPER_NODE,
  content: "block+",
  isolating: true,
  extendNodeSchema: (extension) =>
    extension.name === WRAPPER_NODE ? { blockContainer: true } : {},
  /*
    Тон — имя из словаря `Tone` кита в `data-tone`; без тона
    атрибута нет. Неизвестное значение разбор отбрасывает, Обёртка остаётся.
  */
  addAttributes: () => ({
    tone: {
      default: null,
      parseHTML: (element) => wrapperToneFrom(element.getAttribute("data-tone")),
      renderHTML: ({ tone }) => (tone ? { "data-tone": tone } : {}),
    },
  }),
  parseHTML: () => [
    { tag: WRAPPER_TAG, context: NO_WRAPPER_CONTEXT, skip: true, priority: 60 },
    { tag: WRAPPER_TAG },
  ],
  renderHTML: ({ HTMLAttributes }) => [
    "div",
    mergeAttributes({ "data-block": "wrapper" }, HTMLAttributes),
    0,
  ],
  /*
    Обёртка с тоном — GitHub alert: цитата, первой строкой метка
    тона (`> [!NOTE]`), дальше её Блоки с `> ` в начале строки, пустая строка
    между Блоками — `>`, как у цитаты движка. Без тона в Markdown Обёртке нечем
    быть: Блоки выгружаются подряд. Обратно alert читает `markdown.ts`.
  */
  renderMarkdown: (node, helpers) => {
    const blocks = node.content ? helpers.renderChildren(node.content, "\n\n") : "";
    const tone = wrapperToneFrom(node.attrs?.tone);
    if (!tone) return blocks;
    // Пустая строка Блоков — голый `>`; строка из одних пробелов (в блоке кода)
    // остаётся с ними, иначе обратный разбор их потерял бы.
    const lines = blocks.split("\n").map((line) => (line === "" ? ">" : `> ${line}`));
    // Линия (`---`) или `===` прямо под строкой метки — подчёркивание заголовка:
    // метка стала бы `<h2>`, а alert — цитатой. Пустая строка цитаты их разделяет.
    const label = `> [!${WRAPPER_TONE_ALERTS[tone]}]`;
    const setext = /^> *(?:-+|=+) *$/.test(lines[0] ?? "");
    return [label, ...(setext ? [">"] : []), ...lines].join("\n");
  },

  addCommands() {
    return {
      insertWrapper:
        () =>
        ({ tr, dispatch }) => {
          if (dispatch) placeWrapper(tr);
          return true;
        },
      unwrapWrapper:
        () =>
        ({ tr, dispatch }) => {
          const found = wrapperAt(tr.selection);
          if (!found) return false;
          if (dispatch) unwrap(tr, found.pos, found.node);
          return true;
        },
      setWrapperTone:
        (tone) =>
        ({ tr, dispatch }) => {
          const found = wrapperAt(tr.selection);
          // Имя вне словаря команда не пишет: её зовёт и код потребителя.
          const value = wrapperToneFrom(tone);
          if (!found || (tone !== null && value === null)) return false;
          // Один шаг атрибута: позиции и выделение не сдвигаются, отмена — одна.
          if (dispatch) tr.setNodeAttribute(found.pos, "tone", value);
          return true;
        },
    };
  },
});

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    wrapper: {
      /**
       * Вставить пустую Обёртку с одним абзацем под текущим Блоком; пустой
       * абзац в Документе или колонке заменяется. Из колонки — в той же
       * колонке, из Обёртки, списка, цитаты и ячейки — под их Блоком. Каретка
       * — в абзац Обёртки.
       */
      insertWrapper: () => ReturnType;
      /**
       * Снять Обёртку под выделением: её Блоки встают на её место. Не в
       * Обёртке — `false`.
       */
      unwrapWrapper: () => ReturnType;
      /**
       * Тон Обёртки под выделением: имя из словаря тонов или `null`
       * — без тона. Не в Обёртке или имя вне словаря — `false`.
       */
      setWrapperTone: (tone: EditorWrapperTone | null) => ReturnType;
    };
  }
}

/** Обёртка под выделением: выделенная узлом или та, в которой каретка. */
export function wrapperAt(selection: Selection): { pos: number; node: PmNode } | null {
  if (selection instanceof NodeSelection && selection.node.type.name === WRAPPER_NODE) {
    return { pos: selection.from, node: selection.node };
  }
  const { $from } = selection;
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth);
    if (node.type.name === WRAPPER_NODE) return { pos: $from.before(depth), node };
  }
  return null;
}

/**
 * Снять Обёртку Блока `pos` — самого Блока-Обёртки или Блока прямо в ней:
 * действие меню Ручки (`features/builtins.ts`), у которого вместо выделения — позиция.
 */
export function unwrapWrapperAt(tr: Transaction, pos: number): boolean {
  const node = tr.doc.nodeAt(pos);
  if (node?.type.name === WRAPPER_NODE) {
    unwrap(tr, pos, node);
    return true;
  }
  const $pos = tr.doc.resolve(pos);
  if ($pos.parent.type.name !== WRAPPER_NODE) return false;
  unwrap(tr, $pos.before(), $pos.parent);
  return true;
}

/**
 * Пустая Обёртка с одним абзацем — под текущим Блоком, в ближайшем вверх
 * контейнере, который её принимает (Документ или колонка Раскладки); правила
 * места — общие с Раскладкой (`placeContainerBlock`, `containers.ts`).
 */
function placeWrapper(tr: Transaction): void {
  const { schema } = tr.doc.type;
  placeContainerBlock(
    tr,
    schema.nodes[WRAPPER_NODE]!.create(null, schema.nodes.paragraph!.create())
  );
}

/**
 * Снять Обёртку в `pos`: её Блоки поднимаются на уровень выше одним шагом
 * `lift`, поэтому каретка внутри них остаётся на своём месте, а отмена — одна.
 * Выделенная узлом Обёртка исчезает — каретка встаёт в начало её первого Блока.
 */
function unwrap(tr: Transaction, pos: number, node: PmNode): void {
  // Выделена сама Обёртка, а не картинка в ней: картинку выделение сохраняет.
  const wasNode = tr.selection instanceof NodeSelection && tr.selection.from === pos;
  const $start = tr.doc.resolve(pos + 1);
  const $end = tr.doc.resolve(pos + node.nodeSize - 1);
  const range = $start.blockRange($end);
  if (!range) return;
  tr.lift(range, range.depth - 1);
  if (wasNode) tr.setSelection(Selection.near(tr.doc.resolve(pos), 1));
  tr.scrollIntoView();
}

/**
 * Enter в пустом последнем абзаце Обёртки, где есть и другие Блоки, —
 * выход: абзац переезжает под Обёртку, каретка — с ним. Одна правка. Без
 * этого из Обёртки в конце Документа не выйти без мыши: `isolating` не даёт
 * ядру поднять пустой абзац наружу, и Enter только множил бы пустые строки.
 */
function exitOnEnter(state: EditorState, dispatch?: (tr: Transaction) => void): boolean {
  const { selection } = state;
  if (!(selection instanceof TextSelection) || !selection.empty) return false;
  const { $from } = selection;
  if ($from.depth < 2) return false;
  const wrapper = $from.node(-1);
  const block = $from.parent;
  if (
    wrapper.type.name !== WRAPPER_NODE ||
    block.type.name !== "paragraph" ||
    block.content.size > 0 ||
    wrapper.childCount < 2 ||
    $from.indexAfter(-1) !== wrapper.childCount
  ) {
    return false;
  }
  if (dispatch) {
    const tr = state.tr;
    const after = $from.after(-1);
    tr.delete($from.before(), $from.after());
    const pos = tr.mapping.map(after);
    tr.insert(pos, block.type.create());
    tr.setSelection(TextSelection.create(tr.doc, pos + 1));
    dispatch(tr.scrollIntoView());
  }
  return true;
}

/** Выход из Обёртки по Enter — раньше ядра: его Enter разрезал бы абзац внутри. */
const WrapperKeys = Extension.create({
  name: "wrapperKeys",
  priority: 101,
  addKeyboardShortcuts() {
    return {
      Enter: () =>
        this.editor.isEditable && exitOnEnter(this.editor.state, this.editor.view.dispatch),
    };
  },
});

/**
 * Каретка в самом начале Обёртки (`dir < 0`) или в самом конце (`dir > 0`), с
 * пустым выделением: на краю текста, и каждый предок текстового Блока до
 * Обёртки — крайний в своём родителе.
 */
function atWrapperBoundary(state: EditorState, dir: 1 | -1): boolean {
  const { selection } = state;
  if (!(selection instanceof TextSelection) || !selection.empty) return false;
  const { $head } = selection;
  const atTextEdge =
    dir < 0 ? $head.parentOffset === 0 : $head.parentOffset === $head.parent.content.size;
  if (!atTextEdge) return false;
  for (let depth = $head.depth - 1; depth > 0; depth--) {
    const parent = $head.node(depth);
    const atEdge =
      dir < 0 ? $head.index(depth) === 0 : $head.indexAfter(depth) === parent.childCount;
    if (!atEdge) return false;
    if (parent.type.name === WRAPPER_NODE) return true;
  }
  return false;
}

/**
 * Backspace в единственном пустом абзаце Обёртки — Обёртка уходит целиком:
 * на её месте остаётся этот абзац, каретка в нём. Одна правка. Иначе пустую
 * Обёртку с клавиатуры не убрать: охрана границы ниже глотает Backspace, а
 * выделить её узлом можно только с Блока под ней. Текста в ней нет, так что
 * правило охраны — «не выводить текст наружу» — не нарушается. В колонке
 * Раскладки абзац остаётся в той же колонке: это её Блок, а не Документа.
 *
 * Delete симметрично не снимает Обёртку: им удаляют то, что ПОСЛЕ каретки, а
 * в конце Обёртки за ней — граница, а не её содержимое.
 */
function removeEmptyWrapper(state: EditorState, dispatch?: (tr: Transaction) => void): boolean {
  const { selection } = state;
  if (!(selection instanceof TextSelection) || !selection.empty) return false;
  const { $from } = selection;
  if ($from.depth < 2) return false;
  const wrapper = $from.node(-1);
  const block = $from.parent;
  if (
    wrapper.type.name !== WRAPPER_NODE ||
    wrapper.childCount !== 1 ||
    block.type.name !== "paragraph" ||
    block.content.size > 0
  ) {
    return false;
  }
  if (dispatch) {
    const pos = $from.before(-1);
    const tr = state.tr.replaceWith(pos, $from.after(-1), block);
    tr.setSelection(TextSelection.create(tr.doc, pos + 1));
    dispatch(tr.scrollIntoView());
  }
  return true;
}

/**
 * Backspace в начале Обёртки и Delete в её конце — последними, после всех
 * правил ядра (как у колонки Раскладки, `layout.ts`). Пустой заголовок ядро
 * ещё превращает в абзац, пункт списка — выносит из списка. Единственный
 * пустой абзац Backspace снимает вместе с Обёрткой (`removeEmptyWrapper`).
 * Если же никто не взялся, клавиша поглощается: `isolating` не даёт командам
 * ProseMirror вытащить текст из Обёртки, и без поглощения правку сделал бы
 * сам браузер — по DOM, мимо Схемы.
 *
 * Обёртка в колонке: здесь срабатывает раньше охраны колонки с тем же
 * приоритетом — из равных Tiptap первым опрашивает зарегистрированное позже
 * (`extensions.ts`), а Обёртка идёт после Раскладки.
 */
const WrapperBoundary = Extension.create({
  name: "wrapperBoundary",
  priority: 1,
  addKeyboardShortcuts() {
    const guard = (dir: 1 | -1) => () =>
      this.editor.isEditable && atWrapperBoundary(this.editor.state, dir);
    return {
      Backspace: () =>
        (this.editor.isEditable &&
          removeEmptyWrapper(this.editor.state, this.editor.view.dispatch)) ||
        guard(-1)(),
      Delete: guard(1),
    };
  },
});

/** Всё, что нужно Обёртке, кроме Документа (`document.ts`): узел и клавиатура. */
export const WRAPPER_EXTENSIONS: Extensions = [Wrapper, WrapperKeys, WrapperBoundary];
