"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "../../lib/cn.js";
import { hasOpenAriaOverlay, OVERLAY_LAYER } from "../../lib/overlay-layer.js";
import { useOverlayLayer } from "../../hooks/useOverlayLayer.js";

export interface ModalOverlayProps {
  /** Called on a click on the scrim and on Escape. */
  onClose: () => void;
  /** z-index class: the application has several overlay layers. */
  zIndex?: string;
  /** Vertical alignment of the content. */
  align?: "center" | "start";
  /** Scrim color; defaults to `--overlay-scrim`. */
  backdrop?: string;
  /** Blur radius of the scrim. */
  blur?: string;
  /** Whether to close on Escape. */
  escape?: boolean;
  /** Classes for the content wrapper. */
  className?: string;
  /** Content on top of the scrim — the dialog itself. */
  children?: ReactNode;
}

/**
 * A dimmed scrim under a modal dialog.
 *
 * WHAT IS NOT HERE AND WHY. This is not a dialog, only a scrim: no `role="dialog"`, no
 * `aria-modal`, no focus trap, no scroll lock. A real dialog needs an accessible name, and only
 * the caller knows the name — adding `role="dialog"` without one would make things worse than
 * having no role at all: the screen reader would announce an unnamed dialog. The focus trap and
 * the scroll lock live in the front app as separate hooks (`useScrollLock`), and bringing them
 * in here would be a separate decision, not a side effect of the move.
 *
 * So the primitive honestly does one thing: it dims the background, catches Escape and clicks outside.
 *
 * THERE IS NO EXIT ANIMATION HERE, and this is not an omission. Wave 29 gave an exit to all of the
 * kit's overlays except this one: `ModalOverlay` has no `open` prop — the consumer mounts it with a
 * condition (`{isOpen && <ModalOverlay>}`), and by the time it closes the node is already out of the
 * tree. There is nothing to animate: the element has to leave, and it is gone before the close is known.
 *
 * The only way to give it an exit is to accept `open` and keep the node alive itself while the
 * animation runs, as Radix and react-aria do. That is a change of contract that breaks existing
 * calls, so it is a separate decision, not a side effect of the motion wave.
 */
export function ModalOverlay({
  onClose,
  zIndex = OVERLAY_LAYER.modal,
  align = "center",
  backdrop = "var(--overlay-scrim)",
  blur = "4px",
  escape = true,
  className,
  children,
}: ModalOverlayProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const layer = useOverlayLayer(true, rootRef);

  useEffect(() => {
    if (!escape) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;

      /*
        ONLY the top layer responds, and only if no foreign handler has claimed the event.

        The listener sat on `document` in the bubble phase and reacted to any Escape: two nested
        scrims collapsed on a single press, and a `Select` or `Popover` inside the scrim closed together
        with it, whole. By then Radix had already handled the event in the CAPTURE phase and called
        `preventDefault()` — the scrim ignored that. Analysis: ADR-0041.
      */
      if (e.defaultPrevented) return;
      if (hasOpenAriaOverlay()) return;
      if (!layer.isTopmost()) return;
      onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [escape, onClose]);

  return (
    <div
      ref={rootRef}
      onClick={onClose}
      className={cn(
        "animate-fadein fixed inset-0 flex justify-center overflow-auto p-6",
        zIndex,
        align === "start" ? "items-start" : "items-center"
      )}
      style={{ background: backdrop, backdropFilter: `blur(${blur})` }}
    >
      <div
        // A click on the content must not close the dialog — propagation is stopped here,
        // not by a check `e.target === e.currentTarget` outside.
        onClick={(e) => e.stopPropagation()}
        className={cn("animate-sheetin", className)}
      >
        {children}
      </div>
    </div>
  );
}
