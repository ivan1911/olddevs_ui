"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, type ReactNode } from "react";
import {
  Toolbar as AriaToolbar,
  SeparatorContext,
  ToggleButtonGroupContext,
} from "react-aria-components";
import type { AccessibleName } from "../../lib/accessible-name.js";
import { cn } from "../../lib/cn.js";

interface ToolbarBaseProps {
  /** Действия панели и `Separator` между их группами. */
  children?: ReactNode;
  /**
   * Куда идут стрелки: `horizontal` — влево и вправо, `vertical` — вверх и вниз.
   * Вертикальная панель кладёт действия столбцом (боковая панель у полотна).
   */
  orientation?: "horizontal" | "vertical";
  /** Классы на корневой элемент панели. */
  className?: string;
}

/**
 * Имя панели обязательно: либо строкой, либо ссылкой на видимый заголовок.
 *
 * Безымянная `toolbar` объявляется скринридером просто «панель инструментов» —
 * без указания, к чему она относится, а на экране их обычно несколько. Тип
 * требует ровно одно из двух — общее правило кита (`AccessibleName`).
 */
export type ToolbarProps = ToolbarBaseProps & AccessibleName;

/**
 * Что считается «действием панели» для Home и End: тот же круг, по которому
 * идут стрелки `useToolbar`, — любой фокусируемый узел, включая `tabindex="-1"`
 * внутри вложенных групп, а не только табстопы.
 *
 * Селектор и проверки повторяют `isFocusable` react-aria (видимость, `inert`,
 * `hidden`): сам хелпер пакет наружу не отдаёт, а разойтись с ним нельзя —
 * иначе Home ставит фокус туда, где стрелки не останавливаются. Поэтому
 * `aria-disabled` здесь НЕ отсеивается: стрелки на таком действии стоят, и
 * APG советует оставлять недоступные действия панели фокусируемыми.
 */
const FOCUSABLE = [
  "input:not([disabled]):not([type=hidden])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "button:not([disabled])",
  "a[href]",
  "area[href]",
  "summary",
  "iframe",
  "object",
  "embed",
  "audio[controls]",
  "video[controls]",
  '[contenteditable]:not([contenteditable^="false"])',
  "[tabindex]:not([disabled])",
]
  .map((selector) => `${selector}:not([hidden])`)
  .join(", ");

/**
 * Там, где Home и End принадлежат самому элементу: каретка в поле, край
 * ползунка, начало и конец списка, вкладок, сетки. Перехватить их здесь значит
 * сломать ввод или навигацию виджета.
 *
 * Составные виджеты перечислены поимённо, а не узнаются по `defaultPrevented`:
 * слушатель висит на элементе панели и срабатывает РАНЬШЕ их обработчиков —
 * React слушает клавиши на корне, куда событие всплывает позже. Поля ввода —
 * только текстовые: у флажка, радио и кнопки-`input` каретки нет, и клавиши
 * должны вести к краям панели.
 */
const OWN_HOME_END = [
  "input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]):not([type=reset]):not([type=image]):not([type=file]):not([type=color])",
  "textarea",
  "select",
  '[contenteditable=""]',
  '[contenteditable="true"]',
  '[role="textbox"]',
  '[role="searchbox"]',
  '[role="combobox"]',
  '[role="slider"]',
  '[role="spinbutton"]',
  '[role="listbox"]',
  '[role="menu"]',
  '[role="menubar"]',
  '[role="tablist"]',
  '[role="grid"]',
  '[role="treegrid"]',
  '[role="tree"]',
].join(", ");

/** Видим ли узел — так же, как его видит обход стрелок react-aria. */
function isVisible(el: HTMLElement): boolean {
  if (el.closest("[data-react-aria-prevent-focus]")) return false;
  if (typeof el.checkVisibility === "function")
    return el.checkVisibility({ visibilityProperty: true });
  // jsdom и старые движки без `checkVisibility`: стиль по цепочке предков.
  const view = el.ownerDocument.defaultView;
  if (!view) return true;
  const { visibility } = view.getComputedStyle(el);
  if (visibility === "hidden" || visibility === "collapse") return false;
  for (let node: HTMLElement | null = el; node; node = node.parentElement) {
    if (node.hidden || view.getComputedStyle(node).display === "none") return false;
  }
  return true;
}

function actions(toolbar: HTMLElement): HTMLElement[] {
  return Array.from(toolbar.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.closest("[inert]") && isVisible(el)
  );
}

