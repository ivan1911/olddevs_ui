"use client";

import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { CheckIcon } from "../../icons.js";
import { useMessages } from "../../i18n/useMessages.js";
import { cn } from "../../lib/cn.js";
import { AspectRatio } from "./AspectRatio.js";

export interface MediaCardProps extends Omit<
  ComponentPropsWithoutRef<"div">,
  "title" | "onSelect"
> {
  /** Превью — обычно `Image`. Своей загрузки и своего скелетона плитка не пишет. */
  preview: ReactNode;
  /** Отношение сторон превью числом: `16 / 9`, `1`, `9 / 16`. */
  ratio?: number;
  /** Подпись под превью. */
  title?: ReactNode;
  /** Вторая строка: размер, автор, дата — что угодно, уже отформатированное. */
  subtitle?: ReactNode;
  /** Бейджи поверх превью — обычно `StatusBadge`. */
  badges?: ReactNode;
  /**
   * Действия поверх превью — обычно `Button iconOnly`.
   *
   * Они ВСЕГДА в разметке и всегда достижимы с клавиатуры; прячутся они только
   * прозрачностью, а показываются при наведении, при фокусе внутри, когда
   * плитка выбрана и всегда на устройствах без наведения (`hover: none`).
   * Оверлей, появляющийся по `:hover` через `display: none`,
   * недостижим для клавиатуры вовсе — а это не «менее удобно», а «нельзя
   * пользоваться».
   */
  actions?: ReactNode;
  /**
   * Плитка выбрана.
   *
   * Рамка выбора рисуется по нему. Своя ось (кнопка выбора) включается ЯВНО —
   * парой `selected` и `onSelectedChange`; один `selected` — показ чужой оси,
   * как в `VirtualGrid`. Без `selected` рамки в разметке нет.
   */
  selected?: boolean;
  /** Вызывается при переключении выбора и получает новое значение. Без обработчика оси выбора нет. */
  onSelectedChange?: (selected: boolean) => void;
  /** Своя подпись кнопки выбора. Умолчание — из каталога. */
  selectLabel?: string;
}

/**
 * Плитка с изображением: превью, действия поверх него, бейджи и выбор.
 *
 * ГРАНИЦА С `Card`: `Card` — блок содержимого, `MediaCard` — плитка, у которой
 * главное превью, а всё остальное лежит поверх него или под ним
 * (ADR-0027). Общего у них
 * меньше, чем кажется: у карточки нет ни пропорции, ни оверлея, ни выбора.
 *
 * ДОМЕННОЕ ОСТАЁТСЯ СНАРУЖИ. Избранное, дубликаты, длинное нажатие и переход по
 * плитке — знание приложения; сюда приходят узлы. Обобщение делалось с `WPCard`
 * фронта (212 строк), и вместе с формой домен не поехал.
 *
 * ВЫБОР ОБЪЯВЛЯЕТСЯ СОСТОЯНИЕМ, а не рамкой. `aria-pressed` у кнопки говорит
 * скринридеру, выбрана плитка или нет; рамка — сигнал для глаз, и человек,
 * который её не видит, иначе не узнает о выборе вовсе. Подпись кнопки при этом
 * состояние НЕ повторяет: `aria-pressed` уже объявлен, и «Выбрать» вместе с ним
 * читается однозначно.
 */
export const MediaCard = forwardRef<HTMLDivElement, MediaCardProps>(function MediaCard(
  {
    preview,
    ratio = 1,
    title,
    subtitle,
    badges,
    actions,
    selected,
    onSelectedChange,
    selectLabel,
    className,
    ...rest
  },
  ref
) {
  const messages = useMessages();
  const selectable = onSelectedChange != null;

  return (
    <div
      ref={ref}
      className={cn(
        "group border-line-soft bg-bg-2 relative flex flex-col overflow-hidden rounded-xl border transition-colors",
        // Рамка выбранной плитки — по `selected`, а не по наличию своей оси.
        // Внутри `VirtualGrid` ось у сетки, карточка — показ: `selected` без
        // `onSelectedChange`. Рамка по одной своей оси оставляла выбранную
        // плитку в сетке без всякого знака — при том что справочник
        // это обещал. Без `selected` класса выбора в разметке нет, как и было.
        selected && "border-accent-strong ring-accent-strong/40 ring-2",
        className
      )}
      {...rest}
    >
      <AspectRatio ratio={ratio} className="bg-bg-3">
        {preview}
      </AspectRatio>

      {badges != null && (
        <div className="pointer-events-none absolute top-2 left-2 flex flex-wrap gap-1">
          {badges}
        </div>
      )}

      {(actions != null || selectable) && (
        /*
          Оверлей ВСЕГДА в разметке. Прячется прозрачностью, а показывается при
          наведении, при фокусе внутри (`focus-within`) и когда плитка выбрана —
          иначе снятая с выбора плитка теряла бы кнопку под курсором.
        */
        <div
          className={cn(
            /*
              Указатель снимается ВМЕСТЕ с прозрачностью и возвращается вместе
              с ней. `opacity` на попадание указателя не влияет: невидимый
              оверлей продолжал ловить касания, и на телефоне — где `:hover` не
              срабатывает и панель прозрачна навсегда — касание правого верхнего
              угла плитки попадало в невидимую кнопку выбора вместо перехода по
              плитке. Соседний блок бейджей эту защиту имеет с самого начала.
            */
            "pointer-events-none absolute top-2 right-2 flex items-center gap-1 opacity-0 transition-opacity",
            "group-focus-within:pointer-events-auto group-focus-within:opacity-100",
            "group-hover:pointer-events-auto group-hover:opacity-100",
            // Грубый указатель `:hover` не даёт вовсе — там панель открыта
            // всегда, иначе действия недостижимы.
            "[@media(hover:none)]:pointer-events-auto [@media(hover:none)]:opacity-100",
            // Выбранная плитка держит оверлей открытым: иначе снять выбор можно
            // было бы только вернув курсор, а с клавиатуры — только вернув фокус.
            // В сетке в оверлее флажок её оси (`Checkbox slot="selection"`) —
            // правило то же.
            selected && "pointer-events-auto opacity-100"
          )}
        >
          {actions}
          {selectable && (
            <button
              type="button"
              aria-pressed={selected ?? false}
              aria-label={selectLabel ?? messages.mediaCard.select}
              onClick={() => onSelectedChange(!selected)}
              className={cn(
                "focus-visible:outline-accent-strong flex size-6 cursor-pointer items-center justify-center rounded-full border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2",
                selected
                  ? "border-accent-strong bg-accent-strong text-white"
                  : "border-line bg-bg-1/90 text-fg-2"
              )}
            >
              <CheckIcon size={14} />
            </button>
          )}
        </div>
      )}

      {(title != null || subtitle != null) && (
        <div className="flex min-w-0 flex-col gap-0.5 px-2.5 py-2">
          {title != null && <span className="truncate text-[13px] font-medium">{title}</span>}
          {subtitle != null && <span className="text-fg-2 truncate text-[11px]">{subtitle}</span>}
        </div>
      )}
    </div>
  );
});
