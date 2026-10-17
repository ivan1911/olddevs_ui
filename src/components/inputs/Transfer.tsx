"use client";

import { useEffect, useId, useMemo, useRef, useState, type RefObject } from "react";
import { ListBox, ListBoxItem, type Selection } from "react-aria-components";
import { useMessages } from "../../i18n/useMessages.js";
import { ChevronLeftIcon, ChevronRightIcon } from "../../icons.js";
import { cn } from "../../lib/cn.js";
import { LISTBOX_ITEM_CLASS } from "../../lib/menu.js";
import { Button } from "../actions/Button.js";
import { TextControl } from "./TextControl.js";
import { BUTTON_ICON_SIZE } from "../../lib/button.js";

export interface TransferItem {
  /**
   * Item key. Must be unique within `items`.
   *
   * The kit neither repairs nor reports duplicates: two `ListBoxItem`s with the same `id` are
   * collapsed by the react-aria collection itself, and one of them silently disappears from the
   * screen. Uniqueness is the consumer's contract.
   */
  id: string;
  /** Item label shown in the column. */
  label: string;
  /** The item is shown but cannot be moved or selected. */
  disabled?: boolean;
}

export interface TransferProps {
  /**
   * All items at once, regardless of which column they are currently in.
   *
   * One list, not two: two lists would drift apart at the first edit. An item forgotten in both,
   * or lost from both, would show no symptom at all.
   */
  items: TransferItem[];
  /**
   * Keys that are in the target column. Order matters and is preserved: assigned permissions are
   * shown in the order they were assigned.
   *
   * A key that is not in `items` is **not dropped** by the kit: it is not shown, not counted in
   * the counter, and it survives moves untouched. Dropping it would silently rewrite a value the
   * kit does not own, and the kit cannot know why the consumer sent an unknown key.
   */
  value: string[];
  /** Called when items are moved; receives the new list of keys in the target column. */
  onChange: (value: string[]) => void;
  /** Label of the left (source) column. Without it, the label comes from the message catalog. */
  sourceLabel?: string;
  /** Label of the right (target) column. Without it, the label comes from the message catalog. */
  targetLabel?: string;
  /** Search field above each list. */
  searchable?: boolean;
  /**
   * Disables both columns and both buttons at once.
   *
   * Differs from `TransferItem.disabled`: that one is about a single item that is shown but cannot
   * be moved; this one is about the whole control, where nothing can be moved.
   */
  disabled?: boolean;
  /**
   * Accessible name of the whole pair of columns. With it, the control is announced as a group;
   * without it, it is not.
   *
   * Without a name, an AT user hears two unrelated lists and two arrows between them, and nothing
   * tells them that this is one question, not two. An unnamed group is worse than no group at
   * all, the same rule as for `ButtonGroup`.
   */
  "aria-label"?: string;
  /** Classes for the root element. */
  className?: string;
}

const PANEL_CLASS =
  "border-line bg-bg-1 flex min-w-0 flex-1 flex-col overflow-hidden rounded-md border";

const LIST_CLASS = "flex flex-col gap-px overflow-y-auto p-1.5 outline-none";

/**
 * Row style shared with the menu and the command palette (`lib/menu.ts`).
 *
 * A local copy here was the fourth in the repository, and the only one using `focus-visible:`
 * instead of `focus:`. In react-aria the state is `data-focused`, which is set by both the arrow
 * keys and the mouse; separating them would mean showing two cursors at once.
 */
const ITEM_CLASS = LISTBOX_ITEM_CLASS;

/**
 * What exactly moves when the arrow is pressed: the intersection of the highlight with what is
 * **currently visible** in the column, minus disabled items.
 *
 * Three things, each of which would otherwise cause its own bug.
 *
 * `'all'` is not an edge case: `Ctrl`/`Cmd`+`A` inside a list is the standard
 * `useSelectableCollection` shortcut, and it yields the string `'all'`, not a set of keys. An empty
 * answer to it would disable both buttons in the most common scenario: select everything and move
 * it.
 *
 * Intersecting with the column guards against drift: the highlight lives inside the component and
 * survives an external change of `value`. A key moved to the other column by an outside edit would
 * otherwise stay "movable" and arrive in `value` a second time.
 *
 * Intersecting specifically with what is VISIBLE guards against search: the button must not move
 * what is not on screen. The user acts on what they see.
 */
