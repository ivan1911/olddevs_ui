"use client";

import { forwardRef } from "react";
import { Button, Group, Input, NumberField } from "react-aria-components";
import { useFieldDescribedBy, useFieldInvalid } from "../../hooks/useFieldDescription.js";
import { cn } from "../../lib/cn.js";
import { useMessages } from "../../i18n/useMessages.js";
import { FIELD_INPUT_CLASS, FIELD_SHELL_CLASS } from "../../lib/field.js";

export interface NumberInputProps {
  /** `null` means the field is empty. This is not the same as an entered zero. */
  value: number | null;
  /** Called when the number changes; `null` means the field was cleared. */
  onChange: (value: number | null) => void;
  /** The smallest allowed value. */
  min?: number;
  /** The largest allowed value. */
  max?: number;
  /** The step for the buttons and the keyboard arrows. */
  step?: number;
  /** The display format: percentages, currency, units. Passed to `Intl.NumberFormat`. */
  formatOptions?: Intl.NumberFormatOptions;
  /** The placeholder in an empty field. */
  placeholder?: string;
  /** Disables the field and the step buttons. */
  disabled?: boolean;
  /** Shows the field in the error state. */
  invalid?: boolean;
  /**
   * The accessible name. Required, and checked by the compiler, the same as for `Toggle`.
   *
   * The label from `FormField` cannot reach here: react-aria generates the `id` of the inner
   * field itself, and there is no way to link a foreign `<label htmlFor>` to it.
   * So the component keeps the name itself.
   */
  label: string;
  /** Classes for the wrapper around the frame: width, radius, inner padding. */
  shellClassName?: string;
  /** Classes for the root element. */
  className?: string;
}

const STEP_BUTTON_CLASS =
  "text-fg-2 hover:text-fg-0 hover:bg-bg-3 flex size-6 shrink-0 items-center justify-center " +
  "rounded-xs text-[15px] leading-none transition-colors disabled:pointer-events-none disabled:opacity-40";

/**
 * A numeric field with step buttons.
 *
 * AN EMPTY FIELD RETURNS `null`, NOT ZERO. Zero is an entered value, and the value itself
 * must tell it apart from "nothing entered", not a guess by the consumer. It is the same
 * logic by which `Select` returns `null` when it is cleared.
 * Inside react-aria, emptiness is expressed as `NaN`; it does not leave the component,
 * because `NaN` is not equal to itself, and a consumer who compared it with anything
 * would silently get a wrong result.
 *
 * The frame, focus, and disabled look are shared with `TextControl`, from `lib/field.ts`.
 * This is not a copy: two fields side by side in one form must focus the same way, and copied
 * classes drift apart. That is exactly what happened on the front end with five search fields
 * before the package existed.
 *
 * Parsing and formatting by `formatOptions` belong to react-aria: the locale, digit grouping,
 * the percent sign, input such as "1 234,5". All of that is its job, and repeating it here
 * would mean writing a second library.
 */
export const NumberInput = forwardRef<HTMLDivElement, NumberInputProps>(function NumberInput(
  {
    value,
    onChange,
    min,
    max,
    step,
    formatOptions,
    placeholder,
    disabled,
    invalid,
    label,
    shellClassName,
    className,
  },
  ref
) {
  const messages = useMessages();
  // A hint or error from `FormField`. `NumberField` passes the attribute down to its own
  // `Input` itself: the component has no description prop of its own, so there is nothing to merge.
  const describedBy = useFieldDescribedBy();
  // The error from `FormField` reaches the field the same way as in `TextControl`; an explicit
  // `invalid` takes precedence over the form.
  const fieldInvalid = useFieldInvalid();
  return (
    <NumberField
      ref={ref}
      value={value ?? Number.NaN}
      onChange={(next) => onChange(Number.isNaN(next) ? null : next)}
      minValue={min}
      maxValue={max}
      step={step}
      formatOptions={formatOptions}
      isDisabled={disabled}
      isInvalid={invalid ?? (fieldInvalid || undefined)}
      aria-label={label}
      aria-describedby={describedBy}
      className={className}
    >
      <Group
        className={cn(
          FIELD_SHELL_CLASS,
          "flex items-center gap-1",
          // The red frame of an invalid field moved to `FIELD_SHELL_CLASS`: the frame itself
          // lives there too, so the rule applies to every field on this shell, not
          // only to the number field. The `data-invalid` attribute, which the `invalid:` variant
          // matches, is still on this group.
          shellClassName
        )}
      >
        <Button
          slot="decrement"
          className={STEP_BUTTON_CLASS}
          aria-label={messages.numberInput.decrement({ label: label ?? "" })}
        >
          −
        </Button>
        <Input
          data-disable-focus-ring="true"
          placeholder={placeholder}
          className={cn(FIELD_INPUT_CLASS, "min-w-0 flex-1 text-center tabular-nums")}
        />
        <Button
          slot="increment"
          className={STEP_BUTTON_CLASS}
          aria-label={messages.numberInput.increment({ label: label ?? "" })}
        >
          +
        </Button>
      </Group>
    </NumberField>
  );
});
