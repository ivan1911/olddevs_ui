"use client";

import { forwardRef, useContext, type ReactNode } from "react";
import {
  Button as AriaButton,
  Menu as AriaMenu,
  MenuItem as AriaMenuItem,
  MenuSection as AriaMenuSection,
  Header,
  Popover,
  PopoverContext,
  Separator,
  type MenuItemProps as AriaMenuItemProps,
  type MenuProps as AriaMenuProps,
  type MenuSectionProps as AriaMenuSectionProps,
} from "react-aria-components";
import { CheckIcon, ChevronRightIcon } from "../../icons.js";
import { buttonClasses, type ButtonLookOptions } from "../../lib/button.js";
import { useSubmenuPlacement } from "../../hooks/useSubmenuPlacement.js";
import { cn } from "../../lib/cn.js";
import {
  MENU_ITEM_CLASS,
  MENU_ITEM_ICON_CLASS,
  MENU_ITEM_PRESSED_CLASS,
  MENU_ITEM_SELECTED_CLASS,
  MENU_ITEM_SHORTCUT_CLASS,
  MENU_ITEM_SUBMENU_CLASS,
  MENU_ITEM_TONE,
  MENU_PANEL_CLASS,
  MENU_SECTION_LABEL_CLASS,
  MENU_SEPARATOR_CLASS,
} from "../../lib/menu.js";
import type { Tone } from "../../lib/variants.js";
import { keyGlyphs } from "../content/Kbd.js";

export { MenuTrigger, SubmenuTrigger } from "react-aria-components";

export interface MenuButtonProps extends ButtonLookOptions {
  /** Подпись кнопки. С `iconOnly` не показывается. */
  children?: ReactNode;
  /** Иконка слева. С `iconOnly` — единственное содержимое. */
  icon?: ReactNode;
  /** Кнопка заблокирована: меню не открывается. */
  disabled?: boolean;
  /** Доступное имя. Обязательно, когда подписи нет. */
  "aria-label"?: string;
  /** Классы на кнопку. */
  className?: string;
}

/**
 * Кнопка, открывающая меню.
 *
 * ОТДЕЛЬНЫЙ КОМПОНЕНТ, А НЕ ОБЫЧНЫЙ `Button`, и причина техническая.
 * `MenuTrigger` передаёт триггеру свои пропы через `ButtonContext` react-aria —
 * `onPress`, `aria-expanded`, `aria-haspopup`, ref. Обычный `<button>` этого
 * контекста не читает, и меню на нём просто не открывается: ни ошибки, ни
 * предупреждения, кнопка молча ничего не делает.
 *
 * Переписать `Button` на react-aria было бы «правильнее» на первый взгляд, но
 * это прямо запрещено решением G спеки: существующие примитивы не переезжают —
 * они работают и покрыты снимками. Поэтому здесь кнопка RAC, а вид у обеих один
 * и тот же, из `lib/button.ts`. Разъехаться им нечем.
 *
 * Когда в W7 у `Button` появится `asChild`, эти два компонента можно будет
 * свести в один — но не раньше.
 */
export const MenuButton = forwardRef<HTMLButtonElement, MenuButtonProps>(function MenuButton(
  { children, icon, disabled, variant, tone, size, iconOnly, selected, className, ...rest },
  ref
) {
  return (
    <AriaButton
      ref={ref}
      isDisabled={disabled}
      className={cn(buttonClasses({ variant, tone, size, iconOnly, selected }), className)}
      {...rest}
    >
      {icon}
      {children != null && !iconOnly ? <span>{children}</span> : null}
    </AriaButton>
  );
});

export interface MenuProps<T extends object = object> extends AriaMenuProps<T> {
  /** Отступ панели от кнопки, в пикселях. */
  offset?: number;
  /**
   * Сторона, с которой панель раскрывается. Корневое меню по умолчанию — под
   * кнопкой слева (`bottom start`); вложенное, внутри `SubmenuTrigger`, —
   * сбоку от своего пункта, а на узком экране под ним. Явное значение
   * побеждает оба умолчания.
   */
  placement?: "bottom start" | "bottom end" | "top start" | "top end" | "right top" | "left top";
}

