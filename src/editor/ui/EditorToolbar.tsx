"use client";

// Origin: minimal-tiptap, `components/toolbar-button.tsx`,
// `toolbar-section.tsx`, `shortcut-key.tsx`, `section/one.tsx`, `two.tsx`,
// `four.tsx`, `five.tsx` and `utils.ts` (`getShortcutKey`) (MIT, © 2024 Aslam,
// https://github.com/Aslam97/minimal-tiptap). The action table (command, active
// flag, availability, shortcut) and the section markup are carried over.
// The shadcn components were replaced with the kit's primitives; see the comment
// on `EditorToolbar`. License: NOTICE at the package root.

import { useEditorState, type Editor } from "@tiptap/react";
import { useEffect, useRef, type ComponentType } from "react";
import { Kbd } from "../../components/content/Kbd.js";
import { Separator } from "../../components/content/Separator.js";
import { Toolbar } from "../../components/actions/Toolbar.js";
import { Tooltip, TooltipProvider } from "../../components/overlays/Tooltip.js";
import type { UiMessages } from "../../i18n/messages.js";
import { useMessages } from "../../i18n/useMessages.js";
import { CollapseIcon, SearchIcon, SourceIcon, type IconProps } from "../../icons.js";
import { buttonClasses } from "../../lib/button.js";
import { cn } from "../../lib/cn.js";
import { TOUCH_HIDDEN_CLASS } from "../../lib/touch.js";
import {
  AlignMenu,
  BlockTypeMenu,
  hasBlockTypeMenu,
  hasListMenu,
  ListMenu,
  moreFormatTools,
  MoreFormatMenu,
  type FullscreenMenuState,
} from "./FormatMenus.js";
import { insertItemsFor } from "../core/insertItems.js";
import { FOOTNOTE_NODE } from "../features/footnotes/footnoteNames.js";
import { InsertMenuButton } from "./InsertMenuButton.js";
import { TOOLBAR_ROW_MARKS } from "./rowMarks.js";
import { HighlightMenuButton } from "./ColorMenus.js";
import { ShortcutsButton } from "./ShortcutsButton.js";
import { SEARCH_KEYS } from "../features/search/searchTool.js";
import { ariaShortcut, findShortcutKeys, isApple, shortcutLabel } from "../core/shortcuts.js";
import { tableChunk } from "../features/table/tableTool.js";
import { type KitToolButton, type ToolList } from "../core/toolDescriptor.js";
import { ToolButtonView, useToolLabel } from "./ToolButtonView.js";
import type { Tool } from "../core/tools.js";

// Shortcut labels moved to the shared table; the export stays for the Slash menu.
export { isApple, shortcutLabel };

type EditorMessages = UiMessages["editor"];

/**
 * One Toolbar button: a table row, like `FormatAction` in the original.
 *
 * The shortcut is not stored here: it is taken from the shared table by `id` (`shortcuts.ts`),
 * instead of each button keeping its own.
 */
interface Action {
  kind: "button";
  tool: Tool;
  /** A stable key: one Tool can have several buttons. */
  id: string;
  label: (messages: EditorMessages) => string;
  icon: ComponentType<IconProps>;
  run: (editor: Editor) => void;
  can: (editor: Editor) => boolean;
  /** If present, the button is a toggle with `aria-pressed`; if absent, it is a one-off action. */
  isActive?: (editor: Editor) => boolean;
}

/**
 * A place on the Toolbar for a menu or a popover with its own component. Whether it is there
 * is decided by `present`, from the set of Tools. Menus have their own rules: the "¶" menu is
 * not drawn for a set with only "Text", while "Lists" with one item is drawn. The Toolbar does
 * not repeat those rules; it asks the menu's module.
 */
interface Widget {
  kind: "insert" | "source" | "blockType" | "align" | "highlight" | "more" | "lists" | "table";
  id: string;
  /** `withView`: the host has the "Invisible characters" item (the fixed Toolbar). */
  present: (tools: ToolList, withView: boolean) => boolean;
}