/**
 * Панель действий с одной остановкой табуляции.
 *
 * ПОВЕДЕНИЕ — ОТ `Toolbar` REACT-ARIA, и оно не роуминг табиндекса. Хук
 * перехватывает клавиши на погружении: стрелка по оси панели двигает фокус на
 * соседний фокусируемый узел, а Tab уводит фокус на край панели и отдаёт его
 * браузеру, поэтому панель входит и выходит одной остановкой. Уходя, панель
 * запоминает, где был фокус, и возвращает его туда же. Всё, что вынесено
 * порталом (панель `Menu`, `Popover`, `ContextMenu`), в DOM панели не лежит,
 * и стрелки внутри открытого меню остаются меню.
 *
 * HOME И END ДОБАВЛЕНЫ ЗДЕСЬ: `useToolbar` их не обрабатывает, хотя образец
 * панели инструментов в APG их требует. Берём край среди тех же элементов,
 * что обходят стрелки. В полях ввода, на ползунках и в составных виджетах
 * (вкладки, сетка, список) клавиши остаются за ними.
 *
 * СТРЕЛКИ — ТОЛЬКО ПО ОСИ ПАНЕЛИ. Поперечные клавиши не трогаются, поэтому
 * в горизонтальной панели `ArrowDown` по-прежнему открывает `Menu`, а в
 * вертикальной — нет: стрелки вниз там заняты обходом, меню открывает Enter
 * или пробел.
 *
 * РАЗДЕЛИТЕЛЬ И `ToggleGroup` ПОЛУЧАЮТ ОСЬ ЧЕРЕЗ КОНТЕКСТЫ react-aria. Черта
 * между группами лежит поперёк оси панели, поэтому `Separator` без своего
 * `orientation` ложится вертикально в горизонтальной панели и наоборот.
 * Контекст идёт и через порталы, поэтому оверлеи кита (`PopoverContent`,
 * `Dialog`, `Drawer`) обнуляют его на своей границе — `withoutToolbarAxis`.
 * В чужом портале (Radix напрямую) `Separator` задают с `orientation` явно.
 */
export const Toolbar = forwardRef<HTMLDivElement, ToolbarProps>(function Toolbar(
  { orientation = "horizontal", className, children, ...rest },
  forwardedRef
) {
  const vertical = orientation === "vertical";
  // Значения контекстов — по оси, а не новым объектом на каждый рендер панели:
  // иначе мемоизированные `Separator` и `ToggleGroup` внутри перерисовывались бы зря.
  const groupContext = useMemo(() => ({ orientation }), [orientation]);
  const separatorContext = useMemo(
    () => ({ orientation: vertical ? ("horizontal" as const) : ("vertical" as const) }),
    [vertical]
  );

  const ref = useRef<HTMLDivElement>(null);
  // Своя ссылка нужна слушателю Home и End; наружу отдаётся тот же узел.
  useImperativeHandle(forwardedRef, () => ref.current as HTMLDivElement, []);

  /*
    Слушатель нативный, а не проп: `Toolbar` react-aria не принимает
    `onKeyDown`. Заодно событие из портала сюда не доходит вовсе — DOM-всплытие
    не знает о дереве React, и проверка «внутри ли панели» не нужна.
  */
  useEffect(() => {
    const toolbar = ref.current;
    if (!toolbar) return;
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Home" && event.key !== "End") return;
      if (
        event.defaultPrevented ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey
      )
        return;
      const target = event.target as HTMLElement;
      // Виджет СНАРУЖИ панели (строка списка, корень редактора) клавиши у неё
      // не отнимает: в счёт идёт только то, что лежит внутри.
      const owner = target.closest(OWN_HOME_END);
      if (owner && toolbar.contains(owner)) return;
      const list = actions(toolbar);
      const next = event.key === "Home" ? list[0] : list[list.length - 1];
      if (!next) return;
      event.preventDefault();
      next.focus();
    };
    toolbar.addEventListener("keydown", onKeyDown);
    return () => toolbar.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <ToggleButtonGroupContext.Provider value={groupContext}>
      <SeparatorContext.Provider value={separatorContext}>
        <AriaToolbar
          {...rest}
          orientation={orientation}
          ref={ref}
          className={cn(
            "flex gap-1.5",
            /*
              Вертикальная черта иначе схлопывается в ноль. У `Separator` высота
              `h-full`, и против строки без заданной высоты процент не считается:
              значение перестаёт быть `auto`, и `self-stretch` не растягивает
              черту до высоты строки. jsdom раскладки не считает — поймано в
              браузере. Правило касается прямых детей: так черту кладут между
              группами.
            */
            "[&>[role=separator][aria-orientation=vertical]]:h-auto",
            // Вертикальная панель по ширине содержимого: боковая колонка не должна
            // растягиваться на всю раскладку, а черта (`w-full`) — на всю её ширину.
            vertical ? "w-fit flex-col items-start" : "flex-row flex-wrap items-center",
            className
          )}
        >
          {children}
        </AriaToolbar>
      </SeparatorContext.Provider>
    </ToggleButtonGroupContext.Provider>
  );
});
