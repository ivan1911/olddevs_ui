"use client";

import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { useMessages } from "../../i18n/useMessages.js";
import { cn } from "../../lib/cn.js";

export interface TableToolbarProps extends Omit<ComponentPropsWithoutRef<"div">, "title"> {
  /** Table title. Usually a `Heading` or a string. */
  title?: ReactNode;
  /**
   * Total number of records. A number, not a ready-made string: pluralization is handled
   * by the message catalog for the locale, not by the caller.
   */
  count?: number;
  /**
   * Custom count label, for when the entity needs a name ("12 documents").
   * The same approach as in `SelectionBar`: the catalog knows about pluralization, but not
   * about the domain.
   */
  countLabel?: (count: number) => ReactNode;
  /** Actions on the right: "Create", "Export", a menu. */
  actions?: ReactNode;
  /** Filters slot, usually `FilterBar`. Rendered on a second row. */
  filters?: ReactNode;
  /** Preferences slot, usually `TablePreferences` inside a `Popover` or `Menu`. */
  preferences?: ReactNode;
}

/**
 * Bar above the table: title, count, actions, filters and preferences.
 *
 * Holds no state at all, neither the count nor the filters: everything comes from above,
 * usually from `useTableState`.
 *
 * THERE IS NO `toolbar` ROLE HERE, and that is a deliberate decision. The role requires
 * arrow-key navigation between its own items, and ARIA does not provide that by itself:
 * declaring the role without implementing the behavior would promise screen readers
 * something that does not exist. A plain container with a heading inside is more honest
 * and misleads no one.
 *
 * Works without `DataTable` too, above a plain `Table`: the bar knows nothing about what is
 * below it.
 */
export const TableToolbar = forwardRef<HTMLDivElement, TableToolbarProps>(function TableToolbar(
  { title, count, countLabel, actions, filters, preferences, className, ...rest },
  ref
) {
  const messages = useMessages();
  const hasHeader = title != null || count != null || actions != null || preferences != null;

  return (
    <div ref={ref} className={cn("flex flex-col gap-3", className)} {...rest}>
      {hasHeader ? (
        <div className="flex flex-wrap items-center gap-3">
          {title != null ? <div className="text-fg-0 text-base font-semibold">{title}</div> : null}

          {count != null ? (
            <span className="text-fg-2 text-[13px]">
              {countLabel ? countLabel(count) : messages.tableToolbar.total({ count })}
            </span>
          ) : null}

          {actions != null || preferences != null ? (
            <div className="ml-auto flex shrink-0 items-center gap-2">
              {actions}
              {preferences}
            </div>
          ) : null}
        </div>
      ) : null}

      {filters}
    </div>
  );
});
