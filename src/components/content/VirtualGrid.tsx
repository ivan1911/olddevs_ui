"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
  type RefObject,
  type SyntheticEvent,
} from "react";
import {
  Collection,
  GridLayout,
  GridList,
  GridListItem,
  GridListLoadMoreItem,
  Rect,
  Size,
  Virtualizer,
  type Key,
  type LayoutInfo,
  type Selection,
} from "react-aria-components";
import { cn } from "../../lib/cn.js";
import { devWarn } from "../../lib/dev-warn.js";
import { toPixels } from "../../hooks/useStickyOffset.js";
import { Spinner } from "../actions/Spinner.js";
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from "../overlays/ContextMenu.js";
import { useDragToSelect } from "./useDragToSelect.js";

export interface VirtualGridItem {
  /** Cell identifier: the selection key. */
  id: Key;
  /**
   * The cell content: any node, usually a `MediaCard`. Buttons inside are allowed:
   * the cell is a `gridcell`. The selection checkbox, `<Checkbox slot="selection" />`,
   * is wired to the selection by the grid itself.
   */
  content: ReactNode;
  /**
   * The text form of the cell: keyboard type-ahead search works on it. Required,
   * because the content is markup, not text.
   */
  textValue: string;
  /**
   * Items of the cell's context menu: `ContextMenuItem`, `ContextMenuSeparator`,
   * `ContextMenuSub`, and the rest of the `ContextMenu` family. The grid adds the panel,
   * the trigger and the isolation from selection itself. Without this field, a cell has
   * no menu.
   *
   * It opens with the right mouse button, a long press, or the keyboard: Shift+F10 or the
   * context menu key on the focused cell.
   */
  contextMenu?: ReactNode;
}

/** What the grid reports about the cell that was opened. */
export interface VirtualGridActionDetails {
  /**
   * The cell's rectangle in viewport coordinates at the moment of the action, for the
   * "open from the spot" animation (the card grows out of its preview).
   */
  rect: DOMRect;
}

export interface VirtualGridProps {
  /** The grid's cells. */
  items: VirtualGridItem[];
  /** Accessible name of the grid. Without one, a screen reader announces the grid by its role only. */
  "aria-label": string;
  /**
   * Minimum cell width in pixels. The column count is derived from it.
   *
   * Numbers, not the react-aria `Size` class: a third-party class in the kit's public API
   * would force the consumer to import it just for two numbers.
   */
  minItemWidth?: number;
  /**
   * Minimum cell height in pixels. Defaults to 180. A cell with taller content grows;
   * it never gets shorter.
   */
  minItemHeight?: number;
  /** Gap between cells, in pixels. */
  gap?: number;
  /**
   * Padding at the grid's edges, equal to `gap`. On by default; `false` puts the edge cells
   * flush against the edges: a "1fr without margins" grid.
   */
  edgeGap?: boolean;
  /** Upper limit on the number of columns. Without it, as many columns as fit. */
  maxColumns?: number;
  /** What to show when the grid is empty. */
  emptyText?: ReactNode;
  /**
   * What scrolls: the grid's own container (`container`, the default) or the window.
   *
   * `container`: the consumer sets the height (`h-[600px]`, or `flex-1` in a column).
   * Without it, the container grows with its content and never scrolls.
   * `window`: the grid grows with its content and the page scrolls; the DOM still holds
   * only the cells near the viewport.
   */
  scroll?: "container" | "window";
  /**
   * CSS variable with the height of the sticky header, the same one that `SelectionBar` and
   * `useStickyOffset` use. In `window` mode, a cell that focus moved to is not hidden under
   * the header. Defaults to `--topbar-h`, which `TopBar` publishes.
   */
  offsetVar?: string;
  /**
   * The selection axis. Enabled explicitly, and it lives on the grid itself, not inside a cell.
   *
   * A selection checkbox inside a cell, `<Checkbox slot="selection" />`, is part of the same
   * axis, not a state of its own on the card.
   */
  selectionMode?: "none" | "single" | "multiple";
  /**
   * How a click treats the selection: the react-aria rule.
   *
   * `toggle` (the default): a click adds or removes the cell; with `onAction`, a click
   * opens and Space selects. `replace`: as in a file manager, a click selects one cell,
   * Ctrl/Cmd adds to the selection, and double-click or Enter opens.
   */
  selectionBehavior?: "toggle" | "replace";
  /**
   * What a Shift range (click, arrows) does. `replace`: the react-aria rule, the set is
   * replaced by the range from the anchor, and whatever is selected outside it is cleared.
   * `add`: the range is added to the previous selection, and nothing is cleared.
   */
  rangeSelection?: "replace" | "add";
  /**
   * Drag-to-select by finger: hold a cell and drag over the neighboring ones. They are added
   * as a range, and the grid scrolls itself at the edge of the viewport. Touch only, and only
   * with `selectionMode="multiple"`.
   *
   * The gesture is not the only way to the same result: the selection checkbox and Shift with
   * the arrows give it with a mouse and a keyboard.
   */
  dragToSelect?: boolean;
  /** Selected keys. The consumer holds the state; the kit provides the shape (ADR-0023). */
  selectedKeys?: Selection;
  /** Called with the new set of selected cells. */
  onSelectionChange?: (keys: Selection) => void;
  /**
   * The action on a cell: click, Enter, or touch. It receives the cell's `id` and its
   * rectangle.
   *
   * This is "open", not "select": the cell is not selected, and `onSelectionChange` stays
   * silent. Together with `selectionMode`, both fire by the react-aria rules; see the
   * component page.
   */
  onAction?: (id: Key, details: VirtualGridActionDetails) => void;
  /**
   * Loading the next page: called when less than a viewport height is left before the end of
   * the loaded cells. Without this prop, the grid loads nothing.
   */
  onLoadMore?: () => void;
  /** Loading is in progress: an indicator is shown below the last row. */
  isLoadingMore?: boolean;
  /** A custom loading indicator instead of the kit's spinner, for example a row of skeletons. */
  loadingMore?: ReactNode;
  /**
   * Container classes. In `container` mode, the consumer sets the height; see the section on
   * scrolling.
   */
  className?: string;
}

