"use client";

import { useEditorState, type Editor } from "@tiptap/react";
import {
  useContext,
  useEffect,
  useRef,
  type Key,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import {
  OverlayTriggerStateContext,
  Popover as AriaPopover,
  type OverlayTriggerState,
} from "react-aria-components";
import {
  Menu,
  MenuButton,
  MenuItem,
  MenuSection,
  MenuSeparator,
  MenuTrigger,
  SubmenuTrigger,
} from "../../../components/overlays/Menu.js";
import { Tooltip } from "../../../components/overlays/Tooltip.js";
import { useMessages, useUiLocale } from "../../../i18n/useMessages.js";
import {
  AlignCenterIcon,
  AlignLeftIcon,
  AlignRightIcon,
  ChevronDownIcon,
  DeleteIcon,
  HeaderRowIcon,
  InsertColumnLeftIcon,
  InsertColumnRightIcon,
  InsertRowAboveIcon,
  InsertRowBelowIcon,
  MergeCellsIcon,
  SortAscendingIcon,
  SortDescendingIcon,
  SplitCellIcon,
  TableIcon,
} from "../../../icons.js";
import { cn } from "../../../lib/cn.js";
import { MENU_PANEL_CLASS } from "../../../lib/menu.js";
import { useLockableMenu } from "../../ui/lockableMenu.js";
import { insertTableOfSize } from "../../core/insertItems.js";
import {
  lastTableSize,
  rememberTableSize,
  runTableCommand,
  tableCommands,
  tableMenuState,
  type TableAction,
} from "./tableActions.js";
import { TableSizeGrid } from "./TableSizeGrid.js";
import { useSubmenuPlacement } from "../../../hooks/useSubmenuPlacement.js";
import { GLASS_MENU_CLASS } from "../../styles/glass.js";

export interface TableMenuButtonProps {
  editor: Editor;
  /** The field is disabled: the button is visible but cannot be pressed. */
  disabled: boolean;
  /** `aria-disabled`: reachable with the arrow keys, but the menu does not open (HTML mode). */
  unavailable?: boolean;
  /**
   * The "Insert table…" item. The dialog with numeric fields is held by `RichTextEditor`,
   * not by the Toolbar: the floating Toolbar hides when focus moves into the dialog. Without
   * this prop, there is no item.
   */
  onInsertDialog?: () => void;
  /** The shortcut label comes from the Toolbar: it knows whether the platform is Apple. */
  shortcut: (keys: readonly string[]) => string;
}

/**
 * `Alt+↓` (`⌥↓`) — the row below (`addRowBelow` in `tables.ts`). The Toolbar translates
 * the modifier itself (`alt` → `Alt` or `⌥`); the key is passed as is.
 *
 * The item has NO `aria-keyshortcuts`: the kit's `MenuItem` (react-aria) passes only the
 * DOM attributes it knows, and this one is dropped. The shortcut is visible in the item's
 * label (`kbd`) and is named in the Editor's reference.
 */
const ROW_BELOW_KEYS = ["alt", "↓"] as const;

/** Keys of the top-level items that do nothing by themselves. */
const GRID_KEY = "insertGrid";
const DIALOG_KEY = "insertDialog";

/*
  By default, a react-aria menu drops a disabled item from arrow-key navigation. The
  APG advises the opposite: the item stays, marked `aria-disabled`. Otherwise the arrow
  skips it silently, and it is unclear where it went. The react-stately selection state
  can do this (`disabledBehavior: "selection"`), but the `Menu` type does not declare the
  prop, hence the cast.
*/
const KEEP_DISABLED_IN_NAVIGATION = { disabledBehavior: "selection" } as object;

/*
  RAC sets `aria-haspopup="true"` on the menu trigger. In ARIA 1.2 that means the same as
  `menu`, but the owner asked for an explicit value, which reads more clearly.
*/
const HAS_POPUP_MENU = { "aria-haspopup": "menu" } as object;

/**
 * The "Table" menu on the Toolbar: one button for inserting and for the actions, as in
 * TinyMCE.
 *
 * WHY ONE BUTTON. There used to be two: "Table" (insert 3×3) and "Table actions", which
 * appeared only inside a table. A button that appears and disappears with the caret shifted
 * the others and changed the number of stops in the Toolbar's arrow-key navigation, and
 * there was nowhere to pick a table size. Now the button is always there, and the items
 * with nothing to do outside a table are disabled (`aria-disabled`) and stay in the
 * arrow-key navigation.
 *
 * WHY A MENU ON THE TOOLBAR AND NOT A FLOATING TOOLBAR NEAR THE TABLE. For the keyboard,
 * the Toolbar has an entry point: `Alt+F10` moves focus to the Toolbar, where this menu is
 * one of the buttons. `Enter` or Down Arrow opens the list, `→` opens the submenu, and `←`
 * or `Escape` closes it. The caret stays in the cell when focus moves to the Toolbar, so
 * "the row above" refers to the row the user came from.
 *
 * THE SIZE GRID IS THE SECOND CHILD OF `SubmenuTrigger`: a bare react-aria popover instead
 * of `Menu` (`GridSubmenu`). Inside it are not items but `TableSizeGrid`.
 *
 * The menu is controlled (`isOpen`): a pick in the grid is not a menu item, and react-aria
 * does not know on its own to close the menu after it.
 */
export function TableMenuButton({
  editor,
  disabled,
  unavailable = false,
  onInsertDialog,
  shortcut,
}: TableMenuButtonProps) {
  const messages = useMessages().editor;
  const locale = useUiLocale();
  const menu = useLockableMenu(unavailable);
  const submenuPlacement = useSubmenuPlacement();
  const gridItemRef = useRef<HTMLDivElement>(null);
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => tableMenuState(current.state, locale),
  });

  const run = (key: Key) => {
    const action = String(key);
    if (action === DIALOG_KEY) {
      /*
        Focus goes into the Document BEFORE the dialog. The dialog remembers who had focus
        when it opened, and on close returns focus there, to the caret. Use a timer, not an
        immediate call: after `onAction`, react-aria returns focus to the pressed item, and
        the dialog would remember that item, but the item is gone by the time the dialog
        closes. `view.focus()`, not `commands.focus()`: the latter waits one more frame.
      */
      setTimeout(() => {
        if (editor.isDestroyed) return;
        editor.view.focus();
        onInsertDialog?.();
      }, 0);
      return;
    }
    const commands = tableCommands(locale);
    if (action in commands) runTableCommand(editor, commands[action as TableAction]);
  };

  /*
    Focus after a pick in the grid goes to the Document, but only once the submenu has
    been removed. The grid's popover is a react-aria dialog and keeps focus inside itself:
    a Document that took focus earlier would be handed straight back to the grid, and the
    removed popover would return focus to the "Table" button. So a pick only raises a flag,
    and focus is set by `GridHost` when it unmounts (`onClosed`): the grid is already out of
    the DOM, focus has gone to the body, and react-aria, seeing focus in the document,
    returns nothing.
  */
  const picked = useRef(false);
  const pick = (cols: number, rows: number) => {
    rememberTableSize(editor, { cols, rows });
    insertTableOfSize(editor, cols, rows);
    picked.current = true;
    menu.close();
  };
  const gridClosed = () => {
    if (!picked.current) return;
    picked.current = false;
    if (!editor.isDestroyed) editor.view.focus();
  };

  const item = (action: TableAction, label: string, icon: ReactNode, keys?: readonly string[]) => (
    <MenuItem
      id={action}
      textValue={label}
      disabled={!state?.can[action]}
      icon={icon}
      shortcut={keys ? shortcut(keys) : undefined}
    >
      {label}
    </MenuItem>
  );

  /** The submenu is only for a table: outside one, the item is disabled and expands to nothing. */
  const submenu = (id: string, label: string, children: ReactNode) =>
    state ? (
      <SubmenuTrigger>
        <MenuItem id={id} textValue={label}>
          {label}
        </MenuItem>
        <Menu
          aria-label={label}
          className={GLASS_MENU_CLASS}
          placement={submenuPlacement}
          offset={2}
          onAction={run}
          {...KEEP_DISABLED_IN_NAVIGATION}
        >
          {children}
        </Menu>
      </SubmenuTrigger>
    ) : (
      <MenuItem id={id} textValue={label} disabled>
        {label}
      </MenuItem>
    );

  return (
    <MenuTrigger {...menu.trigger}>
      {/* The tooltip sits on the wrapper: react-aria's `Button` does not pass Radix hover
          handlers. */}
      <Tooltip content={messages.table}>
        <span className="inline-flex">
          <MenuButton
            variant="ghost"
            size="sm"
            disabled={disabled}
            aria-label={messages.table}
            icon={<TableIcon size={16} aria-hidden />}
            className="gap-0.5 px-1.5"
            {...HAS_POPUP_MENU}
            {...menu.button}
          >
            <ChevronDownIcon size={12} aria-hidden />
          </MenuButton>
        </span>
      </Tooltip>
      <Menu
        aria-label={messages.table}
        className={GLASS_MENU_CLASS}
        onAction={run}
        {...KEEP_DISABLED_IN_NAVIGATION}
      >
        <SubmenuTrigger>
          <MenuItem id={GRID_KEY} ref={gridItemRef} textValue={messages.table}>
            {messages.table}
          </MenuItem>
          <GridSubmenu
            side={submenuPlacement}
            initial={lastTableSize(editor)}
            onPick={pick}
            onClosed={gridClosed}
            triggerRef={gridItemRef}
            label={messages.tableGrid}
          />
        </SubmenuTrigger>
        {onInsertDialog && (
          <MenuItem id={DIALOG_KEY} textValue={messages.tableInsertDialog}>
            {messages.tableInsertDialog}
          </MenuItem>
        )}
        <MenuSeparator />
        {submenu(
          "cell",
          messages.tableCell,
          <>
            {item("mergeCells", messages.tableMergeCells, <MergeCellsIcon size={14} aria-hidden />)}
            {item("splitCell", messages.tableSplitCell, <SplitCellIcon size={14} aria-hidden />)}
          </>
        )}
        {submenu(
          "row",
          messages.tableRow,
          <>
            <MenuSection id="rows">
              {item(
                "addRowBefore",
                messages.tableAddRowBefore,
                <InsertRowAboveIcon size={14} aria-hidden />
              )}
              {item(
                "addRowAfter",
                messages.tableAddRowAfter,
                <InsertRowBelowIcon size={14} aria-hidden />,
                // The same action from the keyboard, from a cell (`tables.ts`, `addRowBelow`).
                ROW_BELOW_KEYS
              )}
              {item("deleteRow", messages.tableDeleteRow, <DeleteIcon size={14} aria-hidden />)}
            </MenuSection>
            <MenuSeparator />
            {/* A toggle item does not close the menu by default; here it closes, like the
                others. */}
            <MenuSection
              id="header"
              selectionMode="multiple"
              selectedKeys={state?.headerRow ? ["headerRow"] : []}
            >
              <MenuItem
                id="headerRow"
                textValue={messages.tableHeaderRow}
                disabled={!state?.can.headerRow}
                shouldCloseOnSelect
                icon={<HeaderRowIcon size={14} aria-hidden />}
              >
                {messages.tableHeaderRow}
              </MenuItem>
            </MenuSection>
          </>
        )}
        {submenu(
          "column",
          messages.tableColumn,
          <>
            <MenuSection id="columns">
              {item(
                "addColumnBefore",
                messages.tableAddColumnBefore,
                <InsertColumnLeftIcon size={14} aria-hidden />
              )}
              {item(
                "addColumnAfter",
                messages.tableAddColumnAfter,
                <InsertColumnRightIcon size={14} aria-hidden />
              )}
              {item(
                "deleteColumn",
                messages.tableDeleteColumn,
                <DeleteIcon size={14} aria-hidden />
              )}
            </MenuSection>
            <MenuSeparator />
            {/* A radio group: the alignment of the whole column is checked; when it is
                mixed, none is. */}
            <MenuSection
              id="alignment"
              selectionMode="single"
              selectedKeys={state?.alignment ? [ALIGN_KEY[state.alignment]] : []}
            >
              {item("alignLeft", messages.tableAlignLeft, <AlignLeftIcon size={14} aria-hidden />)}
              {item(
                "alignCenter",
                messages.tableAlignCenter,
                <AlignCenterIcon size={14} aria-hidden />
              )}
              {item(
                "alignRight",
                messages.tableAlignRight,
                <AlignRightIcon size={14} aria-hidden />
              )}
            </MenuSection>
          </>
        )}
        <MenuSeparator />
        {submenu(
          "sort",
          messages.tableSort,
          /*
            Merged cells: sorting is unavailable, and the submenu says why. The section
            label is read by the screen reader on entering the group, not only seen by the
            eye. Without it, the two grey items would look like a bug.
          */
          <MenuSection id="sorting" label={state?.merged ? messages.tableSortMerged : undefined}>
            {item(
              "sortAscending",
              messages.tableSortAscending,
              <SortAscendingIcon size={14} aria-hidden />
            )}
            {item(
              "sortDescending",
              messages.tableSortDescending,
              <SortDescendingIcon size={14} aria-hidden />
            )}
          </MenuSection>
        )}
        <MenuSeparator />
        <MenuItem
          id="deleteTable"
          textValue={messages.tableDelete}
          disabled={!state?.can.deleteTable}
          tone="danger"
        >
          {messages.tableDelete}
        </MenuItem>
      </Menu>
    </MenuTrigger>
  );
}

