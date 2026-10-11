"use client";

import type { ReactNode } from "react";
import { cn } from "../../lib/cn.js";
import {
  STATE_DESCRIPTION,
  STATE_ICON,
  STATE_LAYOUT,
  STATE_ROOT,
  STATE_TITLE,
} from "../../lib/state.js";

export interface EmptyStateProps {
  /** Иконка над заголовком. */
  icon?: ReactNode;
  /** Заголовок: что именно пусто. */
  title: string;
  /** Пояснение под заголовком: почему пусто или что можно сделать. */
  description?: string;
  /**
   * Готовый узел (обычно `Button`), а не колбэк с подписью: что делает
   * действие и как выглядит — знает потребитель, компонент лишь отводит место.
   */
  action?: ReactNode;
  /** `sm` — внутри пикеров и дропдаунов; `md` — пустая страница или секция. */
  size?: "sm" | "md";
  /** Классы корневого элемента. */
  className?: string;
}

/**
 * Пустое состояние: «ничего не найдено», «пока пусто», «нет результатов».
 *
 * До пакета каждое место фронта рисовало свою версию — восемь вариантов
 * одного и того же с разными отступами и тонами. Компонент нарочно скучный:
 * вертикальная центровка, приглушённые тона, никаких иллюстраций и анимаций —
 * пустой экран не событие, ему не положено привлекать внимание.
 *
 * Геометрия общая с `ErrorState` и живёт в `lib/state.ts`; здесь остаются тон
 * и роль — то, чем эти два состояния и различаются.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  size = "md",
  className,
}: EmptyStateProps) {
  const layout = STATE_LAYOUT[size];
  return (
    <div className={cn(STATE_ROOT, layout.root, className)}>
      {icon ? (
        <span aria-hidden className={cn("text-fg-3", STATE_ICON, layout.icon)}>
          {icon}
        </span>
      ) : null}
      <div className={cn("text-fg-1", STATE_TITLE, layout.title)}>{title}</div>
      {description ? (
        <div className={cn("text-fg-3", STATE_DESCRIPTION, layout.description)}>{description}</div>
      ) : null}
      {action ? <div className={layout.action}>{action}</div> : null}
    </div>
  );
}