function movableKeys(selection: Selection, visible: TransferItem[]): string[] {
  const ids = visible.filter((item) => !item.disabled).map((item) => item.id);
  if (selection === "all") return ids;
  const picked = new Set([...selection].map(String));
  return ids.filter((id) => picked.has(id));
}

/** Filters by substring; case-insensitive. */
function filterItems(list: TransferItem[], query: string): TransferItem[] {
  if (!query) return list;
  const needle = query.toLowerCase();
  return list.filter((item) => item.label.toLowerCase().includes(needle));
}

/**
 * Two columns with moves between them: available on the left, selected on the right.
 *
 * The lists are react-aria `ListBox`es: keyboard handling, type-ahead, multiple selection and
 * roles come from there; the component does not create a collection of its own.
 *
 * THERE IS ONE COMPONENT-SPECIFIC DECISION HERE, AND IT IS ABOUT FOCUS. After a move, the moved
 * items disappear from the list, together with the item that had focus. react-aria gives no
 * answer for this case: its collection has changed, and focus falls back to `body`, that is, to
 * the top of the document.
 *
 * The component's rule: **focus follows the items**. It moves to the list the items were moved to,
 * and the moved items become the selection there. This makes moving back work right away: you can
 * press the back button without selecting again. The alternative, leaving focus on the button,
 * breaks on the first full move: the button gets disabled because there is nothing left to move,
 * and focus is lost anyway.
 *
 * Selection (what is highlighted) and value (what is in which column) are DIFFERENT things, and
 * the component does not mix them: the highlight lives inside the component and does not survive a
 * move, while the value comes and goes through props.
 */
