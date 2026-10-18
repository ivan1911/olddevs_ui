"use client";

import { useEditorState, type Editor } from "@tiptap/react";
import { Fragment, type ComponentType, type ReactNode } from "react";
import {
  Menu,
  MenuButton,
  MenuItem,
  MenuSection,
  MenuSeparator,
  MenuTrigger,
  SubmenuTrigger,
} from "../../components/overlays/Menu.js";
import { Tooltip } from "../../components/overlays/Tooltip.js";
import type { UiMessages } from "../../i18n/messages.js";
import { cn } from "../../lib/cn.js";
import { useMessages, useUiLocale } from "../../i18n/useMessages.js";
import {
  AlignCenterIcon,
  AlignLeftIcon,
  AlignRightIcon,
  ChevronDownIcon,
  ClearFormattingIcon,
  CodeBlockIcon,
  InlineCodeIcon,
  FootnoteIcon,
  InvisibleCharactersIcon,
  ListIcon,
  MoreIcon,
  ParagraphIcon,
  StrikethroughIcon,
  SubscriptIcon,
  SuperscriptIcon,
  UnderlineIcon,
  type IconProps,
} from "../../icons.js";
import {
  blockTypeItemsFor,
  currentBlockType,
  quoteItemFor,
  currentListType,
  listTypeItemsFor,
} from "../core/blockTypes.js";
import { applyInsertItem } from "../core/insertItems.js";
import { useLockableMenu } from "./lockableMenu.js";
import { DEFAULT_ALIGNMENT, EDITOR_ALIGNMENTS, type EditorAlignment } from "../styles/palette.js";
import { findShortcutKeys } from "../core/shortcuts.js";
import {
  invisibleCharactersVisible,
  toggleInvisibleCharacters,
} from "../features/invisibleCharacters/invisibleCharactersVisible.js";
import type { ToolList } from "../core/toolDescriptor.js";
import type { Tool } from "../core/tools.js";
import { useSubmenuPlacement } from "../../hooks/useSubmenuPlacement.js";
import { GLASS_MENU_CLASS } from "../styles/glass.js";

type EditorMessages = UiMessages["editor"];

/**
 * What a format menu takes from the place where it is rendered.
 *
 * The "¶", "…", "Alignment" and "Lists" menus live both in the Toolbar and in the Bubble menu
 * (the selection menu). So everything that depends on the place arrives as props: the
 * engine, the Tool set, the disabled state and the shortcut label. The menu itself knows
 * neither `Toolbar` nor `BubbleMenu`. The host supplies the shortcut label: it knows whether
 * this is an Apple device (`shortcutLabel` in `EditorToolbar`).
 */
export interface FormatMenuHostProps {
  editor: Editor;
  tools: ToolList;
  /** The button is visible but cannot be pressed: the field is disabled or the engine is not editable. */
  disabled: boolean;
  /**
   * The button is unavailable but stays in the arrow-key navigation (`aria-disabled`):
   * in Source mode there is no Document on screen, so there is nothing for the menu to act on.
   */
  unavailable?: boolean;
  shortcut: (keys: readonly string[]) => string;
}

/** A format menu item: its words and icon are already in the interface language. */
export interface FormatMenuItem {
  id: string;
  label: string;
  icon?: ComponentType<IconProps>;
  /** Shortcut in the engine notation (`mod` is `⌘` or `Ctrl`); used for the label only. */
  keys?: readonly string[];
  disabled?: boolean;
  /** Label classes: a swatch around the name (the "Tone ›" submenu of the Block handle). */
  swatch?: string;
  /** A destructive action: the `danger` tone of the kit's `Menu` item ("Delete" in the Block handle). */
  tone?: "danger";
  /**
   * The item opens a submenu with these sections (`SubmenuTrigger`, as in the Table menu):
   * `→` opens it, and `←` or Escape closes it one level at a time.
   */
  submenu?: readonly FormatMenuSection[];
}

/**
 * A menu section. Checked state is set by selection on the section, as the kit's `Menu`
 * requires: `single` gives `menuitemradio` items, `multiple` gives `menuitemcheckbox`, and
 * react-aria sets `aria-checked` itself. Without `selectionMode` the items are plain
 * actions (`menuitem`).
 */
