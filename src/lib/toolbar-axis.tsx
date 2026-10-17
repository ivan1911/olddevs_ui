"use client";

import type { ComponentType } from "react";
import { SeparatorContext, ToggleButtonGroupContext } from "react-aria-components";

/**
 * An overlay portal that the `Toolbar` axis does not pass through.
 *
 * `Toolbar` passes the axis down through react-aria contexts (`SeparatorContext`,
 * `ToggleButtonGroupContext`), and React context travels through portals: a popover
 * or a dialog opened from a toolbar sits outside it in the DOM but inside it in the
 * React tree. Without a boundary, a `ToggleGroup` in a popover opened from a vertical
 * toolbar would lay out as a column and switch its arrow keys to vertical, and a
 * `Separator` in a dialog opened from a horizontal toolbar would turn into a vertical
 * line. react-aria's `Menu` clears `SeparatorContext` on its own; the kit's overlays
 * do the same for both contexts.
 *
 * The boundary goes OUTSIDE the portal, not inside it: Radix clones the portal's child
 * with a `ref` (`Presence`, `asChild`), and a wrapper at that spot would swallow the ref.
 */
export function withoutToolbarAxis<P extends object>(Portal: ComponentType<P>) {
  function AxisBoundaryPortal(props: P) {
    return (
      <ToggleButtonGroupContext.Provider value={null}>
        <SeparatorContext.Provider value={null}>
          <Portal {...props} />
        </SeparatorContext.Provider>
      </ToggleButtonGroupContext.Provider>
    );
  }
  return AxisBoundaryPortal;
}
