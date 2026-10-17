"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type CSSProperties,
  type ReactNode,
  type SyntheticEvent,
} from "react";
import { ImageIcon } from "../../icons.js";
import { cn } from "../../lib/cn.js";

export interface ImageProps extends Omit<
  ComponentPropsWithoutRef<"img">,
  "className" | "loading" | "src" | "alt"
> {
  /** Image URL. An empty value is the same as a failed load: the fallback is rendered. */
  src?: string | null;
  /**
   * Alternative text, required.
   *
   * An empty string is a valid value and means "the image is decorative": a photo tile next to
   * its name, a category preview next to the category name. The requirement is about the choice, not
   * the text: `alt=""` is a decision, while a missing attribute is an oversight, and in that case a
   * screen reader reads the file name aloud.
   */
  alt: string;
  /** How the image fits its box. Has no effect with `sizing="intrinsic"`. */
  fit?: "cover" | "contain";
  /**
   * Who sets the size: the box or the image itself.
   *
   * `fill` (default): the size is known from outside, such as a grid tile, an avatar or a preview
   * of fixed height. The image stretches to the box and fits by `fit`.
   *
   * `intrinsic`: the image sets the size and the box wraps it. This is how the frame viewer works:
   * it has no height of its own, only a ceiling (`max-h-[45vh]`), and the ceiling must go on the
   * image, via `imgClassName`. Putting it on the box is wrong: the box would crop the frame instead
   * of scaling it down.
   *
   * The difference is not cosmetic: in `fill` mode the image gets `h-full w-full`, that is percentages
   * of the box, and a box without its own size collapses to zero together with the image. Lazy loading
   * does not start at all then: the browser has nothing to show.
   */
  sizing?: "fill" | "intrinsic";
  /**
   * The box aspect ratio as a number (`16 / 9`). Without it, the height is set by the surrounding
   * layout, as it is for every tile in a grid.
   */
  ratio?: number;
  /**
   * What to show instead of the image when it is missing or fails to load. By default, a muted icon
   * on a muted backdrop; `null` leaves an empty box.
   *
   * A custom node gets only centering and space: no backdrop or text color is imposed on it.
   * Otherwise a fallback with its own background (a category letter colored by the category name)
   * could not exist: the default backdrop would cover it.
   */
  fallback?: ReactNode;
  /** Skeleton under the image while it loads. */
  skeleton?: boolean;
  /**
   * Whether to load the image right away, without deferring. Loading is deferred by default, but
   * for an image on the first screen that hurts: the browser postpones it, which worsens the LCP
   * (Largest Contentful Paint) metric.
   */
  eager?: boolean;
  /** Box classes: size, corner radius, border. */
  className?: string;
  /**
   * Classes for the image itself. Rarely needed in `fill` mode, where fitting is set by `fit`; in
   * `intrinsic` mode, size constraints go here.
   */
  imgClassName?: string;
  /** Inline style of the image. Needed where the visual element is the image, not the box. */
  imgStyle?: CSSProperties;
}

const FIT = {
  cover: "object-cover",
  contain: "object-contain",
} as const;

/**
 * An image with all three states: loading, loaded, failed.
 *
 * Before the package, a raw `<img>` was spread over 24 files of the front end, and each place solved
 * the same problem its own way: `loading="lazy"` was set in some and forgotten in others, there was no
 * fallback for a broken `src` anywhere, no skeleton anywhere, and `object-cover` with a radius was written
 * out again in each. Divergence like that shows up only when the 24 files are open side by side, and
 * fixing it takes 24 edits.
 *
 * The decision is to build on a plain `<img>`, not on `next/image` — [ADR-0011]. In short: the package
 * does not know the consumer's framework, and product images already come from S3 in two sizes, so they
 * are optimized where they are stored.
 *
 * STRUCTURE: a box with an image inside it. The box gets the size, the radius and the border
 * (`className`); the image gets the fitting. The split is forced: the skeleton and the fallback need an
 * element that stays in place when the image itself is absent; otherwise the tile would collapse to zero
 * and the layout would jump.
 *
 * `radius` is not a separate prop: the box already accepts `className`, and the front end has seven
 * different image radii (`10px`, `lg`, `xl`, `50%`, …). A scale of three steps would describe not the
 * domain but get in its way. The same reason why `Skeleton` takes raw numbers.
 */
