"use client";

import type { ReactNode } from "react";
import { CheckIcon } from "../../icons.js";
import { cn } from "../../lib/cn.js";
import { useMessages } from "../../i18n/useMessages.js";

export interface Step {
  /** Стабильный идентификатор шага, ключ списка. */
  id: string;
  /** Подпись шага. */
  label: string;
  /** Короткое пояснение под подписью. */
  hint?: ReactNode;
}

export interface StepperProps {
  /** Шаги мастера по порядку. */
  steps: Step[];
  /** Индекс текущего шага, с нуля. */
  current: number;
  /**
   * Вызывается по клику на пройденный шаг и получает его индекс.
   *
   * Не задан — шаги некликабельны вовсе, и это умолчание. Вернуться назад
   * можно **только на пройденный** шаг: будущий шаг требует данных, которых
   * ещё нет, и пустить туда — значит показать форму, которая не сможет
   * ни отправиться, ни объяснить, чего ей не хватает.
   *
   * Мастер, где возвращаться нельзя вовсе (оплата, необратимый импорт),
   * просто не передаёт колбэк.
   */
  onStepClick?: (index: number) => void;
  /** Направление ряда: `horizontal` — шаги в строку (по умолчанию), `vertical` — в колонку. */
  orientation?: "horizontal" | "vertical";
  /** Дополнительные классы на `nav`. */
  className?: string;
  /** Доступное имя навигации. По умолчанию берётся из словаря сообщений. */
  "aria-label"?: string;
}

/**
 * Шаги мастера: где пользователь сейчас и сколько осталось.
 *
 * Собран руками: в react-aria такого компонента нет, а из поведения здесь —
 * только переход по клику, который целиком принадлежит вызывающему.
 *
 * Разметка — упорядоченный список внутри `nav`: шаги идут по порядку, и
 * скринридер обязан сообщить и порядок, и общее число. Текущий помечается
 * `aria-current="step"`.
 */
export function Stepper({
  steps,
  current,
  onStepClick,
  orientation = "horizontal",
  className,
  "aria-label": ariaLabel,
}: StepperProps) {
  const messages = useMessages();

  return (
    <nav aria-label={ariaLabel ?? messages.stepper.label} className={cn("min-w-0", className)}>
      <ol
        className={cn(
          "flex gap-2",
          orientation === "horizontal" ? "flex-row items-start" : "flex-col"
        )}
      >
        {steps.map((step, index) => {
          const done = index < current;
          const active = index === current;
          const clickable = onStepClick != null && done;

          const body = (
            <>
              <span
                aria-hidden
                className={cn(
                  "text-caption flex size-6 shrink-0 items-center justify-center rounded-full border font-semibold",
                  done && "border-accent-strong bg-accent-soft text-accent-strong",
                  // `text-text-on-accent`, а не `text-on-accent`: второго класса не
                  // существует вовсе, и номер активного шага красился ничем
                  // поверх акцентной заливки. Поймала матрица покрытия классов —
                  // ровно то, ради чего она заведена.
                  active && "border-accent-strong bg-accent text-text-on-accent",
                  !done && !active && "border-line text-fg-3"
                )}
              >
                {done ? <CheckIcon size={12} /> : index + 1}
              </span>
              {/*
                Состояние шага — ТЕКСТОМ, а не только кружком.

                Кружок с номером или галочкой помечен `aria-hidden`, а больше
                признак «пройден / текущий / впереди» нигде не выражен: у `li`
                есть только `aria-current` у активного. Скринридер читал мастер
                из пяти одинаковых пунктов и текущий — какие уже заполнены, а
                какие впереди, не сообщалось никак.
              */}
              {/*
                Текущий шаг СВОЕЙ строки не получает: его объявляет
                `aria-current="step"` на `li`, и вторая строка давала «current
                step, current step, Оплата» — состояние читалось дважды.
              */}
              {active ? null : (
                <span className="sr-only">
                  {messages.stepper.state({ state: done ? "done" : "upcoming" })}
                </span>
              )}
              <span className="flex min-w-0 flex-col">
                <span
                  className={cn(
                    "truncate text-sm",
                    active ? "text-fg-0 font-semibold" : done ? "text-fg-1" : "text-fg-2"
                  )}
                >
                  {step.label}
                </span>
                {step.hint ? <span className="text-fg-2 text-caption">{step.hint}</span> : null}
              </span>
            </>
          );

          return (
            <li
              key={step.id}
              className={cn(
                "flex min-w-0 flex-1 items-start gap-2",
                orientation === "vertical" && "flex-none"
              )}
              // Текущий шаг объявляется шагом, а не страницей: `aria-current`
              // различает эти значения, и «step» — ровно этот случай.
              aria-current={active ? "step" : undefined}
            >
              {clickable ? (
                <button
                  type="button"
                  onClick={() => onStepClick(index)}
                  className="focus-visible:outline-accent-strong flex min-w-0 cursor-pointer items-start gap-2 text-left outline-none focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  {body}
                </button>
              ) : (
                <span className="flex min-w-0 items-start gap-2">{body}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
