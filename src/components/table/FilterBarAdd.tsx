"use client";

import { forwardRef, useRef, useState, type ComponentPropsWithoutRef } from "react";
import { AddIcon } from "../../icons.js";
import { useMessages, useUiLocale } from "../../i18n/useMessages.js";
import { cn } from "../../lib/cn.js";
import { parseDateOrNull } from "../../lib/date.js";
import { formatRangeDate, formatRangeNumber, rangeText } from "../../lib/filter-range.js";
import type { TableFilter } from "../../lib/table-state.js";
import { Button } from "../actions/Button.js";
import { DatePicker } from "../date-time/DatePicker.js";
import { NumberInput } from "../inputs/NumberInput.js";
import { Popover, PopoverContent, PopoverTrigger } from "../overlays/Popover.js";
import { Select } from "../inputs/Select.js";

/**
 * The separator of the composite "field + value" key.
 *
 * The key is needed to find in a single pass which pairs are already selected: finding the pair
 * by scanning the list for each menu item is quadratic in the number of filters. The separator is
 * a character that cannot occur in a field identifier or a value, otherwise the pairs `a` + `bc`
 * and `ab` + `c` would produce one key.
 *
 * It is written AS an escape sequence, not as the character itself. A raw null byte in the source
 * makes the file binary for `file` and `grep`: `grep` silently skips such a file, exiting with
 * code 1 and no message, so any text-based check would bypass it without a word of warning.
 */
const KEY_SEPARATOR = "\u0000";

const filterKey = (field: string | undefined, value: string) => `${field}${KEY_SEPARATOR}${value}`;

export interface FilterField {
  /** Field identifier; it goes into the `field` of the filter being created. */
  id: string;
  /** Field label. A string: it also goes into the tag label. */
  label: string;
  /**
   * Field kind (ADR-0063). `"values"` is a choice from the `values` list, an equality;
   * `"number-range"` and `"date-range"` are two fields, "from" and "to", and a tag with `to`.
   * If not set, `"values"`.
   */
  kind?: "values" | "number-range" | "date-range";
  /**
   * Allowed values for `kind: "values"`. An empty list means the field will not appear in the
   * field picker. Not used for ranges: pass `[]`.
   *
   * Required for ranges too: an optional field would break a consumer that reads
   * `field.values.length` on its own fields (a minor release does not break the types).
   */
  values: { id: string; label: string }[];
}

/** A range bound as a string → a number for `NumberInput`; empty → `null`. */
const toNumber = (bound: string) => (bound === "" ? null : Number(bound));

/** An inverted range: both bounds are set, and the lower one is greater than the upper one. ISO dates compare as strings. */
function isInverted(kind: FilterField["kind"], from: string, to: string) {
  if (from === "" || to === "") return false;
  return kind === "number-range" ? Number(from) > Number(to) : from > to;
}

export interface FilterBarAddProps extends Omit<
  ComponentPropsWithoutRef<"div">,
  "onChange" | "children"
> {
  /** Fields a filter can be added for, each with its own values. */
  fields: FilterField[];
  /** Filters already applied: their values are not offered again. */
  filters: TableFilter[];
  /** Receives the assembled filter after "Apply" is pressed. */
  onAdd: (filter: TableFilter) => void;
}

/**
 * Adding a filter: choose a field, then a value.
 *
 * The list of fields and values comes in as a prop: no domain vocabulary appears in the kit, as
 * in `FilterBar`.
 *
 * AN ALREADY APPLIED VALUE IS NOT OFFERED AGAIN. Otherwise the user adds a second identical tag,
 * the selection does not change, and they are left with two filters that look the same, with no
 * way to tell which one to remove.
 *
 * The tag identifier is built from the field and the value: the pair is unique precisely because
 * duplicates are forbidden above.
 *
 * A RANGE (`kind: "number-range" | "date-range"`) is two fields instead of a list of values,
 * ADR-0063. "Apply" is available when at least one bound is set. An inverted range ("from 100 to
 * 50") cannot be applied: it would select nothing, and the user would read the emptiness as "no
 * data". A field with an already applied range is not offered again: two ranges on the same field
 * would be an intersection, not an addition, and the tags would be indistinguishable. The tag
 * label ("Amount: 50–100", "Date: until 12 March 2026") is built here, from the messages catalog
 * and the locale of `UiProvider`, and goes into `label`.
 */
