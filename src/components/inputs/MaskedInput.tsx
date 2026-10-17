"use client";

import {
  forwardRef,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type KeyboardEvent,
} from "react";
import { useMessages } from "../../i18n/useMessages.js";
import {
  caretAfter,
  formatMask,
  maskRemainder,
  maskTokenAt,
  rawLengthBefore,
  unmask,
  unmaskOverflow,
  type MaskToken,
} from "../../lib/mask.js";
import { TextControl } from "./TextControl.js";

/** Maps a mask token to what was expected, in terms from the message catalog. */
const EXPECTED: Record<MaskToken, "digit" | "letter" | "any"> = {
  "9": "digit",
  a: "letter",
  "*": "any",
};

export interface MaskedInputProps extends Omit<
  ComponentPropsWithoutRef<"input">,
  "onChange" | "value" | "defaultValue" | "size"
> {
  /**
   * Mask: `9` is a digit, `a` is a letter, `*` is a digit or a letter; anything else is a literal.
   *
   * The kit knows nothing about the business domain: the mask arrives as a prop, and whether it is
   * a phone number or a passport series is the caller's knowledge.
   */
  mask: string;
  /** The raw value, without the mask literals. This is the one sent to the server. */
  value: string;
  /**
   * Called with both representations: the raw one and the displayed one.
   *
   * The raw one is for the request, the displayed one is for whoever stores the text as it is.
   * Passing only one would force half of the consumers to format it again.
   */
  onChange: (raw: string, formatted: string) => void;
  /** Classes for the framed wrapper. */
  shellClassName?: string;
  /**
   * Whether to show the format right in the field: `+7 (___) ___-__-__`.
   *
   * ON BY DEFAULT, and this is not cosmetic. Before the mask guide existed, the field did not
   * show the format AT ALL: `formatMask` inserts literals only while there is something to place
   * next, so an empty field showed an empty box, and a half-filled one showed a stub with no
   * remainder. The user learned the format by trial and error.
   *
   * Turn it off where the format is already stated next to the field and repeating it inside is
   * noise: a short, well-known mask in a dense table, or a field whose label already gives an example.
   *
   * The mask guide is DECORATION: it is `aria-hidden`, so screen readers do not get it. The format
   * for them lives in the `FormField` hint, which is linked to the field (`aria-describedby`). The
   * split is deliberate: the persistent hint stays available while the typed value is checked,
   * and the mask guide disappears as the user types.
   */
  showMask?: boolean;
}

/**
 * Input field with a mask.
 *
 * IT IS BUILT ON `TextControl` (precedent: ADR-0009). The frame, focus, and the disabled and invalid
 * states belong to it; here there is only the mask logic.
 *
 * THE VALUE IS RAW, THE DISPLAY IS FORMATTED. Storing the format means storing a decision about display:
 * the mask can be changed, but the brackets written with it stay in the database forever.
 *
 * THE CARET IS WHY THE COMPONENT EXISTS AT ALL. Formatting on every keystroke redraws the whole string,
 * and the browser puts the caret at the end, so editing the middle of a number becomes impossible.
 * That is why the position is computed through the mask: however many value characters stood to the
 * left, that many will remain.
 *
 * BACKSPACE OVER A LITERAL DELETES A VALUE CHARACTER, not the literal. Otherwise the caret runs into
 * `)` and deleting gets stuck: the literal would be removed and immediately re-added by formatting,
 * and the keystroke would change nothing. That is a defect that looks like a stuck key.
 *
 * Pasting needs no separate handler: the pasted text arrives in the same input event, and the mask
 * parser splits it the same way as typed text (`unmask` in `lib/mask.ts`).
 */
