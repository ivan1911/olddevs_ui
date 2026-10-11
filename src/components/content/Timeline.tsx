"use client";

import type { ReactNode } from "react";
import { cn } from "../../lib/cn.js";
import { PROGRESS_STATUS_TONE, type ProgressStatus } from "../../lib/progress-status.js";
import { TONE_TOKENS } from "../../lib/variants.js";

export interface TimelineItem {
  /** Идентификатор шага. */
  id: string;
  /** Что произошло. Обычно короткое имя шага. */
  label: ReactNode;
  /** Состояние шага. Порядок в ленте задаёт потребитель, а не статус. */
  status: ProgressStatus;
  /** Подпись состояния — «выполнен», «ошибка». Рисуется пилюлей справа от имени. */
  statusLabel?: ReactNode;
  /** Подробности: сообщение об ошибке, длительность, идентификатор. */
  details?: ReactNode;
  /** Время шага — уходит вправо, моноширинным. */
  time?: ReactNode;
}

export interface TimelineProps {
  /** Шаги в порядке показа; пустой список ничего не выводит. */
  items: TimelineItem[];
  /** Классы корневого элемента. */
  className?: string;
  /** Доступное имя списка шагов для скринридера. */
  "aria-label"?: string;
}

/**
 * Лента шагов процесса: что уже произошло и чем закончилось.
 *
 * ГРАНИЦА СО `Stepper`, и её стоит держать в голове:
 *
 *   `Stepper`  — мастер: линейный `current`, шаги впереди ещё не случались,
 *                провалиться шаг не может, назад ведёт клик.
 *   `Timeline` — наблюдение: у КАЖДОГО шага своё состояние, любой может
 *                провалиться, кликать не по чему.
 *
 * Именно из-за этой разницы конвейер шагов задачи во фронте не переехал на
 * `Stepper` и жил там рукописным: 122 строки инлайн-стилей с захардкоженными
 * `rgba`, то есть цветами мимо токенов, которые не менялись ни с темой, ни со
 * сменой акцента.
 *
 * РАЗМЕТКА — упорядоченный список. Шаги идут по порядку, и скринридер обязан
 * сообщить и порядок, и общее число; набор `div` не сообщает ни того, ни
 * другого. Идущий шаг помечается `aria-current="step"`.
 *
 * ЦВЕТА БЕРУТСЯ ИЗ АТОМОВ ТОНА (`TONE_TOKENS`), а не задаются заново: «ошибка»
 * означает один и тот же цвет здесь, в `Alert`, в `StatusBadge` и на кнопке
 * удаления. Свечение у идущего шага снято намеренно — оно было единственным
 * местом в ленте, где цвет задавался тенью, а не токеном.
 */
export function Timeline({ items, className, "aria-label": ariaLabel }: TimelineProps) {
  if (items.length === 0) return null;

  return (
    <ol aria-label={ariaLabel} className={cn("flex flex-col", className)}>
      {items.map((item, index) => {
        // Незнакомый статус подаётся нейтральным, а не роняет ленту целиком.
        // Потребитель пакета — приложение на JS, компилятор его данные не
        // проверяет, а статусы приходят с бэкенда: пятый вид шага не должен
        // стоить экрана. Прежняя рукописная версия этот случай закрывала, и
        // терять защиту при переезде нельзя.
        const tone = TONE_TOKENS[PROGRESS_STATUS_TONE[item.status] ?? "neutral"];
        const isLast = index === items.length - 1;

        return (
          <li
            key={item.id}
            aria-current={item.status === "running" ? "step" : undefined}
            className="relative flex items-start gap-2.5"
          >
            {/* Колонка маркера: точка и соединительная линия. Линии после
                последнего шага нет — она обещала бы продолжение. */}
            <div className="flex w-3.5 shrink-0 flex-col items-center pt-1">
              <span aria-hidden className={cn("size-2 shrink-0 rounded-full", tone.dotBg)} />
              {!isLast ? <span aria-hidden className="bg-line-soft mt-[3px] w-px flex-1" /> : null}
            </div>

            <div className={cn("min-w-0 flex-1", isLast ? "pb-0" : "pb-1.5")}>
              <div className="flex flex-wrap items-center gap-1.5">
                <span
                  className={cn(
                    "text-caption font-mono tracking-wide",
                    tone.fg,
                    item.status === "failed" ? "font-bold" : "font-medium"
                  )}
                >
                  {item.label}
                </span>
                {item.statusLabel ? (
                  <span
                    className={cn(
                      "text-caption rounded-xs px-1.5 py-px font-bold uppercase",
                      tone.bg,
                      tone.fg
                    )}
                  >
                    {item.statusLabel}
                  </span>
                ) : null}
                {item.time ? (
                  <span className="text-fg-3 ml-auto font-mono text-[10px]">{item.time}</span>
                ) : null}
              </div>

              {item.details ? (
                <div
                  className={cn(
                    "mt-0.5 text-xs leading-relaxed break-words",
                    item.status === "failed" ? "text-danger-strong" : "text-fg-3"
                  )}
                >
                  {item.details}
                </div>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
