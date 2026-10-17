"use client";

import type { ComponentPropsWithoutRef, CSSProperties } from "react";
import { cn } from "../../lib/cn.js";

export interface AspectRatioProps extends ComponentPropsWithoutRef<"div"> {
  /**
   * Aspect ratio as a number: `16 / 9`, `1`, `9 / 16`.
   *
   * A number rather than the string `"16:9"`: a string would have to be parsed, and a typo
   * in it (`"16/9"` instead of `"16:9"`) would get past the compiler. A number can also be
   * written as arithmetic, which the compiler evaluates for you.
   */
  ratio?: number;
}

/**
 * A box with a fixed aspect ratio, for image previews, avatars and thumbnails.
 *
 * Built on the native `aspect-ratio`, not on the `padding-bottom: 56.25%` trick: that trick
 * requires absolutely positioned content, which dictates the layout inside the box and breaks
 * on anything that should grow with its content.
 *
 * The ratio goes into an inline style, not into the `aspect-[16/9]` class: a Tailwind class with
 * an arbitrary value has to appear in the source as literal text, while the number arrives as
 * a prop at runtime. Same situation as multi-line truncation in `Text`.
 */
export function AspectRatio({
  ratio = 16 / 9,
  className,
  style,
  children,
  ...rest
}: AspectRatioProps) {
  return (
    <div
      className={cn("relative w-full overflow-hidden", className)}
      style={{ aspectRatio: String(ratio), ...style } as CSSProperties}
      {...rest}
    >
      {children}
    </div>
  );
}
