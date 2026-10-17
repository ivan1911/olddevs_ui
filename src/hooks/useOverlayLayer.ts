"use client";

import { useEffect, useRef, type RefObject } from "react";
import { pushOverlayLayer } from "../lib/overlay-layer.js";

/**
 * Registers a modal layer in the shared stack (ADR-0041).
 *
 * A hook rather than a direct call in each component, for two reasons.
 *
 * FIRST: lifecycle. Registration has to happen IN AN EFFECT. The stack is a module-level
 * singleton, so writing to it from the component body would be a side effect of render.
 * In StrictMode React mounts, unmounts and mounts again, and a layer added during render
 * and removed by the cleanup never got back in: the scrim stopped considering itself the
 * topmost layer and silently stopped closing on Escape. One correct lifecycle beats four
 * copies.
 *
 * SECOND: coverage. The ADR promises that ALL of the kit's modal layers are in the stack,
 * and the first version did not keep that promise. Only one `ModalOverlay` was registered,
 * so the stack arbitrated scrim against scrim and nothing else.
 */
export function useOverlayLayer(
  open: boolean,
  /** The layer's node. Its position in the document decides which layer is the topmost. */
  nodeRef: RefObject<HTMLElement | null>
): { isTopmost: () => boolean } {
  const layerRef = useRef<ReturnType<typeof pushOverlayLayer> | null>(null);

  useEffect(() => {
    if (!open) return;
    const layer = pushOverlayLayer();
    layer.attach(nodeRef.current);
    layerRef.current = layer;
    return () => {
      layer.release();
      layerRef.current = null;
    };
  }, [open, nodeRef]);

  // An unregistered layer does not count itself as the topmost: it is closed.
  return { isTopmost: () => layerRef.current?.isTopmost() ?? false };
}
