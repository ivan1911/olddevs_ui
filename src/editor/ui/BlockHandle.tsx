"use client";

import type { EditorView } from "@tiptap/pm/view";
import { useEditorState, type Editor } from "@tiptap/react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Kbd } from "../../components/content/Kbd.js";
import { Menu, MenuButton, MenuTrigger } from "../../components/overlays/Menu.js";
import { Tooltip, TooltipProvider } from "../../components/overlays/Tooltip.js";
import { useMessages, useUiLocale } from "../../i18n/useMessages.js";
import {
  AddIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  BlockSelectIcon,
  ColumnLayoutIcon,
  DeleteIcon,
  DetailsIcon,
  DuplicateIcon,
  MoreVerticalIcon,
  PaletteIcon,
  ParagraphIcon,
  QuoteIcon,
  WrapperIcon,
} from "../../icons.js";
import { cn } from "../../lib/cn.js";
import {
  deleteBlock,
  duplicateBlock,
  handleBlocks,
  handleShortcutsMatch,
  moveBlock,
} from "../core/blockCommands.js";
import { BlockSelection } from "../core/blockSelection.js";
import { isTurnable, sharedBlockType, turnBlocksInto } from "../core/blockTurn.js";
import { blockTypeOf, formatItemsFor } from "../core/blockTypes.js";
import { unitNodes } from "../core/blockUnit.js";
import { planWrap, wrapUnits, type WrapKind } from "../core/blockWrap.js";
import { EDITOR_LAYOUTS, type EditorLayout } from "../features/layout/columnLayouts.js";
import {
  formatMenuSections,
  HAS_POPUP_MENU,
  type FormatMenuItem,
  type FormatMenuSection,
} from "./FormatMenus.js";
import { FOCUS_TARGET } from "./focusWithin.js";
import { applyInsertItem, insertItemsFor, turnBlockInto } from "../core/insertItems.js";
import { COLUMN_NODE, LAYOUT_NODE, layoutOfNode } from "../features/layout/layout.js";
import { EDITOR_WRAPPER_TONE_CLASS } from "../styles/prose.js";
import { ariaShortcut, findShortcutKeys, isApple, shortcutLabel } from "../core/shortcuts.js";
import {
  blockActionsOf,
  blockActionVisible,
  toolOptions,
  type ToolList,
} from "../core/toolDescriptor.js";
import { WRAPPER_NODE } from "../features/wrapper/wrapper.js";
import { EDITOR_WRAPPER_TONES, wrapperToneFrom } from "../features/wrapper/wrapperTones.js";
import { useSubmenuPlacement } from "../../hooks/useSubmenuPlacement.js";
import { GLASS_MENU_CLASS } from "../styles/glass.js";

/** Handle size and the gap to the text, in px: the handle `h-6 w-5` sits in the Document's left margin. */
const HANDLE_WIDTH = 20;
const HANDLE_HEIGHT = 24;
const HANDLE_GAP = 4;

/*
  The handle is outside the Tab order: in the Document, Tab moves a list item, and
  the handle is reached with `Mod+/`. The kit does not pass `excludeFromTabOrder` and
  `onFocusChange` through the `MenuButton` types, but react-aria's `Button` understands them.
*/
const buttonExtras = (onFocusChange: (focused: boolean) => void) =>
  ({ excludeFromTabOrder: true, onFocusChange }) as object;

/**
 * Where the handle sits relative to `anchor.offsetParent` (the Editor root or the Document's
 * scroll area): to the left of the Blocks container's left edge. For the Document that is its
 * left margin; for a Column layout's column it is the column's edge. Vertically it sits at
 * the middle of the Block's first line. An image has no line, so its handle sits at the top
 * edge; a horizontal rule's handle sits on the rule itself. `null` means there is nothing to measure.
 */
