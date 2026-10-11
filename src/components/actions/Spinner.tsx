"use client";

import { forwardRef } from "react";
import { cn } from "../../lib/cn.js";
import { useMessages } from "../../i18n/useMessages.js";
import { TONE_TOKENS, type Size, type Tone } from "../../lib/variants.js";

export interface SpinnerProps {
  /** Размер кольца: `sm`, `md` или `lg`. По умолчанию `md`. */
  size?: Size;
  /** Цвет кольца из словаря тонов. По умолчанию `accent`. */
  tone?: Tone;
  /** Доступное имя. По умолчанию — «Загрузка». */
  label?: string;
  /** Классы на корневой элемент. */
  className?: string;
}

const SIZES: Record<Size, string> = {
  sm: "size-3.5 border-[1.5px]",
  md: "size-4 border-2",
  lg: "size-6 border-2",
};

/**
 * Крутящийся индикатор — когда неизвестно ни сколько ждать, ни что появится.
 *
 * ГРАНИЦА С СОСЕДЯМИ, и её стоит держать в голове:
 *
 *   `Skeleton`  — форма будущего содержимого известна: строки списка, карточка.
 *   `Progress`  — известна доля выполненной работы.
 *   `Spinner`   — не известно ни то, ни другое: отправка формы, ожидание ответа
 *                 без раскладки под него.
 *
 * Скелетон вместо спиннера там, где форма известна, — не украшение: он
 * удерживает раскладку, и содержимое не прыгает при появлении.
 *
 * `role="status"` с невидимой подписью, а не голый `div`: без имени вращающийся
 * кружок для скринридера просто не существует, и пользователь не узнаёт, что
 * страница чем-то занята.
 *
 * Вращение при `prefers-reduced-motion` НЕ гасится — это одно из двух
 * названных исключений кита (ADR-0043; второе — неопределённый `Progress`).
 * Довод тот же, что и у `role="status"` абзацем выше: спиннер — единственное,
 * чем кит сообщает «идёт работа». Остановленный кружок не спокойнее
 * крутящегося, он выглядит сломанным, и пользователь теряет сведения, а не
 * раздражитель. W3C выводит существенное движение из-под правила; здесь оно
 * существенное.
 *
 * Чтобы исключение было видно не только отсюда, `--animate-spin` объявлен в
 * `@theme` кита явно: гейт читает `styles.css` и о дефолтной теме Tailwind не
 * знает.
 *
 * До волны 27 этот абзац утверждал обратное — что анимация гасится «глобальным
 * правилом пакета». Правила не существовало: во всём репозитории строка
 * `prefers-reduced-motion` встречалась ровно один раз, в нём самом.
 */
export const Spinner = forwardRef<HTMLSpanElement, SpinnerProps>(function Spinner(
  { size = "md", tone = "accent", label, className },
  ref
) {
  const messages = useMessages();
  const t = TONE_TOKENS[tone];

  return (
    <span ref={ref} role="status" className={cn("inline-flex items-center", className)}>
      <span
        aria-hidden
        className={cn(
          // Кольцо с одним прозрачным сектором: три стороны цветные, четвёртая
          // прозрачная — отсюда и видно вращение.
          "animate-spin rounded-full border-current border-t-transparent",
          SIZES[size],
          t.fg
        )}
      />
      <span className="sr-only">{label ?? messages.spinner.label}</span>
    </span>
  );
});
