import type { Tone } from "./variants.js";

/**
 * Appearance of a choice group.
 *
 * The axis name is `appearance`, not `variant`: in the kit `variant` already means
 * solid/soft/outline/ghost (the tone's treatment), while here it is not the treatment that changes
 * but the variant's form itself: a row with a circle, or a card. The ADR-0036 vocabulary neither
 * occupies nor forbids the name. In the Appearance category it is new in meaning, and a new meaning
 * gets a new name.
 */
export type ChoiceAppearance = "default" | "card";

/**
 * Border of a selected card, by tone.
 *
 * Its own table, not `TONE_TOKENS[tone].border`: for `neutral` there it is `border-line`, a neutral
 * divider border that the contrast gate deliberately does not measure, because it carries no meaning.
 * A selected card's border CONVEYS its state, so it is a signal under WCAG 1.4.11 with a 3:1 threshold,
 * and for `neutral` `fg-3` is used. The other tones are the same `*-strong` as the kit's borders.
 *
 * The same values as `STATE_BORDER` in `variants.ts` (the border of a checked checkbox box and of an
 * on `Toggle`): the card's border and the box's border inside it are one signal of one color. This
 * table does not reference that one: the gate script loads `choice-card.ts` directly through Node, and
 * Node does not map `.js` to `.ts`, so a runtime import from here would break it. The contrast gate
 * measures both tables.
 *
 * Literal strings in full: Tailwind scans the sources as text. `scripts/contrast.mjs` reads this table
 * and measures each entry against the backgrounds and against the card itself, `bg-2`.
 */
export const CHOICE_CARD_SELECTED_BORDER: Record<Tone, string> = {
  neutral: "border-fg-3",
  accent: "border-accent-strong",
  success: "border-success-strong",
  warning: "border-warning-strong",
  danger: "border-danger-strong",
};

/** Card border while nothing is selected. As neutral as the field borders. */
export const CHOICE_CARD_IDLE_BORDER = "border-line";

/** Card border in the error state: `danger`, regardless of the group's tone. */
export const CHOICE_CARD_INVALID_BORDER = "border-danger-strong";

/**
 * Card frame: the border and background on `RadioField`/`CheckboxField`. The frame has no padding of
 * its own; the label holds it (see `CHOICE_CARD_LABEL`).
 */
export const CHOICE_CARD_BASE = "flex flex-col rounded-lg border bg-bg-2 transition-colors";

/**
 * Disabled state from a `<fieldset disabled>` ancestor (this is how `Form` with `pending` dims its fields).
 *
 * React Aria does not know about such an ancestor: `isDisabled` is false, `data-disabled` is not set,
 * and `disabled:` does not fire. Only the control's hidden `input` sees the native state. That is why
 * this uses `has-[input:disabled]` rather than a bare `has-disabled`: the latter would catch any
 * disabled node inside, for example a button in the card's description, and would dim a working
 * control. Hover is dimmed together with the look: a disabled control must not react to the pointer.
 */
export const DIMMED_IN_DISABLED_FIELDSET =
  "has-[input:disabled]:cursor-default has-[input:disabled]:opacity-50 has-[input:disabled]:hover:bg-transparent";

/** The same for a card: its `bg-bg-2` background does not change on hover. */
export const CHOICE_CARD_DIMMED_IN_DISABLED_FIELDSET =
  "has-[input:disabled]:opacity-50 has-[input:disabled]:hover:bg-bg-2";

/** Card layout in a wrapping row: it grows, but does not spill out of the row. */
export const CHOICE_CARD_ROW = "max-w-xs flex-1 basis-48";

/**
 * Card label: the click area covers the whole card.
 *
 * THE WHOLE CARD IS THE LABEL, description included. The label covers the border (`-m-px` and a
 * one-pixel larger padding), so a click anywhere on the card is a click on the native radio or
 * checkbox. The first variant stretched the label's pseudo-element over the card and left the
 * description as a sibling. It worked with the mouse, but the pseudo-element intercepted the pointer
 * for all the content, and browser checks (Playwright) could not click the description: "the label
 * intercepts pointer events".
 *
 * The description inside the label is not part of the accessible name: it is hidden from assistive
 * technologies (`aria-hidden`) and is read through `aria-describedby`, which react-aria uses to link
 * it. A reference by ID works for a hidden element too.
 */
export const CHOICE_CARD_LABEL =
  "-m-px flex cursor-pointer items-start gap-3 rounded-lg p-[13px] disabled:cursor-default";

/** Focus ring on the card, not on the circle: the keyboard's focus cue is the whole card. */
export const CHOICE_CARD_FOCUS_RING = "ring-accent-strong ring-offset-bg-1 ring-2 ring-offset-1";

/** Icon slot: decorative, so it stays out of the name and has a fixed size. */
export const CHOICE_CARD_ICON = "text-fg-1 mt-0.5 flex size-5 shrink-0 items-center justify-center";
