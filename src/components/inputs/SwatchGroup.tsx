"use client";

import { useRef, type KeyboardEvent, type ReactNode } from "react";
import {
  Label,
  RadioButton,
  RadioField,
  RadioGroup as AriaRadioGroup,
} from "react-aria-components";
import { cn } from "../../lib/cn.js";
import { LABEL_BG_CLASS, type LabelHue } from "../../lib/variants.js";
import { Tooltip } from "../overlays/Tooltip.js";
import { VisuallyHidden } from "../content/VisuallyHidden.js";

export interface SwatchOption<T extends string = string> {
  /** The option's value; this is what arrives in `onChange`. */
  value: T;
  /**
   * The hue from the label palette.
   *
   * Not set: the swatch is empty, an outline without a fill. That is how the "no color" option is
   * built, and it needs no separate support: the absence of a color is the same kind of answer to
   * the set's question as any hue.
   */
  hue?: LabelHue;
  /**
   * The option's name as a WORD: this is what a screen reader announces.
   *
   * Required, and separate from `hue`, because these are different values: the color is for the
   * eye, the name is for the ear; the name gets translated, the color does not. Without it, nine
   * identical radio buttons in a row cannot be told apart at all.
   */
  name: string;
  /** Disables this one swatch. */
  disabled?: boolean;
}

export interface SwatchGroupProps<T extends string = string> {
  /**
   * The selected value.
   *
   * No `null`, unlike `RadioGroup`: the set here is closed and non-empty by construction, and
   * "nothing selected" is expressed as a regular option.
   */
  value: T;
  /** Called when a swatch is selected; receives its `value`. */
  onChange: (value: T) => void;
  /** The question the set answers. Required, as on `RadioGroup`. */
  label: ReactNode;
  /** The set's swatches: the value, name and hue of each one. */
  options: SwatchOption<T>[];
  /**
   * How many swatches sit in a row.
   *
   * A number, not `auto-fill`, and this is not a CSS shortcut. Vertical arrows move along the
   * columns, so the component has to know how many there are. With `auto-fill` it would learn that
   * only by measuring, and the keyboard would silently change with the container's width: on a
   * narrow screen "down" would move somewhere other than where the eye expects.
   */
  columns?: number;
  /**
   * Whether to show the option's name as a tooltip on hover and on focus.
   *
   * The content is the same `name` that goes to the screen reader: the consumer translates the
   * name, and the kit knows nothing about the language. The tooltip has no timing of its own; the
   * delay comes from the shared `TooltipProvider`.
   *
   * OFF BY DEFAULT, and this is not caution for its own sake: a tooltip needs a `TooltipProvider`
   * in the app, and without one Radix throws on the very first option. The set shipped before the
   * tooltip existed and is already used by consumers without a provider; a default of "on" would
   * break them on a patch update.
   *
   * The prop is on the GROUP, not on an option: the set must behave the same everywhere, and a
   * tooltip on three swatches out of nine would look like a bug.
   *
   * There is no tooltip on touch: that is how the gesture itself works, not this implementation.
   * The name is still available only to the ear there.
   */
  tooltips?: boolean;
  /** Disables the whole set. */
  disabled?: boolean;
  /** Classes for the root element. */
  className?: string;
}

/**
 * Swatch: a 24-pixel circle.
 *
 * The swatch itself carries neither selection nor focus: both are drawn as rings around it, on the
 * backing. The details are next to `OPTION_CLASS`.
 */
const SWATCH_CLASS = "block size-6 rounded-full";

/** An empty swatch is an outline: "no color" is an answer, not a missing option. */
const EMPTY_SWATCH_CLASS = "border-line border bg-transparent";

/**
 * An option: the swatch plus the padding that the rings are drawn around.
 *
 * SELECTION IS A RING AROUND THE SWATCH, NOT A SECOND COLOR AND NOT AN OUTLINE INSIDE.
 *
 * Not a second color: that is exactly the defect that made this component necessary. In the
 * consumer's app the selected option was highlighted in the blue accent next to a turquoise swatch,
 * and the two colors fought. The accent is also set by the brand: a blue ring around a blue swatch
 * would not be visible at all.
 *
 * Not inside: there the ring lies ON the hue, and there are eight hues. Measured against the tokens:
 * `fg-0` against the fills gives between 1.71 (turquoise in the dark theme) and 2.98 — that is,
 * below 3:1, which WCAG 1.4.11 requires for a state indicator. The kit's contrast gate does not
 * catch such a pair: it checks the declared pairs of tokens, and "ring on the swatch" is not
 * declared as a pair.
 *
 * Outside, the ring lies on the BACKING, and there the same pair gives more than 12:1 in any theme —
 * the `p-1` padding keeps four pixels between the swatch and the ring.
 *
 * The ring also changes the SHAPE of the option, not only its color: "selected" and "not selected"
 * cannot be told apart by saturation alone.
 *
 * The focus ring is accent-colored and sits two pixels further out, so on a selected option in
 * focus both indicators are visible, not one on top of the other.
 */
