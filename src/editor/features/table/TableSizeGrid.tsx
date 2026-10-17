"use client";

import {
  forwardRef,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { Button } from "../../../components/actions/Button.js";
import { NumberInput } from "../../../components/inputs/NumberInput.js";
import { useMessages } from "../../../i18n/useMessages.js";
import { cn } from "../../../lib/cn.js";

/** Table size in columns and rows. */
export interface TableSize {
  cols: number;
  rows: number;
}

export interface TableSizeGridProps {
  /** The size to start from; 3×3 by default. */
  initial?: TableSize;
  /** The largest side of the grid, in cells; 10 by default. */
  max?: number;
  /**
   * Numeric "Columns" and "Rows" fields with an "Insert" button under the grid, for
   * tables larger than the grid. The values are the limits of the fields. Without it,
   * only the grid is shown.
   */
  fields?: { maxCols: number; maxRows: number };
  /** A size is picked: `Enter` in the grid, a click on a cell, or "Insert". */
  onPick: (cols: number, rows: number) => void;
  /** `Escape` in the grid. Whether to close the host is up to the host. */
  onCancel?: () => void;
  /** Take focus on mount. A host that sets focus itself passes `false`. */
  autoFocus?: boolean;
  className?: string;
}

/**
 * The grid is never smaller than this while the selection is small: empty cells show
 * where it can grow.
 */
const MIN_VISIBLE = 5;
const DEFAULT_MAX = 10;
const DEFAULT_SIZE: TableSize = { cols: 3, rows: 3 };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * Table size picker: five by five cells, growing up to ten by ten.
 *
 * GROWTH. The grid side is the selected size plus one cell of spare room (never less
 * than five and never more than `max`): reach the edge and the next cell appears; step
 * back and the grid shrinks. The empty cells past the selection are the point of drawing
 * the grid: they show that a bigger size can be picked.
 *
 * ARIA: THE GRID PATTERN FROM THE APG. `role="grid"` with rows (`row`) and cells
 * (`gridcell`). Focus stays on the grid itself, and `aria-activedescendant` names the
 * current cell, as in the kit's lists. Roving tabindex was rejected: there are up to a
 * hundred cells, and a Tab stop on each would mean a hundred stops instead of one. The
 * arrows move the selection and grow the grid, `Home` and `End` go along the row (with
 * `Ctrl`, to the corners of the grid), `Enter` picks, and `Escape` cancels. `Tab` moves
 * on to the fields.
 *
 * WHAT IS SELECTED, IN WORDS. The cell's name and the live region (`role="status"`) read
 * the same text: "3 columns, 4 rows", with plural forms from the locale (`tableSize`).
 * The mouse is not the only way in: hovering only moves the same selection the arrows
 * move. The visible label "3 × 4" is hidden from screen readers, because it repeats the
 * live region.
 *
 * THE FIRST ROW IS A HEADER. Insert always makes the first row out of `th` cells, and the
 * grid shows it: the top row is shaded differently and underlined. This is a hint to the
 * eye, not a toggle.
 *
 * FIELDS are for tables larger than the grid (up to `fields.maxCols` × `fields.maxRows`).
 * The selection is one for the grid and the fields: an edit to either moves the other. An
 * empty field does not change the selection: Insert takes the last valid size.
 *
 * FOCUS ON MOUNT goes to the grid. Inside a submenu, react-aria closes the menu if focus
 * leaves it in the very first frame, so the host sets focus itself: `autoFocus={false}`
 * and a `ref` to the grid.
 */
export const TableSizeGrid = forwardRef<HTMLDivElement, TableSizeGridProps>(function TableSizeGrid(
  {
    initial = DEFAULT_SIZE,
    max = DEFAULT_MAX,
    fields,
    onPick,
    onCancel,
    autoFocus = true,
    className,
  },
  ref
) {
  const messages = useMessages().editor;
  const id = useId();
  const gridRef = useRef<HTMLDivElement>(null);
  useImperativeHandle(ref, () => gridRef.current!);
  const [size, setSize] = useState<TableSize>(() => ({
    cols: Math.max(1, initial.cols),
    rows: Math.max(1, initial.rows),
  }));
  // Fields keep what was typed, including an empty value; the selection takes only valid values.
  const [draft, setDraft] = useState<{ cols: number | null; rows: number | null }>(size);

  useEffect(() => {
    if (autoFocus) gridRef.current?.focus();
  }, [autoFocus]);

  const visibleCols = clamp(size.cols + 1, MIN_VISIBLE, max);
  const visibleRows = clamp(size.rows + 1, MIN_VISIBLE, max);

  const choose = (next: TableSize) => {
    setSize(next);
    setDraft(next);
  };

  /** One cell per step. A value above `max` (typed in a field) steps down to the grid's edge. */
  const step = (value: number, delta: 1 | -1) =>
    delta > 0 ? Math.min(max, value + 1) : clamp(Math.min(value, max + 1) - 1, 1, max);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // Enter that confirms an IME composition, and chords with Alt or Meta, are not ours.
    if (event.nativeEvent.isComposing || event.altKey || event.metaKey) return;
    const { cols, rows } = size;
    let next: TableSize | null = null;
    switch (event.key) {
      case "ArrowRight":
        next = { cols: step(cols, 1), rows };
        break;
      case "ArrowLeft":
        next = { cols: step(cols, -1), rows };
        break;
      case "ArrowDown":
        next = { cols, rows: step(rows, 1) };
        break;
      case "ArrowUp":
        next = { cols, rows: step(rows, -1) };
        break;
      case "Home":
        next = { cols: 1, rows: event.ctrlKey ? 1 : rows };
        break;
      case "End":
        next = { cols: visibleCols, rows: event.ctrlKey ? visibleRows : rows };
        break;
      case "Enter":
        event.preventDefault();
        onPick(cols, rows);
        return;
      case "Escape":
        onCancel?.();
        return;
      default:
        return;
    }
    event.preventDefault();
    choose(next);
  };

  const activeId = `${id}-${Math.min(size.rows, visibleRows)}-${Math.min(size.cols, visibleCols)}`;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {/*
        Focus is on the grid, not on the cells: see "ARIA" in the description. The key
        handler is on the grid too; the cells take the mouse only.
      */}
      <div
        ref={gridRef}
        role="grid"
        tabIndex={0}
        aria-label={messages.tableGrid}
        aria-activedescendant={activeId}
        onKeyDown={onKeyDown}
        className="focus-visible:ring-focus flex w-fit flex-col gap-0.5 rounded-xs outline-none focus-visible:ring-2"
      >
        {Array.from({ length: visibleRows }, (_, rowIndex) => {
          const row = rowIndex + 1;
          return (
            <div
              key={row}
              role="row"
              data-header={row === 1 ? "true" : undefined}
              className="flex gap-0.5"
            >
              {Array.from({ length: visibleCols }, (_, colIndex) => {
                const col = colIndex + 1;
                const inside = col <= size.cols && row <= size.rows;
                return (
                  <div
                    key={col}
                    id={`${id}-${row}-${col}`}
                    role="gridcell"
                    aria-selected={inside}
                    aria-label={messages.tableSize({ cols: col, rows: row })}
                    onMouseEnter={() => choose({ cols: col, rows: row })}
                    onClick={() => onPick(col, row)}
                    className={cn(
                      "size-5 cursor-pointer rounded-xs border transition-colors",
                      inside ? "border-accent bg-accent-soft" : "border-line bg-bg-1",
                      // The header uses another shade and a solid base, not color alone:
                      // the difference holds without telling colors apart.
                      row === 1 && !inside && "bg-bg-3",
                      row === 1 && "border-b-2"
                    )}
                  />
                );
              })}
            </div>
          );
        })}
      </div>
      <div aria-hidden="true" className="text-fg-2 text-caption tabular-nums">
        {size.cols} × {size.rows}
      </div>
      {/* The live region is always present: a screen reader reads a change of text, not
          the appearance of a node. */}
      <div role="status" className="sr-only">
        {messages.tableSize(size)}
      </div>
      {fields && (
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <label className="text-fg-2 text-caption flex min-w-0 flex-1 flex-col gap-1">
              <span aria-hidden="true">{messages.tableColumns}</span>
              <NumberInput
                label={messages.tableColumns}
                value={draft.cols}
                onChange={(cols) => {
                  setDraft((current) => ({ ...current, cols }));
                  if (cols !== null) setSize((current) => ({ ...current, cols }));
                }}
                min={1}
                max={fields.maxCols}
                step={1}
                shellClassName="h-8"
              />
            </label>
            <label className="text-fg-2 text-caption flex min-w-0 flex-1 flex-col gap-1">
              <span aria-hidden="true">{messages.tableRows}</span>
              <NumberInput
                label={messages.tableRows}
                value={draft.rows}
                onChange={(rows) => {
                  setDraft((current) => ({ ...current, rows }));
                  if (rows !== null) setSize((current) => ({ ...current, rows }));
                }}
                min={1}
                max={fields.maxRows}
                step={1}
                shellClassName="h-8"
              />
            </label>
          </div>
          <Button
            type="button"
            size="sm"
            variant="solid"
            tone="accent"
            onClick={() => onPick(size.cols, size.rows)}
          >
            {messages.tableInsert}
          </Button>
        </div>
      )}
    </div>
  );
});