const ALIGN_KEY = { left: "alignLeft", center: "alignCenter", right: "alignRight" } as const;

/**
 * The "Table ›" submenu: a react-aria popover with the size grid.
 *
 * A react-aria POPOVER, NOT the kit's `Popover`. `SubmenuTrigger` expects exactly this as
 * its second child: through context it gets the place next to the item, the layer and the
 * submenu state. The look is the same `MENU_PANEL_CLASS` as the `Menu` panel.
 *
 * FOCUS goes in AFTER THE SUBMENU HAS SETTLED, on the popover's own signal rather than on
 * a clock. A submenu opened from the keyboard (`→`, `Enter`) waits for focus inside. But a
 * grid that takes focus on mount, still in the same `keydown` and before the popover has
 * its place, breaks the menu: inside the dialog (`Dialog`) the menu stayed in the DOM after
 * a pick, and the next open handed focus to `body`. Earlier, focus was deferred by a 50 ms
 * timer, which was a race: the number guarantees nothing on a slow device and waits too
 * long on a fast one. Now the popover reports that it has settled: the render props
 * `placement` (the place is computed; the panel has `data-placement`) and `isEntering` (the
 * entry animation has finished; react-aria waits for its `finished`). Focus is set by an
 * effect once both are ready. This happens only when opened from the keyboard: with the
 * mouse the grid moves by hovering, and focus stays on the item.
 *
 * KEYS. Arrows and `Home`/`End` belong to the grid and do not go further: the menu beneath
 * would answer them with its own navigation. `Escape` closes only the submenu and returns
 * focus to the "Table" item, layer by layer (ADR-0041). `←` in the grid moves the selection
 * rather than closing the submenu: for the grid, that is its own axis.
 */
