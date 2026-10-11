"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useRef, type ReactNode } from "react";
import { cn } from "../../lib/cn.js";
import { useOpenerFocus } from "../../hooks/useOpenerFocus.js";
import { hasOpenAriaOverlay, OVERLAY_LAYER } from "../../lib/overlay-layer.js";
import { useOverlayLayer } from "../../hooks/useOverlayLayer.js";
import { withoutToolbarAxis } from "../../lib/toolbar-axis.js";
import { ModalHeader } from "./ModalHeader.js";

export type DrawerSide = "right" | "left" | "bottom";

/** Портал ящика: ось `Toolbar`, из которой открыт ящик, внутрь не проходит. */
const Portal = withoutToolbarAxis(DialogPrimitive.Portal);

export interface DrawerProps {
  /** Показан ли ящик. */
  open: boolean;
  /** Закрытие: кнопка закрытия, Escape и клик мимо — всё сюда. */
  onClose: () => void;
  /** Заголовок. Он же — доступное имя ящика. */
  title: ReactNode;
  /** Строка под заголовком в шапке: слаг, дата, счётчик. */
  subtitle?: ReactNode;
  /** С какого края выезжает ящик: `right`, `left` или `bottom`. По умолчанию `right`; на узком экране боковой ящик становится нижним. */
  side?: DrawerSide;
  /** Ширина у боковых, высота у нижнего. */
  size?: "sm" | "md" | "lg";
  /** Подвал: кнопки действий. Прижат к низу и не уезжает при прокрутке. */
  footer?: ReactNode;
  /** Доступное имя кнопки закрытия. Не задано — «Закрыть» из каталога сообщений. */
  closeLabel?: string;
  /** Классы на саму панель ящика — например, свою ширину. */
  className?: string;
  /**
   * Слой ящика. Отдельные оверлеи приложения живут выше обычных.
   *
   * Проп тот же и с тем же умолчанием, что у `Dialog`: оба стоят на одном
   * примитиве Radix и оба обязаны уметь встать над чужим оверлеем. Пока его
   * здесь не было, потребитель с собственным слоем выше `z-90` получал ящик
   * ПОД своим же окном — причём подложку было не поднять вовсе, она брала
   * `z-90` из зашитого класса.
   */
  zIndex?: string;
  /** Содержимое ящика между шапкой и подвалом; прокручивается внутри. */
  children?: ReactNode;
}

const SIDE_CLASS: Record<DrawerSide, string> = {
  right: "inset-y-0 right-0 h-full border-l",
  left: "inset-y-0 left-0 h-full border-r",
  bottom: "inset-x-0 bottom-0 w-full rounded-t-lg border-t",
};

const SIZE_CLASS: Record<DrawerSide, Record<"sm" | "md" | "lg", string>> = {
  right: { sm: "w-[320px]", md: "w-[420px]", lg: "w-[560px]" },
  left: { sm: "w-[320px]", md: "w-[420px]", lg: "w-[560px]" },
  bottom: { sm: "h-[40vh]", md: "h-[60vh]", lg: "h-[85vh]" },
};

/**
 * Выезжающая панель: те же обязанности, что у `Dialog`, другая геометрия.
 *
 * СТОИТ НА ТОМ ЖЕ `@radix-ui/react-dialog`, а не заводит зависимость. Ящик — это
 * модальный слой: ловушка фокуса, возврат фокуса, `aria-modal`, портал, Escape
 * по стеку слоёв и замок прокрутки нужны ему ровно так же. Отличается он только
 * тем, откуда выезжает.
 *
 * По той же причине здесь НЕ зовётся `useScrollLock`: замок внутри Radix
 * (`react-remove-scroll`), и второй счётчик на том же `body` не видел бы первый.
 *
 * **На узком экране боковой ящик становится нижним.** Панель в 420 пикселей на
 * экране в 360 — это не «узкая панель», а окно, вылезшее за край: пользователь
 * видит обрезанное содержимое и не может прокрутить его вбок. Переключение
 * сделано классами (`max-sm:`), а не замером ширины в JS: замер даёт скачок
 * после первого кадра, и панель на глазах перепрыгивает.
 */
