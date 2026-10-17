"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useRef, type ReactNode } from "react";
import { cn } from "../../lib/cn.js";
import { useOpenerFocus } from "../../hooks/useOpenerFocus.js";
import { hasOpenAriaOverlay, OVERLAY_LAYER } from "../../lib/overlay-layer.js";
import { useOverlayLayer } from "../../hooks/useOverlayLayer.js";
import { withoutToolbarAxis } from "../../lib/toolbar-axis.js";
import { ModalHeader } from "./ModalHeader.js";

export type DrawerSide = "right" | "left" | "bottom";

/** Portal of the drawer: the `Toolbar` axis the drawer was opened from does not pass into it. */
const Portal = withoutToolbarAxis(DialogPrimitive.Portal);

export interface DrawerProps {
  /** Whether the drawer is shown. */
  open: boolean;
  /** Close: the close button, Escape and a click outside all call this. */
  onClose: () => void;
  /** Title. It is also the drawer's accessible name. */
  title: ReactNode;
  /** A line under the title in the header: a slug, a date, a counter. */
  subtitle?: ReactNode;
  /** The edge the drawer slides in from: `right`, `left` or `bottom`. Defaults to `right`; on a narrow screen a side drawer becomes a bottom one. */
  side?: DrawerSide;
  /** Width for side drawers, height for the bottom one. */
  size?: "sm" | "md" | "lg";
  /** Footer: action buttons. Pinned to the bottom and does not scroll away. */
  footer?: ReactNode;
  /** Accessible name of the close button. When not set, "Close" comes from the message catalog. */
  closeLabel?: string;
  /** Classes for the drawer panel itself, for example its own width. */
  className?: string;
  /**
   * Overlay layer of the drawer. Application-specific overlays sit above the usual ones.
   *
   * The prop is the same as on `Dialog`, with the same default: both are built on one
   * Radix primitive and both must be able to stack above someone else's overlay. Until
   * it existed here, a consumer with its own layer above `z-90` got the drawer BELOW its
   * own dialog, and the scrim could not be raised at all: it took `z-90` from a hard-coded class.
   */
  zIndex?: string;
  /** Drawer content between the header and the footer; scrolls inside. */
  children?: ReactNode;
}

const SIDE_CLASS: Record<DrawerSide, string> = {
  right: "inset-y-0 right-0 h-full border-l",
  left: "inset-y-0 left-0 h-full border-r",
  bottom: "inset-x-0 bottom-0 w-full rounded-t-lg border-t",
};

const SIZE_CLASS: Record<DrawerSide, Record<"sm" | "md" | "lg", string>> = {
  right: { sm: "w-[320px]", md: "w-[420px]", lg: "w-[560px]" },
  left: { sm: "w-[320px]", md: "w-[420px]", lg: "w-[560px]" },
  bottom: { sm: "h-[40vh]", md: "h-[60vh]", lg: "h-[85vh]" },
};

/**
 * A sliding panel: the same job as `Dialog`, different geometry.
 *
 * BUILT ON THE SAME `@radix-ui/react-dialog` rather than adding a dependency. A drawer is a
 * modal layer: the focus trap, focus return, `aria-modal`, the portal, Escape through the
 * overlay layer stack and the scroll lock are needed here exactly as they are for a dialog.
 * It differs only in the edge it slides in from.
 *
 * For the same reason `useScrollLock` is NOT called here: the lock lives inside Radix
 * (`react-remove-scroll`), and a second counter on the same `body` would not see the first.
 *
 * **On a narrow screen a side drawer becomes a bottom one.** A 420-pixel panel on a
 * 360-pixel screen is not a "narrow panel" but a window pushed past the edge: the user
 * sees clipped content and cannot scroll it sideways. The switch is done with classes
 * (`max-sm:`), not by measuring the width in JS: a measurement jumps after the first frame,
 * and the panel visibly jumps with it.
 */
