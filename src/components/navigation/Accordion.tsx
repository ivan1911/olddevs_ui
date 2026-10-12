"use client";

import type { ReactNode } from "react";
import {
  Button as AriaButton,
  Disclosure,
  DisclosureGroup,
  DisclosurePanel,
  Heading as AriaHeading,
  type DisclosureGroupProps,
} from "react-aria-components";
import { ChevronDownIcon } from "../../icons.js";
import { cn } from "../../lib/cn.js";

export interface AccordionProps extends Omit<
  DisclosureGroupProps,
  "className" | "style" | "allowsMultipleExpanded"
> {
  /**
   * Раскрывать несколько секций сразу.
   *
   * Родной `allowsMultipleExpanded` из типа убран намеренно: `{...rest}`
   * раскладывается ПЕРЕД умолчанием кита, и переданный снаружи проп молча
   * проигрывал бы — компилировалось бы, а гармошка вела себя по-старому.
   *
   * Умолчание — ОДНА: набор секций читают по очереди, и раскрытые «про запас»
   * превращают экран в простыню, где текущая секция уезжает за нижний край
   * ровно в момент, когда её открыли. Множественное включают там, где секции
   * сравнивают между собой.
   */
  multiple?: boolean;
  /** Дополнительные классы на корень гармошки. */
  className?: string;
  /** Секции гармошки — набор `AccordionItem`. */
  children?: ReactNode;
}

export interface AccordionItemProps {
  /** Идентификатор секции: по нему работает `expandedKeys`. */
  id: string;
  /** Заголовок секции — содержимое кнопки раскрытия. Может быть разметкой. */
  title: ReactNode;
  /** Блокирует секцию: кнопка раскрытия неактивна, состояние не меняется. */
  disabled?: boolean;
  /** Дополнительные классы на секцию. */
  className?: string;
  /** Содержимое панели секции; показывается в раскрытом состоянии. */
  children?: ReactNode;
}

/** Секция гармошки. */
export function AccordionItem({ id, title, disabled, className, children }: AccordionItemProps) {
  return (
    <Disclosure
      id={id}
      isDisabled={disabled}
      className={cn("border-line-soft border-b", className)}
    >
      {({ isExpanded }) => (
        <>
          {/*
        Заголовок обёрнут в `Heading` react-aria, а не в `div`: кнопка
        раскрытия обязана лежать внутри заголовка — так скринридер попадает в
        секцию по списку заголовков, а не только табом по кнопкам.
      */}
          <AriaHeading className="m-0">
            <AriaButton
              slot="trigger"
              className={cn(
                "text-fg-0 flex w-full cursor-pointer items-center justify-between gap-3 py-3 text-left text-sm font-semibold outline-none",
                "hover:text-accent-strong focus-visible:outline-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2",
                "disabled:text-fg-3 disabled:cursor-not-allowed"
              )}
            >
              {title}
              {/*
            Поворот шеврона берётся РЕНДЕР-ПРОПОМ, а не вариантом `expanded:`.
            Вариант плагина требует, чтобы `data-expanded` висел на самом
            крашеном элементе, а react-aria ставит его на обёртку `Disclosure` —
            ни кнопка, ни иконка его не несут. Класс молча не срабатывал:
            шеврон не поворачивался вовсе, и ни снимок (периферия), ни axe
            этого не видят. Ровно правило 2 из «смешанного кита».
          */}
              <ChevronDownIcon
                size={16}
                aria-hidden
                className={cn(
                  "text-fg-3 shrink-0 transition-transform motion-reduce:transition-none",
                  isExpanded && "rotate-180"
                )}
              />
            </AriaButton>
          </AriaHeading>
          {/* Отступ только у раскрытой панели: свёрнутая остаётся в потоке, и её `pb-3` добавлял 12px. */}
          <DisclosurePanel className={cn("text-fg-1 text-sm", isExpanded && "pb-3")}>
            {children}
          </DisclosurePanel>
        </>
      )}
    </Disclosure>
  );
}

/**
 * Гармошка: набор сворачиваемых секций.
 *
 * Поведение у react-aria: клавиатура, `aria-expanded`, связь кнопки с панелью,
 * скрытие содержимого от скринридера в свёрнутом виде. Кит держит вид и
 * умолчание про число одновременно раскрытых секций.
 */
export function Accordion({ multiple = false, className, children, ...rest }: AccordionProps) {
  return (
    <DisclosureGroup
      {...rest}
      allowsMultipleExpanded={multiple}
      className={cn("border-line-soft w-full border-t", className)}
    >
      {children}
    </DisclosureGroup>
  );
}