export interface FormatMenuSection {
  id: string;
  label?: string;
  selectionMode?: "single" | "multiple";
  /** The checked items. Empty means none is checked (a mixed selection, or a Block the menu does not apply to). */
  selected?: readonly string[];
  items: readonly FormatMenuItem[];
}

export interface FormatMenuProps {
  /**
   * The button's name includes the current value, e.g. "Block type: Heading 2". The menu
   * takes the same name: react-aria links the menu to the button (`aria-labelledby`),
   * as in the APG menu button pattern.
   */
  label: string;
  /** The button icon: the current value, shown visually. */
  icon: ComponentType<IconProps>;
  /**
   * The button is a single icon, without the ▾ arrow. "…" already reads as "more"; the
   * arrow on a menu with a value ("¶") says that the value is selected from a list.
   */
  iconOnly?: boolean;
  disabled: boolean;
  /** `aria-disabled`: the button stays in the arrow-key navigation but does not open the menu. */
  unavailable?: boolean;
  sections: readonly FormatMenuSection[];
  shortcut: (keys: readonly string[]) => string;
  onAction: (id: string) => void;
}

/*
  RAC sets `aria-haspopup="true"` on the menu trigger. In ARIA 1.2 that is the same as
  `menu`, but the explicit value reads less ambiguously, as in the Table menu.
*/
export const HAS_POPUP_MENU = { "aria-haspopup": "menu" } as object;

/**
 * The format menu button: the common frame for "¶", "…", "Alignment" and "Lists".
 *
 * A MENU, NOT A ROW OF BUTTONS. Before, the Toolbar gave every action its own button in a
 * row: an action hidden in a menu did not expose `aria-pressed`, so a screen reader could
 * not tell whether italic was on without opening the menu. That reason no longer holds: an
 * item with a check mark (`menuitemradio`, `menuitemcheckbox`) announces its state just as
 * `aria-pressed` does, and the menu button carries the current value in its name and icon,
 * so it is heard and seen without opening the menu. The decision is ADR-0054.
 *
 * The keyboard and the layer come from the kit's `Menu` (react-aria): Enter, Space and `↓`
 * open it, the arrow keys move between items, and Escape closes only the menu and returns
 * focus to the button, through the layer stack (ADR-0041). So inside a `Dialog`, the dialog
 * stays open.
 */
export function FormatMenu({
  label,
  icon: Icon,
  iconOnly = false,
  disabled,
  unavailable = false,
  sections,
  shortcut,
  onAction,
}: FormatMenuProps) {
  const run = (key: unknown) => onAction(String(key));
  const menu = useLockableMenu(unavailable);
  const submenuPlacement = useSubmenuPlacement();

  return (
    <MenuTrigger {...menu.trigger}>
      {/* The tooltip sits on the wrapper: react-aria's `Button` does not pass Radix hover handlers through. */}
      <Tooltip content={label}>
        <span className="inline-flex">
          <MenuButton
            variant="ghost"
            size="sm"
            iconOnly={iconOnly}
            disabled={disabled}
            aria-label={label}
            icon={<Icon size={16} aria-hidden />}
            className={iconOnly ? undefined : "gap-0.5 px-1.5"}
            {...HAS_POPUP_MENU}
            {...menu.button}
          >
            {!iconOnly && <ChevronDownIcon size={12} aria-hidden />}
          </MenuButton>
        </span>
      </Tooltip>
      <Menu className={GLASS_MENU_CLASS} onAction={run}>
        {formatMenuSections(sections, shortcut, run, submenuPlacement)}
      </Menu>
    </MenuTrigger>
  );
}

/**
 * The sections of a format menu, that is, the content of `Menu`. Shared by the menu buttons
 * above and by the Block handle (`BlockHandle.tsx`): the handle has its own button and its
 * own keyboard opening, but the items, submenus and check marks are the same.
 *
 * Sections are separated by a divider. Selecting an item closes the menu in any section,
 * and in `multiple` too: a Mark is applied with one click, and the user goes back to typing
 * instead of applying a second one. A submenu is the same frame, one level down.
 */