/**
 * The place for a Tool's buttons, from its description (`toolDescriptor.ts`) — a privilege
 * of the kit: the Toolbar reserves the place by name, while the buttons, labels and actions
 * come from the description. A disabled Tool takes its buttons away together with the
 * description, and the place becomes empty.
 */
interface Slot {
  kind: "slot";
  id: string;
  tool: Tool;
}

/** A description's button, in its place on the Toolbar. */
interface ToolEntry {
  kind: "tool";
  id: string;
  button: KitToolButton;
}

type Entry = Action | Widget | Slot;

const widget = (kind: Widget["kind"], present: Widget["present"]): Widget => ({
  kind,
  id: kind,
  present,
});

const slot = (tool: Tool): Slot => ({ kind: "slot", id: tool, tool });

/**
 * The Toolbar's groups, in order, separated by dividers:
 *
 *   "+" · HTML · "¶" · align ▾ | bold · italic · highlight · "…" |
 *   lists ▾ | link · image · table ▾ · emoji | undo · redo
 *
 * and the keyboard shortcuts popover at the right edge. The groups follow meaning: the Block
 * as a whole (insert, change its type, align), Marks, lists, inserting into the text, and
 * history. An empty group drops out together with its divider.
 *
 * THE KIT SETS THE ORDER, not `tools`: a Toolbar with rearranged buttons would have to be
 * learned again on each of two screens of one product.
 *
 * MENUS INSTEAD OF A ROW OF BUTTONS. There used to be a rule: "every action is a button in a
 * row, with no dropdowns, not even "More" or "Lists"". An action hidden in a menu did not
 * expose `aria-pressed`, so a screen reader could not tell whether italic was on without
 * opening the menu. ADR-0054 withdrew that argument: an item with a check mark
 * (`menuitemradio`, `menuitemcheckbox`) announces its state, and the menu button carries the
 * current value in its name and icon (`FormatMenus.tsx`). The Block type and the blockquote
 * are in "¶". Rare Marks, colors and clearing are in "…". Alignment and lists are in their
 * own menus, and the horizontal rule stayed only in the Slash menu. The code Block is a
 * check-mark item in "…", since it is used rarely (owner's decision). Frequent Marks stayed
 * as buttons (bold and italic: owner's decision), along with link, image and history.
 * Highlight is a button with a row of highlights (`ColorMenus.tsx`). "Color" with the text
 * and highlight grids is in the Bubble menu, not here (owner's decision: no duplicates).
 *
 * "HTML" sits right after "+", as in Redactor: it is a toggle for the Document's mode as a
 * whole, not an action on the Block under the caret. It exists only on the fixed Toolbar
 * (`source`): the floating Toolbar and the Bubble menu live above a selection in the Document,
 * and there is no selection in source mode, so entering it would leave no way out.
 *
 * When the row is wider than the Toolbar, it wraps via the primitive's `flex-wrap` rather
 * than running past the edge, and it wraps by whole groups. With the "Highlight" and "Color"
 * buttons, the `full` Toolbar in a 640 px column takes two rows, and no group leaves a lone button on its own row.
 *
 * DESCRIPTION BUTTONS (ADR-0058, item 5.3). Link, image and emoji sit in the places the kit
 * reserved for their Tools (`slot`). Description buttons without a place in the kit get their
 * own group, before "Undo" and "Redo", in the order of the Tools list.
 */
/** The Tools behind the Toolbar's "…" menu: none of them is in the row of Marks. */
const MORE_FORMAT_TOOLS = moreFormatTools();

