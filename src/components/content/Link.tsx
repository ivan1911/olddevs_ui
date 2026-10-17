"use client";

import type { ComponentPropsWithRef, ElementType, ReactNode } from "react";
import { ExternalLinkIcon } from "../../icons.js";
import { cn } from "../../lib/cn.js";
import { useMessages } from "../../i18n/useMessages.js";
import { TONE_TOKENS, type Tone } from "../../lib/variants.js";

export type LinkVariant = "inline" | "standalone" | "quiet";

export interface LinkOwnProps {
  /** Link style: `inline` (always underlined), `standalone` (underlined on hover) or `quiet` (text color, accent on hover). Default `inline`. */
  variant?: LinkVariant;
  /** Link tone: `neutral`, `accent`, `success`, `warning` or `danger`. Default `accent`. */
  tone?: Tone;
  /**
   * The link goes outside: an icon appears next to the label.
   *
   * This prop does NOT set `target`. Whether an external link opens in a new tab is the screen's
   * decision, not the kit's: in one place it is convenient, in another it takes the user away from
   * a half-filled form.
   */
  external?: boolean;
  /** Link content. */
  children?: ReactNode;
  /** Classes of the root element. */
  className?: string;
}

/**
 * The props are polymorphic over `as`: with `next/link` the compiler accepts both `prefetch` and an
 * object `href`, while with a plain `a` only anchor attributes are accepted.
 *
 * Without this the type would be pinned to an anchor, and the compiler would reject every router prop
 * on a component that exists for the sake of the router.
 */
export type LinkProps<T extends ElementType = "a"> = LinkOwnProps & {
  /**
   * The tag or component the link renders as: `next/link`, the router's `Link`, or a plain `a`.
   *
   * The package deliberately knows nothing about routing: the consumer has its own, and a dependency
   * on it would turn the design system into part of the application.
   */
  as?: T;
} & Omit<ComponentPropsWithRef<T>, keyof LinkOwnProps | "as">;

/**
 * Underlining is not decoration but the second sign of a link.
 *
 * `inline` is ALWAYS underlined: a link inside a paragraph that differs from the text only by color
 * is indistinguishable for a person with color blindness. This is a direct requirement of WCAG 1.4.1,
 * and it is not relaxed by "our accent has enough contrast".
 *
 * `standalone` is a link on a line of its own: it is already visible from its position, and underlining
 * appears on hover. `quiet` is a link in the text color, with the accent only on hover: breadcrumbs and
 * utility links in the footer.
 */
const VARIANT_CLASS: Record<LinkVariant, string> = {
  inline: "underline underline-offset-2",
  standalone: "no-underline hover:underline hover:underline-offset-2",
  quiet: "no-underline hover:underline hover:underline-offset-2",
};

/**
 * The `quiet` tone on hover. A separate table of literal strings, not `hover:` combined with a
 * vocabulary token: Tailwind scans the sources as text, and a class assembled at runtime silently
 * misses the CSS, so the link would stay gray forever with no build error at all.
 */
const QUIET_HOVER_CLASS: Record<Tone, string> = {
  neutral: "hover:text-fg-0",
  accent: "hover:text-accent-strong",
  success: "hover:text-success-strong",
  warning: "hover:text-warning-strong",
  danger: "hover:text-danger-strong",
};

/**
 * Schemes that run code in the page's origin.
 *
 * Browsers ignore spaces and line breaks inside a scheme (`java\tscript:`), and case too, so the
 * cleaned start of the string is checked.
 */
