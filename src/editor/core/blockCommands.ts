"use client";

import { Extension, type Editor } from "@tiptap/core";
import { Fragment, type Node as PmNode, type NodeRange } from "@tiptap/pm/model";
import {
  Plugin,
  PluginKey,
  Selection,
  TextSelection,
  type EditorState,
  type Transaction,
} from "@tiptap/pm/state";
import { StepMap } from "@tiptap/pm/transform";

/**
 * Команды над Блоками: дублировать, переставить, выделить текст
 * Блока, сдвинуть пункт списка, очистить стили — как в Notion и Google Docs.
 *
 * Своей разметки у расширения нет, поэтому оно включено всегда, как
 * `ToolbarFocus`; инструмент нужен только очистке стилей — её сочетание живёт
 * и умирает вместе с кнопкой `clearFormatting`. Каждая команда — одна
 * транзакция, то есть один шаг отмены. В `readOnly` и `disabled` правящие
 * команды отдают клавишу браузеру: ProseMirror слушает клавиатуру и в
 * нередактируемом поле, и без проверки сочетание правило бы Документ «только
 * для чтения».
 *
 * СОЧЕТАНИЯ — ТЕ, ЧТО НЕ ОТНИМАЮТ У СИСТЕМЫ СВОЁ. Перестановка — `⌥⇧↑/↓`, как
 * в VS Code, а не `⌘⇧↑/↓` образца: на Mac это «выделить до начала/конца
 * документа». Выделение Блока — первое `⌘A`, а не `⌘⇧A`: в Chrome это поиск по
 * вкладкам. Меню ручки Блока — `⌘/`, как «действия с Блоком» в Notion: у
 * браузеров и систем это сочетание в поле ввода свободно.
 */

const LIST_NODES: ReadonlySet<string> = new Set(["bulletList", "orderedList", "taskList"]);
const LIST_ITEMS: ReadonlySet<string> = new Set(["listItem", "taskItem"]);

/**
 * Контейнер Блоков — узел, чьи дети и есть Блоки: сам Документ и всякий узел,
 * чья Схема помечена `blockContainer: true`.
 *
 * ШОВ ДЛЯ РАСКЛАДКИ. Колонка раскладки держит свои Блоки, и у них
 * должна быть своя ручка у левого края колонки, а не одна на всю раскладку. Узел
 * колонки объявит себя контейнером флагом в Схеме (в Tiptap — через
 * `extendNodeSchema`), и ручка, её позиция и все её действия (вверх, вниз,
 * дублировать, удалить, добавить ниже, формат) заработают внутри колонки без
 * правки этого модуля: «Блок» везде вычисляет `handleBlock` ниже.
 */
export function isBlockContainer(node: PmNode): boolean {
  return node.type.name === "doc" || node.type.spec.blockContainer === true;
}

/**
 * Лежит ли выделение целиком в одной таблице: там `⌥⇧↑/↓` не переставляет
 * (`Alt+↓` — строка), а Блок — вся таблица. Выделение, которое начинается или
 * кончается вне таблицы, переставляет её вместе с соседями.
 */
function inTable(state: Pick<EditorState, "selection">): boolean {
  const { $from, $to } = state.selection;
  for (let depth = $from.sharedDepth($to.pos); depth > 0; depth--) {
    if ($from.node(depth).type.spec.tableRole === "table") return true;
  }
  return false;
}

/**
 * Чьи Блоки берёт команда.
 *
 * - `selection` — сочетания клавиш: Блоки под выделением, а в списке — пункт;
 *   дублирование и перестановка пункта остаются внутри его списка.
 * - `handle` — ручка Блока: Блок контейнера целиком (весь список,
 *   вся таблица), ровно один — тот, у которого стоит ручка (`handleBlock`).
 */
export type BlockScope = "selection" | "handle";

/**
 * Блок ручки — ребёнок ближайшего контейнера Блоков (`isBlockContainer`), в
 * котором лежит выделение: абзац, заголовок, список целиком, цитата, блок кода,
 * таблица, картинка, линия. ОДНА функция на всё, что ручка знает о Блоке: где
 * её рисовать, что двигать, копировать, удалять, под чем добавлять и что
 * превращать. Выделение через несколько Блоков и курсор-щель между ними — `null`:
 * ручке не у чего стоять.
 */
export function handleBlock(state: Pick<EditorState, "selection">): NodeRange | null {
  const { $from, $to } = state.selection;
  const range = $from.blockRange($to, isBlockContainer);
  return range && range.endIndex - range.startIndex === 1 ? range : null;
}

/**
 * Блоки под выделением — ряд соседей у одного родителя.
 *
 * Блок — ребёнок контейнера Блоков, а в списке — пункт. В колонке Раскладки
 * Блок — ребёнок колонки: перестановка не выводит его из колонки, а
 * выделение через две колонки берёт Раскладку целиком. Таблица — один Блок
 * целиком, даже если в её ячейке есть список. Выделение через несколько Блоков
 * берёт их все: ряд считается там, где начало и конец выделения расходятся.
 * Курсор-щель между Блоками ни в каком Блоке не стоит — `null`.
 */
