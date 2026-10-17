"use client";

import { useCallback, useEffect, useRef, useState, type ComponentPropsWithoutRef } from "react";
import { cn } from "../../lib/cn.js";
import { Tooltip } from "../overlays/Tooltip.js";

export interface TruncateProps extends Omit<ComponentPropsWithoutRef<"span">, "children"> {
  /** The text. A string, not markup: the tooltip shows the same value. */
  children: string;
  /** How many lines to show. `1` truncates to a single line with an ellipsis. */
  lines?: number;
  /** The side the tooltip with the full text opens on. Defaults to `top`. */
  side?: "top" | "right" | "bottom" | "left";
}

/**
 * Text truncated to fit its width, with a tooltip showing the full value.
 *
 * THE TOOLTIP APPEARS ONLY WHEN THE TEXT IS ACTUALLY TRUNCATED. A tooltip over untruncated text is
 * noise: it repeats what is already visible and teaches people to ignore it. Truncation is MEASURED
 * (`scrollWidth > clientWidth`), not guessed from the string length: how many characters fit depends
 * on the container width and the font, not on the character count.
 *
 * The measurement is repeated when the size changes, through a `ResizeObserver`: a table column
 * dragged with the mouse changes the truncation without changing the text.
 *
 * THE FULL VALUE IS AVAILABLE FROM THE KEYBOARD. Truncated text gets `tabIndex={0}`, and the tooltip
 * opens on focus just as it does on hover. Without this the value would be reachable only with a
 * mouse, which means not reachable at all for someone who does not use one.
 *
 * A screen reader reads the text IN FULL without our help: the truncation is visual only, and the
 * whole string is in the DOM.
 */
export function Truncate({ children, lines = 1, side = "top", className, ...rest }: TruncateProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [truncated, setTruncated] = useState(false);

  const measure = useCallback(() => {
    const el = ref.current;
    if (el == null) return;
    setTruncated(el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight);
  }, []);

  /*
    `truncated` is in the dependencies not for recalculation but to RE-SUBSCRIBE. When the text
    first becomes truncated, the `span` is wrapped in a `Tooltip`, and React recreates the node:
    the old one, which the observer was attached to, dies, and the new one is left without an
    observer. A column widened after truncation then did not remove either `tabIndex` or the
    tooltip: caught in review of 2.5.0. A repeated `measure()` changes nothing here: the value is
    the same, and React skips the re-render.
  */
  useEffect(() => {
    measure();
    const el = ref.current;
    if (el == null || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [measure, children, lines, truncated]);

  const text = (
    <span
      ref={ref}
      // Only truncated text gets focus: untruncated text does not need a place in the keyboard
      // order, and it would get in the way.
      tabIndex={truncated ? 0 : undefined}
      className={cn(
        "focus-visible:outline-accent-strong min-w-0 focus-visible:outline-2 focus-visible:outline-offset-2",
        lines === 1
          ? "block truncate"
          : // `block` must not be added here: in CSS it comes after `[display:-webkit-box]`,
            // overrides it, and `line-clamp` silently stops working.
            // Multi-line truncation: `line-clamp` counts the lines itself, and the number comes in
            // as a variable. Otherwise the class would be built by concatenation, and a class like
            // that does not exist in the sources, so Tailwind would not see it.
            "[display:-webkit-box] overflow-hidden [-webkit-box-orient:vertical]",
        className
      )}
      style={lines === 1 ? undefined : { WebkitLineClamp: lines }}
      {...rest}
    >
      {children}
    </span>
  );

  // Without truncation there is no tooltip at all: a `Tooltip` with empty `content` renders its
  // child as is, but the extra wrapper would be pointless.
  if (!truncated) return text;

  return (
    <Tooltip content={children} side={side}>
      {text}
    </Tooltip>
  );
}
