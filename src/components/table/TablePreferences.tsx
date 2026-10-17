"use client";

import { forwardRef, type ComponentPropsWithoutRef } from "react";
import { ChevronDownIcon, ChevronUpIcon } from "../../icons.js";
import { useMessages } from "../../i18n/useMessages.js";
import { cn } from "../../lib/cn.js";
import { orderColumns } from "../../lib/table-state.js";
import type { Density } from "../../lib/variants.js";
import { Button } from "../actions/Button.js";
import { Checkbox } from "../inputs/Checkbox.js";
import { Segmented } from "../actions/Segmented.js";

export interface TablePreferencesColumn {
  /** Column identifier; matches the `id` of the table column. */
  id: string;
  /** Label. A string, not a `ReactNode`: it is also the checkbox's accessible name. */
  label: string;
  /** The column cannot be hidden, for example the one that names the row. */
  required?: boolean;
}

export interface TablePreferencesProps extends Omit<
  ComponentPropsWithoutRef<"div">,
  "onChange" | "children"
> {
  /** Table columns in declaration order. */
  columns: TablePreferencesColumn[];
  /** Hidden columns. The component stores nothing; the value is passed in from the parent. */
  hiddenColumns: Set<string>;
  /** Receives the new set of hidden columns after a checkbox changes. */
  onHiddenColumnsChange: (hidden: Set<string>) => void;
  /**
   * Column order. If empty, columns follow declaration order. Without a handler there are no move
   * buttons.
   */
  columnOrder?: string[];
  /**
   * Receives the full new order after "up" or "down" is pressed. If not passed, there are no order
   * buttons.
   */
  onColumnOrderChange?: (order: string[]) => void;
  /** Current row density: `comfortable` or `compact`. */
  density: Density;
  /** Receives the selected density. */
  onDensityChange: (density: Density) => void;
}

/**
 * Table preferences: column visibility and order, and row density.
 *
 * THIS IS A PANEL, NOT A MENU, and that is a deliberate decision. The kit's Menu wraps a
 * `Popover` and expects a trigger; more importantly, a menu item is not a container for
 * buttons: buttons nested in it ("up/down") break the menu's keyboard semantics, where the
 * arrow keys belong to the menu itself. So this uses plain checkboxes and `Segmented`, and
 * the consumer chooses the shell: `Popover`, `Drawer` or `Dialog`.
 *
 * It holds no state: visibility, order and density come from above, usually from
 * `useTableState`.
 *
 * ORDER CHANGES WITH BUTTONS, not with dragging. Dragging without a keyboard alternative is
 * inaccessible outright, and the buttons are that alternative; building both for one screen
 * is out of proportion.
 */
export const TablePreferences = forwardRef<HTMLDivElement, TablePreferencesProps>(
  function TablePreferences(
    {
      columns,
      hiddenColumns,
      onHiddenColumnsChange,
      columnOrder,
      onColumnOrderChange,
      density,
      onDensityChange,
      className,
      ...rest
    },
    ref
  ) {
    const messages = useMessages();

    // The order list is a prefix: columns it does not name follow it. The previous guard
    // compared only lengths, so an order list of the same length with other identifiers
    // slipped through, and some columns disappeared from the panel.
    const ordered = orderColumns(columns, columnOrder ?? []);

    const visibleCount = columns.filter((c) => !hiddenColumns.has(c.id)).length;

    const toggle = (id: string, visible: boolean) => {
      const next = new Set(hiddenColumns);
      if (visible) next.delete(id);
      else next.add(id);
      onHiddenColumnsChange(next);
    };

    const move = (id: string, by: -1 | 1) => {
      const ids = ordered.map((c) => c.id);
      const at = ids.indexOf(id);
      const to = at + by;
      if (at === -1 || to < 0 || to >= ids.length) return;
      [ids[at], ids[to]] = [ids[to]!, ids[at]!];
      onColumnOrderChange?.(ids);
    };

    return (
      <div ref={ref} className={cn("flex w-[280px] flex-col gap-4", className)} {...rest}>
        <fieldset className="flex flex-col gap-1">
          <legend className="text-fg-2 mb-1 text-[11px] font-semibold tracking-wide uppercase">
            {messages.tablePreferences.columns}
          </legend>

          {ordered.map((column, index) => {
            const visible = !hiddenColumns.has(column.id);
            // The last visible column cannot be unchecked: a table with no columns is not a UI
            // state but a breakage the user cannot get out of, because there would be nothing
            // left to hide.
            const last = visible && visibleCount === 1;

            return (
              <div key={column.id} className="flex items-center gap-2">
                <Checkbox
                  checked={visible}
                  disabled={column.required || last}
                  onCheckedChange={(next) => toggle(column.id, next)}
                >
                  {column.label}
                </Checkbox>
                {onColumnOrderChange ? (
                  <span className="ml-auto flex shrink-0 gap-0.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      iconOnly
                      icon={<ChevronUpIcon size={12} />}
                      aria-label={messages.tablePreferences.moveUp({ column: column.label })}
                      /*
                        `aria-disabled`, NOT `disabled`: a button at the edge is the one
                        that holds focus. The browser drops focus from a disabled element,
                        and the focus order through the panel started over after a second
                        press in a row. A no-op handler is more honest here: the button
                        stays in the focus order and is announced as unavailable, rather
                        than disappearing under the user's finger.
                      */
                      aria-disabled={index === 0 || undefined}
                      onClick={() => index !== 0 && move(column.id, -1)}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      iconOnly
                      icon={<ChevronDownIcon size={12} />}
                      aria-label={messages.tablePreferences.moveDown({ column: column.label })}
                      aria-disabled={index === ordered.length - 1 || undefined}
                      onClick={() => index !== ordered.length - 1 && move(column.id, 1)}
                    />
                  </span>
                ) : null}
              </div>
            );
          })}
        </fieldset>

        <div className="flex flex-col gap-1">
          <span className="text-fg-2 text-[11px] font-semibold tracking-wide uppercase">
            {messages.tablePreferences.density}
          </span>
          <Segmented
            value={density}
            onChange={onDensityChange}
            options={[
              { value: "comfortable", label: messages.tablePreferences.comfortable },
              { value: "compact", label: messages.tablePreferences.compact },
            ]}
          />
        </div>
      </div>
    );
  }
);