const OPTION_CLASS =
  // `transition-shadow`, not `transition-colors`: the rings are drawn with a shadow, and the color
  // of the option never changes at all — a color transition class would promise something that is
  // not here.
  "block cursor-pointer rounded-full p-1 transition-shadow disabled:cursor-default " +
  "disabled:opacity-50";

/**
 * A way to select one value from a closed set, where each option is shown as a COLOR SWATCH, not as
 * text: a project color, a label hue, a calendar color.
 *
 * WHY THIS IS NOT A `RadioGroup` WITH A DOT INSIDE. There each option has two circles in a row — the
 * radio indicator and the swatch — and on a grid of nine that is a ripple in which the colors cannot
 * be compared. Moreover the radio indicator's color comes from the group as a tone, and a tone is
 * semantic (`danger` means "destructive", not "red"): a label hue does not map onto that axis, and
 * they cannot be spread across the options — the set must look the same everywhere.
 *
 * WHY NOT `ColorPicker`. That one is about an ARBITRARY color and deliberately emits it outside the
 * token system; here the reverse is needed — a key from a closed set that the theme will expand.
 * Besides, it lives in a separate entry point and costs as much as the rest of the kit.
 *
 * THE FILL IS A HUE FROM THE LABEL PALETTE, NOT A READY-MADE CLASS AND NOT A COLOR STRING. A class
 * from outside would mean a color outside the tokens (and would not survive a theme change), and a
 * color string would mean a second palette next to the one already shipped. There are eight hues;
 * they are closed and do not depend on the accent or the brand.
 *
 * KEYBOARD — RADIO GROUPS, but along the grid: Tab moves focus to the selected option, horizontal
 * arrows go along the row and move to the neighbor at its edge (the radio group itself does this),
 * vertical arrows go along the columns via `columns`, and Home and End go to the first and last
 * option. The selection applies at once: the set answers one question, and there is nothing to
 * confirm.
 */
