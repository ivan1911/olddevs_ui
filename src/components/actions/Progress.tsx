"use client";

import { forwardRef } from "react";
import { ProgressBar } from "react-aria-components";
import { cn } from "../../lib/cn.js";
import { isShowableNumber } from "../../lib/empty.js";
import { TONE_TOKENS, type Size, type Tone } from "../../lib/variants.js";

export interface ProgressProps {
  /**
   * 0–100. `null` — прогресс неизвестен: бегущая полоса вместо доли.
   *
   * Это не то же самое, что `0`. Ноль означает «начали и пока ничего не
   * сделали», `null` — «сколько всего работы, неизвестно». Второе бывает у
   * запроса без длины ответа, и показывать его нулём значит врать.
   */
  value: number | null;
  /** Цвет заполненной части полосы из словаря тонов. По умолчанию `accent`. */
  tone?: Tone;
  /** Толщина полосы: `sm` — тоньше, `md` — толще. По умолчанию `md`. */
  size?: Extract<Size, "sm" | "md">;
  /** Что именно идёт. Обязательно: безымянный индикатор ни о чём не сообщает. */
  label: string;
  /** Показать процент справа от полосы. */
  showValue?: boolean;
  /** Классы на корневой элемент, в который собраны полоса и процент. */
  className?: string;
}

const HEIGHTS: Record<"sm" | "md", string> = { sm: "h-1", md: "h-1.5" };

/**
 * Полоса прогресса.
 *
 * `aria-valuenow` при неизвестном прогрессе ОТСУТСТВУЕТ, а не равен нулю —
 * так ARIA отличает «полоса на нуле» от «идёт неизвестно сколько». Это делает
 * react-aria, если не передать значение; подставить туда `0` значило бы
 * сообщить скринридеру неправду.
 *
 * Когда полоса, а когда `Skeleton` или `Spinner`: полоса нужна там, где долю
 * работы можно назвать — загрузка файла, обработка пачки. Если долю назвать
 * нельзя, а форма будущего содержимого известна — `Skeleton`; если неизвестна и
 * она — `Spinner`.
 */
export const Progress = forwardRef<HTMLDivElement, ProgressProps>(function Progress(
  { value, tone = "accent", size = "md", label, showValue, className },
  ref
) {
  const t = TONE_TOKENS[tone];
  /*
    `NaN` — это ТОЖЕ неизвестный прогресс, а не значение.

    Проверка `value == null` его не ловила, и `?? 0` ниже тоже: `??` отвечает
    только за null/undefined. В разметку уходило `width: NaN%` — объявление
    невалидно, браузер его отбрасывает, и блочный div растягивался на всю
    ширину: пользователь видел 100% у работы, которая не начиналась, а
    скринридер читал «NaN процентов». Приходит это из обычной арифметики
    потребителя: `loaded / total * 100` при нулевом `total`.
  */
  const indeterminate = !isShowableNumber(value);

  return (
    <ProgressBar
      ref={ref}
      // Через тот же предикат, что и `indeterminate` выше: `?? undefined` пропускает
      // `NaN` внутрь react-aria, и спасает только то, что при неизвестном
      // прогрессе она не читает `percentage`. Один предикат на оба места.
      value={isShowableNumber(value) ? value : undefined}
      isIndeterminate={indeterminate}
      aria-label={label}
      className={cn("flex items-center gap-2", className)}
    >
      {({ percentage, valueText }) => (
        <>
          <div
            className={cn("bg-bg-3 relative w-full overflow-hidden rounded-full", HEIGHTS[size])}
          >
            <div
              className={cn(
                "duration-moderate h-full rounded-full transition-[width]",
                t.dotBg,
                // Неизвестный прогресс — бегущая треть полосы. Ширина при этом
                // не анимируется: анимируется положение, иначе полоса дёргалась
                // бы шириной на каждом кадре.
                // Бегущая треть НЕ останавливается при `prefers-reduced-motion`:
                // второе из двух исключений кита (ADR-0043, первое — `Spinner`).
                // Когда доля неизвестна, движение полосы и есть всё сообщение —
                // застывшая треть читается как «зависло», а не как «спокойно».
                indeterminate && "animate-progress-indeterminate w-1/3"
              )}
              style={indeterminate ? undefined : { width: `${percentage ?? 0}%` }}
            />
          </div>
          {showValue && (
            <span className="text-fg-2 w-10 shrink-0 text-right text-[11px] tabular-nums">
              {indeterminate ? "—" : valueText}
            </span>
          )}
        </>
      )}
    </ProgressBar>
  );
});
