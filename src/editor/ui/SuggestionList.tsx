"use client";

import type { Editor } from "@tiptap/react";
import { useEffect, type ComponentType, type RefObject } from "react";
import { Popover, PopoverAnchor, PopoverContent } from "../../components/overlays/Popover.js";
import { cn } from "../../lib/cn.js";
import {
  MENU_ITEM_CLASS,
  MENU_ITEM_ICON_CLASS,
  MENU_ITEM_SHORTCUT_CLASS,
  MENU_ITEM_TONE,
  MENU_PANEL_CLASS,
  MENU_SECTION_LABEL_CLASS,
} from "../../lib/menu.js";
import { keyGlyphs } from "../../components/content/Kbd.js";
import type { IconProps } from "../../icons.js";
import { GLASS_MENU_CLASS } from "../styles/glass.js";

/** A zero-size rectangle: the anchor used until the caret is found on screen. */
export function emptyRect(): DOMRect {
  return {
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: 0,
    height: 0,
    toJSON: () => ({}),
  };
}

/** A list row: an icon, a label and an optional hint (a shortcut). */
export interface SuggestionRow {
  /** The row key, unique across the whole list; the DOM `id` is built from it. */
  id: string;
  label: string;
  icon?: ComponentType<IconProps>;
  /** A visual hint (Markdown or a shortcut): the row's name is its label. */
  hint?: string;
}

/** A section of the list. Without a `label`, the rows have no heading and no group. */
export interface SuggestionGroup {
  id: string;
  label?: string;
  rows: readonly SuggestionRow[];
}

/** The list's virtual anchor: the caret in the Document. */
export interface SuggestionAnchor {
  getBoundingClientRect: () => DOMRect;
  readonly contextElement: Element | undefined;
}

export interface SuggestionListProps {
  open: boolean;
  /**
   * The list was closed from outside (Escape from the layer stack, a click outside):
   * the session must end.
   */
  onClose: () => void;
  anchorRef: RefObject<SuggestionAnchor>;
  editorRef: RefObject<Editor | null>;
  /** The `id` of the list root; the field's `aria-controls` points to it. */
  listboxId: string;
  /** The list's accessible name. */
  label: string;
  groups: readonly SuggestionGroup[];
  /** The index of the current row across all sections. */
  active: number;
  onActivate: (position: number) => void;
  /** A row is selected by a click; the field handles the keyboard. */
  onApply: (rowId: string) => void;
  /** The "nothing found" row, shown when there are no rows. */
  emptyText: string;
  /** Whether to show it now: the answer may still be loading. */
  showEmpty: boolean;
}

/** The row's `id` in the DOM; the field's `aria-activedescendant` points to it. */
export const suggestionOptionId = (listboxId: string, rowId: string) => `${listboxId}-${rowId}`;

/**
 * The suggestion list at the caret, shared by the `/` Insert menu (`SlashMenu`) and by
 * custom trigger characters (`TriggerMenu`, ADR-0064).
 *
 * FOCUS STAYS IN THE FIELD. The list is a floating part of the field, following the APG
 * combobox pattern: the field points to the list with `aria-controls`, to the current row
 * with `aria-activedescendant`, and the arrow keys and Enter are heard by the engine
 * (`slashCommand.ts`) and passed to the list's owner. For details and for WHY the kit's
 * `Popover` is used, see `useSlashMenu`.
 */
export function SuggestionList({
  open,
  onClose,
  anchorRef,
  editorRef,
  listboxId,
  label,
  groups,
  active,
  onActivate,
  onApply,
  emptyText,
  showEmpty,
}: SuggestionListProps) {
  const flat = groups.flatMap((group) => group.rows);
  const activeRowId = open ? flat[active]?.id : undefined;

  // A long list scrolls to follow the arrow keys. jsdom has no scrolling.
  useEffect(() => {
    if (!activeRowId) return;
    // The list is portaled into the Editor's document, not necessarily the global one.
    const doc = editorRef.current?.view.dom.ownerDocument ?? document;
    const node = doc.getElementById(suggestionOptionId(listboxId, activeRowId));
    if (typeof node?.scrollIntoView === "function") node.scrollIntoView({ block: "nearest" });
  });

  let index = 0;
  const renderRows = (rows: readonly SuggestionRow[]) =>
    rows.map((row) => {
      const position = index++;
      const selected = position === active;
      const Icon = row.icon;
      return (
        <div
          key={row.id}
          id={suggestionOptionId(listboxId, row.id)}
          role="option"
          aria-selected={selected}
          data-highlighted={selected || undefined}
          onMouseMove={() => {
            if (!selected) onActivate(position);
          }}
          onClick={() => onApply(row.id)}
          className={cn(MENU_ITEM_CLASS, MENU_ITEM_TONE.neutral)}
        >
          {Icon && (
            <span className={MENU_ITEM_ICON_CLASS}>
              <Icon size={14} aria-hidden />
            </span>
          )}
          <span className="truncate">{row.label}</span>
          {row.hint && (
            // Visual hint: the row's name is its label, without "##".
            <kbd aria-hidden="true" className={MENU_ITEM_SHORTCUT_CLASS}>
              {keyGlyphs(row.hint)}
            </kbd>
          )}
        </div>
      );
    });

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <PopoverAnchor virtualRef={anchorRef} />
      <PopoverContent
        side="bottom"
        align="start"
        // The caret moves while typing and scrolling, and the virtual anchor does not
        // report its shifts. So the position is recalculated every frame while the list
        // is open.
        updatePositionStrategy="always"
        // Focus stays in the field: the query continues to be typed there.
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => event.preventDefault()}
        // The field is part of the combobox, not "outside" the list. Focus that arrives in
        // it while the list is open (a caret placed programmatically, a return to the
        // browser window) is no reason to close the list. Radix would otherwise count it as
        // focus leaving and remove the layer, and with it the session.
        onFocusOutside={(event) => {
          const field = editorRef.current?.view.dom;
          if (field && event.target instanceof Node && field.contains(event.target)) {
            event.preventDefault();
          }
        }}
        className={cn(MENU_PANEL_CLASS, GLASS_MENU_CLASS, "max-h-80 w-64 overflow-y-auto")}
      >
        <div
          role="listbox"
          id={listboxId}
          aria-label={label}
          // A click on a row does not move focus out of the field, or typing would be interrupted.
          onMouseDown={(event) => event.preventDefault()}
        >
          {groups.map((group) => {
            if (group.rows.length === 0) return null;
            if (group.label === undefined) return renderRows(group.rows);
            const headerId = `${listboxId}-${group.id}`;
            return (
              <div key={group.id} role="group" aria-labelledby={headerId}>
                <div id={headerId} role="presentation" className={MENU_SECTION_LABEL_CLASS}>
                  {group.label}
                </div>
                {renderRows(group.rows)}
              </div>
            );
          })}
          {flat.length === 0 && showEmpty && (
            <div
              role="option"
              aria-selected={false}
              aria-disabled="true"
              className={cn(MENU_ITEM_CLASS, "text-fg-3 cursor-default")}
            >
              {emptyText}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
