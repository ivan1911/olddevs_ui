"use client";

import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import {
  Button,
  DropIndicator,
  GridList,
  GridListItem,
  useDragAndDrop,
  type Key,
} from "react-aria-components";
import { DragHandleIcon } from "../../icons.js";
import { useMessages } from "../../i18n/useMessages.js";
import { cn } from "../../lib/cn.js";
import { reorder } from "../../lib/reorder.js";
import { TextControl } from "../inputs/TextControl.js";

export interface EditableListItem {
  /** A stable row identifier: the list reports edits and the new order by it. */
  id: Key;
  /** The name, editable in place. */
  value: string;
  /**
   * The string representation of the row, used for the accessible name and for reorder
   * announcements.
   *
   * Defaults to `value`. Worth setting where the bare value is uninformative: "6/5" instead
   * of "Due date, June 5".
   */
  textValue?: string;
  /** The row is disabled: it cannot be edited or dragged. */
  disabled?: boolean;
}

export interface EditableListProps {
  /** The rows in their current order; the consumer owns the order. */
  items: EditableListItem[];
  /** The whole new order: the list of identifiers after the move. */
  onReorder: (ids: Key[]) => void;
  /** Called when an edit is confirmed, and only if the value has changed. */
  onValueChange: (id: Key, value: string) => void;
  /**
   * The accessible name of the edit field. Required and checked by the compiler: without it,
   * an in-place edit would produce an unnamed field at the very moment of typing.
   */
  editLabel: (item: EditableListItem) => string;
  /** The accessible name of the list. A list without a name is announced by its role alone. */
  "aria-label": string;
  /**
   * The add row at the end of the list. Without this prop, there is no add row at all.
   *
   * `label` is the accessible name of the field; a placeholder does not count as one.
   */
  add?: {
    label: string;
    placeholder?: string;
    onAdd: (value: string) => void;
    /**
     * The addition is still being saved.
     *
     * The field is not disabled while this is true, and that is deliberate. A disabled field
     * loses focus and does not get it back, and a series of tasks entered one after another is
     * the only reason the add row exists: it would break on the first one as soon as saving goes
     * over the network. The busy state is announced with `aria-busy`, and typing continues.
     */
    pending?: boolean;
    /**
     * The leading columns of the add row: exactly the same space that `leading` takes in the
     * list rows.
     *
     * The component reserves the space for the drag handle itself; it cannot know about
     * `leading`, since its width is set by the consumer. Without this slot, a list with
     * `leading` would have the field's frame sitting in the checkbox column while the row
     * titles shift to the right, and the bottom of the list would look ragged.
     *
     * Put a spacer of the same geometry here, not a live control: there is nothing to check
     * on a task that does not exist yet, and a control would take focus. Hide the spacer from
     * screen readers with `aria-hidden`.
     */
    leading?: ReactNode;
  };
  /** A slot to the left of the name: a completion checkbox, an assignee avatar. */
  leading?: (item: EditableListItem) => ReactNode;
  /** A slot on the right: a status badge, the row's action buttons. */
  trailing?: (item: EditableListItem) => ReactNode;
  /**
   * Called when the row is clicked or Space is pressed on it. The component does not handle these
   * events itself.
   *
   * A single click is left to the consumer on purpose: Enter opens the edit, and if a click did
   * the same thing, the row would have no way to open its details.
   */
  onRowAction?: (id: Key) => void;
  /**
   * Whether to divide the rows with a hairline.
   *
   * Without it, the rows are held together by spacing alone, and on a dense list they read as
   * one solid block: only the drag handles act as anchors. The line breaks up the rows without
   * turning each row into an object of its own, and that is the difference in cost between it
   * and a framed background.
   *
   * The line goes between rows, not under each one: under the last row it would underline a
   * list that nobody underlined.
   *
   * The row's rounded corners are removed as well, and this is not a side effect: with a
   * straight line under a rounded row, the corners curl along with the frame, and the divider
   * stops being straight. As a bonus, the hover highlight becomes a full-width band, the usual
   * look of a divided list.
   *
   * The component deliberately does not support framed row backgrounds: nobody needs that style
   * yet, and an axis reserved for the future is an API that would have to be maintained without
   * a request for it (ADR-0031).
   */
  divided?: boolean;
  /** What to show when the list is empty. */
  emptyText?: ReactNode;
  /** Class names for the root element. */
  className?: string;
}