function blockRange(state: EditorState, scope: BlockScope): NodeRange | null {
  if (scope === "handle") return handleBlock(state);
  const { $from, $to } = state.selection;
  const table = inTable(state);
  const range = $from.blockRange(
    $to,
    (parent) => isBlockContainer(parent) || (!table && LIST_NODES.has(parent.type.name))
  );
  // Курсор-щель на уровне Документа даёт пустой ряд, а не `null`.
  return range && range.startIndex < range.endIndex ? range : null;
}

function blocksOf(range: NodeRange): PmNode[] {
  const nodes: PmNode[] = [];
  for (let index = range.startIndex; index < range.endIndex; index++) {
    nodes.push(range.parent.child(index));
  }
  return nodes;
}

/**
 * Выделение, перенесённое на `shift` позиций, — тем же классом (каретка,
 * узел, ячейки), что было: сдвиг всего Документа на величину — это и есть
 * отображение позиций, и каждый вид выделения переносит себя по нему сам.
 */
function shifted(state: EditorState, tr: Transaction, shift: number): Transaction {
  const map = shift >= 0 ? new StepMap([0, 0, shift]) : new StepMap([0, -shift, 0]);
  return tr.setSelection(state.selection.map(tr.doc, map));
}

type Dispatch = ((tr: Transaction) => void) | undefined;
type Command = (state: EditorState, dispatch?: Dispatch) => boolean;

/** `⌘⇧D` — копия Блоков под ними, выделение переходит в копию. */
export function duplicateBlock(scope: BlockScope = "selection"): Command {
  return (state, dispatch) => {
    const range = blockRange(state, scope);
    if (!range) return false;
    if (dispatch) {
      const size = range.end - range.start;
      const tr = state.tr.insert(range.end, Fragment.from(blocksOf(range)));
      dispatch(shifted(state, tr, size).scrollIntoView());
    }
    return true;
  };
}

/**
 * `⌥⇧↑/↓` — Блоки меняются местами с соседом сверху или снизу. На краю
 * Документа или списка соседа нет: Документ не меняется, но клавиша поглощена —
 * иначе на Mac она тихо растягивала бы выделение. В таблице сочетание — `false`
 * (`Alt+↓` — её строка), а ручка двигает таблицу целиком.
 */
export function moveBlock(dir: -1 | 1, scope: BlockScope = "selection"): Command {
  return (state, dispatch) => {
    if (scope === "selection" && inTable(state)) return false;
    const range = blockRange(state, scope);
    if (!range) return false;
    const blocks = blocksOf(range);
    const neighbourIndex = dir < 0 ? range.startIndex - 1 : range.endIndex;
    if (neighbourIndex < 0 || neighbourIndex >= range.parent.childCount) return true;
    if (dispatch) {
      const neighbour = range.parent.child(neighbourIndex);
      const from = dir < 0 ? range.start - neighbour.nodeSize : range.start;
      const to = dir < 0 ? range.end : range.end + neighbour.nodeSize;
      const content = dir < 0 ? [...blocks, neighbour] : [neighbour, ...blocks];
      const tr = state.tr.replaceWith(from, to, Fragment.from(content));
      dispatch(shifted(state, tr, dir * neighbour.nodeSize).scrollIntoView());
    }
    return true;
  };
}

/**
 * «Удалить» ручки — Блок целиком; каретка — в соседа сверху, у первого Блока —
 * в соседа снизу. Единственный Блок контейнера уступает место пустому Блоку по
 * умолчанию (абзацу): Схема не держит пустой Документ, а пустая колонка ничем
 * не лучше.
 */
export const deleteBlock: Command = (state, dispatch) => {
  const range = handleBlock(state);
  if (!range) return false;
  if (dispatch) {
    const tr = state.tr;
    if (range.parent.childCount === 1) {
      const filler = range.parent.type.contentMatch.defaultType?.createAndFill();
      if (!filler) return false;
      tr.replaceWith(range.start, range.end, filler);
      tr.setSelection(Selection.near(tr.doc.resolve(range.start + 1)));
    } else {
      tr.delete(range.start, range.end);
      tr.setSelection(Selection.near(tr.doc.resolve(range.start), range.startIndex > 0 ? -1 : 1));
    }
    dispatch(tr.scrollIntoView());
  }
  return true;
};

/**
 * Делают ли сочетания Блоков то же, что пункты ручки (подпись сочетания у
 * пункта — только тогда).
 *
 * - `duplicate` — `⌘⇧D` берёт тот же Блок: каретка не в пункте списка.
 * - `move` — то же и не в таблице: там `⌥⇧↑/↓` отдано строкам.
 * - `type` — сочетания «¶» (`⌘⌥2`) меняют текстовый Блок под кареткой, а
 *   «Формат» — Блок ручки: одно и то же, только когда это один Блок (не пункт
 *   списка, не абзац в цитате).
 */
