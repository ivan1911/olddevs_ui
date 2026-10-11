import type { UiMessages } from "../../i18n/messages.js";
import { describedTools, toolLabel, type ToolList } from "./toolDescriptor.js";
import type { PrefixedName } from "./customTool.js";
import type { Tool } from "./tools.js";

/**
 * Таблица сочетаний клавиш Редактора: одна запись на команду.
 *
 * ОДНА ТАБЛИЦА НА ВСЕХ ПОТРЕБИТЕЛЕЙ. Подсказки и `aria-keyshortcuts` Панели,
 * подписи в Меню вставки и справочник сочетаний читают отсюда. Раньше сочетания
 * жили в `GROUPS` Панели, в `insertItems.ts` и в самих расширениях, и подпись
 * могла разойтись с движком молча. Расширения по-прежнему САМИ вешают клавиши
 * (`blockCommands.ts`, `styleExtensions.ts`, Tiptap), поэтому записи здесь —
 * ПОДПИСИ, а не привязки: совпадение с движком сторожит
 * `tests/rich-text-editor-shortcuts.test.tsx`, нажимая каждое сочетание в живом
 * Редакторе. Запись без привязки — подпись, которая обещает то, чего нет.
 *
 * Модуль серверно-безопасен: данные и две чистые функции, без React и Tiptap —
 * его читают и меню выделения, и справочник, и скрипты.
 *
 * `keys` — в нотации Панели: `mod` — `⌘` на Apple и `Ctrl` у остальных, `alt` и
 * `shift`, дальше сама клавиша как надпись (`Z`, `↑`, `F10`).
 */

type EditorMessages = UiMessages["editor"];

/**
 * Группы справочника — в порядке показа. Группа «Ссылка» — место кита для
 * сочетания кнопки ссылки: само сочетание живёт в её описании (`linkTool.tsx`).
 */
export const SHORTCUT_GROUPS = [
  "selection",
  "history",
  "blocks",
  "clear",
  "marks",
  "blockType",
  "lists",
  "align",
  "link",
  "search",
  "toolbar",
] as const;

export type ShortcutGroup = (typeof SHORTCUT_GROUPS)[number];

export interface ShortcutCommand {
  /** Стабильный ключ; совпадает с id кнопки Панели и пункта Меню вставки, где они есть. */
  id: string;
  group: ShortcutGroup;
  /**
   * Инструмент, при котором сочетание живёт: строка в справочнике есть только
   * у включённого. Массив — достаточно любого из них (сдвиг пункта живёт в
   * любом списке); `null` — команда есть всегда (Блоки, выделение, `Alt+F10`).
   */
  tool: Tool | readonly Tool[] | null;
  /** Дополнительное условие: заголовок первого уровня есть только вместе с `heading`. */
  requires?: Tool;
  keys: readonly string[];
  /** Подпись из каталога — та же, что на кнопке или в пункте меню. */
  label: (messages: EditorMessages) => string;
}

/** Инструменты со списками: у любого есть пункты, а значит — что сдвигать. */
const LIST_TOOLS: readonly Tool[] = ["bulletList", "orderedList", "taskList"];

/**
 * Таблица — сочетания кита и Инструментов, ещё не переехавших на описание.
 * Сочетание кнопки описания — поле самой кнопки (`toolDescriptor.ts`): её
 * строку справочник берёт оттуда, клавишу вешает `toolButtons.ts`.
 */