/*
  A FIELD IN THE LIST IS MORE COMPACT THAN A STANDARD ONE, and this is not a matter of taste.

  `TextControl` is 42 pixels tall: a 20-pixel line box, 2×10 of padding and 2 for the border.
  A list row is 32. The difference shows exactly where the field sits in one line with the rows:
  the line starts to "breathe" unevenly, and when the edit opens, the row jumps fourteen
  pixels together with everything below it.

  The padding is removed from the FIELD ITSELF, not from the wrapper: the border and the focus
  highlight live on the wrapper, and zeroing its padding would press the text against the border.
  `20 + 2×5 + 2 = 32`, exactly the row height.
*/
const FIELD_COMPACT_CLASS = "py-[5px]";

export interface EditableListHandle {
  /**
   * Moves focus to the add row.
   *
   * If there is no row (`add` is not passed), the call silently does nothing. Silently rather
   * than with an exception: the caller comes from a command palette or a hotkey and does NOT
   * want to know what state the list is in. An exception here would mean a check at every call
   * site.
   *
   * `select` selects the typed text: a repeated call then starts typing afresh rather than
   * appending to the previous text. Without it, a field that already had focus stays as it is:
   * neither the caret nor the text is touched.
   */
  focusAdd: (options?: { select?: boolean }) => void;
}

//: `group` HERE IS A CONTRACT, NOT STYLING (ADR-0046). Nothing inside the kit uses it, but the
//: content of the `leading` and `trailing` slots in consumer code relies on `group-hover:` and
//: `group-focus-within:` to show the row's actions on hover. If you remove it as a dead class,
//: consumers break silently: the buttons simply become always visible. Pinned by the test
//: "the row stays the root of the Tailwind group".
const ROW_CLASS =
  "group hover:bg-bg-2 flex items-center gap-1.5 rounded-lg px-1 py-1.5 text-[13px] " +
  "focus-visible:outline-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2 " +
  "dragging:opacity-50";

//: The divider is a bottom border on all rows except the last. Rounding is removed: under a
//: rounded row, the line would curl at the corners.
const DIVIDED_ROW_CLASS = "border-line-soft rounded-none border-b last:border-b-0";

/**
 * A row that has disappeared from `items` and is exiting.
 *
 * A snapshot of the element is stored, not a reference to it in `items`: the element is no
 * longer there, and there would be nothing to take the label, icon and slots from. Rendering the
 * leaving row as empty would show a flicker rather than an exit.
 */
interface LeavingRow {
  item: EditableListItem;
  /** The place where the row stood: it plays out its exit there. */
  index: number;
  /**
   * The height at the moment of disappearance: the collapse runs from it.
   *
   * It is measured, because `height` does not interpolate from `auto`, and the height of a row
   * depends on the consumer's content: a list with a checkbox has one height, a list with an
   * avatar another, and the component cannot know it in advance.
   */
  height: number;
}

/**
 * The list together with the ghosts, each in its former place.
 *
 * Places are counted by the indexes of the disappearance, not by neighbors: the neighbors may
 * not be there at all, since a bulk action removes a dozen rows at once.
 */
function withLeaving(items: EditableListItem[], leaving: LeavingRow[]): EditableListItem[] {
  const merged = [...items];
  for (const row of [...leaving].sort((a, b) => a.index - b.index))
    merged.splice(Math.min(row.index, merged.length), 0, row.item);
  return merged;
}