export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  side = "right",
  size = "md",
  footer,
  closeLabel,
  className,
  zIndex = OVERLAY_LAYER.modal,
  children,
}: DrawerProps) {
  /*
   * Кто открыл ящик — тому и вернуть фокус при закрытии.
   *
   * Radix сам этого не делает, когда открытием управляют снаружи (`open` без
   * `Dialog.Trigger`): возвращать ему некуда, и фокус уезжает на `body`.
   * Пользователь с клавиатуры после закрытия оказывается в начале страницы.
   *
   * Ровно та же связка стоит в `Dialog` — ящик просто про неё забыли.
   */
  const contentRef = useRef<HTMLDivElement | null>(null);
  const { remember, restore } = useOpenerFocus(open, contentRef);
  // Слой состоит в общем стеке — ADR-0041 обещает это для ВСЕХ модальных
  // слоёв кита, а не только для подложки.
  useOverlayLayer(open, contentRef);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Portal>
        {/*
          ПАНЕЛЬ ЛЕЖИТ ВНУТРИ ПОДЛОЖКИ, А НЕ РЯДОМ С НЕЙ. Выглядит одинаково,
          но это не косметика — от этого зависит прокрутка внутри ящика.

          Замок прокрутки (`react-remove-scroll`) Radix вешает на ОВЕРЛЕЙ, а не
          на контент: `shards: [contentRef]` в `DialogOverlayImpl`. Пока панель
          была СОСЕДОМ подложки, она оказывалась вне поддерева замка — и любая
          всплывающая панель, открытая изнутри ящика, теряла колесо мыши.
          Событие не доходило до проверки «а можно ли тут крутить»: замок гасил
          его в ветке «цель вне шардов» безусловно.

          Видно это становится не сразу: панель `Select` с тремя пунктами в
          высоту укладывается, и крутить в ней нечего. Дефект вылез на списке
          из одиннадцати у продукта-потребителя.

          Вложенность лечит это тем же способом, каким `Dialog` кита живёт с
          самого начала: содержимое ящика попадает в React-поддерево замка, а
          портированная панель наследует его через дерево React, а не через
          DOM. Геометрию это не трогает: подложка — `fixed inset-0`, то есть
          ровно вьюпорт, и `fixed` у панели считается от того же прямоугольника.
        */}
        <DialogPrimitive.Overlay
          className={cn("animate-fadein data-[state=closed]:animate-fadeout fixed inset-0", zIndex)}
          style={{ background: "var(--overlay-scrim)", backdropFilter: "blur(4px)" }}
        >
          <DialogPrimitive.Content
            ref={contentRef}
            /*
            Заслон против ЧУЖОГО Escape — тот же, что у `Dialog`, и до волны 26
            его здесь не было вовсе.

            Radix слушает `keydown` на `document` в фазе ЗАХВАТА, поэтому
            `stopPropagation` внутри react-aria до неё не доходит принципиально,
            а слой RAC в стек Radix не входит. Один Escape при открытом меню
            внутри ящика закрывал и меню, и ящик — вместе с несохранённой
            формой. Разбор — ADR-0041.
          */
            onEscapeKeyDown={(event) => {
              if (hasOpenAriaOverlay()) event.preventDefault();
            }}
            // Обе проверки — «не `body`» и «не содержимое самого слоя» — переехали
            // в `useOpenerFocus` вместе с остальной связкой: третья копия и была
            // поводом её вынести.
            onOpenAutoFocus={remember}
            onCloseAutoFocus={restore}
            className={cn(
              "bg-bg-1 border-line-soft fixed flex flex-col shadow-[var(--shadow-2)] outline-none",
              zIndex,
              SIDE_CLASS[side],
              SIZE_CLASS[side][size],
              // Узкий экран: боковой ящик уезжает вниз во всю ширину.
              side !== "bottom" &&
                "max-sm:inset-x-0 max-sm:top-auto max-sm:bottom-0 max-sm:h-[70vh] max-sm:w-full max-sm:rounded-t-lg max-sm:border-t max-sm:border-r-0 max-sm:border-l-0",
              className
            )}
          >
            {/*
            Заголовок обязан быть `Dialog.Title` из Radix, а не своим `h2`:
            из него берётся `aria-labelledby`, и без него ящик остаётся
            безымянным — скринридер объявит «диалог» и замолчит. Та же связка,
            что в `Dialog`.
          */}
            <ModalHeader
              title={title}
              subtitle={subtitle}
              onClose={onClose}
              closeLabel={closeLabel}
              titleComponent={DialogPrimitive.Title}
              className="border-line-soft shrink-0 border-b px-4 py-3"
            />

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">{children}</div>

            {footer ? (
              <div className="border-line-soft flex shrink-0 items-center justify-end gap-2 border-t px-4 py-3">
                {footer}
              </div>
            ) : null}
          </DialogPrimitive.Content>
        </DialogPrimitive.Overlay>
      </Portal>
    </DialogPrimitive.Root>
  );
}
