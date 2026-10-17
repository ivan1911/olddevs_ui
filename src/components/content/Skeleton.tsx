"use client";

import { forwardRef, type ComponentPropsWithoutRef } from "react";
import { cn } from "../../lib/cn.js";

export interface SkeletonProps extends ComponentPropsWithoutRef<"div"> {
  /** Width. A number is treated as pixels, a string as a CSS value. */
  width?: number | string;
  /** Height. A number is pixels; a string is any CSS value. */
  height?: number | string;
  /** Border radius. Defaults to `--r-md`. */
  borderRadius?: number | string;
}

/**
 * Loading placeholder: a rectangle with a sweeping shimmer.
 *
 * The only primitive in the package that takes sizes as numbers and puts them into inline
 * `style`, and this is deliberate, not an oversight. A skeleton repeats the shape of what it
 * stands in for: 43 calls in the frontend set 12 different combinations of width, height and
 * radius (`4`, `10`, `3`, `6`, `8`, `0`, `"50%"`, `9999`). A scale of three steps would not
 * describe this domain, it would get in the way: every new block would need its own step.
 *
 * The shimmer itself is the `.skeleton` rule in `styles.css` (a gradient plus `shimmer`), not
 * utilities: an animation on `background-position` cannot be expressed with utilities.
 */
export const Skeleton = forwardRef<HTMLDivElement, SkeletonProps>(function Skeleton(
  { width, height, borderRadius, className, style, ...rest },
  ref
) {
  return (
    <div
      ref={ref}
      className={cn("skeleton", className)}
      style={{ width, height, borderRadius: borderRadius ?? "var(--r-md)", ...style }}
      {...rest}
    />
  );
});