/**
 * `GridLayout` without the outer gap: the edge cells sit flush against the edges.
 *
 * The react-aria layout puts a gap outside as well, on the left, right, and top, and there is
 * no option that removes it. Its fields (`layoutInfos`, `margin`) are private, so the subclass
 * does not recompute the layout. It maps the finished rectangles in the public methods instead:
 * a column stays a column, and the cell width grows by the share of the two removed edge gaps.
 */
class EdgeToEdgeGridLayout<T = unknown> extends GridLayout<T> {
  /**
   * The requested gap (`minSpace`), not the one the react-aria layout set itself. It subtracts
   * the gaps from the width by the column count and places one more, rounding down, so its gap
   * comes out smaller than requested (measured for react-aria: 16 instead of 18). There are no
   * outer gaps to be flush against, so the requested gap always fits.
   */
  private requestedGap: number | null = null;

  /**
   * The column count for the flush layout. react-aria counts them as
   * `floor(width / (min + gap))`, leaving room for an outer gap that this layout does not have,
   * so it loses a column: on a phone (343 px, min 160, gap 18) it gave one column instead of two,
   * as the CSS grid `minmax(160px, 1fr)` does. Here the count is `floor((width + gap) / (min + gap))`,
   * and the react-aria layout is given the smallest source width at which its own count gives the
   * same number. `flush` still places the cell itself, wider by the share of the removed edge gaps.
   */
  override update(invalidationContext: Parameters<GridLayout<T>["update"]>[0]) {
    const options = invalidationContext.layoutOptions;
    const gap = options?.minSpace?.width ?? null;
    const minItem = options?.minItemSize;
    const width = this.virtualizer?.size.width ?? 0;
    this.requestedGap = gap;
    if (!options || !minItem || gap == null || width <= 0) {
      super.update(invalidationContext);
      return;
    }
    const fit = Math.floor((width + gap) / (minItem.width + gap));
    const columns = Math.max(1, Math.min(options.maxColumns ?? Infinity, fit));
    const sourceMin = Math.max(1, Math.floor(width / columns) - gap);
    super.update({
      ...invalidationContext,
      layoutOptions: { ...options, minItemSize: new Size(sourceMin, minItem.height) },
    });
  }

