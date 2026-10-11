"use client";

import * as Primitive from "@radix-ui/react-context-menu";
import { forwardRef, type ReactNode } from "react";
import { CheckIcon, ChevronRightIcon } from "../../icons.js";
import { cn } from "../../lib/cn.js";
import {
  MENU_ITEM_CLASS,
  MENU_ITEM_ICON_CLASS,
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

/**
 * Контекстное меню — по правой кнопке мыши и по клавише контекстного меню.
 *
 * СОБРАНО НА RADIX, А НЕ НА react-aria, и это вынужденно: контекстного меню
 * react-aria не даёт вовсе. Семейство Radix в пакете уже есть (диалог,
 * попоувер, тултип), поэтому новая зависимость не приводит нового поставщика.
 *
 * Вид берётся из той же таблицы `lib/menu.ts`, что и у `Menu` на react-aria.
 * Это единственное, что удерживает два меню от расхождения: библиотеки разные,
 * а пользователь должен видеть одно и то же меню независимо от того, открыл он
 * его кнопкой или правой кнопкой мыши. Сторожит снимок «два меню рядом».
 */
export const ContextMenu = Primitive.Root;
export const ContextMenuTrigger = Primitive.Trigger;
export const ContextMenuSub = Primitive.Sub;

export interface ContextMenuContentProps {
  /** Пункты, разделы и разделители меню. */
  children?: ReactNode;
  /** Классы на панель меню — например, ширина. */
  className?: string;
}

/** Панель контекстного меню. Портал внутри — как у `Menu`. */
export const ContextMenuContent = forwardRef<HTMLDivElement, ContextMenuContentProps>(
  function ContextMenuContent({ children, className }, ref) {
    return (
      <Primitive.Portal>
        <Primitive.Content ref={ref} className={cn(MENU_PANEL_CLASS, className)}>
          {children}
        </Primitive.Content>
      </Primitive.Portal>
    );
  }
);

export interface ContextMenuItemProps {
  /** Подпись пункта. Длинная обрезается многоточием. */
  children?: ReactNode;
  /** Иконка слева от подписи. */
  icon?: ReactNode;
  /** Горячая клавиша справа — напоминание, а не действие. */
  shortcut?: ReactNode;
  /** Цвет подписи и иконки. `danger` — для разрушительных действий. */
  tone?: Tone;
  /** Пункт неактивен: не выбирается и пропускается при навигации. */
  disabled?: boolean;
  /** Пункт выбран мышью или клавишей; меню после этого закрывается. */
  onSelect?: () => void;
  /** Классы на пункт. */
  className?: string;
}

export const ContextMenuItem = forwardRef<HTMLDivElement, ContextMenuItemProps>(
  function ContextMenuItem(
    { children, icon, shortcut, tone = "neutral", disabled, onSelect, className },
    ref
  ) {
    return (
      <Primitive.Item
        ref={ref}
        disabled={disabled}
        onSelect={onSelect}
        // Пункт Radix получает настоящий DOM-фокус, и глобальное правило
        // `:focus-visible` рисует вокруг него контур — которого у пункта
        // react-aria нет, потому что подсветка там задана подложкой. Без этого
        // атрибута два меню выглядят по-разному, и снимок «два меню рядом»
        // ловит это первым же прогоном.
        data-disable-focus-ring="true"
        className={cn(MENU_ITEM_CLASS, MENU_ITEM_TONE[tone], className)}
      >
        {icon != null && <span className={MENU_ITEM_ICON_CLASS}>{icon}</span>}
        <span className="truncate">{children}</span>
        {shortcut != null && <kbd className={MENU_ITEM_SHORTCUT_CLASS}>{keyGlyphs(shortcut)}</kbd>}
      </Primitive.Item>
    );
  }
);

export interface ContextMenuCheckboxItemProps extends Omit<ContextMenuItemProps, "icon"> {
  /** Отмечен ли пункт. Управляется снаружи: меняется только вместе с этим свойством. */
  checked?: boolean;
  /** Пользователь переключил пункт; приходит новое значение. */
  onCheckedChange?: (checked: boolean) => void;
}

/**
 * Пункт-переключатель.
 *
 * Здесь `checked`/`onCheckedChange` у самого пункта — в отличие от `Menu`, где
 * переключатели заданы выбором на разделе. Расхождение не по прихоти: так
 * устроены сами библиотеки, и подгонять одну под другую значило бы городить
 * поверх неё свой слой состояния. Роль `menuitemcheckbox` и `aria-checked`
 * каждая из них проставляет сама — а это и есть то, ради чего они взяты.
 */
export const ContextMenuCheckboxItem = forwardRef<HTMLDivElement, ContextMenuCheckboxItemProps>(
  function ContextMenuCheckboxItem(
    { children, shortcut, tone = "neutral", disabled, checked, onCheckedChange, className },
    ref
  ) {
    return (
      <Primitive.CheckboxItem
        ref={ref}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        data-disable-focus-ring="true"
        className={cn(MENU_ITEM_CLASS, MENU_ITEM_TONE[tone], MENU_ITEM_SELECTED_CLASS, className)}
      >
        <span className={MENU_ITEM_ICON_CLASS}>
          <Primitive.ItemIndicator>
            <CheckIcon size={14} strokeWidth={3} />
          </Primitive.ItemIndicator>
        </span>
        <span className="truncate">{children}</span>
        {shortcut != null && <kbd className={MENU_ITEM_SHORTCUT_CLASS}>{keyGlyphs(shortcut)}</kbd>}
      </Primitive.CheckboxItem>
    );
  }
);

export interface ContextMenuRadioGroupProps {
  /** Пункты `ContextMenuRadioItem` этой группы. */
  children?: ReactNode;
  /** Выбранное значение. `undefined` — не выбрано ничего. */
  value?: string;
  /** Выбран другой пункт; приходит его `value`. */
  onValueChange?: (value: string) => void;
}

/**
 * Раздел одиночного выбора.
 *
 * Выбор задан НА РАЗДЕЛЕ, а не на пункте, — в отличие от соседнего
 * переключателя, где `checked` живёт у самого пункта. Разница не косметическая:
 * «выбран ровно один» — свойство группы, и только зная группу, Radix может
 * проставить `aria-checked="false"` остальным. Пункт, знающий лишь про себя,
 * объявил бы невыбранных просто командами.
 *
 * Берите это, а не `ContextMenuCheckboxItem`, везде, где значение одно:
 * флажок обещает, что можно отметить несколько, и обещание это ложное.
 */
export function ContextMenuRadioGroup({
  children,
  value,
  onValueChange,
}: ContextMenuRadioGroupProps) {
  return (
    <Primitive.RadioGroup value={value} onValueChange={onValueChange}>
      {children}
    </Primitive.RadioGroup>
  );
}

export interface ContextMenuRadioItemProps extends Omit<ContextMenuItemProps, "icon" | "onSelect"> {
  /** Значение пункта. Совпало со значением раздела — пункт выбран. */
  value: string;
}

/**
 * Пункт одиночного выбора. Живёт только внутри `ContextMenuRadioGroup`.
 *
 * Роль `menuitemradio` и `aria-checked` проставляет Radix — ради этого он и
 * взят. Отметку рисует индикатор в том же слоте, что иконка у обычного пункта,
 * поэтому своей иконки у пункта выбора нет: две иконки слева читались бы как
 * два разных состояния.
 */
export const ContextMenuRadioItem = forwardRef<HTMLDivElement, ContextMenuRadioItemProps>(
  function ContextMenuRadioItem(
    { children, shortcut, tone = "neutral", disabled, value, className },
    ref
  ) {
    return (
      <Primitive.RadioItem
        ref={ref}
        value={value}
        disabled={disabled}
        data-disable-focus-ring="true"
        className={cn(MENU_ITEM_CLASS, MENU_ITEM_TONE[tone], MENU_ITEM_SELECTED_CLASS, className)}
      >
        <span className={MENU_ITEM_ICON_CLASS}>
          <Primitive.ItemIndicator>
            <CheckIcon size={14} strokeWidth={3} />
          </Primitive.ItemIndicator>
        </span>
        <span className="truncate">{children}</span>
        {shortcut != null && <kbd className={MENU_ITEM_SHORTCUT_CLASS}>{keyGlyphs(shortcut)}</kbd>}
      </Primitive.RadioItem>
    );
  }
);

/** Подпись раздела. */
export function ContextMenuLabel({
  children,
  className,
}: {
  /** Текст подписи раздела. */
  children?: ReactNode;
  /** Классы на подпись. */
  className?: string;
}) {
  return (
    <Primitive.Label className={cn(MENU_SECTION_LABEL_CLASS, className)}>
      {children}
    </Primitive.Label>
  );
}

/** Разделитель. */
export function ContextMenuSeparator({
  className,
}: {
  /** Классы на линию разделителя. */
  className?: string;
}) {
  return <Primitive.Separator className={cn(MENU_SEPARATOR_CLASS, className)} />;
}

/** Пункт, открывающий подменю. */
export function ContextMenuSubTrigger({
  children,
  icon,
  className,
}: {
  /** Подпись пункта. Длинная обрезается многоточием. */
  children?: ReactNode;
  /** Иконка слева от подписи. */
  icon?: ReactNode;
  /** Классы на пункт. */
  className?: string;
}) {
  return (
    <Primitive.SubTrigger
      data-disable-focus-ring="true"
      className={cn(MENU_ITEM_CLASS, MENU_ITEM_TONE.neutral, className)}
    >
      {icon != null && <span className={MENU_ITEM_ICON_CLASS}>{icon}</span>}
      <span className="truncate">{children}</span>
      <span className={MENU_ITEM_SUBMENU_CLASS}>
        <ChevronRightIcon size={14} />
      </span>
    </Primitive.SubTrigger>
  );
}

/** Панель подменю. */
export function ContextMenuSubContent({
  children,
  className,
}: {
  /** Пункты подменю. */
  children?: ReactNode;
  /** Классы на панель подменю. */
  className?: string;
}) {
  return (
    <Primitive.Portal>
      <Primitive.SubContent className={cn(MENU_PANEL_CLASS, className)}>
        {children}
      </Primitive.SubContent>
    </Primitive.Portal>
  );
}
