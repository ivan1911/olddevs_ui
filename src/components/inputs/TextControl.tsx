"use client";

import {
  forwardRef,
  useState,
  type ComponentPropsWithoutRef,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useFieldDescribedBy, useFieldInvalid } from "../../hooks/useFieldDescription.js";
import { cn } from "../../lib/cn.js";
import {
  FIELD_INPUT_CLASS,
  FIELD_INPUT_COMPACT_CLASS,
  FIELD_SHELL_CLASS,
} from "../../lib/field.js";

export interface TextControlProps extends Omit<ComponentPropsWithoutRef<"input">, "size"> {
  /** `input` — a single-line field, `textarea` — a multi-line one. */
  as?: "input" | "textarea";
  /**
   * Height step: `md` is 42 px, `sm` is 36.
   *
   * Thirty-six is the height of `Button size="md"` and of the `Select` trigger pill: in a single row of
   * a toolbar, a field at this step stuck out of the row on its own. Only the vertical padding changes;
   * the frame, corner radius, shadow, font and line box stay the same.
   *
   * FOR SINGLE-LINE FIELDS ONLY. With `as="textarea"` the height is controlled by `rows` and `autosize`,
   * and a step there would be a third system competing with them for the same number.
   */
  size?: "sm" | "md";
  /** Height in rows. Only meaningful with `as="textarea"`. */
  rows?: number;
  /** Classes for the framed wrapper: width, corner radius, inner padding. */
  shellClassName?: string;
  /** Icon on the left inside the frame: a magnifying glass for search, a unit for a number. */
  icon?: ReactNode;
  /** Element on the right inside the frame: a clear button, a character counter. */
  trailing?: ReactNode;
  /**
   * Underlay behind the value, on the same line: a mask guide, a format hint.
   *
   * Not a slot next to the field but a layer under it — which is why it is not `icon`/`trailing`.
   * Alignment holds because the underlay carries the same `FIELD_INPUT_CLASS` as the field and sits
   * with it in the same grid cell: padding and typography match by construction, not by adjustment.
   * The USWDS reference implementation places such a layer absolutely, with an unexplained
   * `left: 2px`, and breaks on the first field with an icon.
   *
   * THERE IS NOTHING TO READ IN IT: the component sets `aria-hidden` itself. The layer under the value
   * repeats what the label and hint already say; read aloud, it would produce "underscore underscore
   * underscore" in the middle of the field.
   *
   * It does not intercept clicks or selection — otherwise the field would stop focusing on a click into
   * its own text.
   *
   * Only for single-line fields: it has no effect together with `autosize`, because the mirror that
   * measures the height occupies the same grid cell.
   */
  underlay?: ReactNode;
  /**
   * Grows with its content. Only meaningful with `as="textarea"`.
   *
   * `rows` becomes a MINIMUM here rather than a fixed height, and manual corner resizing is turned off:
   * two systems controlling the height at once produce a field that collapses after every keystroke.
   */
  autosize?: boolean;
  /** Growth limit in rows; beyond it a scrollbar appears. Only with `autosize`. */
  maxRows?: number;
  /**
   * Character counter. With `maxLength` it shows "N/M", without it just "N".
   *
   * The compiler does not require `maxLength`: a union type made for that would break `Omit` in wrappers —
   * the same case as `Checkbox.label`. And "how much has been typed" makes sense on its own, without a limit.
   */
  showCount?: boolean;
}

/**
 * Text field: the frame lives on the shell, not on the `input` itself.
 *
 * The split is not cosmetic. A frame on the shell lets you put an icon or a character counter inside without
 * fighting the browser's own styling of the field; the `input` itself is fully reset (`appearance: none`,
 * no shadows or outlines), otherwise Safari and Chrome draw it differently.
 *
 * The focus highlight is on the shell via `focus-within`, and the color comes from `--accent-strong`, not
 * `--accent`: the focus indicator is a non-text element under the 3:1 threshold, while `--accent` is designed
 * for white text on top of it and on the underlay it is dimmer than needed.
 *
 * `icon` and `trailing` are exactly the slots the frame was moved to the shell for. The layout switches to
 * `flex` only when a slot is actually passed: a bare field must produce the same markup as before slots
 * appeared, otherwise the visual baseline shifts on a component that nobody touched.
 *
 * The icon's color is set on the slot's wrapper, not on the icon itself: the `@olddevs/ui/icons` set draws
 * `currentColor`, so a consumer who needs another color only has to pass an icon with its own class.
 *
 * THE DISABLED STATE IS DIMMED ON THE SHELL (see `lib/field.ts`), not on the field itself. `disabled:opacity-50`
 * on the `input` would dim only the text, while the frame would stay as bright as a neighboring working field —
 * that is, exactly the signal that tells a disabled field from an empty one would be missing. Before this fix
 * there was no state at all: in the matrix, the "disabled" row differed from the normal one only in that you
 * could not type into it.
 *
 * `readOnly` is deliberately not dimmed: a read-only field is a shown value, not an unavailable control, and
 * dimming it would hide data that is shown on purpose.
 */
