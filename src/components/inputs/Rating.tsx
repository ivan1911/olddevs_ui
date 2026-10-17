"use client";

import { useId, useRef, type KeyboardEvent } from "react";
import { useMessages } from "../../i18n/useMessages.js";
import { RatingStarIcon } from "../../icons.js";
import { clamp } from "../../lib/clamp.js";
import type { Size } from "../../lib/variants.js";
import { useDescribedBy } from "../../hooks/useFieldDescription.js";
import { cn } from "../../lib/cn.js";

export interface RatingProps {
  /**
   * The rating. The value going in and out is a number, not a set of stars: stars are a way
   * to show a magnitude, not the magnitude itself.
   */
  value: number;
  /** Without it, the component only shows the rating and is not in the tab order. */
  onChange?: (value: number) => void;
  /**
   * Total number of stars.
   *
   * There can't be fewer than one: a scale with zero steps is not a scale, and `max={0}` would
   * give a radio group with no options and a label "out of 0". The value is coerced, not ruled
   * out by the type: the number comes from the consumer's data, and the component must not
   * break on it.
   */
  max?: number;
  /**
   * Star size: `sm` or `md`.
   *
   * Star size. A rating never goes larger than `md`: a row of five stars at `lg` would take up
   * the width of an input field, and a magnitude is read, not inspected.
   */
  size?: Extract<Size, "sm" | "md">;
  /**
   * Display without input: the value is visible, but cannot be changed.
   *
   * Not the same as `disabled`. Read-only means displayed data, and dimming it would hide what is
   * shown on purpose. A disabled control is an action that is unavailable right now, and it is
   * dimmed.
   */
  readOnly?: boolean;
  /** Disables input and dims the stars. */
  disabled?: boolean;
  /**
   * A caption next to the rating, e.g. "4.2 · 128 ratings". The consumer's domain; the kit does not
   * compute it.
   */
  caption?: string;
  /** The accessible name. Required: an unnamed group is announced only by its role. */
  "aria-label": string;
  /** Classes for the root element. */
  className?: string;
}

const STAR_SIZE = { sm: 14, md: 20 } as const;

/**
 * Star rating.
 *
 * THE KEYBOARD MODEL IS A RADIO GROUP, not a set of buttons. Arrow keys change the value, `Home`
 * and
 * `End` jump to the edges, and Tab leaves the group as a whole: five tab stops for one question are
 * five stops where there is one answer. That is why the `radiogroup` role is used.
 *
 * THE VALUE IS ANNOUNCED IN WORDS. The color and the number of filled stars are the only visual
 * carrier of the magnitude, and without a string like "Rating 4 of 5" a screen reader would read
 * five identical elements. The string comes from the message catalog; it needs no plural forms,
 * since both substitutions are numbers that come before the preposition.
 *
 * THE STAR COLOR IS ITS OWN TOKEN `--rating-star` of the component layer (ADR-0040), not
 * `--warning`. Today both point to the same amber primitive, and that is the trap: changing the
 * warning color would silently recolor every rating in the product, and the cause would be sought
 * here. An unfilled star takes `--fg-3`: it reads as "not selected", not as "unavailable".
 *
 * THERE ARE NO FRACTIONAL RATINGS, and this is a deliberate decision. A half star is needed to show
 * an average value, not to take input. Showing an average is handled by the caption ("4.2 · 128
 * ratings"), which is more precise than a half star and does not require explaining what a
 * half-filled star means on input.
 */
