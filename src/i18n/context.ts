"use client";

import { createContext } from "react";
import type { Density } from "../lib/variants.js";
import type { UiMessages } from "./messages.js";

export interface UiContextValue {
  /**
   * Локаль, заданная ЯВНО. `undefined` значит «не задана», и это не то же
   * самое, что `en-US`: без явной локали кит не спорит с потребителем, а берёт
   * её у `I18nProvider` из react-aria (то есть у внешнего провайдера или у
   * браузера). См. `useUiLocale`.
   */
  locale: string | undefined;
  messages: UiMessages;
  dir: "ltr" | "rtl";
  portalContainer: HTMLElement | null;
  /**
   * Плотность раскладки по умолчанию. Именно **умолчание**: таблица и её
   * шестерёнка перекрывают значение, а провайдер избавляет приложение с пятью
   * таблицами от пяти одинаковых пропов (ADR-0023).
   */
  density: Density;
}

/**
 * Контекст лежит отдельным модулем, чтобы `UiProvider` и хуки не тянули друг
 * друга по кругу: провайдер импортирует хук слияния, а хуки — контекст.
 */
export const UiContext = createContext<UiContextValue | null>(null);
