"use client";

import type { ReactNode } from "react";
import { cn } from "../../lib/cn.js";
import { HelpIcon } from "../../icons.js";
import { Popover, PopoverContent, PopoverTrigger } from "./Popover.js";
import { keyGlyphs } from "../content/Kbd.js";

export interface HelpTooltipProps {
  /** Доступное имя кнопки-вопросика: «Что показывает дашборд». */
  label: string;
  /** Заголовок внутри поповера. */
  title?: ReactNode;
  /** Содержимое подсказки. */
  children: ReactNode;
  /**
   * Комбинация клавиш целиком — строкой, как её надо показать: `⌘+Shift+L`.
   *
   * Именно целиком, а не буквой: раньше компонент сам собирал
   * `${модификатор}+Shift+${буква}` и тем самым знал, что все горячие клавиши
   * приложения устроены как Mod+Shift+буква. Дизайн-системе такое знать неоткуда,
   * а сочетание без Shift в неё бы уже не поместилось.
   *
   * По той же причине модификатор не вычисляется здесь: определение платформы —
   * это `react-device-detect` у потребителя, и тащить его в пакет ради одного
   * символа не за чем.
   */
  shortcut?: string;
  /** Подпись слева от комбинации: «Открыть раздел». Без домена пакет не угадает. */
  shortcutLabel?: ReactNode;
  /** Своя иконка вместо вопросика. */
  icon?: ReactNode;
  /** Выравнивание панели относительно кнопки-вопросика: `start`, `center` или `end`. По умолчанию `start`. */
  align?: "start" | "center" | "end";
  /** Расстояние от кнопки до панели, в пикселях. По умолчанию 8. */
  sideOffset?: number;
  /** Ширина панели классом: пояснения бывают разной длины. По умолчанию `w-[340px]`. */
  widthClassName?: string;
}

/**
 * Кнопка-вопросик, раскрывающая поясняющий текст.
 *
 * Отличается от `Tooltip` не оформлением, а поведением: тултип всплывает по
 * наведению и исчезает, а сюда кладут абзац текста, который надо успеть
 * прочитать, — поэтому это поповер по клику, с фокусируемым триггером.
 */
export function HelpTooltip({
  label,
  title,
  children,
  shortcut,
  shortcutLabel,
  icon,
  align = "start",
  sideOffset = 8,
  widthClassName = "w-[340px]",
}: HelpTooltipProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          // Кольцо фокуса — своё, а не от глобального `:focus-visible` в
          // styles.css: примитив не должен зависеть от того, подключил ли
          // потребитель базовые стили. Тот же принцип, что у `Chip`.
          className={cn(
            "text-fg-3 hover:text-fg-1 focus-visible:text-fg-1 inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-full transition-colors",
            "focus-visible:outline-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2"
          )}
          aria-label={label}
          title={label}
        >
          <span className="border-line-soft bg-bg-2/70 inline-flex h-5 w-5 items-center justify-center rounded-full border-[0.75px]">
            {icon ?? <HelpIcon size={12} strokeWidth={1.55} aria-hidden />}
          </span>
        </button>
      </PopoverTrigger>

      <PopoverContent align={align} sideOffset={sideOffset} className={cn(widthClassName, "p-4")}>
        <div className="flex flex-col gap-3">
          {title ? <div className="text-md font-semibold">{title}</div> : null}
          {children}
          {shortcut ? (
            <div className="text-fg-3 border-line-soft bg-bg-2/60 rounded-control flex items-center justify-between border px-2.5 py-2 text-[11px] leading-relaxed">
              <span>{shortcutLabel}</span>
              <kbd className="bg-bg-3 border-line text-fg-1 rounded-md border px-2 py-0.5 font-mono font-medium">
                {keyGlyphs(shortcut)}
              </kbd>
            </div>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
