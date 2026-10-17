"use client";

import * as PopoverPrimitive from "@radix-ui/react-popover";
import { Slot, Slottable } from "@radix-ui/react-slot";
import {
  Children,
  createContext,
  forwardRef,
  Fragment,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type CSSProperties,
  type FocusEvent,
  type KeyboardEvent,
  type MutableRefObject,
  type PointerEvent,
  type ReactElement,
  type ReactNode,
  type RefObject,
} from "react";
import { useNarrowScreen } from "../../hooks/useSubmenuPlacement.js";
import { useMessages } from "../../i18n/useMessages.js";
import { BackIcon, ChevronRightIcon } from "../../icons.js";
import { buttonClasses, type ButtonLookOptions } from "../../lib/button.js";
import { cn } from "../../lib/cn.js";
import { OVERLAY_LAYER } from "../../lib/overlay-layer.js";
import { withoutToolbarAxis } from "../../lib/toolbar-axis.js";
import { useMenuAim } from "./useMenuAim.js";

/*
  MEGA MENU IS NAVIGATION, NOT A COMMAND MENU.

  Hence the WAI-ARIA Disclosure Navigation pattern, not `role="menu"`. A category with a flyout is a
  button with `aria-expanded`, the flyout is a region of links, and the links are real `a` elements.
  The `menu` role promises assistive technology an action menu with its keyboard model (arrows across
  all items, Tab closes), and the links inside it stop being links: they cannot be opened in a new tab
  and do not show up in the page's list of links. For the same reason the kit's `Menu` does not allow
  navigation.

  The behavior is our own, not react-aria's: react-aria has no ready-made "drop-down catalog", and a
  `Menu` built on it would be exactly the `menu` role we are moving away from.

  TOUCH AND NARROW SCREENS. Touch has no hover: a category is opened by `click`, and `pointerType`
  "touch" and "pen" are dropped on pointer enter and leave, so menu aim is not needed for them. On a
  narrow screen (the same breakpoint as the kit's submenu) the flyout has nowhere to sit beside the
  category column, so it REPLACES the column: a drill-down into the category, with a "Back" row. There
  is no menu aim there either: replacing the column under the cursor on hover would pull it out from
  under the user's hand.
*/

/** Close delay, used when the pointer has left both the category column and the flyout. */
const LEAVE_GRACE_MS = 150;

/** What counts as focusable inside the flyout when focus moves into it from the keyboard. */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface MegaMenuContextValue {
  baseId: string;
  /** The open category. */
  value: string | null;
  /**
   * The category is the only Tab stop in the category column (roving tabindex).
   * `undefined` means the categories have not registered yet (server render, first paint): then every
   * enabled category is a Tab stop, otherwise Tab would skip the whole catalog.
   */
  tabStop: string | null | undefined;
  /** A category registers itself: the column does not inspect children by type (see `MegaMenu`). */
  register: (id: string, record: CategoryRecord) => void;
  unregister: (id: string) => void;
  /** Open a category by click or from the keyboard right away, bypassing menu aim. */
  openCategory: (id: string, focusShowcase?: boolean) => void;
  close: () => void;
  /** The pointer is over a column row: menu aim decides. `null` means a row without a flyout. */
  hoverCategory: (target: string | null) => void;
  /** The flyout is flipped to the other side: there was not enough room on the end side of the row. */
  flipped: boolean;
  /** The mega menu is inside a `MegaMenuTrigger` overlay: the column and the flyout scroll by themselves. */
  inOverlay: boolean;
  /** Narrow screen: the flyout replaces the column instead of sitting beside it. */
  narrow: boolean;
  /** The category whose flyout now replaces the column; `null` means the column is in place. */
  drilledId: string | null;
  /** Go back from the flyout to the column and focus the category the flyout came from. */
  back: (id: string) => void;
  onCategoryKeyDown: (event: KeyboardEvent<HTMLElement>, id: string, hasShowcase: boolean) => void;
  onShowcaseKeyDown: (event: KeyboardEvent<HTMLElement>, id: string) => void;
  onCategoryFocus: (id: string) => void;
  /** A category wants to move focus into its flyout as soon as the flyout mounts. */
  pendingFocus: MutableRefObject<string | null>;
  /** The category to return focus to once its button is shown again. */
  returnFocus: MutableRefObject<string | null>;
}

const MegaMenuContext = createContext<MegaMenuContextValue | null>(null);

function useMegaMenu(part: string): MegaMenuContextValue {
  const context = useContext(MegaMenuContext);
  if (!context) throw new Error(`${part} must be rendered inside MegaMenu`);
  return context;
}

/** An id for the DOM: the category id comes from the consumer and may contain anything. */
function domId(baseId: string, kind: "category" | "showcase", id: string): string {
  return `${baseId}-${kind}-${encodeURIComponent(id)}`;
}

/** What the column needs to know about a category to select its Tab stop and its drill-down. */
interface CategoryRecord {
  hasShowcase: boolean;
  disabled: boolean;
  active: boolean;
}

/** Children in one flat list, with fragments unwrapped: each link of a column gets its own item. */
function flattenFragments(children: ReactNode): ReactNode[] {
  return Children.toArray(children).flatMap((child) =>
    isValidElement(child) && child.type === Fragment
      ? flattenFragments((child.props as { children?: ReactNode }).children)
      : [child]
  );
}

/** How long to wait for the next typed letter before the word starts over. */
const TYPEAHEAD_RESET_MS = 500;

/**
 * The arrow key that leads to the flyout depends on where the flyout is on screen: with right-to-left
 * writing it is on the left, and a flyout flipped at the edge is on the other side.
 */
function forwardKey(node: HTMLElement, flipped: boolean): "ArrowRight" | "ArrowLeft" {
  const rtl = getComputedStyle(node).direction === "rtl";
  return rtl === flipped ? "ArrowRight" : "ArrowLeft";
}

/** Gap between the column and the flyout (`ms-1`), and the margin to the window edge, in pixels. */
const SHOWCASE_GAP = 4;
const VIEWPORT_MARGIN = 8;

/** Keys that an input inside the flyout (search, a promo with a form) must keep for itself. */
function isTextEntry(target: EventTarget): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
  );
}

export interface MegaMenuProps extends Omit<
  ComponentPropsWithoutRef<"nav">,
  "children" | "defaultValue"