export function formatMenuSections(
  list: readonly FormatMenuSection[],
  shortcut: (keys: readonly string[]) => string,
  run: (key: unknown) => void,
  /** Submenu placement, from the caller's `useSubmenuPlacement`: below the item on a phone. */
  submenuPlacement: "bottom start" | "right top" = "right top"
): ReactNode {
  return list.map((section, index) => (
    <Fragment key={section.id}>
      {index > 0 && <MenuSeparator />}
      <MenuSection
        id={section.id}
        label={section.label}
        selectionMode={section.selectionMode}
        selectedKeys={section.selectionMode ? (section.selected ?? []) : undefined}
        shouldCloseOnSelect
      >
        {section.items.map((item) => {
          const ItemIcon = item.icon;
          const entry = (
            <MenuItem
              key={item.id}
              id={item.id}
              textValue={item.label}
              disabled={item.disabled}
              tone={item.tone}
              icon={ItemIcon ? <ItemIcon size={14} aria-hidden /> : undefined}
              shortcut={item.keys ? shortcut(item.keys) : undefined}
            >
              {item.swatch ? (
                /*
                  The swatch must not take on the look of the selected row: its blue text
                  and background would repaint the tone colors. The text is set on the
                  swatch itself, and an opaque base under it stops the semi-transparent
                  tone background from mixing with the row's background. The base appears
                  only on the checked row: on the others the swatch sits on the menu panel,
                  like a wrapper element in the document, and looks the same.
                */
                <span className="in-[[aria-checked=true]]:bg-surface-elevated rounded-xs">
                  <span className={cn(item.swatch, "text-fg-0")}>{item.label}</span>
                </span>
              ) : (
                item.label
              )}
            </MenuItem>
          );
          if (!item.submenu || item.disabled) return entry;
          return (
            <SubmenuTrigger key={item.id}>
              {entry}
              <Menu
                aria-label={item.label}
                className={GLASS_MENU_CLASS}
                placement={submenuPlacement}
                offset={2}
                onAction={run}
              >
                {formatMenuSections(item.submenu, shortcut, run, submenuPlacement)}
              </Menu>
            </SubmenuTrigger>
          );
        })}
      </MenuSection>
    </Fragment>
  ));
}

/** Whether the Tool set has the "¶" menu: the Toolbar uses it to decide on the divider. */
export function hasBlockTypeMenu(tools: ToolList): boolean {
  return blockTypeItemsFor(tools).length > 0;
}

/**
 * The "¶" menu: the type of the line. Text, Heading 1–4, and the items of the custom Tools,
 * enabled ones only. Lists and quotes are not here: lists are in "Lists ▾", and the quote is a
 * checkbox in "…". They stay in the Block handle's "Format ›" and in the Slash menu. The menu
 * marks the line type under the caret (a paragraph inside a list or a quote shows as "Text"),
 * and the current name is in the button's accessible name.
 *
 * THE ICON FOLLOWS THE LINE UNDER THE CARET (the owner's decision; before, it was always "¶",
 * ADR-0054, item 8): the heading level, or the icon of a custom Tool's item; for text, the
 * pilcrow. There are few items now and they are recognizable, and the button shows what is
 * under the caret without opening.
 *
 * Selecting an item changes the line type in place: a heading inside a quote stays in the
 * quote. Where the Schema does not allow the type (a heading as the first item of a list), the
 * "Turn into" item of the Slash menu (`applyInsertItem`) applies instead and removes the wrappers.
 * The text stays, the change is one undo step, and focus returns to the Document. Selecting the
 * current type changes nothing and adds no empty edit to history.
 *
 * The code Block is not in this menu (it is an item of "…"), but under the caret the button
 * names it, and no item is checked.
 */