export function handleShortcutsMatch(state: EditorState): {
  duplicate: boolean;
  move: boolean;
  type: boolean;
} {
  const handle = handleBlock(state);
  const keys = blockRange(state, "selection");
  const same = !!handle && !!keys && handle.start === keys.start && handle.end === keys.end;
  return {
    duplicate: same,
    move: same && !inTable(state),
    type: !!handle && state.selection.$from.depth === handle.depth + 1,
  };
}

/**
 * `⌘A` как в Notion: первое нажатие — текст текущего Блока, второе — весь
 * Документ. Сразу весь Документ, если текст Блока уже выделен, Блок пуст или
 * выделение уже шире одного Блока. Документ не меняется — работает и в
 * `readOnly`, как штатное `⌘A`.
 */
export function selectBlockText(editor: Editor): boolean {
  const { selection } = editor.state;
  const { $from, $to } = selection;
  if (selection instanceof TextSelection && $from.sameParent($to) && $from.parent.inlineContent) {
    const start = $from.start();
    const end = $from.end();
    if (start < end && (selection.from !== start || selection.to !== end)) {
      editor.view.dispatch(
        editor.state.tr.setSelection(TextSelection.create(editor.state.doc, start, end))
      );
      return true;
    }
  }
  return editor.commands.selectAll();
}

/** Пункт списка под кареткой — ближайший; его тип и сдвигается. */
function listItemType(state: EditorState): string | null {
  const { $from } = state.selection;
  for (let depth = $from.depth; depth > 0; depth--) {
    const name = $from.node(depth).type.name;
    if (LIST_ITEMS.has(name)) return name;
  }
  return null;
}

export interface BlockCommandsOptions {
  /** Включён ли инструмент `clearFormatting`: без него `⌘\` не снимает стили. */
  clearFormatting: boolean;
}

export const BlockCommands = Extension.create<BlockCommandsOptions>({
  name: "blockCommands",
  addOptions: () => ({ clearFormatting: false }),
  addKeyboardShortcuts() {
    const editable = () => this.editor.isEditable;
    const run = (command: Command) => () =>
      editable() && command(this.editor.state, this.editor.view.dispatch);
    /*
      `⌘]` и `⌘[` — то же, что Tab и Shift+Tab в списке. В пункте клавиша
      поглощается, даже если сдвигать некуда (первый пункт): в Chrome на Mac
      `⌘[` — «Назад», и промах на краю списка уводил бы со страницы с
      несохранённым текстом. Вне списка — `false`, сочетание браузеру: отступа
      абзаца в Схеме нет.
    */
    const shiftItem = (dir: "sink" | "lift") => () => {
      const type = editable() ? listItemType(this.editor.state) : null;
      if (!type) return false;
      if (dir === "sink") this.editor.commands.sinkListItem(type);
      else this.editor.commands.liftListItem(type);
      return true;
    };
    return {
      "Mod-Shift-d": run(duplicateBlock()),
      "Alt-Shift-ArrowUp": run(moveBlock(-1)),
      "Alt-Shift-ArrowDown": run(moveBlock(1)),
      "Mod-a": () => selectBlockText(this.editor),
      "Mod-]": shiftItem("sink"),
      "Mod-[": shiftItem("lift"),
      "Mod-\\": () => {
        if (!this.options.clearFormatting || !editable()) return false;
        this.editor.commands.unsetAllMarks();
        return true;
      },
    };
  },
});

/**
 * `⌘/` (`Ctrl+/`) — меню ручки Блока, ПО МЕСТУ КЛАВИШИ, а не по
 * символу.
 *
 * Карта клавиш ProseMirror сверяет символ: на русской раскладке клавиша «/»
 * печатает «.», и `Mod-/` превращался в `Mod-.` — верхний индекс. Поэтому
 * клавиша узнаётся по `event.code` («Slash» на любой раскладке), а расширение
 * стоит выше обычного приоритета: его обработчик опрашивается раньше карт
 * Меток, и индекс не успевает перехватить нажатие. Alt — мимо: это другое
 * сочетание.
 */
export const BlockMenuKey = Extension.create<{ openBlockMenu: () => boolean }>({
  name: "blockMenuKey",
  priority: 1001,
  addOptions: () => ({ openBlockMenu: () => false }),
  addProseMirrorPlugins() {
    const { editor, options } = this;
    return [
      new Plugin({
        key: new PluginKey("blockMenuKey"),
        props: {
          handleKeyDown: (_view, event) => {
            const mod = event.metaKey || event.ctrlKey;
            const slash = event.code === "Slash" || (!event.code && event.key === "/");
            if (!mod || event.altKey || event.shiftKey || !slash) return false;
            if (!editor.isEditable || !options.openBlockMenu()) return false;
            event.preventDefault();
            return true;
          },
        },
      }),
    ];
  },
});
