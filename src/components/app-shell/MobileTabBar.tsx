"use client";

import { Slot, Slottable } from "@radix-ui/react-slot";
import {
  forwardRef,
  isValidElement,
  useContext,
  type ComponentPropsWithoutRef,
  type ReactElement,
  type ReactNode,
} from "react";
import { useMessages } from "../../i18n/useMessages.js";
import type { AccessibleName } from "../../lib/accessible-name.js";
import { BottomBarSlotContext } from "../../lib/bottom-bar-slot.js";
import { cn } from "../../lib/cn.js";
import { devWarn } from "../../lib/dev-warn.js";
import { Badge } from "../content/Badge.js";

interface MobileTabBarBaseProps extends Omit<
  ComponentPropsWithoutRef<"nav">,
  "aria-label" | "aria-labelledby"
> {
  /** The bar's items, usually `MobileTabBarItem` components; they share the width equally. */
  children: ReactNode;
}

/**
 * The navigation name: `aria-label` or `aria-labelledby`, but not both (`AccessibleName`).
 *
 * Optional, hence `Partial`: when neither is given, the name comes from the message catalog
 * ("Sections" in English). The bar has no visible caption, so there is no `label` either: in the
 * kit, `label` means only a visible caption.
 */
export type MobileTabBarProps = MobileTabBarBaseProps & Partial<AccessibleName>;

/**
 * The bar's backdrop: in the `bottomBar` slot it extends down by the notch height, outside the slot
 * it sits exactly on the bar. That difference is the contract that jsdom would otherwise miss (it
 * does not compute `env()`), so it is a lookup object rather than a condition inside the string: a
 * test checks the class against it (`docs/conventions.md`, "What the tests check").
 *
 * @internal Exported for tests; not exported from the package.
 */
export const BACKDROP_CLASS = {
  inSlot:
    "bg-bg-1 absolute inset-x-0 top-0 bottom-[calc(-1*env(safe-area-inset-bottom,0px))] -z-10",
  standalone: "bg-bg-1 absolute inset-0 -z-10",
} as const;

/**
 * The bottom bar of the main sections for a phone: items in a row, sharing the width equally.
 *
 * WHAT IS NOT HERE, AND THIS IS A DECISION. Neither `fixed`, nor hiding from `md` up, nor padding
 * for the screen notch: the `bottomBar` slot of `AppShell` provides all three, and a bar that
 * repeated any of them would silently diverge from the shell. The notch padding, for example, would
 * be doubled. Outside `AppShell` the bar is an ordinary in-flow row: it can go anywhere, but then
 * pinning and hiding are left to the consumer.
 *
 * THE BACKDROP is the kit's surface token, without blur: `backdrop-filter` on every mobile screen
 * costs a repaint on scroll, and the labels do not need the legibility it buys. In the `bottomBar`
 * slot the backdrop extends below the bar by the notch height: the slot's wrapper adds the padding
 * for it, and a backdrop cut at the bar itself would leave a transparent gap under it, through
 * which the scrolling content would show. Outside the slot there is no padding, and the backdrop
 * sits exactly on the bar; otherwise, on a phone with a notch, it would cover what sits under the
 * bar in the flow. Where the bar is placed is told by `BottomBarSlotContext`.
 *
 * It has no knowledge of routing at all, like `NavItem`: the link arrives as an element through
 * `asChild`, and the current item comes as the `active` prop (ADR-0018).
 */
export const MobileTabBar = forwardRef<HTMLElement, MobileTabBarProps>(function MobileTabBar(
  { "aria-label": ariaLabel, "aria-labelledby": labelledBy, children, className, ...rest },
  ref
) {
  const messages = useMessages();
  const inSlot = useContext(BottomBarSlotContext);

  return (
    <nav
      ref={ref}
      // The default applies only when no name was given at all: an empty string is not a name
      // (`||`, not `??`), and with `aria-labelledby` the catalog string would be a second source
      // that the spec discards anyway.
      aria-label={labelledBy ? undefined : ariaLabel || messages.mobileTabBar.label}
      aria-labelledby={labelledBy || undefined}
      // `isolate` keeps the backdrop's negative z-layer inside the bar: without it the backdrop
      // would slide under its siblings in the slot's wrapper.
      className={cn("relative isolate flex items-stretch justify-around", className)}
      {...rest}
    >
      <div aria-hidden className={inSlot ? BACKDROP_CLASS.inSlot : BACKDROP_CLASS.standalone} />
      {children}
    </nav>
  );
});