/**
 * A list whose rows are edited in place, appended to from the bottom, and reordered by dragging.
 *
 * WHY THIS IS NOT A `SortableList` WITH A FIELD INSIDE: see ADR-0045.
 * In short: the add row is not an element of the `GridList` collection, and if you assemble
 * this by composition, moving focus into the add row and back has no owner. The keys inside a
 * row are also part of the contract, not styling.
 *
 * WHAT TO CHOOSE. If you only need an order, use `SortableList`: it is simpler, and its row
 * does not do anything extra. If you need a tree, use `TreeView`. If the order is computed from
 * a column value rather than assigned by a person, use `Table` and `DataTable`.
 *
 * STATE IS NOT STORED. The order and the values arrive as props and leave as a whole (ADR-0023);
 * only two drafts live inside: the edit draft and the add draft. A component that stored the
 * confirmed state would keep showing its own version after the server refused to save.
 *
 * KEYBOARD:
 *
 * - `↑`/`↓` move between rows, `→` moves focus to the drag handle, and `Enter` on the drag handle
 *   starts a move. All of this is provided by `GridList` (ADR-0028);
 * - `Enter` on a row opens the edit; a double-click does the same with the mouse;
 * - in the edit field, `Enter` confirms and `Escape` restores the previous value, and both return
 *   focus to the row; a click elsewhere confirms and does not take focus: the `InlineEdit`
 *   contract, carried over verbatim;
 * - `↓` from the last row moves into the add row, and `↑` from the add row returns to the last row;
 * - in the add row, `Enter` confirms and leaves the field open, so a series of tasks can be typed
 *   one after another. An empty confirmation creates nothing.
 *
 * WHILE A ROW IS BEING EDITED IT CANNOT BE DRAGGED: the handle is disabled, and the arrows belong
 * to the caret. Without a second `↑`/`↓` handler, the arrows from an open field would move
 * through the list. That handler is the reason the component was built this way, so it is
 * covered by a separate browser test.
 *
 * THE COMPONENT DOES NOT KNOW THE DOMAIN STATES. Striking through completed items, dimming
 * deferred ones, and the status badge are rendered by the consumer in `leading` and `trailing`.
 */
