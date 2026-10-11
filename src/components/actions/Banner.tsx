"use client";

import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { CloseIcon, ErrorIcon, InfoIcon, SuccessIcon, WarningIcon } from "../../icons.js";
import { useMessages } from "../../i18n/useMessages.js";
import { cn } from "../../lib/cn.js";
import { TONE_TOKENS, type Tone } from "../../lib/variants.js";

export interface BannerProps extends Omit<ComponentPropsWithoutRef<"div">, "title"> {
  /**
   * Тон баннера: задаёт цвет, иконку по умолчанию и роль для скринридера. По умолчанию `accent`.
   *
   * `danger` получает `role="alert"`, остальные тона — `role="status"`.
   */
  tone?: Tone;
  /** Заголовок баннера: жирный фрагмент в начале строки. Необязателен: без него в строке остаётся только текст. */
  title?: ReactNode;
  /** Текст баннера после заголовка, в той же строке. */
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

/** Иконка по умолчанию — по тону. Тот же словарь, что у `Alert`. */
const TONE_ICONS: Record<Tone, ReactNode> = {
  neutral: <InfoIcon size={16} />,
  accent: <InfoIcon size={16} />,
  success: <SuccessIcon size={16} />,
  warning: <WarningIcon size={16} />,
  danger: <ErrorIcon size={16} />,
};

/**
 * Сообщение уровня ПРИЛОЖЕНИЯ: деградация сервиса, работы на сервере, истёкшая
 * подписка.
 *
 * ГРАНИЦА ИЗ ТРЁХ СТРОК, и её стоит держать в голове:
 *
 *   `toast`  — СОБЫТИЕ: «сохранено». Всплывает и уходит по таймеру.
 *   `Alert`  — СОСТОЯНИЕ МЕСТА: «у этой кампании нет канала». Живёт внутри
 *              содержимого, рядом с тем, о чём говорит.
 *   `Banner` — СОСТОЯНИЕ ПРИЛОЖЕНИЯ: «публикации не идут, идут работы». Стоит
 *              над содержимым, переживает навигацию и не относится ни к какому
 *              блоку страницы.
 *
 * Отсюда и отдельный компонент, а не ось у `Alert` (ADR-0027): разница не в
 * виде, а в месте и времени жизни. Сообщение, умеющее и то и другое, тащило бы
 * в разметку нерабочее.
 *
 * РОЛЬ ВЫБИРАЕТСЯ ПО ТОНУ — тем же правилом, что в `Alert`: `danger` получает
 * `role="alert"` и перебивает речь скринридера, остальные тона `role="status"`
 * и дожидаются паузы. Одно правило на кит, а не два похожих.
 *
 * ВО ВСЮ ШИРИНУ И БЕЗ СКРУГЛЕНИЙ: баннер — полоса поперёк приложения, а не
 * карточка внутри страницы. Скруглённые углы читались бы как блок содержимого —
 * то есть как `Alert`.
 *
 * НЕ ЛИПКИЙ. Контракт `--topbar-h` (ADR-0016) и его публикация шапкой
 * (ADR-0019) не трогаются: шапка остаётся на `top: 0`. Постоянство сообщения
 * держится на том, что баннер не исчезает из разметки, а не на том, что он
 * всегда в кадре.
 *
 * СТОПКА — ОБЫЧНЫЙ СПИСОК соседних баннеров: каждый закрывается своей кнопкой,
 * порядок задаёт потребитель. Своей очереди у компонента нет — она была бы
 * состоянием, а состояние в ките не живёт.
 */
export const Banner = forwardRef<HTMLDivElement, BannerProps>(function Banner(
  { tone = "accent", title, children, icon, onDismiss, action, closeLabel, className, ...rest },
  ref
) {
  const messages = useMessages();
  const t = TONE_TOKENS[tone];

  return (
    <div
      ref={ref}
      role={tone === "danger" ? "alert" : "status"}
      className={cn(
        "flex w-full items-center gap-2.5 border-b px-4 py-2.5 text-[13px]",
        // Вид собирается из АТОМОВ тона, как у `Alert`, а не через
        // `variantClasses()`: тот отдаёт ещё и классы наведения, а на сообщение
        // наводить не на что.
        t.border,
        t.bg,
        t.softFg,
        className
      )}
      {...rest}
    >
      <span className="flex shrink-0 items-center">{icon ?? TONE_ICONS[tone]}</span>
      <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2">
        {title != null && <span className="font-semibold">{title}</span>}
        {/*
          Текст НЕ приглушается прозрачностью: тона откалиброваны ровно под порог
          4.5 на своей подложке (`npm run contrast`), и любое `opacity` поверх
          молча уводит пару ниже него. Иерархия держится насыщенностью шрифта —
          тот же урок, что у `Alert`.
        */}
        {children != null && <span className="min-w-0">{children}</span>}
      </div>
      {action != null && <div className="shrink-0">{action}</div>}
      {onDismiss != null && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label={closeLabel ?? messages.banner.close}
          className="hover:bg-bg-3 -mr-1 flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-xs opacity-70 transition-colors hover:opacity-100"
        >
          <CloseIcon size={14} />
        </button>
      )}
    </div>
  );
});
