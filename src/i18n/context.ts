"use client";

import { createContext } from "react";
import type { Density } from "../lib/variants.js";
import type { UiMessages } from "./messages.js";

export interface UiContextValue {
  /**
   * The locale set EXPLICITLY. `undefined` means "not set", and that is not the
   * same as `en-US`: without an explicit locale the kit does not override the
   * consumer, but takes the locale from react-aria's `I18nProvider` (that is, from
   * an outer provider or from the browser). See `useUiLocale`.
   */
  locale: string | undefined;
  messages: UiMessages;
  dir: "ltr" | "rtl";
  portalContainer: HTMLElement | null;
  /**
   * The default layout density. It is a **default**, not a mode: a table and its
   * gear override it, and the provider spares an app with five tables from five
   * identical props (ADR-0023).
   */
  density: Density;
}

/**
 * The context lives in its own module so that `UiProvider` and the hooks do not
 * import each other in a cycle: the provider imports the merge hook, and the hooks
 * import the context.
 */
export const UiContext = createContext<UiContextValue | null>(null);