export const TextControl = forwardRef<HTMLInputElement, TextControlProps>(function TextControl(
  {
    as = "input",
    size = "md",
    rows,
    className,
    shellClassName,
    icon,
    trailing,
    underlay,
    autosize,
    maxRows,
    showCount,
    ...rest
  },
  ref
) {
  const Comp = as as "input";
  const grows = autosize === true && as === "textarea";
  /*
    The size step goes into ALL THREE copies of `FIELD_INPUT_CLASS` — the field, the autosize mirror and the
    mask underlay: they share typography and padding and must not diverge, or the rest of the mask would drift
    away from the typed text. A multi-line field does not know the size step: there the height is controlled
    by `rows` and `autosize`.
  */
  const compact = size === "sm" && as === "input" ? FIELD_INPUT_COMPACT_CLASS : undefined;

  // The text is needed by the mirror and the counter. A controlled field hands it over as a prop; an
  // uncontrolled one only through events, so the second source is set up LAZILY: without `autosize` and
  // without `showCount` neither state nor a wrapper around `onChange` appears, and the markup of a plain
  // field stays the same.
  const [inner, setInner] = useState(() => String(rest.defaultValue ?? ""));
  const tracks = grows || showCount === true;
  const text = rest.value !== undefined ? String(rest.value) : inner;

  /*
    The hint or error from `FormField`. MERGED with the description passed as a prop, not replacing it:
    `aria-describedby` is a list, and a consumer who described the field with its own node is entitled to
    expect that node to stay.

    Outside `FormField` the value is `undefined`, the spread is empty, and the markup is the same as before
    descriptions existed.
  */
  const fieldDescribedBy = useFieldDescribedBy();
  /*
    Invalidity is declared by the form layout, but an EXPLICIT prop takes precedence: the consumer knows more
    about its own field than `FormField` does. Without this, `FIELD_SHELL_CLASS` could not turn red — it looks
    for `aria-invalid` on the field itself, and nothing was setting it.
  */
  const fieldInvalid = useFieldInvalid();
  const invalid = rest["aria-invalid"] ?? (fieldInvalid || undefined);
  const describedBy =
    [rest["aria-describedby"], fieldDescribedBy].filter(Boolean).join(" ") || undefined;

  const counter = showCount ? (
    // `text-fg-2`, not `text-fg-3`: the counter sits INSIDE the field, on `bg-2`, not on the page background.
    // `fg-3` is meant for the latter and gives 4.0 on the former where 4.5 is required — an axe audit found it.
    <span className="text-fg-2 shrink-0 text-[11px] tabular-nums">
      {rest.maxLength != null ? `${text.length}/${rest.maxLength}` : text.length}
    </span>
  ) : null;

  // In a single-line field the counter goes into the slot on the right; in a multi-line one, under the text:
  // inline, it would eat width from the longest value.
  /*
    The counter and `trailing` stand SIDE BY SIDE, not replacing each other.

    It used to be `counter ?? trailing`: with `showCount`, a passed `trailing` never reached the markup, and
    silently — the clear button simply vanished. On `textarea` the same call worked, because the counter moves
    down there, and the difference between the two forms of one component was unexplained.
  */
  const inlineTrailing =
    as === "input" && counter != null ? (
      <span className="inline-flex items-center gap-1.5">
        {counter}
        {trailing}
      </span>
    ) : (
      trailing
    );
  const hasSlots = icon != null || inlineTrailing != null;

  const control = (
    <Comp
      ref={ref}
      {...(as === "textarea" && rows ? { rows } : {})}
      // The global `:focus-visible` rule in styles.css draws an outline around the field itself — here it is
      // redundant, the shell provides the highlight.
      data-disable-focus-ring="true"
      className={cn(
        FIELD_INPUT_CLASS,
        as === "textarea" && !grows && "min-h-[96px] resize-y",
        // Corner resizing is turned off: the content controls the height, and two systems commanding it at
        // once give a field that collapses after every keystroke.
        grows && "col-start-1 row-start-1 resize-none overflow-y-auto",
        // The field lies over the underlay: its background is transparent, so the rest of the mask shows
        // through, and the typed text is drawn by the field itself.
        underlay != null && "col-start-1 row-start-1",
        // `w-full` alone does not shrink below its content — next to the slots the field would push the clear
        // button outside the frame on a long value.
        hasSlots && "min-w-0 flex-1",
        compact,
        className
      )}
      {...rest}
      // After the spread: the value was merged above, and the spread must not override it — the same order as
      // `onChange` below.
      {...(fieldDescribedBy ? { "aria-describedby": describedBy } : {})}
      {...(invalid != null ? { "aria-invalid": invalid } : {})}
      {...(tracks
        ? {
            onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
              setInner(e.target.value);
              rest.onChange?.(e);
            },
          }
        : {})}
    />
  );

  return (
    <div
      className={cn(
        // The shell and field classes are shared with `NumberInput` — see `lib/field.ts`.
        FIELD_SHELL_CLASS,
        as === "textarea" && "py-0.5",
        hasSlots && "flex items-center gap-2",
        shellClassName
      )}
    >
      {icon != null && <span className="text-fg-3 flex shrink-0 items-center">{icon}</span>}
      {grows ? (
        /*
          A mirror instead of measuring the height.

          The usual way is to reset `height` to auto on every keystroke, read `scrollHeight` and set it back;
          that is a forced layout recalculation inside the input handler, that is, on every character. Here the
          browser computes the height itself: an invisible twin with the same typography sits in the same grid
          cell and sets its height, and the field is stretched to fill the cell. Zero JS measurements.

          The trailing newline is required: without it the last empty line is not counted, and the field jumps
          on every Enter.

          `maxRows` is in rows, not pixels, because the limit is set in the `lh` unit — the line height of this
          very field. Converting it to pixels would mean doing it by hand, again with every font change.
        */
        <div
          className="grid w-full"
          style={maxRows != null ? ({ "--tc-max-rows": maxRows } as CSSProperties) : undefined}
        >
          {control}
          <div
            aria-hidden
            className={cn(
              FIELD_INPUT_CLASS,
              "invisible col-start-1 row-start-1 break-words whitespace-pre-wrap",
              // The cap sits ON THE MIRROR, not on the grid: the mirror sets the cell's height, and a container
              // limit does not shrink the track — the field would simply overflow. Here `1lh` resolves against
              // the mirror's own line, and its typography matches the field; on the grid it would be the
              // container's line, which is a different number.
              //
              // `+1.25rem` compensates for `py-[10px]` from `FIELD_INPUT_CLASS`: with `box-sizing: border-box`,
              // without the addition a four-row limit would show three and a half rows.
              maxRows != null && "max-h-[calc(var(--tc-max-rows)*1lh+1.25rem)] overflow-hidden",
              compact,
              className
            )}
          >
            {text + "\n"}
          </div>
        </div>
      ) : underlay != null ? (
        /*
          The underlay and the field sit in one grid cell, not on top of each other via `position: absolute`.
          Padding and typography come to both from the same `FIELD_INPUT_CLASS`, so the start of the text matches
          by construction: there is nothing to adjust, and the adjustment would not drift when the type scale or
          font changes.

          `whitespace-pre` is required: the mask has spaces (`+7 (___) ___`), and collapsing them would shift the
          rest to the left relative to the typed text.

          The underlay comes FIRST, that is, below the field: otherwise it would cover both the text and the caret.
        */
        <div className={cn("grid w-full", hasSlots && "min-w-0 flex-1")}>
          <div
            aria-hidden
            className={cn(
              FIELD_INPUT_CLASS,
              "pointer-events-none col-start-1 row-start-1 overflow-hidden whitespace-pre select-none",
              compact,
              className
            )}
          >
            {underlay}
          </div>
          {control}
        </div>
      ) : (
        control
      )}
      {inlineTrailing != null && (
        <span className="flex shrink-0 items-center">{inlineTrailing}</span>
      )}
      {as === "textarea" && counter != null && (
        <div className="flex justify-end pb-1.5">{counter}</div>
      )}
    </div>
  );
});
