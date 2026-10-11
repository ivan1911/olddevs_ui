"use client";

import type { ReactNode } from "react";
import { ErrorIcon } from "../../icons.js";
import { cn } from "../../lib/cn.js";
import { useMessages } from "../../i18n/useMessages.js";
import {
  STATE_DESCRIPTION,
  STATE_ICON,
  STATE_LAYOUT,
  STATE_ROOT,
  STATE_TITLE,
} from "../../lib/state.js";
import { TONE_TOKENS } from "../../lib/variants.js";

export interface ErrorStateProps {
  /**
   * Заголовок состояния ошибки: общая фраза над пояснением.
   *
   * Умолчание берётся из каталога сообщений (`errorState.title`): в русском
   * каталоге — «Ошибка загрузки», ровно этими словами все четыре места фронта
   * и назывались; без провайдера — английская строка.
   */
  title?: string;
  /** Что именно не удалось. Общая фраза наверху, конкретика здесь. */
  description?: string;
  /**
   * Готовый узел (обычно `Button` с «Попробовать снова»), а не колбэк с
   * подписью — как у `EmptyState`: что делает действие, знает потребитель.
   */
  action?: ReactNode;
  /**
   * Своя иконка вместо стандартной. `null` убирает её вовсе — например когда
   * блок стоит внутри уже помеченного опасностью контейнера.
   */
  icon?: ReactNode | null;
  /** `sm` — внутри пикеров и панелей; `md` — вместо содержимого страницы. */
  size?: "sm" | "md";
  /** Классы корневого элемента. */
  className?: string;
}

const ICON_SIZE = { sm: 22, md: 28 } as const;

/**
 * Отказ: запрос не удался, показать нечего.
 *
 * Отличается от `EmptyState` тремя вещами, и все три — не косметика:
 *
 * 1. **Роль `alert`.** Пустой список — это результат, отказ — событие, и
 *    скринридер обязан о нём узнать. Без живой области пользователь, не
 *    смотрящий на экран, остаётся с тишиной вместо ответа: запрос ушёл,
 *    ничего не произошло, и почему — неизвестно. Именно этого не было ни в
 *    одной из четырёх рукописных копий во фронте.
 * 2. **Тон опасности** у иконки и заголовка — `danger.fg`, то есть
 *    `danger-strong`. Голый `--danger` здесь не годится: атом тона подобран
 *    так, чтобы проходить порог контраста на всех четырёх подложках, а
 *    заливочный `--danger` считается только под контрастным текстом.
 * 3. **Действие подразумевается.** Отказ почти всегда повторим, поэтому слот
 *    `action` стоит на видном месте, а не как редкое дополнение.
 *
 * Отдельный компонент, а не ось `tone` у `EmptyState`: у того в замысле
 * записано «пустой экран не событие, ему не положено привлекать внимание» —
 * ровно противоположное требование. Один компонент с двумя взаимоисключающими
 * режимами обошёлся бы дороже двух честных. Общая у них геометрия, и она
 * вынесена в `lib/state.ts`.
 */
export function ErrorState({
  title,
  description,
  action,
  icon,
  size = "md",
  className,
}: ErrorStateProps) {
  const messages = useMessages();
  const layout = STATE_LAYOUT[size];
  const tone = TONE_TOKENS.danger;
  // `undefined` — иконки не передали, ставим стандартную; `null` — передали
  // отказ от неё. Разница видна только так: `??` склеил бы оба случая.
  const iconNode =
    icon === undefined ? <ErrorIcon size={ICON_SIZE[size]} strokeWidth={1.5} /> : icon;

  return (
    <div role="alert" className={cn(STATE_ROOT, layout.root, className)}>
      {iconNode ? (
        <span aria-hidden className={cn(tone.fg, STATE_ICON, layout.icon)}>
          {iconNode}
        </span>
      ) : null}
      <div className={cn(tone.fg, STATE_TITLE, layout.title)}>
        {title ?? messages.errorState.title}
      </div>
      {description ? (
        <div className={cn("text-fg-3", STATE_DESCRIPTION, layout.description)}>{description}</div>
      ) : null}
      {action ? <div className={layout.action}>{action}</div> : null}
    </div>
  );
}
