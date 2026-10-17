"use client";

import { createContext, forwardRef, useContext, useMemo, type ReactNode } from "react";
import {
  RadioGroup as AriaRadioGroup,
  FieldError,
  Label,
  RadioButton,
  RadioField,
  Text,
} from "react-aria-components";
import { cn } from "../../lib/cn.js";
import { hasContent } from "../../lib/empty.js";
import { ChoiceCardBody } from "./ChoiceCardBody.js";
import {
  CHOICE_CARD_BASE,
  DIMMED_IN_DISABLED_FIELDSET,
  CHOICE_CARD_DIMMED_IN_DISABLED_FIELDSET,
  CHOICE_CARD_FOCUS_RING,
  CHOICE_CARD_IDLE_BORDER,
  CHOICE_CARD_INVALID_BORDER,
  CHOICE_CARD_LABEL,
  CHOICE_CARD_ROW,
  CHOICE_CARD_SELECTED_BORDER,
  type ChoiceAppearance,
} from "../../lib/choice-card.js";
import { TONE_TOKENS, type Size, type Tone } from "../../lib/variants.js";

export interface RadioGroupProps {
  /** `null` means nothing is selected. This state only occurs as the initial value. */
  value: string | null;
  /** Called when an option is selected; receives its `value`. */
  onChange: (value: string) => void;
  /**
   * The question the set answers. Required: buttons without a question are hard to make sense of.
   */
  label: ReactNode;
  /** Hint under the label of the set. */
  description?: ReactNode;
  /** Error message. Replaces `description` when set. */
  errorMessage?: ReactNode;
  /**
   * Option layout: `vertical` stacks them in a column, `horizontal` in a row. Defaults to
   * `vertical`.
   */
  orientation?: "vertical" | "horizontal";
  /** Disables the whole set. Overrides the `disabled` of individual buttons. */
  disabled?: boolean;
  /** Size of the radio buttons and labels: `sm` or `md`. Defaults to `md`. */
  size?: Extract<Size, "sm" | "md">;
  /**
   * Color of the selected button (in the card view, the border of the selected card).
   * Unselected buttons are always neutral: the same rule as `Checkbox`.
   */
  tone?: Tone;
  /**
   * Appearance of the set: `default` shows rows with a radio button, `card` shows cards.
   *
   * Appearance of the set: `default` shows rows with a circle, `card` shows cards with a label,
   * a description and an optional icon. It lives on the group and reaches the options through
   * context, so the set cannot come out of sync in appearance. Not `variant`: in the kit,
   * that already means how the tone is presented.
   */
  appearance?: ChoiceAppearance;
  /** `<Radio value="…">`, one per option. */
  children?: ReactNode;
  /** Classes for the root element of the set. */
  className?: string;
}

export interface RadioProps {
  /** The option's value; this is what the group's `onChange` receives. */
  value: string;
  /** The option's label. */
  children?: ReactNode;
  /** Hint under the option's label. */
  description?: ReactNode;
  /**
   * Icon of the option. Decorative: it is excluded from the accessible name, which the label
   * carries. In a card it sits at the start of the card; in the default view, between the radio
   * button and the label.
   */
  icon?: ReactNode;
  /** Disables one option; the others keep working. */
  disabled?: boolean;
  /** Classes for the option's element. */
  className?: string;
}

const SIZES: Record<"sm" | "md", { box: string; dot: string; label: string }> = {
  sm: { box: "size-4", dot: "size-1.5", label: "text-xs" },
  md: { box: "size-[18px]", dot: "size-2", label: "text-[13px]" },
};

/**
 * Tone and size reach the options from the group through context, not as props on each button:
 * the set must look the same, and letting one option drift away from its neighbors would
 * introduce a defect nobody notices. The context is its own, not `data-*` on the group: from CSS,
 * the tone could only be read back by gluing a class together from a prefix and an atom, and
 * Tailwind does not see such glued names.
 */
const RadioStyleContext = createContext<{
  size: "sm" | "md";
  tone: Tone;
  appearance: ChoiceAppearance;
  orientation: "vertical" | "horizontal";
}>({
  size: "md",
  tone: "accent",
  appearance: "default",
  orientation: "vertical",
});

/**
 * Radio group: selects one option from a set.
 *
 * THE GROUP HOLDS THE VALUE, not each button: `value`/`onChange` live here, and `Radio` has neither
 * `checked` nor `selected`. Which option is selected is a single value, and the kit's vocabulary
 * already has this shape for it (`Select`, `Segmented`). Storing it per button would allow the
 * state "two selected".
 *
 * THERE IS NO CLEARING, and this is not an oversight: a radio group cannot be cleared by
 * definition.
 * The set answers a question, and "no answer" is also an answer, so it is declared as an explicit
 * option ("doesn't matter", "any"). That is why `onChange` gives a `string`, not `string | null`:
 * `null` only occurs as an initial value passed in from outside.
 *
 * Built on `RadioField` + `RadioButton`, not on `Radio` from react-aria-components: in 1.19 the
 * latter is marked `@deprecated` in favor of this pair, exactly like `Checkbox`.
 */
