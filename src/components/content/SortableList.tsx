"use client";

import type { ReactNode } from "react";
import {
  Button,
  DropIndicator,
  GridList,
  GridListItem,
  isTextDropItem,
  useDragAndDrop,
  type DropItem,
  type ItemDropTarget,
  type Key,
} from "react-aria-components";
import { DragHandleIcon } from "../../icons.js";
import { useMessages } from "../../i18n/useMessages.js";
import { cn } from "../../lib/cn.js";
import { insertionIndex, reorder } from "../../lib/reorder.js";

export interface SortableItem {
  /** Stable identifier of the row: the list reports the new order by it. */
  id: Key;
  /** Row content. It may be markup, in which case set `textValue`. */
  label: ReactNode;
  /**
   * String representation of the row.
   *
   * Required when `label` is not a string: from it the row's accessible name is built, as well as
   * the name of its drag handle ("Drag Report for March") and the announcements ("Insert between
   * … and …").
   */
  textValue?: string;
}

/** A row moving from one list of a group to another: what `onMove` reports. */
export interface SortableMove {
  /** Row identifier. */
  id: Key;
  /** `id` of the list the row was moved out of. */
  from: string;
  /** `id` of the list the row was moved into. */
  to: string;
  /** Position in the receiving list: the index the row takes there. */
  index: number;
}

export interface SortableListProps {
  /** Rows in their current order; the consumer owns the order. */
  items: SortableItem[];
  /**
   * The whole new order: the list of identifiers after the reordering.
   *
   * The component does not store the order: it arrives as a prop and leaves through here, like
   * table sorting does (ADR-0023). We pass the whole list, not "what moved where": applying a
   * ready-made order is simpler than rebuilding it from an event, and there is no room for
   * mistakes.
   */
  onReorder: (ids: Key[]) => void;
  /**
   * Accessible name of the list. A list without a name is announced by a screen reader
   * only by its role.
   */
  "aria-label": string;
  /** What to show for an empty list. */
  emptyText?: ReactNode;
  /** Classes for the root element. */
  className?: string;
  /**
   * Name of the group of lists that exchange rows, for example the columns of one board.
   * Without a group, the list only reorders its own rows.
   */
  group?: string;
  /**
   * The name of the list inside the group: `onMove` receives it in `from` and `to`. It does not
   * reach the DOM: it is a key of the screen's state, not the `id` of an element.
   */
  id?: string;
  /**
   * Called on the receiving list when a row from another list of the group is moved into it.
   *
   * The component does not store the membership of the lists, any more than the order: the screen
   * removes the row from `from` and puts it into `to` at `index`, updating both lists at once,
   * because the board has one state and the screen holds it.
   */
  onMove?: (move: SortableMove) => void;
}

/** Drag data type of the group: a foreign group will not accept it. */
const dragType = (group: string) => `application/x-olddevs-sortable+${group}`;

/** Rows brought in from another list of the group, one entry each, in drop order. */
async function readMoves(items: DropItem[], type: string): Promise<{ id: Key; from: string }[]> {
  const texts = await Promise.all(items.filter(isTextDropItem).map((item) => item.getText(type)));
  return texts.map((text) => JSON.parse(text) as { id: Key; from: string });
}

/**
 * A list with drag and drop: the user sets the order.
 *
 * BUILT ON `useDragAndDrop` FROM react-aria, not on a third-party library (ADR-0028). This is not
 * about saving a dependency: with dnd-kit we would have to take on accessibility as well, which
 * react-aria provides for free.
 *
 * THE DRAG HANDLE IS REQUIRED, and it is not decoration here. Without `<Button slot="drag">` a row
 * gets `draggable="true"` and can be dragged with a mouse, but from the keyboard it cannot be
 * picked up at all, and react-aria does not fail: it writes a warning to the console. So an
 * inaccessible list looks like it works. The component renders the handle itself rather than leaving
 * it to the consumer's discretion; this was measured before the decision.
 *
 * THERE IS NO LIVE REGION OF ITS OWN. react-aria announces the drag itself, and localized: under
 * the Russian locale the measurement produced "Drag started. Press Tab to select a drop target…",
 * "Insert between Row 1 and Row 2", "Drag completed". A region of our own would duplicate these and
 * contradict them. `DragAnnouncer` is not brought over from the frontend: it was written for
 * dnd-kit, which stays silent.
 *
 * THE NAME OF THE HANDLE DOES NOT REPEAT THE ROW'S LABEL: the library appends the label itself, and
 * the measurement showed "Drag Row 1". The same lesson as with buttons inside `TagGroup` in the
 * 2.1.0 review.
 *
 * KEYBOARD: the right arrow moves focus from the row to the handle, Enter starts the drag, the
 * arrows select the target, Enter applies, Escape cancels. The react-aria announcement suggests
 * Tab, but in a short list Tab moves focus out of the ring of drop targets and cancels the drag,
 * as checked in the browser. All of this is the behavior layer, not our code.
 */
