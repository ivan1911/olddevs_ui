"use client";

import { useContext } from "react";
import { useLocale } from "react-aria-components";
import type { Density } from "../lib/variants.js";
import { UiContext } from "./context.js";
import { DEFAULT_MESSAGES } from "./defaults.js";
import type { UiMessages } from "./messages.js";

/**
 * The message catalog. No provider: the English fallback.
 *
 * The hook deliberately takes no key and does not slice the catalog by namespace:
 * a component reads `messages.pagination.next`, and that is visible in its code.
 * A hook such as `useMessage("pagination.next")` would hide the key inside a string,
 * where neither the compiler nor a repository search would see it.
 */
export function useMessages(): UiMessages {
  return useContext(UiContext)?.messages ?? DEFAULT_MESSAGES;
}

/**
 * The locale for `Intl` and `@internationalized/date`.
 *
 * Order: the explicit locale of `UiProvider` → the consumer's `I18nProvider` locale →
 * the browser locale. The last two come from react-aria's `useLocale`, so the kit does
 * not fight the app but fits into it.
 */
export function useUiLocale(): string {
  const explicit = useContext(UiContext)?.locale;
  const { locale } = useLocale();
  return explicit ?? locale;
}

/** Writing direction, portal container and density, as declared by the provider. */
export function useUiConfig(): {
  dir: "ltr" | "rtl";
  portalContainer: HTMLElement | null;
  density: Density;
} {
  const ctx = useContext(UiContext);
  return {
    dir: ctx?.dir ?? "ltr",
    portalContainer: ctx?.portalContainer ?? null,
    density: ctx?.density ?? "comfortable",
  };
}