  /** The cell width and the column step in the source layout and in the flush one. */
  private columns() {
    const width = this.virtualizer?.size.width ?? 0;
    const columns = Math.max(1, this.numColumns);
    // The step of the source layout uses its own gap: the cell finds its column by it.
    // The cell itself is placed with the requested gap.
    const sourceGap = this.gap.width;
    const gap = this.requestedGap ?? sourceGap;
    const first = this.firstItemRect();
    const itemWidth = Math.max(0, Math.floor((width - (columns - 1) * gap) / columns));
    return { width, gap, sourceGap, first, itemWidth };
  }

  private firstItemRect(): Rect | null {
    const key = this.virtualizer?.collection.getFirstKey();
    return key == null ? null : (super.getLayoutInfo(key)?.rect ?? null);
  }

  private flush(info: LayoutInfo | null): LayoutInfo | null {
    if (!info) return info;
    const { width, gap, sourceGap, first, itemWidth } = this.columns();
    const copy = info.copy();
    const y = info.rect.y - this.gap.height;
    if (info.type === "loader") {
      copy.rect = new Rect(0, y, width, info.rect.height);
      return copy;
    }
    const step = first ? first.width + sourceGap : 1;
    const column = first ? Math.round((info.rect.x - first.x) / step) : 0;
    copy.rect = new Rect(column * (itemWidth + gap), y, itemWidth, info.rect.height);
    return copy;
  }

  override getLayoutInfo(key: Key): LayoutInfo | null {
    return this.flush(super.getLayoutInfo(key));
  }

  override getVisibleLayoutInfos(rect: Rect): LayoutInfo[] {
    const query = new Rect(rect.x, rect.y + this.gap.height, rect.width, rect.height);
    return super
      .getVisibleLayoutInfos(query)
      .map((info) => this.flush(info))
      .filter((info): info is LayoutInfo => info != null);
  }

  override getContentSize(): Size {
    const size = super.getContentSize();
    // The top gap is removed; the bottom one only when the last item is a row of cells.
    // The loading row sits AFTER the trailing gap and moves up by one gap together with
    // everything else: remove one more and it would be clipped at the bottom.
    const collection = this.virtualizer?.collection;
    const lastKey = collection?.getLastKey();
    const loaderLast = lastKey != null && collection?.getItem(lastKey)?.type === "loader";
    const removed = (loaderLast ? 1 : 2) * this.gap.height;
    return new Size(size.width, Math.max(0, size.height - removed));
  }
}

/** react-aria selection: a `Set` of keys, with the anchor and the current key of the Shift range. */
type RangeSelection = Set<Key> & { anchorKey?: Key | null; currentKey?: Key | null };
type RangeSelectionClass = new (
  keys: Iterable<Key>,
  anchorKey?: Key | null,
  currentKey?: Key | null
) => Set<Key>;

/**
 * Merges the previous selection with the react-aria range, keeping the range's ANCHOR.
 *
 * react-aria keeps the anchor and the current key of the Shift range on the selection object
 * itself (`Selection` from react-stately, a subclass of `Set`), and carries them over to its state
 * only when it gets an instance of that class. Merging into a plain `Set` lost the anchor: a second
 * Shift+click in a row selected one cell instead of the range from the anchor. The class is not
 * public, and react-stately is not a dependency of the kit, so the constructor is taken from `next`,
 * the instance that react-aria has just passed to `onSelectionChange`.
 */
function unionKeepingAnchor(previous: Set<Key>, next: Set<Key>): Set<Key> {
  const range = next as RangeSelection;
  const Ctor = next.constructor as RangeSelectionClass;
  return new Ctor([...previous, ...next], range.anchorKey, range.currentKey);
}