export const SHORTCUTS: readonly ShortcutCommand[] = [
  // Выделение: первое `⌘A` берёт текст Блока, второе — весь Документ (`blockCommands.ts`).
  {
    id: "selectBlock",
    group: "selection",
    tool: null,
    keys: ["mod", "A"],
    label: (m) => m.selectBlock,
  },
  {
    id: "selectDocument",
    group: "selection",
    tool: null,
    keys: ["mod", "A"],
    label: (m) => m.selectDocument,
  },

  { id: "undo", group: "history", tool: "history", keys: ["mod", "Z"], label: (m) => m.undo },
  {
    id: "redo",
    group: "history",
    tool: "history",
    keys: ["mod", "shift", "Z"],
    label: (m) => m.redo,
  },

  {
    id: "duplicateBlock",
    group: "blocks",
    tool: null,
    keys: ["mod", "shift", "D"],
    label: (m) => m.duplicateBlock,
  },
  {
    id: "moveBlockUp",
    group: "blocks",
    tool: null,
    keys: ["alt", "shift", "↑"],
    label: (m) => m.moveBlockUp,
  },
  {
    id: "moveBlockDown",
    group: "blocks",
    tool: null,
    keys: ["alt", "shift", "↓"],
    label: (m) => m.moveBlockDown,
  },
  // Меню ручки Блока: ручка есть в любой правке, при любой Панели.
  {
    id: "blockActions",
    group: "blocks",
    tool: null,
    keys: ["mod", "/"],
    label: (m) => m.blockActions,
  },

  {
    id: "clearFormatting",
    group: "clear",
    tool: "clearFormatting",
    keys: ["mod", "\\"],
    label: (m) => m.clearFormatting,
  },

  { id: "bold", group: "marks", tool: "bold", keys: ["mod", "B"], label: (m) => m.bold },
  { id: "italic", group: "marks", tool: "italic", keys: ["mod", "I"], label: (m) => m.italic },
  {
    id: "strike",
    group: "marks",
    tool: "strike",
    keys: ["mod", "shift", "S"],
    label: (m) => m.strike,
  },
  {
    id: "underline",
    group: "marks",
    tool: "underline",
    keys: ["mod", "U"],
    label: (m) => m.underline,
  },
  { id: "code", group: "marks", tool: "code", keys: ["mod", "E"], label: (m) => m.code },
  {
    id: "superscript",
    group: "marks",
    tool: "superscript",
    keys: ["mod", "."],
    label: (m) => m.superscript,
  },
  {
    id: "subscript",
    group: "marks",
    tool: "subscript",
    keys: ["mod", ","],
    label: (m) => m.subscript,
  },

  // Подпись — как у пункта «¶» («Текст»), а не «Абзац» Меню вставки: справочник
  // называет команду тем словом, которым её выбирают на Панели.
  {
    id: "paragraph",
    group: "blockType",
    tool: "heading",
    keys: ["mod", "alt", "0"],
    label: (m) => m.textBlock,
  },
  {
    id: "h1",
    group: "blockType",
    tool: "heading1",
    requires: "heading",
    keys: ["mod", "alt", "1"],
    label: (m) => m.heading({ level: 1 }),
  },
  {
    id: "h2",
    group: "blockType",
    tool: "heading",
    keys: ["mod", "alt", "2"],
    label: (m) => m.heading({ level: 2 }),
  },
  {
    id: "h3",
    group: "blockType",
    tool: "heading",
    keys: ["mod", "alt", "3"],
    label: (m) => m.heading({ level: 3 }),
  },
  {
    id: "h4",
    group: "blockType",
    tool: "heading",
    keys: ["mod", "alt", "4"],
    label: (m) => m.heading({ level: 4 }),
  },
  {
    id: "codeBlock",
    group: "blockType",
    tool: "codeBlock",
    keys: ["mod", "alt", "C"],
    label: (m) => m.codeBlock,
  },

  {
    id: "bulletList",
    group: "lists",
    tool: "bulletList",
    keys: ["mod", "shift", "8"],
    label: (m) => m.bulletList,
  },
  {
    id: "orderedList",
    group: "lists",
    tool: "orderedList",
    keys: ["mod", "shift", "7"],
    label: (m) => m.orderedList,
  },
  {
    id: "taskList",
    group: "lists",
    tool: "taskList",
    keys: ["mod", "shift", "9"],
    label: (m) => m.taskList,
  },
  {
    id: "indentListItem",
    group: "lists",
    tool: LIST_TOOLS,
    keys: ["mod", "]"],
    label: (m) => m.indentListItem,
  },
  {
    id: "outdentListItem",
    group: "lists",
    tool: LIST_TOOLS,
    keys: ["mod", "["],
    label: (m) => m.outdentListItem,
  },

  {
    id: "alignLeft",
    group: "align",
    tool: "align",
    keys: ["mod", "shift", "L"],
    label: (m) => m.alignLeft,
  },
  {
    id: "alignCenter",
    group: "align",
    tool: "align",
    keys: ["mod", "shift", "E"],
    label: (m) => m.alignCenter,
  },
  {
    id: "alignRight",
    group: "align",
    tool: "align",
    keys: ["mod", "shift", "R"],
    label: (m) => m.alignRight,
  },

  {
    id: "focusToolbar",
    group: "toolbar",
    tool: null,
    keys: ["alt", "F10"],
    label: (m) => m.focusToolbar,
  },
];