export function BlockTypeMenu({
  editor,
  tools,
  disabled,
  unavailable,
  shortcut,
}: FormatMenuHostProps) {
  const messages = useMessages().editor;
  const locale = useUiLocale();
  const items = blockTypeItemsFor(tools);
  const current = useEditorState({
    editor,
    selector: ({ editor: instance }) => currentBlockType(instance.state),
  });
  if (items.length === 0) return null;

  const active = items.find((item) => item.id === current);
  const currentName = active
    ? active.label(messages, locale)
    : current === "codeBlock"
      ? messages.codeBlock
      : null;

  return (
    <FormatMenu
      label={currentName ? messages.blockType({ current: currentName }) : messages.blockTypeMenu}
      // Icon: from the line under the caret, the heading level or the icon of a custom
      // Tool's item; for text, and outside those items, the pilcrow.
      icon={active && active.id !== "text" ? active.icon : ParagraphIcon}
      disabled={disabled}
      unavailable={unavailable}
      shortcut={shortcut}
      sections={[
        {
          id: "blockType",
          selectionMode: "single",
          selected: active ? [active.id] : [],
          items: items.map((item) => ({
            id: item.id,
            label: item.label(messages, locale),
            icon: item.icon,
            keys: item.keys,
          })),
        },
      ]}
      onAction={(id) => {
        const item = items.find((candidate) => candidate.id === id);
        if (!item) return;
        if (item.id === current) return void editor.commands.focus();
        /*
          The kit's text and heading types change the line type in place:
          a heading inside a quote stays in the quote. Where the Schema does not allow
          the type on the line (a heading as the first item of a list), and for the items
          of custom Tools (their command may wrap and do its own work), the "Turn into"
          path is used: the wrappers are removed, the type is applied, and the change is one undo step.
        */
        const lineType = item.tool === null || item.tool === "heading";
        if (lineType && item.run(editor.can().chain(), editor).run())
          item.run(editor.chain().focus(), editor).run();
        else applyInsertItem(editor, item, null);
      }}
    />
  );
}

/** The "Alignment" menu items: icon, label and the row in the shortcuts table. */
const ALIGN_ITEMS: Record<
  EditorAlignment,
  { icon: ComponentType<IconProps>; label: (m: EditorMessages) => string; shortcut: string }
> = {
  left: { icon: AlignLeftIcon, label: (m) => m.alignLeft, shortcut: "alignLeft" },
  center: { icon: AlignCenterIcon, label: (m) => m.alignCenter, shortcut: "alignCenter" },
  right: { icon: AlignRightIcon, label: (m) => m.alignRight, shortcut: "alignRight" },
};

/**
 * The alignment of the Blocks under the selection. A mixed selection (one Block centered,
 * another left) reads as the default: the "Align left" check is then more honest than no
 * check at all, and choosing any item aligns all the Blocks the same way.
 */
function alignmentOf(editor: Editor): EditorAlignment {
  return (
    EDITOR_ALIGNMENTS.find(
      (alignment) => alignment !== DEFAULT_ALIGNMENT && editor.isActive({ textAlign: alignment })
    ) ?? DEFAULT_ALIGNMENT
  );
}

/**
 * The "Alignment" menu: Align left, Align center, Align right, with the shortcuts from the shared
 * table. There is no justify option: the decision from the component's page (WCAG 1.4.8: ragged
 * spacing hurts reading) still stands.
 *
 * Unlike "¶", the button icon is the icon of the CURRENT alignment (the epic's pattern): there
 * are three options, and a centered-text picture on the button says more than a generic icon.
 * The name spells it out: "Alignment: center".
 *
 * Previously, alignment was three toggle buttons, and pressing an active one again returned to
 * the default. A radio menu does not work that way: selecting the checked item changes nothing
 * and adds no empty edit to history, and the default is reached through the "Align left" item.
 */
export function AlignMenu({ editor, tools, disabled, unavailable, shortcut }: FormatMenuHostProps) {
  const messages = useMessages().editor;
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      alignment: tools.has("align") ? alignmentOf(current) : DEFAULT_ALIGNMENT,
      unavailable: tools.has("align")
        ? EDITOR_ALIGNMENTS.filter((alignment) => !current.can().setTextAlign(alignment))
        : [],
    }),
  });
  if (!tools.has("align")) return null;

  return (
    <FormatMenu
      label={messages.alignMenu({ current: state.alignment })}
      icon={ALIGN_ITEMS[state.alignment].icon}
      disabled={disabled}
      unavailable={unavailable}
      shortcut={shortcut}
      sections={[
        {
          id: "align",
          selectionMode: "single",
          selected: [state.alignment],
          items: EDITOR_ALIGNMENTS.map((alignment) => ({
            id: alignment,
            label: ALIGN_ITEMS[alignment].label(messages),
            icon: ALIGN_ITEMS[alignment].icon,
            keys: findShortcutKeys(ALIGN_ITEMS[alignment].shortcut),
            disabled: state.unavailable.includes(alignment),
          })),
        },
      ]}
      onAction={(id) => {
        const alignment = EDITOR_ALIGNMENTS.find((candidate) => candidate === id);
        if (!alignment) return;
        const chain = editor.chain().focus();
        (alignment === alignmentOf(editor) ? chain : chain.setTextAlign(alignment)).run();
      }}
    />
  );
}