/**
 * A card grid with virtualization: only the visible cells live in the DOM.
 *
 * It is built on `Virtualizer` and `GridLayout` from react-aria, not on `@tanstack/react-virtual`
 * (ADR-0028). Measured before the decision: 300 cells gave 27 nodes in the DOM, and after scrolling
 * 4000 pixels the first rendered one was the 129th.
 *
 * TWO SCROLL MODES. `container` (the default) scrolls its own container, and the consumer sets its
 * height. `window` scrolls the page: react-aria 1.21's `Virtualizer` intersects its own area with
 * the window itself and keeps only the cells in the viewport in the DOM. The sticky header is served
 * by `scroll-margin-top` on the cells, from the same variable as `SelectionBar`: without it, an arrow
 * key that moved focus above the top of the window put the cell under the header. The mode used to
 * be single, and here it said "without a height, virtualization will not turn on". For react-aria
 * 1.21 that is no longer true.
 *
 * THE CELL IS A `gridcell`, NOT AN `option`. The grid is built on `GridList` (it used to be
 * `ListBox`): buttons inside an `option` gave nested interactive content at the serious level, while
 * in a `gridcell` they are allowed. Selection is an axis of the grid; the selection checkbox is
 * `Checkbox slot="selection"` inside the cell.
 *
 * THE LAYOUT COUNTS THE COLUMNS, not `matchMedia` or `ResizeObserver` in our code: `GridLayout` takes
 * the container width and the minimum cell size. Roles (`grid`/`row`/`gridcell`), the keyboard, and
 * type-ahead search are also part of the behavior layer.
 *
 * THERE IS NO DRAGGING HERE. Virtualization and sorting together are not verified in the kit; the grid
 * will get dragging through the same `useDragAndDrop` when a requesting screen appears (ADR-0027).
 * Dragging a finger (`dragToSelect`) is selection, not moving.
 */
