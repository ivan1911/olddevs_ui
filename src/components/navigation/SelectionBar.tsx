"use client";

import type { ReactNode } from "react";
import { CloseIcon } from "../../icons.js";
import { cn } from "../../lib/cn.js";
import { useMessages } from "../../i18n/useMessages.js";
import { useStickyOffset } from "../../hooks/useStickyOffset.js";
import { BUTTON_ICON_SIZE } from "../../lib/button.js";

export interface SelectionBarProps {
  /** Сколько объектов выбрано. При нуле полоса не рисуется вовсе. */
  count: number;
  /**
   * Подпись счётчика. Умолчание — «Выбрано N»; своя нужна там, где счёт идёт
   * в предметных единицах («Выбрано 12 обоев») и слово при числе нужно согласовать с ним.
   */
  countLabel?: (count: number) => ReactNode;
  /** Вызывается, когда пользователь снимает выделение. Кнопка стоит слева от счётчика и рисуется иконкой «×»; без обработчика её нет. */
  onClear?: () => void;
  /** Действия над выбранным — обычно `Button size="sm"`. */
  children?: ReactNode;
  /**
   * Правый край полосы: «Выбрать все», ссылка на справку. Отделён от
   * `children`, потому что живёт по другую сторону распорки и на узком экране
   * уезжает в первую строку, к счётчику.
   */
  secondary?: ReactNode;
  /**
   * Липнуть под верхней панелью приложения. Выключается там, где полоса стоит
   * в области без прокрутки.
   */
  sticky?: boolean;
  /**
   * Имя CSS-переменной с высотой панели — см. `useStickyOffset` и ADR-0016.
   *
   * Одно имя на обе половины липкости: по нему считается и точка прилипания
   * (`top`), и момент, когда полоса теряет верхние скругления. Разъехавшись,
   * они дали бы полосу, которая липнет к одной панели, а углы срезает по
   * другой.
   */
  offsetVar?: string;
  /** Доступное имя группы действий. */
  "aria-label"?: string;
  /** Дополнительные классы на полосу. */
  className?: string;
}

/** Умолчание общее с `useStickyOffset`: так эта переменная зовётся у потребителя. */
const DEFAULT_OFFSET_VAR = "--topbar-h";

const PANEL =
  "border-line z-20 mb-4 flex flex-col gap-2 border p-[10px_14px] backdrop-blur-md " +
  "shadow-[var(--shadow-1)] sm:flex-row sm:items-center sm:gap-[14px]";

/**
 * Полоса массовых действий: «Выбрано 12» и что с этим можно сделать.
 *
 * Во фронте таких полос было три, и они разошлись: разные тени (`shadow-1`
 * против `shadow-2`), разные радиусы (14 против 12), а третья собрана на
 * инлайн-стилях с захардкоженной `rgba(47,139,230,0.07)` вместо токена. Одна
 * и та же вещь в трёх видах — ровно тот случай, ради которого существует
 * дизайн-система.
 *
 * ДВА СЛОТА, А НЕ ОДИН. `children` — действия, `secondary` — правый край
 * («Выбрать все»). Разделение не косметическое: действия занимают всё
 * свободное место и прижимают `secondary` к правому краю, а на узком экране
 * `secondary` уезжает наверх, к счётчику, и действия переносятся во вторую
 * строку. Одним слотом это не выражается.
 *
 * ЛИПКОСТЬ ОТСЧИТЫВАЕТСЯ ОТ НАСТОЯЩЕЙ ВЫСОТЫ ШАПКИ, которую публикует
 * приложение (`--topbar-h` по умолчанию, имя переменной — проп). Зашитое
 * число оставляло просвет: на узких экранах шапка ниже. Прижавшись, полоса
 * теряет верхние скругления — иначе они приоткрывают фон страницы уголками
 * на стыке. Контракт и отвергнутые варианты — ADR-0016.
 *
 * Полоса объявляется группой с доступным именем: для скринридера это набор
 * действий над выбранным, а не случайные кнопки посреди страницы. Счётчик
 * стоит первым и читается вместе с именем группы.
 */
export function SelectionBar({
  count,
  countLabel,
  onClear,
  children,
  secondary,
  sticky = true,
  offsetVar = DEFAULT_OFFSET_VAR,
  "aria-label": ariaLabel,
  className,
}: SelectionBarProps) {
  const messages = useMessages();
  const label = countLabel ?? ((n: number) => messages.selectionBar.count({ count: n }));
  const { sentinelRef, isStuck } = useStickyOffset({ offsetVar });

  if (count <= 0) return null;

  return (
    <>
      {/* Маркер нулевой высоты: его пересечение и означает, что полоса встала
          на место. Отдельный узел нужен потому, что сама полоса уже липкая и
          из потока не выпадает. */}
      {sticky ? <div ref={sentinelRef} aria-hidden="true" style={{ height: 0 }} /> : null}

      <div
        role="group"
        aria-label={ariaLabel ?? messages.selectionBar.label}
        className={cn(PANEL, sticky && "sticky", className)}
        style={{
          top: sticky ? `var(${offsetVar}, 0px)` : undefined,
          background: "var(--topbar-bg)",
          borderRadius: sticky && isStuck ? "0 0 14px 14px" : "14px",
          transition: "border-radius 120ms ease",
        }}
      >
        <div className="flex items-center justify-between gap-2 sm:shrink-0">
          <div className="flex items-center gap-2.5 whitespace-nowrap">
            {onClear ? (
              <button
                type="button"
                onClick={onClear}
                aria-label={messages.selectionBar.clearSelection}
                className="text-fg-1 hover:text-fg-0 focus-visible:outline-accent-strong flex cursor-pointer items-center focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                <CloseIcon size={BUTTON_ICON_SIZE.md} />
              </button>
            ) : null}
            <span className="text-[13px] font-semibold">{label(count)}</span>
          </div>
          {secondary ? <span className="sm:hidden">{secondary}</span> : null}
        </div>

        <span className="bg-line hidden h-[22px] w-px sm:block" />

        {/*
          Действия — своя переносимая строка, которая занимает всё место между
          счётчиком и правым краем. Прежде с `sm` обёртка была `contents`, и
          кнопки вставали в общую строку полосы без переноса: на средней
          ширине flex ужимал их ниже подписи, подписи ломались на две строки,
          иконки сплющивались. В переносимой строке элемент не
          ужимается, пока влезает целиком, — лишние кнопки уходят ниже. Зазор
          между кнопками — прежние 14 px полосы, между строками — 8.
        */}
        <div className="flex flex-wrap items-center gap-2 sm:min-w-0 sm:flex-1 sm:gap-x-[14px]">
          {children}
        </div>

        {secondary ? <span className="hidden whitespace-nowrap sm:block">{secondary}</span> : null}
      </div>
    </>
  );
}
