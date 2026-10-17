"use client";

import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { useMessages } from "../../i18n/useMessages.js";
import { cn } from "../../lib/cn.js";
import { hasContent } from "../../lib/empty.js";
import { Badge } from "./Badge.js";
import { SelectionBar } from "../navigation/SelectionBar.js";

export interface NotificationCenterProps extends Omit<ComponentPropsWithoutRef<"div">, "title"> {
  /** Title of the center. The default is "Notifications" from the message catalog. */
  title?: ReactNode;
  /**
   * Heading level, 2–4: the title becomes a real `<h2>`–`<h4>`.
   *
   * The level depends on where the center is placed — in a popover under the page's `h1`, or in a
   * drawer — and the consumer knows this, not the kit. Without the prop, the title stays plain text
   * and is not part of the page's heading structure.
   *
   * It is called `level`, as on `SectionHeader`: one concept, one name across the whole kit (the props
   * vocabulary in `docs/conventions.md`).
   */
  level?: 2 | 3 | 4;
  /**
   * The title's `id`, for the consumer's popover or drawer `aria-labelledby`.
   *
   * It goes on the title element, whatever that is: with `level` it is an `<hN>`, without it plain text,
   * and the surface's name comes from it all the same.
   */
  titleId?: string;
  /**
   * The total number of unread items, passed as a prop rather than counted from the rows.
   *
   * The list can be a page, while the counter refers to the whole collection: counting by the children,
   * the center would show "3" where there are three hundred unread.
   */
  unreadCount?: number;
  /** Filters — a slot. Their content is domain-specific: the application knows the event types. */
  filters?: ReactNode;
  /** Header actions — usually "mark all as read". */
  actions?: ReactNode;
  /** How many rows are selected. At zero there is no bulk-actions bar at all. */
  selectedCount?: number;
  /** Called when the user clears the selection. */
  onClearSelection?: () => void;
  /** Actions for the selected rows — usually `Button size="sm"`. */
  selectionActions?: ReactNode;
  /** The event list — usually `NotificationList`. */
  children?: ReactNode;
  /** Bottom: "Show all", a link to the events page. */
  footer?: ReactNode;
}

/**
 * The shell of an event feed: title, unread counter, filters, bulk actions.
 *
 * THE CENTER HAS NO SURFACE OF ITS OWN, and this is the main decision (ADR-0027). It is not a popover,
 * not a drawer and not a page — it is their content. The consumer places it inside an existing `Popover`
 * or `Drawer`, or directly on a page, and the center neither opens nor closes itself: the state of the
 * surface lives outside.
 *
 * Otherwise one surface would have to be chosen for all applications at once — while in an admin panel
 * the feed is more often a page, and in a client application more often a popover.
 *
 * BULK ACTIONS ARE THE EXISTING `SelectionBar`, not a bar of their own: it already has the counter,
 * clearing the selection, two action slots and the rule "at zero there is no bar at all". Stickiness is
 * off here: the center sits in a popover or a drawer, where there is nothing to stick to.
 *
 * THE COUNTER COMES AS A PROP. It cannot be computed from the children: the list can be a page of a
 * collection, and "3" instead of "300" is not rounding but a falsehood.
 */
export const NotificationCenter = forwardRef<HTMLDivElement, NotificationCenterProps>(
  function NotificationCenter(
    {
      title,
      level,
      titleId,
      unreadCount,
      filters,
      actions,
      selectedCount = 0,
      onClearSelection,
      selectionActions,
      children,
      footer,
      className,
      ...rest
    },
    ref
  ) {
    const messages = useMessages();
    // Without a level it stays a `span`, as before: the markup of those who pass no new props does
    // not change, and no headings are added to their page. A level outside 2–4 (a JS consumer,
    // `depth + 1`) is a `span` too: there is no `<h7>` element, and the title would silently drop
    // out of the structure along with its name.
    const Title = level === 2 || level === 3 || level === 4 ? (`h${level}` as const) : "span";

    return (
      <div ref={ref} className={cn("flex min-h-0 flex-col", className)} {...rest}>
        <div className="border-line-soft flex items-center gap-2 border-b px-3 py-2.5">
          <Title id={titleId} className="text-[13px] font-semibold">
            {/* An empty string is not a title: `??` would let it through, and the center would be left unnamed. */}
            {hasContent(title) ? title : messages.notifications.label}
          </Title>
          {unreadCount != null && unreadCount > 0 && (
            /*
              The name is given by `sr-only` text, NOT by an `aria-label` on the badge.

              `Badge` is a `<span>` without a role, that is, role `generic`, and that role does not support
              a name set by the author: the browser simply drops `aria-label`. The screen reader announced
              a bare "3", exactly what this comment was meant to prevent. The test gave false confidence:
              `getByLabelText` reads the DOM attribute directly and passes regardless of whether the
              accessibility tree recognizes it.

              The number itself is hidden from speech, so it is not read twice.
            */
            <>
              <Badge tone="accent" aria-hidden>
                {unreadCount}
              </Badge>
              <span className="sr-only">
                {messages.notifications.unreadCount({ count: unreadCount })}
              </span>
            </>
          )}
          {actions != null && <div className="ml-auto flex items-center gap-1.5">{actions}</div>}
        </div>

        {filters != null && (
          <div className="border-line-soft flex flex-wrap items-center gap-1.5 border-b px-3 py-2">
            {filters}
          </div>
        )}

        {/*
          The bulk-actions bar: we do not create our own. `sticky={false}` because the center lives in a
          popover or a drawer, where there is nothing to stick to, and a hard-coded `--topbar-h` would
          push the bar under someone else's header.
        */}
        {selectedCount > 0 && (
          <div className="px-3 pt-2">
            <SelectionBar
              count={selectedCount}
              onClear={onClearSelection}
              sticky={false}
              className="mb-0"
            >
              {selectionActions}
            </SelectionBar>
          </div>
        )}

        {/* The LIST scrolls, not the whole center: the header and filters must stay in view, otherwise
            you would have to filter blind. */}
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>

        {footer != null && (
          <div className="border-line-soft border-t px-3 py-2 text-center">{footer}</div>
        )}
      </div>
    );
  }
);
