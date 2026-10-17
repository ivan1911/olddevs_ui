"use client";

import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useState,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "../../icons.js";
import { useMessages } from "../../i18n/useMessages.js";
import { cn } from "../../lib/cn.js";
import { Button } from "../actions/Button.js";
import { NavCollapsedContext, NavCollapsedProvider } from "./NavItem.js";
import { BUTTON_ICON_SIZE } from "../../lib/button.js";

/**
 * The navigation is drawn inside an overlay, the mobile drawer, rather than as a
 * column of the page. `AppShell` sets it around its own copy; outside it the value
 * is `false`.
 *
 * @internal Not part of the public API.
 */
const NavInOverlayContext = createContext(false);

/** @internal Provider for `AppShell`. */
export const NavInOverlayProvider = NavInOverlayContext.Provider;

export interface NavGroupProps extends Omit<ComponentPropsWithoutRef<"div">, "children"> {
  /**
   * The section heading, which is also the group's accessible name, so it is a
   * string rather than a `ReactNode`.
   *
   * In icon-only mode the heading leaves the view: there is no room for it. The
   * group's name remains, though: without a name the group would turn the
   * navigation's structure into a set of icons that nothing separates.
   */
  label?: string;
  /** The items of the section, usually `NavItem`. */
  children: ReactNode;
}

/**
 * A navigation section: a heading and the items under it.
 *
 * In collapsed form the heading is replaced by a rule. This is not decoration:
 * without the rule icon-only navigation loses its structure entirely, and with the
 * heading text it does not fit.
 */
export const NavGroup = forwardRef<HTMLDivElement, NavGroupProps>(function NavGroup(
  { label, children, className, ...rest },
  ref
) {
  const collapsed = useContext(NavCollapsedContext);

  return (
    <div
      ref={ref}
      role="group"
      aria-label={label}
      className={cn("flex flex-col gap-0.5", className)}
      {...rest}
    >
      {label != null ? (
        collapsed ? (
          <hr aria-hidden className="border-line-soft mx-2 my-1.5" />
        ) : (
          <div className="text-fg-3 px-3 pt-3 pb-1 text-[11px] font-semibold tracking-wide uppercase">
            {label}
          </div>
        )
      ) : null}
      {children}
    </div>
  );
});

/**
 * Whether the navigation is collapsed, for the content of the `header` and `footer`
 * slots.
 *
 * The kit's items and sections adapt to icon-only mode on their own, but the slots
 * belong to the consumer, and the kit does not know what is in them. A user block
 * in the footer needs to know the column width: in icon-only mode there is room
 * only for the avatar, and a name and role left as they are wrap word by word and
 * spill over the edge.
 *
 * It is a hook, not a render prop on the slot: the slot stays a plain `ReactNode`,
 * and the same consumer component works outside `SideNav` too. There the hook
 * returns `false`, the expanded state by default, as with `NavItem`. In the mobile
 * drawer the navigation is always expanded, and the hook repeats that.
 *
 * For pure-CSS adaptation the `<nav>` has a `data-collapsed` attribute.
 */
export const useNavCollapsed = (): boolean => useContext(NavCollapsedContext);

export interface SideNavProps extends Omit<ComponentPropsWithoutRef<"nav">, "children"> {
  /**
   * Content of the column between the header and the footer: `NavGroup` and `NavItem`.
   * Scrolls if it does not fit.
   */
  children: ReactNode;
  /** Header slot: logo, product name. */
  header?: ReactNode;
  /** Footer slot: user, links, anything else. */
  footer?: ReactNode;
  /**
   * Collapsed state in controlled mode. When it is set, the component holds no
   * state of its own and follows the consumer.
   */
  collapsed?: boolean;
  /** Initial collapsed state in uncontrolled mode. */
  defaultCollapsed?: boolean;
  /**
   * Called with the new value when the user presses the collapse button. Not called in the
   * mobile drawer.
   */
  onCollapsedChange?: (collapsed: boolean) => void;
  /**
   * Shows the built-in collapse button. `false`: the navigation collapses only from
   * outside (for example from a button in the application header), or it does not
   * collapse at all.
   */
  collapsible?: boolean;
  /** Accessible name of the navigation. If not set, it is taken from the message catalog. */
  label?: string;
}

