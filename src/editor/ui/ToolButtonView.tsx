"use client";

import { posToDOMRect, type Editor, type EditorEvents } from "@tiptap/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Kbd } from "../../components/content/Kbd.js";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from "../../components/overlays/Popover.js";
import { Tooltip } from "../../components/overlays/Tooltip.js";
import { useMessages, useUiLocale } from "../../i18n/useMessages.js";
import { buttonClasses } from "../../lib/button.js";
import { cn } from "../../lib/cn.js";
import { GLASS_PANEL_CLASS } from "../styles/glass.js";
import { ariaShortcut, isApple, shortcutLabel } from "../core/shortcuts.js";
import type { ToolPopoverRequest } from "../core/toolButtons.js";
import { toolLabel, type KitToolButton, type ToolLabel } from "../core/toolDescriptor.js";

/**
 * Кнопка из описания Инструмента (`toolDescriptor.ts`) на Панели, плавающей
 * Панели и в Меню выделения, и рамка её поповера.
 *
 * КИТ РИСУЕТ, ОПИСАНИЕ ОПИСЫВАЕТ (ADR-0058, п. 5). Хозяин места — Панель или
 * Меню выделения — считает состояние кнопки (`pressed`, `unavailable`) вместе
 * со своими и держит roving-фокус; здесь — то, что у всех кнопок описаний
 * одно: подсказка с `Kbd`, `aria-pressed` только при `isActive`,
 * `aria-keyshortcuts`, `aria-disabled` и поповер.
 */

/**
 * Подпись записи в локали `UiProvider`: смена локали перерисовывает запись
 * (ADR-0058, п. 6.1). Встроенным в контекст кладутся строки Редактора кита.
 */
export function useToolLabel(): (label: ToolLabel) => string {
  const messages = useMessages().editor;
  const locale = useUiLocale();
  return (label) => toolLabel(label, { locale, messages });
}

/**
 * Рамка поповера по умолчанию: по содержимому, с небольшим отступом. Подложка
 * — стекло поповеров Редактора у любой рамки, и у своего
 * Инструмента: его поповер всплывает над Документом так же, как встроенные.
 */
const POPOVER_FRAME_CLASS = "w-auto p-2";

const OPEN_CLASS = buttonClasses({ variant: "ghost", size: "sm", iconOnly: true, selected: true });

/**
 * Рамка поповера записи — общая для якоря у кнопки, у выделения и у Блока.
 *
 * `Popover` КИТА. Radix ведёт стек слоёв, и `Dialog` кита — тоже Radix: Escape
 * в поповере внутри окна закрывает поповер, а не окно (ADR-0041). Выбор мышью
 * в `Dialog` и `Drawer` работает по той же причине: слой поповера выше слоя
 * окна и сам включает `pointer-events`.
 *
 * ФОКУС. Закрытие с клавиатуры или выбором возвращает фокус в Документ, на
 * прежнее выделение, а не на кнопку: человек пришёл править текст и
 * продолжает с того места. Щелчок мимо фокус не трогает — человек сам
 * выбрал, куда его поставить. Фокус внутрь берёт сам Radix — на первый
 * фокусируемый элемент; своей рукой его ставить нельзя: внутри `Dialog`
 * ловушка фокуса окна ещё не приостановлена и вернула бы его кнопке.
 */
function ToolPopoverFrame({
  editor,
  label,
  className,
  children,
}: {
  editor: Editor;
  label: string;
  className?: string;
  children: ReactNode;
}) {
  const interactedOutside = useRef(false);
  return (
    <PopoverContent
      aria-label={label}
      className={cn(GLASS_PANEL_CLASS, className ?? POPOVER_FRAME_CLASS)}
      onOpenAutoFocus={() => {
        interactedOutside.current = false;
      }}
      onInteractOutside={() => {
        interactedOutside.current = true;
      }}
      onCloseAutoFocus={(event) => {
        // Radix вернул бы фокус кнопке-триггеру, а у поповера у выделения её
        // нет вовсе. Таймер Radix мог сработать уже после размонтажа движка.
        // Фокус — сразу, а не кадром позже, как `commands.focus()`: запоздалый
        // фокус в Документ закрыл бы поповер, открытый повторным щелчком.
        event.preventDefault();
        if (!interactedOutside.current && !editor.isDestroyed) editor.view.focus();
      }}
    >
      {/* Содержимое монтируется заново на каждое открытие: оно берёт
          состояние Документа в момент открытия, а не прошлый черновик. */}
      {children}
    </PopoverContent>
  );
}

export interface ToolButtonViewProps {
  editor: Editor;
  button: KitToolButton;
  /** Подпись в текущей локали (`toolLabel`). */
  label: string;
  /** Состояние `isActive`; у кнопки без него не читается. */
  pressed: boolean;
  /** `aria-disabled`: `can` не выполнен или HTML-режим. */
  unavailable: boolean;
  /** Поле выключено: кнопка видна, но не нажимается и не берёт фокус. */
  disabled: boolean;
  /** Классы хозяина места: обычная и нажатая кнопка (у Меню выделения — свои). */
  classes: { idle: string; pressed: string };
}