const GROUPS: readonly (readonly Entry[])[] = [
  [
    widget("insert", (tools) => insertItemsFor(tools).length > 0),
    widget("source", (tools) => tools.has("source")),
    widget("blockType", hasBlockTypeMenu),
    widget("align", (tools) => tools.has("align")),
  ],
  [
    // The frequent Marks of the row are shared with the Bubble menu (`rowMarks.ts`).
    ...TOOLBAR_ROW_MARKS.map((mark): Action => ({ kind: "button", ...mark })),
    // Only "Highlight": "Color" with both grids is in the Bubble menu.
    widget("highlight", (tools) => tools.has("highlight")),
    // "Invisible characters" lives in "…" only on the fixed Toolbar. If it is the only
    // item there, the "…" button is needed for its sake alone.
    widget(
      "more",
      (tools, withView) =>
        MORE_FORMAT_TOOLS.some((tool) => tools.has(tool)) ||
        (withView &&
          (tools.has("invisibleCharacters") || tools.has("fullscreen") || tools.has("focus")))
    ),
  ],
  [widget("lists", hasListMenu)],
  [slot("link"), slot("image"), widget("table", (tools) => tools.has("table")), slot("emoji")],
  [slot("history")],
];

/** Tools whose buttons the kit has given a place on the Toolbar. */
const SLOTTED: readonly Tool[] = GROUPS.flat().flatMap((entry) =>
  entry.kind === "slot" ? [entry.tool] : []
);

type GroupEntry = Action | Widget | ToolEntry;

/**
 * The Toolbar's groups for a set of Tools, shared by the Toolbar and its Skeleton
 * (`ToolbarSkeleton`). The description buttons stand in the kit's places (`slot`), and in
 * their own group before history. The visibility predicate of the description buttons is not
 * read here, since it needs the engine.
 */
function toolbarGroups(tools: ToolList, withSource: boolean, withView: boolean): GroupEntry[][] {
  const described = tools.descriptors;
  const toolEntries = (buttons: readonly KitToolButton[] = []) =>
    buttons.map((button): ToolEntry => ({ kind: "tool", id: button.id, button }));
  const kitGroups = GROUPS.map((group) =>
    group.flatMap((entry): GroupEntry[] => {
      if (entry.kind === "slot") {
        return toolEntries(described.find((descriptor) => descriptor.name === entry.tool)?.buttons);
      }
      if (entry.kind === "button") return tools.has(entry.tool) ? [entry] : [];
      return entry.present(tools, withView) && (entry.kind !== "source" || withSource)
        ? [entry]
        : [];
    })
  );
  const ownGroup = toolEntries(
    described
      .filter((descriptor) => !(SLOTTED as readonly string[]).includes(descriptor.name))
      .flatMap((descriptor) => descriptor.buttons ?? [])
  );
  return [...kitGroups.slice(0, -1), ownGroup, kitGroups[kitGroups.length - 1]!];
}

/** Toolbar places whose button is a menu with an arrow: it is wider than a square icon. */
const MENU_WIDGETS: ReadonlySet<Widget["kind"]> = new Set(["blockType", "align", "lists", "table"]);

/** A Toolbar button: an icon without a label. The name is `aria-label`, and the tooltip carries the shortcut. */
const BUTTON_CLASS = buttonClasses({ variant: "ghost", size: "sm", iconOnly: true });
const BUTTON_PRESSED_CLASS = buttonClasses({
  variant: "ghost",
  size: "sm",
  iconOnly: true,
  selected: true,
});

const TOOL_BUTTON_CLASSES = { idle: BUTTON_CLASS, pressed: BUTTON_PRESSED_CLASS };

/** A menu place with an arrow in the Skeleton: the same classes as the `FormatMenu` button. */
const MENU_PLACE_CLASS = cn(buttonClasses({ variant: "ghost", size: "sm" }), "gap-0.5 px-1.5");

