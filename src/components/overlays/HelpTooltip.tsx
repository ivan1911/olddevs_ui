"use client";

import type { ReactNode } from "react";
import { cn } from "../../lib/cn.js";
import { HelpIcon } from "../../icons.js";
import { Popover, PopoverContent, PopoverTrigger } from "./Popover.js";
import { keyGlyphs } from "../content/Kbd.js";

export interface HelpTooltipProps {
  /** Accessible name of the help button: "What the dashboard shows". */
  label: string;
  /** Title inside the popover. */
  title?: ReactNode;
  /** Content of the help text. */
  children: ReactNode;
  /**
   * The whole key combination as a string, in the form it should be shown: `⌘+Shift+L`.
   *
   * The whole string, not just the letter: the component used to build
   * `${modifier}+Shift+${letter}` itself, and so knew that every shortcut of the app
   * was Mod+Shift+letter. A design system has no way to know that, and a combination
   * without Shift would no longer fit into it.
   *
   * For the same reason the modifier is not computed here: platform detection is
   * `react-device-detect` in the consumer, and there is no point pulling it into the package
   * for one symbol.
   */
  shortcut?: string;
  /** Label to the left of the combination: "Open section". Without the domain the package cannot guess it. */
  shortcutLabel?: ReactNode;
  /** Own icon instead of the question mark. */
  icon?: ReactNode;
  /** Alignment of the panel relative to the help button: `start`, `center` or `end`. Defaults to `start`. */
  align?: "start" | "center" | "end";
  /** Distance from the button to the panel, in pixels. Defaults to 8. */
  sideOffset?: number;
  /** Width of the panel as a class: explanations come in different lengths. Defaults to `w-[340px]`. */
  widthClassName?: string;
}

/**
 * A help button that expands an explanatory text.
 *
 * It differs from `Tooltip` not in its look but in its behavior: a tooltip shows on hover
 * and disappears, while here a paragraph of text goes in that has to be readable in time —
 * so this is a popover opened by a click, with a focusable trigger.
 */
export function HelpTooltip({
  label,
  title,
  children,
  shortcut,
  shortcutLabel,
  icon,
  align = "start",
  sideOffset = 8,
  widthClassName = "w-[340px]",
}: HelpTooltipProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          // The focus ring is its own, not the global `:focus-visible` from styles.css: the
          // primitive must not depend on whether the consumer loaded the base styles. The same
          // principle as in `Chip`.
          className={cn(
            "text-fg-3 hover:text-fg-1 focus-visible:text-fg-1 inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-full transition-colors",
            "focus-visible:outline-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2"
          )}
          aria-label={label}
          title={label}
        >
          <span className="border-line-soft bg-bg-2/70 inline-flex h-5 w-5 items-center justify-center rounded-full border-[0.75px]">
            {icon ?? <HelpIcon size={12} strokeWidth={1.55} aria-hidden />}
          </span>
        </button>
      </PopoverTrigger>

      <PopoverContent align={align} sideOffset={sideOffset} className={cn(widthClassName, "p-4")}>
        <div className="flex flex-col gap-3">
          {title ? <div className="text-md font-semibold">{title}</div> : null}
          {children}
          {shortcut ? (
            <div className="text-fg-3 border-line-soft bg-bg-2/60 rounded-control flex items-center justify-between border px-2.5 py-2 text-[11px] leading-relaxed">
              <span>{shortcutLabel}</span>
              <kbd className="bg-bg-3 border-line text-fg-1 rounded-md border px-2 py-0.5 font-mono font-medium">
                {keyGlyphs(shortcut)}
              </kbd>
            </div>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