export function Transfer({
  items,
  value,
  onChange,
  sourceLabel,
  targetLabel,
  searchable = false,
  disabled = false,
  "aria-label": ariaLabel,
  className,
}: TransferProps) {
  const messages = useMessages();
  const [sourcePicked, setSourcePicked] = useState<Selection>(new Set());
  const [targetPicked, setTargetPicked] = useState<Selection>(new Set());
  const [sourceQuery, setSourceQuery] = useState("");
  const [targetQuery, setTargetQuery] = useState("");
  const sourceList = useRef<HTMLDivElement>(null);
  const targetList = useRef<HTMLDivElement>(null);
  const headingId = useId();

  // A move counter rather than `value`: a consumer of a controlled component may reject a change,
  // in which case `value` does not change, but focus still has to be moved, or it would stay on an
  // item that has disappeared.
  const [moves, setMoves] = useState(0);
  const pending = useRef<{ side: "source" | "target"; key: string } | null>(null);

  const byId = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const chosen = useMemo(() => new Set(value), [value]);

  // The order of the target column is set by `value`, not by `items`: it is the assignment order.
  // The source column, conversely, follows the order of `items`.
  const source = items.filter((item) => !chosen.has(item.id));
  const target = value.map((id) => byId.get(id)).filter((item) => item !== undefined);

  const sourceShown = filterItems(source, sourceQuery);
  const targetShown = filterItems(target, targetQuery);

  const toTarget = movableKeys(sourcePicked, sourceShown);
  const toSource = movableKeys(targetPicked, targetShown);

  /*
    Focus is moved AFTER the commit, not in the handler.

    A synchronous `focus()` lands in the still-old collection: react-aria delegates focus from the
    container to the first selected key inside it, and at that moment there is no new selection
    yet. Focus would land on a random item that was in the column before the move, that is, exactly
    against the "focus follows the items" rule.
  */
  useEffect(() => {
    const next = pending.current;
    if (!next) return;
    pending.current = null;

    /*
      One frame later, not synchronously in the effect.

      `ListBox` builds its collection in a separate pass, and at the time of this effect the
      collection is still the old one: the moved item is not in it yet, but the item that was in the
      column before the move is. A synchronous focus call hit exactly that one: focus landed on a
      random old item instead of the one that had arrived.
    */
    const frame = requestAnimationFrame(() => {
      const list = (next.side === "target" ? targetList : sourceList).current;
      if (!list) return;
      // The option is found by scanning `data-key` attributes rather than by a selector: the key
      // comes from the consumer and may contain anything, and `CSS.escape` is not available in
      // every environment.
      const option = [...list.querySelectorAll<HTMLElement>("[data-key]")].find(
        (node) => node.getAttribute("data-key") === next.key
      );
      // The container is the fallback: if the arrived item is filtered out by the receiving
      // column's search, there is nothing to focus, but focus must not be released to `body`.
      (option ?? list).focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [moves]);

  function moveToTarget() {
    const first = toTarget[0];
    if (first === undefined) return;
    onChange([...value, ...toTarget]);
    setSourcePicked(new Set());
    setTargetPicked(new Set(toTarget));
    pending.current = { side: "target", key: first };
    setMoves((n) => n + 1);
  }

  function moveToSource() {
    const first = toSource[0];
    if (first === undefined) return;
    const removed = new Set(toSource);
    onChange(value.filter((id) => !removed.has(id)));
    setTargetPicked(new Set());
    setSourcePicked(new Set(toSource));
    pending.current = { side: "source", key: first };
    setMoves((n) => n + 1);
  }

  function column(props: {
    side: "source" | "target";
    label: string;
    total: number;
    shown: TransferItem[];
    picked: Selection;
    onPick: (selection: Selection) => void;
    query: string;
    onQuery: (query: string) => void;
    listRef: RefObject<HTMLDivElement | null>;
  }) {
    const { side, label, total, shown, picked, onPick, query, onQuery, listRef } = props;
    const labelId = `${headingId}-${side}`;
    const countId = `${headingId}-${side}-count`;

    return (
      <div className={PANEL_CLASS}>
        <div className="border-line bg-bg-2 flex items-center justify-between gap-2 border-b px-3 py-2">
          <span id={labelId} className="text-fg-0 text-[13px] font-semibold">
            {label}
          </span>
          {/*
            The counter shows everything in the column, not what is left after the search: it
            answers "how many permissions are available in total", and the filter is just a view
            of them. It is also part of the list name, otherwise the number is on screen but not
            in speech.
          */}
          <span id={countId} className="text-fg-2 text-caption">
            {total}
          </span>
        </div>

        {searchable && (
          <div className="px-2.5 pt-2">
            <TextControl
              value={query}
              onChange={(event) => onQuery(event.target.value)}
              aria-label={messages.transfer.searchIn({ list: label })}
              placeholder={messages.common.searchPlaceholder}
              disabled={disabled}
            />
          </div>
        )}

        <ListBox
          ref={listRef}
          aria-labelledby={`${labelId} ${countId}`}
          selectionMode="multiple"
          selectedKeys={picked}
          onSelectionChange={onPick}
          disabledKeys={
            disabled
              ? shown.map((item) => item.id)
              : shown.filter((item) => item.disabled).map((item) => item.id)
          }
          items={shown}
          className={LIST_CLASS}
          renderEmptyState={() => (
            <p className="text-fg-2 px-2.5 py-6 text-center text-[13px]">
              {query ? messages.common.notFound : messages.common.empty}
            </p>
          )}
        >
          {(item: TransferItem) => (
            <ListBoxItem id={item.id} textValue={item.label} className={ITEM_CLASS}>
              {item.label}
            </ListBoxItem>
          )}
        </ListBox>
      </div>
    );
  }

  return (
    <div
      role={ariaLabel ? "group" : undefined}
      aria-label={ariaLabel}
      className={cn("flex items-stretch gap-3", className)}
    >
      {column({
        side: "source",
        label: sourceLabel ?? messages.transfer.source,
        total: source.length,
        shown: sourceShown,
        picked: sourcePicked,
        onPick: setSourcePicked,
        query: sourceQuery,
        onQuery: setSourceQuery,
        listRef: sourceList,
      })}

      <div className="flex shrink-0 flex-col justify-center gap-2">
        <Button
          variant="outline"
          size="sm"
          iconOnly
          icon={<ChevronRightIcon size={BUTTON_ICON_SIZE.sm} aria-hidden />}
          disabled={disabled || toTarget.length === 0}
          onClick={moveToTarget}
          aria-label={messages.transfer.moveToTarget}
        />
        <Button
          variant="outline"
          size="sm"
          iconOnly
          icon={<ChevronLeftIcon size={BUTTON_ICON_SIZE.sm} aria-hidden />}
          disabled={disabled || toSource.length === 0}
          onClick={moveToSource}
          aria-label={messages.transfer.moveToSource}
        />
      </div>

      {column({
        side: "target",
        label: targetLabel ?? messages.transfer.target,
        total: target.length,
        shown: targetShown,
        picked: targetPicked,
        onPick: setTargetPicked,
        query: targetQuery,
        onQuery: setTargetQuery,
        listRef: targetList,
      })}
    </div>
  );
}
