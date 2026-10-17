"use client";

import { forwardRef, useRef, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { NavigationIcon } from "../../icons.js";
import { useMessages } from "../../i18n/useMessages.js";
import { cn } from "../../lib/cn.js";
import { usePublishedHeight } from "../../lib/published-height.js";
import { useAppShell } from "./AppShell.js";
import { Button } from "../actions/Button.js";
import { BUTTON_ICON_SIZE } from "../../lib/button.js";

export interface TopBarProps extends Omit<ComponentPropsWithoutRef<"header">, "children"> {
  /** Leftmost slot: logo, product name. */
  brand?: ReactNode;
  /** Center slot: search. Takes up the free space. */
  search?: ReactNode;
  /** Actions on the right: notifications, settings, user menu. */
  actions?: ReactNode;
  /**
   * The name of the CSS variable the measured header height is published to.
   *
   * This is the other half of the contract: the same name is read by
   * `useStickyOffset` (there it is called `offsetVar`), and `SelectionBar` expects it
   * by default.
   *
   * `null` **disables publishing**. It is needed where there are two headers in the
   * document: the application header and the header of an embedded widget. If they
   * silently overwrote each other's value, they would shift the sticky bars to the other
   * one's height. That would show up not as an error but as a broken layout.
   */
  heightVar?: string | null;
  /** Accessible name of the header. If not set, it is taken from the message catalog. */
  label?: string;
  /** Extra header content, rendered after the `actions` slot. */
  children?: ReactNode;
}

/**
 * Application header: brand, search, actions.
 *
 * IT PUBLISHES ITS HEIGHT into a CSS variable. Before 2.1.0 the kit could not do this,
 * because it had no header then, and the contract [ADR-0016] was one-way: the
 * application published the height, and the kit only read it.
 *
 * This is NOT the option rejected in ADR-0016, where the kit measures the header itself.
 * There the kit would have to identify a foreign element, looking up by selector or
 * attribute what the application considers its header. Here the component measures
 * itself, and the kit never gains the knowledge of which element is the header in a
 * given application. The analysis is in [ADR-0019].
 *
 * The height goes to `document.documentElement`, not to the nearest ancestor: that is
 * where `useStickyOffset` looks for it, and these two places must not diverge.
 */
export const TopBar = forwardRef<HTMLElement, TopBarProps>(function TopBar(
  { brand, search, actions, heightVar = "--topbar-h", label, className, style, children, ...rest },
  ref
) {
  const messages = useMessages();
  const { openNavigation } = useAppShell();
  const innerRef = useRef<HTMLElement | null>(null);

  // An observer, not a one-time measurement on mount: the height changes with the
  // breakpoint, with the content of the slots wrapping, and with a second row appearing
  // in the search. Each time, the sticky bar below the header has to move with it.
  usePublishedHeight(innerRef, heightVar);

  return (
    <header
      ref={(node) => {
        innerRef.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) ref.current = node;
      }}
      aria-label={label ?? messages.topbar.label}
      className={cn(
        "border-line-soft sticky top-0 z-30 flex items-center gap-3.5 border-b px-4 py-1.5",
        "backdrop-blur-md md:px-7",
        className
      )}
      {...rest}
      /*
       * A token, not a class: the header background is semi-transparent and changes with
       * the theme without any JS.
       *
       * It goes AFTER `{...rest}`, and `style` is pulled out of `rest` into its own prop.
       * It used to be the other way round: the consumer's `style` overwrote the whole
       * attribute, so the header lost its background and the sticky blur showed the
       * scrolling content through. Merging `...rest.style` inside the object looked like
       * it worked, even though its result was immediately overwritten.
       */
      style={{ background: "var(--topbar-bg)", ...style }}
    >
      {/*
        The button appears BY ITSELF when the header sits in an `AppShell` with
        navigation: the shell reports through context how to open it. A slot cannot do
        this. The shell receives the header already assembled by the consumer and cannot
        insert anything into it. Outside the shell there is no button at all.
      */}
      {openNavigation ? (
        <Button
          variant="ghost"
          iconOnly
          size="sm"
          icon={<NavigationIcon size={BUTTON_ICON_SIZE.sm} />}
          aria-label={messages.shell.openNavigation}
          onClick={openNavigation}
          className="md:hidden"
        />
      ) : null}
      {brand != null ? <div className="flex shrink-0 items-center">{brand}</div> : null}
      {search != null ? <div className="min-w-0 flex-1">{search}</div> : <div className="flex-1" />}
      {actions != null ? <div className="flex shrink-0 items-center gap-1.5">{actions}</div> : null}
      {children}
    </header>
  );
});
