"use client";

import { useEffect, useState, type MouseEventHandler, type ReactNode } from "react";
import { useMessages } from "../../i18n/useMessages.js";
import { ChevronDownIcon } from "../../icons.js";
import type { Size, Tone, Variant } from "../../lib/variants.js";
import { Button } from "./Button.js";
import { ButtonGroup } from "./ButtonGroup.js";
import { Menu, MenuButton, MenuTrigger } from "../overlays/Menu.js";
import { BUTTON_ICON_SIZE } from "../../lib/button.js";

export interface SplitButtonProps {
  /**
   * Подпись главного действия — строка, а не узел.
   *
   * Это единственное ограничение компонента по сравнению с `Button`, и оно
   * следует из его устройства: из подписи строится доступное имя раскрывателя
   * («Другие действия: Экспорт»). Узел дал бы имя, которого нет, — или
   * потребовал бы второго пропа с той же подписью строкой, то есть двух мест,
   * где написано одно и то же, и они разошлись бы при первой правке.
   */
  label: string;
  /** Иконка слева у главного действия. */
  icon?: ReactNode;
  /** Главное действие. Раскрыватель его не зовёт. */
  onClick?: MouseEventHandler<HTMLButtonElement>;
  /**
   * Гасит обе кнопки сразу.
   *
   * Раздельной выключенности здесь нет намеренно: живой раскрыватель при мёртвом
   * действии предлагает варианты того, что сделать нельзя.
   */
  disabled?: boolean;
  /**
   * Главное действие отправляется: кольцо вместо иконки, `aria-busy`.
   *
   * Раскрыватель на это время тоже гаснет — по той же причине, что и при
   * `disabled`. Открытое меню посреди отправки предлагает второй способ сделать
   * то, что уже делается.
   */
  loading?: boolean;
  /** Подача обеих кнопок: оси словаря те же, что у `Button`. Без значения действует умолчание `Button`. */
  variant?: Variant;
  /** Тон обеих кнопок: ось словаря та же, что у `Button`. Без значения действует умолчание `Button`. */
  tone?: Tone;
  /** Размер обеих кнопок: ось словаря та же, что у `Button`. Без значения действует умолчание `Button`. */
  size?: Size;
  /** Пункты меню: `MenuItem`, `MenuSection`, `MenuSeparator`. */
  children?: ReactNode;
  /**
   * Сторона, с которой раскрывается панель меню.
   *
   * Четыре значения из шести, которые умеет `Menu`: боковые (`right top`,
   * `left top`) сузили намеренно — панель, уезжающая вбок от раскрывателя,
   * встаёт поверх главного действия, то есть закрывает то, ради чего пришли.
   */
  placement?: "bottom start" | "bottom end" | "top start" | "top end";
  /**
   * Классы на группу, а не на кнопку.
   *
   * Отличие от одноимённого пропа `Button`, и оно вынужденное: элементов здесь
   * два, и «класс на кнопку» не имеет однозначного адресата.
   */
  className?: string;
}

/**
 * Кнопка главного действия и раскрыватель его вариантов рядом.
 *
 * ДВЕ ОТДЕЛЬНЫЕ КНОПКИ, А НЕ КНОПКА С ЗОНОЙ. Одна кнопка, у которой правая
 * часть открывает меню, — это элемент с двумя разными исходами и одним
 * доступным именем: с клавиатуры до второго исхода не добраться вовсе, а
 * скринридер объявит одно действие вместо двух. Разделение здесь не оформление,
 * а разные элементы управления.
 *
 * ИМЯ РАСКРЫВАТЕЛЯ СТРОИТСЯ ИЗ ПОДПИСИ ДЕЙСТВИЯ, и это единственное собственное
 * решение компонента. Без него в речи идут «Экспорт» и следом безымянная кнопка
 * со стрелкой — а таких стрелок на странице обычно несколько, и различить их
 * нечем. Отсюда и требование к `label` быть строкой.
 *
 * Вид и раскладка целиком чужие: `ButtonGroup` срезает внутренние углы и
 * схлопывает соседние рамки, `Button` и `MenuButton` берут вид из
 * `lib/button.ts`. Своей палитры компонент не заводит — оси `variant`, `tone` и
 * `size` те же, что у кнопки, и значат то же самое.
 *
 * Почему `MenuButton`, а не второй `Button`: `MenuTrigger` передаёт триггеру
 * свои пропы через `ButtonContext` react-aria, и обычный `<button>` этого
 * контекста не читает — меню молча не откроется. Разбор — в докстроке `Menu`.
 *
 * ТРИГГЕР УПРАВЛЯЕМЫЙ, И ЭТО НЕ ПРИХОТЬ. Неуправляемый `MenuTrigger` держит
 * открытую панель независимо от того, что стало с кнопкой: выключенность гасила
 * бы только раскрыватель, а уже раскрытое меню оставалось бы в DOM и его пункты
 * продолжали бы срабатывать. Компонент выглядел бы выключенным, а второй способ
 * сделать действие работал бы — ровно то, что обещание `disabled` отрицает.
 *
 * Остальные пропы наружу НЕ пробрасываются, и это тоже следствие двух
 * элементов: у `id`, `type` или `data-*` здесь нет однозначного адресата.
 * Кнопке, которая обязана отправлять форму, нужен `Button` с `MenuTrigger`
 * рядом, собранные вручную, — у них адресат каждый свой.
 */
export function SplitButton({
  label,
  icon,
  onClick,
  disabled = false,
  loading = false,
  variant,
  tone,
  size,
  children,
  placement = "bottom end",
  className,
}: SplitButtonProps) {
  const messages = useMessages();
  const moreLabel = messages.splitButton.more({ action: label });
  const off = disabled || loading;
  const [open, setOpen] = useState(false);

  /*
    Выключение не только прячет панель, но и ЗАБЫВАЕТ, что она была открыта.

    `isOpen={open && !off}` гасит показ, но управляемая смена `isOpen` не зовёт
    `onOpenChange`, поэтому само `open` остаётся `true`. Без этой уборки меню
    раскрывалось бы само по себе, когда выключенность снимут: открыли меню →
    пошла отправка → панель закрылась → отправка кончилась → панель вернулась,
    хотя пользователь ничего не нажимал.
  */
  useEffect(() => {
    if (off) setOpen(false);
  }, [off]);

  return (
    <ButtonGroup className={className}>
      <Button
        variant={variant}
        tone={tone}
        size={size}
        icon={icon}
        disabled={disabled}
        loading={loading}
        onClick={onClick}
      >
        {label}
      </Button>
      <MenuTrigger isOpen={open && !off} onOpenChange={setOpen}>
        <MenuButton
          variant={variant}
          tone={tone}
          size={size}
          iconOnly
          disabled={off}
          aria-label={moreLabel}
          icon={<ChevronDownIcon size={BUTTON_ICON_SIZE[size ?? "md"]} aria-hidden />}
        />
        {/*
          Своего `aria-label` панели не даётся: `MenuTrigger` связывает её с
          триггером, и имя приходит оттуда. Второй источник имени разошёлся бы
          с первым при правке одного из них. Что имя есть — сторожит тест.
        */}
        <Menu placement={placement}>{children}</Menu>
      </MenuTrigger>
    </ButtonGroup>
  );
}