function isExecutableHref(href: unknown): boolean {
  /*
    NOT A STRING, so not a scheme.

    `LinkProps` are polymorphic over `as`, and the prop's doc comment promises outright that with
    `next/link` the compiler accepts an object `href` (`{ pathname, query }`). A check added without
    narrowing the type called `.replace` on it and broke rendering: `TypeError: href.replace is not a
    function` — and on exactly the kind of call polymorphism exists for. An object cannot express an
    executable scheme: `UrlObject` has no `protocol` that would reach the `<a>`.
  */
  if (typeof href !== "string" || !href) return false;
  // Control characters NEED to be here: the browser strips them from a scheme, so
  // `java\u0000script:` is a working link, and we must strip them too.
  // eslint-disable-next-line no-control-regex
  const scheme = href.replace(/[\s\u0000-\u001f]/g, "").toLowerCase();
  return (
    /*
      Only EXECUTABLE types are blocked among `data:` URLs.

      Rejecting the whole scheme would silently break a legitimate
      `<Link href={csvDataUrl} download="report.csv">`: the label stayed on screen but could not be
      focused or pressed, and the rejection gave no explanation. Code is run by `text/html`,
      `application/xhtml+xml` and `image/svg+xml`; an image or a CSV is not code, and browsers already
      block top-level navigation to `data:` URLs on their own.
    */
    scheme.startsWith("javascript:") ||
    scheme.startsWith("vbscript:") ||
    scheme.startsWith("data:text/html") ||
    scheme.startsWith("data:application/xhtml+xml") ||
    scheme.startsWith("data:image/svg+xml")
  );
}

/**
 * Link.
 *
 * The tone works here as it does everywhere in the kit: as semantics, not as a shade. With `quiet`
 * it shows only on hover, so at rest such a link is colored with muted text, not with the tone.
 */
export function Link<T extends ElementType = "a">({
  as,
  variant = "inline",
  tone = "accent",
  external,
  className,
  children,
  ...rest
}: LinkProps<T>) {
  const messages = useMessages();
  const Comp = (as ?? "a") as ElementType;

  /*
    `rel` is derived from `target`, not from `external`, and this is not pedantry.
    `noopener` stops the opened tab from reaching `window.opener`, so it matters exactly when a tab is
    opened. Putting it on an ordinary same-page link would be a safeguard against something that cannot
    happen, and would train the reader to skip `rel` when reading the code.

    The reverse is also true: `target="_blank"` gets `rel` whether or not the link is declared external —
    the hole is opened by a tag, not by a prop.
  */
  const props = rest as { target?: string; rel?: string; href?: unknown };
  const opensNewTab = props.target === "_blank";
  const rel = opensNewTab ? (props.rel ?? "noopener noreferrer") : props.rel;

  /*
    EXECUTABLE SCHEMES do not reach the markup.

    The component already takes care of link safety — it derives `rel` from `target` with the reasoning
    "the tag opens the hole, not the prop" — but it never checked the scheme: `href` went to the `<a>` as is.
    A "website" field in a user profile, rendered as `<Link href={profile.website}>` with the value
    `javascript:fetch('/api/keys')…`, produced a WORKING link: a click ran code in the application's origin
    with the session cookie.

    A BLOCKLIST, NOT AN ALLOWLIST, and this is the owner's decision. An allowlist would silently break the
    application's own schemes — `slack://`, `ms-teams://`, internal admin protocols. Only what runs code is
    rejected: `javascript:`, `vbscript:` and executable `data:` types (see `isExecutableHref`). Everything
    else — `http`, `https`, `mailto`, `tel`, relative paths, anchors, an image or a CSV in `data:` — passes
    through unchanged.

    A link without `href` stays in the markup as an `<a>` with no address: this way the consumer sees that
    the value was rejected, instead of guessing why nothing happens.
  */
  const href = isExecutableHref(props.href) ? undefined : props.href;

  return (
    <Comp
      {...rest}
      href={href}
      rel={rel}
      className={cn(
        // The layout is NOT flex, and this matters: `inline-flex` is an atomic box, and its text does not
        // break across lines. A four-word link inside a paragraph would move whole to the next line or
        // overflow the edge, so the `inline` variant would fail exactly where it is meant to work. That
        // is why the icon below carries its own spacing.
        "focus-visible:outline-accent-strong transition-colors focus-visible:outline-2 focus-visible:outline-offset-2",
        variant === "quiet" ? cn("text-fg-2", QUIET_HOVER_CLASS[tone]) : TONE_TOKENS[tone].fg,
        VARIANT_CLASS[variant],
        className
      )}
    >
      {children}
      {external ? (
        <ExternalLinkIcon size={12} aria-hidden className="ml-1 inline-block align-[-1px]" />
      ) : null}
      {opensNewTab ? <span className="sr-only">{messages.link.opensInNewTab}</span> : null}
    </Comp>
  );
}
