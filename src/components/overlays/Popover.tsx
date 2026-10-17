"use client";

import * as PopoverPrimitive from "@radix-ui/react-popover";
import { forwardRef, type ComponentPropsWithoutRef } from "react";
import { cn } from "../../lib/cn.js";
import { OVERLAY_LAYER } from "../../lib/overlay-layer.js";
import { withoutToolbarAxis } from "../../lib/toolbar-axis.js";

/**
 * The popover panel: a surface for dropdown lists, calendars and rich help content.
 *
 * The compound API (`Popover` / `PopoverTrigger` / `PopoverContent`) is justified here, unlike
 * in `SearchSelect`: the panel has no content of its own, it only positions someone else's, and
 * a "one component with props" design would turn into forwarding a dozen Radix props outward.
 *
 * The behavior comes from `@radix-ui/react-popover` in the package's `dependencies` (ADR-0072).
 * Edge-aware positioning, portals, focus return and closing on Escape are not worth rewriting.
 */
export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverAnchor = PopoverPrimitive.Anchor;
export const PopoverClose = PopoverPrimitive.Close;

/** Portal for the panel. The `Toolbar` axis the panel is opened from does not pass inside it. */
const Portal = withoutToolbarAxis(PopoverPrimitive.Portal);

type RadixContentProps = ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>;

/**
 * Panel props: everything `Content` from Radix accepts, plus the same positioning props,
 * redeclared with descriptions. The library itself documents none of them, while the Reference
 * tables are built from these comments. The types are exactly Radix's
 * (`RadixContentProps[...]`): a consumer who passes Radix props gets no new compile error.
 */
export interface PopoverContentProps extends RadixContentProps {
  /**
   * Delegate the panel role to your own element instead of the default `div`: props and `ref` are
   * merged with the element's own. Defaults to `false`.
   */
  asChild?: RadixContentProps["asChild"];
  /** Side of the trigger the panel opens on: `top`, `right`, `bottom` or `left`. Defaults to `bottom`; if there is no room, the panel flips to the opposite side. */
  side?: RadixContentProps["side"];
  /** Distance from the trigger to the panel, in pixels. Defaults to 4. */
  sideOffset?: RadixContentProps["sideOffset"];
  /** Alignment of the panel along the chosen side: `start`, `center` or `end`. Defaults to `start`. */
  align?: RadixContentProps["align"];
  /** Offset of the panel along the alignment axis, in pixels. Defaults to 0. */
  alignOffset?: RadixContentProps["alignOffset"];
  /**
   * Minimum distance from the arrow to the panel's edge, in pixels. The kit does not render an
   * arrow: this matters only if you insert one yourself. Defaults to 0.
   */
  arrowPadding?: RadixContentProps["arrowPadding"];
  /**
   * Shift and flip the panel so that it does not extend past the edge of the window. Defaults to
   * `true`.
   */
  avoidCollisions?: RadixContentProps["avoidCollisions"];
  /** An element or list of elements that the panel stays within. Defaults to the browser window. */
  collisionBoundary?: RadixContentProps["collisionBoundary"];
  /** Padding from the collision boundary, in pixels: a number for all sides or an object per side. Defaults to 0. */
  collisionPadding?: RadixContentProps["collisionPadding"];
  /**
   * Keep the panel in view while the trigger is scrolled past an edge: `partial` while at least the
   * edge of the trigger is still visible, `always` at all times. Defaults to `partial`.
   */
  sticky?: RadixContentProps["sticky"];
  /** Hide the panel when the trigger has fully left the visible area. Defaults to `false`. */
  hideWhenDetached?: RadixContentProps["hideWhenDetached"];
  /** When to recalculate the panel position: `optimized` on resize and scroll, `always` on every frame. Defaults to `optimized`. */
  updatePositionStrategy?: RadixContentProps["updatePositionStrategy"];
}

export const PopoverContent = forwardRef<HTMLDivElement, PopoverContentProps>(
  function PopoverContent({ className, align = "start", sideOffset = 4, ...rest }, ref) {
    return (
      <Portal>
        <PopoverPrimitive.Content
          ref={ref}
          align={align}
          sideOffset={sideOffset}
          className={cn(
            /*
              `z-[120]` is above the window layer, not below it.

              A popover is always opened from something already on screen, so it never needs to sit
              under an overlay. At `z-50` the panel went under `ModalOverlay` (`z-90`) and under the
              edit drawer in the front app (`z-100`): it was in the markup, but not on screen.
              Consumers worked around this at the call site: in four places in the front app,
              `contentClassName="z-[200]"` and `"!z-[110]"` lived. So the default was wrong, not the
              call sites.
            */
            OVERLAY_LAYER.popover,
            "border-line-soft bg-bg-1 text-fg-0 shadow-2 rounded-md border p-0 outline-hidden",
            /*
              The enter animation is a kit token, not `tailwindcss-animate` utilities.

              Ten classes stood here (`animate-in`, `zoom-in-95`, `fade-in-0`, four `slide-in-from-*`
              and a pair of `-out`), and not one of them produced a rule: the plugin that declares
              them is not in the kit's dependencies and never was. The Tailwind build over
              `styles.css` and `src/` contained no such selector, and an open panel had
              `animationName` set to `none`. Those three lines described an animation that did not
              exist.

              The replacement is the kit's own token `animate-popoverIn`, modeled on `tooltipIn`:
              0.16 s against 0.4 s of the shared `fadein` that menus and `Select` use
              (`lib/menu.ts`). The shared token would fit in meaning but not in speed: it is designed
              for a full-screen window backdrop, while an anchored panel at four hundred milliseconds
              looks sluggish. The directional slide in from the trigger's side is lost: the kit's
              tokens have no `data-side` axis, and four tokens for four sides cost more than the loss.

              The exit is its own token, `animate-popoverOut`, the pair of `tooltipOut` in `Tooltip`:
              closing the panel fades it out over `--duration-fast` instead of removing it instantly.
            */
            "data-[state=open]:animate-popoverIn data-[state=closed]:animate-popoverOut",
            className
          )}
          {...rest}
        />
      </Portal>
    );
  }
);
