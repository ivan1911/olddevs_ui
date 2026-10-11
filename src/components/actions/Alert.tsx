"use client";

import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { CloseIcon, ErrorIcon, InfoIcon, SuccessIcon, WarningIcon } from "../../icons.js";
import { cn } from "../../lib/cn.js";
import { useMessages } from "../../i18n/useMessages.js";
import { TONE_TOKENS, type Tone, type Variant } from "../../lib/variants.js";

export interface AlertProps extends Omit<ComponentPropsWithoutRef<"div">, "title"> {
  /**
   * Тон сообщения: задаёт цвет, иконку по умолчанию и роль для скринридера. По умолчанию `accent`.
   *
   * `danger` получает `role="alert"`, остальные тона — `role="status"`.
   */
  tone?: Tone;
  /**
   * Подача: `soft` — с подложкой, `outline` — только рамка. По умолчанию `soft`.
   *
   * Только `soft` и `outline`, и это ограничение типа, а не забывчивость.
   *
   * `solid` на всю ширину блока — плашка, перебивающая содержимое страницы;
   * `ghost` без рамки и подложки перестаёт читаться как сообщение вовсе. Обе
   * подачи существуют у кнопки, где размер другой, и туда же не годятся здесь.
   */
  variant?: Extract<Variant, "soft" | "outline">;
  /** Заголовок сообщения: жирная строка над текстом. Необязателен: без него выводится только текст. */
  title?: ReactNode;
  /** Текст сообщения под заголовком. */
  children?: ReactNode;
  /** Иконка слева. По умолчанию выбирается по тону. */
  icon?: ReactNode;
  /** Кнопка закрытия. Без обработчика не рисуется вовсе. */
  onDismiss?: () => void;
  /** Действие справа — обычно `Button size="sm"`. */
  action?: ReactNode;
  /** Доступное имя кнопки закрытия. По умолчанию берётся из словаря сообщений кита. */
  closeLabel?: string;
}

/** Иконка по умолчанию — по тону. Словарь, а не догадка места вызова. */
const TONE_ICONS: Record<Tone, ReactNode> = {
  neutral: <InfoIcon size={16} />,
  accent: <InfoIcon size={16} />,
  success: <SuccessIcon size={16} />,
  warning: <WarningIcon size={16} />,
  danger: <ErrorIcon size={16} />,
};

/**
 * Сообщение на месте — в отличие от тоста, который всплывает и уходит.
 *
 * Когда что: тост сообщает о СОБЫТИИ («сохранено»), а `Alert` описывает
 * СОСТОЯНИЕ («канал не подключён, публикации не пойдут»). Состояние не должно
 * исчезать по таймеру, а событие не должно занимать место на экране навсегда.
 *
 * РОЛЬ ВЫБИРАЕТСЯ ПО ТОНУ, и это не косметика. `danger` получает `role="alert"`
 * — скринридер перебивает им текущую речь; остальные тона получают
 * `role="status"`, который дожидается паузы. Путать их означает либо потерять
 * сообщение об ошибке, либо орать про успешное сохранение.
 */
export const Alert = forwardRef<HTMLDivElement, AlertProps>(function Alert(
  {
    tone = "accent",
    variant = "soft",
    title,
    children,
    icon,
    onDismiss,
    action,
    closeLabel,
    className,
    ...rest
  },
  ref
) {
  const messages = useMessages();
  const t = TONE_TOKENS[tone];

  return (
    <div
      ref={ref}
      role={tone === "danger" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2.5 rounded-md border px-3 py-2.5 text-[13px]",
        // Вид собирается из АТОМОВ тона, а не через `variantClasses()`, и это
        // не оптимизация. Тот отдаёт ещё и классы наведения — сообщение же не
        // кнопка, наводить на него не на что. Гасить их поверх нельзя:
        // `hover:bg-inherit` не убирает подложку, а подменяет её родительской,
        // и сообщение мигало бы фоном страницы под курсором.
        t.border,
        variant === "soft" ? cn(t.bg, t.softFg) : cn("bg-transparent", t.fg),
        className
      )}
      {...rest}
    >
      <span className="flex shrink-0 items-center pt-px">{icon ?? TONE_ICONS[tone]}</span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {title != null && <div className="font-semibold">{title}</div>}
        {/*
          Текст сообщения НЕ приглушается прозрачностью. Тона откалиброваны
          ровно под порог 4.5 на своей подложке (`npm run contrast`), и любое
          `opacity` поверх молча уводит пару ниже него: `opacity-90` давал
          3.89–4.08 в светлой теме. Иерархия между заголовком и текстом держится
          на насыщенности шрифта, а не на приглушении.
        */}
        {children != null && <div>{children}</div>}
      </div>
      {action != null && <div className="shrink-0 pl-1">{action}</div>}
      {onDismiss != null && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label={closeLabel ?? messages.alert.close}
          className="hover:bg-bg-3 -mr-1 flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-xs opacity-70 transition-colors hover:opacity-100"
        >
          <CloseIcon size={14} />
        </button>
      )}
    </div>
  );
});
