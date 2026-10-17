"use client";

import { forwardRef, useMemo, type ReactNode } from "react";
import { CheckboxGroup as AriaCheckboxGroup, FieldError, Label, Text } from "react-aria-components";
import { cn } from "../../lib/cn.js";
import type { ChoiceAppearance } from "../../lib/choice-card.js";
import type { Tone } from "../../lib/variants.js";
import { CheckboxGroupStyleContext } from "./Checkbox.js";
import { CheckboxCard, CheckboxCardLayoutContext } from "./CheckboxCard.js";

export interface CheckboxGroupProps {
  /** Checked items: the array of `value`s of the group's checked checkboxes. */
  value: string[];
  /** Called when the set changes, with the new array of values. */
  onChange: (value: string[]) => void;
  /** Label of the whole group. Required: a set of checkboxes without a shared question is unreadable. */
  label: ReactNode;
  /** Description under the label. */
  description?: ReactNode;
  /** Error message. Replaces `description` when set. */
  errorMessage?: ReactNode;
  /** Layout of the checkboxes. Horizontal is for two or three short labels. */
  orientation?: "vertical" | "horizontal";
  /**
   * Disables the whole group: every item in it is unavailable.
   *
   * Disables the whole group. It overrides the `disabled` of individual checkboxes
   * rather than combining with it. If the whole group is unavailable, every item in it
   * is unavailable, and there can be no other reading.
   */
  disabled?: boolean;
  /** Marks the group as required to fill in (passed to `react-aria-components`). */
  isRequired?: boolean;
  /**
   * Tone of the set's checked checkboxes, one for all.
   *
   * The color of the set's checked checkboxes (in cards, also the border of the checked
   * card). It is one for the whole set, and it reaches the checkboxes through context, as
   * with `RadioGroup`. A `Checkbox` tone inside a group with this prop is ignored: the set
   * cannot diverge in look. If it is not set, each checkbox is colored by its own `tone`,
   * as it is outside a group. Unchecked ones are always neutral.
   */
  tone?: Tone;
  /**
   * Appearance of the group: `default` for rows with a box, `card` for cards.
   *
   * Appearance of the group: `default` for rows with a box, `card` for cards with a label,
   * a description and an optional icon. It lives on the group and reaches the checkboxes
   * through context. It is not called `variant`, because in the kit that already means the
   * tone's prominence.
   */
  appearance?: ChoiceAppearance;
  /** `<Checkbox value="…">`, one per item. */
  children?: ReactNode;
  /** Classes on the group's root element. */
  className?: string;
}

/**
 * Checkbox group.
 *
 * IT IS ASSEMBLED FROM `children`, NOT FROM AN `items` ARRAY. This is a deliberate
 * divergence from `Select` and `Segmented`.
 *
 * Those two render uniform rows: an item has a label, sometimes a picture and a counter,
 * and all of it is described by an object. A checkbox inside a group may have its own
 * description, its own `disabled`, its own icon and its own nested label markup. Describing
 * that with an object would require a second markup language next to JSX, and JSX is
 * already there.
 *
 * The group's value is an array. The state of an individual checkbox inside it is
 * determined by whether its `value` is in that array, so the children of the group have no
 * `checked` set at all. This is the same principle by which `RadioGroup` holds the value on
 * the group, not on each button.
 */
export const CheckboxGroup = forwardRef<HTMLDivElement, CheckboxGroupProps>(function CheckboxGroup(
  {
    value,
    onChange,
    label,
    description,
    errorMessage,
    orientation = "vertical",
    disabled,
    isRequired,
    tone,
    appearance = "default",
    children,
    className,
  },
  ref
) {
  // The context value is not recreated on every render. Otherwise every checkbox in the
  // set would re-render on any render of the group.
  const style = useMemo(
    () => ({ tone, Card: appearance === "card" ? CheckboxCard : undefined }),
    [tone, appearance]
  );
  return (
    <AriaCheckboxGroup
      ref={ref}
      value={value}
      onChange={onChange}
      isDisabled={disabled}
      isRequired={isRequired}
      isInvalid={errorMessage != null || undefined}
      className={cn("flex flex-col gap-1.5", className)}
    >
      <Label className="text-fg-2 text-[11px] font-bold tracking-wide uppercase">{label}</Label>
      <div
        className={cn(
          "flex",
          appearance === "card" ? "gap-3" : "gap-2",
          orientation === "vertical"
            ? "flex-col"
            : cn("flex-row flex-wrap", appearance === "card" ? "items-stretch" : "items-center")
        )}
      >
        <CheckboxGroupStyleContext.Provider value={style}>
          <CheckboxCardLayoutContext.Provider value={orientation}>
            {children}
          </CheckboxCardLayoutContext.Provider>
        </CheckboxGroupStyleContext.Provider>
      </div>
      {/*
          The error REPLACES the description rather than sitting under it. Two lines under
          a group, one of which contradicts the other, are a source of noise.
          The same rule as `FormField`.
        */}
      {errorMessage != null ? (
        <FieldError className="text-danger-strong text-[11px]">{errorMessage}</FieldError>
      ) : (
        description != null && (
          <Text slot="description" className="text-fg-3 text-[11px]">
            {description}
          </Text>
        )
      )}
    </AriaCheckboxGroup>
  );
});