export const RadioGroup = forwardRef<HTMLDivElement, RadioGroupProps>(function RadioGroup(
  {
    value,
    onChange,
    label,
    description,
    errorMessage,
    orientation = "vertical",
    disabled,
    size = "md",
    tone = "accent",
    appearance = "default",
    children,
    className,
  },
  ref
) {
  const card = appearance === "card";
  // The context value is a new object only when one of its fields changes: otherwise every render
  // of the group would re-render all options, even when the appearance had not changed.
  const style = useMemo(
    () => ({ size, tone, appearance, orientation }),
    [size, tone, appearance, orientation]
  );
  return (
    <AriaRadioGroup
      ref={ref}
      // In RAC, `null` means "a controlled group without a value", and `undefined` means
      // uncontrolled. The difference only shows up in the React console, so we normalize it
      // explicitly.
      value={value ?? null}
      onChange={onChange}
      isDisabled={disabled}
      isInvalid={errorMessage != null || undefined}
      orientation={orientation}
      className={cn("flex flex-col gap-1.5", className)}
    >
      <Label className="text-fg-2 text-[11px] font-bold tracking-wide uppercase">{label}</Label>
      <div
        className={cn(
          "flex",
          card ? "gap-3" : "gap-2",
          orientation === "vertical"
            ? "flex-col"
            : // Cards in a row stretch to the height of the tallest one, while regular
              // options are centered.
              cn("flex-row flex-wrap", card ? "items-stretch" : "items-center")
        )}
      >
        <RadioStyleContext.Provider value={style}>{children}</RadioStyleContext.Provider>
      </div>
      {errorMessage != null ? (
        <FieldError className="text-danger-strong text-[11px]">{errorMessage}</FieldError>
      ) : (
        description != null && (
          <Text slot="description" className="text-fg-3 text-[11px]">
            {description}
          </Text>
        )
      )}
    </AriaRadioGroup>
  );
});

/**
 * An option of the radio group.
 *
 * It does not work outside `RadioGroup` and must not: react-aria takes the state from the group's
 * context, and a lone button without it is a checkbox pretending to be a radio. Tone and size also
 * come from the group through context: keeping them as props on each button would let the set
 * drift apart visually.
 */
export const Radio = forwardRef<HTMLDivElement, RadioProps>(function Radio(
  { value, children, description, icon, disabled, className },
  ref
) {
  const { size, tone, appearance, orientation } = useContext(RadioStyleContext);

  if (appearance === "card") {
    return (
      <RadioField
        ref={ref}
        value={value}
        isDisabled={disabled}
        className={({ isSelected, isInvalid, isDisabled }) =>
          cn(
            CHOICE_CARD_BASE,
            isInvalid
              ? CHOICE_CARD_INVALID_BORDER
              : isSelected
                ? CHOICE_CARD_SELECTED_BORDER[tone]
                : CHOICE_CARD_IDLE_BORDER,
            isDisabled ? "opacity-50" : "hover:bg-bg-3",
            CHOICE_CARD_DIMMED_IN_DISABLED_FIELDSET,
            orientation === "horizontal" && CHOICE_CARD_ROW,
            className
          )
        }
      >
        <RadioButton
          className={({ isFocusVisible }) =>
            cn(CHOICE_CARD_LABEL, isFocusVisible && CHOICE_CARD_FOCUS_RING)
          }
        >
          {({ isSelected, isInvalid }) => (
            <ChoiceCardBody
              icon={icon}
              label={children}
              labelClassName={SIZES[size].label}
              description={description}
              indicator={
                <RadioBox selected={isSelected} invalid={isInvalid} focusVisible={false} card />
              }
            />
          )}
        </RadioButton>
      </RadioField>
    );
  }

  return (
    <RadioField
      ref={ref}
      value={value}
      isDisabled={disabled}
      className={cn("flex flex-col", className)}
    >
      <RadioButton
        className={
          "hover:bg-bg-2 flex w-fit cursor-pointer items-center gap-2 rounded-sm px-1 py-0.5 transition-colors " +
          "disabled:cursor-default disabled:opacity-50 " +
          DIMMED_IN_DISABLED_FIELDSET
        }
      >
        {({ isSelected, isInvalid, isFocusVisible }) => (
          <>
            <RadioBox selected={isSelected} invalid={isInvalid} focusVisible={isFocusVisible} />
            {hasContent(icon) && (
              <span aria-hidden="true" className="text-fg-2 flex shrink-0">
                {icon}
              </span>
            )}
            <RadioLabel label={children} />
          </>
        )}
      </RadioButton>
      {description != null && (
        <Text slot="description" className="text-fg-3 pl-[26px] text-[11px]">
          {description}
        </Text>
      )}
    </RadioField>
  );
});

/**
 * The circle with a dot.
 *
 * The state comes in as a render prop, and tone and size come from the group context. Otherwise
 * the two do not fit together: the dot is a descendant, while `data-selected` sits on the outer
 * `<label>`, and CSS could reach it only with a `group-selected:` form glued together from a prefix
 * and a tone atom. Tailwind does not see that glue: it scans the sources as plain text.
 *
 * In a card the circle stays: selection must not live on the border color alone. In this case the
 * circle has no focus ring of its own: the whole card serves as the keyboard focus indicator.
 */
function RadioBox({
  selected,
  invalid,
  focusVisible,
  card = false,
}: {
  selected: boolean;
  invalid: boolean;
  focusVisible: boolean;
  card?: boolean;
}) {
  const { size, tone } = useContext(RadioStyleContext);
  const s = SIZES[size];
  const t = TONE_TOKENS[tone];

  return (
    <span
      data-indicator=""
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full border transition-colors",
        card && "mt-0.5",
        s.box,
        // An unselected option is neutral in any tone: the `Checkbox` rule.
        selected ? t.border : "border-line bg-bg-2",
        invalid && "border-danger-strong",
        focusVisible && "ring-accent-strong ring-offset-bg-1 ring-2 ring-offset-1"
      )}
    >
      {selected && <span className={cn("rounded-full", s.dot, t.dotBg)} />}
    </span>
  );
}

/** Label of a regular option. */
function RadioLabel({ label }: { label: ReactNode }) {
  const { size } = useContext(RadioStyleContext);
  if (!hasContent(label)) return null;
  return <span className={SIZES[size].label}>{label}</span>;
}