export function VirtualGrid({
  items,
  "aria-label": ariaLabel,
  minItemWidth = 180,
  minItemHeight = 180,
  gap = 12,
  edgeGap = true,
  maxColumns,
  emptyText,
  scroll = "container",
  offsetVar = "--topbar-h",
  selectionMode = "none",
  selectionBehavior,
  rangeSelection = "replace",
  dragToSelect = false,
  selectedKeys,
  onSelectionChange,
  onAction,
  onLoadMore,
  isLoadingMore = false,
  loadingMore,
  className,
}: VirtualGridProps) {
  if (dragToSelect && selectionMode !== "multiple") {
    devWarn(
      'VirtualGrid: `dragToSelect` needs selectionMode="multiple" — a drag adds a range of ' +
        "cells, and the grid has no multiple selection to add it to. The gesture is off. " +
        'Pass selectionMode="multiple" or drop `dragToSelect`.'
    );
  }

  const gridRef = useRef<HTMLDivElement>(null);

  // `Size` is a react-aria class, and a new instance on every render would make the layout
  // recompute for nothing.
  const layoutOptions = useMemo(
    () => ({
      minItemSize: new Size(minItemWidth, minItemHeight),
      minSpace: new Size(gap, gap),
      ...(maxColumns != null ? { maxColumns } : {}),
    }),
    [minItemWidth, minItemHeight, gap, maxColumns]
  );

  /*
    The Shift range in `add` mode. react-aria replaces the set with the range from the anchor;
    here the new set is merged with what was there before the press. The Shift flag is caught
    in the capture phase, before react-aria handles the event and reports the new set.
  */
  const shiftRef = useRef(false);
  const lastSelectionRef = useRef<Selection | undefined>(selectedKeys);
  lastSelectionRef.current = selectedKeys ?? lastSelectionRef.current;

  const emitSelection = useCallback(
    (next: Selection) => {
      let keys = next;
      const previous = lastSelectionRef.current;
      if (
        rangeSelection === "add" &&
        shiftRef.current &&
        next !== "all" &&
        previous != null &&
        previous !== "all"
      ) {
        keys = unionKeepingAnchor(previous, next);
      }
      // The flag covers one event: otherwise it would stick until the next press, and a change
      // of selection without a key (from outside, with a checkbox) would be merged as a range.
      shiftRef.current = false;
      lastSelectionRef.current = keys;
      onSelectionChange?.(keys);
    },
    [rangeSelection, onSelectionChange]
  );

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid || rangeSelection !== "add") return;
    const remember = (event: KeyboardEvent | PointerEvent) => {
      shiftRef.current = event.shiftKey;
    };
    grid.addEventListener("keydown", remember, true);
    grid.addEventListener("pointerdown", remember, true);
    return () => {
      grid.removeEventListener("keydown", remember, true);
      grid.removeEventListener("pointerdown", remember, true);
    };
  }, [rangeSelection]);

  /*
    The sticky header in window mode. react-aria scrolls to the focused cell only when that cell is
    entirely outside the viewport, and it does not know about `scroll-margin`: a cell that an arrow
    key moved focus to, and which is visible only by its lower part, stayed under the header
    (measured: top at 48 px with a 56 px header). Here the window scrolls the missing part, and only
    for keyboard focus: a click on a partly visible cell does not jerk the page.
  */
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid || scroll !== "window") return;
    const onFocusIn = (event: FocusEvent) => {
      const row = (event.target as HTMLElement | null)?.closest<HTMLElement>('[role="row"]');
      if (!row || !row.matches(":focus-visible")) return;
      const raw = getComputedStyle(document.documentElement).getPropertyValue(offsetVar).trim();
      const offset = Number.parseFloat(toPixels(raw, "0px")) || 0;
      const top = row.getBoundingClientRect().top;
      if (top < offset) window.scrollBy(0, top - offset);
    };
    grid.addEventListener("focusin", onFocusIn);
    return () => grid.removeEventListener("focusin", onFocusIn);
  }, [scroll, offsetVar]);

  const order = useMemo(() => items.map((item) => item.id), [items]);
  useDragToSelect(gridRef, {
    enabled: dragToSelect && selectionMode === "multiple",
    order,
    scroll,
    offsetVar,
    selection: () => lastSelectionRef.current ?? new Set<Key>(),
    onChange: (keys) => {
      lastSelectionRef.current = keys;
      onSelectionChange?.(keys);
    },
  });

  const handleAction = useMemo(() => {
    if (!onAction) return undefined;
    return (key: Key) => {
      const row = Array.from(
        gridRef.current?.querySelectorAll<HTMLElement>('[role="row"]') ?? []
      ).find((element) => element.dataset.key === String(key));
      onAction(key, { rect: row?.getBoundingClientRect() ?? new DOMRect() });
    };
  }, [onAction]);

  /*
    Whether react-aria selects a cell on a long press right now: the same condition as in
    `useSelectableItem`. There is a selection and an action, and the action is either primary
    (the selection is empty, with `toggle`) or secondary (`replace`). Only then does a cell with a
    menu suppress that long press. Otherwise the long press is off in react-aria, and cancelling
    it would take a slow tap's press away.
  */
  const longPressSelectsRef = useRef(false);
  const currentSelection = selectedKeys ?? lastSelectionRef.current;
  const selectionEmpty =
    currentSelection == null || (currentSelection !== "all" && currentSelection.size === 0);
  longPressSelectsRef.current =
    selectionMode !== "none" &&
    onAction != null &&
    (selectionBehavior === "replace" || selectionEmpty);

  const rowStyle = scroll === "window" ? { scrollMarginTop: `var(${offsetVar}, 0px)` } : undefined;

  return (
    <Virtualizer layout={edgeGap ? GridLayout : EdgeToEdgeGridLayout} layoutOptions={layoutOptions}>
      <GridList
        ref={gridRef}
        aria-label={ariaLabel}
        layout="grid"
        selectionMode={selectionMode}
        {...(selectionBehavior != null ? { selectionBehavior } : {})}
        selectedKeys={selectedKeys}
        onSelectionChange={emitSelection}
        onAction={handleAction}
        renderEmptyState={emptyText != null ? () => emptyText : undefined}
        // Scrolling is the grid's own only in `container` mode: without `overflow-auto` and a set
        // height there is nothing to scroll.
        className={cn(scroll === "container" && "overflow-auto", "outline-none", className)}
      >
        <Collection items={items}>
          {(item) => (
            <GridListItem
              id={item.id}
              textValue={item.textValue}
              style={rowStyle}
              className="focus-visible:outline-accent-strong rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              {/* react-aria's `gridcell` is `display: contents`: the wrapper holds the height. */}
              {/* The wrapper is a one-row grid, not a block with `min-height`: a percentage height
                  of a nested node (`h-full`) is not computed from `min-height` and collapses to the
                  content, but it is computed from a grid row. `items-start` keeps the cell at its
                  natural height, without `h-full`. */}
              <div
                className="grid h-full grid-cols-1 items-start"
                style={{
                  minHeight: minItemHeight,
                  gridTemplateRows: `minmax(${minItemHeight}px, 1fr)`,
                }}
              >
                {item.contextMenu != null ? (
                  <CellContextMenu
                    menu={item.contextMenu}
                    longPressSelectsRef={longPressSelectsRef}
                  >
                    {item.content}
                  </CellContextMenu>
                ) : (
                  item.content
                )}
              </div>
            </GridListItem>
          )}
        </Collection>
        {onLoadMore != null && (
          <GridListLoadMoreItem
            isLoading={isLoadingMore}
            // In window mode the sentinel is our own (below): the react-aria sentinel's root is the
            // nearest scrollable ancestor, which is often `body` with `overflow: auto` at the full page
            // height. Such a sentinel always "sees" the end, and the grid kept loading pages one after
            // another until the data ran out (that happened in Storybook: 1200 of 1200 without scrolling).
            onLoadMore={scroll === "container" ? onLoadMore : undefined}
          >
            <div className="flex h-full items-center justify-center">
              {loadingMore ?? <Spinner />}
            </div>
          </GridListLoadMoreItem>
        )}
      </GridList>
      {scroll === "window" && onLoadMore != null && (
        <WindowLoadMoreSentinel onLoadMore={onLoadMore} count={items.length} />
      )}
    </Virtualizer>
  );
}