const BY_ID = new Map(SHORTCUTS.map((command) => [command.id, command]));

/**
 * Сочетание команды по id или `undefined`, если у команды его нет. Панель
 * спрашивает так про каждую свою кнопку: у горизонтальной линии, картинки и
 * меню цвета сочетаний нет.
 */
export function findShortcutKeys(id: string): readonly string[] | undefined {
  return BY_ID.get(id)?.keys;
}

/**
 * Сочетание команды по id — для мест, где оно обязано быть (Меню вставки).
 * Неизвестный id — ошибка разработчика, а не пустая подсказка: подпись, которой
 * нет, молча пропала бы из меню.
 */
export function shortcutKeys(id: string): readonly string[] {
  const keys = findShortcutKeys(id);
  if (!keys) throw new Error(`No shortcut "${id}" in the editor shortcut table`);
  return keys;
}

/** Включена ли команда при данном наборе инструментов. */
function enabled(command: ShortcutCommand, tools: ReadonlySet<Tool>): boolean {
  if (command.requires && !tools.has(command.requires)) return false;
  if (command.tool === null) return true;
  return typeof command.tool === "string"
    ? tools.has(command.tool)
    : command.tool.some((tool) => tools.has(tool));
}

/** Строка справочника: подпись команды и её сочетание. */
export type ShortcutRow = Pick<ShortcutCommand, "id" | "keys" | "label">;

/** Группа справочника: группа кита или группа одного Инструмента — без заголовка. */
export interface ShortcutSection {
  group: ShortcutGroup | Tool | PrefixedName;
  commands: readonly ShortcutRow[];
}

/**
 * Место строки переехавшего Инструмента в своей группе: id строки → id строки
 * из `SHORTCUTS`, перед которой она встаёт. Остальные переехавшие строки идут
 * в конец группы. Порядок справочника — не поле описания: место на поверхности
 * держит кит, как `INSERT_ORDER` у Меню вставки.
 */
const MOVED_BEFORE: Readonly<Record<string, string>> = { blockquote: "codeBlock" };

/**
 * Команды включённых инструментов по группам; пустые группы не возвращаются.
 *
 * Проекция списка описаний: строки не переехавших Инструментов — из
 * `SHORTCUTS`, переехавших — из их описаний (`toolDescriptor.ts`): клавиши
 * Части для движка — поле `shortcuts`, сочетания кнопок — поле кнопки. Строка
 * встаёт на место из `MOVED_BEFORE` или следом за строками своей группы кита;
 * кнопка без группы кита — в группу своего Инструмента после групп кита, в
 * порядке списка (ADR-0058, п. 6.8).
 */
