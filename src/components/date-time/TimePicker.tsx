"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useFieldDescribedBy, useFieldInvalid } from "../../hooks/useFieldDescription.js";
import { cn } from "../../lib/cn.js";
import { useMessages } from "../../i18n/useMessages.js";
import { CheckIcon } from "../../icons.js";
import {
  formatTime12,
  maskTime,
  maskTime12,
  normalizeTime,
  normalizeTime12,
} from "../../lib/time.js";
import { Popover, PopoverAnchor, PopoverContent } from "../overlays/Popover.js";

export interface TimePickerProps {
  /** Time in `HH:MM` format. */
  value?: string | null;
  /**
   * Called with the time `HH:MM` when the user finishes typing (blur, Enter) or selects a time slot
   * from the list.
   */
  onChange: (time: string) => void;
  /** Time slot step in minutes. Must divide the day evenly. */
  step?: number;
  /**
   * Hour cycle of the field and the list: `24` (default, `14:30`) or `12` (`2:30 PM`).
   * Affects only display and input: `value` and `onChange` stay `HH:MM`.
   */
  hourCycle?: 12 | 24;
  /** Disables the field; the time slot list does not open. */
  disabled?: boolean;
  /** Placeholder in an empty field; defaults to the kit's standard label. */
  placeholder?: string;
  /** Accessible name of the field and the time slot list; defaults to the kit's standard label. */
  "aria-label"?: string;
  /**
   * Shows the field in the error state: the line under the time turns red and
   * `aria-invalid` is set. Inside a `FormField` with `error` the flag comes from the form;
   * an explicit `invalid={false}` clears it. The validation rule stays with the consumer.
   */
  invalid?: boolean;
  /** Classes on the input field. */
  className?: string;
}

/**
 * Time slots of the day in steps of `step` minutes, starting with the first one strictly after
 * `now` and wrapping around midnight: at 14:07 the list opens at `14:30`,
 * at 23:45 at `00:00`, and at exactly 14:30 at `15:00`.
 *
 * "Now" is the browser clock, not the server's time zone: the package deliberately does not know
 * the zone (see `timeZoneLabel` of `DateTimePicker`). The function is pure and kept apart from
 * the component so that the order can be tested without rendering.
 */
/** Default step, also the default of the `step` prop. */
const DEFAULT_STEP = 30;

export function upcomingSlots(step: number, now: Date): string[] {
  /*
    A non-positive step is REJECTED at the boundary.

    The loop below runs `m += step`: with zero it never ends, with a negative
    value it goes below zero, and the array grows until memory runs out. That is, the tab
    hangs for good on the first focus of the field (`openList` is called
    from `onFocus`). The prop is public and typed as a plain number, and it comes from
    settings: `step={settings.slotMinutes}` with a setting that has not loaded yet gives zero.
  */
  const safeStep = Number.isFinite(step) && step > 0 ? Math.floor(step) : DEFAULT_STEP;
  const all: string[] = [];
  for (let m = 0; m < 24 * 60; m += safeStep) {
    all.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
  }
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const first = all.findIndex((_, i) => i * safeStep > nowMinutes);
  if (first <= 0) return all;
  return [...all.slice(first), ...all.slice(0, first)];
}

/**
 * Time: a masked field plus a list of slots.
 *
 * A hybrid, not "either a picker or typing": people who know the exact time type it faster,
 * while the list saves those who pick "around what time" from having to hit exact digits.
 * Manual input keeps the contract of the field from `DateTimePicker`: the mask applies on every
 * keystroke, normalization and `onChange` happen on blur.
 *
 * The list is a combobox pattern with `aria-activedescendant`, not roving focus as in
 * `Select`: focus must stay in the field, because picking from the list and typing are one
 * action here, not two modes.
 *
 * Typed text filters the slots by prefix ("21" → 21:00, 21:30). The filter applies only to
 * what is typed after opening; otherwise the value already selected would collapse the list
 * down to itself. An empty filter result hides the panel entirely: there is nothing to suggest,
 * and it would only get in the way of typing.
 */
