"use client";

import { Slot, Slottable } from "@radix-ui/react-slot";
import {
  cloneElement,
  forwardRef,
  isValidElement,
  type ComponentPropsWithoutRef,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { buttonClasses, SPINNER_BASE, SPINNER_SIZES } from "../../lib/button.js";
import { cn } from "../../lib/cn.js";
import type { ButtonSize, Tone, Variant } from "../../lib/variants.js";

export interface ButtonProps extends Omit<ComponentPropsWithoutRef<"button">, "children"> {
  /** Button label. Not rendered with `iconOnly`; with `asChild` the child element owns the content. */
  children?: ReactNode;
  /** Variant: `solid`, `soft`, `outline` or `ghost` from the kit's vocabulary. Defaults to `soft`. */
  variant?: Variant;
  /** Tone: the button's color role from the kit's vocabulary. Defaults to `neutral`. */
  tone?: Tone;
  /**
   * Button size from the kit's vocabulary. Defaults to `md`.
   *
   * `xs` is the fourth step, introduced for the icon button in a list row: 20 pixels instead of
   * 30 for `sm`, otherwise a 32-pixel row grows to 42. A label is not expected in it — use it
   * together with `iconOnly`.
   */
  size?: ButtonSize;
  /** Icon before the label. During `loading` its place is taken by the submit ring. */
  icon?: ReactNode;
  /**
   * Icon only: a square without horizontal padding; the label is not rendered.
   *
   * Such a button needs an accessible name — from `aria-label` or `title`. The compiler does not
   * require this (a union type breaks inference in Storybook and in wrappers, see `Toggle`), but
   * the axe audit does: an unnamed button fails it as `critical`. The check is in
   * `tests-visual/a11y.spec.ts`.
   */
  iconOnly?: boolean;
  /**
   * Submission in progress: a ring spins in place of the icon, the button is not pressable,
   * and the state is announced through `aria-busy`.
   *
   * The disabled state follows from this by itself — a separate `disabled` next to `loading`
   * is not needed. It used to be written that way in `ConfirmDialog`, and the login screen
   * repeated it by hand: fifteen lines of its own button with a shimmer.
   *
   * The indicator takes the icon slot. For a button without an icon this adds a slot for the
   * duration of the submission, so the label shifts — that is why a button that can go into
   * submission is better off getting its icon up front.
   *
   * With `asChild` the meaning is the same as `disabled` there: a link has no real attribute,
   * so the disabled state is expressed through `aria-disabled` and by removing pointer events.
   */
  loading?: boolean;
  /**
   * Pressed state of a toggle button: sets `aria-pressed` and the pressed look.
   *
   * Needed by a toolbar button that keeps something else open. Not `active`: the vocabulary
   * allows only `selected`.
   */
  selected?: boolean;
  /**
   * Render the button as its child element instead of its own `<button>`: a link, `next/link`, the
   * trigger of another component. Props and `ref` are merged into the child.
   *
   * It is needed where an element looks like a button but is not one: "Create campaign" leads
   * to another screen, and it is a link — it can be opened in a new tab with the middle mouse
   * button, its address can be copied, it shows in the status bar. A button with
   * `onClick={() => router.push(…)}` can do none of that.
   *
   * IMPORTANT: `type="button"` is not set under `asChild` — a link has no such attribute at all,
   * and React would render it into the markup as junk. Keyboard behavior changes, and this is
   * not a defect but a difference of roles: a button is pressed with Space and Enter, a link
   * only with Enter.
   *
   * Two props change behavior under `asChild`, because otherwise they would silently lie:
   *
   * - `disabled` does not exist as an attribute on a link: `<a disabled>` stays focusable and
   *   followable, and `disabled:opacity-50` does not fire, because `:disabled` is a pseudo-class
   *   of form fields. So here it turns into `aria-disabled` plus removing pointer events.
   * - `selected` does not turn into `aria-pressed`: the `link` role forbids that attribute, and
   *   the axe audit catches it as `aria-allowed-attr`. A pressed link does not exist — if the
   *   state is needed, it is a button, not a link.
   */
  asChild?: boolean;
}

/**
 * Button.
 *
 * The single `kind` prop of the front-end version is split into the two axes of the vocabulary.
 * Migration table:
 *
 *   kind="primary"  →  variant="solid"   tone="accent"
 *   kind="ghost"    →  variant="soft"    tone="neutral"   (the default)
 *   kind="quiet"    →  variant="ghost"   tone="neutral"
 *   kind="danger"   →  variant="outline" tone="danger"
 *   kind="success"  →  variant="solid"   tone="success"
 *
 * The main difference from the previous version: it kept hover in `useState` and attached
 * `onMouseEnter`/`onMouseLeave`, so a cursor hover caused a re-render, while keyboard focus and
 * touch were not highlighted at all. Here all of this is CSS pseudo-classes.
 *
 * The `iconRight` prop of the previous version is not carried over: out of 81 calls in the
 * front end it did not come up once. `tone="success"` and `size="lg"` are not used either, but
 * they are part of the shared axes of the vocabulary and cost nothing — unlike a separate prop
 * that would have to be maintained.
 *
 * `iconOnly` absorbed the separate `IconButton` primitive from the front end. That one was a
 * competing implementation of the same button: its own hover on `useState`, its own `active`
 * prop outside the vocabulary, its own set of sizes in numbers — and on top of that, two calls
 * of `Button` in the front end were made square by hand with `style={{ width: 36 }}`.
 * The idiom is not new: `Chip` had `iconOnly` from the start.
 */
/**
 * Removes a single child from the tab order.
 *
 * Touches nothing but `tabIndex`; the rest is decided by `Slot`. A non-element is returned as is:
 * failing the render on this is not acceptable.
 */
function disableChild(children: ReactNode): ReactNode {
  return isValidElement<{ tabIndex?: number }>(children)
    ? cloneElement(children, { tabIndex: -1 })
    : children;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    children,
    variant = "soft",
    tone = "neutral",
    size = "md",
    icon,
    iconOnly = false,
    loading = false,
    selected = false,
    asChild = false,
    className,
    type,
    ...rest
  },
  ref
) {
  const Comp = asChild ? Slot : "button";
  const { disabled, ...restWithoutDisabled } = rest;
  // Submission disables the button by itself: the two reasons for "not pressable" give a single
  // state on output, and the caller does not have to keep them in sync.
  const isDisabled = disabled || loading;
  // Under `asChild` the disabled state is expressed by role-agnostic means, and the attribute
  // itself does not go out — see the prop docstring.
  const passthrough = asChild
    ? restWithoutDisabled
    : { ...restWithoutDisabled, disabled: isDisabled };

  return (
    <Comp
      ref={ref}
      // The default `type="button"` lives here, not in the signature: under `asChild` the child
      // may have no `button` tag at all, and the attribute would end up in the link's markup.
      // Without the default, a button inside a form would submit it — exactly the defect the
      // default was introduced to prevent.
      type={asChild ? type : (type ?? "button")}
      // A toggle button must report its state, not only its label.
      aria-pressed={!asChild && selected ? true : undefined}
      aria-disabled={asChild && isDisabled ? true : undefined}
      aria-busy={loading || undefined}
      // The look is shared with the menu trigger — see `lib/button.ts`.
      className={cn(
        buttonClasses({ variant, tone, size, iconOnly, selected }),
        asChild && isDisabled && "pointer-events-none opacity-50",
        className
      )}
      {...passthrough}
      /*
        AFTER the spread, and the keys are added only when they are needed.

        The disabled state under `asChild` used to be expressed only by the advisory
        `aria-disabled` and the `pointer-events-none` class, which blocks just the pointer: the
        link stayed in the tab order and fired on Enter — `<Button asChild loading><a href="/pay">`
        would pull keyboard users away from the page right in the middle of submitting a form.

        The link has no `disabled` attribute, so activation is blocked by hand. A conditional
        spread, not props with the value `undefined`: such a key still ends up in the object and
        overwrites someone else's.

        THE ORDER DOES NOT AFFECT ANYTHING HERE, and the first version of this comment claimed the
        opposite. Under `asChild` `Slot` is rendered, and it gives priority to the CHILD's props
        regardless of where the spread stands: a link with its own `tabIndex={0}` stayed in the
        tab order no matter where the spread was placed. That is why the tab order is removed not
        here but on the child itself — see `Slottable` below.
      */
      {...(asChild && isDisabled
        ? {
            tabIndex: -1,
            onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
              if (event.key === "Enter" || event.key === " ") event.preventDefault();
            },
          }
        : null)}
    >
      {loading ? <span aria-hidden className={cn(SPINNER_BASE, SPINNER_SIZES[size])} /> : icon}
      {/*
        `Slottable` is not decoration but the only way to keep the icon. Slot merges props into a
        SINGLE child, and the pair "icon + link" would crash it at runtime. A wrapper around them
        would solve this at the cost of silent loss: the icon would have to be thrown away, or the
        consumer forced to put it inside the link by hand — that is, the `icon` prop under
        `asChild` would stop working without saying so.

        With `Slottable` the target becomes the child, and the icon stays a sibling and moves into
        the link together with the link's own content.

        A label under `asChild` is not wrapped in a `<span>`: there is nothing to wrap, the content
        belongs to the child. This does not affect the look — the button's layout is `flex` with
        `gap`, and bare text takes part in it as an anonymous box on a par with a `span`.
      */}
      {asChild ? (
        /*
          On a DISABLED link the tab order is removed on the child itself.

          `Slot` gives priority to the child's props, so `tabIndex: -1` passed to the button was
          simply overridden by a link with its own `tabIndex={0}` — and it stayed reachable with
          Tab, although it looked disabled. We clone the child so that the component, not the
          caller's markup, makes the decision.
        */
        <Slottable>{asChild && isDisabled ? disableChild(children) : children}</Slottable>
      ) : children != null && !iconOnly ? (
        <span>{children}</span>
      ) : null}
    </Comp>
  );
});
