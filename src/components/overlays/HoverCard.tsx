"use client";

import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type MutableRefObject,
  type PointerEvent,
  type ReactNode,
} from "react";
import {
  getInteractionModality,
  trackInteractionModality,
} from "../../lib/interaction-modality.js";
import { Popover, PopoverAnchor, PopoverContent, type PopoverContentProps } from "./Popover.js";

/**
 * A preview card: details about whatever the pointer hovers or focus lands on.
 *
 * Built on the kit's `Popover`, not on `@radix-ui/react-hover-card`: a new dependency for
 * a hundred lines of timers costs more than it gives (the owner's decision; ADR-0048 forbids
 * a component from costing the consumer a dependency "for the future"). The layer, look,
 * animations and positioning are the same as in `PopoverContent`.
 *
 * The Radix popover is CONTROLLED here, and the trigger is a `PopoverAnchor`, not a
 * `PopoverTrigger`. A popover trigger toggles the panel on click and puts
 * `aria-haspopup="dialog"` with `aria-expanded` on the element. For a link that has its own
 * action this is a double lie: a click must follow the link, not open a panel, and the screen
 * reader must not promise a dialog. The anchor only gives the panel a point to attach to.
 */

const DEFAULT_OPEN_DELAY = 700;
const DEFAULT_CLOSE_DELAY = 300;

export interface HoverCardProps {
  /**
   * How many milliseconds the pointer or focus must stay on the trigger before the card opens.
   * It keeps the card from popping up on an accidental pass of the pointer.
   * The reference is Radix's `HoverCard`.
   */
  openDelay?: number;
  /**
   * How many milliseconds the card stays open after the pointer has left both the trigger and
   * the card. The pointer has time to move from one to the other in that interval.
   */
  closeDelay?: number;
  /** Controlled state. The component still computes the delays itself. */
  open?: boolean;
  /** Whether the card starts open, when the component manages the state itself. Closed by default. */
  defaultOpen?: boolean;
  /**
   * Called when the card asks to open or close: by the hover and focus timers, by Escape,
   * by a click and by focus outside the card.
   */
  onOpenChange?: (open: boolean) => void;
  /** The card's parts: `HoverCardTrigger` and `HoverCardContent`. */
  children: ReactNode;
}

interface HoverCardContextValue {
  open: boolean;
  onTriggerEnter: (event: PointerEvent) => void;
  onTriggerLeave: (event: PointerEvent) => void;
  onTriggerFocus: () => void;
  onTriggerBlur: () => void;
  onContentEnter: (event: PointerEvent) => void;
  onContentLeave: (event: PointerEvent) => void;
  onContentFocus: () => void;
  onContentBlur: () => void;
  /** The trigger node: the panel needs it to tell focus on the trigger apart from focus "outside". */
  triggerRef: MutableRefObject<HTMLElement | null>;
}

const HoverCardContext = createContext<HoverCardContextValue | null>(null);

function useHoverCardContext(part: string): HoverCardContextValue {
  const context = useContext(HoverCardContext);
  if (!context) throw new Error(`${part} must be used within HoverCard`);
  return context;
}

/**
 * A device without hover: the primary pointer is a finger. It forbids opening on HOVER;
 * keyboard focus does not cancel that — a tablet may have a hardware keyboard, and Tab on a
 * link must open the card just as it does on a computer. A tap on a link is a press, not a
 * key, so the card still does not open from it.
 *
 * The media query is deliberately read from JS here, unlike layouts (ADR-0018): the card
 * appears only after an interaction anyway, there is nothing to wait for during hydration,
 * and CSS cannot drive timers. The check runs at the moment an open is requested, not through
 * a subscription: the user may connect a mouse to a tablet between two hovers.
 */
function hoverUnavailable(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(hover: none)").matches;
}

