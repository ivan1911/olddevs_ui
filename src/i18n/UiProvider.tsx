"use client";

import { useContext, useMemo, useRef, type ReactNode } from "react";
import { I18nProvider } from "react-aria-components";
import { UiContext, type UiContextValue } from "./context.js";
import { DEFAULT_MESSAGES } from "./defaults.js";
import type { Density } from "../lib/variants.js";
import type { PartialUiMessages, UiMessages } from "./messages.js";

export interface UiProviderProps {
  /**
   * Локаль форматирования: даты, числа, склонения. Не задана — кит не
   * навязывает свою: значение берётся у `I18nProvider` из react-aria, то есть
   * у внешнего провайдера потребителя или у браузера.
   *
   * Строки при этом от локали НЕ зависят: их приносит `messages`. Разделение
   * намеренное — каталог локали подключается импортом, иначе он оказался бы в
   * бандле у всех, включая тех, кому нужен только английский.
   */
  locale?: string;
  /**
   * Каталог сообщений — целиком или частично. Недоданные ветки берутся из
   * английского фолбэка, поэтому `messages={{ common: { close: "Закрыть" } }}`
   * — законный вызов.
   */
  messages?: PartialUiMessages;
  /** Направление письма. Кит его публикует; компонентной поддержки RTL нет. */
  dir?: "ltr" | "rtl";
  /** Куда рендерить порталы оверлеев. По умолчанию — `document.body`. */
  portalContainer?: HTMLElement | null;
  /**
   * Плотность раскладки по умолчанию для всего приложения.
   *
   * Умолчание, а не режим: таблица и её шестерёнка значение перекрывают. Поле
   * появилось в 2.2.0 — ADR-0002 откладывал его до появления читателя, и
   * `DataTable` им стал.
   */
  density?: Density;
  children: ReactNode;
}

/** Слияние на два уровня: пространство имён → ключ. Глубже структура не идёт. */
function mergeMessages(base: UiMessages, patch: PartialUiMessages | undefined): UiMessages {
  if (!patch) return base;
  const out = { ...base } as Record<string, unknown>;
  for (const [ns, values] of Object.entries(patch)) {
    if (!values) continue;
    /*
      Ключ со значением `undefined` ПРОПУСКАЕТСЯ, а не затирает фолбэк.

      Спред копирует и такие ключи, а `exactOptionalPropertyTypes` в
      `tsconfig.json` выключен — компилятор молчит. Реальная форма вызова —
      `messages={{ common: { close: dict[key] }}}`, где ключа в словаре
      потребителя нет: крестик закрытия молча оставался без доступного имени.
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
 * Совпадают ли два частичных каталога ПО СОДЕРЖИМОМУ.
 *
 * Нужна, чтобы литерал на месте не считался новым каталогом на каждом рендере.
 * Глубина та же, что у слияния, — два уровня: глубже структура не идёт.
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
 * Провайдер кита: локаль, каталог сообщений, направление письма и контейнер
 * порталов.
 *
 * Порядок разрешения строки — `проп → сообщение провайдера → фолбэк`. Проп
 * компонента побеждает всегда: он точечное переопределение, а не единственный
 * способ, каким был до 2.0.0.
 *
 * ВЛОЖЕНИЕ РАБОТАЕТ. Внутренний провайдер наследует локаль и сообщения
 * внешнего и переопределяет то, что задал сам. Случай не выдуманный: диалог со
 * своей локалью внутри приложения на другой — обычное дело.
 *
 * `I18nProvider` из react-aria разворачивается ТОЛЬКО при явной локали. Иначе
 * кит молча перебил бы провайдер потребителя своим `en-US`, и датапикеры
 * заговорили бы не на том языке, на котором говорит остальное приложение.
 * Решение — ADR-0002.
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
    Каталог сравнивается ПО СОДЕРЖИМОМУ, а не по ссылке.

    Докстрока пропа разрешает литерал на месте, и это остаётся законным вызовом
    — но литерал даёт новый объект на каждый рендер. Через `useMemo` по ссылке
    это означало новое значение контекста, а значит перерисовку КАЖДОГО
    компонента кита, читающего `useMessages`: под провайдером стоит всё дерево,
    и любой тик состояния в корне обходился в перерисовку всего кита разом.

    Кеш в ref, а не ещё один `useMemo`: зависимости сравниваются по ссылке, то
    есть той же монетой. Присваивание идемпотентно и наружу ничего не меняет.

    ПРЕДЕЛ, О КОТОРОМ НАДО ЗНАТЬ: сравнение поверхностное, и функция-сообщение,
    объявленная прямо в литерале (`{ rating: { star: () => … } }`), каждый раз
    новая — такой каталог по-прежнему обновляет контекст на каждом рендере.
    Выносить такие сообщения в константу.
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
