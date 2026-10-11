"use client";

// Происхождение: minimal-tiptap, `hooks/use-throttle.ts` (MIT, © 2024 Aslam,
// https://github.com/Aslam97/minimal-tiptap). Переписан: добавлены `flush` и
// `cancel`, вызов идёт по заднему фронту. Лицензия — NOTICE в корне пакета.

import { useCallback, useEffect, useMemo, useRef } from "react";

/**
 * Не чаще раза в `delay` мс — и только по заднему фронту.
 *
 * ПОЧЕМУ ЗАДНИЙ ФРОНТ, А НЕ ПЕРЕДНИЙ, как в оригинале. Отдать значение — значит
 * сериализовать документ в HTML, а это проход по всему дереву. Передний фронт
 * платил бы его на первой же букве после паузы, то есть почти на каждой при
 * обычном наборе. Задний копит правки и сериализует один раз, когда набор
 * улёгся, — `emit` читает документ сам, в момент вызова, а не получает
 * значение, посчитанное на каждую букву.
 *
 * `flush` — то же самое, но сейчас и только если что-то ждёт: на `blur` и
 * перед отправкой формы значение обязано быть свежим, а не отставать на
 * `delay`. `cancel` — отказ от ожидающего вызова, когда документ заменили
 * снаружи и отдавать прежнюю правку уже нечего.
 *
 * Размонтирование тоже сбрасывает ожидание: иначе последние буквы перед
 * закрытием формы молча терялись бы.
 */
export function useChangeThrottle(emit: () => void, delay: number) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const emitRef = useRef(emit);
  emitRef.current = emit;

  const flush = useCallback(() => {
    if (timer.current === null) return;
    clearTimeout(timer.current);
    timer.current = null;
    emitRef.current();
  }, []);

  const cancel = useCallback(() => {
    if (timer.current === null) return;
    clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const schedule = useCallback(() => {
    if (delay <= 0) {
      emitRef.current();
      return;
    }
    if (timer.current !== null) return;
    timer.current = setTimeout(() => {
      timer.current = null;
      emitRef.current();
    }, delay);
  }, [delay]);

  useEffect(() => flush, [flush]);

  // Один объект на всю жизнь при неизменной задержке: эффекты потребителя
  // держат его в зависимостях и не должны перезапускаться на каждом рендере.
  return useMemo(() => ({ schedule, flush, cancel }), [schedule, flush, cancel]);
}