interface MobileTabBarItemBaseProps extends Omit<ComponentPropsWithoutRef<"a">, "children"> {
  /**
   * The item's label. It is also the item's full accessible name, even when the label is truncated
   * with an ellipsis on screen.
   *
   * A separate prop rather than children, for the same reason as `NavItem`: the component has to
   * wrap the label itself, while with `asChild` the children belong to the descendant.
   */
  label: ReactNode;
  /** The icon above the label; hidden from screen readers. The `badge` is pinned to its corner. */
  icon?: ReactNode;
  /**
   * The current section: `aria-current="page"`.
   *
   * A prop, not a computation: the kit knows neither the router nor the rules for comparing paths
   * (trailing slash, nested routes, a locale prefix). A mistake here shows up not as a crash but as
   * a silently unhighlighted item (ADR-0018). It is called `active`, as on `NavItem`: one idea in
   * two navigation items must not have two names. The `aria-current` attribute is derived from it.
   */
  active?: boolean;
  /**
   * Render the item as its child element: `next/link`, or a router's `<Link>`. The icon and the
   * label move inside the child through `Slottable`, so the child is passed empty:
   * `<MobileTabBarItem label="…" asChild><Link href="/x" /></MobileTabBarItem>`.
   */
  asChild?: boolean;
  /**
   * Needed only with `asChild`: there it is the empty child link that the icon and the label move
   * into.
   */
  children?: ReactNode;
}

/**
 * The badge: built-in or custom.
 *
 * BUILT-IN — a number, `true`, or a string. A number shows a counter (above 99, "99+"), `true`
 * shows a dot for "new", and a string shows a short label in the same pill as `Badge`. `0`, `false`
 * and an empty string show nothing: an item with nothing new must not carry an empty dot. The position,
 * the limit and the text for screen readers are decided by the component: on a tab the badge sits
 * over the icon.
 *
 * CUSTOM — any element (`<Badge tone="success">`, an icon). It goes into the icon's corner as is.
 * Then `badgeLabel` is REQUIRED, and the type says so: the badge is hidden from screen readers
 * together with the icon, and a custom node without text would sound like there is no badge. The
 * kit cannot read the visible content of someone else's node on the consumer's behalf: it may be a
 * picture.
 */
export type MobileTabBarItemProps = MobileTabBarItemBaseProps &
  (
    | {
        /** Built-in badge: a number is a counter, `true` is a dot, a string is a short label; `0`, `false` and an empty string mean no badge. */
        badge?: number | boolean | string | null;
        /**
         * The text a screen reader announces for the badge, instead of "New: 3" from the catalog (or
         * instead of the string itself), when the badge needs a meaning ("3 unread messages"). The
         * badge on screen stays the same. Required when `badge` is a custom element.
         */
        badgeLabel?: string;
      }
    | {
        /** Custom badge: any element; it goes into the icon's corner as is, and `badgeLabel` is then required. */
        badge: ReactElement;
        /**
         * The text a screen reader announces for the badge, instead of "New: 3" from the catalog (or
         * instead of the string itself), when the badge needs a meaning ("3 unread messages"). The
         * badge on screen stays the same. Required when `badge` is a custom element.
         */
        badgeLabel: string;
      }
  );

const BASE =
  "focus-visible:outline-accent-strong text-caption relative flex min-w-0 flex-1 flex-col " +
  "items-center gap-0.5 px-1 py-2 font-medium no-underline transition-colors " +
  "focus-visible:outline-2";

// The current item is not marked by colour alone: the stripe on top is a cue that survives both
// achromatopsia and forced-colors mode.
const STATE = {
  active:
    "text-accent-strong before:bg-accent-strong before:absolute before:inset-x-3 " +
    "before:top-0 before:h-0.5 before:rounded-pill",
  idle: "text-fg-2 hover:text-fg-0",
} as const;

/**
 * An item of the bottom bar: an icon above a label, with a counter over the icon.
 *
 * THE LABEL IS THE `text-caption` SCALE STEP (11px) AND IS TRUNCATED WITH AN ELLIPSIS. This is a
 * measured compromise, not an oversight: a consumer measured that at 360px, with five items, a
 * tab's column leaves 50px for the label, and "Library" and "Schedule" take 64–65px at 11px against
 * 58–59px at 10px. So two of the five labels get cut, and the consumer keeps 10px outside the scale.
 * The kit follows the scale; whether the bar needs a step of its own will be decided by the first
 * adoption. Truncation hurts the eye, not the ear: the full label remains the accessible name.
 */