/** Whether the Tool set has the "Lists" menu: at least one list kind. */
export function hasListMenu(tools: ToolList): boolean {
  return listTypeItemsFor(tools).length > 0;
}

/**
 * The "Lists" menu: Bulleted, Numbered, Checklist. These are the same kinds as in the Block
 * handle's "Format ›", but only from the enabled Tools. The kind of the nearest list around the
 * caret is checked; it is also the button's icon and name ("List: numbered"). Outside a list,
 * the icon is the generic list icon.
 *
 * Choosing another kind takes the same path as "Turn into" in the Slash menu (`applyInsertItem`):
 * the Block leaves the list or quote and is wrapped again, in one undo step. Choosing the CHECKED
 * kind removes the list, as the former toggle button did. In "Format ›" the "Text" item does this,
 * and here there is no other way to remove a list.
 */
export function ListMenu({ editor, tools, disabled, unavailable, shortcut }: FormatMenuHostProps) {
  const messages = useMessages().editor;
  const locale = useUiLocale();
  const items = listTypeItemsFor(tools);
  const current = useEditorState({
    editor,
    selector: ({ editor: instance }) => currentListType(instance.state),
  });
  if (items.length === 0) return null;

  const active = items.find((item) => item.id === current);

  return (
    <FormatMenu
      label={messages.listMenu({ current })}
      icon={active?.icon ?? ListIcon}
      disabled={disabled}
      unavailable={unavailable}
      shortcut={shortcut}
      sections={[
        {
          id: "lists",
          selectionMode: "single",
          selected: active ? [active.id] : [],
          items: items.map((item) => ({
            id: item.id,
            label: item.label(messages, locale),
            icon: item.icon,
            keys: item.keys,
          })),
        },
      ]}
      onAction={(id) => {
        const item = items.find((candidate) => candidate.id === id);
        if (!item) return;
        // The same `toggle…List` as the item: on its own kind, it removes the list.
        if (item.id === current) item.run(editor.chain().focus(), editor).run();
        else applyInsertItem(editor, item, null);
      }}
    />
  );
}

/**
 * A rarely used Mark in the "…" menu: its id matches the Mark's name in the engine and the id of
 * the shortcuts table row (`shortcuts.ts`) that supplies its label.
 */
/** Id of a rarely used Mark in "…": the Mark's name in the engine and of the shortcuts table row. */
export type MoreMarkId = "code" | "underline" | "strike" | "superscript" | "subscript";

interface MoreMark {
  id: MoreMarkId;
  label: (messages: EditorMessages) => string;
  icon: ComponentType<IconProps>;
  run: (editor: Editor) => void;
  can: (editor: Editor) => boolean;
}

const MORE_MARKS: readonly MoreMark[] = [
  {
    id: "code",
    label: (m) => m.code,
    icon: InlineCodeIcon,
    run: (editor) => editor.chain().focus().toggleCode().run(),
    can: (editor) => editor.can().toggleCode(),
  },
  {
    id: "underline",
    label: (m) => m.underline,
    icon: UnderlineIcon,
    run: (editor) => editor.chain().focus().toggleUnderline().run(),
    can: (editor) => editor.can().toggleUnderline(),
  },
  {
    id: "strike",
    label: (m) => m.strike,
    icon: StrikethroughIcon,
    run: (editor) => editor.chain().focus().toggleStrike().run(),
    can: (editor) => editor.can().toggleStrike(),
  },
  {
    id: "superscript",
    label: (m) => m.superscript,
    icon: SuperscriptIcon,
    run: (editor) => editor.chain().focus().toggleSuperscript().run(),
    can: (editor) => editor.can().toggleSuperscript(),
  },
  {
    id: "subscript",
    label: (m) => m.subscript,
    icon: SubscriptIcon,
    run: (editor) => editor.chain().focus().toggleSubscript().run(),
    can: (editor) => editor.can().toggleSubscript(),
  },
];

