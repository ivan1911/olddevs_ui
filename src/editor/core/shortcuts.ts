import type { UiMessages } from "../../i18n/messages.js";
import { toolLabel, type ToolList } from "./toolDescriptor.js";
import type { PrefixedName } from "./customTool.js";
import type { Tool } from "./tools.js";

/**
 * The Editor's keyboard shortcut table: one entry per command.
 *
 * ONE TABLE FOR ALL CONSUMERS. The Toolbar's hints and `aria-keyshortcuts`, the labels in the
 * Slash menu, and the keyboard shortcuts popover all read from here. Before, the shortcuts lived
 * in the Toolbar's `GROUPS`, in `insertItems.ts` and in the extensions themselves, and a label
 * could silently drift from the engine. The extensions still bind the keys themselves
 * (`blockCommands.ts`, `styleExtensions.ts`, Tiptap), so the entries here are LABELS, not
 * bindings. That they match the engine is guarded by `tests/rich-text-editor-shortcuts.test.tsx`,
 * which presses every shortcut in a live Editor. An entry without a binding is a label that
 * promises something that does not exist.
 *
 * The module is safe on the server: data and two pure functions, without React and Tiptap. The
 * Bubble menu, the shortcuts popover, and the scripts all read it.
 *
 * `keys` use the Toolbar's notation: `mod` is `⌘` on Apple and `Ctrl` on other platforms, then
 * `alt` and `shift`, then the key itself as a label (`Z`, `↑`, `F10`).
 */

type EditorMessages = UiMessages["editor"];

/**
 * Groups of the reference, in display order. The "link" group is the kit's place for the link
 * button's shortcut: the shortcut itself lives in that button's description (`linkTool.tsx`).
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
  /** Stable key; matches the id of the Toolbar button and the Slash menu item where they exist. */
  id: string;
  group: ShortcutGroup;
  /**
   * The Tool the shortcut lives with: the row shows in the reference only when that Tool is
   * enabled. An array means any one of them is enough (the list item shift lives with any list);
   * `null` means the command always exists (Blocks, selection, `Alt+F10`).
   */
  tool: Tool | readonly Tool[] | null;
  /** An extra condition: the first-level heading command exists only together with `heading`. */
  requires?: Tool;
  keys: readonly string[];
  /** Label from the catalog: the same one as on the button or in the menu item. */
  label: (messages: EditorMessages) => string;
}

/** Tools with lists: each of them has items, and so there is something to shift. */
const LIST_TOOLS: readonly Tool[] = ["bulletList", "orderedList", "taskList"];

/**
 * Built-in command shortcuts by id: data, not bindings. A reference row takes its keys from here,
 * wherever the row lives: in `SHORTCUTS` or in a Tool's description (the `shortcuts` field, and
 * the button's `keys`). That is why the Slash menu and the '¶' button labels, which are read when
 * the module loads (`shortcutKeys`), do not depend on where the row lives.
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
  blockquote: ["mod", "shift", "B"],
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

/** Id of a reference row from the kit's table. */
export type ShortcutId = keyof typeof SHORTCUT_KEYS;

/**
 * The order of reference rows within groups is the kit's prerogative, like `INSERT_ORDER` in the
 * Slash menu, and does not depend on where the row lives: in `SHORTCUTS` or in a Tool's
 * description. Rows outside the list (buttons in descriptions, custom Tools) go to the end of
 * their group, in registration order.
 */