export interface MenuItemProps extends Omit<AriaMenuItemProps, "children" | "className"> {
  /** Подпись пункта. Длинная обрезается многоточием. */
  children?: ReactNode;
  /** Иконка слева. У отмеченного пункта заменяется галочкой. */
  icon?: ReactNode;
  /** Горячая клавиша справа — напоминание, а не действие. */
  shortcut?: ReactNode;
  /** Цвет подписи и иконки. `danger` — для разрушительных действий. */
  tone?: Tone;
  /** Пункт неактивен: не выбирается и пропускается при навигации. */
  disabled?: boolean;
  /** Классы на пункт. */
  className?: string;
}

/**
 * Панель меню.
 *
 * СОСТАВНОЙ API, а не массив `items`, — и это не отход от конвенции пакета:
 * `Popover` и `Tooltip` здесь уже составные. Меню с подменю, разделами и
 * пунктами-переключателями, описанное объектом, превращается в отдельный язык
 * разметки рядом с JSX, который уже есть; у `Select` items-based потому, что он
 * рисует однородные строки списка, а здесь однородности нет.
 *
 * Компонент включает в себя `Popover`, поэтому потребителю не нужно оборачивать
 * меню руками. Это же делает работоспособным `SubmenuTrigger`: он ждёт вторым
 * ребёнком именно попоувер.
 *
 * ПОДМЕНЮ раскрывается сбоку от своего пункта, и это умолчание нужно
 * выставлять самим. `SubmenuTrigger` отдаёт вложенному поповеру место
 * `end top` через контекст, но явный проп поповера важнее контекста, а корневое
 * умолчание кита `bottom start` — как раз явный проп: вложенное меню без
 * особого случая раскрывалось бы под пунктом. Поэтому `Menu` узнаёт подменю по
 * контексту (`trigger: "SubmenuTrigger"`, публичное поле `PopoverContext`) и
 * спрашивает общий хук `useSubmenuPlacement` — тот же, что в Редакторе: на
 * телефоне подменю встаёт под пунктом, на широком экране кит своего места не
 * передаёт, и действует `end top` react-aria — сбоку, с учётом направления
 * письма. Переворот у края экрана
 * (`shouldFlip`) и «Прицел» — движение курсора к подменю по диагонали не
 * закрывает его — остаются у react-aria, кит их не трогает.
 *
 * ПЕРЕКЛЮЧАТЕЛИ — через выбор на разделе, а не через `checked` у пункта:
 *
 *     <MenuSection label="Вид" selectionMode="multiple"
 *                  selectedKeys={keys} onSelectionChange={setKeys}>
 *       <MenuItem id="dense">Плотно</MenuItem>
 *     </MenuSection>
 *
 * Так устроен react-aria, и так правильно: роли `menuitemcheckbox`/
 * `menuitemradio` и атрибут `aria-checked` он проставляет сам. Проп `checked` у
 * пункта пришлось бы подпирать этими атрибутами вручную — то есть повторять
 * чужую работу и расходиться с ней при первом же обновлении.
 */
export const Menu = forwardRef<HTMLDivElement, MenuProps>(function Menu(
  { offset = 6, placement, className, ...rest },
  ref
) {
  const popoverContext = useContext(PopoverContext);
  // Контекст бывает пустым, со слотами или с самими пропами поповера; «подменю»
  // говорит только последнее.
  const isSubmenu =
    popoverContext != null &&
    "trigger" in popoverContext &&
    popoverContext.trigger === "SubmenuTrigger";
  const submenuPlacement = useSubmenuPlacement();
  // Широкий экран — место не передаётся вовсе: тогда действует `end top` из
  // контекста `SubmenuTrigger`. Оно логическое, и при письме справа налево
  // подменю раскрывается слева, а `right top` хука уводило бы его вправо.
  const resolvedPlacement =
    placement ??
    (isSubmenu
      ? submenuPlacement === "bottom start"
        ? submenuPlacement
        : undefined
      : "bottom start");

  return (
    <Popover
      offset={offset}
      placement={resolvedPlacement}
      className={cn(MENU_PANEL_CLASS, className)}
    >
      {/*
        `data-disable-focus-ring` — механизм пакета, тот же, что у `TextControl`.
        Глобальное правило `:focus-visible` в styles.css рисует контур вокруг
        любого фокусируемого элемента, а react-aria при открытии ставит фокус на
        саму панель меню: без этого атрибута пользователь видел бы синюю рамку
        вокруг всего меню вместо подсветки пункта. Класс `outline-none` тут не
        помогает — у глобального правила `!important` нет, но специфичность
        псевдокласса выше утилиты.
      */}
      <AriaMenu ref={ref} data-disable-focus-ring="true" className="outline-none" {...rest} />
    </Popover>
  );
});

