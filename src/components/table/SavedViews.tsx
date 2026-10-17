"use client";

import type { ReactNode } from "react";
import { useMessages } from "../../i18n/useMessages.js";
import { cn } from "../../lib/cn.js";
import { Chip } from "../actions/Chip.js";

/**
 * A saved view: a name and a SNAPSHOT of the state, as the consumer provided it.
 *
 * The type is parameterized by the snapshot, not bound to `TableState`. This is the result of
 * reading the consumer's code, not a hedge for the future (ADR-0033). In the one known consumer,
 * `features/library/useFilters.js` in the front app, the state lives in the URL, and the screen is
 * not a table at all but a grid of cards. Binding to `TableState` would cut the only consumer off
 * from a component written for it.
 *
 * The kit does not look inside `state` and understands nothing in it: it stores it as an opaque
 * value and hands it back on selection. Comparing views with each other, computing "the current
 * view has changed", and serialization are the consumer's knowledge.
 */
export interface SavedView<T = unknown> {
  /** The view identifier: the key in the list and the value compared with `activeId`. */
  id: string;
  /** The view name; it is also the chip label. */
  name: ReactNode;
  /** The state snapshot. The kit does not read or interpret it. */
  state: T;
}

export interface SavedViewsProps<T = unknown> {
  /** The list of saved views; an empty list is not rendered at all. */
  views: SavedView<T>[];
  /**
   * Identifier of the active view. That view is highlighted and announced as pressed.
   *
   * `null` and `undefined` mean "no active view": the state that the consumer calls "the default
   * view", which is reached by resetting the URL.
   *
   * Returning to the default is done by a view that the consumer puts into the list itself: its
   * snapshot is the empty state. The kit does not introduce a concept of "reset" of its own,
   * because it does not know what is empty for the application.
   */
  activeId?: string | null;
  /**
   * Called when a view is selected. It receives the whole view, not its identifier: the consumer
   * must apply the snapshot in a single action.
   */
  onSelect: (view: SavedView<T>) => void;
  /** The accessible name of the group. If not set, the string is taken from the message catalog. */
  "aria-label"?: string;
  /** The class of the group container. */
  className?: string;
}

/**
 * A switcher for saved views: a set of named state snapshots.
 *
 * STORAGE IS NOT HERE AT ALL. The component writes nothing (not to `localStorage`, not to the
 * URL, not to the network) and subscribes to nothing. The model is the same as `useTableState`
 * (ADR-0023): the kit describes the shape, and the consumer owns the data. The choice between
 * the URL, local storage and a server stays with the application, and sharing views between
 * users is a backend concern altogether.
 *
 * The temptation here is stronger than usual: a "saved view" that saves nothing looks like
 * nonsense at first glance. It is not. The kit is responsible for how a view LOOKS AND SWITCHES,
 * not for where it is kept. The opposite would mean that a hook which deliberately stores nothing
 * acquires storage through a neighbor.
 *
 * Selecting a view hands over the whole snapshot in one call, and this is not a matter of style. At the
 * consumer, the state is carried in the URL, and sequential writes by key build the URL from the
 * same snapshot of the current render: the last write wins, and the edits of the previous ones
 * are lost. That is exactly how the lower bound of a date range was lost in the front app when a
 * range was selected on top of a preset, and it is why `setMany` exists there. A component that
 * applies a view key by key would reproduce the same defect for every consumer.
 *
 * THE ACTIVE VIEW IS ANNOUNCED, not just highlighted: `Chip` carries `aria-pressed`. Color
 * highlighting is not a message for a screen reader, and it is the same defect that was fixed
 * in `Segmented` and in the theme switcher.
 *
 * WHAT STAYS WITH THE CONSUMER besides storage: creating, renaming and deleting a view, the domain
 * keys inside the snapshot, and the rules for parsing them. Nothing domain-specific from the
 * screen that was read came into the kit: neither the mapping of sort names to backend fields,
 * nor the product filter keys, nor the server's time zone.
 */
export function SavedViews<T = unknown>({
  views,
  activeId,
  onSelect,
  "aria-label": ariaLabel,
  className,
}: SavedViewsProps<T>) {
  const messages = useMessages();

  // An empty list is not rendered at all: an empty group would announce itself to a screen
  // reader with nothing inside. The same approach as in `Timeline`.
  if (views.length === 0) return null;

  return (
    <div
      role="group"
      aria-label={ariaLabel ?? messages.savedViews.label}
      className={cn("flex flex-wrap items-center gap-1.5", className)}
    >
      {views.map((view) => (
        <Chip
          key={view.id}
          selected={view.id === activeId}
          // The whole view, not `view.id`: the consumer must receive the snapshot and apply it in
          // a single action (see the doc comment above).
          onClick={() => onSelect(view)}
        >
          {view.name}
        </Chip>
      ))}
    </div>
  );
}