/**
 * The application's side navigation: header, sections with items, footer.
 *
 * STATE. Collapsed state is a state of the widget, not of the domain, so the
 * component can hold it itself: the pair `defaultCollapsed` / `collapsed` +
 * `onCollapsedChange` is the usual pattern in the kit. But **persistence stays with
 * the consumer**: the kit knows nothing about `localStorage` or the application's
 * storage, and it should not (ADR-0018).
 *
 * The MOBILE MODE does not live here. Below `md` the navigation moves into a
 * `Drawer`, and `AppShell` decides that. `SideNav` on its own is just a column that
 * can be placed anywhere, including inside a drawer.
 *
 * The widths come from the `--sidenav-w` and `--sidenav-w-collapsed` tokens, not
 * from props: the `AppShell` grid needs the same value, and passing it through
 * React would mean re-rendering for something CSS reads on its own.
 */
export const SideNav = forwardRef<HTMLElement, SideNavProps>(function SideNav(
  {
    children,
    header,
    footer,
    collapsed,
    defaultCollapsed = false,
    onCollapsedChange,
    collapsible = true,
    label,
    className,
    ...rest
  },
  ref
) {
  const messages = useMessages();
  const inOverlay = useContext(NavInOverlayContext);
  const [uncontrolled, setUncontrolled] = useState(defaultCollapsed);
  // Controlled mode is set by the PRESENCE of the prop, not its value: `collapsed={false}`
  // means "I am in control, and it is expanded now", not "there is no control".
  const isControlled = collapsed !== undefined;

  /*
   * IN THE OVERLAY THE NAVIGATION IS ALWAYS EXPANDED, and there is nothing to
   * collapse it with.
   *
   * Icon-only mode exists for one purpose: to give width to the page content. In the
   * drawer there is no content beside it, so there is no one to give width to, and
   * collapsing becomes a way of hiding labels with no benefit.
   *
   * The VALUE is forced, not just the button. Removing the button and leaving
   * `collapsed` in force would be worse than the original defect: a consumer that
   * holds the collapsed state outside (the usual case, it survived a reload) would
   * get icons in the drawer with no way to expand them.
   *
   * `onCollapsedChange` is NOT called here: the consumer's state refers to the
   * column, and the drawer has no right to change it.
   */
  const isCollapsed = inOverlay ? false : isControlled ? collapsed : uncontrolled;
  const showToggle = collapsible && !inOverlay;

  const toggle = useCallback(() => {
    const next = !isCollapsed;
    if (!isControlled) setUncontrolled(next);
    onCollapsedChange?.(next);
  }, [isCollapsed, isControlled, onCollapsedChange]);

  return (
    <NavCollapsedProvider value={isCollapsed}>
      <nav
        ref={ref}
        aria-label={label ?? messages.nav.label}
        // An attribute for the consumer who needs to adjust its slot content to the
        // mode. The component does not style anything by it itself: the collapsed
        // state has already been passed down through context.
        data-collapsed={isCollapsed || undefined}
        className={cn(
          "bg-bg-1 flex h-full shrink-0 flex-col",
          // A border separates the column from the page content. In the drawer there is
          // nothing on the right, and the line would hang on the edge of the overlay for no reason.
          !inOverlay && "border-line-soft border-r",
          isCollapsed ? "w-[var(--sidenav-w-collapsed)]" : "w-[var(--sidenav-w)]",
          className
        )}
        {...rest}
      >
        {/*
         * The header and footer clip excess width: a consumer's slot may not know
         * about icon-only mode, and without clipping its text would lie over the page
         * content. Clipping is horizontal only (`clip`, not `hidden`): vertically the
         * slot grows on its own, and `hidden` on one axis would make the other one
         * scrollable.
         */}
        {header != null ? <div className="shrink-0 overflow-x-clip">{header}</div> : null}

        <div className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2.5 py-1">{children}</div>

        {footer != null || showToggle ? (
          <div className="border-line-soft shrink-0 overflow-x-clip border-t p-2.5">
            {footer}
            {showToggle ? (
              <div className={cn("flex", isCollapsed ? "justify-center" : "justify-end")}>
                <Button
                  variant="ghost"
                  size="sm"
                  iconOnly
                  icon={
                    isCollapsed ? (
                      <ChevronRightIcon size={BUTTON_ICON_SIZE.sm} />
                    ) : (
                      <ChevronLeftIcon size={BUTTON_ICON_SIZE.sm} />
                    )
                  }
                  // The label names the ACTION, not the state: for a button with two
                  // states the next step follows from the icon, and repeating the
                  // current state in the name would lengthen it for nothing.
                  aria-label={isCollapsed ? messages.nav.expand : messages.nav.collapse}
                  onClick={toggle}
                />
              </div>
            ) : null}
          </div>
        ) : null}
      </nav>
    </NavCollapsedProvider>
  );
});