export function HoverCard({
  openDelay = DEFAULT_OPEN_DELAY,
  closeDelay = DEFAULT_CLOSE_DELAY,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  children,
}: HoverCardProps) {
  const [innerOpen, setInnerOpen] = useState(defaultOpen);
  // The input-modality listeners must be in place before the first focus on the trigger: an event
  // that has already passed cannot be read after the fact. They are attached lazily, once.
  useEffect(trackInteractionModality, []);
  const controlled = openProp !== undefined;
  const open = controlled ? openProp : innerOpen;

  // Timers fire after the render and must see current values, not the ones captured when they
  // were set. The refs are updated after the commit.
  const latest = useRef({ open, controlled, openDelay, closeDelay, onOpenChange });
  useEffect(() => {
    latest.current = { open, controlled, openDelay, closeDelay, onOpenChange };
  });

  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Who is currently "holding" the card: the pointer on the trigger, the pointer on the card,
  // focus on either. A close is requested when nobody holds it.
  const holds = useRef({ triggerHover: false, contentHover: false, focus: false });
  const triggerRef = useRef<HTMLElement | null>(null);

  /*
    A closed card holds nothing.

    It can be closed while the pointer lies on the panel or focus sits in it — by Escape or
    from a controlled parent. The panel's node then leaves the document, and React sends neither
    `pointerleave` nor `blur` any more: the flag would stay raised, and on the next hover
    `requestClose` would see "held" and never close the card. Escape with focus on the trigger
    leaves the same trace: the focus stayed, and so did the flag.
  */
  useEffect(() => {
    if (open) return;
    holds.current = { triggerHover: false, contentHover: false, focus: false };
  }, [open]);

  const clearOpenTimer = useCallback(() => {
    if (openTimer.current !== null) clearTimeout(openTimer.current);
    openTimer.current = null;
  }, []);
  const clearCloseTimer = useCallback(() => {
    if (closeTimer.current !== null) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  }, []);

  const change = useCallback((next: boolean) => {
    const current = latest.current;
    if (current.open === next) return;
    if (!current.controlled) setInnerOpen(next);
    current.onOpenChange?.(next);
  }, []);

  const requestOpen = useCallback(
    (source: "hover" | "focus") => {
      clearCloseTimer();
      // The `(hover: none)` ban applies only to hover. Focus reaches here already filtered by modality
      // (keyboard only), so on a tablet with a keyboard Tab opens the card, while a tap and a screen
      // reader do not.
      if (source === "hover" && hoverUnavailable()) return;
      if (latest.current.open || openTimer.current !== null) return;
      openTimer.current = setTimeout(() => {
        openTimer.current = null;
        change(true);
      }, latest.current.openDelay);
    },
    [change, clearCloseTimer]
  );

  const requestClose = useCallback(() => {
    const { triggerHover, contentHover, focus } = holds.current;
    if (triggerHover || contentHover || focus) return;
    clearOpenTimer();
    clearCloseTimer();
    if (!latest.current.open) return;
    closeTimer.current = setTimeout(() => {
      closeTimer.current = null;
      change(false);
    }, latest.current.closeDelay);
  }, [change, clearCloseTimer, clearOpenTimer]);

  // Unmounting with a pending timer must not call `onOpenChange` or touch the state of an
  // already removed component.
  useEffect(() => {
    return () => {
      clearOpenTimer();
      clearCloseTimer();
    };
  }, [clearOpenTimer, clearCloseTimer]);

  /*
    Radix asks to close on its own: Escape, a click outside the card, focus moved to another
    element. This close is immediate and overrides any timers. Escape takes the same path as in
    `Popover` and `Tooltip`: Radix listens for it, not a separate handler here (ADR-0041: the
    kit's overlay layer stack does not wrap Radix; it resolves the seam between the two libraries).
  */
  const handleRadixOpenChange = useCallback(
    (next: boolean) => {
      clearOpenTimer();
      clearCloseTimer();
      change(next);
    },
    [change, clearCloseTimer, clearOpenTimer]
  );

  const value = useMemo<HoverCardContextValue>(
    () => ({
      open,
      onTriggerEnter: (event) => {
        // A touch is not a hover: browsers send `pointerenter` for a finger too.
        if (event.pointerType === "touch") return;
        holds.current.triggerHover = true;
        requestOpen("hover");
      },
      onTriggerLeave: (event) => {
        if (event.pointerType === "touch") return;
        holds.current.triggerHover = false;
        requestClose();
      },
      onTriggerFocus: () => {
        /*
          Only focus from the keyboard opens the card. A mouse or finger press is an action that
          has already happened, and a card on top of it would flicker. Focus with neither a key nor
          a pointer came from a screen reader (swipe, virtual cursor): it must not pop up content
          without an announcement, and with a screen magnifier it must not close the neighboring text.
          By contract, the card's content is supplementary and reachable in another way.
          `:focus-visible` does not fit here: it is also true for screen-reader focus.
        */
        if (getInteractionModality() !== "keyboard") return;
        holds.current.focus = true;
        requestOpen("focus");
      },
      onTriggerBlur: () => {
        holds.current.focus = false;
        requestClose();
      },
      onContentEnter: (event) => {
        if (event.pointerType === "touch") return;
        holds.current.contentHover = true;
        // The pointer reached the card — the scheduled close is cancelled.
        clearCloseTimer();
      },
      onContentLeave: (event) => {
        if (event.pointerType === "touch") return;
        holds.current.contentHover = false;
        requestClose();
      },
      onContentFocus: () => {
        holds.current.focus = true;
        clearCloseTimer();
      },
      onContentBlur: () => {
        holds.current.focus = false;
        requestClose();
      },
      triggerRef,
    }),
    [open, requestOpen, requestClose, clearCloseTimer]
  );

  return (
    <HoverCardContext.Provider value={value}>
      <Popover open={open} onOpenChange={handleRadixOpenChange}>
        {children}
      </Popover>
    </HoverCardContext.Provider>
  );
}