/** Whether the id is a "…" Mark, for a host that renders its own row and does not repeat it in "…". */
export function isMoreMarkId(id: string): id is MoreMarkId {
  return MORE_MARKS.some((mark) => mark.id === id);
}

/**
 * The Tools of the "…" menu, without the Marks the host already shows in its row (`omit`):
 * the button is present if at least one of them is enabled.
 */
export function moreFormatTools(omit: readonly MoreMarkId[] = []): readonly Tool[] {
  return [
    ...MORE_MARKS.map((mark) => mark.id).filter((id) => !omit.includes(id)),
    "codeBlock",
    "blockquote",
    "footnotes",
    "clearFormatting",
  ];
}

export interface MoreFormatMenuProps extends FormatMenuHostProps {
  /**
   * Marks that the host already shows as buttons in its row, so they are not in "…". The
   * Toolbar keeps only bold and italic in its row; the bubble also keeps underline (`rowMarks.ts`).
   */
  omit?: readonly MoreMarkId[];
  /**
   * The "Invisible characters" item at the end of the menu. Only for the fixed Toolbar: the
   * floating Toolbar and the selection bubble draw the same "…", but a display-mode switch for
   * the Document makes no sense over a selection. The prop means "the item is present"; without
   * the `invisibleCharacters` Tool in `tools` there is no item, even when `true`.
   */
  invisibleCharacters?: boolean;
}

/**
 * The "…" menu, More formatting: Inline code, Underline (not in the bubble), Strikethrough,
 * Superscript and Subscript | Code block | Clear formatting, only from the enabled Tools.
 * Without a single item there is no button.
 *
 * Marks are `menuitemcheckbox` items: an item is checked when its Mark is on for the selection
 * or the caret. Choosing it applies or removes the Mark in one edit and returns focus to the
 * Document. Shortcut labels come from the shared table (`shortcuts.ts`), as for the Toolbar buttons.
 *
 * THE CODE BLOCK IS AN ITEM OF "…", NOT A TOOLBAR BUTTON: it is used rarely (the owner's decision).
 * It is a Block, not a Mark, so it gets a section of its own; but that section sits right after
 * the Marks, as the same checkbox item with a shortcut (`Ctrl/⌘+Alt+C`), so all the toggles in
 * "…" come one after another, and clearing comes after them.
 * The check mark is set when the caret is inside a code Block; choosing the item toggles it, as the
 * former button did (`toggleCodeBlock`). "Clear formatting" does not touch the code Block (it removes
 * Marks), and stays last.
 *
 * COLORS ARE NOT HERE. The highlight and the text color used to be submenus of "…"; now they are the
 * "Highlight" and "Color" buttons with popover grids beside "…" (`ColorMenus.tsx`): a color is
 * chosen by eye, from swatches.
 *
 * INVISIBLE CHARACTERS is the last section, and only on the fixed Toolbar (the `invisibleCharacters`
 * prop). It is a display mode of the Document, not formatting of the selection, so it is separated
 * from clearing by a divider and sits at the very end. The check mark is set when the characters are
 * shown. Choosing it toggles the display the same way as the `tool("invisibleCharacters").toggle()`
 * command, and does not touch `value` or `onChange`.
 *
 * The host is the Toolbar or the selection bubble: everything that depends on the place arrives as
 * props (`FormatMenuHostProps`).
 */
