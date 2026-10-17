import { cn } from "./cn.js";
import { variantClasses, type ButtonSize, type Tone, type Variant } from "./variants.js";

/**
 * The look of a button as one function, shared by two components.
 *
 * Extracted from `Button` when `Menu` appeared. The concrete reason: react-aria's `MenuTrigger` passes
 * its props to the trigger through `ButtonContext` (`onPress`, `aria-expanded`, `aria-haspopup`, ref),
 * while the package's `Button` is a plain `<button>` that does not read this context, so the menu would
 * not open.
 *
 * `Button` cannot be rewritten on react-aria: decision G of the spec explicitly forbids moving existing
 * primitives, since they work and are covered by snapshots. So the menu trigger is built on the React
 * Aria Components button, and the look of both is the same and lives here. A copy-paste of this table
 * would drift apart: the package already has such a history with the search fields in the front-end app.
 *
 * The class strings are literal and complete: Tailwind scans the sources as text.
 */

/**
 * Sizes kept from the front-end app's version, so that the move did not shift the layout.
 *
 * `xs` came later and was requested by the customer: a list row is designed for 32 pixels, while the
 * smallest button was 30 pixels tall and stretched the row to 42. A caption barely fits in it and is not intended to.
 * The step is set up for an icon button in a row, see `iconOnly`.
 */
const SIZES: Record<ButtonSize, string> = {
  xs: "h-5 gap-1 px-1.5 text-[11px]",
  sm: "h-[30px] gap-1.5 px-2.5 text-xs",
  md: "h-9 gap-2 px-3.5 text-[13px]",
  lg: "h-11 gap-2.5 px-[18px] text-md",
};

/**
 * The same heights, but square and without horizontal padding.
 *
 * For `xs` the press area is extended by a pseudo-element to 24 pixels, although the button itself is 20.
 * Without this the step could not be shipped: 20×20 fails WCAG 2.5.8 (the minimum target is 24×24), and
 * enlarging the button itself would bring back the very stretched row for whose sake the step was added.
 * The pseudo-element separates these two requirements: in the layout the button takes 20, while a finger
 * or a mouse hits it at 24.
 */
const ICON_SIZES: Record<ButtonSize, string> = {
  xs: "relative h-5 w-5 px-0 text-[11px] before:absolute before:-inset-0.5 before:content-['']",
  sm: "h-[30px] w-[30px] px-0 text-xs",
  md: "h-9 w-9 px-0 text-[13px]",
  lg: "h-11 w-11 px-0 text-md",
};

/**
 * Spinner ring for each size: the same numbers as `Spinner`.
 *
 * `Spinner` itself does not fit here, and the reason is not geometry: it has `role="status"` inside and
 * an invisible "Loading" label, and that label would enter the button's accessible name, so a screen
 * reader would read "Loading Save". Inside a button the indicator must be decorative: the state is
 * announced by `aria-busy`.
 */
export const SPINNER_SIZES: Record<ButtonSize, string> = {
  xs: "size-3 border-[1.5px]",
  sm: "size-3.5 border-[1.5px]",
  md: "size-4 border-2",
  lg: "size-5 border-2",
};

export const SPINNER_BASE =
  "inline-block animate-spin rounded-full border-current border-t-transparent";

const BASE =
  "inline-flex cursor-pointer items-center justify-center rounded-control border font-semibold " +
  "transition-all duration-150 " +
  "focus-visible:outline-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2 " +
  "disabled:pointer-events-none disabled:opacity-50 " +
  /*
    THE ICON INSIDE A BUTTON IS NOT A HIT TARGET.

    Otherwise `event.target` for a click on the icon is the `<svg>` itself or its `<path>`, not the
    button. This does not hurt the button: the event bubbles up and the button still works. But it
    badly breaks anyone who ANALYZES the click target.

    This was found on an `EditableList` row with an action. react-aria decides whether the click landed
    on a nested interactive element by checking `isTabbable` on the target itself, without walking up
    the ancestors. The target is the `<svg>`, which is not tabbable, so the row's action fired TOGETHER
    with the button: a click on "Delete" in the task list also opened the details. On the button's
    edge, where the target was the button itself, everything worked correctly. So the defect depended
    on whether the person hit the thirty pixels of the glyph itself.

    It is fixed here, not in the consumer, because this is a property of the button: its content must
    not stand in for it for anyone.
  */
  "[&_svg]:pointer-events-none " +
  /*
    THE ICON DOES NOT SHRINK. The `<svg>` in a button is a flex item with `shrink: 1`. When the layout
    around the button squeezes it, flex takes width from the icon as well: in `SelectionBar` at a medium
    width, the pencil became 10×18 with a caption broken over two lines. The height stays, so the glyph
    does not get smaller, it gets flattened. Let the caption wrap, but not the icon.
  */
  "[&_svg]:shrink-0 " +
  /*
    `aria-disabled` is painted THE SAME WAY as the native `disabled`.

    A button disabled only by the ARIA attribute looked fully working: its look is tied to the
    `:disabled` pseudo-class, and such a button does not have it. A sighted mouse user saw an ordinary
    button with a pointer cursor, clicked it, and nothing happened and nothing was explained.
    `aria-disabled` is used where the button must not be removed from the focus order (the edge of a
    list: with the native `disabled`, the browser drops focus from the very button it is on).
  */
  "aria-disabled:opacity-50 aria-disabled:cursor-default";

/**
 * The icon size inside a button, for each step.
 *
 * The icon vocabulary does not set sizes: that is the job of the consumer's `LucideProvider`. Without an
 * explicit `size`, lucide renders it at 24 pixels with a stroke width of 2, and in a 30-pixel button with a 13-pixel
 * caption such an icon is one and a half times taller than it should be. Icons that the kit places in its
 * own buttons (copy, the `SplitButton` expander, the `SideNav` toggle) take their size from here, to follow
 * the button's step. The numbers are the same as in the kit's showcase stories: 14 in compact ones, 16 by default.
 */
export const BUTTON_ICON_SIZE: Record<ButtonSize, number> = { xs: 14, sm: 14, md: 16, lg: 18 };

export interface ButtonLookOptions {
  /** Treatment (`variant`): `solid`, `soft`, `outline` or `ghost` from the kit's vocabulary. Defaults to `soft`. */
  variant?: Variant;
  /** Tone: the button's color role from the kit's vocabulary. Defaults to `neutral`. */
  tone?: Tone;
  /** Button size: `xs`, `sm`, `md` or `lg`. Defaults to `md`. */
  size?: ButtonSize;
  /**
   * Icon only: a square without horizontal padding, and no label is shown. An accessible name is
   * required.
   */
  iconOnly?: boolean;
  /**
   * Pressed state: the button renders as the `soft` variant of its tone with a shadow, regardless
   * of `variant`.
   */
  selected?: boolean;
}

export function buttonClasses({
  variant = "soft",
  tone = "neutral",
  size = "md",
  iconOnly = false,
  selected = false,
}: ButtonLookOptions): string {
  return cn(
    BASE,
    iconOnly ? ICON_SIZES[size] : SIZES[size],
    // The pressed state is drawn as the `soft` of the same tone, whatever the variant is:
    // `ghost` and `outline` have no fill of their own, and the pressed state must be visible.
    // The shadow separates it from a plain hover.
    selected
      ? cn(variantClasses("soft", tone), "shadow-[var(--shadow-1)]")
      : variantClasses(variant, tone)
  );
}
