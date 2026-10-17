"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, type ReactNode } from "react";
import {
  Toolbar as AriaToolbar,
  SeparatorContext,
  ToggleButtonGroupContext,
} from "react-aria-components";
import type { AccessibleName } from "../../lib/accessible-name.js";
import { cn } from "../../lib/cn.js";

interface ToolbarBaseProps {
  /** The toolbar's actions and the `Separator` between their groups. */
  children?: ReactNode;
  /**
   * Arrow key direction: `horizontal` moves left and right, `vertical` moves up and down.
   * A vertical toolbar stacks its actions in a column (a side toolbar next to the canvas).
   */
  orientation?: "horizontal" | "vertical";
  /** Classes for the toolbar's root element. */
  className?: string;
}

/**
 * The toolbar must have a name: either a string or a reference to a visible heading.
 *
 * A screen reader announces an unnamed `toolbar` as just "toolbar", with no hint of what it
 * controls, and a screen usually has several of them. The type requires exactly one of the two:
 * this is the kit-wide rule (`AccessibleName`).
 */
export type ToolbarProps = ToolbarBaseProps & AccessibleName;

/**
 * What counts as a toolbar action for Home and End: the same set the arrow keys walk through in
 * `useToolbar` — any focusable node, including `tabindex="-1"` inside nested groups, not only tab
 * stops.
 *
 * The selector and checks repeat react-aria's `isFocusable` (visibility, `inert`, `hidden`). The
 * helper itself is not exported from the package, and the two must not drift apart: otherwise Home
 * would move focus to a place where the arrow keys do not stop. So `aria-disabled` is NOT filtered
 * out here: arrow keys do stop on such an action, and APG advises keeping unavailable toolbar
 * actions focusable.
 */
const FOCUSABLE = [
  "input:not([disabled]):not([type=hidden])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "button:not([disabled])",
  "a[href]",
  "area[href]",
  "summary",
  "iframe",
  "object",
  "embed",
  "audio[controls]",
  "video[controls]",
  '[contenteditable]:not([contenteditable^="false"])',
  "[tabindex]:not([disabled])",
]
  .map((selector) => `${selector}:not([hidden])`)
  .join(", ");

/**
 * Places where Home and End belong to the element itself: a caret in a field, the edge of a
 * slider, the start and end of a list, of tabs, or of a grid. Intercepting them here would break
 * text input or the widget's own navigation.
 *
 * Composite widgets are listed by name rather than detected through `defaultPrevented`: the
 * listener sits on the toolbar element and fires BEFORE their handlers, because React listens for
 * keys on the root, which the event reaches later. Input fields count only when they take text: a
 * checkbox, a radio, or a button-type `input` has no caret, so keys there should go to the
 * toolbar's edges.
 */
const OWN_HOME_END = [
  "input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]):not([type=reset]):not([type=image]):not([type=file]):not([type=color])",
  "textarea",
  "select",
  '[contenteditable=""]',
  '[contenteditable="true"]',
  '[role="textbox"]',
  '[role="searchbox"]',
  '[role="combobox"]',
  '[role="slider"]',
  '[role="spinbutton"]',
  '[role="listbox"]',
  '[role="menu"]',
  '[role="menubar"]',
  '[role="tablist"]',
  '[role="grid"]',
  '[role="treegrid"]',
  '[role="tree"]',
].join(", ");

/** Whether the element is visible, the same way react-aria's arrow-key traversal sees it. */
function isVisible(el: HTMLElement): boolean {
  if (el.closest("[data-react-aria-prevent-focus]")) return false;
  if (typeof el.checkVisibility === "function")
    return el.checkVisibility({ visibilityProperty: true });
  // jsdom and older engines without `checkVisibility`: check styles along the ancestor chain.
  const view = el.ownerDocument.defaultView;
  if (!view) return true;
  const { visibility } = view.getComputedStyle(el);
  if (visibility === "hidden" || visibility === "collapse") return false;
  for (let node: HTMLElement | null = el; node; node = node.parentElement) {
    if (node.hidden || view.getComputedStyle(node).display === "none") return false;
  }
  return true;
}

function actions(toolbar: HTMLElement): HTMLElement[] {
  return Array.from(toolbar.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.closest("[inert]") && isVisible(el)
  );
}