export function MoreFormatMenu({
  editor,
  tools,
  disabled,
  unavailable,
  shortcut,
  omit = [],
  invisibleCharacters = false,
}: MoreFormatMenuProps) {
  const messages = useMessages().editor;
  const locale = useUiLocale();
  const marks = MORE_MARKS.filter((mark) => tools.has(mark.id) && !omit.includes(mark.id));
  const codeBlock = tools.has("codeBlock");
  // The quote is a checkbox next to the code Block: it has moved out of the "¶" menu.
  const quote = quoteItemFor(tools);
  const clear = tools.has("clearFormatting");
  // "Footnote" is an action, not a toggle: it puts a reference at the end of the selection.
  const footnote = tools.has("footnotes");
  const view = invisibleCharacters && tools.has("invisibleCharacters");

  // The result is compared deeply (the default of `useEditorState`): it re-renders only on change.
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      active: marks.filter((mark) => current.isActive(mark.id)).map((mark) => mark.id),
      unavailable: marks.filter((mark) => !mark.can(current)).map((mark) => mark.id),
      inCodeBlock: codeBlock && current.isActive("codeBlock"),
      canCodeBlock: codeBlock && current.can().toggleCodeBlock(),
      inQuote: quote !== undefined && current.isActive("blockquote"),
      canQuote: quote !== undefined && current.can().toggleBlockquote(),
      canClear: clear && current.can().unsetAllMarks(),
      canFootnote: footnote && current.can().insertFootnote(),
      // Showing invisible characters is a plugin state of the engine, not a Mark or a Block.
      invisible: view && invisibleCharactersVisible(current),
    }),
  });
  if (marks.length === 0 && !codeBlock && !quote && !footnote && !clear && !view) return null;

  const sections = (
    [
      {
        id: "marks",
        selectionMode: "multiple",
        selected: state.active,
        items: marks.map((mark) => ({
          id: mark.id,
          label: mark.label(messages),
          icon: mark.icon,
          keys: findShortcutKeys(mark.id),
          disabled: state.unavailable.includes(mark.id),
        })),
      },
      {
        // Not `codeBlock`: the keys of sections and items are shared in a react-aria collection.
        id: "block",
        selectionMode: "multiple",
        selected: [
          ...(state.inCodeBlock ? ["codeBlock"] : []),
          ...(state.inQuote ? ["blockquote"] : []),
        ],
        items: [
          ...(codeBlock
            ? [
                {
                  id: "codeBlock",
                  label: messages.codeBlock,
                  icon: CodeBlockIcon,
                  keys: findShortcutKeys("codeBlock"),
                  disabled: !state.canCodeBlock,
                },
              ]
            : []),
          ...(quote
            ? [
                {
                  id: "blockquote",
                  label: quote.label(messages, locale),
                  icon: quote.icon,
                  keys: quote.keys,
                  disabled: !state.canQuote,
                },
              ]
            : []),
        ],
      },
      {
        id: "insert",
        items: footnote
          ? [
              {
                id: "footnote",
                label: messages.footnote,
                icon: FootnoteIcon,
                disabled: !state.canFootnote,
              },
            ]
          : [],
      },
      {
        id: "clear",
        items: clear
          ? [
              {
                id: "clearFormatting",
                label: messages.clearFormatting,
                icon: ClearFormattingIcon,
                keys: findShortcutKeys("clearFormatting"),
                disabled: !state.canClear,
              },
            ]
          : [],
      },
      {
        // A checkbox section of its own, at the end: the display mode of the Document, not formatting.
        id: "view",
        selectionMode: "multiple",
        selected: state.invisible ? ["invisibleCharacters"] : [],
        items: view
          ? [
              {
                id: "invisibleCharacters",
                label: messages.invisibleCharacters,
                icon: InvisibleCharactersIcon,
              },
            ]
          : [],
      },
    ] satisfies FormatMenuSection[]
  ).filter((section) => section.items.length > 0);

  const apply = (key: string) => {
    const mark = marks.find((candidate) => candidate.id === key);
    if (mark) return mark.run(editor);
    if (key === "codeBlock") return void editor.chain().focus().toggleCodeBlock().run();
    if (key === "blockquote") return void editor.chain().focus().toggleBlockquote().run();
    if (key === "footnote") return void editor.chain().focus().insertFootnote().run();
    if (key === "clearFormatting") return void editor.chain().focus().unsetAllMarks().run();
    if (key === "invisibleCharacters") {
      toggleInvisibleCharacters(editor);
      editor.commands.focus();
    }
  };

  return (
    <FormatMenu
      label={messages.moreFormatting}
      icon={MoreIcon}
      iconOnly
      disabled={disabled}
      unavailable={unavailable}
      shortcut={shortcut}
      sections={sections}
      onAction={apply}
    />
  );
}