export const Image = forwardRef<HTMLImageElement, ImageProps>(function Image(
  {
    src,
    alt,
    fit = "cover",
    sizing = "fill",
    ratio,
    fallback,
    skeleton = true,
    eager = false,
    className,
    imgClassName,
    imgStyle,
    style,
    onLoad,
    onError,
    ...rest
  },
  ref
) {
  // The state is tied to the address: when it changes, everything starts over.
  // Without a reset, a tile that failed once would keep the fallback forever, including after
  // "Try again" and after pagination that reuses the same node for another image.
  const [state, setState] = useState<"loading" | "loaded" | "failed">(src ? "loading" : "failed");
  const imgRef = useRef<HTMLImageElement | null>(null);

  const setRefs = useCallback(
    (node: HTMLImageElement | null) => {
      imgRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    },
    [ref]
  );

  useEffect(() => {
    if (!src) {
      setState("failed");
      return;
    }
    setState("loading");

    // AN IMAGE FROM THE CACHE IS ALREADY READY by the time React attaches the handler, and no `load`
    // event will come for it at all. Without this check the skeleton stays in the markup forever: it
    // sits UNDER the image, so on an opaque preview it is invisible, and the defect lives silently.
    // Found during rollout: on the library screen, 33 of 58 tiles kept a dead skeleton while their
    // images were fully loaded.
    const node = imgRef.current;
    if (node?.complete) setState(node.naturalWidth > 0 ? "loaded" : "failed");
  }, [src]);

  const failed = state === "failed";
  const intrinsic = sizing === "intrinsic";
  // The default brings its OWN backdrop instead of receiving one from the wrapper: the wrapper
  // provides only space and centering, because a custom fallback is colored by the caller (a category
  // letter is colored by its name, and a foreign backdrop would cover it).
  const fallbackNode =
    fallback === undefined ? (
      <span className="bg-bg-2 text-fg-3 flex h-full w-full items-center justify-center">
        <ImageIcon size={18} strokeWidth={1.5} />
      </span>
    ) : (
      fallback
    );

  return (
    <span
      className={cn("relative overflow-hidden", intrinsic ? "inline-block" : "block", className)}
      style={ratio ? { aspectRatio: ratio, ...style } : style}
    >
      {/* The skeleton sits UNDER the image, not in its place: the browser starts loading only when the
          `<img>` is in the tree, and a swap would delay the load, since it cannot start without the element.

          In `intrinsic` mode there is no skeleton and there cannot be one: until loading, the box wraps
          nothing and has no size of its own, so there is nothing to stretch the skeleton over. The caller
          holds the space for the frame there. */}
      {skeleton && !intrinsic && state === "loading" ? (
        <span aria-hidden className="skeleton absolute inset-0 block rounded-none" />
      ) : null}

      {failed ? (
        fallbackNode ? (
          <span
            // An empty `alt` means "the image is decorative", and the fallback inherits that decision.
            // A meaningful label must not be lost, though: without it, the failure turns a named object
            // into an empty space, and the screen reader does not learn about it at all.
            {...(alt ? { role: "img", "aria-label": alt } : { "aria-hidden": true })}
            className={cn("flex items-center justify-center", intrinsic ? "" : "absolute inset-0")}
          >
            {fallbackNode}
          </span>
        ) : null
      ) : (
        <img
          ref={setRefs}
          src={src ?? undefined}
          alt={alt}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          style={imgStyle}
          className={cn("block", intrinsic ? null : cn("h-full w-full", FIT[fit]), imgClassName)}
          onLoad={(e: SyntheticEvent<HTMLImageElement>) => {
            setState("loaded");
            onLoad?.(e);
          }}
          onError={(e: SyntheticEvent<HTMLImageElement>) => {
            setState("failed");
            onError?.(e);
          }}
          {...rest}
        />
      )}
    </span>
  );
});
