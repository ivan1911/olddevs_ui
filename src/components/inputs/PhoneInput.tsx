"use client";

import { forwardRef } from "react";
import { MaskedInput, type MaskedInputProps } from "./MaskedInput.js";

export interface PhoneInputProps extends Omit<MaskedInputProps, "mask"> {
  /**
   * The number mask: a single format, not inferred from the input. By default it is the Russian one (`RU_PHONE_MASK`).
   *
   * The prop exists precisely because the default is a choice, not a fact: another country
   * needs a different format, and changing it should be easy.
   */
  mask?: string;
}

/** The Russian format. A default, not the only possible one. */
export const RU_PHONE_MASK = "+7 (999) 999-99-99";

/**
 * A phone field: `MaskedInput` with a phone mask and phone attributes.
 *
 * WHAT THE COMPONENT DOES NOT DO matters more than what it does. It **does not parse
 * the number, keep a country directory, or validate**. The format is single and
 * fixed, set by the prop.
 *
 * The spec promised "a format from the locale", and that promise was deliberately dropped (ADR-0024):
 * `Intl` does not format phone numbers at all, and honest parsing means
 * `libphonenumber`, hundreds of kilobytes of code, a kit dependency that
 * an admin area without phone fields has no reason to pull in. A mask for one format is wrong for
 * other countries, and the component says so openly rather than pretending otherwise.
 *
 * The kit knows about a business domain here FOR THE FIRST TIME, and the boundary is drawn narrowly:
 * the mask, `inputMode="tel"` and `autocomplete="tel"`, and that is all. `Form` gave up
 * validation on purpose, and the phone input does not revisit that: the rules for "is this a real
 * number" stay with whoever submits it.
 *
 * As with `MaskedInput`, both representations go out: the raw digits for
 * the request, and the formatted value for display.
 */
export const PhoneInput = forwardRef<HTMLInputElement, PhoneInputProps>(function PhoneInput(
  { mask = RU_PHONE_MASK, ...rest },
  ref
) {
  return (
    <MaskedInput
      ref={ref}
      mask={mask}
      inputMode="tel"
      autoComplete="tel"
      // The spread goes last: both the keyboard mode and autofill are
      // defaults, not prohibitions.
      {...rest}
    />
  );
});
