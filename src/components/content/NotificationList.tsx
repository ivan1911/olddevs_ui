"use client";

import { forwardRef, useId, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { useMessages } from "../../i18n/useMessages.js";
import { cn } from "../../lib/cn.js";
import { devWarn } from "../../lib/dev-warn.js";
import { hasContent } from "../../lib/empty.js";
import { TONE_TOKENS, type Tone } from "../../lib/variants.js";

interface NotificationItemBaseProps extends Omit<ComponentPropsWithoutRef<"li">, "title"> {
  /** What the event is about. The first line. */
  title: ReactNode;
  /** Details. The second line. */
  description?: ReactNode;
  /**
   * When it happened, already formatted.
   *
   * The kit does not compute "5 minutes ago" or "yesterday at 14:03": relative time depends on
   * the consumer's locale and time zone, not on the design system.
   */
  time?: ReactNode;
  /** Icon on the left. The event type is application knowledge, so the icon is passed in. */
  icon?: ReactNode;
  /**
   * Preview of the object the event is about: a second visual slot next to the text.
   *
   * Independent of `icon`: the icon says WHAT happened, the preview says WITH WHAT. The consumer
   * sets the size on the element itself (a 36px image, an `Avatar`); the slot only keeps it from
   * shrinking and aligns it to the top edge. A decorative preview gets `alt=""`: the title
   * already names the object.
   */
  media?: ReactNode;
  /** Tone of the icon and the unread dot. */
  tone?: Tone;
  /**
   * Unread.
   *
   * Not signalled by COLOR ALONE: a word for screen readers goes next to the title. The dot and
   * the background are a signal for the eyes, and someone who cannot see them would otherwise
   * not tell a new event from an old one at all.
   */
  unread?: boolean;
}

/**
 * Row action: either `actions` on the right, or `onAction` on the whole row.
 *
 * They cannot be combined, and the type says so: buttons inside a button are invalid markup,
 * the kind a consumer has already rejected in their own queue row.
 */
export type NotificationItemProps = NotificationItemBaseProps &
  (
    | {
        /** Actions on the right, such as "mark as read" or "open". */
        actions?: ReactNode;
        onAction?: never;
      }
    | {
        actions?: never;
        /**
         * The whole row is one button: a click, Enter and Space call the handler.
         *
         * The button's accessible name is the title (plus the word "Unread"), and the time and
         * description are its description: the full content as the name would be half a page
         * long. The row stays an `<li>`; the button sits inside it.
         */
        onAction: () => void;
      }
  );

/**
 * An event row: what happened, when, and whether it was read.
 *
 * The kit does NOT KNOW EVENT TYPES. "Publish failed", "Channel disconnected", "Moderation
 * complete" are the application's vocabulary; the kit receives an icon, a tone and text. It
 * follows the same split of responsibilities as `StatusBadge`, which came from the frontend and
 * left its eleven domain statuses behind (ADR-0027).
 *
 * The row neither navigates nor marks itself as read: both navigation and marking are the
 * consumer's actions. They arrive in `actions`, in `onAction` (the whole row is a button), or
 * wrap the row.
 */
export const NotificationItem = forwardRef<HTMLLIElement, NotificationItemProps>(
  function NotificationItem(
    {
      title,
      description,
      time,
      icon,
      media,
      tone = "accent",
      unread,
      actions,
      onAction,
      className,
      ...rest
    },
    ref
  ) {
    const messages = useMessages();
    const baseId = useId();
    const t = TONE_TOKENS[tone];

    // Both props can only arrive together from a consumer in plain JS: the types forbid it.
    // `actions` wins: a button nested in a button is invalid, and `actions` may be the only way
    // to reach an action (delete, open). Hiding it because of a stray `onAction` is worse than
    // losing the click on the whole row. The failure is visible right away: the row does not
    // respond to clicks. In development the console also reports it, because for a JS consumer
    // that is the only thing standing in for a type error.
    if (onAction != null && actions != null) {
      devWarn(
        "NotificationItem: both `onAction` and `actions` were passed, but they are mutually " +
          "exclusive (a button cannot contain buttons). `actions` wins and `onAction` is ignored, " +
          "so clicking the row does nothing. Pass only one: `onAction` for a clickable row, or " +
          "`actions` for buttons on the right."
      );
    }
    const asButton = onAction != null && actions == null;

    // The ids are needed only by the button (its name and description). A plain row gets none:
    // without `onAction` the markup must not change by a single attribute.
    const idOf = (part: string) => (asButton ? `${baseId}-${part}` : undefined);
    const titleId = idOf("title");
    const unreadId = idOf("unread");
    const descriptionId = idOf("description");
    const timeId = idOf("time");

    // Inside a button only phrasing content is allowed, so the row's blocks are `span`s in button
    // mode (their block layout comes from classes). Without `onAction` they stay `div`s, as before.
    const Block = asButton ? "span" : "div";

    const layout = "flex items-start gap-3 px-3 py-2.5";

    const content = (
      <>
        {icon != null && (
          <span className={cn("flex shrink-0 items-center pt-0.5", t.fg)}>{icon}</span>
        )}

        {hasContent(media) && <span className="flex shrink-0 items-start">{media}</span>}

        <Block className="min-w-0 flex-1">
          <Block className="flex items-baseline gap-2">
            <span id={titleId} className="min-w-0 text-[13px] font-medium">
              {title}
            </span>
            {unread && (
              <>
                <span
                  aria-hidden="true"
                  className={cn("size-1.5 shrink-0 rounded-full", t.dotBg)}
                />
                <span id={unreadId} className="sr-only">
                  {messages.notifications.unread}
                </span>
              </>
            )}
            {time != null && (
              <span id={timeId} className="text-fg-2 ml-auto shrink-0 text-[11px]">
                {time}
              </span>
            )}
          </Block>
          {description != null && (
            <Block
              id={descriptionId}
              className={cn("text-fg-2 mt-0.5 text-xs leading-relaxed", asButton && "block")}
            >
              {description}
            </Block>
          )}
        </Block>
      </>
    );

    if (asButton) {
      // `hasContent`, not `!= null`: `""` and `false` from `{note && ...}` render an empty node,
      // and a reference to that node would announce an empty description.
      const describedBy = [hasContent(description) && descriptionId, hasContent(time) && timeId]
        .filter(Boolean)
        .join(" ");

      return (
        <li
          ref={ref}
          // The unread background is on the `li`; the hover and the focus ring are on the button,
          // so they cover the whole row rather than its inside. Padding and layout are on the
          // button too, so the consumer's `className` (background, border) does not change them.
          // The Reference says so.
          className={cn(unread && "bg-accent-soft", className)}
          {...rest}
        >
          <button
            type="button"
            onClick={() => onAction()}
            // The name comes from the title and the word "Unread", not from `aria-label`: that
            // would duplicate the text in the markup and drift apart from it on edits.
            aria-labelledby={unread ? `${titleId} ${unreadId}` : titleId}
            aria-describedby={describedBy || undefined}
            className={cn(
              layout,
              "focus-visible:outline-accent-strong w-full cursor-pointer text-left transition-colors",
              // Hover on an unread row darkens over the background instead of using the neutral
              // fill: otherwise the row would look read while it is hovered.
              unread ? "hover:bg-accent/10" : "hover:bg-bg-2",
              // The focus ring is drawn inward: outside, the scrolling of the center would clip it.
              "focus-visible:outline-2 focus-visible:-outline-offset-2"
            )}
          >
            {content}
          </button>
        </li>
      );
    }

    return (
      <li
        ref={ref}
        className={cn(
          layout,
          // The unread background is a visual signal, and not the only one: the word next to the
          // title says the same thing to a screen reader.
          unread && "bg-accent-soft",
          className
        )}
        {...rest}
      >
        {content}

        {actions != null && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
      </li>
    );
  }
);

export interface NotificationGroup {
  /** Group identifier. */
  id: string;
  /** Group label: "Today", "Yesterday", "Earlier". */
  label: ReactNode;
  /** The rows of the group, usually `NotificationItem`s. */
  children: ReactNode;
}

export interface NotificationListProps extends Omit<ComponentPropsWithoutRef<"div">, "children"> {
  /**
   * Event groups, already assembled by the consumer.
   *
   * The consumer's locale and time zone decide what "yesterday" means, not the kit: an application
   * with night shifts has its own day boundary, and computing it here would impose someone
   * else's calendar.
   */
  groups?: NotificationGroup[];
  /** Rows without grouping. Used instead of `groups`, not together with them. */
  children?: ReactNode;
  /** What to show for an empty list, usually an `EmptyState`. */
  empty?: ReactNode;
  /** Accessible name of the list for screen readers. Defaults to the package's standard label. */
  "aria-label"?: string;
}

/**
 * A list of events, grouped by time, with an empty state.
 *
 * A GROUP IS A REAL GROUP (`role="group"` with a label), not a heading above a set of rows. An
 * `h3`-level heading cannot be used here: the level depends on where the list is placed (in a
 * popover, a drawer or on a page), and the kit does not know that. A named group conveys the
 * structure without taking up a heading level.
 *
 * THE EMPTY STATE is the existing `EmptyState`, passed as a prop: "no notifications" and
 * "nothing matched the filter" have different text and different actions, and the consumer
 * chooses between them.
 */
export const NotificationList = forwardRef<HTMLDivElement, NotificationListProps>(
  function NotificationList(
    { groups, children, empty, className, "aria-label": ariaLabel, ...rest },
    ref
  ) {
    const messages = useMessages();
    const baseId = useId();
    const label = ariaLabel ?? messages.notifications.label;

    // `hasContent`, not `== null`: the usual call is `{items.map(...)}`, and with empty `items`
    // an EMPTY ARRAY arrives here. It is not `null`, so the list counted as non-empty and an empty
    // `<ul>` was drawn instead of the `empty` slot.
    const isEmpty = groups != null ? groups.length === 0 : !hasContent(children);
    if (isEmpty) return <>{empty}</>;

    return (
      // The name goes on the outer node, not on an inner list: with groups there are several
      // lists, and the name must cover them all. The role is required: a bare `div` with
      // `aria-label` has no name, and the attribute is simply ignored.
      <div
        ref={ref}
        role="group"
        aria-label={label}
        className={cn("flex flex-col", className)}
        {...rest}
      >
        {groups != null ? (
          groups.map((group, index) => {
            const labelId = `${baseId}-${group.id}`;
            return (
              <div key={group.id} role="group" aria-labelledby={labelId}>
                <div
                  id={labelId}
                  className={cn(
                    "text-fg-2 px-3 pb-1 text-[11px] font-bold tracking-wide uppercase",
                    index === 0 ? "pt-2" : "pt-4"
                  )}
                >
                  {group.label}
                </div>
                <ul className="flex flex-col">{group.children}</ul>
              </div>
            );
          })
        ) : (
          <ul className="flex flex-col">{children}</ul>
        )}
      </div>
    );
  }
);