/**
 * A toolbar with a single tab stop.
 *
 * THE BEHAVIOR COMES FROM react-aria's `Toolbar`, not from roving tabindex. The hook intercepts
 * keys in the capture phase: an arrow key along the toolbar's axis moves focus to the next
 * focusable node, and Tab moves focus to the edge of the toolbar and hands it to the browser. So
 * the toolbar is entered and left through one tab stop. On leaving, the toolbar remembers where
 * focus was and returns it there. Everything rendered through a portal (the `Menu`, `Popover` and
 * `ContextMenu` panels) is not in the toolbar's DOM, so arrow keys inside an open menu stay in the
 * menu.
 *
 * HOME AND END ARE ADDED HERE: `useToolbar` does not handle them, although the APG toolbar pattern
 * requires them. The edge is taken among the same elements the arrow keys walk through. In input
 * fields, on sliders, and in composite widgets (tabs, grid, list) the keys stay with the widget.
 *
 * ARROW KEYS MOVE ONLY ALONG THE TOOLBAR'S AXIS. Keys on the cross axis are left alone, so in a
 * horizontal toolbar `ArrowDown` still opens a `Menu`, while in a vertical one it does not: there
 * the down arrow is taken by traversal, and Enter or Space opens the menu.
 *
 * THE SEPARATOR AND `ToggleGroup` GET THE AXIS THROUGH react-aria CONTEXTS. The separator between
 * groups runs across the toolbar's axis, so a `Separator` without its own `orientation` would lay
 * out vertically in a horizontal toolbar, and the other way round. The contexts pass through
 * portals too, so the kit's overlays (`PopoverContent`, `Dialog`, `Drawer`) reset them at their
 * boundary: `withoutToolbarAxis`. In a foreign portal (Radix directly) the `Separator` is given
 * `orientation` explicitly.
 */
export const Toolbar = forwardRef<HTMLDivElement, ToolbarProps>(function Toolbar(
  { orientation = "horizontal", className, children, ...rest },
  forwardedRef
) {
  const vertical = orientation === "vertical";
  // Context values are keyed by axis, not a new object on every render of the toolbar: otherwise
  // memoized `Separator` and `ToggleGroup` components inside would re-render for nothing.
  const groupContext = useMemo(() => ({ orientation }), [orientation]);
  const separatorContext = useMemo(
    () => ({ orientation: vertical ? ("horizontal" as const) : ("vertical" as const) }),
    [vertical]
  );

  const ref = useRef<HTMLDivElement>(null);
  // The Home and End listener needs its own ref; the same node is passed outward.
  useImperativeHandle(forwardedRef, () => ref.current as HTMLDivElement, []);

  /*
    The listener is native, not a prop: react-aria's `Toolbar` does not accept `onKeyDown`.
    As a side effect, events from a portal never reach it at all: DOM bubbling does not know
    about the React tree, so no "is it inside the toolbar?" check is needed.
  */
  useEffect(() => {
    const toolbar = ref.current;
    if (!toolbar) return;
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Home" && event.key !== "End") return;
      if (
        event.defaultPrevented ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey
      )
        return;
      const target = event.target as HTMLElement;
      // A widget OUTSIDE the toolbar (a list row, the editor root) does not take those keys
      // away from it: only what lies inside counts.
      const owner = target.closest(OWN_HOME_END);
      if (owner && toolbar.contains(owner)) return;
      const list = actions(toolbar);
      const next = event.key === "Home" ? list[0] : list[list.length - 1];
      if (!next) return;
      event.preventDefault();
      next.focus();
    };
    toolbar.addEventListener("keydown", onKeyDown);
    return () => toolbar.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <ToggleButtonGroupContext.Provider value={groupContext}>
      <SeparatorContext.Provider value={separatorContext}>
        <AriaToolbar
          {...rest}
          orientation={orientation}
          ref={ref}
          className={cn(
            "flex gap-1.5",
            /*
              A vertical separator would otherwise collapse to zero. A `Separator` has
              `h-full`, and a percentage height does not resolve against a row with no
              set height: the value stops being `auto`, and `self-stretch` does not stretch
              the separator to the row's height. jsdom does not compute layout, so this was
              caught in a browser. The rule targets direct children, which is where
              separators go between groups.
            */
            "[&>[role=separator][aria-orientation=vertical]]:h-auto",
            // A vertical toolbar sizes to its content: a side column must not stretch across
            // the whole layout, and the separator (`w-full`) spans the column's full width.
            vertical ? "w-fit flex-col items-start" : "flex-row flex-wrap items-center",
            className
          )}
        >
          {children}
        </AriaToolbar>
      </SeparatorContext.Provider>
    </ToggleButtonGroupContext.Provider>
  );
});