export function shortcutGroupsFor(
  tools: ToolList,
  /** Локаль `UiProvider` — для подписи кнопки, заданной функцией от контекста. */
  locale = "en-US"
): readonly ShortcutSection[] {
  const described = describedTools(tools);
  const moved = described.flatMap((descriptor) => descriptor.shortcuts ?? []);
  const anchored = (row: ShortcutCommand) =>
    SHORTCUTS.some((command) => command.id === MOVED_BEFORE[row.id]);
  const commands = [
    ...SHORTCUTS.flatMap((command) => [
      ...moved.filter((row) => MOVED_BEFORE[row.id] === command.id),
      command,
    ]),
    ...moved.filter((row) => !anchored(row)),
  ].filter((command) => enabled(command, tools));
  const ownGroups: ShortcutSection[] = [];
  for (const descriptor of described) {
    const own: ShortcutRow[] = [];
    for (const button of descriptor.buttons ?? []) {
      if (!button.shortcut) continue;
      const row: ShortcutRow = {
        id: button.id,
        keys: button.shortcut,
        label: (messages) => toolLabel(button.label, { locale, messages }),
      };
      // Набор уже отфильтрован: кнопка есть только у включённого Инструмента.
      if (button.shortcutGroup) {
        // Группа справочника — привилегия кита: она бывает только у встроенного.
        commands.push({ ...row, group: button.shortcutGroup, tool: descriptor.name as Tool });
      } else own.push(row);
    }
    // Пункты вставки и Действия над Блоком: сочетание — их поле (ADR-0058, п. 5.7).
    for (const entry of [...(descriptor.insertItems ?? []), ...(descriptor.blockActions ?? [])]) {
      if (entry.shortcut) {
        own.push({
          id: entry.id,
          keys: entry.shortcut,
          label: (messages) => entry.label(messages, locale),
        });
      }
    }
    if (own.length > 0) ownGroups.push({ group: descriptor.name, commands: own });
  }
  return [
    ...SHORTCUT_GROUPS.map((group) => ({
      group,
      commands: commands.filter((command) => command.group === group),
    })),
    ...ownGroups,
  ].filter((entry) => entry.commands.length > 0);
}

/**
 * Apple ли это — ТЕМ ЖЕ признаком, что у ProseMirror (`prosemirror-keymap`):
 * `mod` там значит `⌘` ровно тогда, когда `navigator.platform` похож на Mac или
 * iOS. Подпись, выведенная иначе, разошлась бы с тем, что движок реально
 * слушает. Панель рисуется только в браузере (движок создаётся после
 * гидратации), поэтому `navigator` здесь есть всегда; проверка `typeof` — ради
 * серверного импорта модуля.
 */
export function isApple(): boolean {
  return typeof navigator !== "undefined" && /Mac|iP(hone|[oa]d)/.test(navigator.platform);
}

const APPLE_SYMBOLS: Record<string, string> = { mod: "⌘", alt: "⌥", shift: "⇧" };
const OTHER_NAMES: Record<string, string> = { mod: "Ctrl", alt: "Alt", shift: "Shift" };

/**
 * Сочетание для глаз: `⌘+⇧+S` на Apple, `Ctrl+Shift+S` у остальных. Названия
 * клавиш не переводятся: это надписи на клавишах.
 *
 * Плюс между клавишами — и на Apple, хотя меню macOS пишут
 * сочетание слитно: в справочнике из трёх десятков строк `⌘⌥⇧↑` читается
 * как одно слово, а `⌘+⌥+⇧+↑` — как клавиши, которые нажимают вместе. Одна
 * функция на все подписи Редактора, поэтому тултип и справочник не расходятся.
 */
export function shortcutLabel(keys: readonly string[], apple: boolean): string {
  const names = apple ? APPLE_SYMBOLS : OTHER_NAMES;
  return keys.map((key) => names[key] ?? key).join("+");
}

/**
 * Сочетание для `aria-keyshortcuts`: имена клавиш по спецификации ARIA
 * (`Control`, `Meta`, `Shift`, `Alt`), а не символы — скринридер читает их сам.
 * Стрелки по ARIA называются `ArrowUp` и `ArrowDown`.
 */
export function ariaShortcut(keys: readonly string[], apple: boolean): string {
  const names: Record<string, string> = {
    mod: apple ? "Meta" : "Control",
    alt: "Alt",
    shift: "Shift",
    "↑": "ArrowUp",
    "↓": "ArrowDown",
  };
  return keys.map((key) => names[key] ?? key).join("+");
}