export const MobileTabBarItem = forwardRef<HTMLAnchorElement, MobileTabBarItemProps>(
  function MobileTabBarItem(
    {
      label,
      icon,
      active = false,
      badge,
      badgeLabel,
      asChild = false,
      children,
      className,
      ...rest
    },
    ref
  ) {
    const messages = useMessages();
    // `asChild` without an element inside (a JS consumer forgot the link) would break `Slot` and the
    // whole page tree. The item then stays a link of its own: the label is visible, not a blank screen.
    const slotted = asChild && isValidElement(children);
    const Comp = slotted ? Slot : "a";

    // `true` is a dot; a number above zero is a counter; a non-empty string is a label in the pill;
    // an element is a custom badge; anything else means no badge.
    const dot = badge === true;
    const count = typeof badge === "number" && badge > 0 ? badge : null;
    const text = typeof badge === "string" && badge !== "" ? badge : null;
    const custom = isValidElement(badge) ? badge : null;
    const shown = dot || count != null || text != null || custom != null;
    // A custom element without `badgeLabel` gets past the type; a JS consumer gets a badge with no
    // text instead of a crash, plus a warning in development: the badge is visible but not audible,
    // and nothing in the badge itself reveals that.
    if (custom && !badgeLabel) {
      devWarn(
        "MobileTabBarItem: a custom element was passed as `badge` without `badgeLabel`. " +
          "The badge is hidden from screen readers together with the icon, so it is shown " +
          "but never announced. Pass `badgeLabel` with what the badge means, e.g. " +
          '"Needs attention".'
      );
    }
    // `||`, not `??`: an empty `badgeLabel` is not text, so the default speaks instead.
    const spoken =
      badgeLabel ||
      (count != null
        ? messages.mobileTabBar.newCount({ count })
        : dot
          ? messages.mobileTabBar.new
          : text);

    return (
      <Comp
        ref={ref}
        // `page`, not `true`: the item leads to a page, and that is the case the value exists for.
        aria-current={active ? "page" : undefined}
        className={cn(BASE, active ? STATE.active : STATE.idle, className)}
        {...rest}
      >
        {icon ? (
          // The icon and the badge are hidden from screen readers as a whole: the label gives the
          // name, and the badge speaks through `sr-only` below. A visible number that was also read
          // out as is would be announced twice.
          <span
            aria-hidden
            className={cn("relative flex shrink-0", active ? "text-accent-strong" : "text-fg-2")}
          >
            {icon}
            {custom ? (
              <span className="absolute top-[-2px] -right-1.5 flex">{custom}</span>
            ) : shown ? (
              // The badge is anchored by its LEFT edge at the icon's top-right corner and grows to
              // the right: anchoring by the right edge (`-right-1.5`) grew a wide "99+" or "Beta"
              // leftwards, onto the icon. The `-ml-*` shift repeats the former position of the dot
              // (8px) and of a short number (16px): they look as they did before.
              <Badge
                overlay
                dot={dot}
                className={cn("top-[-2px] right-auto left-full", dot ? "-ml-0.5" : "-ml-2.5")}
              >
                {count ?? text}
              </Badge>
            ) : null}
          </span>
        ) : null}
        {/*
          WITHOUT AN ICON the badge has nothing to anchor to: the corner of an empty node is a point
          above the middle of the label. So the badge goes into the label's row, after it, and the
          label is truncated before the badge, not the other way round.
        */}
        <span className="flex w-full min-w-0 items-center justify-center gap-1">
          <span className="min-w-0 truncate text-center">{label}</span>
          {!icon && shown ? (
            <span aria-hidden className="flex shrink-0">
              {custom ?? <Badge dot={dot}>{count ?? text}</Badge>}
            </span>
          ) : null}
        </span>
        {/*
          The space between the label and the badge text is not a typo: they are adjacent inline
          nodes, and without it the computed name would run together as "Inbox3". A space between
          flex items is invisible in the layout, but the name needs it.
        */}
        {shown && spoken ? (
          <>
            {" "}
            <span className="sr-only">{spoken}</span>
          </>
        ) : null}
        {/*
          `Slottable` is the only way to keep the icon and the label with `asChild`: Slot merges
          props into a SINGLE child, and an icon-plus-link pair would break it at runtime. The same
          trick is used in `NavItem`.
        */}
        {slotted ? <Slottable>{children}</Slottable> : asChild ? null : children}
      </Comp>
    );
  }
);
