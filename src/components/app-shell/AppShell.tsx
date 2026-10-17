"use client";

import {
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from "react";
import { useMessages } from "../../i18n/useMessages.js";
import { BottomBarSlotContext } from "../../lib/bottom-bar-slot.js";
import { cn } from "../../lib/cn.js";
import { usePublishedHeight } from "../../lib/published-height.js";
import { Drawer } from "../overlays/Drawer.js";
import { NavInOverlayProvider } from "./SideNav.js";

/**
 * The link between the shell and the header. The only thing they need to know about each other is
 * how to open the navigation on a narrow screen.
 *
 * A context, not a slot in `TopBar`: the consumer passes the header to the shell already built, so
 * a button cannot be put inside it from the outside.
 *
 * @internal The context value; read it through `useAppShell`.
 */
const AppShellContext = createContext<AppShellContextValue>({});

export interface AppShellContextValue {
  /**
   * Opens the navigation as a drawer. Present when the shell received a `sidebar`. The shell does
   * not check the screen width, so a consumer shows its own button only where the column is hidden,
   * that is, below `md`.
   */
  openNavigation?: () => void;
}

/**
 * Access to the shell from your own header.
 *
 * Public, not internal, and this is a fix for a defect rather than a convenience: `openNavigation`
 * could only be read by the kit's `TopBar`, so a consumer with its own header got a navigation that
 * **had no way to be opened** below `md`. The column is hidden, nothing opens the drawer, and there
 * is no warning. A whole section of the interface was silently unreachable.
 *
 * Outside `AppShell` it returns an empty object: a custom header checks `openNavigation` for presence
 * and draws its button only when that makes sense.
 */
export const useAppShell = (): AppShellContextValue => useContext(AppShellContext);

export interface AppShellProps extends Omit<ComponentPropsWithoutRef<"div">, "children"> {
  /** The side navigation, usually a `SideNav`. */
  sidebar?: ReactNode;
  /** The header, usually a `TopBar`. */
  header?: ReactNode;
  /**
   * Application-level messages above the header, usually one or more `Banner`s.
   *
   * They sit ABOVE the header, in the content column: a service outage affects the whole
   * application, but the side navigation stays full height. Otherwise the shell would have to switch
   * from a row to a column for the whole layout just for a node that is often empty.
   *
   * NOT STICKY, and this is a decision, not an oversight (ADR-0027). The header stays at `top: 0`,
   * and `--topbar-h` keeps meaning exactly its height: the stickiness contract (ADR-0016) and its
   * publication by the header (ADR-0019) are untouched. A sticky stack would need a second offset
   * variable, and everything that today computes from `--topbar-h` (`SelectionBar`, the sticky
   * header of `Table`) would have to add its height too.
   *
   * The slot has no queue of its own: the consumer sets the order and the contents.
   */
  banners?: ReactNode;
  /**
   * The right-hand area next to the content: details, help, anything else.
   *
   * An unnamed slot with no resize handle, and that is a decision, not an omission. The resize
   * handle comes from the separate `SplitPanel` component (ADR-0018).
   */
  aside?: ReactNode;
  /**
   * The bottom bar on narrow screens, usually `MobileTabBar`; hidden from `md` up.
   *
   * The slot provides everything that belongs to the shell rather than to the bar: pinning to the
   * bottom of the window, hiding from `md` up (where the side navigation is), its height in the
   * flow, and the `env(safe-area-inset-bottom)` padding for the screen notch. So `MobileTabBar`
   * carries no `fixed`, `md:hidden` or padding of its own, and a foreign bar placed here must not
   * repeat them: the padding would be doubled.
   */
  bottomBar?: ReactNode;
  /**
   * The name of the variable the `bottomBar` slot publishes its height to (including the padding
   * for the screen notch). Defaults to `--bottombar-h`.
   *
   * The other half of the contract, like `heightVar` on `TopBar`: the same default name is read by
   * `ContextualSaveBar` and `Toaster` (through their `offsetVar` prop), and they sit above the bar,
   * not under it. From `md` up the bar is hidden and the height is `0px`. Without the slot the
   * variable is not set at all, and readers fall back to `0px`.
   *
   * `null` turns the publishing off, for when a document has two shells that must not override
   * each other.
   */
  bottomBarHeightVar?: string | null;
  /**
   * The key of the current route: when it changes, focus moves to `<main>` and the navigation drawer
   * closes.
   *
   * A prop, not a subscription to a router: the kit does not know which router is used, and only the
   * application knows what counts as a change of screen. If it is not passed, focus return will not
   * happen, and this is a **silent degradation**: no error and no warning appears, so always pass
   * the prop.
   */
  routeKey?: string;
  /** The page content; it goes into `<main>`. */
  children: ReactNode;
}

/**
 * The app shell: navigation on the left, header on top, the content, and the optional right-hand
 * area and bottom bar.
 *
 * SCROLLING STAYS WITH THE DOCUMENT, not with `<main>`. This is not a layout detail: the kit's
 * sticky elements (`SelectionBar`) measure their offset from the header's height, and if the content
 * scrolled in its own container, the bar would stick with a gap of exactly that height. The previous
 * front-end shell was built the same way, and the ADR-0016 contract keeps working without caveats.
 *
 * MOBILE MODE is switched by CSS, not by `matchMedia`: the navigation column is hidden by a class,
 * and the drawer is shown by a class. `matchMedia` in SSR gives a wrong first frame, and the user
 * sees the layout jump after hydration (ADR-0018).
 */
export const AppShell = forwardRef<HTMLDivElement, AppShellProps>(function AppShell(
  {
    sidebar,
    header,
    banners,
    aside,
    bottomBar,
    bottomBarHeightVar = "--bottombar-h",
    routeKey,
    children,
    className,
    ...rest
  },
  ref
) {
  const messages = useMessages();
  const mainId = useId();
  const mainRef = useRef<HTMLElement | null>(null);
  const [navOpen, setNavOpen] = useState(false);
  const lastRouteKey = useRef(routeKey);
  const bottomBarRef = useRef<HTMLDivElement>(null);

  // The height of the slot wrapper, not of the bar itself: it includes the border and the notch
  // padding, which is exactly how much of the window's bottom edge the bar takes. A wrapper hidden
  // at `md` (`display: none`) measures zero, and the variable reflects that.
  usePublishedHeight(bottomBarRef, bottomBarHeightVar, bottomBar != null);

  useEffect(() => {
    // The first page load is skipped: focus there belongs to the document, and taking it into
    // `<main>` would steal it from a user who has already started doing something.
    //
    // The comparison is with the previous key, not a "first pass" flag: StrictMode in dev runs the
    // effect twice, and a ref survives the remount. A flag would already have been reset by the
    // second run, and focus would move to `<main>` right on load.
    if (lastRouteKey.current === routeKey) return;
    lastRouteKey.current = routeKey;
    // No scrolling here: on navigation the router sets the scroll position. Our own scroll-to-focus
    // pushed the top of `<main>` under the sticky header.
    mainRef.current?.focus({ preventScroll: true });
  }, [routeKey]);

  // The drawer closes itself on a route change: if left open, it would cover the screen the user
  // has just navigated to.
  useEffect(() => setNavOpen(false), [routeKey]);

  return (
    <AppShellContext.Provider
      value={{ openNavigation: sidebar ? () => setNavOpen(true) : undefined }}
    >
      <div ref={ref} className={cn("relative flex min-h-dvh", className)} {...rest}>
        {/*
          The first focusable element on the page. It is visible only when focused, but it is
          NOT text for screen readers: a keyboard user without a screen reader relies on it and has
          to see the link.

          The root is positioned (`relative`) for the sake of this link: `focus:absolute` is
          otherwise measured from the nearest positioned ancestor, and inside a nested shell the link
          would appear not over that shell but somewhere on the page.
        */}
        <a
          href={`#${mainId}`}
          className="focus:bg-bg-1 focus:text-fg-0 focus:outline-accent-strong sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:px-3 focus:py-2 focus:text-sm focus:outline-2"
        >
          {messages.shell.skipToContent}
        </a>

        {sidebar != null ? (
          <>
            <div className="sticky top-0 hidden h-dvh md:flex">{sidebar}</div>
            <Drawer
              open={navOpen}
              onClose={() => setNavOpen(false)}
              side="left"
              size="sm"
              title={messages.nav.label}
            >
              {/*
                The same navigation, but in the drawer: `SideNav` inside expands by force and hides
                its collapse button. The icon-only mode hands its width to the page content, and an
                overlay has no page content beside it to give the width to.
              */}
              <NavInOverlayProvider value={true}>{sidebar}</NavInOverlayProvider>
            </Drawer>
          </>
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col">
          {/*
            Without the slot there is no node at all: not an empty `div`, but nothing. A shell without
            banners must render exactly the markup it rendered before the slot existed. The same trick
            as with `bottomBar` and `aside`.
          */}
          {banners}
          {header}

          <div className="flex min-w-0 flex-1">
            <main id={mainId} ref={mainRef} tabIndex={-1} className="min-w-0 flex-1 outline-none">
              {children}
            </main>
            {aside != null ? <aside className="shrink-0">{aside}</aside> : null}
          </div>

          {/*
            The bar sits in the flow, not `fixed`: it takes up its own height, so the content above
            does not have to be pushed aside by a measured offset. When absent, it is not rendered
            into the markup and takes no height.

            The notch padding comes from a class, not an inline style: that way the padding goes
            through the class-coverage gate and is visible in tests, while jsdom drops `env()` from
            an inline style altogether.
          */}
          {bottomBar != null ? (
            <div
              ref={bottomBarRef}
              className="border-line-soft sticky bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom,0px)] md:hidden"
            >
              {/* The bar learns that the slot provides the notch padding: see `BottomBarSlotContext`. */}
              <BottomBarSlotContext.Provider value={true}>
                {bottomBar}
              </BottomBarSlotContext.Provider>
            </div>
          ) : null}
        </div>
      </div>
    </AppShellContext.Provider>
  );
});
