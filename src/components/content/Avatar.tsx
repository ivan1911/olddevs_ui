"use client";

import { forwardRef, useState, type ComponentPropsWithoutRef } from "react";
import { cn } from "../../lib/cn.js";
import type { Size } from "../../lib/variants.js";
import { Image } from "./Image.js";

export interface AvatarProps extends Omit<ComponentPropsWithoutRef<"span">, "children"> {
  /** Name or login. The initials and the hue are derived from it. */
  name?: string;
  /** `md` for lists and headers, `lg` for a profile card. */
  size?: Extract<Size, "md" | "lg">;
  /**
   * Photo URL. While it loads, a circle in the name's hue is shown; if there is no photo or it
   * fails to load, the initials are shown. An empty value is the same as no value: the markup
   * stays the same.
   */
  src?: string | null;
  /**
   * Alt text for the photo. Defaults to `name`; an empty string makes the photo decorative (the
   * person's name is written next to it). Has no effect without `src`: the initials are read as
   * plain text.
   */
  alt?: string;
}

/**
 * Initials in a circle with a hue derived from the name.
 *
 * The hue is computed from the first character rather than picked from a palette: the avatar has
 * to be recognizable and stable for the same person, and the list of people is not known in
 * advance.
 *
 * The previous version accepted `size` as a pixel number. Here it is a dictionary step: `size`
 * means the same thing in every primitive, and one primitive cannot interpret it differently.
 * Both steps are taken from actual call sites (28 and 64), not added as a spare margin.
 */
const SIZES = {
  md: "h-7 w-7 text-[11px]",
  lg: "h-16 w-16 text-[26px]",
} as const;

export const Avatar = forwardRef<HTMLSpanElement, AvatarProps>(function Avatar(
  { name: nameProp, size = "md", src, alt, className, style, ...rest },
  ref
) {
  /*
    An empty string is the ABSENCE of a name, not a name.

    The default in the signature only applies to `undefined`, so `name=""` (the backend returned
    a user with an empty `displayName`) reached the calculation: `"".charCodeAt(0)` gives `NaN`,
    the hue became `NaN`, and the browser discarded the whole
    `linear-gradient(... oklch(0.55 0.13 NaN) ...)` as invalid. There was no background, but the
    `text-text-on-accent` class remained. On a light theme this produced an empty circle, white on
    white; in `AvatarGroup`, a slot taken up with no content.
  */
  // For a plain string, `||` expresses the same rule as `hasContent` does for `ReactNode`, and it
  // does not fight the types: an empty string and `undefined` are both falsy. The predicate is
  // needed where `false` and `[]` can also be empty.
  const name = nameProp || "IV";
  const hue = (name.charCodeAt(0) * 7) % 360;
  const initials = name.slice(0, 2).toUpperCase();
  // The address whose photo has already loaded: after that the background is not needed. The
  // binding is to the address, not to a boolean flag: when `src` changes, the circle "loads" again
  // and the background comes back without a separate reset.
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const loaded = Boolean(src) && loadedSrc === src;

  return (
    <span
      ref={ref}
      className={cn(
        "text-text-on-accent inline-flex shrink-0 items-center justify-center rounded-full font-bold tracking-tight",
        SIZES[size],
        src && "relative",
        className
      )}
      style={{
        // The hue is computed from the name, so it cannot be expressed as a class.
        // Under a loaded photo the background is removed: for PNG and SVG with a transparent
        // background, the name's hue would show through the silhouette.
        background: loaded
          ? undefined
          : `linear-gradient(135deg, oklch(0.55 0.13 ${hue}), oklch(0.4 0.13 ${(hue + 60) % 360}))`,
        ...style,
      }}
      {...rest}
    >
      {src ? (
        <>
          {/*
            The invisible spacer stays IN THE FLOW: the root of a circle with a photo gets the same
            baseline as one with initials. Otherwise a circle with only a picture would sit on the
            line by its bottom edge, while one with initials sits by its text, and in a row with
            neighboring text the photo and the initials would be at different heights; on a load
            failure the circle would also jump. It is zero-width, not a copy of the initials: a copy
            would end up twice in `textContent` and in the consumer's text search.
          */}
          <span aria-hidden className="invisible">
            {"\u200B"}
          </span>
          {/*
            `Image` draws the photo and handles loading and failure itself (ADR-0011): there is no
            second `onError` handler here.

            The hue background stays on the ROOT, not on the fallback — which is why the skeleton is
            off: it would cover the background with a shimmer, and between "loading" and "failed to
            load" the circle would change its look twice. Only the content changes: a circle in the
            name's color becomes the photo or the initials on that same circle.

            The default `alt` is the name, but NOT the substituted "IV": the placeholder is not a
            person's name, and reading it aloud would invent a caption. Without a name and without
            `alt`, the photo is decorative.
          */}
          <Image
            src={src}
            alt={alt ?? nameProp ?? ""}
            skeleton={false}
            className="absolute inset-0 rounded-full"
            fallback={initials}
            onLoad={() => setLoadedSrc(src)}
          />
        </>
      ) : (
        initials
      )}
    </span>
  );
});
