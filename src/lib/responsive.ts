/**
 * Mapping breakpoint values to Tailwind classes.
 *
 * A shared mechanism for props of the form "one value, or its own value at each screen
 * width": `columns` of `Grid`, `slidesPerView` of `Carousel`. The module knows only the
 * breakpoints and the parsing rule. THE CLASSES ARE SUPPLIED BY THE COMPONENT, in its own
 * vocabulary.
 *
 * Why a vocabulary rather than building the string (`` `${bp}:grid-cols-${n}` ``): Tailwind
 * scans the sources as text and does not execute code. A class concatenated at runtime
 * never reaches the CSS, and the build passes without a warning: the component simply
 * ends up without a layout. So every class with its own prefix is written out in full in
 * the component's vocabulary, and this module only selects among them.
 *
 * The breakpoints are the standard Tailwind 4 ones, and exactly the ones where the kit
 * collapses: `sm` (640) in `FormLayout`, `md` (768) in `AppShell`, `lg` (1024) in page
 * layouts. The kit does not define its own values in `styles.css`, so the prefix here and
 * the media query on the consumer's side match by construction. `base` has no prefix, that
 * is, it starts from zero: the scale is mobile-first, as in Tailwind itself.
 *
 * A media query, not `matchMedia`: a layout that depends on JS shows the wrong one until
 * hydration (ADR-0018), while a class works from the first frame and on the server.
 */

/** Breakpoints in ascending order of width. The order matters: the larger one overrides the smaller. */
export const BREAKPOINTS = ["base", "sm", "md", "lg", "xl"] as const;

export type Breakpoint = (typeof BREAKPOINTS)[number];

/**
 * One value for all widths, or a separate value from each breakpoint.
 *
 * An object is read as in Tailwind: a value applies from its width up, until the next key
 * overrides it. A missing key inherits from the smaller one. A missing `base` means "no
 * class": what that produces is up to the component (for a grid, one column, as with any
 * `display: grid`).
 */
export type Responsive<T extends PropertyKey> = T | Partial<Record<Breakpoint, T>>;

/**
 * A component's vocabulary: for each breakpoint, a class for each value.
 *
 * The type requires ALL breakpoints and ALL values: a missing cell would be a value that
 * the type lets through while the CSS does not know it. Values under `base` have no prefix;
 * the others have the breakpoint prefix (`md:grid-cols-3`).
 */
export type ResponsiveClassMap<T extends PropertyKey> = Record<Breakpoint, Record<T, string>>;

/**
 * Expands a value into classes using the vocabulary.
 *
 * A scalar is `base`: without a prefix, the class applies at any width. An empty value
 * (`undefined`) gives an empty string, and the component decides for itself what counts
 * as the default.
 */
export function responsiveClasses<T extends PropertyKey>(
  value: Responsive<T> | undefined,
  map: ResponsiveClassMap<T>
): string {
  if (value == null) return "";
  // `T` is a number or a string, so an object here unambiguously means "per breakpoint".
  const byBreakpoint: Partial<Record<Breakpoint, T>> =
    typeof value === "object" ? value : { base: value };

  // A value outside the vocabulary (a consumer in JS, with no type checks) produces no class
  // at all, rather than the string `undefined` in the markup.
  return BREAKPOINTS.flatMap((breakpoint) => {
    const at = byBreakpoint[breakpoint];
    const cls = at == null ? undefined : (map[breakpoint][at] as string | undefined);
    return cls ? [cls] : [];
  }).join(" ");
}
