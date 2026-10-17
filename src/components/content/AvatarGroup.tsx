"use client";

import { cn } from "../../lib/cn.js";
import { Avatar } from "./Avatar.js";

/** A member of the stack with a photo. A string in `names` is the same thing without `src`. */
export interface AvatarGroupMember {
  /** Member name: the initials, the hue and the avatar's alt text are derived from it. */
  name: string;
  /** Photo URL; without it, or if loading fails, the initials are shown. */
  src?: string | null;
}

export interface AvatarGroupProps {
  /**
   * Members: a name as a string, or an object `{ name, src? }`. The Avatar derives the initials
   * and the hue itself; the photo is drawn from `src`.
   */
  names: Array<string | AvatarGroupMember>;
  /**
   * How many avatars to show before "+N".
   *
   * The default is three. A row of ten overlapping circles does not convey a single name and
   * takes up space, while a number beyond the limit says the same thing more briefly.
   */
  max?: number;
  /** Size of the avatars in the stack: `md` or `lg`. Defaults to `md`. */
  size?: "md" | "lg";
  /** Classes for the root element. */
  className?: string;
  /** Accessible name of the stack for screen readers. */
  "aria-label"?: string;
}

/**
 * A stack of avatars with a "+N" remainder.
 *
 * The avatars overlap through a negative margin, and the stacking order is reversed (`z-index`
 * decreases): the first circle lies on top of the second. Otherwise the last one would cover
 * everyone, and the eye would read the row from right to left.
 *
 * **The list is announced as a whole, not circle by circle.** Each avatar has no label of its own:
 * it tells a screen reader nothing useful ("JD" is not a name). So the circles are hidden, and the
 * group carries one name with all the members. The reader gets a list, not a set of two-letter
 * fragments.
 */
export function AvatarGroup({
  names,
  max = 3,
  size = "md",
  className,
  "aria-label": ariaLabel,
}: AvatarGroupProps) {
  // A single shape for members: the rest of the code does not distinguish a string from an object.
  const members = names.map((entry) => (typeof entry === "string" ? { name: entry } : entry));
  const shown = members.slice(0, max);
  const rest = members.length - shown.length;
  // Overlap depends on the circle size: at 28px the earlier 8px plus the ring clipped the initials
  // on the left and also the "+N" badge; at 64px they do not get in the way.
  const overlap = size === "lg" ? "-ml-2" : "-ml-1";

  return (
    <span
      className={cn("inline-flex items-center", className)}
      aria-label={ariaLabel || members.map((member) => member.name).join(", ")}
      role="img"
    >
      {shown.map(({ name, src }, index) => (
        <span
          key={`${name}-${index}`}
          aria-hidden
          className={cn("ring-bg-1 relative rounded-full ring-2", index > 0 && overlap)}
          style={{ zIndex: shown.length - index }}
        >
          {/*
            `alt=""`: the circle is hidden and the group announces the name; a caption on the
            photo would be a second reading.
          */}
          <Avatar name={name} src={src} alt="" size={size} />
        </span>
      ))}
      {rest > 0 ? (
        <span
          aria-hidden
          className={cn(
            // `text-fg-1`, not `fg-2`: on the `bg-3` background the second step does not
            // reach 4.5 — caught by the axe audit. The "+N" remainder is content, not a hint.
            "bg-bg-3 text-fg-1 ring-bg-1 relative flex items-center justify-center rounded-full font-semibold ring-2",
            overlap,
            size === "lg" ? "text-md h-16 w-16" : "text-caption h-7 w-7"
          )}
        >
          +{rest}
        </span>
      ) : null}
    </span>
  );
}