export function TimePicker({
  value,
  onChange,
  step = DEFAULT_STEP,
  hourCycle = 24,
  disabled,
  placeholder,
  "aria-label": ariaLabel,
  invalid,
  className,
}: TimePickerProps) {
  const messages = useMessages();
  // Hint and error from `FormField`, as in the kit's other fields; an explicit `invalid` prop
  // takes precedence over the form.
  const describedBy = useFieldDescribedBy();
  const fieldInvalid = useFieldInvalid();
  const ariaInvalid = invalid ?? (fieldInvalid || undefined);
  const twelve = hourCycle === 12;
  const labels = useMemo(
    () => ({ am: messages.timePicker.am, pm: messages.timePicker.pm }),
    [messages.timePicker.am, messages.timePicker.pm]
  );
  /** How the value looks in the field and in the list: `14:30` or `2:30 PM`. */
  const display = (time: string) =>
    twelve && /^\d{1,2}:\d{2}$/.test(time) ? formatTime12(time, labels) : time;
  const [inputTime, setInputTime] = useState(display(value ?? ""));
  const [open, setOpen] = useState(false);
  /** What was typed after opening; the slots are filtered by it. */
  const [filter, setFilter] = useState("");
  /** Index of the highlighted slot; −1 means none, and Enter commits what was typed. */
  const [active, setActive] = useState(-1);

  const listboxId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  /**
   * The order is computed on open, not on render: a list whose slots re-sort under the cursor
   * because the clock has ticked over would look broken.
   */
  const [slots, setSlots] = useState<string[]>([]);
  const openList = () => {
    if (disabled || open) return;
    setSlots(upcomingSlots(step, new Date()));
    setFilter("");
    setActive(-1);
    setOpen(true);
  };
  const closeList = () => {
    setOpen(false);
    setFilter("");
    setActive(-1);
  };

  const visible = useMemo(
    () =>
      filter
        ? slots.filter((s) =>
            twelve
              ? formatTime12(s, labels)
                  .toLowerCase()
                  // A leading zero ("02") is not part of the 12-hour display ("2:00 AM").
                  .startsWith(filter.toLowerCase().replace(/^0+(?=\d)/, ""))
              : s.startsWith(filter)
          )
        : slots,
    [slots, filter, twelve, labels]
  );

  const commit = (next: string) => {
    setInputTime(display(next));
    if (next !== value) onChange(next);
  };

  /*
    The field text follows `value`, but AFTER the parent responds, not at the moment
    of blur.

    `commit` writes to local state at once. If the parent rejects the value (clamps it to
    working hours, adjusts it), the prop does not change, the effect on `[value]` does not run,
    and the rejected text stayed in the field for good.
    The first fix called the sync right in `onBlur`, and it overwrote the value that had just been
    ACCEPTED: the prop was still the old one there, both `setState` calls landed in one batch, and
    the second one won. In an uncontrolled call (`value` is optional) the field simply emptied
    after typing.

    So the sync lives in an effect and runs only once editing is over: by then the parent has
    either sent a new prop or has not sent one, and in either case the field goes back to the accepted value.
  */
  const [editing, setEditing] = useState(false);
  /*
    The sync applies only to a CONTROLLED field. `value` is optional, and in an uncontrolled call
    there is no "accepted value" at all: the field's own text remains the truth. Without this
    condition, what was typed was simply erased on blur.
  */
  const controlled = value !== undefined;
  useEffect(() => {
    if (editing || !controlled) return;
    setInputTime(display(value ?? ""));
  }, [value, editing, controlled, twelve, labels]);

  const selectSlot = (slot: string) => {
    commit(slot);
    closeList();
  };

  const commitTyped = () => {
    /*
      Empty input with an empty value is NOT committed.

      `normalizeTime("", value ?? "00:00")` returned `00:00` for an empty value, and
      `next !== value` was true (`"00:00" !== null`): a user who tabbed through the form, touching
      the field and typing nothing, sent `onChange("00:00")` outward. The form became dirty, and
      the publish time jumped to midnight although no time had been selected.
    */
    if (inputTime.trim() === "" && !value) return;
    commit(
      twelve
        ? normalizeTime12(inputTime, value ?? "00:00", labels)
        : normalizeTime(inputTime, value ?? "00:00")
    );
  };

  const optionId = (slot: string) => `${listboxId}-${slot.replace(":", "")}`;

  // Keep the highlighted slot in view while navigating with the arrow keys.
  useEffect(() => {
    if (active < 0) return;
    const slot = visible[active];
    // `?.` on the method: jsdom does not implement it in tests.
    if (slot) document.getElementById(optionId(slot))?.scrollIntoView?.({ block: "nearest" });
  }, [active, visible]);

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        if (!open) openList();
        else if (visible.length > 0) setActive((a) => Math.min(a + 1, visible.length - 1));
        return;
      case "ArrowUp":
        if (!open) return;
        e.preventDefault();
        // The ends do not wrap around, as in the `Select` list.
        setActive((a) => Math.max(a - 1, 0));
        return;
      case "Enter":
        if (!open) return;
        e.preventDefault();
        if (active >= 0 && visible[active]) selectSlot(visible[active]);
        else {
          commitTyped();
          closeList();
        }
        return;
      case "Escape":
        // It closes here rather than through Radix: focus is in the field, not in the panel,
        // so the event never reaches the popover layer.
        //
        // Bubbling is not stopped: inside a dialog, Escape also closes the dialog, just as
        // it does for `Select`. The Radix dismissable layer listens on the document in the
        // capture phase, ahead of our handler, so `stopPropagation` here would change nothing.
        if (!open) return;
        e.preventDefault();
        closeList();
        return;
    }
  };

  return (
    <Popover open={open} onOpenChange={(v) => (v ? openList() : closeList())}>
      <PopoverAnchor asChild>
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          role="combobox"
          aria-label={ariaLabel ?? messages.timePicker.label}
          aria-expanded={open}
          aria-controls={open ? listboxId : undefined}
          aria-activedescendant={
            open && active >= 0 && visible[active] ? optionId(visible[active]) : undefined
          }
          aria-autocomplete="list"
          aria-invalid={ariaInvalid}
          aria-describedby={describedBy}
          placeholder={
            placeholder ??
            (twelve ? messages.timePicker.placeholder12 : messages.timePicker.placeholder)
          }
          maxLength={twelve ? 6 + Math.max(labels.am.length, labels.pm.length) : 5}
          value={inputTime}
          onClick={openList}
          onChange={(e) => {
            const masked = twelve
              ? maskTime12(e.target.value, labels, inputTime)
              : maskTime(e.target.value);
            setInputTime(masked);
            setFilter(masked);
            setActive(-1);
            if (!open) openList();
          }}
          onKeyDown={onKeyDown}
          onFocus={() => {
            setEditing(true);
            openList();
          }}
          onBlur={() => {
            // Editing is over. The sync with the accepted value is done by the effect on `[value]`:
            // here the prop is still the old one, and syncing in place would
            // overwrite the value that had just been accepted.
            setEditing(false);
            commitTyped();
            closeList();
          }}
          disabled={disabled}
          className={cn(
            twelve ? "w-[88px]" : "w-[60px]",
            "border-line-soft text-fg-2 hover:border-line hover:text-fg-1 placeholder:text-fg-4 cursor-text border-b bg-transparent pb-px font-mono text-[13px] transition-colors outline-none",
            "focus-visible:border-accent-strong disabled:cursor-not-allowed disabled:opacity-50",
            // The line under the time is the field's "border"; red, including on focus,
            // matches the wrapper of other fields.
            "aria-[invalid=true]:border-danger-strong",
            className
          )}
        />
      </PopoverAnchor>

      {visible.length > 0 ? (
        <PopoverContent
          className={twelve ? "w-[132px]" : "w-[96px]"}
          align="start"
          // Focus stays in the field: the panel is a hint for typing, not a separate step.
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
          // A non-modal popover dismisses itself when focus or a click lands "outside" the
          // content. Here focus is outside by definition: it is in the anchor field.
          // Without these two interceptors the panel vanishes the moment it opens.
          onFocusOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => {
            if (e.target === inputRef.current) e.preventDefault();
          }}
          // A click on a slot must not move focus out of the field (and trigger the blur commit
          // before the pick), so mousedown is cancelled before the browser moves focus.
          onMouseDown={(e) => e.preventDefault()}
        >
          <div
            id={listboxId}
            role="listbox"
            aria-label={ariaLabel ?? messages.timePicker.label}
            className="max-h-[240px] overflow-y-auto p-1"
          >
            {visible.map((slot, index) => {
              const isSelected = slot === value;
              return (
                <button
                  key={slot}
                  id={optionId(slot)}
                  type="button"
                  tabIndex={-1}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => selectSlot(slot)}
                  className={cn(
                    "flex w-full cursor-pointer items-center justify-between gap-2 rounded-sm px-2.5 py-[7px] text-left font-mono text-[13px] whitespace-nowrap tabular-nums transition-colors",
                    index === active && "bg-bg-2",
                    isSelected ? "bg-bg-3 text-fg-0" : "text-fg-1 hover:bg-bg-2"
                  )}
                >
                  {display(slot)}
                  {isSelected ? (
                    <CheckIcon size={14} aria-hidden className="text-accent-strong shrink-0" />
                  ) : null}
                </button>
              );
            })}
          </div>
        </PopoverContent>
      ) : null}
    </Popover>
  );
}
