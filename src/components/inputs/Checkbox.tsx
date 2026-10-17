"use client";

import {
  createContext,
  forwardRef,
  useContext,
  type ForwardRefExoticComponent,
  type ReactNode,
  type RefAttributes,
} from "react";
import { CheckboxButton, CheckboxField, Text } from "react-aria-components";
import { CheckIcon, MinusIcon } from "../../icons.js";
import { DIMMED_IN_DISABLED_FIELDSET } from "../../lib/choice-card.js";
import { cn } from "../../lib/cn.js";
import { hasContent } from "../../lib/empty.js";
import { STATE_BORDER, TONE_TOKENS, type Size, type Tone } from "../../lib/variants.js";

export interface CheckboxProps {
  /** Visible label to the right of the checkbox. */
  children?: ReactNode;
  /**
   * Accessible name for a checkbox without a visible label: in a table header or
   * in a list row. When there is a visible label, there is no need to set it:
   * the screen reader announces the label.
   *
   * The compiler does not require a name, and this is deliberate. A union type
   * ("either `children` or `label`") breaks in two places at once: the third
   * argument of `createElement` does not collapse into the union check, and `Omit`
   * over a union collapses it. So both the class-coverage matrix and any wrapper in
   * the stories would fail. The same trade-off is already described for
   * `Button.iconOnly`, and it is resolved the same way there: the name is guarded
   * not by the compiler but by the axe audit. An unnamed checkbox fails it as
   * `critical`. The check lives in `tests-visual/a11y.spec.ts`.
   */
  label?: string;
  /** Whether the checkbox is checked. A controlled value: update it in `onCheckedChange`. */
  checked?: boolean;
  /** Initial state of an uncontrolled checkbox: whether it is checked on first render. */
  defaultChecked?: boolean;
  /**
   * Third state: "some items are selected".
   *
   * Overrides `checked` when rendering and is not cleared by a click. The user toggles
   * the checkbox on and off, while "partially" is set only by the caller, who recomputes
   * the set. This is the react-aria-components (RAC) behavior, and it is the only sensible
   * one: clearing "partially" with a click would mean inventing on the user's behalf
   * what they meant.
   */
  indeterminate?: boolean;
  /** Called when the checked state changes, with the new state. */
  onCheckedChange?: (checked: boolean) => void;
  /** Description under the label. */
  description?: ReactNode;
  /**
   * Item icon. Decorative: it is excluded from the accessible name, which the label carries. In a
   * card it sits at the start; in the default view, between the checkbox and the label.
   */
  icon?: ReactNode;
  /** Checkbox size: `sm` is smaller, `md` larger. Defaults to `md`. */
  size?: Extract<Size, "sm" | "md">;
  /**
   * React Aria slot: `selection` marks a selection checkbox in a table or a list.
   *
   * Through it the component takes its state from the collection context, including
   * "some but not all selected" for a checkbox in the header. Without the slot, such a
   * checkbox would have to be wired to the selection by hand, repeating the library's
   * work, and it would silently stay mute: no check mark and no indeterminate state.
   */
  slot?: string;
  /**
   * Tone of a checked checkbox. An unchecked one is always neutral.
   *
   * The color of the checked state (in a card, also the border of the checked card).
   * It does not affect an unchecked checkbox: that one is always neutral, like an
   * unselected `Chip`. Here the tone means "what agreeing means", not "what color the
   * border is".
   *
   * Inside a `CheckboxGroup` with a set `tone`, it is ignored: the group's tone is the same
   * for all. A group without `tone`, and a checkbox outside a group, work as before.
   */
  tone?: Tone;
  /** Disables the checkbox: it cannot be checked or unchecked. */
  disabled?: boolean;
  /** Shows the checkbox in the error state. */
  invalid?: boolean;
  /** Name and value for native form submission. */
  name?: string;
  /**
   * Value for native form submission. Inside a `CheckboxGroup`, it is the item's key
   * in the group's array.
   */
  value?: string;
  /** Classes for the root element. */
  className?: string;
}

