"use client";

import { useContext, useMemo, useRef, type ReactNode } from "react";
import { I18nProvider } from "react-aria-components";
import { UiContext, type UiContextValue } from "./context.js";
import { DEFAULT_MESSAGES } from "./defaults.js";
import type { Density } from "../lib/variants.js";
import type { PartialUiMessages, UiMessages } from "./messages.js";

export interface UiProviderProps {
  /**
   * The formatting locale: dates, numbers, plural rules. If not set, the kit does
   * not impose its own: the value is taken from react-aria's `I18nProvider`, that is,
   * from the consumer's outer provider or from the browser.
   *
   * Strings do NOT depend on the locale: they come from `messages`. The split is
   * deliberate: a locale catalog is pulled in by import, otherwise it would land in
   * the bundle of everyone, including those who need only English.
   */
  locale?: string;
  /**
   * The message catalog, whole or partial. Namespaces that are not supplied are taken
   * from the English fallback, so `messages={{ common: { close: "Dismiss" } }}` is a
   * legitimate call.
   */
  messages?: PartialUiMessages;
  /** Writing direction. The kit publishes it; there is no component-level RTL support. */
  dir?: "ltr" | "rtl";
  /** Where to render overlay portals. Defaults to `document.body`. */
  portalContainer?: HTMLElement | null;
  /**
   * The default layout density for the whole app.
   *
   * A default, not a mode: a table and its gear override the value. The field
   * appeared in 2.2.0 — ADR-0002 deferred it until a component needed it, and
   * `DataTable` was the first to need it.
   */
  density?: Density;
  children: ReactNode;
}

/** Two-level merge: namespace → key. The merge does not go deeper. */
function mergeMessages(base: UiMessages, patch: PartialUiMessages | undefined): UiMessages {
  if (!patch) return base;
  const out = { ...base } as Record<string, unknown>;
  for (const [ns, values] of Object.entries(patch)) {
    if (!values) continue;
    /*
      A key whose value is `undefined` is SKIPPED, not overwriting the fallback.

      The spread copies such keys too, and `exactOptionalPropertyTypes` in
      `tsconfig.json` is off, so the compiler stays silent. The real call shape is
      `messages={{ common: { close: dict[key] }}}`, where the key is missing from the
      consumer's dictionary: the close button silently kept no accessible name.
    */
    const defined: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(values)) {
      if (value !== undefined) defined[key] = value;
    }
    out[ns] = { ...(base[ns as keyof UiMessages] as object), ...defined };
  }
  return out as unknown as UiMessages;
}

/**
 * Whether two partial catalogs match BY CONTENT.
 *
 * Needed so that a literal written in place is not treated as a new catalog on every
 * render. The depth is the same as the merge's: two levels, the merge does not go deeper.
 */
function sameMessages(a: PartialUiMessages | undefined, b: PartialUiMessages | undefined): boolean {
  if (a === b) return true;
  if (!a || !b) return false;

  const names = Object.keys(a);
  if (names.length !== Object.keys(b).length) return false;

  for (const ns of names) {
    const left = a[ns as keyof PartialUiMessages] as Record<string, unknown> | undefined;
    const right = b[ns as keyof PartialUiMessages] as Record<string, unknown> | undefined;
    if (left === right) continue;
    if (!left || !right) return false;

    const keys = Object.keys(left);
    if (keys.length !== Object.keys(right).length) return false;
    for (const key of keys) if (left[key] !== right[key]) return false;
  }
  return true;
}

/**
 * The kit's provider: locale, message catalog, writing direction and portal container.
 *
 * Resolution order for a string: `prop → provider message → fallback`. A component's
 * prop always wins: it is a targeted override, not the only way it was done before 2.0.0.
 *
 * NESTING WORKS. An inner provider inherits the locale and messages of the outer one
 * and overrides only what it sets itself. The case is not contrived: a dialog with its
 * own locale inside an app in another locale is an ordinary thing.
 *
 * react-aria's `I18nProvider` is wrapped ONLY when the locale is explicit. Otherwise the
 * kit would silently override the consumer's provider with its own `en-US`, and date
 * pickers would speak a different language from the rest of the app. See ADR-0002.
 */
export function UiProvider({
  locale,
  messages,
  dir,
  portalContainer,
  density,
  children,
}: UiProviderProps) {
  const parent = useContext(UiContext);

  /*
    The catalog is compared BY CONTENT, not by reference.

    The prop's doc allows a literal written in place, and that stays a legitimate
    call, but a literal produces a new object on every render. Keyed by reference in
    a `useMemo`, that meant a new context value, and so a re-render of EVERY kit
    component that reads `useMessages`: the whole tree sits under the provider, so any
    state tick at the root re-rendered the entire kit at once.

    The cache lives in a ref, not in another `useMemo`: a `useMemo` would compare its
    dependencies by reference too, so it would not help. The assignment is idempotent
    and changes nothing outside.

    A LIMIT TO KNOW ABOUT: the comparison is shallow, and a message function declared
    right in the literal (`{ rating: { star: () => … } }`) is new on every render, so
    such a catalog still updates the context on every render. Move such messages into
    a constant.
  */
  const cached = useRef(messages);
  if (!sameMessages(cached.current, messages)) cached.current = messages;
  const stableMessages = cached.current;

  const value = useMemo<UiContextValue>(
    () => ({
      locale: locale ?? parent?.locale,
      messages: mergeMessages(parent?.messages ?? DEFAULT_MESSAGES, stableMessages),
      dir: dir ?? parent?.dir ?? "ltr",
      portalContainer: portalContainer ?? parent?.portalContainer ?? null,
      density: density ?? parent?.density ?? "comfortable",
    }),
    [locale, stableMessages, dir, portalContainer, density, parent]
  );

  const tree = <UiContext.Provider value={value}>{children}</UiContext.Provider>;
  return value.locale ? <I18nProvider locale={value.locale}>{tree}</I18nProvider> : tree;
}