export interface EditorToolbarProps {
  editor: Editor;
  tools: ToolList;
  /** The field is disabled: the buttons are visible, but they cannot be pressed and do not take focus. */
  disabled: boolean;
  /** The "Insert table…" item of the "Table" menu: the dialog is held by `RichTextEditor`. */
  onInsertTable?: () => void;
  /**
   * The keyboard shortcuts popover, as the last button at the right edge. It is present
   * only on the fixed Toolbar: above a selection (`floating`) there is no room for it, and
   * the Bubble menu does not carry it.
   */
  shortcutsReference?: boolean;
  /**
   * Source mode: the "HTML" button and its state. The mode is held by `RichTextEditor`.
   * Without the prop there is no button, as on the floating Toolbar.
   */
  source?: { active: boolean; onToggle: () => void };
  /**
   * The "Find" button at the right edge, before the keyboard shortcuts popover.
   * The find panel is held by `RichTextEditor`. Without the prop there is no button, as on
   * the floating Toolbar and without the `search` Tool.
   */
  search?: { open: boolean; onToggle: () => void };
  /**
   * The "Invisible characters" item in the "…" menu. The engine (the extension's plugin)
   * holds the visibility, so the prop only says "the item is there": the menu reads its
   * check mark from the engine itself. Without the prop there is no item, as on the floating
   * Toolbar (which draws the same "…" as the fixed one) and without the `invisibleCharacters` Tool.
   */
  invisibleCharacters?: boolean;
  /**
   * Fullscreen mode (ADR-0082): the "Fullscreen" item of the "…" menu and, while the layer is open,
   * the visible "Collapse" button at the right edge. The layer is held by `RichTextEditor`, so the
   * Toolbar gets its state and the toggle. Without the prop, or without the `fullscreen` Tool, neither exists.
   */
  fullscreen?: FullscreenMenuState;
  /** The "Focus mode" item of the "…" menu; the engine holds the mode. Without the `focus` Tool there is no item. */
  focusMode?: boolean;
}

/**
 * The fixed Toolbar of the Editor.
 *
 * THE KIT'S PRIMITIVES INSTEAD OF shadcn. ADR-0050 allows keeping shadcn components inside
 * the Editor, but the kit already has the ones the Toolbar needs, and each of them covers the
 * required contract itself:
 *
 * - `Toolbar`: `role="toolbar"`, one Tab stop, arrows, Home and End. It also does not take
 *   Home and End away from `[contenteditable]`.
 * - `Menu` (react-aria): the "+", "¶", "…", alignment, lists and table menus. Escape and
 *   z-index go through the layer stack of ADR-0041, and Escape inside a menu in a `Dialog`
 *   closes the menu, not the window. shadcn's `DropdownMenu` would pull a new Radix package
 *   into the kit's dependencies for the same behavior.
 * - `Tooltip` and `Kbd`: a tooltip with a shortcut at the `OVERLAY_LAYER.popover` step.
 *
 * Button state is read through `useEditorState`: the Toolbar re-renders only when what it
 * shows changes, not on every transaction.
 */
