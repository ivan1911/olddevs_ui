"use client";

import { Slot, Slottable } from "@radix-ui/react-slot";
import {
  createContext,
  forwardRef,
  useContext,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from "react";
import { cn } from "../../lib/cn.js";
import { Tooltip } from "../overlays/Tooltip.js";

/**
 * Collapsed state of the navigation: `SideNav` sets it, and every item reads it.
 *
 * It is a context, not a prop on the item: otherwise the consumer would pass the
 * same value to each of the ten items by hand and sooner or later forget one.
 * Outside `SideNav` an item counts as expanded: that is the default state, not a
 * sign of an error.
 */
/** @internal Read by `NavItem` and `NavGroup`; not part of the public API. */
export const NavCollapsedContext = createContext(false);

/** @internal Provider for `SideNav`; not part of the public API. */
export const NavCollapsedProvider = NavCollapsedContext.Provider;

export interface NavItemProps extends Omit<ComponentPropsWithoutRef<"a">, "children"> {
  /**
   * The item's label, which is also its accessible name.
   *
   * It is a separate prop, not children, and the reason is the collapsed mode:
   * there the label is hidden from sight but must stay for the screen reader, so
   * the component has to WRAP it itself. The children of an `asChild` item belong
   * to the descendant, and the component cannot wrap them. That is also why
   * `Button` does not wrap its label when `asChild` is set.
   */
  label: ReactNode;
  /**
   * Icon to the left of the label. Hidden from screen readers; its color follows the
   * `active` state.
   */
  icon?: ReactNode;
  /**
   * The item leads to the current page: it is highlighted and gets
   * `aria-current="page"`.
   *
   * It is a prop, not a computed value: the kit knows neither the router nor the
   * rules for comparing paths (trailing slash, query, nested routes, locale in the
   * prefix). Each router has its own rules, and a mistake shows up not as a crash
   * but as a silently unhighlighted item. The decision is recorded in ADR-0018.
   */
  active?: boolean;
  /** Counter or mark to the right of the label: `Badge`, a number, a dot. */
  badge?: ReactNode;
  /**
   * Slot for a keyboard shortcut, usually `Kbd`. It hides together with the
   * label: in icon-only mode there is no room for the key combination, and
   * announcing it in the item's name would lengthen the name for something that is
   * not on screen.
   */
  shortcut?: ReactNode;
  /**
   * Render the item as its child element: `next/link`, a router's `<Link>`, or
   * anything else. The icon and the label move inside the child through
   * `Slottable`, so the child is passed empty:
   * `<NavItem label="…" asChild><Link href="/x" /></NavItem>`.
   */
  asChild?: boolean;
  /**
   * Needed only with `asChild`: there it is the empty child link that the icon and the label move
   * into.
   */
  children?: ReactNode;
}

const BASE =
  "focus-visible:outline-accent-strong flex items-center gap-3 rounded-control border " +
  "px-3 py-[9px] text-[13px] leading-5 no-underline transition-colors " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 " +
  // A disabled item is styled by `aria-disabled`, as `Button` is: a link has no
  // native `disabled`, and without this rule an item disabled with the ARIA
  // attribute would look active, with the same color and a pointer cursor.
  "aria-disabled:opacity-50 aria-disabled:cursor-default " +
  "aria-disabled:hover:bg-transparent aria-disabled:hover:text-fg-1";

const STATE = {
  active: "border-line bg-bg-3 text-fg-0 font-semibold",
  idle: "text-fg-1 hover:bg-bg-2 hover:text-fg-0 border-transparent font-medium",
} as const;

/**
 * Navigation item: icon, label, counter and shortcut slot.
 *
 * It knows nothing about routing: neither the address nor which item is currently
 * active. Both come from outside: the address as an element through `asChild` or
 * `href`, the current item through the `active` prop.
 *
 * In collapsed mode the label leaves the view but stays the accessible name, and a
 * tooltip appears next to the item. Hiding the label with a `title` attribute
 * would be cheaper and wrong: `title` is not shown on keyboard focus, and some
 * screen readers do not read it.
 *
 * REQUIREMENT FOR THE CONSUMER: collapsed navigation must be placed inside a
 * `TooltipProvider`, otherwise Radix throws on the first item. This component does
 * not mount the provider itself, for the same reason `Segmented` does not: the
 * provider sets up tooltip grouping for the whole application, and a nested one
 * would break that grouping. In expanded mode there is no tooltip, so there is no
 * requirement either.
 */
export const NavItem = forwardRef<HTMLAnchorElement, NavItemProps>(function NavItem(
  { label, icon, active = false, badge, shortcut, asChild = false, children, className, ...rest },
  ref
) {
  const collapsed = useContext(NavCollapsedContext);
  const Comp = asChild ? Slot : "a";

  const item = (
    <Comp
      ref={ref}
      // `page`, not `true`: the item leads to a page, and that is exactly the case
      // the value exists for.
      aria-current={active ? "page" : undefined}
      className={cn(
        BASE,
        active ? STATE.active : STATE.idle,
        collapsed && "justify-center px-0",
        className
      )}
      {...rest}
    >
      {icon ? (
        <span
          aria-hidden
          className={cn("flex shrink-0", active ? "text-accent-strong" : "text-fg-2")}
        >
          {icon}
        </span>
      ) : null}
      {/*
        In collapsed mode the label is hidden with the `sr-only` class rather than
        removed from the markup: without it the item would have no name, and the
        whole navigation would turn into a set of nameless icons, the same defect the
        audit catches in buttons with a single icon.
      */}
      <span className={cn(collapsed ? "sr-only" : "truncate")}>{label}</span>
      {!collapsed && badge != null ? <span className="ml-auto flex shrink-0">{badge}</span> : null}
      {!collapsed && shortcut != null ? (
        <span className={cn("shrink-0", badge == null && "ml-auto")}>{shortcut}</span>
      ) : null}
      {/*
        `Slottable` is the only way to keep the icon and the label with `asChild`:
        Slot merges props into its ONE child, and the pair "icon + link" would break
        it at runtime. With `Slottable` the target becomes the link, and the siblings
        move inside it. The same technique is used in `Button`.
      */}
      {asChild ? <Slottable>{children}</Slottable> : children}
    </Comp>
  );

  // The tooltip is added ONLY in collapsed mode: in expanded mode the label is
  // visible, and a tooltip would repeat it: noise, not help.
  return collapsed ? <Tooltip content={label}>{item}</Tooltip> : item;
});
