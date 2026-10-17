"use client";

import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { CheckIcon } from "../../icons.js";
import { useMessages } from "../../i18n/useMessages.js";
import { cn } from "../../lib/cn.js";
import { AspectRatio } from "./AspectRatio.js";

export interface MediaCardProps extends Omit<
  ComponentPropsWithoutRef<"div">,
  "title" | "onSelect"
> {
  /** The preview, usually an `Image`. The tile does not implement its own loading or skeleton. */
  preview: ReactNode;
  /** Aspect ratio of the preview as a number: `16 / 9`, `1`, `9 / 16`. */
  ratio?: number;
  /** Caption below the preview. */
  title?: ReactNode;
  /** Second line: size, author, date — anything, already formatted. */
  subtitle?: ReactNode;
  /** Badges over the preview, usually `StatusBadge`. */
  badges?: ReactNode;
  /**
   * Actions over the preview, usually `Button iconOnly`.
   *
   * They are ALWAYS in the markup and always reachable from the keyboard. They are hidden with
   * opacity only, and shown on hover, on focus within, when the tile is selected, and always on
   * devices without hover (`hover: none`). An overlay that appears on `:hover` via `display: none`
   * is not reachable from the keyboard at all — and that is not "less convenient" but "unusable".
   */
  actions?: ReactNode;
  /**
   * The tile is selected.
   *
   * The selection border is drawn from it. The tile's own axis (a select button) is turned on
   * EXPLICITLY, as a pair of `selected` and `onSelectedChange`; `selected` alone only displays
   * someone else's axis, as in `VirtualGrid`. Without `selected` there is no border in the markup.
   */
  selected?: boolean;
  /** Called when the selection toggles, with the new value. Without it there is no selection axis. */
  onSelectedChange?: (selected: boolean) => void;
  /** Custom label of the select button. The default comes from the message catalog. */
  selectLabel?: string;
}

/**
 * A tile with an image: a preview, actions over it, badges and selection.
 *
 * THE BORDER WITH `Card`: `Card` is a content block, `MediaCard` is a tile whose main element is
 * the preview, with everything else laid over it or under it (ADR-0027). They share less than it
 * seems: a card has neither an aspect ratio, nor an overlay, nor selection.
 *
 * THE DOMAIN STAYS OUTSIDE. Favorites, duplicates, long press and navigation by tile are knowledge
 * of the application; nodes come in here. The generalization was made from the front end's `WPCard`
 * (212 lines), and the domain did not move together with the shape.
 *
 * SELECTION IS DECLARED AS STATE, not as a border. The button's `aria-pressed` tells screen readers
 * whether the tile is selected; the border is a visual signal, and a person who cannot see it would
 * otherwise not learn about the selection at all. The button label does NOT repeat the state:
 * `aria-pressed` is already announced, and "Select" read together with it is unambiguous.
 */
export const MediaCard = forwardRef<HTMLDivElement, MediaCardProps>(function MediaCard(
  {
    preview,
    ratio = 1,
    title,
    subtitle,
    badges,
    actions,
    selected,
    onSelectedChange,
    selectLabel,
    className,
    ...rest
  },
  ref
) {
  const messages = useMessages();
  const selectable = onSelectedChange != null;

  return (
    <div
      ref={ref}
      className={cn(
        "group border-line-soft bg-bg-2 relative flex flex-col overflow-hidden rounded-xl border transition-colors",
        // The border of a selected tile follows `selected`, not the presence of its own axis.
        // Inside `VirtualGrid` the axis belongs to the grid and the card only displays: `selected`
        // without `onSelectedChange`. A border driven only by its own axis left a selected tile in
        // the grid without any sign, although the Reference promised one. Without `selected` there
        // is no selection class in the markup, as before.
        selected && "border-accent-strong ring-accent-strong/40 ring-2",
        className
      )}
      {...rest}
    >
      <AspectRatio ratio={ratio} className="bg-bg-3">
        {preview}
      </AspectRatio>

      {badges != null && (
        <div className="pointer-events-none absolute top-2 left-2 flex flex-wrap gap-1">
          {badges}
        </div>
      )}

      {(actions != null || selectable) && (
        /*
          The overlay is ALWAYS in the markup. It is hidden with opacity and shown on hover, on focus
          within (`focus-within`) and when the tile is selected — otherwise a tile just deselected
          would lose its button under the cursor.
        */
        <div
          className={cn(
            /*
              Pointer events are turned off TOGETHER with the opacity and come back with it. `opacity` does
              not affect hit testing: an invisible overlay kept catching touches, and on a phone — where
              `:hover` does not fire and the panel is transparent forever — a touch on the tile's top-right
              corner landed on the invisible select button instead of opening the tile. The neighboring
              badges block has had this protection from the start.
            */
            "pointer-events-none absolute top-2 right-2 flex items-center gap-1 opacity-0 transition-opacity",
            "group-focus-within:pointer-events-auto group-focus-within:opacity-100",
            "group-hover:pointer-events-auto group-hover:opacity-100",
            // A coarse pointer gives no `:hover` at all: there the panel is open
            // always, otherwise the actions would be unreachable.
            "[@media(hover:none)]:pointer-events-auto [@media(hover:none)]:opacity-100",
            // A selected tile keeps the overlay open: otherwise the selection could only be cleared by moving
            // the cursor back, and from the keyboard only by moving focus back. In a grid the overlay
            // holds the checkbox of its axis (`Checkbox slot="selection"`) — the same rule applies.
            selected && "pointer-events-auto opacity-100"
          )}
        >
          {actions}
          {selectable && (
            <button
              type="button"
              aria-pressed={selected ?? false}
              aria-label={selectLabel ?? messages.mediaCard.select}
              onClick={() => onSelectedChange(!selected)}
              className={cn(
                "focus-visible:outline-accent-strong flex size-6 cursor-pointer items-center justify-center rounded-full border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2",
                selected
                  ? "border-accent-strong bg-accent-strong text-white"
                  : "border-line bg-bg-1/90 text-fg-2"
              )}
            >
              <CheckIcon size={14} />
            </button>
          )}
        </div>
      )}

      {(title != null || subtitle != null) && (
        <div className="flex min-w-0 flex-col gap-0.5 px-2.5 py-2">
          {title != null && <span className="truncate text-[13px] font-medium">{title}</span>}
          {subtitle != null && <span className="text-fg-2 truncate text-[11px]">{subtitle}</span>}
        </div>
      )}
    </div>
  );
});
