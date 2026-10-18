"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useCallback, useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { useOverlayLayer } from "../../../hooks/useOverlayLayer.js";
import { useScrollLock } from "../../../hooks/useScrollLock.js";
import { cn } from "../../../lib/cn.js";
import { hideOthers } from "../../../lib/hide-others.js";
import { hasOpenAriaOverlay, OVERLAY_LAYER } from "../../../lib/overlay-layer.js";
import { withoutToolbarAxis } from "../../../lib/toolbar-axis.js";

/** The layer's portal: the `Toolbar` axis the field sits in does not pass into it, as for `Dialog`. */
const Portal = withoutToolbarAxis(DialogPrimitive.Portal);

/** The longest an exit may take, whatever the browser reports: a missed `animationend` must not strand the layer. */
const EXIT_LIMIT_MS = 400;

export interface FullscreenLayerProps {
  /** The layer's accessible name (the Editor's "Fullscreen"). */
  title: string;
  /** The exit animation is running: the layer stays mounted until `onExited`. */
  closing: boolean;
  /** `Esc` was pressed on the layer and nothing above it took the key. */
  onClose: () => void;
  /** The exit animation has ended, or there is none. */
  onExited: () => void;
  /** Called when the layer has mounted: move focus into the Document. `false` means it did not (read-only), and the layer takes focus itself. */
  onOpened: () => boolean;
  /** The field itself. */
  children: ReactNode;
}

/**
 * The Editor's fullscreen layer (ADR-0082): a node of the kit over the whole window, above the page
 * and above a `Dialog` or a `Drawer` the field may sit in. Not the browser's Fullscreen API: that has
 * no support for elements on iPhone, the Editor's popovers live in a portal and would not be shown
 * in a fullscreen element, and the browser takes `Escape`.
 *
 * The device is Radix's NON-MODAL dialog, which the kit already depends on, and it is there for one
 * reason: in a modal `Dialog`, Radix's focus trap pulls focus back from anything outside its content,
 * and only a Radix focus scope pauses it. The layer is a React descendant of the host window, so a click
 * in it is not "outside" for the host either. Radix also owns `Escape` by layers: the layer is the top
 * one, so the first `Esc` collapses the field and the next closes the `Dialog`.
 *
 * What Radix does not do for a non-modal layer the kit does: `useScrollLock` locks the page (the
 * layer is not a `Dialog`, so the counter is the kit's own), `useOverlayLayer` puts the layer in the
 * stack of ADR-0041, and `OVERLAY_LAYER.alert` puts it above the host window (`modal`) and below the
 * popovers (`popover`), which the Editor opens from inside it.
 *
 * `Esc` goes through `blockSelection` first: that Tool takes the first key of every press in the text
 * through a capture listener on the window, before Radix's listener on the document.
 */
export function FullscreenLayer({
  title,
  closing,
  onClose,
  onExited,
  onOpened,
  children,
}: FullscreenLayerProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const restoreRef = useRef<(() => void) | null>(null);
  /*
    The layer says `aria-modal`, so the page behind it must be hidden from assistive technology for
    real (`hide-others.ts`). The node arrives after the portal has mounted, hence the callback ref; the
    background comes back when the exit starts, not when the fade ends: the field is already leaving.
  */
  const attach = useCallback((node: HTMLDivElement | null) => {
    ref.current = node;
    restoreRef.current?.();
    restoreRef.current = node ? hideOthers(node) : null;
  }, []);
  useEffect(() => {
    if (closing) {
      restoreRef.current?.();
      restoreRef.current = null;
    } else if (!restoreRef.current && ref.current) {
      // The exit was cancelled by a new `open()`: the page goes behind the layer again.
      restoreRef.current = hideOthers(ref.current);
    }
  }, [closing]);
  useScrollLock(true);
  useOverlayLayer(true, ref);

  const exitedRef = useRef(onExited);
  exitedRef.current = onExited;
  useLayoutEffect(() => {
    if (!closing) return;
    // No animation (reduced to nothing, or a document without the stylesheet): leave at once, as Radix's presence does.
    const name = ref.current ? getComputedStyle(ref.current).animationName : "none";
    if (!name || name === "none") return exitedRef.current();
    const timer = setTimeout(() => exitedRef.current(), EXIT_LIMIT_MS);
    return () => clearTimeout(timer);
  }, [closing]);

  return (
    <DialogPrimitive.Root open modal={false} onOpenChange={(open) => !open && onClose()}>
      <Portal>
        <DialogPrimitive.Content
          ref={attach}
          aria-modal="true"
          aria-describedby={undefined}
          data-closing={closing || undefined}
          // Focus goes to the Document (the field's own wiring), and back to it on exit.
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            if (!onOpened()) ref.current?.focus();
          }}
          onCloseAutoFocus={(event) => event.preventDefault()}
          // Nothing lies outside a layer over the whole window; a click on a popover is inside by the React tree.
          onInteractOutside={(event) => event.preventDefault()}
          onEscapeKeyDown={(event) => {
            // A react-aria menu inside the layer owns `Esc` first, as it does in a `Dialog`.
            if (closing || hasOpenAriaOverlay()) event.preventDefault();
          }}
          className={cn(
            "pointer-events-auto fixed inset-0 flex h-dvh flex-col outline-none",
            OVERLAY_LAYER.alert,
            "bg-bg-0 animate-fadein data-[closing]:animate-fadeout"
          )}
          onAnimationEnd={(event) => {
            if (closing && event.target === event.currentTarget) onExited();
          }}
        >
          <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
          {children}
        </DialogPrimitive.Content>
      </Portal>
    </DialogPrimitive.Root>
  );
}