/**
 * Card that `CheckboxGroup appearance="card"` renders instead of a row.
 *
 * It receives all the checkbox props and the already-resolved `tone`, which is the
 * result of choosing between the group's tone and its own. It takes the set's layout
 * from its own context, not from here: a plain checkbox has no use for it, and every
 * extra field in this file is also paid for by `DataTable`.
 */
export type CheckboxCardComponent = ForwardRefExoticComponent<
  CheckboxProps & { tone: Tone } & RefAttributes<HTMLDivElement>
>;

/**
 * Context of a checkbox set: the tone and, for cards, the card renderer.
 *
 * `Card` lives in the context rather than being imported into this file, and this is
 * not a matter of taste but of bundle size. A bare `Checkbox` lives without a group, in
 * the header and rows of `DataTable`. Importing the card branch from here pulled its
 * code into every such bundle (`DataTable` grew from 5.4 to 5.9 kB gzip for code it
 * does not show). Now only `CheckboxGroup` knows about the card: it puts the card into
 * the context, and a checkbox uses only what arrives.
 *
 * The set's `tone` is optional, and "not set" is a separate value, not `accent`. That
 * is exactly what leaves each checkbox its own tone. `RadioGroup` always has a tone,
 * because `Radio` has none of its own.
 */
export const CheckboxGroupStyleContext = createContext<{
  tone?: Tone;
  Card?: CheckboxCardComponent;
}>({});

/** Checkbox box sizes: shared by the regular view and the card. */
export const CHECKBOX_SIZES: Record<"sm" | "md", { box: string; label: string; icon: number }> = {
  sm: { box: "size-4 rounded-xs", label: "text-xs", icon: 11 },
  md: { box: "size-[18px] rounded-xs", label: "text-[13px]", icon: 13 },
};

/**
 * Checkbox.
 *
 * It is `checked` here, not `selected` from the shared vocabulary: a checkbox has a
 * native ARIA concept (`aria-checked`), and replacing it with our own term would
 * diverge from the standard. Same decision as `Toggle`.
 *
 * It is built on `CheckboxField` + `CheckboxButton`, NOT on `Checkbox` from
 * react-aria-components: in 1.19 the latter is marked `@deprecated` in favor of this
 * pair. The first component of the wave built on a deprecated export would become a
 * migration debt for the whole package.
 *
 * THE LOOK OF THE BOX IS SET THROUGH A RENDER PROP, not through `selected:` / `invalid:`
 * variants. The reason is not stylistic. The box is a child `span`, while the state
 * attributes (`data-selected`, `data-invalid`) sit on the outer `<label>`. Reaching them
 * from there would be possible only with the `group-selected:` form, and that would have
 * to be assembled from a prefix and a tone atom, which is exactly what the vocabulary
 * forbids: Tailwind scans sources as text, and a class built at runtime silently does not
 * reach the CSS. The render prop passes the state straight into JS, and a ready literal
 * string is taken from the table.
 *
 * On the `<label>` itself, the states are set by variants instead. `hover:` and
 * `disabled:` work there on the RAC element thanks to the plugin's double selector (see
 * `styles.css`).
 */
