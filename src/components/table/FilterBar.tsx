"use client";

import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { Button as AriaButton, Tag, TagGroup, TagList } from "react-aria-components";
import { CloseIcon } from "../../icons.js";
import { useMessages } from "../../i18n/useMessages.js";
import { cn } from "../../lib/cn.js";
import { rangeText } from "../../lib/filter-range.js";
import type { TableFilter } from "../../lib/table-state.js";
import { Button } from "../actions/Button.js";

export interface FilterBarProps extends Omit<ComponentPropsWithoutRef<"div">, "onChange"> {
  /** Applied filters; each is rendered as a removable tag. */
  filters: TableFilter[];
  /** Receives the new list of filters after one tag, or all of them at once, is removed. */
  onFiltersChange: (filters: TableFilter[]) => void;
  /**
   * The tag label. If not set, it is "field: value"; for a range (when `to` is set), it uses the
   * words from the message catalog: "field: 50–100", "field: from 50", "field: to 100".
   *
   * The label is **not** an identifier: removal goes by `filter.id`. Otherwise two filters on the
   * same field with labels that look the same would be indistinguishable, and a localized or
   * truncated label would be useless altogether.
   */
  renderLabel?: (filter: TableFilter) => string;
  /** Accessible name of the set. If not set, it is taken from the message catalog. */
  label?: string;
  /** The slot for adding a filter, usually `FilterBarAdd`. */
  children?: ReactNode;
}

/**
 * Applied filters as removable tags.
 *
 * The component **does not know what kinds of filters exist**: their list comes in as a prop, and
 * no domain vocabulary appears in the kit. That is what distinguishes it from `LibraryFilterBar`
 * in the front app, where 373 lines consist of hardcoded groups and product pickers: the shape is
 * carried over, not the code.
 *
 * The tags are built on react-aria's `TagGroup`, the same approach as `TagInput`, rather than on
 * `Chip`: a chip has no removal, and it is about toggling, not removing. Keyboard support also
 * comes for free: Delete and Backspace on a tag.
 */
export const FilterBar = forwardRef<HTMLDivElement, FilterBarProps>(function FilterBar(
  { filters, onFiltersChange, renderLabel, label, className, children, ...rest },
  ref
) {
  const messages = useMessages();

  // A range without its own label cannot be shown as "field: value": "from 50" would look like
  // the equality "= 50" (ADR-0063). The label built by `FilterBarAdd` arrives in `filter.label`
  // and does not reach this point.
  const labelOf =
    renderLabel ??
    ((filter: TableFilter) =>
      filter.label ??
      `${filter.field}: ${
        filter.to !== undefined ? rangeText(messages, filter.value, filter.to) : filter.value
      }`);

  return (
    <div ref={ref} className={cn("flex flex-wrap items-center gap-2", className)} {...rest}>
      {filters.length > 0 ? (
        <TagGroup
          aria-label={label ?? messages.filterBar.label}
          className="contents"
          onRemove={(keys) => onFiltersChange(filters.filter((f) => !keys.has(f.id)))}
        >
          <TagList items={filters} className="contents">
            {(filter) => (
              <Tag
                id={filter.id}
                textValue={labelOf(filter)}
                className="border-line-soft bg-bg-2 text-fg-1 focus-visible:outline-accent-strong rounded-pill flex items-center gap-1 border py-0.5 pr-1 pl-2.5 text-[13px] outline-none focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                {labelOf(filter)}
                {/*
                  The button MUST be react-aria's `Button`: the removal behavior is wired through
                  `ButtonContext`, and a bare `<button>` does not read it. The markup is valid, axe
                  is happy, and clicking does nothing. This exact trap is already described for
                  `TagInput`.

                  The label here is generic, without the filter's name: react-aria adds its tag's
                  label to the button's name itself, and "Remove filter Section: Contracts" would
                  be read with the label duplicated. Verified by the computed accessible name, not
                  by eyeballing the markup.
                */}
                <AriaButton
                  slot="remove"
                  aria-label={messages.filterBar.remove}
                  className="text-fg-3 hover:text-fg-0 focus-visible:outline-accent-strong flex cursor-pointer items-center rounded-full p-0.5 outline-none focus-visible:outline-2 focus-visible:outline-offset-1"
                >
                  <CloseIcon size={12} />
                </AriaButton>
              </Tag>
            )}
          </TagList>
        </TagGroup>
      ) : null}

      {children}

      {/*
        The "clear all" button appears from the second filter on: with one filter it does exactly
        what that filter's cross does, and it only lengthens keyboard navigation.
      */}
      {filters.length > 1 ? (
        <Button variant="ghost" size="sm" onClick={() => onFiltersChange([])}>
          {messages.filterBar.clear}
        </Button>
      ) : null}
    </div>
  );
});