function GridSubmenu({
  side,
  initial,
  onPick,
  onClosed,
  triggerRef,
  label,
}: {
  /** Place next to the item, from `useSubmenuPlacement`. On a phone, below the item. */
  side: "bottom start" | "right top";
  initial: { cols: number; rows: number };
  onPick: (cols: number, rows: number) => void;
  onClosed: () => void;
  triggerRef: RefObject<HTMLDivElement | null>;
  label: string;
}) {
  return (
    <AriaPopover
      aria-label={label}
      placement={side}
      offset={2}
      className={cn(MENU_PANEL_CLASS, GLASS_MENU_CLASS, "p-2")}
    >
      {({ placement, isEntering }) => (
        <GridHost
          initial={initial}
          onPick={onPick}
          onClosed={onClosed}
          triggerRef={triggerRef}
          settled={placement != null && !isEntering}
        />
      )}
    </AriaPopover>
  );
}

function GridHost({
  initial,
  onPick,
  onClosed,
  triggerRef,
  settled,
}: {
  initial: { cols: number; rows: number };
  onPick: (cols: number, rows: number) => void;
  onClosed: () => void;
  triggerRef: RefObject<HTMLDivElement | null>;
  /** The submenu popover has settled: its place is computed and the entry animation is
   * done. */
  settled: boolean;
}) {
  const submenu = useContext(OverlayTriggerStateContext) as
    (OverlayTriggerState & { focusStrategy?: unknown }) | null;
  const gridRef = useRef<HTMLDivElement>(null);
  const fromKeyboard = submenu?.focusStrategy != null;

  // The grid is removed: the popover is already out of the DOM (see `pick` in `TableMenuButton`).
  const onClosedRef = useRef(onClosed);
  onClosedRef.current = onClosed;
  useEffect(() => () => onClosedRef.current(), []);

  useEffect(() => {
    if (fromKeyboard && settled) gridRef.current?.focus();
  }, [fromKeyboard, settled]);

  const close = () => {
    submenu?.close();
    triggerRef.current?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
      return;
    }
    if (/^(Arrow|Home$|End$|Enter$)/.test(event.key)) event.stopPropagation();
  };

  return (
    // The wrapper catches events bubbling up from the grid: the grid's keys do not go
    // past the menu.
    <div onKeyDown={onKeyDown}>
      <TableSizeGrid ref={gridRef} initial={initial} autoFocus={false} onPick={onPick} />
    </div>
  );
}
