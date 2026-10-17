"use client";

import type { Editor } from "@tiptap/react";
import { useId, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { useFilter } from "react-aria-components";
import { DEFAULT_MESSAGES } from "../../i18n/defaults.js";
import { useMessages, useUiLocale } from "../../i18n/useMessages.js";
import { isApple, shortcutLabel } from "./EditorToolbar.js";
import {
  applyInsertItem,
  INSERT_SECTIONS,
  insertItemHint,
  matchesQuery,
  type InsertItem,
} from "../core/insertItems.js";
import { closeSlashMenu, type SlashBridge, type SlashSession } from "../core/slashCommand.js";
import {
  emptyRect,
  SuggestionList,
  suggestionOptionId,
  type SuggestionGroup,
} from "./SuggestionList.js";

export interface SlashMenu {
  /**
   * Bridge for the extension. `undefined` means the menu is off, and `/` stays a plain
   * character.
   */
  bridge: SlashBridge | undefined;
  /**
   * Field attributes: the combobox part of the pattern, which says which list the field
   * owns and which row in it is current.
   */
  attributes: Record<string, string>;
  /** The list itself, rendered next to the field. */
  element: ReactNode;
}

/**
 * The Slash menu (`/`): a list at the caret.
 *
 * FOCUS STAYS IN THE FIELD. The user keeps typing the query, so the list is not a
 * separate focus stop. It is a floating part of the field, following the APG combobox
 * pattern: the field points to the list with `aria-controls`, to the current row with
 * `aria-activedescendant`, and the arrow keys and Enter are heard by the engine
 * (`slashCommand.ts`) and passed here.
 *
 * `aria-expanded` is NOT set on the field, and this is not an oversight. The field is
 * `role="textbox"`, and ARIA 1.2 does not allow this attribute on a text field (axe:
 * `aria-allowed-attr`). The field's role cannot be switched to `combobox` while the menu
 * is open, because a multi-line document is not a combobox. What remains is
 * `aria-autocomplete="list"`, which a text field may use (it can show a list), and the
 * pair `aria-controls` + `aria-activedescendant` while the list is shown.
 *
 * WHY THE KIT'S `Popover`, NOT A CUSTOM ABSOLUTE LIST. The anchor is the caret, and
 * `PopoverAnchor` accepts it as a virtual rectangle. More important, the Radix popover is
 * a layer of the Radix stack. When the list is open, Escape goes to the top layer: the
 * list closes, while the `Dialog` or `Drawer` that holds the field stays open, with no new
 * guard needed in dialogs (ADR-0041). A custom list outside the Radix stack would have to
 * learn this separately, and dialogs would have to tell it apart.
 *
 * Escape reaches the stack before the engine, and the engine no longer sees it
 * (ProseMirror skips events with `defaultPrevented`). So the session is closed from here,
 * via `closeSlashMenu`. The typed `/query` stays as text, and the menu does not reopen on
 * it until a new `/` is started.
 */
export function useSlashMenu(
  items: readonly InsertItem[],
  editorRef: RefObject<Editor | null>
): SlashMenu {
  const messages = useMessages().editor;
  const locale = useUiLocale();
  const { contains } = useFilter({ sensitivity: "base" });
  const listboxId = useId();
  const [session, setSession] = useState<SlashSession | null>(null);
  const [active, setActive] = useState(0);

  const visible = useMemo(() => {
    if (!session) return [];
    const found = items.filter((item) =>
      matchesQuery(item, session.query, messages, locale, DEFAULT_MESSAGES.editor, contains)
    );
    // Rows on screen are ordered by section; the arrow keys follow the same order.
    return INSERT_SECTIONS.flatMap((section) => found.filter((item) => item.section === section));
  }, [items, session, messages, locale, contains]);

  /*
    The engine asks about a key in the middle of its own handler, not through a render.
    So whatever it reads lives in a ref, which each render updates.
  */
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const visibleRef = useRef(visible);
  visibleRef.current = visible;
  const activeRef = useRef(active);
  activeRef.current = active;

  const apply = (item: InsertItem) => {
    const editor = editorRef.current;
    const range = sessionRef.current?.range;
    if (editor && range) applyInsertItem(editor, item, range);
  };
  const applyRef = useRef(apply);
  applyRef.current = apply;

  const [bridge] = useState<SlashBridge>(() => ({
    open: (next) => {
      // A new query means a new list: the active row resets to the first one.
      if (next.query !== sessionRef.current?.query) setActive(0);
      setSession(next);
    },
    close: () => setSession(null),
    keyDown: (event) => {
      // An Enter that confirms IME composition belongs to the IME, not to the menu.
      if (event.isComposing) return false;
      const list = visibleRef.current;
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        if (list.length === 0) return false;
        const step = event.key === "ArrowDown" ? 1 : -1;
        // Update the ref right away, without waiting for a render: two arrow presses in
        // a row must not read the same row.
        const next = (activeRef.current + step + list.length) % list.length;
        activeRef.current = next;
        setActive(next);
        return true;
      }
      if (event.key === "Enter") {
        const item = list[activeRef.current];
        // Nothing matches: Enter stays a line break, and the menu closes by itself.
        if (!item) return false;
        applyRef.current(item);
        return true;
      }
      return false;
    },
  }));

  /*
    `contextElement` is the Document. Scrolling of its ancestors recalculates the position
    through it, so the menu follows the caret inside the Document's own scroll area
    (`maxHeight`, ADR-0059), not only in the window.
  */
  const anchorRef = useRef({
    getBoundingClientRect: () => sessionRef.current?.rect() ?? emptyRect(),
    get contextElement() {
      const editor = editorRef.current;
      return editor && !editor.isDestroyed ? editor.view.dom : undefined;
    },
  });

  const optionId = (item: InsertItem) => suggestionOptionId(listboxId, item.id);
  const current = session ? visible[active] : undefined;

  const enabled = items.length > 0;
  const open = session !== null;
  const activeId = current ? optionId(current) : undefined;
  // The object changes only when its values change: the engine options are built from it,
  // and a new object on every render would set them again.
  const attributes = useMemo(() => {
    const result: Record<string, string> = {};
    if (enabled) result["aria-autocomplete"] = "list";
    if (open) result["aria-controls"] = listboxId;
    if (open && activeId) result["aria-activedescendant"] = activeId;
    return result;
  }, [enabled, open, listboxId, activeId]);

  const apple = isApple();
  const groups: SuggestionGroup[] = INSERT_SECTIONS.map((section) => ({
    id: section,
    label: section === "insert" ? messages.insertSection : messages.turnIntoSection,
    rows: visible
      .filter((item) => item.section === section)
      .map((item) => ({
        id: item.id,
        label: item.label(messages, locale),
        icon: item.icon,
        hint: insertItemHint(item, (keys) => shortcutLabel(keys, apple)),
      })),
  }));
  const element = enabled && (
    <SuggestionList
      open={open}
      onClose={() => {
        const editor = editorRef.current;
        if (editor && !editor.isDestroyed) closeSlashMenu(editor.view);
      }}
      anchorRef={anchorRef}
      editorRef={editorRef}
      listboxId={listboxId}
      label={messages.insertMenu}
      groups={groups}
      active={active}
      onActivate={setActive}
      onApply={(rowId) => {
        const item = visible.find((candidate) => candidate.id === rowId);
        if (item) apply(item);
      }}
      emptyText={messages.nothingFound}
      showEmpty
    />
  );

  return { bridge: enabled ? bridge : undefined, attributes, element };
}
