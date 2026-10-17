"use client";

import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type ReactElement,
  type ReactNode,
} from "react";
import { cn } from "../../lib/cn.js";
import { OVERLAY_LAYER } from "../../lib/overlay-layer.js";

export interface TooltipProps {
  /** Tooltip text. Empty means there is no tooltip, and `children` renders as is. */
  content?: ReactNode;
  /** The element the tooltip is attached to. Must accept a ref. */
  children: ReactElement;
  /** Side of the element to show the tooltip on: `top`, `right`, `bottom` or `left`. If there is no room, Radix moves it to another side. */
  side?: TooltipPrimitive.TooltipContentProps["side"];
  /** Alignment of the tooltip along the side: `start`, `center` or `end`. */
  align?: TooltipPrimitive.TooltipContentProps["align"];
  /** How many milliseconds the hover must last before the tooltip shows. If not set, the delay comes from `TooltipProvider`. */
  delayDuration?: number;
}

/**
 * A tooltip that shows on hover and focus.
 *
 * The behavior is `@radix-ui/react-tooltip` from the package's `dependencies`: it ships with the
 * kit, and the consumer does not install it (ADR-0072). The tooltip manages focus, Escape, portals
 * and positioning at the edge of the screen, and a home-grown implementation of this would be not
 * a primitive but a second library.
 *
 * `TooltipProvider` is deliberately NOT built into each instance: the provider sets the shared
 * delay and the grouping of tooltips for the whole application, and nested providers break that
 * grouping. The consumer mounts one at the root.
 *
 * An empty `content` returns `children` without a wrapper: the caller does not need to branch
 * itself, and no extra DOM layer appears.
 */
export function Tooltip({ content, children, side, align, delayDuration }: TooltipProps) {
  if (!content) return children;
  return (
    <TooltipPrimitive.Root delayDuration={delayDuration}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipContent side={side} align={align}>
        {content}
      </TooltipContent>
    </TooltipPrimitive.Root>
  );
}

export const TooltipContent = forwardRef<
  HTMLDivElement,
  ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(function TooltipContent({ className, sideOffset = 6, ...rest }, ref) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        className={cn(
          // A semi-transparent backdrop on the theme tokens: the color changes together with
          // `data-theme`, without any JS.
          //
          // `z-[120]` for the same reason as `Popover`: a tooltip is always triggered from
          // something already on screen, so it never needs to sit under an overlay. At `z-[60]`
          // it went under `ModalOverlay` (`z-90`) and under the edit drawer in the front app
          // (`z-100`): it was in the markup, but not on screen. This hit exactly the icon-only
          // buttons, where the tooltip is the label.
          OVERLAY_LAYER.popover,
          "text-fg-0 border-line-soft shadow-2 rounded-control max-w-[240px] border px-2.5 py-1.5",
          "bg-[color-mix(in_srgb,var(--bg-1)_85%,transparent)] backdrop-blur-[10px]",
          "text-xs font-medium select-none",
          "origin-[var(--radix-tooltip-content-transform-origin)]",
          "data-[state=delayed-open]:animate-tooltipIn data-[state=instant-open]:animate-tooltipIn",
          "data-[state=closed]:animate-tooltipOut",
          className
        )}
        {...rest}
      />
    </TooltipPrimitive.Portal>
  );
});

export const TooltipProvider = TooltipPrimitive.Provider;
export const TooltipRoot = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;