export const FilterBarAdd = forwardRef<HTMLDivElement, FilterBarAddProps>(function FilterBarAdd(
  { fields, filters, onAdd, className, ...rest },
  ref
) {
  const messages = useMessages();
  const locale = useUiLocale();
  const [open, setOpen] = useState(false);
  const [field, setField] = useState<string | null>(null);
  const [value, setValue] = useState<string | null>(null);
  // The range bounds as strings, the way they will go into the filter; empty means not set.
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const taken = new Set(filters.map((f) => filterKey(f.field, f.value)));
  const rangeApplied = (f: FilterField) => filters.some((x) => x.field === f.id);
  const availableFields = fields.filter((f) =>
    f.kind === "number-range" || f.kind === "date-range"
      ? !rangeApplied(f)
      : (f.values ?? []).some((v) => !taken.has(filterKey(f.id, v.id)))
  );
  const current = fields.find((f) => f.id === field);
  const kind = current?.kind ?? "values";
  const isRange = kind === "number-range" || kind === "date-range";
  const availableValues = (current?.values ?? []).filter(
    (v) => !taken.has(filterKey(current?.id, v.id))
  );

  const close = () => {
    setOpen(false);
    setField(null);
    setValue(null);
    setFrom("");
    setTo("");
    // Focus returns to the button rather than being lost in the closing popover: lost focus jumps
    // to the start of the document, and a keyboard user starts navigating the page from scratch.
    triggerRef.current?.focus();
  };

  const canApply = isRange
    ? (from !== "" || to !== "") && !isInverted(kind, from, to)
    : value != null;

  const apply = () => {
    if (!current || !canApply) return;

    if (isRange) {
      const format = kind === "number-range" ? formatRangeNumber : formatRangeDate;
      onAdd({
        id: `${current.id}:range`,
        field: current.id,
        value: from,
        // An empty string rather than a missing key: it is `to` that tells "from 50" apart
        // from the equality "= 50".
        to,
        label: `${current.label}: ${rangeText(messages, format(from, locale), format(to, locale))}`,
      });
      close();
      return;
    }

    const label = (current.values ?? []).find((v) => v.id === value)?.label ?? value;
    onAdd({
      id: `${current.id}:${value}`,
      field: current.id,
      value: value!,
      label: `${current.label}: ${label}`,
    });
    close();
  };

  const inverted = isInverted(kind, from, to);

  return (
    <div ref={ref} className={cn("inline-flex", className)} {...rest}>
      <Popover open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
        <PopoverTrigger asChild>
          {/*
            `asChild` is required: without it Radix draws its own button around ours, and the result
            is a button inside a button, which fails the audit run.
          */}
          <Button
            ref={triggerRef}
            variant="outline"
            size="sm"
            icon={<AddIcon size={14} />}
            disabled={availableFields.length === 0}
          >
            {messages.filterBar.add}
          </Button>
        </PopoverTrigger>

        <PopoverContent className="flex w-[260px] flex-col gap-3 p-3">
          <Select
            aria-label={messages.filterBar.field}
            placeholder={messages.filterBar.field}
            items={availableFields.map((f) => ({ id: f.id, label: f.label }))}
            value={field}
            onChange={(id) => {
              setField(id == null ? null : String(id));
              setValue(null);
              setFrom("");
              setTo("");
            }}
          />

          {/*
            The second step is rendered ONLY after a field is chosen: an empty, disabled select next
            to a filled one reads as an error, not as "a step not yet completed".
          */}
          {current && kind === "values" ? (
            <Select
              aria-label={messages.filterBar.value}
              placeholder={messages.filterBar.value}
              items={availableValues}
              value={value}
              onChange={(id) => setValue(id == null ? null : String(id))}
            />
          ) : null}

          {current && kind === "number-range" ? (
            <>
              <NumberInput
                label={messages.filterBar.fromField}
                value={toNumber(from)}
                onChange={(n) => setFrom(n == null ? "" : String(n))}
                invalid={inverted}
              />
              <NumberInput
                label={messages.filterBar.toField}
                value={toNumber(to)}
                onChange={(n) => setTo(n == null ? "" : String(n))}
                invalid={inverted}
              />
            </>
          ) : null}

          {current && kind === "date-range" ? (
            <>
              {/*
                The `DatePicker` has no name prop, and its trigger shows a date rather than the
                field label: the group around it carries the name.
              */}
              <div role="group" aria-label={messages.filterBar.fromField}>
                <DatePicker
                  value={from}
                  onChange={setFrom}
                  placeholder={messages.filterBar.fromField}
                  maxValue={parseDateOrNull(to) ?? undefined}
                />
              </div>
              <div role="group" aria-label={messages.filterBar.toField}>
                <DatePicker
                  value={to}
                  onChange={setTo}
                  placeholder={messages.filterBar.toField}
                  minValue={parseDateOrNull(from) ?? undefined}
                />
              </div>
            </>
          ) : null}

          <Button size="sm" tone="accent" disabled={!canApply} onClick={apply}>
            {messages.filterBar.apply}
          </Button>
        </PopoverContent>
      </Popover>
    </div>
  );
});