/**
 * The load-more sentinel in window mode: an empty node right below the grid, with the viewport as
 * its root. It fires when less than a viewport height is left before the end of the loaded cells.
 *
 * The observer is recreated for every new page (by the number of cells), as in react-aria. With a
 * large `rootMargin`, a sentinel that stays in the zone after loading would otherwise not report
 * itself again, and a short page would not pull in the next one.
 */
function WindowLoadMoreSentinel({ onLoadMore, count }: { onLoadMore: () => void; count: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const loadRef = useRef(onLoadMore);
  loadRef.current = onLoadMore;

  useEffect(() => {
    const node = ref.current;
    // Without the API (on the server, or in the consumer's jsdom) there is no scroll-based loading. That is not an error.
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) loadRef.current();
      },
      { root: null, rootMargin: "0px 0px 100% 0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
    // Keyed by the number of cells, not by the array: the consumer builds `items` in render,
    // and the observer would be recreated on every render, calling the load again.
  }, [count]);

  return <div ref={ref} aria-hidden className="h-px" />;
}

const stop = (event: SyntheticEvent) => event.stopPropagation();

/** Cancels react-aria's long press on a cell with a menu; react-aria's own fires at 500 ms. */
const LONG_PRESS_MS = 450;
/** How far the finger must move before it is no longer a long press. */
const LONG_PRESS_SLOP_PX = 8;

/**
 * The cell's context menu. An internal part of the grid, it does not leave it.
 *
 * THE TRIGGER SITS INSIDE THE `row`, AND THIS NEEDS TWO PATCHES, both about the same thing: the Radix
 * menu is attached to the trigger, while the grid's real focus is on the cell.
 *
 * 1. Keyboard. Shift+F10 and the menu key send a `contextmenu` event (or nothing at all, on macOS)
 *    to the focused element, that is, to the `row`, while the trigger is lower. Radix's root cannot
 *    be opened from outside, so the grid catches the key on the cell and sends the trigger that same
 *    event at the center point of the cell. A closed menu returns focus to the cell by itself: Radix
 *    remembers the focused element when it opens.
 * 2. Bubbling. The menu panel is moved out by a portal, but React events bubble through the component
 *    tree, up to the `row`: a click on an item would select the cell and fire `onAction`. A wrapper
 *    with `display: contents` stops them at the boundary. The Media library screen worked around this
 *    with a local wrapper; now it is the kit's job.
 * 3. A long press on touch: the menu only. In a grid with selection and `onAction`, react-aria selects
 *    a cell on a long press by its own rule (500 ms), while the Radix menu opens on its own timer later
 *    (700 ms), so a person got both the menu and the selection. Here our own timer, earlier than
 *    react-aria's (450 ms), sends `pointercancel` to the `row`. The event bubbles to the document and
 *    cancels react-aria's press together with its long press, but it does not pass through the Radix
 *    trigger, so the Radix timer keeps running and opens the menu. Opening the menu with our own
 *    `contextmenu` is not possible: react-aria cancels that event for the duration of the touch
 *    (`preventDefault`), and Radix does not handle a cancelled event. A finger that moves before the
 *    timer fires means scrolling or dragging, and the timer is cleared.
 */
