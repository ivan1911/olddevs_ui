"use client";

import type { ChainedCommands, Editor, Range } from "@tiptap/core";
import { TextSelection, type Transaction } from "@tiptap/pm/state";
import type { ComponentType } from "react";
import type { UiMessages } from "../../i18n/messages.js";
import { TableIcon, type IconProps } from "../../icons.js";
import { DEFAULT_LOCALE } from "../../i18n/defaults.js";
import { handleBlock } from "./blockCommands.js";
import { projectRecords, type ToolList, type ToolPopover } from "./toolDescriptor.js";
import type { Tool } from "./tools.js";

type EditorMessages = UiMessages["editor"];

/**
 * Пункт Меню вставки.
 *
 * Раздел решает, ЧТО делается с документом, а пункт — только КАКОЙ Блок:
 *
 * - `insert` — новый Блок после текущего. Меню само встаёт в пустой абзац:
 *   текущий пустой — в него, иначе в новый сразу за текущим верхним Блоком
 *   (не внутри цитаты или списка). Пункту остаётся
 *   команда «сделай здесь свой Блок» (`setHorizontalRule`, `setCodeBlock`).
 * - `turnInto` — сменить тип текущего Блока, сохранив текст. Меню снимает с
 *   него обёртки (список, цитата), и пункт оборачивает или меняет заново.
 *
 * Поэтому `run` получает цепочку, а не движок: подготовка меню и команда пункта
 * идут одной транзакцией и отменяются одним `Ctrl+Z`.
 */
export interface InsertItem {
  /** Стабильный ключ, уникальный среди всех пунктов: из него собран `id` строки. */
  id: string;
  section: "insert" | "turnInto";
  /**
   * Подпись в локали `UiProvider`: у встроенных — строка каталога, а `locale`
   * им не нужна; у своих Инструментов — строка или функция от `{ locale,
   * messages }` (ADR-0058, п. 6.1), и меню зовёт её при отрисовке.
   */
  label: (messages: EditorMessages, locale: string) => string;
  icon: ComponentType<IconProps>;
  /**
   * Слова для фильтра сверх подписи: markdown-синтаксис и короткие имена
   * (`h2`, `ul`, `---`). Только независимые от языка — подписи на языке
   * интерфейса и английские подписи каталога фильтр берёт сам.
   */
  aliases?: readonly string[];
  /** Markdown-шорткат Блока — подсказка в строке. Сильнее `keys`: его короче набрать. */
  markdown?: string;
  /** Сочетание в нотации движка (`mod` — `⌘` или `Ctrl`); подпись, если нет `markdown`. */
  keys?: readonly string[];
  /**
   * Сочетание, которое вешает кит (ADR-0058, п. 5.7): единственный источник
   * клавиши, подсказки и строки справочника. У встроенных нет — клавишу вешают
   * их Extensions, а подпись — `keys`.
   */
  shortcut?: readonly string[];
  /**
   * Второй нужный инструмент сверх владельца пункта: Заголовок 1 стоит под
   * `heading`, но есть только вместе с `heading1`, как в меню «¶».
   */
  requires?: Tool;
  run: (chain: ChainedCommands, editor: Editor) => ChainedCommands;
  /**
   * Поповер вместо `run` (у своего Инструмента, ADR-0058, п. 5.6): пункт
   * Документ не готовит, а открывает поповер у каретки (`applyInsertItem`).
   */
  popover?: ToolPopover;
}

/**
 * Пункт «Таблица» заданного размера: строка-заголовок всегда есть.
 *
 * Меню вставки берёт 3×3 (описание Инструмента, `tableTool.ts`), сетка выбора
 * размера — любой. Один пункт на оба пути:
 * место вставки (`applyInsertItem`) и уход из ячейки (`leaveTable`) тогда
 * не разойдутся.
 */
export function tableItem(cols: number, rows: number): InsertItem {
  return {
    id: "table",
    section: "insert",
    label: (m) => m.table,
    icon: TableIcon,
    aliases: ["grid"],
    run: (chain) => chain.command(leaveTable).insertTable({ rows, cols, withHeaderRow: true }),
  };
}