export function SortableList({
  items,
  onReorder,
  "aria-label": ariaLabel,
  emptyText,
  className,
  group,
  id: listId = "",
  onMove,
}: SortableListProps) {
  const messages = useMessages();
  const type = group != null ? dragType(group) : null;

  /*
    MOVING BETWEEN LISTS uses `onInsert` and `onRootDrop` from react-aria, not a custom mechanism:
    the keyboard (Tab leads to the lists of the group), the announcements
    "Insert between … and …" and the drop position are the same as for reordering.

    A row carries its own key and the name of its source list in the group's data type. A list
    accepts only this type: a row from a foreign group, like a file dragged from the desktop, it
    will not take.
  */
  async function receive(dropped: DropItem[], target: ItemDropTarget | null) {
    if (type == null || onMove == null) return;
    const index = insertionIndex(items, target);
    if (index == null) return;
    const moves = await readMoves(dropped, type);
    moves.forEach((move, i) =>
      onMove({ id: move.id, from: move.from, to: listId, index: index + i })
    );
  }

  const { dragAndDropHooks } = useDragAndDrop({
    getItems: (keys) =>
      [...keys].map((key) => ({
        "text/plain": String(key),
        ...(type != null && { [type]: JSON.stringify({ id: key, from: listId }) }),
      })),
    /*
      Only a list with `onMove` accepts rows from the group: without it, a drop would show the
      insertion point and silently do nothing. A list in a group can hand out its rows even without
      `onMove`, see `getItems` above.
    */
    ...(type != null &&
      onMove != null && {
        acceptedDragTypes: [type],
        onInsert: (e) => receive(e.items, e.target),
        onRootDrop: (e) => receive(e.items, null),
      }),
    /*
      ONLY `move`, and this is not cosmetic for the cursor.

      By default both moving and copying are allowed, and the operating system draws a "plus" for
      copying: the user sees it in the middle of a reordering and expects the row to be duplicated.
      The list cannot copy a row and must not: it changes the order, not the set of rows.

      IN WEBKIT THE ICON FLICKERS ANYWAY, and it cannot be fixed from here. The setting does apply:
      `effectAllowed` is written and read back as `move` in both engines, and react-aria also writes
      `dropEffect: move` on every `dragover`. But WebKit loses it at the drag-session level and
      hands the receiver `all` (bugs.webkit.org/show_bug.cgi?id=178058), and `all` enables copying,
      so the system draws the "plus" until it is talked out of it. The reordering itself stays correct:
      react-aria keeps the real set of operations in its own variable and intersects it with what
      arrived, so after a drop there are as many rows as there were. The measurement in both engines
      is in the component's Reference.
    */
    getAllowedDropOperations: () => ["move"],
    onReorder(e) {
      // Reordering is a pure function in `lib/reorder.ts`, tested on arrays, including a drop
      // "onto itself": there the last element used to be lost. `null` means the drop changes
      // nothing, and nothing is sent out.
      const next = reorder(items, e.keys, e.target);
      if (next != null) onReorder(next.map((item) => item.id));
    },
    renderDropIndicator: (target) => (
      // The insertion point is SEEN, not just announced: when dragging with a mouse, the user
      // otherwise does not know where the row will land.
      <DropIndicator
        target={target}
        className="drop-target:bg-accent-strong rounded-pill h-0.5 bg-transparent"
      />
    ),
  });

  return (
    <GridList
      aria-label={ariaLabel}
      items={items}
      dragAndDropHooks={dragAndDropHooks}
      renderEmptyState={emptyText != null ? () => emptyText : undefined}
      className={cn("flex flex-col gap-1", className)}
    >
      {(item) => (
        <GridListItem
          id={item.id}
          textValue={item.textValue ?? (typeof item.label === "string" ? item.label : undefined)}
          className={cn(
            "border-line-soft bg-bg-2 flex items-center gap-2 rounded-lg border px-2.5 py-2 text-[13px]",
            "focus-visible:outline-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2",
            // The row under the drag cursor is dimmed: it is not in its place right now, and
            // showing it as normal would be misleading.
            "dragging:opacity-50"
          )}
        >
          {/*
            The drag handle. Its name is only the verb: the library appends the row's label itself,
            and "Drag Report Report" would be read out twice.
          */}
          <Button
            slot="drag"
            aria-label={messages.sortableList.drag}
            className="text-fg-3 hover:text-fg-1 focus-visible:outline-accent-strong flex size-6 shrink-0 cursor-grab items-center justify-center rounded-xs focus-visible:outline-2"
          >
            <DragHandleIcon size={14} />
          </Button>
          <span className="min-w-0 flex-1">{item.label}</span>
        </GridListItem>
      )}
    </GridList>
  );
}
