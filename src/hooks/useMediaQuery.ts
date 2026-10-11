"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Совпадает ли медиазапрос с окном прямо сейчас — и следит за изменением.
 *
 * ЭТО НЕ СПОСОБ РАСКЛАДЫВАТЬ СТРАНИЦУ. Показать или спрятать блок по ширине
 * надо классом (`hidden lg:block`): класс работает с первого кадра и на
 * сервере, а раскладка, зависящая от JS, до гидратации показывает неверную
 * (ADR-0018). Хук нужен там, где от ширины зависит не вид, а СОСТАВ или ПОВЕДЕНИЕ
 * — что смонтировать, сколько месяцев рисовать, закрывать ли ящик по Escape, —
 * и класс этого не выразит.
 *
 * ДО ГИДРАТАЦИИ ХУК ВОЗВРАЩАЕТ `serverValue`, ПО УМОЛЧАНИЮ `false`. Сервер
 * ширины не знает, и угадывать её значило бы получить расхождение разметки.
 * `false` — потому что отсчёт mobile-first, как у самого Tailwind: запрос
 * `min-width` на сервере «ещё не выполнен», и первый кадр всегда узкий. React
 * при гидратации сам берёт серверное значение, а настоящее подставляет сразу
 * после — без ошибки расхождения, но с одной перерисовкой. На широком экране
 * это видимый переход, поэтому всё, что можно выразить классом, выражайте им.
 *
 * Нет `matchMedia` вовсе (jsdom, сервер) — тоже `serverValue`: хук не бросает.
 *
 * Запрос — строка как есть: `(min-width: 1024px)`. Брейкпойнты кита — штатные
 * Tailwind 4: `sm` 640, `md` 768, `lg` 1024, `xl` 1280.
 */
export function useMediaQuery(query: string, serverValue = false): boolean {
  const subscribe = useCallback(
    (notify: () => void) => {
      if (typeof window.matchMedia !== "function") return () => {};
      const list = window.matchMedia(query);
      list.addEventListener("change", notify);
      return () => list.removeEventListener("change", notify);
    },
    [query]
  );

  const getSnapshot = useCallback(
    () =>
      typeof window.matchMedia === "function" ? window.matchMedia(query).matches : serverValue,
    [query, serverValue]
  );

  return useSyncExternalStore(subscribe, getSnapshot, () => serverValue);
}