/**
 * Вставить таблицу `cols` × `rows` с строкой-заголовком после текущего Блока —
 * тем же путём, что пункт меню. Размер приводится к целому не меньше 1×1.
 */
export function insertTableOfSize(editor: Editor, cols: number, rows: number): void {
  const whole = (value: number) => Math.max(1, Math.floor(value) || 1);
  applyInsertItem(editor, tableItem(whole(cols), whole(rows)), null);
}

/**
 * Каретка в ячейке — новая таблица встаёт ПОСЛЕ неё, а не внутрь.
 *
 * Меню само отходит от текущего Блока, но пустой абзац считает готовым местом:
 * пустая ячейка тоже абзац, и таблица легла бы в неё второй, вложенной.
 * Вложенные таблицы в v1 не нужны (ни кнопок, ни Markdown-записи для них нет),
 * а вставка, которая из пустой ячейки делает матрёшку, выглядит как сбой.
 */
function leaveTable({ tr }: { tr: Transaction }): boolean {
  const { $from } = tr.selection;
  for (let depth = $from.depth; depth > 0; depth--) {
    if ($from.node(depth).type.name !== "table") continue;
    const after = $from.after(depth);
    tr.insert(after, tr.doc.type.schema.nodes.paragraph!.create());
    tr.setSelection(TextSelection.create(tr.doc, after + 1));
    break;
  }
  return true;
}

/**
 * Подсказка в строке пункта: markdown-шорткат, а без него — сочетание клавиш.
 * Сочетание подписывает Панель (`shortcutLabel`) — она знает, Apple ли это.
 */
export function insertItemHint(
  item: InsertItem,
  shortcut: (keys: readonly string[]) => string
): string | undefined {
  return item.markdown ?? (item.keys ? shortcut(item.keys) : undefined);
}

/**
 * Место встроенных Инструментов в Меню вставки — порядок их пунктов внутри
 * раздела. Пункты живут в описаниях (`insertItems`), а место на поверхности —
 * привилегия кита, поэтому оно здесь, а не в описании.
 */
const INSERT_ORDER: readonly Tool[] = [
  "insertMenu",
  "heading",
  "bulletList",
  "orderedList",
  "taskList",
  "blockquote",
  "codeBlock",
  "horizontalRule",
  "table",
  "image",
  "layout",
  "wrapper",
  "details",
  "mathematics",
];

/** Разделы по порядку показа. */
export const INSERT_SECTIONS = ["insert", "turnInto"] as const;

/**
 * Пункты для набора инструментов — проекция списка описаний (`insertItems`) в
 * порядке `INSERT_ORDER`. Абзац — пункт описания `insertMenu`. Меню без пункта сверх
 * абзаца бессмысленно, и тогда список пуст: ни «+», ни `/` не появляются.
 */
export function insertItemsFor(tools: ToolList): readonly InsertItem[] {
  if (!tools.has("insertMenu")) return [];
  const items = projectRecords(tools, INSERT_ORDER, (descriptor) => descriptor.insertItems).filter(
    (item) => item.requires === undefined || tools.has(item.requires)
  );
  return items.length > 1 ? items : [];
}

/**
 * Подходит ли пункт под запрос после `/`.
 *
 * Сравнение — `contains` из react-aria (без регистра и диакритики в локали:
 * «ё» находится по «е»), по подписи на языке интерфейса, по английской подписи
 * каталога и по `aliases`. Английская подпись — потому что `/head` привычен и
 * тем, у кого интерфейс по-русски, а каталог-фолбэк и так лежит в сборке.
 */
export function matchesQuery(
  item: InsertItem,
  query: string,
  messages: EditorMessages,
  locale: string,
  fallback: EditorMessages,
  contains: (text: string, query: string) => boolean
): boolean {
  if (query === "") return true;
  const words = [
    item.label(messages, locale),
    item.label(fallback, DEFAULT_LOCALE),
    ...(item.aliases ?? []),
  ];
  return words.some((word) => contains(word, query));
}