export function ToolButtonView({
  editor,
  button,
  label,
  pressed,
  unavailable,
  disabled,
  classes,
}: ToolButtonViewProps) {
  const apple = isApple();
  const [open, setOpen] = useState(false);
  const keys = button.shortcut;
  const tooltip = keys ? (
    <span className="flex items-center gap-2">
      {label}
      <Kbd aria-hidden="true">{shortcutLabel(keys, apple)}</Kbd>
    </span>
  ) : (
    label
  );
  const Icon = button.icon;
  // Поповер у кнопки держит сама кнопка; у выделения — Редактор (`SelectionPopover`).
  const atButton = button.popover != null && button.popoverFrame?.anchor !== "selection";
  /*
    Недоступное действие — `aria-disabled`, а не `disabled`: APG советует
    оставлять действия панели фокусируемыми, иначе стрелки перепрыгивают
    кнопку молча. Выключенное ПОЛЕ — другое дело: в нём фокусу делать нечего.
  */
  const trigger = (
    <button
      type="button"
      aria-label={label}
      aria-pressed={button.isActive ? pressed : undefined}
      aria-haspopup={atButton ? "dialog" : undefined}
      aria-disabled={unavailable || undefined}
      aria-keyshortcuts={keys ? ariaShortcut(keys, apple) : undefined}
      disabled={disabled}
      onClick={(event) => {
        // Radix не откроет поповер, если обработчик отменил событие.
        if (unavailable) event.preventDefault();
        else if (atButton) return;
        // Поповер у выделения открывает команда движка — та же, что у
        // сочетания (`toolButtons.ts`).
        else if (button.popover) editor.commands.openToolPopover(button.id);
        else button.run(editor);
      }}
      className={open ? OPEN_CLASS : pressed ? classes.pressed : classes.idle}
    >
      <Icon size={16} aria-hidden />
    </button>
  );

  if (!atButton) return <Tooltip content={tooltip}>{trigger}</Tooltip>;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip content={tooltip}>
        <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      </Tooltip>
      <ToolPopoverFrame editor={editor} label={label} className={button.popoverFrame?.className}>
        {button.popover?.({ editor, close: () => setOpen(false) })}
      </ToolPopoverFrame>
    </Popover>
  );
}

export interface SelectionPopoverProps {
  editor: Editor;
  /** Запись, чей поповер открыт или был открыт последним. */
  request: ToolPopoverRequest;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Поповер записи у выделения или у Блока (ADR-0058, п. 5.6): так он встаёт,
 * когда его открыло сочетание или меню (пункт вставки — у каретки, Действие
 * над Блоком — у Блока), и всегда — у кнопки с рамкой `anchor: "selection"`
 * (ссылка). Держит его `RichTextEditor`, а не кнопка или меню: сочетание
 * работает и без Панели (`toolbar="none"`), и при спрятанной плавающей, а меню
 * к открытию поповера уже снято.
 *
 * Якорь меряется при каждом пересчёте позиции, а не раз при открытии: Radix
 * зовёт его на прокрутке и ресайзе, и поповер едет вместе с текстом. Выделение
 * движка при этом не меняется — фокус в поповере его не сбрасывает. Позиция
 * Блока едет за правками Документа, пока поповер открыт.
 */
export function SelectionPopover({ editor, request, open, onOpenChange }: SelectionPopoverProps) {
  const label = useToolLabel();
  // Позиция Блока своего запроса: новый запрос сразу берёт свою, без кадра со старой.
  const [moved, setMoved] = useState({ request, block: request.block });
  const block = moved.request === request ? moved.block : request.block;
  const blockRef = useRef(block);
  blockRef.current = block;
  useEffect(() => {
    let current = request.block;
    if (current === undefined) return;
    const follow = ({ transaction }: EditorEvents["transaction"]) => {
      current = transaction.mapping.map(current!);
      setMoved({ request, block: current });
    };
    editor.on("transaction", follow);
    return () => void editor.off("transaction", follow);
  }, [editor, request]);
  const anchorRef = useRef({
    getBoundingClientRect: () => {
      const node = blockRef.current === undefined ? null : editor.view.nodeDOM(blockRef.current);
      if (node instanceof HTMLElement) return node.getBoundingClientRect();
      const { from, to } = editor.state.selection;
      return posToDOMRect(editor.view, from, to);
    },
  });
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverAnchor virtualRef={anchorRef} />
      <ToolPopoverFrame editor={editor} label={label(request.label)} className={request.className}>
        {request.popover({
          editor,
          close: () => onOpenChange(false),
          pos: block ?? editor.state.selection.from,
        })}
      </ToolPopoverFrame>
    </Popover>
  );
}