export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  side = "right",
  size = "md",
  footer,
  closeLabel,
  className,
  zIndex = OVERLAY_LAYER.modal,
  children,
}: DrawerProps) {
  /*
   * Focus goes back to whoever opened the drawer when it closes.
   *
   * Radix does not do this itself when opening is controlled from outside (`open` without a
   * `Dialog.Trigger`): it has nowhere to return focus, so focus falls to `body`. A keyboard
   * user ends up at the top of the page after closing.
   *
   * The same pairing is in `Dialog`; the drawer simply forgot about it.
   */
  const contentRef = useRef<HTMLDivElement | null>(null);
  const { remember, restore } = useOpenerFocus(open, contentRef);
  // The layer joins the shared stack: ADR-0041 promises this for ALL modal layers of the kit,
  // not only for the scrim.
  useOverlayLayer(open, contentRef);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Portal>
        {/*
          THE PANEL LIVES INSIDE THE SCRIM, NOT NEXT TO IT. It looks the same, but this is not
          cosmetic: scrolling inside the drawer depends on it.

          Radix puts the scroll lock (`react-remove-scroll`) on the OVERLAY, not on the content:
          `shards: [contentRef]` in `DialogOverlayImpl`. While the panel was a SIBLING of the
          scrim it sat outside the lock's subtree, and any popover opened from inside the drawer
          lost the mouse wheel. The event never reached the check "may this scroll here": the
          lock swallowed it unconditionally in the "target outside the shards" branch.

          This shows up late: a `Select` panel with three items fits its height and there is
          nothing to scroll. The defect surfaced on a list of eleven in a consumer product.

          Nesting fixes it the same way `Dialog` in the kit has worked from the start: the drawer's
          content falls into the React subtree of the lock, and a portaled panel inherits it through
          the React tree, not through the DOM. The geometry is untouched: the scrim is `fixed inset-0`,
          that is exactly the viewport, and the panel's `fixed` is computed from the same rectangle.
        */}
        <DialogPrimitive.Overlay
          className={cn("animate-fadein data-[state=closed]:animate-fadeout fixed inset-0", zIndex)}
          style={{ background: "var(--overlay-scrim)", backdropFilter: "blur(4px)" }}
        >
          <DialogPrimitive.Content
            ref={contentRef}
            /*
            A guard against a FOREIGN Escape: the same as in `Dialog`; until wave 26 it was not here at all.

            Radix listens for `keydown` on `document` in the CAPTURE phase, so `stopPropagation`
            inside react-aria never reaches it, by design; and the RAC layer is not part of Radix's
            stack. One Escape with a menu open inside the drawer closed both the menu and the drawer,
            along with an unsaved form. Analysis: ADR-0041.
          */
            onEscapeKeyDown={(event) => {
              if (hasOpenAriaOverlay()) event.preventDefault();
            }}
            // Both checks, "not `body`" and "not the layer's own content", moved into
            // `useOpenerFocus` together with the rest of the pairing: a third copy was
            // the reason to extract it.
            onOpenAutoFocus={remember}
            onCloseAutoFocus={restore}
            className={cn(
              "bg-bg-1 border-line-soft fixed flex flex-col shadow-[var(--shadow-2)] outline-none",
              zIndex,
              SIDE_CLASS[side],
              SIZE_CLASS[side][size],
              // Narrow screen: a side drawer slides down to full width.
              side !== "bottom" &&
                "max-sm:inset-x-0 max-sm:top-auto max-sm:bottom-0 max-sm:h-[70vh] max-sm:w-full max-sm:rounded-t-lg max-sm:border-t max-sm:border-r-0 max-sm:border-l-0",
              className
            )}
          >
            {/*
            The title must be Radix's `Dialog.Title`, not its own `h2`: `aria-labelledby` is taken
            from it, and without it the drawer stays unnamed — the screen reader announces a dialog
            and then falls silent. The same pairing as in `Dialog`.
          */}
            <ModalHeader
              title={title}
              subtitle={subtitle}
              onClose={onClose}
              closeLabel={closeLabel}
              titleComponent={DialogPrimitive.Title}
              className="border-line-soft shrink-0 border-b px-4 py-3"
            />

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">{children}</div>

            {footer ? (
              <div className="border-line-soft flex shrink-0 items-center justify-end gap-2 border-t px-4 py-3">
                {footer}
              </div>
            ) : null}
          </DialogPrimitive.Content>
        </DialogPrimitive.Overlay>
      </Portal>
    </DialogPrimitive.Root>
  );
}