/**
 * Куда пункт ставит Блок.
 *
 * - `caret` — Меню вставки и «¶»: раздел пункта решает, превратить текущий
 *   Блок или поставить новый после него.
 * - `below` — «Добавить ›» ручки Блока: всегда новый Блок под
 *   Блоком ручки, даже если текущий пуст и даже для пункта «Превратить в»:
 *   «Заголовок 2» здесь — новый пустой заголовок ниже, а не смена текущего.
 */
export type InsertPlace = "caret" | "below";

/**
 * Пустой абзац сразу за Блоком ручки (`handleBlock`) с кареткой в нём — место
 * нового Блока. Один путь на «+», `/` и «Добавить ›»: разделитель или таблица,
 * вставленные из середины цитаты или списка, оказались бы у них внутри, а
 * после выделенной картинки — перед ней. Выделение через несколько Блоков
 * ручки не имеет: тогда — за верхним Блоком под началом выделения.
 */
function openParagraphBelow(tr: Transaction): void {
  const after = handleBlock(tr)?.end ?? tr.selection.$from.after(1);
  tr.insert(after, tr.doc.type.schema.nodes.paragraph!.create());
  tr.setSelection(TextSelection.create(tr.doc, after + 1));
}

/**
 * Применить пункт.
 *
 * `range` — набранный `/запрос`: он удаляется той же транзакцией. У «+» на
 * Панели запроса нет, и `range` — `null`: пункт применяется к выделению.
 */
export function applyInsertItem(
  editor: Editor,
  item: InsertItem,
  range: Range | null,
  place: InsertPlace = "caret"
): void {
  let chain = editor.chain().focus();
  if (range) chain = chain.deleteRange(range);
  // Пункт с поповером: только убрать `/запрос`; Блок ставит содержимое поповера.
  if (item.popover) return void chain.openToolPopover(item.id).run();
  if (place === "below") {
    // Новый пустой абзац и есть Блок, который пункт меняет или оборачивает.
    chain = chain.command(({ tr }) => {
      openParagraphBelow(tr);
      return true;
    });
    /*
      «Абзац» здесь уже готов. Его команду не звать: `setNode` Tiptap на Блоке
      того же типа уходит в `clearNodes`, а тот после вставки в той же цепочке
      отображает позиции нового документа как старые и падает за его краем.
    */
    if (item.id === "paragraph") return void chain.run();
  } else if (item.section === "insert") {
    chain = chain.command(({ tr }) => {
      // Пустой Блок под курсором и есть место нового.
      const { $from } = tr.selection;
      if (!($from.parent.isTextblock && $from.parent.content.size === 0)) openParagraphBelow(tr);
      return true;
    });
  } else {
    // Сначала текущий Блок становится просто абзацем — без списка и
    // цитаты вокруг, — и уже его пункт оборачивает или меняет.
    chain = chain.clearNodes();
  }
  item.run(chain, editor).run();
}

/**
 * «Формат ›» ручки Блока: пункт «Превратить в» над Блоком ручки
 * ЦЕЛИКОМ — весь список, вся цитата, — а не над текстовым Блоком под кареткой.
 * Тот же путь, что у «¶» (`clearNodes`, затем команда пункта), только на время
 * правки выделен весь текст Блока; потом каретка возвращается туда, где была.
 * Одна транзакция — одна отмена.
 */
export function turnBlockInto(editor: Editor, item: InsertItem): void {
  if (item.popover) return applyInsertItem(editor, item, null);
  const block = handleBlock(editor.state);
  if (!block) return;
  const before = editor.state.selection;
  const chain = editor
    .chain()
    .focus()
    .command(({ tr }) => {
      const { doc } = tr;
      tr.setSelection(
        TextSelection.between(doc.resolve(block.start + 1), doc.resolve(block.end - 1))
      );
      return true;
    })
    .clearNodes();
  item
    .run(chain, editor)
    .command(({ tr }) => {
      tr.setSelection(before.map(tr.doc, tr.mapping));
      return true;
    })
    .run();
}
