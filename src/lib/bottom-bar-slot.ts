"use client";

import { createContext } from "react";

/**
 * Whether the node sits in the `bottomBar` slot of `AppShell`.
 *
 * `MobileTabBar` needs it: its backdrop extends below the bar by the height of the screen cutout,
 * because the padding for the cutout is given by the slot's wrapper. A backdrop cut off at the bar
 * itself would leave a transparent gap beneath it. Outside the slot nobody adds that padding, and the
 * same backdrop would cover the content under the bar by the height of the cutout. So the bar has to
 * know where it stands.
 *
 * CONTEXT, NOT CSS. A variable or attribute on the slot's wrapper would solve the same thing through
 * the cascade, but the difference would become invisible in the markup: jsdom does not evaluate the
 * cascade, so the promise "outside the frame, it is an ordinary row" would have nothing to check it
 * with. Context changes the markup itself, is correct from the first frame and on the server (no media
 * query needed), and does not leak beyond the slot's subtree: a bar placed in the `<main>` of the same
 * frame stays "outside the slot". Caveat: React context passes through portals, so a bar inside an
 * overlay opened from the bar itself would also consider itself "in the slot". The bar has no such
 * scenario. If one appears, the boundary goes on the portal, as with `withoutToolbarAxis`. The same
 * technique is used by `NavInOverlayProvider`, with which `AppShell` tells `SideNav` that it is inside
 * a drawer.
 *
 * `@internal`: not exported from the package.
 */
export const BottomBarSlotContext = createContext(false);
