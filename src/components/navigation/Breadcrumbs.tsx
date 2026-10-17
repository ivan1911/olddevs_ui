"use client";

import { ChevronRightIcon } from "../../icons.js";
import { cn } from "../../lib/cn.js";
import { useMessages } from "../../i18n/useMessages.js";
import { Link } from "../content/Link.js";

export interface Crumb {
  /** Crumb label. */
  label: string;
  /** Address. The last crumb never has one; see the doc comment. */
  href?: string;
}

export interface BreadcrumbsProps {
  /** Crumbs in order, from the root to the current screen. */
  items: Crumb[];
  /**
   * How many crumbs to show in full before the middle is collapsed.
   *
   * A chain longer than the limit collapses to the first crumb, an ellipsis and the last two.
   * The middle of the path says nothing about where the user is, while the first crumb (the
   * root) and the crumbs nearest to the current screen do.
   */
  maxItems?: number;
  /** Extra classes on the `nav`. */
  className?: string;
  /** Accessible name of the navigation. Defaults to the message catalog's string. */
  "aria-label"?: string;
}

/**
 * Breadcrumbs: the path to the current screen.
 *
 * **The last crumb is not a link**, and that is not a minor detail: a link to the page you are
 * already on does nothing when pressed, but a screen reader announces it as a link, which
 * promises a navigation that will not happen. The current crumb is marked `aria-current="page"`.
 *
 * The markup is a `nav` with a list: a screen reader can jump to it as a navigation landmark
 * and read the number of crumbs. A row of links separated by "/" gives neither.
 */
export function Breadcrumbs({
  items,
  maxItems = 4,
  className,
  "aria-label": ariaLabel,
}: BreadcrumbsProps) {
  const messages = useMessages();
  /*
    Collapsing: the first crumb, an ellipsis, the last two. The ellipsis is not a link and not
    a button: there is nowhere to expand the middle, and a button would promise an action. It is
    marked `aria-hidden`, because "…" says nothing when read aloud; the caption next to it gives
    the number of skipped crumbs.
  */
  /*
    Collapsing only makes sense when there is something TO HIDE.

    The condition used to be just `items.length > maxItems`, but the collapsed view was always
    built as "first + … + last two", which is three crumbs. Short chains broke: with two crumbs
    and `maxItems={1}` the first crumb landed both at the start and at the end (the root was
    drawn TWICE), and `skipped` went negative, so the caption read "-1 more". The
    input is reachable through the docs: the Breadcrumbs page explicitly advises lowering
    `maxItems` in a narrow header.
  */
  const collapsed = items.length > maxItems && items.length > 3;
  const shown: (Crumb | "gap")[] = collapsed ? [items[0]!, "gap", ...items.slice(-2)] : [...items];
  const skipped = collapsed ? items.length - 3 : 0;

  return (
    <nav aria-label={ariaLabel ?? messages.breadcrumbs.label} className={cn("min-w-0", className)}>
      <ol className="text-fg-2 flex flex-wrap items-center gap-1.5 text-sm">
        {shown.map((item, index) => {
          const last = index === shown.length - 1;

          return (
            <li
              key={item === "gap" ? "gap" : `${item.label}-${index}`}
              className="flex min-w-0 items-center gap-1.5"
            >
              {item === "gap" ? (
                // `aria-hidden` is required: without it, `title` gives the ellipsis an
                // accessible name, and a screen reader reads "3 more" as a crumb
                // of the path. It already knows the count from the length of the list.
                <span
                  aria-hidden
                  className="text-fg-3"
                  title={messages.breadcrumbs.collapsed({ count: skipped })}
                >
                  …
                </span>
              ) : last || !item.href ? (
                // Current crumb: not a link, but announced as the current item.
                <span aria-current={last ? "page" : undefined} className="text-fg-0 truncate">
                  {item.label}
                </span>
              ) : (
                <Link href={item.href} variant="quiet" tone="neutral" className="truncate">
                  {item.label}
                </Link>
              )}
              {!last ? (
                <ChevronRightIcon size={12} aria-hidden className="text-fg-3 shrink-0" />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