function handlePlace(view: EditorView, anchor: HTMLElement): { top: number; left: number } | null {
  const block = handleBlocks(view.state);
  const origin = anchor.offsetParent;
  if (!block || !(origin instanceof HTMLElement)) return null;
  const container = block.depth === 0 ? view.dom : view.nodeDOM(block.$from.before(block.depth));
  if (!(container instanceof HTMLElement)) return null;

  // The handle stands at the first Block of the row.
  const node = block.parent.child(block.startIndex);
  const win = container.ownerDocument.defaultView;
  /*
    The first line is the first text Block inside (for a list, its first item; for a table,
    its first cell): the top of its box and the line height from the styles. An image has
    a caption, which is text, but it sits under the image, so an atom node is measured by
    its own box.

    DOM ONLY, WITHOUT `view.coordsAtPos`. That one first flushes ProseMirror's DOM observer,
    and the measurement runs on every transaction, including the one that arrives with focus
    in the middle of a double click. The flush at that moment read the selection before it had
    collapsed, and the word selected by the double click was lost.
  */
  let first = -1;
  if (node.isTextblock) first = block.start;
  else if (!node.isAtom) {
    node.descendants((child, offset) => {
      if (first >= 0) return false;
      if (child.isTextblock) first = block.start + 1 + offset;
      return first < 0;
    });
  }
  const dom = view.nodeDOM(first >= 0 ? first : block.start);
  if (!(dom instanceof HTMLElement)) return null;
  const rect = dom.getBoundingClientRect();
  let line: { top: number; bottom: number };
  if (first >= 0) {
    const style = win?.getComputedStyle(dom);
    const top = rect.top + dom.clientTop + (parseFloat(style?.paddingTop ?? "") || 0);
    const height =
      parseFloat(style?.lineHeight ?? "") || (parseFloat(style?.fontSize ?? "") || 16) * 1.2;
    line = { top, bottom: top + height };
  } else {
    line = { top: rect.top, bottom: Math.min(rect.bottom, rect.top + HANDLE_HEIGHT) };
  }

  /*
    The origin can also be the Document's scrollable area (`maxHeight`, ADR-0059). Then the
    position is in the coordinates of its content, offset by the scroll, and the handle moves
    with the text without recalculating on every frame. For the Editor root the offset is zero.
  */
  const box = origin.getBoundingClientRect();
  const frame = container.getBoundingClientRect();
  const padding = parseFloat(win?.getComputedStyle(container).paddingLeft ?? "") || 0;
  const contentLeft = frame.left + container.clientLeft + padding;
  return {
    top: Math.round(
      (line.top + line.bottom) / 2 -
        HANDLE_HEIGHT / 2 -
        box.top -
        origin.clientTop +
        origin.scrollTop
    ),
    left: Math.round(
      contentLeft - HANDLE_GAP - HANDLE_WIDTH - box.left - origin.clientLeft + origin.scrollLeft
    ),
  };
}

export interface BlockHandleProps {
  editor: Editor;
  tools: ToolList;
  /**
   * The handle stores its "open menu" action here, for `Mod+/` from the Document. The
   * shortcut is listened for by the extension (`blockCommands.ts`), while the menu lives here.
   * `false` means there is no handle, and the key goes on.
   */
  openRef: RefObject<() => boolean>;
}

/**
 * The Block handle "⋮": a button to the left of the Block's first line, where the caret is,
 * and a menu of actions on the Block: Add ›, Format ›, Move up, Move down, Duplicate,
 * Delete.
 *
 * ONLY BY CARET (owner's decision). Hovering the mouse does not show the handle: it does not
 * flicker at every paragraph under the cursor, and it does not compete with the text
 * selection. It is visible while focus is in the Document, on the handle itself, or in its
 * menu. In `readOnly` the Editor does not mount it, and a disabled field has no Block handles.
 *
 * THE WHOLE BLOCK. Actions apply to the handle's Block (`handleBlock`): the whole list, the
 * whole blockquote, the whole table, not the item under the caret. That is why a shortcut
 * label on an item appears only when the shortcut does the same thing (`handleShortcutsMatch`).
 * On a list item, `⌥⇧↑` moves the item, so there is no label there. Each action is one edit
 * for undo, and focus ends up in the Document. Dragging by the handle is not supported
 * (owner's decision).
 *
 * THE LAYER IS IN THE FIELD'S FLOW, NOT AN OVERLAY. The handle is part of the field, like a
 * scrollbar. It lies in the Editor's DOM, absolutely positioned from its root, and moves with
 * the text in any scroll container, in `Dialog` and `Drawer`, without recalculation on scroll.
 * It has no `OVERLAY_LAYER` step on purpose: the sticky Toolbar (`z-[1]`) and any popovers must
 * cover it, not the other way round. The menu is the kit's `Menu`. It has its own layer and
 * Escape stack (ADR-0041): Escape closes the submenu and the menu one level at a time, while
 * the window around the Editor stays open.
 */
