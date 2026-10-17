"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { useMessages } from "../../../i18n/useMessages.js";
import { cn } from "../../../lib/cn.js";
import { EMOJI_CATEGORIES, EMOJI_COLUMNS, EMOJI_SET, type Emoji } from "./emoji.js";

export interface EmojiGridProps {
  /** An emoji is picked: `Enter` or Space in the grid, or a click on a cell. */
  onPick: (emoji: Emoji) => void;
  /**
   * Take focus on mount. For a host whose focus is set by a focus trap (a Radix popover), pass
   * `false`: a grid that took focus before the trap loses it again inside a `Dialog`.
   */
  autoFocus?: boolean;
  className?: string;
}

/** All emoji of the set in one flat list, in the order the keyboard walks through them. */
const FLAT: readonly { emoji: Emoji; category: (typeof EMOJI_CATEGORIES)[number] }[] =
  EMOJI_CATEGORIES.flatMap((category) => EMOJI_SET[category].map((emoji) => ({ emoji, category })));

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * Emoji grid: categories in order, each made of rows of ten.
 *
 * ARIA: THE GRID PATTERN FROM THE APG, AS IN `TableSizeGrid`. `role="grid"` — row groups
 * (`rowgroup`, one per category, named after it), rows (`row`) and cells (`gridcell`). Focus stays
 * on the grid itself, and `aria-activedescendant` names the current cell. A roving tabindex is
 * rejected for the same reason: there are eighty cells, and Tab stopping at each one would mean
 * eighty stops instead of one. The arrows move the selection one cell or one row at a time,
 * `Home` and `End` go to the ends of the row (with `Ctrl`, to the corners of the grid), and `Enter`
 * and Space insert. The grid does not listen to `Escape`: the Radix popover closes on it, and with
 * it the Escape stack (ADR-0041).
 *
 * THE CELL NAME IS WORDS. Screen readers read an emoji character differently, or not at all, so the
 * cell name comes from the message catalog (`emojiName`), and the character itself is only drawn.
 * The category label is visible to the eye, and screen readers hear it as the name of the row group:
 * a duplicate in the accessibility tree would be noise.
 *
 * ONE EMOJI IN TWO CATEGORIES — TWO CELLS. A cell's identifier is taken from its place in the grid,
 * not from its name: "Favorites" repeats some of the others.
 */
export function EmojiGrid({ onPick, autoFocus = true, className }: EmojiGridProps) {
  const messages = useMessages().editor;
  const id = useId();
  const gridRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (autoFocus) gridRef.current?.focus();
  }, [autoFocus]);

  // The active cell stays in view when the grid is scrolled with the arrows.
  const activeId = `${id}-${active}`;
  useEffect(() => {
    const node = document.getElementById(activeId);
    // jsdom has no such method; in a browser it always exists.
    node?.scrollIntoView?.({ block: "nearest" });
  }, [activeId]);

  const last = FLAT.length - 1;

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // Enter, which IME uses to confirm a word, and key combinations with Alt or Meta are not ours.
    if (event.nativeEvent.isComposing || event.altKey || event.metaKey) return;
    const rowStart = active - (active % EMOJI_COLUMNS);
    let next: number;
    switch (event.key) {
      case "ArrowRight":
        next = active + 1;
        break;
      case "ArrowLeft":
        next = active - 1;
        break;
      case "ArrowDown":
        next = active + EMOJI_COLUMNS;
        break;
      case "ArrowUp":
        next = active - EMOJI_COLUMNS;
        break;
      case "Home":
        next = event.ctrlKey ? 0 : rowStart;
        break;
      case "End":
        next = event.ctrlKey ? last : rowStart + EMOJI_COLUMNS - 1;
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        onPick(FLAT[active]!.emoji);
        return;
      default:
        return;
    }
    event.preventDefault();
    setActive(clamp(next, 0, last));
  };

  let index = 0;
  return (
    <div
      ref={gridRef}
      role="grid"
      tabIndex={0}
      aria-label={messages.emojiGrid}
      aria-activedescendant={activeId}
      onKeyDown={onKeyDown}
      className={cn(
        "focus-visible:ring-focus flex max-h-72 flex-col gap-2 overflow-y-auto rounded-xs p-1",
        "outline-none focus-visible:ring-2",
        className
      )}
    >
      {EMOJI_CATEGORIES.map((category) => {
        const items = EMOJI_SET[category];
        const rows = Array.from({ length: items.length / EMOJI_COLUMNS }, (_, row) =>
          items.slice(row * EMOJI_COLUMNS, (row + 1) * EMOJI_COLUMNS)
        );
        const label = messages.emojiCategory[category];
        return (
          <div key={category} role="rowgroup" aria-label={label} className="flex flex-col gap-0.5">
            <div aria-hidden="true" className="text-fg-2 text-caption px-1 font-medium">
              {label}
            </div>
            {rows.map((row, rowIndex) => (
              <div key={rowIndex} role="row" className="flex gap-0.5">
                {row.map((emoji) => {
                  const position = index++;
                  const name = messages.emojiName[emoji.name];
                  return (
                    <div
                      key={position}
                      id={`${id}-${position}`}
                      role="gridcell"
                      aria-selected={position === active}
                      aria-label={name}
                      title={name}
                      onMouseEnter={() => setActive(position)}
                      onClick={() => onPick(emoji)}
                      className={cn(
                        "flex size-8 cursor-pointer items-center justify-center rounded-xs",
                        "text-lg leading-none select-none",
                        position === active ? "bg-accent-soft" : "hover:bg-bg-2"
                      )}
                    >
                      <span aria-hidden="true">{emoji.char}</span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