export const EditableList = forwardRef<EditableListHandle, EditableListProps>(function EditableList(
  {
    items,
    onReorder,
    onValueChange,
    editLabel,
    "aria-label": ariaLabel,
    add,
    leading,
    trailing,
    onRowAction,
    divided = false,
    emptyText,
    className,
  }: EditableListProps,
  ref
) {
  const messages = useMessages();

  const [editingId, setEditingId] = useState<Key | null>(null);
  const [leaving, setLeaving] = useState<LeavingRow[]>([]);

  const fieldRef = useRef<HTMLInputElement>(null);
  const addRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  // Escape exits the mode by itself, and the commit on focus loss must not fire right after it.
  const cancelling = useRef(false);
  // Returning focus is NOT always wanted: after a click elsewhere, taking focus back would pull
  // it away from where the user has just gone.
  const returnTo = useRef<Key | null>(null);
  /*
    THE DRAFTS LIVE IN THE FIELDS THEMSELVES, NOT IN STATE. This is not a saving on re-renders;
    it is the only way the edit works at all.

    `GridList` remounts the row's content on every render of the component. A draft in state
    would mean a render on every keystroke, and therefore a new field node, a repeated call of
    the callback ref, and a reset to the original value: the typed text would be erased in the
    middle of typing. Verified in a live browser, and it was visible only there, since jsdom
    behaves differently with collections.

    Hence the rule: while typing, the state does not change here. The component re-renders
    exactly at the transition into edit mode.
  */
  const openSeed = useRef("");

  /*
    ONE handle is exposed to the outside, not the input element itself.

    If the component handed out the `HTMLInputElement`, its markup would become a public contract:
    the consumer would start reading `value`, attaching handlers, and relying on the field being
    an `input` rather than, say, a pair of a field and a backdrop. A narrow handle says exactly
    what the caller needs: "put the caret where the person is about to type".

    Focus is set without `preventScroll`: if the add row is outside the visible area, the browser
    will bring it onto the screen itself. That default exists for exactly this reason, and there
    is no way to override it here.
  */
  useImperativeHandle(
    ref,
    () => ({
      focusAdd: (options) => {
        const node = addRef.current;
        if (node == null) return;
        node.focus();
        if (options?.select) node.select();
      },
    }),
    []
  );

  const editing = items.find((item) => item.id === editingId) ?? null;
  const last = items.length > 0 ? items[items.length - 1] : null;

  /*
    The row is found in the DOM by `data-key`, not through a map of refs.

    `GridListItem` does not pass the `ref` prop down to its element: verified in a live browser,
    where the map stayed empty and `Enter` on a row silently opened nothing. The attribute is set
    by react-aria itself, and the key handler needs it anyway, to know which row has focus.
  */
  const rowNode = (id: Key) =>
    listRef.current?.querySelector<HTMLElement>(`[data-key="${CSS.escape(String(id))}"]`) ?? null;

  const focusRow = (id: Key) => rowNode(id)?.focus();

  /*
    A ROW THAT HAS DISAPPEARED FROM `items` LIVES OUT ITS EXIT.

    The reasoning is the same as the one by which overlays got their exit in 3.23: a disappearance
    that happens in one frame reads as a failure. For a list row the cost is higher: it is not the
    only element that disappears. Neighbors close up instantly, and everything below jumps with
    them. A person marked a task as done, and the list under the cursor shifted with a jolt, so the
    next row ended up under the pointer before the person understood which one had gone.

    ONLY THE COMPONENT CAN HOLD A ROW. The row markup belongs to it: no node, no `ref`, and no
    class is exposed to the consumer. That leaves the consumer one option: pretend the record is
    still in the list. Then, for the duration of the exit, it remains a real row: drag-and-drop
    finds it, focus goes to it, a screen reader announces it, and `onReorder` returns its key in
    the new order.

    THE COMPARISON RUNS IN THE RENDER, NOT IN AN EFFECT. An effect fires after the commit, and by
    then the row is already gone from the DOM: it would vanish for a frame and come back as a
    ghost, which is exactly the flicker this exists to eliminate. Here the previous DOM is still
    in place, so it can be measured and asked about focus.
  */
  const shownItems = useRef(items);
  const focusFrom = useRef<number | null>(null);

  if (shownItems.current !== items) {
    const previous = shownItems.current;
    shownItems.current = items;
    const present = new Set(items.map((item) => String(item.id)));
    const gone: LeavingRow[] = [];
    /*
      The place is taken from the DOM, not from the index in the previous `items`.

      The previous array of ghosts does not know about a row that left a second ago: it is no
      longer counted there, and the indexes of the following rows are shifted by it. Two
      disappearances in a row at different places swapped their positions on the screen. The
      screen has the real order, so that is what we ask.
    */
    const shown = [...(listRef.current?.querySelectorAll<HTMLElement>("[data-key]") ?? [])];
    previous.forEach((item, fallbackIndex) => {
      if (present.has(String(item.id))) return;
      const node = rowNode(item.id);
      const index = node != null ? shown.indexOf(node) : fallbackIndex;
      /*
        Focus is asked about BEFORE the commit. After it, the row is already `inert`, the browser
        removes focus from it by itself, and there would be no way to tell whether it had been
        here: by then `document.activeElement` is `body`.

        The place is taken HERE from the previous `items`, not from the screen: the neighbor is
        later looked up in the new `items` by it, and a screen index that counts ghosts would point
        past the target, through the row that left.
      */
      if (node != null && node.contains(document.activeElement))
        focusFrom.current = Math.min(focusFrom.current ?? fallbackIndex, fallbackIndex);
      gone.push({
        item,
        index: index < 0 ? fallbackIndex : index,
        height: node?.offsetHeight ?? 0,
      });
    });
    /*
      A key that returns removes its ghost at once: two rows with the same `id` cannot exist in
      the collection, and "deleted and immediately restored" is a common undo case for the consumer.
    */
    const kept = leaving.filter((row) => !present.has(String(row.item.id)));
    if (gone.length > 0 || kept.length !== leaving.length) setLeaving([...kept, ...gone]);
  }

  const rows = leaving.length === 0 ? items : withLeaving(items, leaving);

  /*
    FOCUS MOVES FORWARD, rather than staying on the ghost: while `inert`, it would fall into
    `body`, and keyboard work with the list would break on every deletion.

    Forward means the row that has taken the place of the one that left: focus stays where it was.
    If there is none (the last row left), the previous row; if no rows remain at all, the add row.

    No dependency list: the effect fires at the commit where the row disappeared, and it is guarded
    by a ref, not by a comparison of props.
  */
  useLayoutEffect(() => {
    const from = focusFrom.current;
    if (from == null) return;
    focusFrom.current = null;
    const next = items[from] ?? items[items.length - 1];
    if (next != null) focusRow(next.id);
    else addRef.current?.focus();
  });

  const dropLeaving = (key: string) =>
    setLeaving((current) => current.filter((row) => String(row.item.id) !== key));

  /*
    A GHOST IS REMOVED AT THE END OF ITS ANIMATION, not by a timer set to the same duration: the timer
    would have to stay in sync with the scale, which means a second duration value outside `styles.css`.

    The listener is on the wrapper, not on the row: `animationend` bubbles up, and `GridListItem` does
    not expose its own animation handlers. And it is a REAL event, not a synthetic one: React's
    `onAnimationEnd` handler does not fire on this event in jsdom at all (verified), so without this
    the only way to test the exit outside a browser would be lost along with it.

    The second path covers the case where there is no animation at all: that happens in jsdom, and
    in a browser that has had motion turned off to the point where the rule did not apply. Without
    it, the row would stay on the screen forever.

    A FRAME IS REQUIRED HERE. `GridList` mounts the rows in a separate pass, later than our commit:
    at the moment of the effect the ghost's node is not there yet, and an empty answer from
    `getAnimations` would mean "not animated" for every leaving row. Verified in a live browser:
    without the frame, the exit did not start at all, and the row disappeared in the same frame as
    before the change.
  */
  useLayoutEffect(() => {
    if (leaving.length === 0) return;
    const node = listRef.current;
    const ids = new Set(leaving.map((row) => String(row.item.id)));

    const onAnimationEnd = (event: AnimationEvent) => {
      // The row's own animation, not someone else's: the consumer's slots may have an animation
      // of their own, and it bubbles up here too.
      const key = (event.target as HTMLElement | null)?.getAttribute?.("data-key");
      if (key != null && ids.has(key)) dropLeaving(key);
    };
    node?.addEventListener("animationend", onAnimationEnd);
    // `animationcancel` is not a precaution: any change to the consumer's row markup interrupts
    // the animation, and an interrupted one does not send `animationend`, so the ghost would stay
    // on the screen forever.
    node?.addEventListener("animationcancel", onAnimationEnd);

    const dropWhatDoesNotAnimate = () => {
      for (const key of ids)
        if ((rowNode(key)?.getAnimations?.().length ?? 0) === 0) dropLeaving(key);
    };
    const frame =
      typeof requestAnimationFrame === "function"
        ? requestAnimationFrame(dropWhatDoesNotAnimate)
        : (dropWhatDoesNotAnimate(), null);

    return () => {
      node?.removeEventListener("animationend", onAnimationEnd);
      node?.removeEventListener("animationcancel", onAnimationEnd);
      if (frame != null) cancelAnimationFrame(frame);
    };
  }, [leaving]);

  /*
    FOCUS IS SET IN THE CALLBACK REF, NOT IN AN EFFECT, and this too is a finding from a live browser,
    not a matter of taste.

    `GridList` mounts the row's content in a separate pass, later than its own commit: by the time
    `useLayoutEffect` runs, the field's ref is still empty, and focus went nowhere. The field opened,
    but it was not possible to type into it. The callback ref fires exactly when the node has appeared.

    The reference is stable within one edit (`useCallback` keyed on `editingId`); otherwise React would
    detach and reattach the ref on every typed character, and `select()` would reset the typed text.
  */
  const attachField = useCallback(
    (node: HTMLInputElement | null) => {
      fieldRef.current = node;
      if (node == null) return;
      cancelling.current = false;
      // The value is written into the DOM SYNCHRONOUSLY, before `select()`: `setDraft` is a render
      // request, not a write, and at the moment of selection the field would still hold the old text.
      node.value = openSeed.current;
      node.focus();
      node.select();
    },
    [editingId]
  );

  useLayoutEffect(() => {
    if (editing != null) return;
    if (returnTo.current == null) return;
    const id = returnTo.current;
    returnTo.current = null;
    focusRow(id);
    // The ONLY dependency is `editingId`: changing the value from outside while the field is open
    // must not overwrite the typed text. The effect fires on the transition of the mode, not on a
    // change of value: the same decision as in `InlineEdit`.
  }, [editingId]);

  const startEdit = (item: EditableListItem) => {
    if (item.disabled) return;
    openSeed.current = item.value;
    setEditingId(item.id);
  };

  const commit = (withFocus: boolean) => {
    if (!editing) return;
    const { id, value } = editing;
    // The typed text is read from the DOM: the component has no copy of its own.
    const next = fieldRef.current?.value ?? value;
    returnTo.current = withFocus ? id : null;
    setEditingId(null);
    if (next !== value) onValueChange(id, next);
  };

  const cancel = () => {
    if (!editing) return;
    cancelling.current = true;
    returnTo.current = editing.id;
    setEditingId(null);
  };

  /*
    ALL THE LIST'S KEYS ARE HANDLED HERE, IN ONE PLACE AND IN THE CAPTURE PHASE.

    This did not come from a love of a single handler; it came from a measurement in a live browser:
    `GridList` listens to the keys ITSELF and does so during capture, that is, before any handler on
    the field inside a row. A handler attached to the field ran only after the list had already moved
    focus: `↓` from an open field jumped to the next row instead of moving the caret. Preventing
    exactly this defect is what the component has to guarantee.

    The wrapper is an ancestor of the list, so its capture phase runs first: an event stopped here
    never reaches react-aria at all.
  */
  const handleListKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    // The field is recognized by its attribute, not by matching the ref: `GridList` remounts the
    // row's content, and a reference comparison occasionally missed. Escape went to the list, the
    // list moved focus, and the edit was confirmed on focus loss instead of being cancelled.
    const field = target.getAttribute("data-field");

    if (field === "edit") {
      // Everything is stopped, not only Enter and Escape: arrows, Space and letters belong to the
      // caret, and the list would take them for its own navigation and type-to-select.
      event.stopPropagation();
      if (event.key === "Enter") {
        event.preventDefault();
        commit(true);
      }
      if (event.key === "Escape") {
        event.preventDefault();
        cancel();
      }
      return;
    }

    if (field === "add") {
      event.stopPropagation();
      if (event.key === "Enter") {
        event.preventDefault();
        const value = (addRef.current?.value ?? "").trim();
        // An empty confirmation is not the creation of an empty row; it is the absence of input.
        if (value === "") return;
        // The field is cleared and STAYS open and focused: that is the whole difference from
        // `InlineEdit`, which closes on Enter.
        if (addRef.current != null) addRef.current.value = "";
        add?.onAdd(value);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        // The first Escape clears the draft, the second moves focus away: otherwise there would be no
        // way to leave the field from the keyboard, since it is always on the screen.
        if ((addRef.current?.value ?? "") !== "") {
          if (addRef.current != null) addRef.current.value = "";
          return;
        }
        if (last != null) focusRow(last.id);
        return;
      }
      if (event.key === "ArrowUp" && last != null) {
        // A single-line field does not need vertical arrows, and the list is above it.
        event.preventDefault();
        focusRow(last.id);
      }
      return;
    }

    /*
      THE KEYS BELOW BELONG TO THE ROW, NOT TO WHATEVER IS INSIDE IT.

      The target used to be found through `closest("[data-key]")`, so it fired on any descendant of
      the row. The first to match was the row's own move handle: `Enter` on it was stopped here and
      opened the edit, and it never reached react-aria, so a keyboard move never started, even though
      the reference promises it. Next, everything the consumer puts into `leading` and `trailing`
      was matched: `Enter` on the checkbox or the row's action buttons opened the edit instead of
      their own action.

      The row in focus is the row itself: `GridList` puts `data-key` on the row element, and
      `event.target` is equal to it. That is why the condition is strict.
    */
    const key = target.getAttribute("data-key");
    if (key == null) return;

    if (event.key === "Enter") {
      const item = items.find((candidate) => String(candidate.id) === key);
      if (item == null) return;
      event.preventDefault();
      event.stopPropagation();
      startEdit(item);
      return;
    }
    if (event.key === "ArrowDown" && add != null && last != null && key === String(last.id)) {
      event.preventDefault();
      event.stopPropagation();
      addRef.current?.focus();
    }
  };

  const { dragAndDropHooks } = useDragAndDrop({
    getItems: (keys) => [...keys].map((key) => ({ "text/plain": String(key) })),
    /*
      ONLY `move`, and this is not a cursor decoration.

      By default, both moving and copying are allowed, and the operating system draws a "plus" for
      copying: the person sees it in the middle of a reorder and expects the row to be duplicated.
      The list cannot copy a row and must not: it changes the order, not the set of items.

      IN WEBKIT THE ICON STILL FLICKERS, and it cannot be fixed from here.
      The setting does take effect: `effectAllowed` is written and read back as `move` in both engines,
      and react-aria additionally writes `dropEffect: move` on every `dragover`. But WebKit loses it at
      the level of the drag session and hands the drop target `all` (bugs.webkit.org/show_bug.cgi
      ?id=178058), and `all` includes copying, so the system draws the "plus" until it is talked out
      of it. The reorder itself is correct: react-aria keeps the real set of operations in its own
      variable and intersects it with what arrived, so after the drop there are as many rows as there
      were. The measurements for both engines are in the component's reference.
    */
    getAllowedDropOperations: () => ["move"],
    onReorder(event) {
      const next = reorder(items, event.keys, event.target);
      if (next != null) onReorder(next.map((item) => item.id));
    },
    renderDropIndicator: (target) => (
      <DropIndicator
        target={target}
        className="drop-target:bg-accent-strong rounded-pill h-0.5 bg-transparent"
      />
    ),
  });

  return (
    /*
      The key handler is on the WRAPPER, not on `GridList`: it does not accept DOM event props of its
      own. The wrapper is needed for the add row anyway, and the capture phase down to the list still
      passes through it.
    */
    <div
      ref={listRef}
      className={cn("flex flex-col", divided ? "gap-0" : "gap-0.5", className)}
      onKeyDownCapture={handleListKeyDown}
    >
      <GridList
        aria-label={ariaLabel}
        // Ghosts go into the collection on a par with the rows: their place in the sequence is real,
        // otherwise the exit would run somewhere other than where the row stood.
        items={rows}
        /*
          WITHOUT THIS, THE EDIT DOES NOT OPEN AT ALL: verified in a live browser.

          `GridList` builds the collection once and caches the rows by element: a change to external
          row state does not re-render it. `editingId` does not live in the element (and must not: it
          describes the mode, not the data), so it is declared as a dependency explicitly. The key
          handler, meanwhile, worked correctly; the defect would have been silent.
        */
        dependencies={[editingId, leaving]}
        dragAndDropHooks={dragAndDropHooks}
        renderEmptyState={emptyText != null ? () => emptyText : undefined}
        className={cn("flex flex-col", divided ? "gap-0" : "gap-0.5")}
      >
        {(item) => {
          const leavingRow = leaving.find((row) => row.item.id === item.id);
          const isLeaving = leavingRow != null;
          // A ghost is not editable: the field in a leaving row could take focus and would stay open
          // above an empty place.
          const isEditing = !isLeaving && item.id === editingId;
          return (
            <GridListItem
              id={item.id}
              /*
                THE LEAVING ROW IS DEAD IMMEDIATELY, not at the end of the animation.

                `inert` closes at once everything that would otherwise need to be closed one by one: the
                row takes no focus, does not respond to clicks, and does not appear in the accessibility
                tree. For a blind user, the record vanished at the moment of the action, and there is no
                reason to keep it for an extra 150 ms.
                `isDisabled` is added alongside not for decoration: `inert` does not know about the
                react-aria collection, and without it the arrows would keep counting the ghost as a stop
                on the way.
              */
              inert={isLeaving}
              isDisabled={isLeaving}
              /*
                The height is passed as a variable, not as a class: it differs for each row, and Tailwind
                classes are built at build time (see the ban on `` `h-[${n}px]` `` in `lib/variants.ts`).
              */
              style={
                isLeaving
                  ? ({ "--row-exit-h": `${leavingRow.height}px` } as CSSProperties)
                  : undefined
              }
              /*
                An empty value takes its name from a placeholder label rather than being left empty:
                react-aria answers a row without a name with a console warning, and a list with such a row
                looks working, yet type-to-select by the first letters cannot reach it.
              */
              textValue={
                item.textValue ??
                (item.value === "" ? messages.editableList.emptyValue : item.value)
              }
              onAction={onRowAction != null ? () => onRowAction(item.id) : undefined}
              /*
                In edit mode the row gives its vertical padding to the field: the field carries its own
                border and padding, and stacked together they made 44 pixels against 32 for the neighbors.
                The row jumped, and the whole list below it moved down with it.
              */
              className={cn(
                ROW_CLASS,
                divided && DIVIDED_ROW_CLASS,
                isEditing && "py-0",
                // `overflow-hidden` is part of the collapse: without it, the row's content would stick
                // out of the shrinking height.
                isLeaving && "animate-rowout overflow-hidden"
              )}
            >
              {/*
                The drag handle is part of the contract, not an option: without `<Button slot="drag">`,
                the row can be dragged with the mouse, cannot be picked up from the keyboard at all, and
                react-aria only writes a warning to the console (ADR-0028).

                THE CURSOR AND THE CLICK LIVE ON THE WRAPPER, NOT ON THE HANDLE ITSELF.

                react-aria forces `pointer-events: none` onto the move button: it needs it as a target for
                the keyboard and for screen readers, not as a pointer target. The consequence, which is easy
                to miss: `cursor-grab` on it was NEVER applied. Measured: `getComputedStyle` on the button
                honestly returns `grab`, but `elementFromPoint` at the center of six points returns the row
                itself with `cursor: auto`. So the only visible sign of "grab and drag here" was missing,
                although the source looked as if it was written.

                The wrapper catches the pointer, so the cursor is set on it.

                It also stops the click: through the button, which is disabled for the pointer, the click fell
                into the row and triggered its action, so a click on the handle did the same thing as a click
                on the row. What gets stopped is pointerdown, not click: react-aria calls the row's action from
                `usePress` on pointerup, before click. The move is not affected by this: it is driven by the
                native `draggable` on the row, which knows nothing about the bubbling of React's synthetic events.
              */}
              <span
                className={cn(
                  "flex shrink-0",
                  !(item.disabled || isEditing || isLeaving) && "cursor-grab"
                )}
                onPointerDownCapture={(event) => event.stopPropagation()}
              >
                <Button
                  slot="drag"
                  aria-label={messages.editableList.drag}
                  isDisabled={item.disabled || isEditing || isLeaving}
                  className={
                    "text-fg-3 hover:text-fg-1 focus-visible:outline-accent-strong flex size-5 shrink-0 " +
                    "items-center justify-center rounded-xs focus-visible:outline-2 " +
                    "disabled:opacity-30"
                  }
                >
                  <DragHandleIcon size={12} />
                </Button>
              </span>

              {leading?.(item)}

              {isEditing ? (
                <TextControl
                  ref={attachField}
                  data-field="edit"
                  className={FIELD_COMPACT_CLASS}
                  aria-label={editLabel(item)}
                  defaultValue={editing?.value ?? item.value}
                  onBlur={() => {
                    if (cancelling.current) {
                      cancelling.current = false;
                      return;
                    }
                    commit(false);
                  }}
                  shellClassName="w-full"
                />
              ) : (
                <span
                  onDoubleClick={() => startEdit(item)}
                  className={cn("min-w-0 flex-1 truncate", item.value === "" && "text-fg-3")}
                >
                  {item.value === "" ? messages.editableList.emptyValue : item.value}
                </span>
              )}

              {trailing?.(item)}
            </GridListItem>
          );
        }}
      </GridList>

      {add != null ? (
        <div className="flex items-center gap-1.5 px-1">
          {/*
            The add row is NOT a collection element: it has neither a key nor a place in the order, and
            there is nothing to drag. The drag handle's place is still occupied by an empty slot, otherwise
            the field would drift out of line with the row titles.
          */}
          <span aria-hidden className="size-5 shrink-0" />
          {/*
            The second leading column. The width of `leading` is set by the consumer, and the component
            cannot calculate it: measuring someone else's markup would mean reading the layout on every
            render and still missing on the first frame. So the one who created the column reports it.
          */}
          {add.leading}
          <TextControl
            ref={addRef}
            data-field="add"
            className={FIELD_COMPACT_CLASS}
            aria-label={add.label}
            placeholder={add.placeholder}
            aria-busy={add.pending}
            shellClassName="w-full"
          />
        </div>
      ) : null}
    </div>
  );
});
