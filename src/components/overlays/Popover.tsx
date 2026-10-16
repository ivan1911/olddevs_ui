"use client";

import * as PopoverPrimitive from "@radix-ui/react-popover";
import { forwardRef, type ComponentPropsWithoutRef } from "react";
import { cn } from "../../lib/cn.js";
import { OVERLAY_LAYER } from "../../lib/overlay-layer.js";
import { withoutToolbarAxis } from "../../lib/toolbar-axis.js";

/**
 * Всплывающая панель — подложка для выпадающих списков, календарей и подсказок
 * со сложным содержимым.
 *
 * Составной API (`Popover` / `PopoverTrigger` / `PopoverContent`) здесь оправдан,
 * в отличие от `SearchSelect`: у панели нет своего содержимого, она только
 * позиционирует чужое, и «один компонент с пропсами» превратился бы в проброс
 * десятка пропсов радикса наружу.
 *
 * Поведение — `@radix-ui/react-popover` из `dependencies` пакета (ADR-0072).
 * Позиционирование у края экрана, порталы, возврат фокуса и закрытие по Escape —
 * не то, что стоит писать заново.
 */
export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverAnchor = PopoverPrimitive.Anchor;
export const PopoverClose = PopoverPrimitive.Close;

/** Портал панели: ось `Toolbar`, из которой открыта панель, внутрь не проходит. */
const Portal = withoutToolbarAxis(PopoverPrimitive.Portal);

type RadixContentProps = ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>;

/**
 * Свойства панели: всё, что принимает `Content` из Radix, и те же свойства
 * позиционирования, объявленные заново с описанием. У самой библиотеки на них
 * нет документации, а таблицы Справочника строятся из неё. Типы — ровно Radix'а
 * (`RadixContentProps[...]`): потребитель, передающий пропсы Radix, не получит
 * новой ошибки компиляции.
 */
export interface PopoverContentProps extends RadixContentProps {
  /** Отдать роль панели вашему элементу вместо встроенного `div`: свойства и `ref` сливаются с его собственными. По умолчанию `false`. */
  asChild?: RadixContentProps["asChild"];
  /** С какой стороны от триггера открывается панель: `top`, `right`, `bottom` или `left`. По умолчанию `bottom`; не хватает места — панель переходит на противоположную сторону. */
  side?: RadixContentProps["side"];
  /** Расстояние от триггера до панели, в пикселях. По умолчанию 4. */
  sideOffset?: RadixContentProps["sideOffset"];
  /** Выравнивание панели вдоль выбранной стороны: `start`, `center` или `end`. По умолчанию `start`. */
  align?: RadixContentProps["align"];
  /** Сдвиг панели вдоль выравнивания, в пикселях. По умолчанию 0. */
  alignOffset?: RadixContentProps["alignOffset"];
  /** Минимальный отступ стрелки от края панели, в пикселях. Кит стрелку не рисует: нужен, только если вы вставляете её сами. По умолчанию 0. */
  arrowPadding?: RadixContentProps["arrowPadding"];
  /** Сдвигать и переворачивать панель, чтобы она не выходила за край окна. По умолчанию `true`. */
  avoidCollisions?: RadixContentProps["avoidCollisions"];
  /** Элемент или список элементов, за границы которых панель не выходит. По умолчанию — окно браузера. */
  collisionBoundary?: RadixContentProps["collisionBoundary"];
  /** Зазор до границы, за которую панель не выходит, в пикселях: число для всех сторон или объект по сторонам. По умолчанию 0. */
  collisionPadding?: RadixContentProps["collisionPadding"];
  /** Удерживать панель на виду, когда триггер прокручен за край: `partial` — пока виден хотя бы край триггера, `always` — всегда. По умолчанию `partial`. */
  sticky?: RadixContentProps["sticky"];
  /** Скрывать панель, когда триггер полностью ушёл из видимой области. По умолчанию `false`. */
  hideWhenDetached?: RadixContentProps["hideWhenDetached"];
  /** Когда пересчитывать положение панели: `optimized` — при изменении размеров и прокрутке, `always` — на каждом кадре. По умолчанию `optimized`. */
  updatePositionStrategy?: RadixContentProps["updatePositionStrategy"];
}

export const PopoverContent = forwardRef<HTMLDivElement, PopoverContentProps>(
  function PopoverContent({ className, align = "start", sideOffset = 4, ...rest }, ref) {
    return (
      <Portal>
        <PopoverPrimitive.Content
          ref={ref}
          align={align}
          sideOffset={sideOffset}
          className={cn(
            /*
              `z-[120]` — выше слоя окон, а не ниже него.

              Поповер всегда открывают из того, что уже на экране, поэтому под
              оверлеем он не нужен никогда: при `z-50` панель уходила под
              `ModalOverlay` (`z-90`) и под ящик редактирования во фронте
              (`z-100`) — в разметке она есть, на экране её нет. Потребитель
              лечил это по месту вызова: в четырёх местах фронта висели
              `contentClassName="z-[200]"` и `"!z-[110]"`. Значит, неверным
              было умолчание, а не вызовы.
            */
            OVERLAY_LAYER.popover,
            "border-line-soft bg-bg-1 text-fg-0 shadow-2 rounded-md border p-0 outline-hidden",
            /*
              Вход — токеном кита, а не утилитами `tailwindcss-animate`.

              Здесь стояли десять классов (`animate-in`, `zoom-in-95`,
              `fade-in-0`, четыре `slide-in-from-*` и пара `-out`), и ни один из
              них не давал ни единого правила: плагина, который их объявляет, в
              зависимостях кита нет и не было. Сборка Tailwind поверх
              `styles.css` и `src/` не содержала ни одного такого селектора, а у
              открытой панели `animationName` был `none`. Три строки описывали
              анимацию, которой не существовало.

              Замена — свой токен `animate-popoverIn`, заведённый по образцу
              `tooltipIn`: 0,16 с против 0,4 с у общего `fadein`, которым входят
              меню и `Select` (`lib/menu.ts`). Общий токен подошёл бы по смыслу,
              но не по скорости: он рассчитан на подложку окна во весь экран, а
              якорная панель на четыреста миллисекунд — это заметно вяло.
              Направленный въезд со стороны триггера при этом теряется: у токенов
              кита осей `data-side` нет, а четыре токена ради четырёх сторон —
              цена выше пропажи.

              Выхода нет намеренно: `Tooltip` устроен так же (только вход), и
              закрытие панели остаётся мгновенным — ровно таким, каким было всё
              это время.
            */
            "data-[state=open]:animate-popoverIn data-[state=closed]:animate-popoverOut",
            className
          )}
          {...rest}
        />
      </Portal>
    );
  }
);
