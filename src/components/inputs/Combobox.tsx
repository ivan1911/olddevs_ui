"use client";

import type { ReactNode } from "react";
import {
  Button as AriaButton,
  ComboBox as AriaComboBox,
  Input,
  ListBox,
  ListBoxItem,
  Popover,
  type ComboBoxProps as AriaComboBoxProps,
  type Key,
} from "react-aria-components";
import { useFieldDescribedBy } from "../../hooks/useFieldDescription.js";
import { SelectIcon } from "../../icons.js";
import { cn } from "../../lib/cn.js";
import { LISTBOX_ITEM_CLASS } from "../../lib/menu.js";
import { useMessages } from "../../i18n/useMessages.js";
import { FIELD_INPUT_CLASS, FIELD_SHELL_CLASS } from "../../lib/field.js";

export interface ComboboxItem {
  /** Ключ пункта, уникальный в пределах `items`. */
  id: Key;
  /** Подпись пункта в списке и в поле ввода. */
  label: string;
  /** Правая колонка пункта: счётчик, дата, что угодно короткое. */
  meta?: ReactNode;
}

export interface ComboboxProps extends Omit<
  AriaComboBoxProps<ComboboxItem>,
  "children" | "items" | "className" | "defaultItems" | "style"
> {
  /** Пункты-подсказки; список сужается по введённому тексту. */
  items: ComboboxItem[];
  /** Плейсхолдер в пустом поле ввода. */
  placeholder?: string;
  /** Текст, когда под введённое ничего не подошло. */
  notFoundText?: string;
  /** Классы на корневой элемент. */
  className?: string;
}

/**
 * Поле с подсказками: свободный ввод плюс список.
 *
 * НЕ ЗАМЕНА `Select` и не его развитие. Разница — в том, откуда берётся
 * значение:
 *
 *   `Select`   — выбор из ЗАКРЫТОГО набора. Значения вне списка не бывает,
 *                и вводить ничего нельзя: поиск внутри (`searchable`) только
 *                фильтрует, а результат всё равно один из пунктов.
 *   `Combobox` — ввод С ПОДСКАЗКАМИ. Список помогает, но не ограничивает:
 *                значение может не совпасть ни с одним пунктом (`allowsCustomValue`).
 *
 * Отсюда правило выбора: набор известен и конечен — `Select`; пользователь
 * вправе ввести своё (тег, название, адрес) — `Combobox`. Без этой границы
 * через полгода в проекте оказываются оба вперемешку на одной задаче.
 *
 * Поведение целиком у react-aria: фильтрация, клавиатура, `aria-activedescendant`,
 * объявление числа подсказок. Кит держит вид и границу применения.
 */
export function Combobox({
  items,
  placeholder,
  notFoundText,
  menuTrigger = "focus",
  className,
  ...rest
}: ComboboxProps) {
  const messages = useMessages();

  /**
   * Описание поля из `FormField` плюс своё, если потребитель его передал.
   *
   * Тот же приём, что у `TextControl` и `NumberInput`: значения СЛИВАЮТСЯ, а не
   * заменяют друг друга. Вне `FormField` контекст пуст, спред пустой, и разметка
   * та же, что была до появления описаний.
   */
  const fieldDescribedBy = useFieldDescribedBy();
  const describedBy =
    [rest["aria-describedby"], fieldDescribedBy].filter(Boolean).join(" ") || undefined;

  return (
    /*
      `menuTrigger="focus"` вместо умолчания react-aria (`input`) — осознанно.
      При `input` список появляется только после первого напечатанного знака, и
      щелчок по полю не показывает ничего: подсказки, ради которых компонент и
      заведён, невидимы, пока не угадаешь первую букву. Проверено в браузере.

      Кнопка справа раскрывает список при любом значении пропа; менять его
      обратно потребитель вправе — например, когда подсказок тысячи и показывать
      их все бессмысленно.
    */
    <AriaComboBox
      {...rest}
      aria-describedby={describedBy}
      menuTrigger={menuTrigger}
      items={items}
      className={cn("w-full", className)}
    >
      <div className={cn(FIELD_SHELL_CLASS, "flex items-center gap-2")}>
        <Input
          placeholder={placeholder}
          data-disable-focus-ring="true"
          className={cn(FIELD_INPUT_CLASS, "min-w-0 flex-1")}
        />
        {/*
          Кнопка раскрытия — `AriaButton`, а не своя: `ComboBox` передаёт ей
          состояние через контекст react-aria, и обычная `<button>` его не
          читает — список молча не открывался бы. Та же механика, что у
          `MenuButton`.
        */}
        <AriaButton
          className="text-fg-3 hover:text-fg-1 flex shrink-0 cursor-pointer items-center outline-none"
          // Подпись у кнопки своя: без неё аудит объявляет её безымянной, а
          // подпись поля к ней не относится — поле и кнопка разные мишени.
          aria-label={messages.combobox.showSuggestions}
        >
          <SelectIcon size={14} />
        </AriaButton>
      </div>

      <Popover className="border-line-soft bg-bg-1 rounded-control w-[var(--trigger-width)] border p-1 shadow-[var(--shadow-2)]">
        <ListBox
          className="max-h-[280px] overflow-y-auto outline-none"
          renderEmptyState={() => (
            <div className="text-fg-2 px-3 py-4 text-center text-sm">
              {notFoundText ?? messages.common.notFound}
            </div>
          )}
        >
          {(item: ComboboxItem) => (
            <ListBoxItem
              id={item.id}
              textValue={item.label}
              className={cn(
                // Общая строка списка — та же, что у `Transfer` и
                // `CommandPalette`. Собственный набор здесь расходился с ней
                // отступом (`py-[9px]` против `py-1.5`) и кеглем, и списки
                // кита, поставленные рядом, различались высотой строки.
                LISTBOX_ITEM_CLASS,
                "selected:text-fg-0 justify-between gap-3"
              )}
            >
              <span className="truncate">{item.label}</span>
              {item.meta != null ? (
                <span className="text-fg-2 text-caption shrink-0">{item.meta}</span>
              ) : null}
            </ListBoxItem>
          )}
        </ListBox>
      </Popover>
    </AriaComboBox>
  );
}