/**
 * Пункт меню.
 *
 * Вид берётся из общей таблицы `lib/menu.ts` — той же, из которой собран
 * `ContextMenu` на Radix. Состояния заданы вариантами (`hover:`, `selected:`,
 * `pressed:`), а не рендер-пропом: пункт — это сам элемент с `data-*`, а не
 * его потомок, и красить его классом правильнее, чем условием в JS.
 */
export const MenuItem = forwardRef<HTMLDivElement, MenuItemProps>(function MenuItem(
  { children, icon, shortcut, tone = "neutral", disabled, className, ...rest },
  ref
) {
  return (
    <AriaMenuItem
      ref={ref}
      isDisabled={disabled}
      // Пункт получает настоящий DOM-фокус, и глобальное правило
      // `:focus-visible` рисует вокруг него контур. В меню подсветка задана
      // подложкой, и контур поверх неё — второй курсор на том же месте.
      // Тот же атрибут стоит у пунктов `ContextMenu`: без него две реализации
      // выглядят по-разному, и снимок «два меню рядом» это показывает.
      data-disable-focus-ring="true"
      className={cn(
        MENU_ITEM_CLASS,
        MENU_ITEM_TONE[tone],
        MENU_ITEM_SELECTED_CLASS,
        MENU_ITEM_PRESSED_CLASS,
        className
      )}
      {...rest}
    >
      {({ isSelected, hasSubmenu }) => (
        <>
          {(icon != null || isSelected) && (
            <span className={MENU_ITEM_ICON_CLASS}>
              {isSelected ? <CheckIcon size={14} strokeWidth={3} /> : icon}
            </span>
          )}
          <span className="truncate">{children}</span>
          {shortcut != null && (
            <kbd className={MENU_ITEM_SHORTCUT_CLASS}>{keyGlyphs(shortcut)}</kbd>
          )}
          {hasSubmenu && (
            <span className={MENU_ITEM_SUBMENU_CLASS}>
              <ChevronRightIcon size={14} />
            </span>
          )}
        </>
      )}
    </AriaMenuItem>
  );
});

export interface MenuSectionProps<T extends object = object> extends Omit<
  AriaMenuSectionProps<T>,
  "className" | "children"
> {
  /** Подпись раздела. Без неё раздел остаётся просто группировкой. */
  label?: ReactNode;
  /**
   * Пункты раздела — только статической разметкой.
   *
   * У react-aria `children` может быть ещё и функцией: так описываются
   * динамические коллекции, где пункты приходят массивом. Кит эту форму не
   * пробрасывает — он весь построен на составном API, и второй способ задавать
   * то же самое означал бы два языка разметки в одном компоненте.
   */
  children?: ReactNode;
  /** Классы на раздел. */
  className?: string;
}

/** Раздел меню. Он же носитель выбора для пунктов-переключателей. */
export const MenuSection = forwardRef<HTMLElement, MenuSectionProps>(function MenuSection(
  { label, children, className, ...rest },
  ref
) {
  return (
    <AriaMenuSection ref={ref} className={className} {...rest}>
      {label != null && <Header className={MENU_SECTION_LABEL_CLASS}>{label}</Header>}
      {children}
    </AriaMenuSection>
  );
});

/** Разделитель между группами пунктов. */
export function MenuSeparator({
  className,
}: {
  /** Классы на линию разделителя. */
  className?: string;
}) {
  return <Separator className={cn(MENU_SEPARATOR_CLASS, className)} />;
}