export function Rating({
  value,
  onChange,
  max = 5,
  size = "md",
  readOnly = false,
  disabled = false,
  caption,
  "aria-label": ariaLabel,
  className,
}: RatingProps) {
  const messages = useMessages();
  const describedBy = useDescribedBy(undefined);
  const groupId = useId();
  const textId = `${groupId}-text`;
  // Coerce both numbers before any use: `max` and `value` both come from the consumer's data,
  // though their type is a plain number.
  const total = Number.isFinite(max) ? Math.max(1, Math.floor(max)) : 5;
  const stars = Array.from({ length: total }, (_, index) => index + 1);
  const starRefs = useRef<(HTMLSpanElement | null)[]>([]);

  // The role is a property of the control, not of its current availability. A disabled rating
  // stays a radio group and is marked with `aria-disabled`: `role="img"` would be read as a
  // picture,
  // not as an unavailable action.
  const isGroup = onChange !== undefined && !readOnly;
  const editable = isGroup && !disabled;

  // Roving tabindex: exactly one star is in the tab order: the selected one, or the first one when
  // the
  // rating is zero. Without it, the group is announced as a radio group but built as a row of
  // non-interactive elements, and an arrow key would change the value silently, because focus stays
  // on the container, whose name does not change.
  // Rounding is required: the stars are whole numbers, and a fractional value would match none of
  // them. Roving would then place no tab stop anywhere, and the radio group would become entirely
  // unreachable from the keyboard. The type allows a fractional `value`, and the coloring follows
  // it
  // (`star <= 4.2` gives four stars), so it cannot be silently forbidden; it has to be handled.
  const rounded = Number.isFinite(value) ? Math.round(value) : 0;
  const active = rounded >= 1 && rounded <= total ? rounded : 1;

  function pick(next: number) {
    if (!editable || !onChange) return;
    const clamped = clamp(next, 0, total);
    // Stay silent when there is nothing to report: an arrow at the edge and a click on the
    // already-selected star do not change the value, and an event without a change reads to the
    // recipient as an edit.
    if (clamped === rounded) return;
    onChange(clamped);
    // Focus follows the value: otherwise the next arrow press would count from the old star,
    // while the announced value is already the new one.
    starRefs.current[Math.max(clamped, 1) - 1]?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (!editable) return;
    const back = event.key === "ArrowLeft" || event.key === "ArrowDown";
    const forward = event.key === "ArrowRight" || event.key === "ArrowUp";
    const home = event.key === "Home";
    const end = event.key === "End";
    if (!back && !forward && !home && !end) return;
    event.preventDefault();
    // `Home` goes to zero, not to one: zero is declared a legitimate value, and it is the group's
    // lower edge.
    if (home) return pick(0);
    /*
      `total` and `rounded`, NOT the raw `max` and `value`.

      The file coerces both numbers above and states this as a rule, but here the math ran on the
      props. `max={NaN}` gave `pick(NaN)`, and `clamp(NaN, …)` is also `NaN`: the "value did not
      change" check is false on it, and `onChange(NaN)` went out, so the consumer's rating was
      corrupted for good. `max={0}` gave `pick(0)`, that is, ZERO instead of the top edge of the
      scale. And a step from a fractional `value` pushed `5.2` past the five-star scale and did not
      move the focus: the `starRefs` index by a fractional number is `undefined`.
    */
    if (end) return pick(total);
    pick(rounded + (forward ? 1 : -1));
  }

  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      <div
        role={isGroup ? "radiogroup" : "img"}
        // The name is COMPOSED from the consumer's label and the magnitude, not replaced by it:
        // "Rating 4 of 5" without a subject is a magnitude with no answer to the question "of
        // what?".
        aria-labelledby={`${groupId}-label ${textId}`}
        {...(describedBy ? { "aria-describedby": describedBy } : {})}
        aria-disabled={isGroup && disabled ? true : undefined}
        onKeyDown={onKeyDown}
        className={cn(
          "inline-flex items-center rounded-sm",
          size === "sm" ? "gap-0.5" : "gap-1",
          disabled && "cursor-not-allowed opacity-50"
        )}
      >
        <span id={`${groupId}-label`} className="sr-only">
          {ariaLabel}
        </span>

        {stars.map((star) => (
          <span
            key={star}
            ref={(node) => {
              starRefs.current[star - 1] = node;
            }}
            role={isGroup ? "radio" : undefined}
            // Taken from `rounded`, like the coloring and the roving tabindex: on a fractional
            // `value`, a comparison with the raw number matched none of the stars, and the radio
            // group was announced without a selected option.
            aria-checked={isGroup ? star === rounded : undefined}
            aria-label={isGroup ? messages.rating.star({ index: star, total }) : undefined}
            tabIndex={editable ? (star === active ? 0 : -1) : undefined}
            onClick={editable ? () => pick(star) : undefined}
            className={cn(
              "inline-flex shrink-0 items-center rounded-sm outline-none",
              editable && "cursor-pointer",
              // The focus ring is a shared kit pattern, not React state: `:focus-visible` exists
              // precisely so that the ring is not drawn on a mouse click.
              "focus-visible:outline-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2",
              star <= rounded ? "text-rating-star" : "text-fg-3"
            )}
          >
            <RatingStarIcon
              size={STAR_SIZE[size]}
              aria-hidden
              fill={star <= rounded ? "currentColor" : "none"}
            />
          </span>
        ))}
      </div>

      {/*
        The magnitude in words. It is part of the group's name via `aria-labelledby`, in interactive
        mode too: without it, an arrow would change `aria-checked` on the element, and nothing would
        be spoken aloud.
      */}
      <span id={textId} className="sr-only">
        {messages.rating.value({ value: rounded, total })}
      </span>

      {caption ? <span className="text-fg-2 text-caption">{caption}</span> : null}
    </div>
  );
}