export function EditorToolbar({
  editor,
  tools,
  disabled,
  onInsertTable,
  shortcutsReference = false,
  source,
  search,
  invisibleCharacters = false,
  fullscreen,
  focusMode = false,
}: EditorToolbarProps) {
  const messages = useMessages().editor;
  const label = useToolLabel();
  const apple = isApple();
  /*
    The description buttons are a projection of the Tools list: at the kit's place (`slot`),
    and in their own group before history. Whether a button is shown now is also decided by
    its visibility predicate, which is read after the state below.
  */
  const present = toolbarGroups(
    tools,
    source != null,
    invisibleCharacters || fullscreen !== undefined || focusMode
  );
  const collapse = fullscreen?.open && tools.has("fullscreen") ? fullscreen.onToggle : undefined;
  const entries = present.flat();
  const actions = entries.filter((entry): entry is Action => entry.kind === "button");
  const toolButtons = entries.flatMap((entry) => (entry.kind === "tool" ? [entry.button] : []));
  const insertItems = insertItemsFor(tools);
  /*
    HTML mode: there is no Document on screen, so the Toolbar's actions have nothing to apply
    to. The buttons and menus are `aria-disabled` and stay in the arrow-key traversal. Only
    the "HTML" button itself and the keyboard shortcuts popover are available.
  */
  const locked = source?.active ?? false;

  /*
    `aria-keyshortcuts` is the shortcut that moves focus from the document into the Toolbar
    (`Alt+F10`, `extensions.ts`). The screen reader announces it on the Toolbar itself, so the
    way in can be discovered without opening the documentation. The attribute is set on the
    node rather than as a prop: react-aria's `Toolbar` passes into the DOM only the attributes
    it knows, and this one would never reach the markup.
  */
  const toolbarRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    toolbarRef.current?.setAttribute("aria-keyshortcuts", "Alt+F10");
  }, []);

  /*
    The result is compared deeply (the default of `useEditorState`), so the flags object is
    rebuilt on every transaction, but a render happens only when a flag changes.
  */
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => {
      const flags: Record<string, { active: boolean; can: boolean; visible?: boolean }> = {};
      for (const action of [...actions, ...toolButtons]) {
        flags[action.id] = {
          active: action.isActive?.(current) ?? false,
          can: current.isEditable && action.can(current),
        };
      }
      for (const button of toolButtons) {
        flags[button.id]!.visible = button.isVisible?.(current) ?? true;
      }
      return {
        flags,
        editable: current.isEditable,
        // A footnote is a line of running text: it has no Block menu, so "+" is unavailable there (ADR-0076).
        inFootnote: current.state.selection.$from.parent.type.name === FOOTNOTE_NODE,
      };
    },
  });

  const groups = present
    .map((group) =>
      group.filter((entry) => entry.kind !== "tool" || state.flags[entry.id]?.visible !== false)
    )
    .filter((group) => group.length > 0);

  /*
    What the menus take from the host (`FormatMenuHostProps`): the engine, the Tools, the
    disabled state, and the shortcut label. An engine that is not editable disables the menus
    the same way a disabled field does.
  */
  const host = {
    editor,
    tools,
    disabled: disabled || !state.editable,
    unavailable: locked,
    shortcut: (keys: readonly string[]) => shortcutLabel(keys, apple),
  };

  const renderButton = (action: Action) => {
    const flags = state.flags[action.id];
    const pressed = flags?.active ?? false;
    const label = action.label(messages);
    const Icon = action.icon;
    const keys = findShortcutKeys(action.id);
    /*
      An unavailable action gets `aria-disabled`, not `disabled`. APG advises keeping the
      Toolbar's actions focusable: otherwise arrow keys skip the button silently, and it is
      unclear where it went. A disabled FIELD is different: there is nothing to focus in it.
    */
    const unavailable = locked || !(flags?.can ?? false);
    return (
      <Tooltip
        key={action.id}
        content={
          <span className="flex items-center gap-2">
            {label}
            {keys && <Kbd aria-hidden="true">{shortcutLabel(keys, apple)}</Kbd>}
          </span>
        }
      >
        <button
          type="button"
          aria-label={label}
          aria-pressed={action.isActive ? pressed : undefined}
          aria-disabled={unavailable || undefined}
          aria-keyshortcuts={keys ? ariaShortcut(keys, apple) : undefined}
          disabled={disabled}
          onClick={() => {
            if (!unavailable) action.run(editor);
          }}
          className={cn(pressed ? BUTTON_PRESSED_CLASS : BUTTON_CLASS)}
        >
          <Icon size={16} aria-hidden />
        </button>
      </Tooltip>
    );
  };

  /*
    The "HTML" button is a mode toggle with `aria-pressed`. It has no shortcut (per the slice
    spec), and its tooltip is its name. A disabled field disables it too: the mode stays open,
    while the HTML field is disabled along with it.
  */
  const renderSourceButton = ({ active, onToggle }: NonNullable<EditorToolbarProps["source"]>) => (
    <Tooltip key="source" content={messages.source}>
      <button
        type="button"
        aria-label={messages.source}
        aria-pressed={active}
        disabled={disabled}
        onClick={onToggle}
        className={cn(active ? BUTTON_PRESSED_CLASS : BUTTON_CLASS)}
      >
        <SourceIcon size={16} aria-hidden />
      </button>
    </Tooltip>
  );

  return (
    /*
      Its own tooltip group. The kit leaves the root `TooltipProvider` to the consumer, but
      the Editor would crash without one (Radix requires a provider). Requiring it for a single
      field would break embedding the Editor in an app that had no tooltips yet. The Toolbar's
      group also gives what the provider exists for: while the cursor moves across neighboring
      buttons, the tooltips replace each other without a delay.
    */
    <TooltipProvider>
      <Toolbar ref={toolbarRef} aria-label={messages.toolbar} className="gap-0.5">
        {groups.map((group, index) => (
          /*
            A group is an unbreakable block: a narrow Toolbar wraps it as a whole, so "Undo ·
            Redo" never splits across rows. The divider is at the end of the group, not the start:
            a wrapped row begins with a button, not with a divider.
          */
          <div key={group.map((entry) => entry.id).join()} className="flex items-center gap-0.5">
            {group.map((entry) => {
              switch (entry.kind) {
                case "insert":
                  return (
                    <InsertMenuButton
                      key={entry.id}
                      editor={editor}
                      items={insertItems}
                      disabled={host.disabled}
                      unavailable={locked || state.inFootnote}
                      shortcut={host.shortcut}
                    />
                  );
                case "blockType":
                  return <BlockTypeMenu key={entry.id} {...host} />;
                case "align":
                  return <AlignMenu key={entry.id} {...host} />;
                case "highlight":
                  return <HighlightMenuButton key={entry.id} {...host} />;
                case "more":
                  return (
                    <MoreFormatMenu
                      key={entry.id}
                      {...host}
                      invisibleCharacters={invisibleCharacters}
                      fullscreen={fullscreen}
                      focusMode={focusMode}
                    />
                  );
                case "lists":
                  return <ListMenu key={entry.id} {...host} />;
                case "table": {
                  // The "Table" menu comes from the table's lazy chunk (`tableTool.ts`).
                  // The Toolbar draws while the engine is live, and the engine with the table comes after the chunk.
                  const TableMenuButton = tableChunk()?.TableMenuButton;
                  return (
                    TableMenuButton && (
                      <TableMenuButton
                        key={entry.id}
                        editor={editor}
                        disabled={host.disabled}
                        unavailable={locked}
                        onInsertDialog={onInsertTable}
                        shortcut={host.shortcut}
                      />
                    )
                  );
                }
                case "source":
                  return source && renderSourceButton(source);
                case "tool":
                  return (
                    <ToolButtonView
                      key={entry.id}
                      editor={editor}
                      button={entry.button}
                      label={label(entry.button.label)}
                      pressed={state.flags[entry.id]?.active ?? false}
                      unavailable={locked || !(state.flags[entry.id]?.can ?? false)}
                      disabled={host.disabled}
                      classes={TOOL_BUTTON_CLASSES}
                    />
                  );
                case "button":
                  return renderButton(entry);
              }
            })}
            {/* `h-auto`: the group has no height of its own, and `h-full` on the divider
                would give zero. The divider is stretched by `self-stretch`. */}
            {index < groups.length - 1 && <Separator className="h-auto" />}
          </div>
        ))}
        {(search || shortcutsReference || collapse) && (
          /*
            Find and the keyboard shortcuts popover form one group at the right edge. A narrow
            Toolbar moves it to a new row as a whole, also to the right: one button of the popover
            on its own would be stranded at the start of a row.
          */
          <div className="ml-auto flex items-center gap-0.5">
            {search && (
              /*
                The panel toggle: `aria-pressed` means the panel is open. In HTML mode there is
                no Document on screen, so there is nowhere to search. The button is `aria-disabled`,
                like the other actions.
              */
              <Tooltip
                content={
                  <span className="flex items-center gap-2">
                    {messages.search}
                    <Kbd aria-hidden="true">{shortcutLabel(SEARCH_KEYS, apple)}</Kbd>
                  </span>
                }
              >
                <button
                  type="button"
                  aria-label={messages.search}
                  aria-pressed={search.open}
                  aria-disabled={locked || undefined}
                  aria-keyshortcuts={ariaShortcut(SEARCH_KEYS, apple)}
                  disabled={disabled}
                  onClick={() => {
                    if (!locked) search.onToggle();
                  }}
                  className={search.open ? BUTTON_PRESSED_CLASS : BUTTON_CLASS}
                >
                  <SearchIcon size={16} aria-hidden />
                </button>
              </Tooltip>
            )}
            {shortcutsReference && <ShortcutsButton tools={tools} disabled={disabled} />}
            {collapse && (
              /*
                "Collapse" is always visible, not only an `Esc` away: a touch screen has no `Esc`
                (ADR-0082). It is at the right edge, where "Fullscreen" would put a button of its own.
              */
              <Tooltip content={messages.fullscreenExit}>
                <button
                  type="button"
                  aria-label={messages.fullscreenExit}
                  disabled={disabled}
                  onClick={collapse}
                  className={BUTTON_CLASS}
                >
                  <CollapseIcon size={16} aria-hidden />
                </button>
              </Tooltip>
            )}
          </div>
        )}
      </Toolbar>
    </TooltipProvider>
  );
}

