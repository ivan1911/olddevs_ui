"use client";

import { useRef, useState } from "react";
import { Kbd } from "../../components/content/Kbd.js";
import { Popover, PopoverContent, PopoverTrigger } from "../../components/overlays/Popover.js";
import { Tooltip } from "../../components/overlays/Tooltip.js";
import { useMessages, useUiLocale } from "../../i18n/useMessages.js";
import { KeyboardIcon } from "../../icons.js";
import { buttonClasses } from "../../lib/button.js";
import { cn } from "../../lib/cn.js";
import { TOUCH_HIDDEN_CLASS } from "../../lib/touch.js";
import { FOCUS_TARGET } from "./focusWithin.js";
import { isApple, shortcutGroupsFor, shortcutLabel } from "../core/shortcuts.js";
import type { ToolList } from "../core/toolDescriptor.js";
import { GLASS_PANEL_CLASS } from "../styles/glass.js";

export interface ShortcutsButtonProps {
  tools: ToolList;
  /** Поле выключено: кнопка видна, но не нажимается — как остальные на Панели. */
  disabled: boolean;
}

const CLOSED_CLASS = buttonClasses({ variant: "ghost", size: "sm", iconOnly: true });
const OPEN_CLASS = buttonClasses({ variant: "ghost", size: "sm", iconOnly: true, selected: true });

/**
 * Справочник сочетаний клавиш: кнопка с клавиатурой у правого края
 * Панели открывает список «команда — сочетание» только для чтения.
 *
 * СОСТАВ — ИЗ ОБЩЕЙ ТАБЛИЦЫ (`shortcuts.ts`), той же, что подписывает кнопки
 * Панели: строка есть только у команды включённого инструмента, а подпись
 * сочетания — `⌘+⌥+⇧` на Apple и `Ctrl+Alt+Shift` у остальных. Справочник сам
 * ничего не назначает и не нажимается: это не палитра команд.
 *
 * РАЗМЕТКА — ТАБЛИЦА. Скринридер читает пару «команда — сочетание» как строку с
 * заголовками столбцов, а не как два несвязанных списка; сочетание — `Kbd`
 * кита, то есть `<kbd>`.
 *
 * `Popover` КИТА: Radix ведёт стек слоёв, и Escape внутри окна закрывает
 * справочник, а не окно вокруг Редактора (так же, как поповер ссылки, ADR-0041).
 *
 * ФОКУС. Закрытие возвращает фокус на кнопку — и Escape, и щелчок мимо. Оговорка
 * для щелчка: если он сам поставил фокус на что-то, с чем работают (в документ,
 * в соседнее поле, на кнопку), его не отбирают; на кнопку фокус вернётся, когда
 * щелчок пришёл в пустое место и фокус остался на теле страницы или на окне.
 */
export function ShortcutsButton({ tools, disabled }: ShortcutsButtonProps) {
  const messages = useMessages().editor;
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip content={messages.shortcuts}>
        <PopoverTrigger asChild>
          <button
            ref={buttonRef}
            type="button"
            aria-label={messages.shortcuts}
            disabled={disabled}
            // На телефоне сочетаний нет — нет и справочника.
            // К правому краю Панели кнопку прижимает её группа (`EditorToolbar`).
            className={cn(open ? OPEN_CLASS : CLOSED_CLASS, TOUCH_HIDDEN_CLASS)}
          >
            <KeyboardIcon size={16} aria-hidden />
          </button>
        </PopoverTrigger>
      </Tooltip>
      <PopoverContent
        align="end"
        aria-label={messages.shortcuts}
        // Ширина — по самой длинной строке: фиксированные 384px
        // оставляли пустое поле между командой и сочетанием.
        className={cn(
          GLASS_PANEL_CLASS,
          "max-h-[min(32rem,var(--radix-popover-content-available-height))] w-max max-w-[calc(100vw-2rem)] overflow-y-auto p-3"
        )}
        onCloseAutoFocus={(event) => {
          // Radix после щелчка мимо фокус не возвращает вовсе. Здесь он
          // возвращается, если щелчок сам не поставил его на что-то, с чем
          // работают: на тело страницы или на контейнер окна фокус попадает от
          // щелчка в пустое место.
          event.preventDefault();
          const active = document.activeElement;
          if (!active || !active.matches(FOCUS_TARGET)) buttonRef.current?.focus();
        }}
      >
        {open && <ShortcutsTable tools={tools} />}
      </PopoverContent>
    </Popover>
  );
}

function ShortcutsTable({ tools }: { tools: ToolList }) {
  const messages = useMessages().editor;
  const apple = isApple();
  const groups = shortcutGroupsFor(tools, useUiLocale());

  return (
    <table className="w-full border-collapse text-sm">
      <caption className="sr-only">{messages.shortcuts}</caption>
      <thead>
        <tr className="text-fg-2 text-left text-xs">
          <th scope="col" className="pr-3 pb-2 font-medium">
            {messages.shortcutsCommand}
          </th>
          <th scope="col" className="pb-2 text-right font-medium">
            {messages.shortcutsKeys}
          </th>
        </tr>
      </thead>
      {groups.map(({ group, commands }, index) => (
        <tbody key={group} className={cn(index > 0 && "border-line-soft border-t")}>
          {commands.map((command) => (
            <tr key={command.id}>
              <th scope="row" className="text-fg-0 py-1 pr-3 text-left font-normal">
                {command.label(messages)}
              </th>
              <td className="py-1 text-right whitespace-nowrap">
                <Kbd size="md">{shortcutLabel(command.keys, apple)}</Kbd>
              </td>
            </tr>
          ))}
        </tbody>
      ))}
    </table>
  );
}
