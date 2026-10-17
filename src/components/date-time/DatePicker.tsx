"use client";

import { useState, type ReactNode } from "react";
import type { DateValue } from "react-aria-components";
import { cn } from "../../lib/cn.js";
import { parseDateOrNull, type DateInput } from "../../lib/date.js";
import { useMessages, useUiLocale } from "../../i18n/useMessages.js";
import { ChevronDownIcon } from "../../icons.js";
import { Calendar } from "./Calendar.js";
import { useFieldDescribedBy } from "../../hooks/useFieldDescription.js";
import { Popover, PopoverContent, PopoverTrigger } from "../overlays/Popover.js";

export interface DatePickerProps {
  /** Date in ISO format `YYYY-MM-DD`, or empty. */
  value?: string | null;
  /**
   * Called with the selected date as an ISO string `YYYY-MM-DD`, the same form as `value`.
   * The component knows nothing about `Date` or time zones.
   */
  onChange: (date: string) => void;
  /** Trigger text until a date is selected; defaults to the kit's standard label. */
  placeholder?: string;
  /** Disables the trigger button: the calendar does not open. */
  disabled?: boolean;
  /**
   * Earliest available date.
   *
   * The limits are shown in the calendar rather than checked after a date is selected.
   * An ISO string `YYYY-MM-DD`, as with `value`; a `@internationalized/date` object
   * is accepted too.
   */
  minValue?: DateInput;
  /** Latest available date; shown in the calendar the same way as `minValue`. */
  maxValue?: DateInput;
  /** Marks specific days as unavailable (holidays, booked dates): they cannot be selected. */
  isDateUnavailable?: (date: DateValue) => boolean;
  /** Locale of the date label and the calendar; defaults to the `UiProvider` locale. */
  locale?: string;
  /** Classes for the trigger button. */
  triggerClassName?: string;
  /**
   * The trigger's own description. It is merged with the `FormField` description rather than
   * replacing it: the form's hint and the consumer's note must both be announced.
   */
  "aria-describedby"?: string;
}

/**
 * Date with an underlined trigger — a compact look for a form row.
 *
 * The value travels as an ISO string, not as an `@internationalized/date` object: the consumer
 * keeps the date in the URL and sends it to the API, and making it convert back and forth
 * would hand it the calendar's internal plumbing.
 */
export function DatePicker({
  value,
  onChange,
  placeholder,
  disabled,
  minValue,
  maxValue,
  isDateUnavailable,
  locale,
  triggerClassName,
  "aria-describedby": ariaDescribedBy,
}: DatePickerProps) {
  const messages = useMessages();
  const uiLocale = useUiLocale();
  const effectiveLocale = locale ?? uiLocale;
  /**
   * The field description from `FormField`, plus the consumer's own if it passed one.
   *
   * The same approach as `TextControl` and `NumberInput`: the values are MERGED, not replacing
   * each other. Outside `FormField` the context is empty, and the markup is the same as it was
   * before descriptions existed.
   */
  const fieldDescribedBy = useFieldDescribedBy();
  const describedBy = [ariaDescribedBy, fieldDescribedBy].filter(Boolean).join(" ") || undefined;

  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-describedby={describedBy}
          className={cn(
            "border-line-soft text-fg-2 hover:border-line hover:text-fg-1 inline-flex cursor-pointer items-center gap-1 border-b pb-px font-mono text-[13px] transition-colors outline-none",
            "focus-visible:outline-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-50",
            triggerClassName
          )}
        >
          {formatDate(value, effectiveLocale) ?? placeholder ?? messages.datePicker.placeholder}
          <ChevronDownIcon size={12} className="text-fg-3 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          value={parseDateOrNull(value)}
          onChange={(date) => {
            if (!date) return;
            onChange(date.toString());
            setOpen(false);
          }}
          minValue={minValue}
          maxValue={maxValue}
          isDateUnavailable={isDateUnavailable}
          locale={locale ?? uiLocale}
        />
      </PopoverContent>
    </Popover>
  );
}

/**
 * The date is parsed piece by piece, not through `new Date(iso)`.
 *
 * `new Date("2026-03-05")` is midnight **UTC**, and east of Greenwich the string turns into
 * the previous day. The component works with a calendar date without time, so it has to be
 * assembled at the calendar's local noon.
 *
 * BUT ONLY PARSED VALUES MAY BE ASSEMBLED. Assembling piece by piece checks nothing, and before
 * wave 26 the function answered garbage input with plausible-looking lies: `2026-02-29` (not a
 * leap year) silently became `Mar 01, 2026`, `2026-09` became `Sep 01, 2026`, and `"nonsense"`
 * became the string `Invalid Date` right on the button. The value comes from the URL, so a
 * strict parse comes first, and only then the assembly.
 */
export function formatDate(isoDate: string | null | undefined, locale = "en-US"): ReactNode {
  const parsed = parseDateOrNull(isoDate);
  if (!parsed) return null;

  const date = new Date(parsed.year, parsed.month - 1, parsed.day);
  // Years 0–99 are mapped by the `Date` constructor to 1900+y — a legacy rule that is still in
  // effect. `parseDate` accepts such years (`0026-03-05` is a valid string from the URL), and
  // without this line the button would show "Mar 05, 1926": the same plausible lie that the
  // strict parse exists to eliminate.
  date.setFullYear(parsed.year);
  return date.toLocaleDateString(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
