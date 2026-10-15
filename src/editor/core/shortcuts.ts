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
/**
 * Сочетания встроенных команд по id — данные, а не привязки. Строка справочника
 * берёт клавиши отсюда, где бы она ни жила: в `SHORTCUTS` или в описании
 * Инструмента (`shortcuts`, `keys` кнопки). Поэтому подписи Меню вставки и «¶»,
 * которые читаются при загрузке модуля (`shortcutKeys`), не зависят от того,
 * переехал ли Инструмент.
 */
export const SHORTCUT_KEYS = {
  selectBlock: ["mod", "A"],
  selectDocument: ["mod", "A"],
  undo: ["mod", "Z"],
  redo: ["mod", "shift", "Z"],
  duplicateBlock: ["mod", "shift", "D"],
  moveBlockUp: ["alt", "shift", "↑"],
  moveBlockDown: ["alt", "shift", "↓"],
  blockActions: ["mod", "/"],
  clearFormatting: ["mod", "\\"],
  bold: ["mod", "B"],
  italic: ["mod", "I"],
  strike: ["mod", "shift", "S"],
  underline: ["mod", "U"],
  code: ["mod", "E"],
  superscript: ["mod", "."],
  subscript: ["mod", ","],
  paragraph: ["mod", "alt", "0"],
  h1: ["mod", "alt", "1"],
  h2: ["mod", "alt", "2"],
  h3: ["mod", "alt", "3"],
  h4: ["mod", "alt", "4"],
  codeBlock: ["mod", "alt", "C"],
  bulletList: ["mod", "shift", "8"],
  orderedList: ["mod", "shift", "7"],
  taskList: ["mod", "shift", "9"],
  indentListItem: ["mod", "]"],
  outdentListItem: ["mod", "["],
  alignLeft: ["mod", "shift", "L"],
  alignCenter: ["mod", "shift", "E"],
  alignRight: ["mod", "shift", "R"],
  focusToolbar: ["alt", "F10"],
} as const satisfies Record<string, readonly string[]>;

/** Id строки справочника из таблицы кита. */
export type ShortcutId = keyof typeof SHORTCUT_KEYS;

/**
 * Порядок строк справочника внутри групп — привилегия кита, как `INSERT_ORDER`
 * у Меню вставки, и не зависит от того, где живёт строка: в `SHORTCUTS` или в
 * описании Инструмента. Строки вне списка (кнопки описаний, свои Инструменты)
 * встают в конец своей группы в порядке набора.
 */
export const SHORTCUT_ORDER: readonly string[] = [
  "selectBlock",
  "selectDocument",
  "undo",
  "redo",
  "duplicateBlock",
  "moveBlockUp",
  "moveBlockDown",
  "blockActions",
  "clearFormatting",
  "bold",
  "italic",
  "strike",
  "underline",
  "code",
  "superscript",
  "subscript",
  "paragraph",
  "h1",
  "h2",
  "h3",
  "h4",
  "blockquote",
  "codeBlock",
  "bulletList",
  "orderedList",
  "taskList",
  "indentListItem",
  "outdentListItem",
  "alignLeft",
  "alignCenter",
  "alignRight",
  "focusToolbar",
];

export const SHORTCUTS: readonly ShortcutCommand[] = [
  // Выделение: первое `⌘A` берёт текст Блока, второе — весь Документ (`blockCommands.ts`).
  {
    id: "selectBlock",
    group: "selection",
    tool: null,
    keys: SHORTCUT_KEYS.selectBlock,
    label: (m) => m.selectBlock,
  },
  {
    id: "selectDocument",
    group: "selection",
    tool: null,
    keys: SHORTCUT_KEYS.selectDocument,
    label: (m) => m.selectDocument,
  },

  { id: "undo", group: "history", tool: "history", keys: SHORTCUT_KEYS.undo, label: (m) => m.undo },
  {
    id: "redo",
    group: "history",
    tool: "history",
    keys: SHORTCUT_KEYS.redo,
    label: (m) => m.redo,
  },

  {
    id: "duplicateBlock",
    group: "blocks",
    tool: null,
    keys: SHORTCUT_KEYS.duplicateBlock,
    label: (m) => m.duplicateBlock,
  },
  {
    id: "moveBlockUp",
    group: "blocks",
    tool: null,
    keys: SHORTCUT_KEYS.moveBlockUp,
    label: (m) => m.moveBlockUp,
  },
  {
    id: "moveBlockDown",
    group: "blocks",
    tool: null,
    keys: SHORTCUT_KEYS.moveBlockDown,
    label: (m) => m.moveBlockDown,
  },
  // Меню ручки Блока: ручка есть в любой правке, при любой Панели.
  {
    id: "blockActions",
    group: "blocks",
    tool: null,
    keys: SHORTCUT_KEYS.blockActions,
    label: (m) => m.blockActions,
  },

  {
    id: "codeBlock",
    group: "blockType",
    tool: "codeBlock",
    keys: SHORTCUT_KEYS.codeBlock,
    label: (m) => m.codeBlock,
  },

  {
    id: "indentListItem",
    group: "lists",
    tool: LIST_TOOLS,
    keys: SHORTCUT_KEYS.indentListItem,
    label: (m) => m.indentListItem,
  },
  {
    id: "outdentListItem",
    group: "lists",
    tool: LIST_TOOLS,
    keys: SHORTCUT_KEYS.outdentListItem,
    label: (m) => m.outdentListItem,
  },

  {
    id: "focusToolbar",
    group: "toolbar",
    tool: null,
    keys: SHORTCUT_KEYS.focusToolbar,
    label: (m) => m.focusToolbar,
  },
];

/**
 * Сочетание команды по id или `undefined`, если у команды его нет. Панель
 * спрашивает так про каждую свою кнопку: у горизонтальной линии, картинки и
 * меню цвета сочетаний нет.
 */
export function findShortcutKeys(id: string): readonly string[] | undefined {
  return Object.hasOwn(SHORTCUT_KEYS, id) ? SHORTCUT_KEYS[id as ShortcutId] : undefined;
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
 * Команды включённых инструментов по группам; пустые группы не возвращаются.
 *
 * Проекция списка описаний: строки не переехавших Инструментов — из
 * `SHORTCUTS`, переехавших — из их описаний (`toolDescriptor.ts`): клавиши
 * Части для движка — поле `shortcuts`, сочетания кнопок — поле кнопки. Место
 * строки в группе — `SHORTCUT_ORDER`, а строки вне него — следом в порядке набора;
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
  const commands = [...SHORTCUTS, ...moved].filter((command) => enabled(command, tools));
  const ownGroups: ShortcutSection[] = [];
  for (const descriptor of described) {
    const own: ShortcutRow[] = [];
    for (const button of descriptor.buttons ?? []) {
      const keys = button.shortcut ?? button.keys;
      if (!keys) continue;
      const row: ShortcutRow = {
        id: button.id,
        keys,
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
  // Сортировка устойчивая: строки вне `SHORTCUT_ORDER` сохраняют порядок набора.
  const rank = (id: string) => {
    const index = SHORTCUT_ORDER.indexOf(id);
    return index === -1 ? SHORTCUT_ORDER.length : index;
  };
  return [
    ...SHORTCUT_GROUPS.map((group) => ({
      group,
      commands: commands
        .filter((command) => command.group === group)
        .sort((left, right) => rank(left.id) - rank(right.id)),
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