export const Checkbox = forwardRef<HTMLDivElement, CheckboxProps>(function Checkbox(props, ref) {
  const {
    checked,
    defaultChecked,
    indeterminate,
    onCheckedChange,
    children,
    label,
    description,
    icon,
    size = "md",
    tone: ownTone = "accent",
    disabled,
    invalid,
    name,
    value,
    slot,
    className,
  } = props;
  const { tone: groupTone, Card } = useContext(CheckboxGroupStyleContext);
  // The group's tone, if set, overrides the checkbox's own: a group cannot diverge in
  // look, the same rule as `RadioGroup`. If not set, each checkbox has its own tone, as
  // it does outside a group.
  const tone = groupTone ?? ownTone;
  const t = TONE_TOKENS[tone];
  const s = CHECKBOX_SIZES[size];

  // All props go to the card as a single object, not as a list by field. A list of
  // seventeen names does not get minified in the bundle (property names stay), and it
  // lands in every `DataTable`, even where there are no cards at all.
  if (Card) return <Card {...props} ref={ref} tone={tone} />;

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
      className={cn("flex flex-col gap-1", className)}
    >
      {/*
        THE HIT AREA IS EXTENDED BY TWO STRIPS, ONE ABOVE AND ONE BELOW THE CONTROL.

        Measured in 3.12.0: a `md` checkbox without a visible label has a 26×22 target,
        and an `sm` one with a label has 20 in height. So of the four combinations of size
        and label, the WCAG 2.5.8 threshold (24×24) passed exactly one: `md` with a label.
        Even that passed thanks to the line box of the text, not to its own geometry.

        Formally, a consumer may have no violation: the criterion has a Spacing exception,
        and a list row passes it when the neighboring targets are far enough apart. But it
        passes by the DISTANCE TO THE NEIGHBORS, which the kit does not control. Put one more
        control next to it, and the exception disappears while the checkbox itself did not
        change. Relying on someone else's layout is not allowed, so the target is extended
        here.

        With pseudo-elements rather than margins. Margins would also raise the height in the
        layout, and the layout is held by a list row of 32 pixels, into which the checkbox
        must fit. In the layout the control stays the same, and it is caught by a finger and
        a mouse at a minimum of 24.

        Two strips AT THE EDGES, not one layer over the whole control, and this is not a
        nitpick about form. A layer over it intercepted the pointer over its own label: a
        click on the text reached the label (the pseudo-element belongs to it), but everything
        that checks overlap, from Playwright to text selection, ran into it. Moving the layer
        under the content with `-z-10` is not possible either. A negative layer goes behind
        the ancestor's background, and the extended zone stops catching clicks entirely. Both
        approaches were checked in a live browser.

        2 pixels on each side, not exactly as much as is missing. The control's height depends
        on both the size and whether a visible label is present, from 20 to 24. The same pair
        of strips brings any of them to 24 and more. Computing the shortfall with a class built
        at runtime is not possible: Tailwind scans sources as text.
      */}
      <CheckboxButton
        className={
          "hover:bg-bg-2 relative flex w-fit cursor-pointer items-center gap-2 rounded-sm px-1 py-0.5 " +
          "transition-colors disabled:cursor-default disabled:opacity-50 " +
          // `disabled:` matches only the element's own `isDisabled`. For a disabled
          // ancestor `fieldset`, see `DIMMED_IN_DISABLED_FIELDSET`.
          DIMMED_IN_DISABLED_FIELDSET +
          " " +
          "before:absolute before:inset-x-0 before:bottom-full before:h-0.5 before:content-[''] after:absolute after:inset-x-0 after:top-full after:h-0.5 after:content-['']"
        }
      >
        {({ isSelected, isIndeterminate, isInvalid, isFocusVisible }) => {
          const on = isSelected || isIndeterminate;
          return (
            <>
              <span
                className={cn(
                  "flex shrink-0 items-center justify-center border transition-colors",
                  s.box,
                  // The border of a marked box is `STATE_BORDER`, not the default color
                  // (`currentcolor` = the checkmark's color). A fill against the background
                  // does not reach 3:1, and the box's edge is held by the border.
                  on ? cn(t.solid, STATE_BORDER[tone]) : "border-line bg-bg-2",
                  isInvalid && "border-danger-strong",
                  isFocusVisible && "ring-accent-strong ring-offset-bg-1 ring-2 ring-offset-1"
                )}
              >
                {isIndeterminate ? (
                  <MinusIcon size={s.icon} strokeWidth={3} />
                ) : isSelected ? (
                  <CheckIcon size={s.icon} strokeWidth={3} />
                ) : null}
              </span>
              {hasContent(icon) && (
                <span aria-hidden="true" className="text-fg-2 flex shrink-0">
                  {icon}
                </span>
              )}
              {children != null && <span className={s.label}>{children}</span>}
            </>
          );
        }}
      </CheckboxButton>
      {description != null && (
        <Text slot="description" className="text-fg-3 pl-[26px] text-[11px]">
          {description}
        </Text>
      )}
    </CheckboxField>
  );
});