/**
 * The four handlers belong to the card: the consumer's own handlers on the trigger are kept
 * on the child (`asChild`), while here they would overwrite the timers.
 */
type RadixAnchorProps = Omit<
  ComponentPropsWithoutRef<typeof PopoverAnchor>,
  "onPointerEnter" | "onPointerLeave" | "onFocus" | "onBlur"
>;

export interface HoverCardTriggerProps extends RadixAnchorProps {
  /** Hand the trigger role to your element instead of the built-in `div`: props and `ref` are merged with its own. Defaults to `true` here — the trigger must be a link or a button. */
  asChild?: RadixAnchorProps["asChild"];
  /** An element or an object with `getBoundingClientRect` next to which the card opens instead of the trigger itself. */
  virtualRef?: RadixAnchorProps["virtualRef"];
}

/**
 * The card trigger (`asChild` is on by default: a `div` wrapper with no role and no focus would
 * be a trigger that cannot be reached from the keyboard). It listens for hover and focus and
 * toggles nothing on click.
 *
 * The child must be interactive (a link, a button) and accept `ref` and event handlers: its own
 * handlers are kept.
 */
export const HoverCardTrigger = forwardRef<HTMLDivElement, HoverCardTriggerProps>(
  function HoverCardTrigger({ asChild = true, ...rest }, ref) {
    const context = useHoverCardContext("HoverCardTrigger");
    return (
      <PopoverAnchor
        ref={(node) => {
          context.triggerRef.current = node;
          if (typeof ref === "function") ref(node);
          else if (ref) ref.current = node;
        }}
        asChild={asChild}
        data-state={context.open ? "open" : "closed"}
        onPointerEnter={context.onTriggerEnter}
        onPointerLeave={context.onTriggerLeave}
        onFocus={context.onTriggerFocus}
        onBlur={context.onTriggerBlur}
        {...rest}
      />
    );
  }
);

export type HoverCardContentProps = PopoverContentProps;

/**
 * The card panel. Look, layer and animations are those of `PopoverContent`.
 *
 * Differences from a popover. All of them share one point: the card complements its trigger
 * rather than taking control.
 * - Focus stays where it is on open (`onOpenAutoFocus` is cancelled), and on close it does not
 *   return to the trigger — a close by the pointer must not move focus; on Escape it is already
 *   on the trigger.
 * - There is no `dialog` role: a dialog without a focus move is a promise the panel does not
 *   keep, and an unnamed `role="dialog"` also violates axe.
 * - The pointer on the panel keeps it open.
 */
export const HoverCardContent = forwardRef<HTMLDivElement, HoverCardContentProps>(
  function HoverCardContent(
    {
      className,
      onPointerEnter,
      onPointerLeave,
      onFocus,
      onBlur,
      onOpenAutoFocus,
      onCloseAutoFocus,
      onFocusOutside,
      ...rest
    },
    ref
  ) {
    const context = useHoverCardContext("HoverCardContent");
    return (
      <PopoverContent
        ref={ref}
        role={undefined}
        className={className}
        onOpenAutoFocus={(event) => {
          onOpenAutoFocus?.(event);
          event.preventDefault();
        }}
        onCloseAutoFocus={(event) => {
          onCloseAutoFocus?.(event);
          event.preventDefault();
        }}
        onFocusOutside={(event) => {
          onFocusOutside?.(event);
          /*
            Focus on the trigger itself is not "outside". The Radix anchor, unlike `PopoverTrigger`,
            is not counted as a trigger, and without this a Tab onto the link, with the card already
            open (from the pointer), closed it; then the focus timer opened it again — the card flickered.
          */
          if (context.triggerRef.current?.contains(event.target as Node)) event.preventDefault();
        }}
        onPointerEnter={(event) => {
          onPointerEnter?.(event);
          context.onContentEnter(event);
        }}
        onPointerLeave={(event) => {
          onPointerLeave?.(event);
          context.onContentLeave(event);
        }}
        onFocus={(event) => {
          onFocus?.(event);
          context.onContentFocus();
        }}
        onBlur={(event) => {
          onBlur?.(event);
          context.onContentBlur();
        }}
        {...rest}
      />
    );
  }
);