export const MaskedInput = forwardRef<HTMLInputElement, MaskedInputProps>(function MaskedInput(
  { mask, value, onChange, onKeyDown, showMask = true, ...rest },
  ref
) {
  const innerRef = useRef<HTMLInputElement>(null);
  useImperativeHandle(ref, () => innerRef.current as HTMLInputElement, []);
  // The caret lives in a `ref`: it is needed exactly once, right after the re-render.
  const caret = useRef<number | null>(null);

  const messages = useMessages();
  /*
    What to say about a dropped character.

    The drop used to be SILENT: `unmask` skips a character that does not fit the token and moves on.
    The user saw that the keystroke "did nothing" and got no explanation. The USWDS reference
    implementation failed WCAG 3.3.3 on exactly this point (there, a mismatched character also cuts
    off the rest of the input).

    Pressing the same wrong key again yields THE SAME string, and a screen reader does not re-announce
    it: a queue of announcements does not build up by itself, without suppression or timers.
  */
  const [rejection, setRejection] = useState("");

  const formatted = formatMask(value, mask);

  /*
    The mask guide under the value.

    THE HIDDEN PREFIX HOLDS WHAT WAS TYPED, not the mask symbols. Then the widths MATCH BY CONSTRUCTION:
    the digit sits under the same digit, and the remainder starts exactly where the input ended. With
    underscores, the match would depend on whether `_` and `8` have the same width in the consumer's
    font, that is, it would be accidental.

    It is computed from `value` during render, not in a keystroke handler. The USWDS reference
    implementation hangs its handler on `keyup`, so a mouse paste, autofill, or any programmatic change
    leaves the mask guide out of sync with the field.

    `GrayText` in high-contrast mode: the system paints all the text in one color, and without it the
    mask guide would be indistinguishable from typed text, so the field would show digits that are not there.
  */
  const underlay = showMask ? (
    <>
      <span className="invisible">{formatted}</span>
      <span className="text-fg-2 forced-colors:text-[color:GrayText]">
        {maskRemainder(value, mask)}
      </span>
    </>
  ) : undefined;

  useLayoutEffect(() => {
    const el = innerRef.current;
    const at = caret.current;
    caret.current = null;
    if (el && at != null) el.setSelectionRange(at, at);
  });

  const commit = (raw: string, rawCaret: number) => {
    caret.current = caretAfter(mask, rawCaret);
    onChange(raw, formatMask(raw, mask));
  };

  const control = (
    <TextControl
      ref={innerRef}
      underlay={underlay}
      value={formatted}
      onChange={(event) => {
        const shown = event.target.value;
        const position = event.target.selectionStart ?? shown.length;
        const raw = unmask(shown, mask);

        /*
          The typed character was lost: the display string grew, but the value did not change.

          The question is asked exactly this way: "did the value change", not "does the character fit the
          token". The difference shows on a mask literal that is itself a valid character: in
          `+7 (999) 999-99-99` the literal `7` is a digit. The user types `7` first (the habit of typing
          `+7`), `unmask` eats it as a literal, the value stays empty, and a check "by token" would count
          the character as accepted and stay silent. That is exactly the defect the announcement exists for.

          Compare by value, not by its length: editing the MIDDLE of a filled field changes the value
          without changing its length, and by length it would look like a rejection. It also dropped the
          caret with an extra re-render.

          The displayed length in the condition is required: without it, deleting a literal (`)`) also
          leaves the value unchanged and would be announced as a rejection.
        */
        const added = shown.length - formatted.length;
        /*
          Trimming a PASTE is a separate branch, and it is told apart by `inputType`, not by length.

          Nothing else tells it apart from its neighbors: typing an extra character into a full field also
          overflows, but that is `full`, and editing the MIDDLE of a full field pushes a character out and
          must stay silent (see below). What these two have in common is that the user sees what they are
          doing. With a paste they do not see it: the tail disappears entirely, and `89161234567` becomes
          `+7 (891) 612-34-56`, a different but plausible number.

          The `raw === value` condition below does not catch a paste on purpose: with a paste the value CHANGES.
        */
        const native = event.nativeEvent;
        const inputType = native instanceof InputEvent ? native.inputType : undefined;
        /*
          "Not one character at a time" is what really distinguishes this case, and `insertFromPaste` alone is not enough:

          - dragging text with the mouse gives `insertFromDrop`;
          - a substitution from a password manager or a phone's suggestion strip is `insertReplacementText`, and a
            programmatic write of the value arrives as a plain `Event` whose `inputType` is empty or missing.
            On mobile this is the MOST common way a phone number gets into a phone field.

          Hence the last condition: an unknown `inputType` with `added > 1`. It also separates these paths from
          typing a character into a full field: there `added === 1`, and the `full` branch below has to answer.
        */
        const bulk =
          inputType === "insertFromPaste" ||
          inputType === "insertFromPasteAsQuotation" ||
          inputType === "insertFromDrop" ||
          inputType === "insertReplacementText" ||
          (!inputType && added > 1);
        const overflow = bulk ? unmaskOverflow(shown, mask) : 0;
        if (overflow > 0) {
          setRejection(messages.maskedInput.truncated({ count: overflow }));
        } else if (added > 0 && raw === value) {
          // Where the input was aimed: how many value characters stand to the left of the inserted text.
          const at = rawLengthBefore(mask, Math.max(position - added, 0));
          const token = maskTokenAt(mask, at);
          setRejection(
            token == null
              ? messages.maskedInput.full
              : messages.maskedInput.rejected({ expected: EXPECTED[token] })
          );
        } else if (rejection) setRejection("");

        // How many value characters ended up to the left of the caret: that many will remain.
        // The position is counted from the displayed string, not from the shift.
        commit(raw, unmask(shown.slice(0, position), mask).length);
      }}
      onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
        // The foreign handler is called FIRST and may cancel our `preventDefault`:
        // otherwise it would be overridden by the spread, as already happened with `style` on `TopBar` in review 2.1.0.
        onKeyDown?.(event);
        if (event.defaultPrevented || event.key !== "Backspace") return;

        const el = event.currentTarget;
        const start = el.selectionStart ?? 0;
        if (start !== el.selectionEnd) return;

        const before = rawLengthBefore(mask, start);
        if (before === 0) return;
        event.preventDefault();
        commit(value.slice(0, before - 1) + value.slice(before), before - 1);
      }}
      {...rest}
    />
  );

  /*
    The live region is MOUNTED ALWAYS; only its text changes. A region inserted into the document together
    with a message is announced unreliably: some screen readers manage to skip it. The same technique,
    for the same reason, as in `FileDropzone`.

    `status`, not `alert`: a rejected key is not a form error, and interrupting the current speech with it
    would punish a typo.

    A fragment, not a wrapper: a wrapper around the field would change the markup for everyone who already
    puts `MaskedInput` in their layout. The region is hidden with `sr-only`: it leaves the flow and does not
    affect the layout.
  */
  return (
    <>
      {control}
      <span role="status" aria-live="polite" className="sr-only">
        {rejection}
      </span>
    </>
  );
});
