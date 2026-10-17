"use client";

import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "../../lib/cn.js";

export interface KbdProps extends ComponentPropsWithoutRef<"kbd"> {
  /** `sm` inside a menu item; `md` in the shortcut cheat sheet. */
  size?: "sm" | "md";
}

/** Apple modifier glyphs: `⌘ ⌥ ⇧ ⌃`. */
const KEY_SYMBOLS = /([⌘⌥⇧⌃])/;

/**
 * Key glyphs in a line are wrapped in separate `span`s set in the proportional font.
 *
 * The kit's monospace stack (SF Mono, Menlo) has no `⇧` glyph, so the browser takes it from
 * a fallback font, and the arrow comes out thin and pale next to `⌘` and a letter.
 * `--font-sans` has all four glyphs in one weight. The whole label cannot be switched to it:
 * the letters and digits of the keys keep the monospace row. The label text does not change:
 * a `span` without a role is read by screen readers as part of the surrounding text.
 *
 * Exported for menus: the shortcut hint on a `Menu`, `ContextMenu` and Slash menu item is its
 * own `<kbd>` of a different size, and the glyphs in it are the same.
 */
export function keyGlyphs(children: ReactNode): ReactNode {
  if (typeof children !== "string" || !KEY_SYMBOLS.test(children)) return children;
  return children.split(KEY_SYMBOLS).map((part, index) =>
    // Odd-indexed parts are the glyphs themselves: `split` with a capture group puts them between the pieces.
    index % 2 === 1 ? (
      <span key={index} data-key-symbol className="font-sans">
        {part}
      </span>
    ) : (
      part
    )
  );
}

/**
 * A keyboard key: `⌘`, `Esc`, `⇧+D`.
 *
 * The `<kbd>` tag is not cosmetic: it marks the content as user input, and screen readers
 * announce it differently from the surrounding text. Replacing it with a `<span>` styled as
 * monospace would look the same and mean nothing.
 *
 * The font comes from the `--font-mono` token, not the system `monospace`: key labels usually
 * sit next to each other (`⌘` + `K`), and glyphs of different widths make the row uneven.
 */
export function Kbd({ size = "sm", className, children, ...rest }: KbdProps) {
  return (
    <kbd
      className={cn(
        "border-line-soft bg-bg-2 text-fg-2 inline-flex items-center justify-center rounded-xs border font-mono",
        // The height is set, not derived, by the same rule as for controls: the key sits in a line
        // next to text, and its height must not depend on whether the label has one glyph or four.
        size === "sm" ? "text-caption h-5 min-w-5 px-1" : "h-6 min-w-6 px-1.5 text-xs",
        className
      )}
      {...rest}
    >
      {keyGlyphs(children)}
    </kbd>
  );
}
