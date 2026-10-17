"use client";

import {
  useRef,
  type ClipboardEvent,
  type KeyboardEvent,
  type ComponentPropsWithoutRef,
} from "react";
import { useDescribedBy, useFieldInvalid } from "../../hooks/useFieldDescription.js";
import { cn } from "../../lib/cn.js";
import { useMessages } from "../../i18n/useMessages.js";
import { FIELD_SHELL_CLASS } from "../../lib/field.js";

export interface PinInputProps extends Omit<
  ComponentPropsWithoutRef<"div">,
  "onChange" | "children" | "defaultValue"
> {
  /** The entered code. The value is a string, not an array: consumers need the code as a whole. */
  value: string;
  /** Called on typing, deleting and pasting; receives the whole code as a string. */
  onChange: (value: string) => void;
  /** Number of fields. */
  length?: number;
  /**
   * The accessible name of the group. Required, and enforced by the compiler, as for
   * `SearchControl`: without it, screen readers announce the group as unnamed.
   */
  label: string;
  /** Disables all code fields. */
  disabled?: boolean;
  /** Moves focus to the first field on mount. */
  autoFocus?: boolean;
  /**
   * Shows the code in the error state: the field borders turn red and each field
   * gets `aria-invalid`. Inside a `FormField` with `error`, the flag comes from the form;
   * an explicit `invalid={false}` overrides it. The validation rule stays with the consumer.
   */
  invalid?: boolean;
}

/** The code is numeric: anything other than digits is dropped on input and on paste. */
const digitsOnly = (raw: string) => raw.replace(/\D/g, "");

/**
 * Input for a verification code: N fields with one character each, exposed as one string.
 *
 * THE VALUE IS A STRING, NOT AN ARRAY. Consumers need the whole code: it goes into a
 * request as one string, and each caller would have to parse an array on its own.
 * A consequence worth knowing up front: **there are no gaps in the value.** The fields
 * display one value, not N independent ones, and deleting a character in the middle
 * shifts the rest left, as in an ordinary text field.
 *
 * PASTE IS REQUIRED, NOT OPTIONAL. The code arrives from an SMS as a whole, and the user
 * pastes it into the first field; without paste handling, they would get one digit out of six.
 * The browser does not help here: with `maxLength=1` it trims the pasted text to the first
 * character by itself, so the event is intercepted.
 *
 * `autocomplete="one-time-code"` is set on the FIRST field, so the browser and iOS
 * suggest the code from the notification. The other fields don't need it, and it would get in the
 * way.
 *
 * THE CODE IS NUMERIC. `inputMode="numeric"` and `one-time-code` are about digits, and the input
 * filter is the same. A letter code would need a second axis and case rules; it will come
 * with the screen that needs it, not before.
 *
 * Each field is NAMED ("digit 3 of 6"): otherwise a screen reader reads six unnamed fields
 * in a row and the position in the code is lost.
 */
export function PinInput({
  value,
  onChange,
  length = 6,
  label,
  disabled,
  autoFocus,
  invalid,
  className,
  ...rest
}: PinInputProps) {
  const messages = useMessages();
  /*
    An explicit prop wins over the form, as in `TextControl`: the consumer knows more about
    its field than `FormField` does. Without `aria-invalid` on the fields themselves, the shell
    does not turn red: `FIELD_SHELL_CLASS` looks for the attribute on the `input`, not on the group.
  */
  const fieldInvalid = useFieldInvalid();
  const ariaInvalid = invalid ?? (fieldInvalid || undefined);
  const describedBy = useDescribedBy((rest as { "aria-describedby"?: string })["aria-describedby"]);
  const fields = useRef<(HTMLInputElement | null)[]>([]);
  const chars = Array.from({ length }, (_, i) => value[i] ?? "");

  const focusAt = (index: number) => {
    const target = fields.current[Math.max(0, Math.min(length - 1, index))];
    target?.focus();
    target?.select();
  };

  const commit = (next: string, focus: number) => {
    onChange(next.slice(0, length));
    focusAt(focus);
  };

  const handleChange = (index: number, raw: string) => {
    const typed = digitsOnly(raw);
    const head = chars.slice(0, index).join("");
    const tail = chars.slice(index + 1).join("");

    if (typed === "") {
      // An empty string and "a non-digit was typed" are DIFFERENT events, and they must be
      // told apart. Focus selects the field's content, so a letter typed over a filled field
      // arrives here as a replacement. Without the distinction, the component erased the digit
      // and replaced it with a letter that was never shown.
      if (raw !== "") return;
      // The field was cleared: the character is removed and the rest shift left; the value stays
      // one.
      commit(head + tail, index);
      return;
    }
    commit(head + typed + tail, index + typed.length);
  };

  const handleKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace" && chars[index] === "" && index > 0) {
      // Backspace on an empty field steps back and deletes there. Otherwise focus gets stuck
      // in the empty field, and there is nothing to erase the previous digit with.
      event.preventDefault();
      commit(chars.slice(0, index - 1).join("") + chars.slice(index).join(""), index - 1);
      return;
    }
    if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      focusAt(index - 1);
    }
    if (event.key === "ArrowRight" && index < length - 1) {
      event.preventDefault();
      focusAt(index + 1);
    }
  };

  const handlePaste = (index: number, event: ClipboardEvent<HTMLInputElement>) => {
    const pasted = digitsOnly(event.clipboardData.getData("text"));
    if (pasted === "") return;
    event.preventDefault();
    const head = chars.slice(0, index).join("");
    commit(head + pasted, index + pasted.length);
  };

  return (
    <div
      role="group"
      aria-label={label}
      className={cn("flex gap-2", className)}
      {...rest}
      /*
        AFTER `{...rest}`: the value is already merged with the user's one above, and the spread
        must not override it. Previously the conditional spread stood BEFORE `rest` (the only one
        of its kind in the kit), and a foreign `aria-describedby` overwrote the context one: a code
        field inside `<FormField error="…">` did not announce the error at all.

        The `FormField` hint applies to the WHOLE group of code fields, not to one cell: six
        `aria-describedby` on six `input`s would be read six times in a row.
      */
      {...(describedBy ? { "aria-describedby": describedBy } : {})}
    >
      {chars.map((char, index) => (
        <div key={index} className={cn(FIELD_SHELL_CLASS, "w-10 px-0")}>
          <input
            ref={(node) => {
              fields.current[index] = node;
            }}
            value={char}
            disabled={disabled}
            autoFocus={autoFocus && index === 0}
            inputMode="numeric"
            autoComplete={index === 0 ? "one-time-code" : "off"}
            aria-label={messages.pinInput.digit({ index: index + 1, total: length })}
            maxLength={1}
            aria-invalid={ariaInvalid}
            data-disable-focus-ring="true"
            // The content is selected on focus: with `maxLength=1`, typing over a filled field
            // otherwise doesn't go through at all, because the browser has nowhere to write.
            onFocus={(event) => event.currentTarget.select()}
            onChange={(event) => handleChange(index, event.target.value)}
            onKeyDown={(event) => handleKeyDown(index, event)}
            onPaste={(event) => handlePaste(index, event)}
            className={
              "text-fg-0 w-full [appearance:none] border-0 bg-transparent px-0 py-[10px] " +
              "text-center text-[15px] leading-5 tabular-nums shadow-none outline-none " +
              "[-webkit-tap-highlight-color:transparent] focus:outline-none " +
              "focus-visible:outline-none disabled:cursor-not-allowed"
            }
          />
        </div>
      ))}
    </div>
  );
}