> {
  /** Accessible name of the navigation: on a page with several `nav` elements, only this tells them apart. */
  "aria-label": string;
  /** Categories: `MegaMenuCategory` elements as direct children (fragments are allowed). */
  children?: ReactNode;
  /** The open category, controlled. `null` means the flyout is closed. */
  value?: string | null;
  /** The category open on mount, uncontrolled. */
  defaultValue?: string | null;
  /** Another category opened, or the flyout closed. */
  onValueChange?: (value: string | null) => void;
  /**
   * The flyout width: a CSS length or pixels. One width for all categories, so the menu does not jump
   * when neighboring categories have different amounts of content.
   */
  showcaseWidth?: number | string;
}

/**
 * Amazon-style mega menu: the category column on the left, and the flyout of the hovered category on
 * the right.
 *
 * COMPOUND API, like `Menu`: the flyout is heterogeneous (link columns, promos, custom content), and
 * describing it as an array would mean a second markup language next to JSX.
 *
 * The flyout is a DOM descendant of its category, not a portal. That gives three consequences, and all
 * of them are needed: the Tab order runs "category → its links → the rest of the page"; moving the
 * pointer from the column into the flyout does not count as leaving the menu; and the flyout sits right
 * against the column without position math, because it is `absolute` relative to the root.
 */