export function SwatchGroup<T extends string = string>({
  value,
  onChange,
  label,
  options,
  columns = 6,
  tooltips,
  disabled,
  className,
}: SwatchGroupProps<T>) {
  const gridRef = useRef<HTMLDivElement>(null);

  /*
    VERTICAL ARROWS AND EDGES ARE OUR OWN; HORIZONTAL ONES BELONG TO THE RADIO GROUP.

    Arrows in a radio set are handled by react-aria, and LINEARLY, in markup order: for it "right" and
    "down" are the same thing — the next option. In a row that is exactly what is needed (at the end
    of the row the selection honestly moves to the neighbor), but on a grid "down" must mean the option
    BELOW the current one, that is, a step of `columns`.

    That is why the vertical direction and the edges are computed here, and the handler sits on the
    CAPTURE phase with `stopPropagation`: react-aria listens on the buttons themselves, that is, lower
    in the tree, and in the bubble phase it would have moved the selection before we got to it. Same
    approach and same reason as in `EditableList`.

    Edges do NOT wrap around: from the bottom row "down" stays in place. The set is not a carousel, and
    jumping from the last color back to the first reads as a miss, not as a transition. Home and End
    are not handled by react-aria's radio group at all.
  */
  const onKeyDownCapture = (event: KeyboardEvent<HTMLDivElement>) => {
    const owned =
      event.key === "ArrowUp" ||
      event.key === "ArrowDown" ||
      event.key === "Home" ||
      event.key === "End";
    if (!owned) return;

    // Always prevented, even when there is nowhere to go: otherwise at the edge of the grid
    // react-aria's linear navigation would run and move the selection sideways.
    event.preventDefault();
    event.stopPropagation();
    if (disabled) return;

    // We don't use `findLastIndex`: it is ES2023, and the kit builds for an older target.
    const lastEnabled = () => {
      for (let index = options.length - 1; index >= 0; index--)
        if (options[index]?.disabled !== true) return index;
      return -1;
    };

    /*
      Counting starts from WHERE THE FOCUS IS, not from what is selected.

      Usually these are the same, but not always: the consumer applies the value itself, and until its
      answer arrives (saving goes to the server) the previous option still counts as selected while the
      person already stands on the new one. Counting from the value, a second arrow press in a row would
      move from the wrong place.
    */
    const focused = gridRef.current?.contains(document.activeElement)
      ? (document.activeElement as HTMLInputElement).value
      : value;
    const from = options.findIndex((option) => option.value === focused);
    const step = event.key === "ArrowDown" ? columns : event.key === "ArrowUp" ? -columns : 0;
    const to =
      event.key === "Home"
        ? options.findIndex((option) => !option.disabled)
        : event.key === "End"
          ? lastEnabled()
          : step !== 0 && from >= 0
            ? from + step
            : -1;

    const next = options[to];
    // A disabled option is passed over rather than jumped past: in a grid, "next" is the adjacent
    // column, which is not the column we were moving along.
    if (to < 0 || next == null || next.disabled || next.value === value) return;

    onChange(next.value);
    /*
      Focus is moved by hand: the consumer changes the value, and until its answer arrives the radio
      group does not know about the move. The button is found by its value in the markup — the option
      exposes no node of its own.
    */
    gridRef.current
      ?.querySelector<HTMLInputElement>(`input[value="${CSS.escape(next.value)}"]`)
      ?.focus();
  };

  return (
    <AriaRadioGroup
      value={value}
      // The value comes from a closed set, and the union type narrows it: RAC hands out a plain
      // string because it knows nothing about the set.
      onChange={(next) => onChange(next as T)}
      isDisabled={disabled}
      className={cn("flex flex-col gap-1.5", className)}
    >
      <Label className="text-fg-2 text-[11px] font-bold tracking-wide uppercase">{label}</Label>
      {/*
        A grid, not a wrapping row: the columns must line up vertically, otherwise there is nothing
        to compare the colors with by eye — and that comparison is exactly how people choose them.
        `min-content` keeps the column sized to the swatch: stretched cells would spread the circles
        across the container's width.
      */}
      <div
        ref={gridRef}
        onKeyDownCapture={onKeyDownCapture}
        // The gap is six pixels, not four: the selection ring extends two pixels past the edge of an
        // option, and in a tight grid it would touch the neighbor.
        className="grid w-fit gap-1.5"
        style={{ gridTemplateColumns: `repeat(${columns}, min-content)` }}
      >
        {options.map((option) => {
          const button = (
            <RadioButton
              className={({ isSelected, isFocusVisible }) =>
                cn(
                  OPTION_CLASS,
                  // Order matters: `cn` is `twMerge`, and the selection ring must override the hover
                  // ring, not merge with it.
                  !isSelected && "hover:ring-line hover:ring-2",
                  isSelected && "ring-fg-0 ring-2",
                  isFocusVisible && "outline-accent-strong outline-2 outline-offset-2"
                )
              }
            >
              {/*
                The option's name is visible only to the screen reader: to the eye the swatch itself
                names the option, and out loud the word does. A caption next to nine circles would turn
                the grid into a list. With `tooltips`, the same word is also visible to the eye, as a
                tooltip, and it is taken from here as well, not from a second field: two sources of the
                name would drift apart at the first translation.
              */}
              <VisuallyHidden elementType="span">{option.name}</VisuallyHidden>
              <span
                aria-hidden
                className={cn(
                  SWATCH_CLASS,
                  option.hue != null ? LABEL_BG_CLASS[option.hue] : EMPTY_SWATCH_CLASS
                )}
              />
            </RadioButton>
          );

          return (
            <RadioField key={option.value} value={option.value} isDisabled={option.disabled}>
              {/*
                THE TOOLTIP HANGS ON THE WRAPPER, NOT ON THE OPTION ITSELF. Two reasons, and both were
                measured, not assumed.

                First: on the option it would work only with a mouse. `RadioButton` passes outward not
                any props but filtered ones: the pointer events (`onPointerMove`, `onPointerLeave`) reach
                the markup, while `onFocus` and `onBlur` do not. A tooltip on it would appear on hover and
                stay silent during keyboard navigation, that is, it would be missing exactly where it is
                needed most.

                Second: Radix puts `aria-describedby` on the trigger. On the option that would double the
                name — it is already the option's accessible name, and the screen reader would read
                "Blue Blue". On the wrapper nobody receives the description: the radio button has no
                `aria-describedby` of its own, and a description is not inherited from an ancestor — out
                loud the option is still named once.

                The wrapper appears only together with the tooltip: without it, this would be an extra node
                in a grid of nine for every option.

                On a DISABLED option the tooltip works like on any other: it does not explain "why it is not
                allowed", but "what color is this" is a legitimate question for an unavailable option too.
              */}
              {tooltips ? (
                <Tooltip content={option.name}>
                  <span className="block">{button}</span>
                </Tooltip>
              ) : (
                button
              )}
            </RadioField>
          );
        })}
      </div>
    </AriaRadioGroup>
  );
}