export function BlockHandle({ editor, tools, openRef }: BlockHandleProps) {
  const messages = useMessages().editor;
  const locale = useUiLocale();
  const apple = isApple();
  const submenuPlacement = useSubmenuPlacement();
  const [open, setOpen] = useState(false);
  const [buttonFocused, setButtonFocused] = useState(false);
  // Between an action and the frame in which the Document gets its focus back (see `run`).
  const [refocusing, setRefocusing] = useState(false);
  const [place, setPlace] = useState<{ top: number; left: number } | null>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  /** Whether an item was selected: in that case the action itself returns focus to the Document. */
  const actedRef = useRef(false);

  // "Add ›": the Slash menu items without repeats. "Code block" is in "Add"
  // (`codeBlock`) and in "Turn into" (`codeBlockFromText`), but the new Block
  // below is the same one. A duplicate is dropped by id, not by label: the label
  // depends on the consumer's catalog, and matching words do not mean one action.
  const addItems = useMemo(
    () => insertItemsFor(tools).filter((item) => item.id !== "codeBlockFromText" && !item.inline),
    [tools]
  );
  const formatItems = useMemo(() => formatItemsFor(tools), [tools]);
  // Tool actions are a projection of the description list. "Tone ›" and "Layout ›"
  // are menu widgets without a Tool of their own, so they are still assembled below, as before.
  const toolActions = useMemo(() => blockActionsOf(tools), [tools]);

  const detailsPersist = toolOptions(tools, "details")?.persist === true;
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => {
      const block = current.isEditable ? handleBlocks(current.state) : null;
      if (!block) return null;
      const nodes = unitNodes(block);
      const node = nodes[0]!;
      const count = nodes.length;
      // A group acts on several Blocks (ADR-0077); one selected Block is "picked", and its menu has
      // everything of a single Block's menu plus "Wrap in ›".
      const picked = current.state.selection instanceof BlockSelection;
      const group = count > 1;
      const several = group || picked;
      // Column layout: its variant is on the handle of the Column layout itself (selected
      // as a whole) and on the handle of a Block in its column.
      const layout =
        node.type.name === LAYOUT_NODE
          ? node
          : block.parent.type.name === COLUMN_NODE
            ? block.$from.node(block.depth - 1)
            : null;
      const wrapper =
        node.type.name === WRAPPER_NODE
          ? node
          : block.parent.type.name === WRAPPER_NODE
            ? block.parent
            : null;
      return {
        focused: current.view.hasFocus(),
        count,
        group,
        picked,
        // The Block selection Tool adds "Select" to the menu (the way in on a touch screen).
        canSelect: tools.has("blockSelection") && !picked,
        type: blockTypeOf(node),
        // The type shared by all text Blocks of a group, for the mark in "Format ›".
        sharedType: several ? sharedBlockType(block) : null,
        // Something in the row changes under "Format ›" (a table, an image and containers do not).
        turnable: several && nodes.some(isTurnable),
        // The containers the Schema allows around these Blocks; only for a row that can be wrapped.
        wraps: several
          ? (["wrapper", "blockquote", "details"] as const)
              .filter((kind) => tools.has(kind))
              .map((kind) => ({ kind, allowed: planWrap(block, kind, detailsPersist) !== null }))
          : [],
        // The "can be turned into" trait of a custom Block (ADR-0058, item 1.4).
        turnInto: node.type.spec.turnInto === true,
        layout: layout ? layoutOfNode(layout) : null,
        isLayout: node.type.name === LAYOUT_NODE,
        // Wrapper: the handle of the Wrapper itself (selected as a whole), or of a Block
        // right inside it. Both have "Tone ›".
        inWrapper: wrapper !== null,
        tone: wrapper ? wrapperToneFrom(wrapper.attrs.tone) : null,
        // Block actions apply to the handle's Block and to the container it sits in (`BlockAction.blocks`).
        // A group has none: they are written for one Block.
        actions: group
          ? []
          : toolActions
              .filter((action) =>
                blockActionVisible(action, current, block.start, {
                  name: node.type.name,
                  container: block.parent.type.name,
                })
              )
              .map((action) => action.id),
        first: block.startIndex === 0,
        last: block.endIndex === block.parent.childCount,
        keys: handleShortcutsMatch(current.state),
      };
    },
  });
  const shown = state !== null && (state.focused || open || buttonFocused || refocusing);

  openRef.current = () => {
    if (!editor.isEditable || !handleBlocks(editor.state)) return false;
    actedRef.current = false;
    setOpen(true);
    return true;
  };

  /*
    The position is recalculated on every transaction (the Block has changed, the text above
    has grown) and on a change of the Document's size (window resize, a late image load, line
    wrapping). It runs before painting, so the handle does not flicker in its old place.
  */
  useLayoutEffect(() => {
    if (!shown) return;
    const update = () => {
      const anchor = anchorRef.current;
      if (!anchor || editor.isDestroyed) return;
      const next = handlePlace(editor.view, anchor);
      if (next)
        setPlace((prev) =>
          prev && prev.top === next.top && prev.left === next.left ? prev : next
        );
    };
    update();
    editor.on("transaction", update);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    observer?.observe(editor.view.dom);
    const win = editor.view.dom.ownerDocument.defaultView;
    win?.addEventListener("resize", update);
    return () => {
      editor.off("transaction", update);
      observer?.disconnect();
      win?.removeEventListener("resize", update);
    };
  }, [editor, shown]);

  // `aria-keyshortcuts` is set on the node: react-aria's `Button` does not pass the attribute into the DOM.
  const openKeys = findShortcutKeys("blockActions");
  useEffect(() => {
    if (openKeys)
      buttonRef.current?.setAttribute("aria-keyshortcuts", ariaShortcut(openKeys, apple));
  }, [openKeys, apple, shown]);

  if (!shown) return null;

  const shortcut = (keys: readonly string[]) => shortcutLabel(keys, apple);
  const { keys } = state;
  const several = state.group || state.picked;
  const active = formatItems.find((item) => item.id === (several ? state.sharedType : state.type));

  /*
    The Column layout variants form one list, for "Add › Layout ›" and for
    selecting a variant: "Single column", "Two columns", …, "60/40", "40/60".
  */
  const layoutVariants = (prefix: string) =>
    EDITOR_LAYOUTS.map((variant) => ({
      id: `${prefix}:${variant}`,
      label: messages.layoutVariant[variant],
    }));
  const layoutSubmenu = (current: EditorLayout | null): FormatMenuSection[] => [
    {
      id: "layoutVariants",
      selectionMode: "single",
      selected: current ? [`layout:${current}`] : [],
      items: layoutVariants("layout"),
    },
  ];

  const blockItems: FormatMenuItem[] = [];
  if (state.canSelect) {
    blockItems.push({ id: "select", label: messages.blockSelect, icon: BlockSelectIcon });
  }
  if (addItems.length > 0 && !state.group) {
    blockItems.push({
      id: "add",
      label: messages.blockAdd,
      icon: AddIcon,
      // The shortcuts of the Slash menu items change the current Block, while "Add" inserts a new
      // one below, so there are no labels here. "Column layout" is a submenu of variants: in the
      // Slash menu it is one item (two columns), here it is any of the six.
      submenu: [
        {
          id: "addItems",
          items: addItems.map((item) =>
            item.id === "layout"
              ? {
                  id: "addLayout",
                  label: item.label(messages, locale),
                  icon: item.icon,
                  submenu: [{ id: "addLayoutVariants", items: layoutVariants("addLayout") }],
                }
              : { id: `add:${item.id}`, label: item.label(messages, locale), icon: item.icon }
          ),
        },
      ],
    });
  }
  if (state.isLayout && !state.group) {
    // "Format ›" of the Column layout as a whole: its variants, with the current one marked.
    // It has no Block type, and the variant is its format.
    blockItems.push({
      id: "format",
      label: messages.blockFormat,
      icon: ColumnLayoutIcon,
      submenu: layoutSubmenu(state.layout),
    });
  } else if (formatItems.length > 0) {
    blockItems.push({
      id: "format",
      label: messages.blockFormat,
      icon: ParagraphIcon,
      // A table, an image, and a rule cannot be turned into text: the item is visible but
      // disabled. A custom Block gets it only with the "can be turned into" trait. A group is
      // turned when at least one Block in it changes.
      disabled: several ? !state.turnable : state.type === null && !state.turnInto,
      submenu: [
        {
          id: "formatItems",
          selectionMode: "single",
          selected: active ? [`format:${active.id}`] : [],
          items: formatItems.map((item) => ({
            id: `format:${item.id}`,
            label: item.label(messages, locale),
            icon: item.icon,
            keys: keys.type ? item.keys : undefined,
          })),
        },
      ],
    });
  }
  /*
    A Block in a column: "Format ›" is its type, as everywhere, while the variant of its
    Column layout is a separate item, "Layout ›". The Column layout's own handle exists only
    when it is selected as a whole (Backspace on the Block under it), and the caret is almost
    always in the column. Without this item the variant could not be changed.
  */
  if (state.wraps.length > 0) {
    // Wrap the Blocks in a container (ADR-0077). The Schema decides where it is allowed.
    const wrapLabels = {
      wrapper: { label: messages.wrapper, icon: WrapperIcon },
      blockquote: { label: messages.blockquote, icon: QuoteIcon },
      details: { label: messages.details, icon: DetailsIcon },
    } as const;
    blockItems.push({
      id: "wrap",
      label: messages.blockWrap,
      icon: WrapperIcon,
      disabled: state.wraps.every((wrap) => !wrap.allowed),
      submenu: [
        {
          id: "wrapItems",
          items: state.wraps.map(({ kind, allowed }) => ({
            id: `wrap:${kind}`,
            ...wrapLabels[kind],
            disabled: !allowed,
          })),
        },
      ],
    });
  }
  if (!state.isLayout && state.layout && !state.group) {
    blockItems.push({
      id: "layoutFormat",
      label: messages.layout,
      icon: ColumnLayoutIcon,
      submenu: layoutSubmenu(state.layout),
    });
  }
  /*
    "Tone ›" is on the Wrapper's own handle and on a Block right inside it. As with
    "Layout ›", the handle follows the caret, and the caret is almost always inside. The whole
    Wrapper handle is rarely visible (Backspace on the Block under it). "Unwrap" is an action
    on a Block of the `wrapper` Tool (`features/builtins.ts`), and it is in the actions
    section below.
  */
  if (state.inWrapper && !state.group) {
    /*
      The items are radio items: "None" and the five tones by name. The current one is marked,
      and the menu item's name carries the current tone, as the "¶" button's name carries the current type.
    */
    const toneName = state.tone ? messages.wrapperToneName[state.tone] : messages.wrapperToneNone;
    blockItems.push({
      id: "wrapperTone",
      label: messages.wrapperTone({ current: toneName }),
      icon: PaletteIcon,
      submenu: [
        {
          id: "wrapperTones",
          selectionMode: "single",
          selected: [`tone:${state.tone ?? "none"}`],
          items: [
            { id: "tone:none", label: messages.wrapperToneNone },
            ...EDITOR_WRAPPER_TONES.map((tone) => ({
              id: `tone:${tone}`,
              label: messages.wrapperToneName[tone],
              swatch: EDITOR_WRAPPER_TONE_CLASS[tone],
            })),
          ],
        },
      ],
    });
  }
  const sections = (
    [
      { id: "block", items: blockItems },
      {
        id: "move",
        items: [
          {
            id: "moveUp",
            label: messages.blockMoveUp,
            icon: ArrowUpIcon,
            keys: keys.move ? findShortcutKeys("moveBlockUp") : undefined,
            disabled: state.first,
          },
          {
            id: "moveDown",
            label: messages.blockMoveDown,
            icon: ArrowDownIcon,
            keys: keys.move ? findShortcutKeys("moveBlockDown") : undefined,
            disabled: state.last,
          },
          {
            id: "duplicate",
            label: messages.blockDuplicate,
            icon: DuplicateIcon,
            keys: keys.duplicate ? findShortcutKeys("duplicateBlock") : undefined,
          },
        ],
      },
      // Tool actions get their own section, before "Delete" (ADR-0058, item 10.3).
      {
        id: "toolActions",
        items: toolActions
          .filter((action) => state.actions.includes(action.id))
          .map((action) => ({
            id: `action:${action.id}`,
            label: action.label(messages, locale),
            icon: action.icon,
            keys: action.shortcut,
          })),
      },
      {
        id: "remove",
        items: [{ id: "delete", label: messages.blockDelete, icon: DeleteIcon, tone: "danger" }],
      },
    ] satisfies FormatMenuSection[]
  ).filter((section) => section.items.length > 0);

  const commands = {
    moveUp: moveBlock(-1, "handle"),
    moveDown: moveBlock(1, "handle"),
    duplicate: duplicateBlock("handle"),
    delete: deleteBlock,
  } as const;

  /*
    An action returns focus to the Document with the engine's `focus()`, and that waits for an
    animation frame. The menu has closed by then and focus is nowhere, so for that frame the handle
    would disappear and come back. `refocusing` holds it on screen until the frame has passed; the
    frame is requested after the engine's own, so the Document is focused by the time it ends.
  */
  const run = (key: unknown) => {
    perform(key);
    setRefocusing(true);
    requestAnimationFrame(() => setRefocusing(false));
  };

  const perform = (key: unknown) => {
    actedRef.current = true;
    const id = String(key);
    const [kind, itemId] = id.split(":");
    if (kind === "add") {
      const item = addItems.find((candidate) => candidate.id === itemId);
      if (item) applyInsertItem(editor, item, null, "below");
      return;
    }
    if (kind === "addLayout") {
      const item = addItems.find((candidate) => candidate.id === "layout");
      const variant = itemId as EditorLayout;
      if (item) {
        applyInsertItem(
          editor,
          { ...item, run: (chain) => chain.insertLayout(variant) },
          null,
          "below"
        );
      }
      return;
    }
    if (kind === "layout") {
      // Selecting the current variant changes nothing, as with "¶".
      const variant = itemId as EditorLayout;
      if (variant !== state.layout) editor.chain().focus().setLayout(variant).run();
      else editor.commands.focus();
      return;
    }
    if (kind === "tone") {
      // Selecting the current tone changes nothing, as with "¶": there is no empty edit in history.
      const tone = wrapperToneFrom(itemId);
      if (tone !== state.tone) editor.chain().focus().setWrapperTone(tone).run();
      else editor.commands.focus();
      return;
    }
    if (kind === "action") {
      const action = toolActions.find((candidate) => candidate.id === itemId);
      const block = handleBlocks(editor.state);
      if (action && block) action.run(editor, block.start);
      else editor.commands.focus();
      return;
    }
    /*
      A group's result is announced to the screen reader (ADR-0077): "Blocks deleted: 3". One Block
      acts as before, in silence. The count is read before the action: the selection changes with it.
    */
    const several = state.group || state.picked;
    const announce = (text: string) => {
      if (several) editor.commands.showNotice({ tone: "status", text });
    };
    if (kind === "select") {
      editor.chain().focus().selectBlocks().run();
      return;
    }
    if (kind === "wrap") {
      const range = handleBlocks(editor.state);
      const done =
        !!range &&
        editor
          .chain()
          .focus()
          .command(({ tr }) => wrapUnits(tr, range, itemId as WrapKind, detailsPersist))
          .run();
      if (done) announce(messages.blocksWrapped({ count: state.count }));
      return;
    }
    if (kind === "format") {
      const item = formatItems.find((candidate) => candidate.id === itemId);
      const range = handleBlocks(editor.state);
      if (several && item && range) {
        // The same type in every text Block of the group changes nothing, as with "¶".
        if (item.id !== state.sharedType && turnBlocksInto(editor, item, range)) {
          announce(messages.blocksChanged({ count: state.count }));
        } else editor.commands.focus();
        return;
      }
      // Selecting the current type changes nothing, as with "¶".
      if (item && item.id !== state.type) turnBlockInto(editor, item);
      else editor.commands.focus();
      return;
    }
    const command = commands[id as keyof typeof commands];
    if (!command) return;
    command(editor.state, editor.view.dispatch);
    editor.commands.focus();
    const result = {
      moveUp: messages.blocksMoved,
      moveDown: messages.blocksMoved,
      duplicate: messages.blocksDuplicated,
      delete: messages.blocksDeleted,
    }[id as keyof typeof commands];
    announce(result({ count: state.count }));
  };

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      actedRef.current = false;
      return;
    }
    if (actedRef.current) return;
    /*
      Closed without a selection, by Escape or a click outside. Focus goes to the Document, not
      to the handle: the handle is outside the Tab order, and a keyboard user would get stuck on it.
      One frame later, when the menu is gone, and only if focus has not been deliberately put on
      another field or button (`FOCUS_TARGET`), which is then left alone. The page body and the
      `Dialog` container (where the window's focus trap puts focus when the menu disappears) are
      not a target, and focus returns to the Document from there.
    */
    const anchor = anchorRef.current;
    const doc = editor.view.dom.ownerDocument;
    requestAnimationFrame(() => {
      if (editor.isDestroyed) return;
      const current = doc.activeElement;
      if (
        !current ||
        !current.matches(FOCUS_TARGET) ||
        anchor?.contains(current) ||
        current.closest('[role="menu"]')
      ) {
        editor.view.focus();
      }
    });
  };

  const tooltip = (
    <span className="flex items-center gap-2">
      {messages.blockActions}
      {openKeys && <Kbd aria-hidden="true">{shortcut(openKeys)}</Kbd>}
    </span>
  );

  return (
    <div
      ref={anchorRef}
      data-block-handle=""
      // Invisible until the first measurement: the position is not known yet.
      className={cn("absolute", !place && "invisible")}
      style={place ?? undefined}
    >
      <TooltipProvider>
        <MenuTrigger isOpen={open} onOpenChange={onOpenChange}>
          <Tooltip content={tooltip}>
            <span className="inline-flex">
              <MenuButton
                ref={buttonRef}
                variant="ghost"
                size="sm"
                iconOnly
                aria-label={messages.blockActions}
                icon={<MoreVerticalIcon size={16} aria-hidden />}
                className="text-fg-2 h-6 w-5"
                {...HAS_POPUP_MENU}
                // Focus on the handle itself keeps it visible: a finger tap opens
                // the menu on release, while the Document loses focus earlier.
                {...buttonExtras(setButtonFocused)}
              />
            </span>
          </Tooltip>
          <Menu className={GLASS_MENU_CLASS} onAction={run}>
            {formatMenuSections(sections, shortcut, run, submenuPlacement)}
          </Menu>
        </MenuTrigger>
      </TooltipProvider>
    </div>
  );
}