export const SHORTCUT_ORDER: readonly ShortcutId[] = [
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

/**
 * The table holds the kit's shortcuts: commands that exist in any configuration (selection,
 * Blocks, list item shift, `Alt+F10`). Tool rows live in their descriptions. A button
 * description's shortcut is a field of the button itself (`toolDescriptor.ts`): the reference
 * takes its row from there, and `toolButtons.ts` binds the key.
 */
export const SHORTCUTS: readonly ShortcutCommand[] = [
  // Selection: the first `⌘A` selects the text of the Block, the second selects the whole
  // Document (`blockCommands.ts`).
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
  // The Block handle's menu: the handle exists in any editing session, with any Toolbar setup.
  {
    id: "blockActions",
    group: "blocks",
    tool: null,
    keys: SHORTCUT_KEYS.blockActions,
    label: (m) => m.blockActions,
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
 * The command's shortcut by id, or `undefined` if the command has none. The Toolbar asks this
 * about each of its buttons: the horizontal rule, image and color menu have no shortcuts.
 */
export function findShortcutKeys(id: string): readonly string[] | undefined {
  return Object.hasOwn(SHORTCUT_KEYS, id) ? SHORTCUT_KEYS[id as ShortcutId] : undefined;
}

/**
 * The command's shortcut by id, for places where it must exist (the Slash menu). An unknown id is
 * a developer error, not an empty hint: a label that is missing would silently disappear from the
 * menu.
 */
export function shortcutKeys(id: string): readonly string[] {
  const keys = findShortcutKeys(id);
  if (!keys) throw new Error(`No shortcut "${id}" in the editor shortcut table`);
  return keys;
}

/** Whether the command is enabled for the given set of Tools. */
function enabled(command: ShortcutCommand, tools: ReadonlySet<Tool>): boolean {
  if (command.requires && !tools.has(command.requires)) return false;
  if (command.tool === null) return true;
  return typeof command.tool === "string"
    ? tools.has(command.tool)
    : command.tool.some((tool) => tools.has(tool));
}

/** Reference row: a command's label and its shortcut. */
export type ShortcutRow = Pick<ShortcutCommand, "id" | "keys" | "label">;

/** Reference group: a kit group, or the group of a single Tool, without a heading. */
export interface ShortcutSection {
  group: ShortcutGroup | Tool | PrefixedName;
  commands: readonly ShortcutRow[];
}

/**
 * Commands of the enabled Tools by group; empty groups are not returned.
 *
 * A projection of the descriptor list: the kit rows come from `SHORTCUTS`, and the Tool rows come
 * from their descriptions (`toolDescriptor.ts`). The Extensions' keys come from the `shortcuts`
 * field, and button shortcuts come from the button's field. A row's place in its group is set by
 * `SHORTCUT_ORDER`; rows outside it follow in registration order. A button without a kit group
 * goes to its Tool's group, after the kit groups, in list order (ADR-0058, item 6.8).
 */
export function shortcutGroupsFor(
  tools: ToolList,
  /** The `UiProvider` locale, for a button label given as a function of the context. */
  locale = "en-US"
): readonly ShortcutSection[] {
  const described = tools.descriptors;
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
      // The set is already filtered: a button exists only for an enabled Tool.
      if (button.shortcutGroup) {
        // A reference group is the kit's privilege: only built-in Tools have one.
        commands.push({ ...row, group: button.shortcutGroup, tool: descriptor.name as Tool });
      } else own.push(row);
    }
    // Insert items and Block actions: the shortcut is their own field (ADR-0058, item 5.7).
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
  // The sort is stable: rows outside `SHORTCUT_ORDER` keep their registration order.
  const rank = (id: string) => {
    const index = (SHORTCUT_ORDER as readonly string[]).indexOf(id);
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
 * Whether this is Apple, by the SAME check ProseMirror uses (`prosemirror-keymap`): there `mod`
 * means `⌘` exactly when `navigator.platform` looks like a Mac or iOS. A label derived any other
 * way would drift from what the engine actually listens for. The Toolbar is rendered only in the
 * browser (the Editor is created after hydration), so `navigator` is always present here; the
 * `typeof` check is for importing the module on the server.
 */
export function isApple(): boolean {
  return typeof navigator !== "undefined" && /Mac|iP(hone|[oa]d)/.test(navigator.platform);
}

const APPLE_SYMBOLS: Record<string, string> = { mod: "⌘", alt: "⌥", shift: "⇧" };
const OTHER_NAMES: Record<string, string> = { mod: "Ctrl", alt: "Alt", shift: "Shift" };

/**
 * Display form of the shortcut: `⌘+⇧+S` on Apple, `Ctrl+Shift+S` elsewhere. Key names are not translated:
 * they are the labels printed on the keys.
 *
 * The plus sign between keys is used on Apple too, even though macOS menus write shortcuts
 * together. In a reference of thirty-odd rows, `⌘⌥⇧↑` reads as one word, while `⌘+⌥+⇧+↑` reads
 * as keys pressed together. One function serves all Editor labels, so the tooltip and the
 * reference do not diverge.
 */
export function shortcutLabel(keys: readonly string[], apple: boolean): string {
  const names = apple ? APPLE_SYMBOLS : OTHER_NAMES;
  return keys.map((key) => names[key] ?? key).join("+");
}

/**
 * Shortcut for `aria-keyshortcuts`: key names from the ARIA spec (`Control`, `Meta`, `Shift`,
 * `Alt`), not symbols, since the screen reader reads them itself. ARIA names the arrows
 * `ArrowUp` and `ArrowDown`.
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
