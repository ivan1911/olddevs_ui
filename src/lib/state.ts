import type { Size } from "./variants.js";

/**
 * Layout of the screen state: empty and error.
 *
 * Extracted from `EmptyState` when `ErrorState` appeared. The two share one geometry:
 * vertical centering, icon, title, description and an action slot. They differ in
 * tone and in their role in the accessibility tree. A copy of this table would drift
 * apart. The consumer's frontend already went through that with search fields, and that
 * is why `SearchControl` was created.
 *
 * The class strings are literal and complete: Tailwind scans the sources as text.
 */
export type StateSize = Extract<Size, "sm" | "md">;

export const STATE_ROOT = "flex flex-col items-center justify-center text-center";
export const STATE_ICON = "flex";
export const STATE_TITLE = "font-semibold";
export const STATE_DESCRIPTION = "max-w-[360px]";

export const STATE_LAYOUT: Record<
  StateSize,
  { root: string; icon: string; title: string; description: string; action: string }
> = {
  sm: {
    root: "gap-1 px-3 py-4",
    icon: "mb-0.5",
    title: "text-[13px]",
    description: "text-xs",
    action: "mt-1.5",
  },
  md: {
    root: "gap-1.5 px-4 py-10",
    icon: "mb-1",
    title: "text-md",
    description: "text-[13px]",
    action: "mt-3",
  },
};