export interface ToolbarSkeletonProps {
  tools: ToolList;
  /** Whether the "HTML" button is present (the Toolbar's `source`). */
  source: boolean;
  /** Whether the "Find" button and the keyboard shortcuts popover at the right edge are present. */
  search: boolean;
  /** Whether the "…" menu has an "Invisible characters" item. That decides whether the Toolbar needs its "…" button. */
  invisibleCharacters: boolean;
  /** Whether the "…" menu has a "Fullscreen" or a "Focus mode" item: either one makes the Toolbar need its "…" button too. */
  view?: boolean;
  shortcutsReference: boolean;
}

/**
 * The Toolbar's Skeleton (ADR-0058, item 11.4): an invisible copy of its layout, with the same
 * groups, the same button and divider sizes, and the same wrapping by groups. The Skeleton has
 * as many rows as the Toolbar would have at this width, so the engine takes its place without
 * a height jump. With the "Highlight" and "Color" buttons, the `full` Toolbar in a 640 px column
 * takes two rows, while the Skeleton held one.
 */
export function ToolbarSkeleton({
  tools,
  source,
  search,
  invisibleCharacters,
  view = false,
  shortcutsReference,
}: ToolbarSkeletonProps) {
  const groups = toolbarGroups(tools, source, invisibleCharacters || view).filter(
    (group) => group.length > 0
  );
  const place = (key: string, menu: boolean, className?: string) => (
    <span key={key} className={cn(menu ? MENU_PLACE_CLASS : BUTTON_CLASS, className)}>
      <span className="size-4" />
      {menu && <span className="size-3" />}
    </span>
  );
  return (
    <div aria-hidden="true" className="invisible flex flex-row flex-wrap items-center gap-0.5">
      {groups.map((group, index) => (
        <div key={index} className="flex items-center gap-0.5">
          {group.map((entry) =>
            place(
              entry.id,
              entry.kind !== "tool" && entry.kind !== "button" && MENU_WIDGETS.has(entry.kind)
            )
          )}
          {index < groups.length - 1 && <Separator orientation="vertical" className="h-auto" />}
        </div>
      ))}
      {(search || shortcutsReference) && (
        <div className="ml-auto flex items-center gap-0.5">
          {search && place("search", false)}
          {shortcutsReference && place("shortcuts", false, TOUCH_HIDDEN_CLASS)}
        </div>
      )}
    </div>
  );
}
