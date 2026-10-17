"use client";

import { createContext, forwardRef, useContext } from "react";
import { CheckboxButton, CheckboxField } from "react-aria-components";
import { CheckIcon, MinusIcon } from "../../icons.js";
import { cn } from "../../lib/cn.js";
import {
  CHOICE_CARD_BASE,
  CHOICE_CARD_DIMMED_IN_DISABLED_FIELDSET,
  CHOICE_CARD_FOCUS_RING,
  CHOICE_CARD_IDLE_BORDER,
  CHOICE_CARD_INVALID_BORDER,
  CHOICE_CARD_LABEL,
  CHOICE_CARD_ROW,
  CHOICE_CARD_SELECTED_BORDER,
} from "../../lib/choice-card.js";
import { STATE_BORDER, TONE_TOKENS } from "../../lib/variants.js";
import { ChoiceCardBody } from "./ChoiceCardBody.js";
import { CHECKBOX_SIZES, type CheckboxCardComponent } from "./Checkbox.js";

/**
 * Layout of a card set. It has its own context, not a field of the `Checkbox` context:
 * see `CheckboxCardComponent`.
 */
export const CheckboxCardLayoutContext = createContext<"vertical" | "horizontal">("vertical");

/**
 * Checkbox card: what `CheckboxGroup appearance="card"` renders instead of a row with a box.
 *
 * It is not exported from the package, and it is NOT imported from `Checkbox.tsx`. The
 * group puts it into the context, so only the one who uses the group pays for this code
 * in the bundle (see `CheckboxGroupStyleContext`). The tone arrives already resolved: it
 * is either the set's tone or the checkbox's own.
 */
export const CheckboxCard: CheckboxCardComponent = forwardRef<
  HTMLDivElement,
  Parameters<CheckboxCardComponent>[0]
>(function CheckboxCard(
  {
    checked,
    defaultChecked,
    indeterminate,
    onCheckedChange,
    children,
    label,
    description,
    icon,
    size = "md",
    tone,
    disabled,
    invalid,
    name,
    value,
    slot,
    className,
  },
  ref
) {
  const orientation = useContext(CheckboxCardLayoutContext);
  const t = TONE_TOKENS[tone];
  const s = CHECKBOX_SIZES[size];

  return (
    <CheckboxField
      ref={ref}
      slot={slot}
      isSelected={checked}
      defaultSelected={defaultChecked}
      isIndeterminate={indeterminate}
      onChange={onCheckedChange}
      isDisabled={disabled}
      isInvalid={invalid}
      name={name}
      value={value}
      aria-label={label}
      className={({ isSelected, isIndeterminate, isInvalid, isDisabled }) =>
        cn(
          CHOICE_CARD_BASE,
          isInvalid
            ? CHOICE_CARD_INVALID_BORDER
            : isSelected || isIndeterminate
              ? CHOICE_CARD_SELECTED_BORDER[tone]
              : CHOICE_CARD_IDLE_BORDER,
          isDisabled ? "opacity-50" : "hover:bg-bg-3",
          CHOICE_CARD_DIMMED_IN_DISABLED_FIELDSET,
          orientation === "horizontal" && CHOICE_CARD_ROW,
          className
        )
      }
    >
      {/*
        The hit area here is the whole card: the label covers the border (see
        `CHOICE_CARD_LABEL`). There are no two strips of a regular checkbox here: the
        card itself is taller than 24 pixels.
      */}
      <CheckboxButton
        className={({ isFocusVisible }) =>
          cn(CHOICE_CARD_LABEL, isFocusVisible && CHOICE_CARD_FOCUS_RING)
        }
      >
        {({ isSelected, isIndeterminate, isInvalid }) => {
          const on = isSelected || isIndeterminate;
          return (
            <ChoiceCardBody
              icon={icon}
              label={children}
              labelClassName={s.label}
              description={description}
              indicator={
                <span
                  data-indicator=""
                  className={cn(
                    "mt-0.5 flex shrink-0 items-center justify-center border transition-colors",
                    s.box,
                    // The border of a marked box: see `STATE_BORDER` and `Checkbox`.
                    on ? cn(t.solid, STATE_BORDER[tone]) : "border-line bg-bg-2",
                    isInvalid && "border-danger-strong"
                  )}
                >
                  {isIndeterminate ? (
                    <MinusIcon size={s.icon} strokeWidth={3} />
                  ) : isSelected ? (
                    <CheckIcon size={s.icon} strokeWidth={3} />
                  ) : null}
                </span>
              }
            />
          );
        }}
      </CheckboxButton>
    </CheckboxField>
  );
});
