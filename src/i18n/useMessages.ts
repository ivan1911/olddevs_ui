"use client";

import { useContext } from "react";
import { useLocale } from "react-aria-components";
import type { Density } from "../lib/variants.js";
import { UiContext } from "./context.js";
import { DEFAULT_MESSAGES } from "./defaults.js";
import type { UiMessages } from "./messages.js";

/**
 * Каталог сообщений: провайдера нет — английский фолбэк.
 *
 * Хук намеренно не принимает ключ и не режет каталог по пространствам имён:
 * компонент читает `messages.pagination.next`, и это видно в его коде. Хук вида
 * `useMessage("pagination.next")` спрятал бы ключ в строку, где ни компилятор,
 * ни поиск по репозиторию его не увидят.
 */
export function useMessages(): UiMessages {
  return useContext(UiContext)?.messages ?? DEFAULT_MESSAGES;
}

/**
 * Локаль для `Intl` и `@internationalized/date`.
 *
 * Порядок: явная локаль `UiProvider` → локаль `I18nProvider` потребителя →
 * локаль браузера. Последние две даёт `useLocale` из react-aria, поэтому кит
 * не спорит с приложением, а встраивается в него.
 */
export function useUiLocale(): string {
  const explicit = useContext(UiContext)?.locale;
  const { locale } = useLocale();
  return explicit ?? locale;
}

/** Направление письма, контейнер порталов и плотность, объявленные провайдером. */
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