function CellContextMenu({
  menu,
  longPressSelectsRef,
  children,
}: {
  menu: ReactNode;
  longPressSelectsRef: RefObject<boolean>;
  children: ReactNode;
}) {
  const triggerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const trigger = triggerRef.current;
    const row = trigger?.closest<HTMLElement>('[role="row"]');
    if (!trigger || !row) return;

    const onKeyDown = (event: KeyboardEvent) => {
      // Only the cell itself: Shift+F10 inside a nested field is not ours to handle.
      if (event.target !== row) return;
      const byKey = event.key === "ContextMenu";
      const byShortcut = event.key === "F10" && event.shiftKey;
      if (!byKey && !byShortcut) return;
      event.preventDefault();
      const box = row.getBoundingClientRect();
      trigger.dispatchEvent(
        new MouseEvent("contextmenu", {
          bubbles: true,
          cancelable: true,
          clientX: box.left + box.width / 2,
          clientY: box.top + box.height / 2,
        })
      );
    };

    let timer = 0;
    let press: { x: number; y: number; id: number } | null = null;
    const cancel = () => {
      window.clearTimeout(timer);
      timer = 0;
      press = null;
    };
    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType !== "touch" || !longPressSelectsRef.current) return;
      cancel();
      press = { x: event.clientX, y: event.clientY, id: event.pointerId };
      timer = window.setTimeout(() => {
        const at = press;
        cancel();
        if (!at) return;
        // Dispatched to the `row`, not to the touched element: the event bubbles to the document,
        // where react-aria listens for the press, but it does not pass through the Radix trigger
        // (which is lower), so its timer keeps running and opens the menu.
        row.dispatchEvent(
          new PointerEvent("pointercancel", {
            bubbles: true,
            pointerId: at.id,
            pointerType: "touch",
          })
        );
      }, LONG_PRESS_MS);
    };
    // A touch, not a pointer: during a touch, `pointermove` goes to the element under the finger,
    // while `touchmove` stays with the starting one.
    const onTouchMove = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!press || !touch) return;
      if (Math.hypot(touch.clientX - press.x, touch.clientY - press.y) > LONG_PRESS_SLOP_PX)
        cancel();
    };

    row.addEventListener("keydown", onKeyDown);
    trigger.addEventListener("pointerdown", onPointerDown);
    trigger.addEventListener("touchmove", onTouchMove, { passive: true });
    trigger.addEventListener("touchend", cancel);
    trigger.addEventListener("touchcancel", cancel);
    // A gesture the browser takes over (zoom, a system gesture) cancels the pointer without a
    // `touchmove` past the threshold, so the timer is cleared here too.
    trigger.addEventListener("pointerup", cancel);
    trigger.addEventListener("pointercancel", cancel);
    return () => {
      cancel();
      row.removeEventListener("keydown", onKeyDown);
      trigger.removeEventListener("pointerdown", onPointerDown);
      trigger.removeEventListener("touchmove", onTouchMove);
      trigger.removeEventListener("touchend", cancel);
      trigger.removeEventListener("touchcancel", cancel);
      trigger.removeEventListener("pointerup", cancel);
      trigger.removeEventListener("pointercancel", cancel);
    };
  }, [longPressSelectsRef]);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div ref={triggerRef} className="h-full">
          {children}
        </div>
      </ContextMenuTrigger>
      <div
        className="contents"
        onClick={stop}
        onPointerDown={stop}
        onPointerUp={stop}
        onKeyDown={stop}
        onKeyUp={stop}
      >
        <ContextMenuContent>{menu}</ContextMenuContent>
      </div>
    </ContextMenu>
  );
}