export const MegaMenu = forwardRef<HTMLElement, MegaMenuProps>(function MegaMenu(
  {
    children,
    value: valueProp,
    defaultValue = null,
    onValueChange,
    showcaseWidth = "40rem",
    className,
    style,
    onPointerEnter,
    onPointerLeave,
    onBlur,
    ...rest
  },
  forwardedRef
) {
  const baseId = useId();
  const rootRef = useRef<HTMLElement | null>(null);
  // Inside `MegaMenuTrigger` the column and the flyout scroll within the overlay by themselves.
  const inOverlay = useContext(MegaMenuTriggerContext) !== null;
  const [innerValue, setInnerValue] = useState<string | null>(defaultValue);
  const controlled = valueProp !== undefined;
  const value = controlled ? valueProp : innerValue;
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const pendingFocus = useRef<string | null>(null);
  const returnFocus = useRef<string | null>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /*
    CATEGORIES REGISTER THEMSELVES instead of being found by child type. Matching
    `child.type === MegaMenuCategory` only saw direct children, and it broke in two cases: for categories
    wrapped in their own component, and for elements that came from a Next.js server component, where the
    element type on the client is a lazy wrapper rather than the function itself. Record order is mount
    order, which is the order of the rows in the DOM.
  */
  const [registry, setRegistry] = useState<ReadonlyMap<string, CategoryRecord>>(() => new Map());
  const register = useCallback((id: string, record: CategoryRecord) => {
    setRegistry((prev) => {
      const old = prev.get(id);
      if (
        old &&
        old.hasShowcase === record.hasShowcase &&
        old.disabled === record.disabled &&
        old.active === record.active
      )
        return prev;
      // `set` on an existing key does not change the record's position.
      return new Map(prev).set(id, record);
    });
  }, []);
  const unregister = useCallback((id: string) => {
    setRegistry((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const tabbable = (id: string | null) =>
    id !== null && registry.has(id) && !registry.get(id)?.disabled ? id : null;
  let firstEnabled: string | null = null;
  let activeId: string | null = null;
  for (const [id, record] of registry) {
    if (record.disabled) continue;
    firstEnabled ??= id;
    if (record.active) activeId ??= id;
  }
  // Tab stop: where the user was last, otherwise the open category, otherwise the current section,
  // otherwise the first one. A key that is not among the categories (a foreign `value`, a removed row)
  // is skipped, so the Tab stop never disappears.
  const tabStop =
    registry.size === 0
      ? undefined
      : (tabbable(focusedId) ?? tabbable(value) ?? activeId ?? firstEnabled);

  const valueRef = useRef(value);
  valueRef.current = value;
  const onValueChangeRef = useRef(onValueChange);
  onValueChangeRef.current = onValueChange;

  const setValue = useCallback(
    (next: string | null) => {
      if (next === valueRef.current) return;
      if (!controlled) setInnerValue(next);
      onValueChangeRef.current?.(next);
    },
    [controlled]
  );

  /*
    Switching or closing by pointer (mouse leave, a deferred menu aim switch) must not lose focus: if
    focus is inside the flyout being left, its content unmounts and focus would drop to `body` in the
    middle of keyboard work. So focus goes back to the category of that flyout, through the same effect
    as "Back".
  */
  const switchByPointer = useCallback(
    (next: string | null) => {
      const current = valueRef.current;
      if (current !== null && next !== current) {
        const showcase = document.getElementById(domId(baseId, "showcase", current));
        if (showcase?.contains(document.activeElement)) returnFocus.current = current;
      }
      setValue(next);
    },
    [baseId, setValue]
  );

  const cancelLeave = () => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
    leaveTimer.current = null;
  };
  useEffect(() => cancelLeave, []);

  /** The column's categories in DOM order; disabled ones only on request. */
  const categoryNodes = useCallback((withDisabled = false): HTMLElement[] => {
    const root = rootRef.current;
    if (!root) return [];
    return Array.from(root.querySelectorAll<HTMLElement>("[data-mega-category]")).filter(
      (node) => withDisabled || node.getAttribute("aria-disabled") !== "true"
    );
  }, []);

  // Menu aim needs the open flyout. It is looked up by id rather than by ref, because the category renders it.
  const showcaseRef = useMemo(
    () => ({
      get current(): HTMLElement | null {
        return value === null ? null : document.getElementById(domId(baseId, "showcase", value));
      },
    }),
    [baseId, value]
  );
  const narrow = useNarrowScreen();
  const narrowRef = useRef(narrow);
  narrowRef.current = narrow;
  // A drill-down is possible only into a category that has a flyout. A `value` with a foreign key, or a
  // category without children, does not hide the column: otherwise nothing would be left on screen.
  const drilledId =
    narrow && value !== null && registry.get(value)?.hasShowcase === true ? value : null;

  const aim = useMenuAim({ value, showcaseRef, commit: switchByPointer });
  const { cancel: cancelAim, request: requestAim } = aim;

  /*
    FLIP AT THE EDGE. The flyout sits on the end side of the row. If there is not enough room there but
    there is on the other side, it moves to that side. If there is not enough room on either side, it stays
    on its own side: `max-w` will shrink it.

    It is measured BEFORE opening, on mount and on window resize, not from the open flyout: the arrow key
    that leads to the flyout must know the side already at the first keyboard open. The width comes from a
    probe with the same length as the flyout. The length arrives as a CSS string (`40rem`, `min(…)`), and
    only the browser can compute it.
  */
  const [flipped, setFlipped] = useState(false);
  /*
    The measurement is a function, not only an effect: in the dropdown variant, `nav` mounts before Radix
    places the overlay, so a measurement on mount sees it in the wrong place. That is why the side is also
    measured again when a category opens, and right before deciding which arrow key leads to the flyout.
  */
  const measureFlip = useCallback((): boolean => {
    const root = rootRef.current;
    if (!root) return false;
    const probe = document.createElement("div");
    probe.style.position = "absolute";
    probe.style.visibility = "hidden";
    probe.style.pointerEvents = "none";
    probe.style.width = "var(--mega-menu-showcase-w)";
    root.appendChild(probe);
    const showcase = Math.min(probe.offsetWidth, window.innerWidth - 32);
    probe.remove();
    const need = showcase + SHOWCASE_GAP + VIEWPORT_MARGIN;
    const rect = root.getBoundingClientRect();
    const rtl = getComputedStyle(root).direction === "rtl";
    const endRoom = rtl ? rect.left : window.innerWidth - rect.right;
    const startRoom = rtl ? window.innerWidth - rect.right : rect.left;
    const next = endRoom < need && startRoom >= need;
    setFlipped(next);
    return next;
  }, []);
  useLayoutEffect(() => {
    measureFlip();
    window.addEventListener("resize", measureFlip);
    return () => window.removeEventListener("resize", measureFlip);
    // Re-measure when the catalog opens, not on every category change: the side does not depend on the
    // category, and a probe plus a layout read on every hover is wasted work on the hot path.
  }, [measureFlip, showcaseWidth, value === null]);

  /** The typed-ahead text and the timer after which the word starts over. */
  const typeahead = useRef({ text: "", timer: null as ReturnType<typeof setTimeout> | null });
  useEffect(
    () => () => {
      if (typeahead.current.timer) clearTimeout(typeahead.current.timer);
    },
    []
  );

  const focusCategory = useCallback(
    (id: string) => {
      const node = categoryNodes(true).find((candidate) => candidate.dataset.megaCategory === id);
      node?.focus();
    },
    [categoryNodes]
  );

  const context = useMemo<MegaMenuContextValue>(() => {
    const openCategory = (id: string, focusShowcase = false) => {
      cancelAim();
      // On a narrow screen the category button disappears together with the column. Focus left on it would
      // drop to `body`, so focus always goes into the flyout.
      const intoShowcase = focusShowcase || narrowRef.current;
      if (intoShowcase) pendingFocus.current = id;
      // Already open by hover: the value does not change, so the category effect that moves focus into the
      // flyout will not run. We move it ourselves.
      if (intoShowcase && valueRef.current === id) {
        pendingFocus.current = null;
        document
          .getElementById(domId(baseId, "showcase", id))
          ?.querySelector<HTMLElement>(FOCUSABLE)
          ?.focus();
        return;
      }
      setValue(id);
    };
    const close = () => {
      cancelAim();
      setValue(null);
    };

    /*
      TYPEAHEAD BY FIRST LETTER, as in `Menu`: a long column is not walked with the arrow keys row by row.
      Letters typed in a row search for the start of a label. The same letter repeated cycles through the
      categories that start with it. A pause resets what was typed. A letter with a modifier is a keyboard
      shortcut and is left alone.
    */
    const matchTypeahead = (
      event: KeyboardEvent<HTMLElement>,
      nodes: HTMLElement[],
      index: number
    ): HTMLElement | undefined => {
      if (event.key.length !== 1 || event.ctrlKey || event.metaKey || event.altKey)
        return undefined;
      const state = typeahead.current;
      if (state.timer) clearTimeout(state.timer);
      state.timer = setTimeout(() => {
        state.text = "";
        state.timer = null;
      }, TYPEAHEAD_RESET_MS);
      const key = event.key.toLocaleLowerCase();
      // After a cycle ("b", "b") a new letter starts a new word, not "bbg".
      const cycling = state.text.length > 1 && [...state.text].every((c) => c === state.text[0]);
      state.text = cycling && key !== state.text[0] ? key : state.text + key;
      const repeated = [...state.text].every((char) => char === state.text[0]);
      const query = repeated ? key : state.text;
      // A new letter is searched from the next row, a continuation of the word from the current row.
      const start = repeated ? index + 1 : Math.max(index, 0);
      const ordered = [...nodes.slice(start), ...nodes.slice(0, start)];
      return ordered.find((node) =>
        (node.querySelector("[data-mega-label]")?.textContent ?? "")
          .trim()
          .toLocaleLowerCase()
          .startsWith(query)
      );
    };

    const onCategoryKeyDown = (
      event: KeyboardEvent<HTMLElement>,
      id: string,
      hasShowcase: boolean
    ) => {
      const node = event.currentTarget;
      const enabled = categoryNodes();
      const index = enabled.indexOf(node);
      // On a category link, Enter navigates and Space scrolls the page. Both are browser behaviors, so there
      // is no reason to take them away.
      const openFromKey = () => {
        if (!hasShowcase || node.getAttribute("aria-disabled") === "true") return;
        event.preventDefault();
        openCategory(id, true);
      };
      let target: HTMLElement | undefined;
      switch (event.key) {
        case "ArrowDown":
          target = enabled[Math.min(index + 1, enabled.length - 1)];
          break;
        case "ArrowUp":
          target = enabled[Math.max(index - 1, 0)];
          break;
        case "Home":
          target = enabled[0];
          break;
        case "End":
          target = enabled[enabled.length - 1];
          break;
        case "Escape":
          if (valueRef.current !== null) {
            event.preventDefault();
            close();
          }
          return;
        case " ":
          // A space in the middle of the typed text is part of a label ("Home and garden"), not
          // a request to open the category.
          if (typeahead.current.text === "") {
            openFromKey();
            return;
          }
          // Do not open without a match either: a button would fire on release.
          event.preventDefault();
          target = matchTypeahead(event, enabled, index);
          if (!target) return;
          break;
        case "Enter":
          openFromKey();
          return;
        default:
          if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            if (
              hasShowcase &&
              event.key === forwardKey(node, measureFlip()) &&
              node.getAttribute("aria-disabled") !== "true"
            ) {
              event.preventDefault();
              openCategory(id, true);
            }
            return;
          }
          target = matchTypeahead(event, enabled, index);
          if (!target) return;
      }
      event.preventDefault();
      if (!target || target === node) return;
      target.focus();
      // The flyout is open: it follows focus the same way it follows hover. Otherwise one category would be
      // highlighted while another one's flyout is open.
      if (valueRef.current !== null) {
        const targetId = target.dataset.megaCategory ?? null;
        cancelAim();
        setValue(target.dataset.megaShowcase === "true" ? targetId : null);
      }
    };

    // Close, then return focus, in that order and through the category's effect: while the flyout replaces
    // the column, the category button is hidden, and it can be focused only after the column is back in place.
    const back = (id: string) => {
      returnFocus.current = id;
      close();
    };

    const onShowcaseKeyDown = (event: KeyboardEvent<HTMLElement>, id: string) => {
      if (isTextEntry(event.target)) return;
      if (narrowRef.current) {
        // Arrow keys toward the column do not apply here: there is no column next to it. Escape means "Back".
        if (event.key === "Escape") {
          event.preventDefault();
          back(id);
        }
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        // Move focus first: closing unmounts the link that has focus, and focus would drop to `body`.
        focusCategory(id);
        close();
      } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        const backKey =
          forwardKey(event.currentTarget, measureFlip()) === "ArrowRight"
            ? "ArrowLeft"
            : "ArrowRight";
        if (event.key !== backKey) return;
        event.preventDefault();
        focusCategory(id);
      }
    };

    return {
      baseId,
      value,
      tabStop,
      register,
      unregister,
      openCategory,
      close,
      // There is no menu aim on a narrow screen: only a click or a tap opens the flyout.
      hoverCategory: narrow ? () => {} : requestAim,
      flipped,
      narrow,
      drilledId,
      inOverlay,
      back,
      onCategoryKeyDown,
      onShowcaseKeyDown,
      onCategoryFocus: setFocusedId,
      pendingFocus,
      returnFocus,
    };
  }, [
    baseId,
    value,
    tabStop,
    register,
    unregister,
    flipped,
    narrow,
    drilledId,
    inOverlay,
    setValue,
    categoryNodes,
    focusCategory,
    cancelAim,
    requestAim,
    measureFlip,
  ]);

  // A click or tap outside the catalog closes the flyout. Pointer leave does not cover this: a touch has
  // no leave.
  useEffect(() => {
    if (value === null) return;
    const onPointerDown = (event: globalThis.PointerEvent) => {
      const root = rootRef.current;
      if (root && event.target instanceof Node && !root.contains(event.target)) setValue(null);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [value, setValue]);

  return (
    <MegaMenuContext.Provider value={context}>
      <nav
        ref={(node) => {
          rootRef.current = node;
          if (typeof forwardedRef === "function") forwardedRef(node);
          else if (forwardedRef) forwardedRef.current = node;
        }}
        className={cn("relative w-64 text-[13px] max-sm:w-full", className)}
        style={{ "--mega-menu-showcase-w": cssLength(showcaseWidth), ...style } as CSSProperties}
        onPointerEnter={(event: PointerEvent<HTMLElement>) => {
          cancelLeave();
          onPointerEnter?.(event);
        }}
        onPointerLeave={(event: PointerEvent<HTMLElement>) => {
          onPointerLeave?.(event);
          if (event.pointerType === "touch" || event.pointerType === "pen") return;
          // Not immediately: a cursor that briefly leaves the edge of the flyout or the gap next to the column
          // must not reset the catalog.
          cancelLeave();
          leaveTimer.current = setTimeout(() => {
            // On a narrow screen a drill-down is a navigation step, not a hover: leaving with the mouse does not
            // cancel it, and "Back" undoes it.
            if (narrowRef.current) return;
            cancelAim();
            switchByPointer(null);
          }, LEAVE_GRACE_MS);
        }}
        onBlur={(event: FocusEvent<HTMLElement>) => {
          onBlur?.(event);
          // Focus has left the menu (Tab past its last link): the flyout closes. `relatedTarget` is empty when
          // clicking a non-focusable spot inside the flyout. That is not leaving: an outside click closes it.
          const next = event.relatedTarget;
          if (next instanceof Node && !event.currentTarget.contains(next)) setValue(null);
        }}
        {...rest}
      >
        <ul className={cn(COLUMN_CLASS, inOverlay && OVERLAY_SCROLL_CLASS)}>{children}</ul>
      </nav>
    </MegaMenuContext.Provider>
  );
});

function cssLength(value: number | string): string {
  return typeof value === "number" ? `${value}px` : value;
}

const COLUMN_CLASS =
  "bg-surface-elevated border-line flex flex-col gap-px rounded-md border p-1 list-none m-0";

/**
 * A category row. The highlight comes from `aria-expanded`, not from `:hover`, so exactly the category
 * whose flyout is open is highlighted. During menu aim the pointer is over a neighboring category while
 * the old flyout is still open, and two highlights at once would read as two selections.
 */
const CATEGORY_CLASS =
  "text-fg-0 flex w-full cursor-pointer items-center gap-2 rounded-sm border-0 bg-transparent " +
  "px-2.5 py-2 text-start text-[13px] leading-5 no-underline select-none " +
  "focus-visible:outline-accent-strong focus-visible:outline-2 focus-visible:-outline-offset-2 " +
  "aria-expanded:bg-bg-2 aria-expanded:font-semibold " +
  // The current section is shown in color, like the current link in the flyout; the open category is
  // shown with a background. These are two different signals, and one row can have both.
  "aria-[current=true]:text-accent-strong " +
  "aria-disabled:cursor-default aria-disabled:opacity-50";

/** A category link without a flyout is highlighted on hover: there is nothing to open. */
const CATEGORY_LINK_CLASS = "hover:bg-bg-2";

const CATEGORY_ICON_CLASS = "text-fg-2 flex shrink-0";

/** The label wraps instead of being cut off, so a long section name can be read in full. */
const CATEGORY_LABEL_CLASS = "min-w-0 flex-1 break-words";

const CATEGORY_CHEVRON_CLASS = "text-fg-3 flex shrink-0 rtl:rotate-180";

/**
 * The flyout: right against the column on the end side of the row, no shorter than the column, one
 * width for all categories. Its surface and shadow match the `Menu` panel: the kit's three menus should
 * read as one system.
 */
const SHOWCASE_CLASS =
  "bg-surface-elevated border-line absolute top-0 min-h-full " +
  "w-[var(--mega-menu-showcase-w)] max-w-[calc(100vw-2rem)] rounded-md border p-4 " +
  `shadow-[var(--shadow-2)] ${OVERLAY_LAYER.popover}`;

/** The side of the flyout: the end side of the row, or the start side when it is flipped at the edge. */
const SHOWCASE_SIDE = { end: "start-full ms-1", start: "end-full me-1" } as const;

/**
 * The flyout in place of the column on a narrow screen: an ordinary full-width block with no surface of
 * its own. The border and background belong to the column it sits in.
 */
const SHOWCASE_DRILLED_CLASS = "w-full p-3";

/** The "Back" row with the category name: a step back through the column, as in a phone menu. */
const BACK_ROW_CLASS = "border-line -mx-3 mb-3 flex items-center gap-1 border-b px-1 pb-2";

const BACK_BUTTON_CLASS =
  "text-fg-1 hover:text-fg-0 hover:bg-bg-2 flex shrink-0 cursor-pointer items-center gap-1.5 " +
  "rounded-sm border-0 bg-transparent px-2 py-1.5 text-[13px] leading-5 " +
  "focus-visible:outline-accent-strong focus-visible:outline-2 focus-visible:-outline-offset-2";

const SHOWCASE_HEADING_CLASS =
  "text-fg-0 hover:text-accent-strong mb-3 inline-flex items-center gap-1 text-[15px] " +
  "font-semibold no-underline";

const SHOWCASE_GRID_CLASS = "grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-x-6 gap-y-5";

/** In a flyout that replaces the column, link columns stack one below another: side by side they would be too cramped. */
const SHOWCASE_GRID_DRILLED_CLASS = "grid grid-cols-1 gap-y-5";

export interface MegaMenuCategoryProps {
  /** The category key: it is also what opens the category through `value`. */
  id: string;
  /** The label in the column; it is also the flyout's accessible name. */
  label: ReactNode;
  /** Icon to the left of the label; hidden from screen readers. */
  icon?: ReactNode;
  /**
   * The address of the whole section. With a flyout, it is a heading link at the top of the flyout;
   * without one, the column row itself becomes the link.
   */
  href?: string;
  /**
   * A router link instead of `href`: an empty element (`<Link href="/x" />`), and the label moves inside
   * it. It is a separate prop rather than `asChild`, because the children of a category are its flyout.
   */
  link?: ReactElement;
  /** Visible, but cannot be opened, and skipped by the arrow keys. */
  disabled?: boolean;
  /**
   * The current page is in this section: `aria-current="true"` and the current look, whether or not the
   * flyout is open. It opens nothing; without an open flyout, Tab reaches this category in the column.
   * The consumer computes it, like `active` on `NavItem`: each router has its own rules for comparing
   * addresses.
   */
  active?: boolean;
  /** Flyout content: `MegaMenuGroup` or anything custom. Without children there is no flyout. */
  children?: ReactNode;
  /** Classes for the column row. */
  className?: string;
}

/**
 * A category of the column and its flyout.
 *
 * The flyout content mounts only for the open category: a catalog of hundreds of links and images must
 * not load everything at once. The region itself always exists (hidden): the button's `aria-controls`
 * points to it.
 */
export function MegaMenuCategory({
  id,
  label,
  icon,
  href,
  link,
  disabled = false,
  active = false,
  children,
  className,
}: MegaMenuCategoryProps) {
  const menu = useMegaMenu("MegaMenuCategory");
  const hasShowcase = Children.toArray(children).length > 0;
  const open = hasShowcase && menu.value === id;
  const categoryId = domId(menu.baseId, "category", id);
  const showcaseId = domId(menu.baseId, "showcase", id);
  const showcaseRef = useRef<HTMLElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const messages = useMessages();
  // This category has replaced the column / the column is replaced by another category.
  const drilled = menu.drilledId === id;
  const coveredByOther = menu.drilledId !== null && !drilled;

  // Register with the column. Unregistering is a separate effect keyed by `id`: a change of `disabled` or
  // `active` updates the record in place, so the row order is not disturbed.
  const { register, unregister } = menu;
  useLayoutEffect(() => () => unregister(id), [id, unregister]);
  useLayoutEffect(
    () => register(id, { hasShowcase, disabled, active }),
    [id, hasShowcase, disabled, active, register]
  );

  // Moving into the flyout by keyboard or touch: focus goes to its first focusable element as soon as the
  // content has mounted.
  useEffect(() => {
    if (!open || menu.pendingFocus.current !== id) return;
    menu.pendingFocus.current = null;
    showcaseRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
  }, [open, id, menu.pendingFocus]);

  // "Back": the column is back and the category button is visible again, so focus goes to it.
  useEffect(() => {
    if (open || menu.returnFocus.current !== id) return;
    menu.returnFocus.current = null;
    buttonRef.current?.focus();
  }, [open, id, menu.returnFocus]);

  const shared = {
    id: categoryId,
    "data-mega-category": id,
    "data-mega-showcase": hasShowcase ? "true" : "false",
    // Before the categories have registered (server render, first paint), every enabled one is a Tab stop:
    // the column does not know yet which one comes first.
    tabIndex: (menu.tabStop === undefined ? !disabled : menu.tabStop === id) ? 0 : -1,
    "aria-disabled": disabled || undefined,
    "aria-current": active ? ("true" as const) : undefined,
    onFocus: () => menu.onCategoryFocus(id),
    onKeyDown: (event: KeyboardEvent<HTMLElement>) =>
      menu.onCategoryKeyDown(event, id, hasShowcase),
    onPointerEnter: (event: PointerEvent<HTMLElement>) => {
      if (disabled || event.pointerType === "touch" || event.pointerType === "pen") return;
      // Menu aim decides: a pointer moving diagonally toward the open flyout brushes past
      // neighboring rows, and those must not take it over.
      menu.hoverCategory(hasShowcase ? id : null);
    },
  };

  const content = (
    <>
      {icon != null && (
        <span aria-hidden className={CATEGORY_ICON_CLASS}>
          {icon}
        </span>
      )}
      <span data-mega-label="" className={CATEGORY_LABEL_CLASS}>
        {label}
      </span>
    </>
  );

  if (!hasShowcase) {
    // A disabled category is not a navigation, and it does not render a router link at all: `Slot` calls
    // the child's handler before its own, so the router would navigate before any `preventDefault`. What
    // remains is an `a` without an address: `aria-disabled` on a link only announces that it is unavailable,
    // it does not cancel the link.
    const routed = link != null && !disabled;
    const Comp = routed ? Slot : "a";
    return (
      <li hidden={coveredByOther}>
        <Comp
          {...shared}
          href={routed || disabled ? undefined : href}
          className={cn(CATEGORY_CLASS, !disabled && CATEGORY_LINK_CLASS, className)}
        >
          {content}
          {routed ? <Slottable>{link}</Slottable> : null}
        </Comp>
      </li>
    );
  }

  return (
    <li hidden={coveredByOther}>
      <button
        {...shared}
        ref={buttonRef}
        // Hidden while the flyout takes its place: `aria-expanded` and `aria-controls` stay in the DOM, and
        // `aria-labelledby` gives the region its name.
        hidden={drilled}
        type="button"
        aria-expanded={open}
        aria-controls={showcaseId}
        className={cn(CATEGORY_CLASS, className)}
        onClick={() => {
          // Opens rather than toggles: tapping an open category again must not hide the flyout the user has just
          // opened.
          if (!disabled) menu.openCategory(id);
        }}
      >
        {content}
        <span aria-hidden className={CATEGORY_CHEVRON_CLASS}>
          <ChevronRightIcon size={14} />
        </span>
      </button>
      <section
        ref={showcaseRef}
        id={showcaseId}
        aria-labelledby={categoryId}
        hidden={!open}
        data-mega-showcase-region=""
        className={
          drilled
            ? SHOWCASE_DRILLED_CLASS
            : cn(
                SHOWCASE_CLASS,
                SHOWCASE_SIDE[menu.flipped ? "start" : "end"],
                menu.inOverlay && OVERLAY_SCROLL_CLASS
              )
        }
        onKeyDown={(event) => menu.onShowcaseKeyDown(event, id)}
      >
        {open && (
          <>
            {drilled && (
              <div className={BACK_ROW_CLASS}>
                <button type="button" className={BACK_BUTTON_CLASS} onClick={() => menu.back(id)}>
                  <span aria-hidden className="flex rtl:rotate-180">
                    <BackIcon size={16} />
                  </span>
                  {messages.megaMenu.back}
                </button>
                {/*
                  The category name is shown here only when it has no link of its own. Otherwise the heading link below
                  shows it, and on a phone the name would appear twice in a row.
                */}
                {href == null && link == null && (
                  <span className="text-fg-0 min-w-0 flex-1 font-semibold break-words">
                    {label}
                  </span>
                )}
              </div>
            )}
            {(href != null || link != null) && (
              <ShowcaseHeading href={href} link={link}>
                {label}
              </ShowcaseHeading>
            )}
            <div className={drilled ? SHOWCASE_GRID_DRILLED_CLASS : SHOWCASE_GRID_CLASS}>
              {children}
            </div>
          </>
        )}
      </section>
    </li>
  );
}

function ShowcaseHeading({
  href,
  link,
  children,
}: {
  href?: string;
  link?: ReactElement;
  children: ReactNode;
}) {
  const Comp = link ? Slot : "a";
  return (
    <div>
      <Comp href={link ? undefined : href} className={SHOWCASE_HEADING_CLASS}>
        {children}
        <span aria-hidden className={CATEGORY_CHEVRON_CLASS}>
          <ChevronRightIcon size={14} />
        </span>
        {link ? <Slottable>{link}</Slottable> : null}
      </Comp>
    </div>
  );
}

export interface MegaMenuGroupProps {
  /** The column title; it also labels the column's list of links. */
  title: ReactNode;
  /** The address of the whole subsection: the title becomes a link. */
  href?: string;
  /**
   * A router link instead of `href`: an empty element (`<Link href="/x" />`), and the title moves inside
   * it, as with `link` on a category.
   */
  link?: ReactElement;
  /**
   * The links of the column: `MegaMenuLink` elements. Each one goes into its own list item, including
   * those that come in a fragment.
   */
  children?: ReactNode;
  /** Classes for the column. */
  className?: string;
}

const GROUP_TITLE_CLASS = "text-fg-0 mb-1.5 text-[13px] font-semibold";
const GROUP_TITLE_LINK_CLASS = "hover:text-accent-strong text-inherit no-underline";
const GROUP_LIST_CLASS = "m-0 flex list-none flex-col p-0";

/**
 * A column of the flyout: a title and the list of links under it.
 *
 * The list is labeled by the title (`aria-labelledby`): a screen reader announces "Smartphones, list,
 * 5 items" rather than an unnamed list in the middle of the flyout.
 */
export function MegaMenuGroup({ title, href, link, children, className }: MegaMenuGroupProps) {
  const titleId = useId();
  return (
    <div className={cn("min-w-0", className)}>
      <div id={titleId} className={GROUP_TITLE_CLASS}>
        {link != null ? (
          <Slot className={GROUP_TITLE_LINK_CLASS}>
            {title}
            <Slottable>{link}</Slottable>
          </Slot>
        ) : href != null ? (
          <a href={href} className={GROUP_TITLE_LINK_CLASS}>
            {title}
          </a>
        ) : (
          title
        )}
      </div>
      <ul aria-labelledby={titleId} className={GROUP_LIST_CLASS}>
        {/* The key is the position: the list is static, and keys from different fragments would collide. */}
        {flattenFragments(children).map((child, index) => (
          <li key={index}>{child}</li>
        ))}
      </ul>
    </div>
  );
}

export interface MegaMenuLinkProps extends ComponentPropsWithoutRef<"a"> {
  /** The link points to the current page: `aria-current="page"` and the current look. */
  active?: boolean;
  /**
   * @deprecated Use `active`: the current navigation item in the kit is `active`, as on `NavItem`.
   * The alias works until 5.0.
   */
  current?: boolean;
  /** Icon to the left of the label; hidden from screen readers. */
  icon?: ReactNode;
  /**
   * Render the link as the router's element: `<MegaMenuLink asChild><Link href="/x">Label</Link></MegaMenuLink>`.
   * Styles, props and `ref` pass to it; the icon goes inside.
   */
  asChild?: boolean;
}

const LINK_CLASS =
  "text-fg-1 hover:text-fg-0 flex items-center gap-2 rounded-sm py-1 text-[13px] leading-5 " +
  "no-underline hover:underline " +
  "focus-visible:outline-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2 " +
  "aria-[current=page]:text-accent-strong aria-[current=page]:font-semibold";

/**
 * A flyout link.
 *
 * The kit does not compute the current page: it takes the `active` prop, as `NavItem` does, because each
 * router has its own rules for comparing addresses (ADR-0018).
 */
export const MegaMenuLink = forwardRef<HTMLAnchorElement, MegaMenuLinkProps>(function MegaMenuLink(
  { active, current, icon, asChild = false, children, className, ...rest },
  ref
) {
  const Comp = asChild ? Slot : "a";
  return (
    <Comp
      ref={ref}
      aria-current={(active ?? current) ? "page" : undefined}
      className={cn(LINK_CLASS, className)}
      {...rest}
    >
      {icon != null && (
        <span aria-hidden className="text-fg-2 flex shrink-0">
          {icon}
        </span>
      )}
      {asChild ? <Slottable>{children}</Slottable> : children}
    </Comp>
  );
});

/*
  THE DROPDOWN VIEW: THE SAME MARKUP, A DIFFERENT WRAPPER.

  `MegaMenu` inside `MegaMenuTrigger` does not change in any line: the column, the flyout, roving
  tabindex, Escape in the flyout are all the same. The wrapper adds only what the inline view does not
  have: the button, the overlay under it, and closing.

  THE OVERLAY IS A RADIX `Popover`, not react-aria as in `Menu`. There are three reasons. First, this is
  not a menu: react-aria would add the `menu` role and typed search over items, while we need navigation
  with links. Second, Radix's layer stack decides "who gets Escape" among its own layers: the kit's
  `Dialog` is also Radix, so a mega menu inside a window closes on the first Escape and the window on the
  second, with no workarounds (ADR-0041). Third, the portal, flipping at the screen edge and
  `available-height` for scrolling are already there.
*/

interface MegaMenuTriggerContextValue {
  /** The trigger button, which gets focus back on close. */
  triggerRef: RefObject<HTMLButtonElement | null>;
  setOpen: (open: boolean) => void;
}

const MegaMenuTriggerContext = createContext<MegaMenuTriggerContextValue | null>(null);

/** The overlay portal: the `Toolbar` axis that the button is rendered in does not pass into it. */
const DropdownPortal = withoutToolbarAxis(PopoverPrimitive.Portal);

/**
 * The overlay: the `popover` layer, appearing on the kit's motion scale, scrolling inside.
 *
 * SCROLLING IS SEPARATE FOR THE COLUMN AND THE FLYOUT, not for the whole overlay. The flyout is
 * `absolute` relative to `nav`, next to the column. `overflow: auto` on the overlay itself would clip it
 * at the overlay's border, leaving only a sliver the width of the gap. So the height is limited on the
 * column's `ul` and on the flyout's `section`, with the `OVERLAY_SCROLL_CLASS` class that `MegaMenu`
 * applies itself. The `ul` is not positioned, and the flyout's containing block is the `nav` above it,
 * so `overflow` on the `ul` does not clip the flyout.
 */
const DROPDOWN_CONTENT_CLASS =
  `${OVERLAY_LAYER.popover} outline-none ` +
  /*
    Narrow screen: the full width of the window minus 8px margins on each side (`collisionPadding`).
    Radix's wrapper measures the overlay by its content (`min-width: max-content`), and without an explicit
    width the menu on a phone shrank to the longest label: narrower than the column on desktop, and
    different for each category during a drill-down. A long label without spaces pushed it past the edge.
    The breakpoint is the same as in `useNarrowScreen`: `sm`, 640px.

    `100vw` also counts the scrollbar when it is not an overlay scrollbar (a desktop browser window narrowed
    below 640px), and then the overlay would stick out by its width. The cap is the width Radix computes
    from the visible area: `available-width`.
  */
  "max-sm:w-[calc(100vw-1rem)] max-sm:max-w-[var(--radix-popover-content-available-width)] " +
  // Enter and exit use tokens that the `prefers-reduced-motion` gate can see (ADR-0043, ADR-0047).
  "data-[state=open]:animate-fadein data-[state=closed]:animate-fadeout";

/**
 * Scrolling of the column and the flyout in the overlay: the height runs from the button to the edge of
 * the window (Radix `available-height`). `MegaMenu` applies the classes itself, having learned from the
 * context that it is in an overlay. It does not rely on overlay selectors against foreign markup, which
 * would silently break at the first edit to it.
 *
 * The iOS height workaround is the same as in `MENU_PANEL_CLASS`: in Safari on iOS 27, `available-height`
 * can come out close to zero, and only a strip of the column remains. It is 24rem or 60% of the dynamic
 * screen height, whichever is smaller; `!` overrides the rule above. `-webkit-touch-callout` is understood
 * only by WebKit on iOS.
 */
const OVERLAY_SCROLL_CLASS =
  "max-h-[var(--radix-popover-content-available-height)] overflow-y-auto overscroll-contain " +
  "[@supports(-webkit-touch-callout:none)]:max-h-[min(24rem,60dvh)]!";

/** Escape stays with an input inside the flyout; otherwise it would close the overlay. */
const SHOWCASE_SELECTOR = "[data-mega-showcase-region]";

/** Tab stops inside the overlay: the column is one, plus the links of the open flyout. */
function tabStops(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (node) => node.tabIndex >= 0 && !node.closest("[hidden]")
  );
}

/** Where focus goes on open: the open category, or the first enabled one. */
function entryCategory(root: HTMLElement): HTMLElement | null {
  const enabled = Array.from(root.querySelectorAll<HTMLElement>("[data-mega-category]")).filter(
    (node) => node.getAttribute("aria-disabled") !== "true"
  );
  // The column's Tab stop is the open category, otherwise the first one.
  return enabled.find((node) => node.tabIndex === 0) ?? enabled[0] ?? null;
}

export interface MegaMenuTriggerProps {
  /** Whether the mega menu is open. Controlled. */
  open?: boolean;
  /** Whether the mega menu is open on mount. Uncontrolled. */
  defaultOpen?: boolean;
  /** The mega menu opened or closed: by click, by key, or by following a link. */
  onOpenChange?: (open: boolean) => void;
  /**
   * The first child is `MegaMenuButton`; the rest are `MegaMenu`, and they render in the overlay below
   * the button.
   */
  children: ReactNode;
}

/**
 * A dropdown mega menu: a button, with the `MegaMenu` in an overlay under it.
 *
 *     <MegaMenuTrigger>
 *       <MegaMenuButton>Catalog</MegaMenuButton>
 *       <MegaMenu aria-label="Catalog">…</MegaMenu>
 *     </MegaMenuTrigger>
 *
 * It opens on click and from the keyboard (Enter, Space, Arrow Down), not on hover: the mega menu must
 * not pop open from an accidental mouse movement. It closes on Escape in a category, on a click outside,
 * on a second click on the button, on following any link, and on Tab past the last element. Focus returns
 * to the button on Escape and on a second click.
 *
 * THE FIRST CHILD IS THE BUTTON, THE REST ARE THE OVERLAY. They are matched by position, not by type: so
 * the button can be wrapped in your own component (a hint, a counter), and `MegaMenu` can be moved into
 * your own component, and nothing silently sends the overlay to the header.
 */
export function MegaMenuTrigger({
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  children,
}: MegaMenuTriggerProps) {
  const [innerOpen, setInnerOpen] = useState(defaultOpen);
  const controlled = openProp !== undefined;
  const open = controlled ? openProp : innerOpen;
  const openRef = useRef(open);
  openRef.current = open;
  const onOpenChangeRef = useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;

  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  /** Tab moved focus further down the page: focus must not be returned to the button. */
  const tabbedAway = useRef(false);

  const setOpen = useCallback(
    (next: boolean) => {
      if (next === openRef.current) return;
      if (!controlled) setInnerOpen(next);
      onOpenChangeRef.current?.(next);
    },
    [controlled]
  );

  const context = useMemo(() => ({ triggerRef, setOpen }), [setOpen]);
  const [button, ...overlay] = Children.toArray(children);

  return (
    <MegaMenuTriggerContext.Provider value={context}>
      <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
        {button}
        <DropdownPortal>
          <PopoverPrimitive.Content
            ref={contentRef}
            // Radix sets the `dialog` role by default, but this is navigation: a `nav` inside a `div` with no role,
            // as in the APG Disclosure Navigation pattern.
            role={undefined}
            align="start"
            sideOffset={4}
            collisionPadding={8}
            className={DROPDOWN_CONTENT_CLASS}
            onOpenAutoFocus={(event) => {
              tabbedAway.current = false;
              // Focus goes to a category, not to the first focusable element (that would be the same category,
              // but only while the flyout is closed).
              event.preventDefault();
              const root = contentRef.current;
              (root && entryCategory(root))?.focus({ preventScroll: true });
            }}
            onCloseAutoFocus={(event) => {
              // Focus return is handled here: Radix does not return focus after a click on the button itself
              // (it counts as an outside click), and we need it to.
              event.preventDefault();
              if (tabbedAway.current) {
                tabbedAway.current = false;
                return;
              }
              const active = document.activeElement;
              // Focus moved to another element (a click on a field): we do not take it back.
              if (!active || active === document.body || contentRef.current?.contains(active))
                triggerRef.current?.focus();
            }}
            onEscapeKeyDown={(event) => {
              // Escape in the flyout belongs to the flyout: return focus to the category and close the flyout
              // (the handler is in `MegaMenuCategory`). The overlay stays open. In a text field Escape goes to
              // the overlay: otherwise, in a flyout with search, it would close nothing.
              const target = event.target;
              if (
                target instanceof Element &&
                target.closest(SHOWCASE_SELECTOR) &&
                !isTextEntry(target)
              )
                event.preventDefault();
            }}
            onKeyDownCapture={(event) => {
              if (event.key !== "Tab") return;
              const stops = tabStops(event.currentTarget);
              const edge = event.shiftKey ? stops[0] : stops[stops.length - 1];
              if (!edge || event.target !== edge) return;
              // The overlay lives in a portal at the end of `body`, so "next by Tab" from it is not the next
              // element of the page. So focus first lands on the button, and the browser continues Tab from
              // there. For Shift+Tab the button is the previous stop, so we stay on it.
              triggerRef.current?.focus();
              if (event.shiftKey) event.preventDefault();
              else tabbedAway.current = true;
              setOpen(false);
            }}
            onClick={(event) => {
              // Following a link closes the mega menu: after navigation it must not hang over the new page. Router
              // links are `a` too, and their `preventDefault` does not block closing. A click with a modifier
              // (Cmd/Ctrl, Shift: a new tab or window) or with the middle button does not change the page: the
              // menu stays open, so that several sections can be opened in the background one after another.
              const modified =
                event.metaKey ||
                event.ctrlKey ||
                event.shiftKey ||
                event.altKey ||
                event.button !== 0;
              if (!modified && event.target instanceof Element && event.target.closest("a")) {
                setOpen(false);
              }
            }}
          >
            {overlay}
          </PopoverPrimitive.Content>
        </DropdownPortal>
      </PopoverPrimitive.Root>
    </MegaMenuTriggerContext.Provider>
  );
}

export interface MegaMenuButtonProps extends ButtonLookOptions {
  /** The button label. Not shown with `iconOnly`. */
  children?: ReactNode;
  /** Icon on the left. With `iconOnly` it is the only content. */
  icon?: ReactNode;
  /** The button is disabled: the mega menu does not open. */
  disabled?: boolean;
  /** Accessible name. Required when there is no label. */
  "aria-label"?: string;
  /** Classes for the button. */
  className?: string;
}

/**
 * The button that opens the mega menu: the first child of `MegaMenuTrigger`.
 *
 * Same look as `MenuButton` (`lib/button.ts`). The semantics are those of a disclosure button:
 * `aria-expanded` and `aria-controls`, without `aria-haspopup`. Radix sets `aria-haspopup="dialog"` by
 * default, but the overlay is not a dialog, it is navigation, and a screen reader must not promise a
 * dialog.
 */
export const MegaMenuButton = forwardRef<HTMLButtonElement, MegaMenuButtonProps>(
  function MegaMenuButton(
    { children, icon, disabled, variant, tone, size, iconOnly, selected, className, ...rest },
    forwardedRef
  ) {
    const trigger = useContext(MegaMenuTriggerContext);
    if (!trigger) throw new Error("MegaMenuButton must be rendered inside MegaMenuTrigger");
    return (
      <PopoverPrimitive.Trigger asChild>
        <button
          ref={(node) => {
            trigger.triggerRef.current = node;
            if (typeof forwardedRef === "function") forwardedRef(node);
            else if (forwardedRef) forwardedRef.current = node;
          }}
          type="button"
          disabled={disabled}
          aria-haspopup={undefined}
          className={cn(buttonClasses({ variant, tone, size, iconOnly, selected }), className)}
          onKeyDown={(event) => {
            // A click, Enter and Space open it by themselves (Radix); Arrow Down is a habit from dropdown lists.
            if (event.key !== "ArrowDown") return;
            event.preventDefault();
            trigger.setOpen(true);
          }}
          {...rest}
        >
          {icon}
          {children != null && !iconOnly ? <span>{children}</span> : null}
        </button>
      </PopoverPrimitive.Trigger>
    );
  }
);
