"use client";

import { Extension, type Editor } from "@tiptap/core";
import type { ReactNode } from "react";
import type { KitToolButton, ToolLabel } from "./toolDescriptor.js";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    toolButtons: {
      /**
       * Внутренняя команда кита, не API: открыть поповер записи описания.
       * Кнопка — у выделения (сочетание, рамка `anchor: "selection"`); пункт
       * вставки — у каретки; Действие над Блоком — у Блока `block`. В
       * нередактируемом поле и при невыполненном `can` кнопки — нет.
       */
      openToolPopover: (id: string, block?: number) => ReturnType;
    };
  }
}

/** Запись с поповером, кроме кнопки: пункт вставки или Действие над Блоком. */
export interface ToolPopoverEntry {
  id: string;
  label: ToolLabel;
  popover: ToolPopoverRequest["popover"];
}

/** Что открыть: рамку держит `RichTextEditor` (`SelectionPopover`). */
export interface ToolPopoverRequest {
  /** Подпись записи — имя рамки. */
  label: ToolLabel;
  /** Содержимое; `pos` — Блок у поповера или, у каретки, начало выделения. */
  popover: (props: { editor: Editor; close: () => void; pos: number }) => ReactNode;
  /** Классы рамки вместо умолчания (`popoverFrame` кнопки кита). */
  className?: string;
  /** Позиция Блока: поповер у Блока. Нет — у выделения. */
  block?: number;
}

export interface ToolButtonsOptions {
  /** Кнопки описаний включённых Инструментов — в порядке списка. */
  buttons: readonly KitToolButton[];
  /** Пункты вставки и Действия над Блоком с поповером. */
  entries: readonly ToolPopoverEntry[];
  /** Открыть поповер у выделения или у Блока: его держит `RichTextEditor`. */
  openPopover: (request: ToolPopoverRequest) => void;
}

/** Нажать кнопку можно: поле правится, кнопка видна и доступна. */
function available(editor: Editor, button: KitToolButton): boolean {
  return editor.isEditable && (button.isVisible?.(editor) ?? true) && button.can(editor);
}

const KEY_NAMES: Record<string, string> = {
  mod: "Mod",
  alt: "Alt",
  shift: "Shift",
  "↑": "ArrowUp",
  "↓": "ArrowDown",
};

/**
 * Сочетание из нотации Панели (`["mod", "K"]`) — в имя клавиши ProseMirror
 * (`Mod-k`). Буква — строчной: заглавную keymap читает как клавишу с Shift.
 */
export function keymapName(keys: readonly string[]): string {
  return keys
    .map((key) => KEY_NAMES[key] ?? (/^[A-Z]$/.test(key) ? key.toLowerCase() : key))
    .join("-");
}

/**
 * Сочетания у кнопок описаний (ADR-0058, п. 5.7): сочетание — поле
 * записи и единственный его источник, поэтому клавишу вешает кит, а не
 * Extensions Инструмента. `run` выполняется, поповер открывается у выделения.
 * Недоступная кнопка клавишу не берёт: она идёт дальше, в Документ.
 */
export const ToolButtons = Extension.create<ToolButtonsOptions>({
  name: "toolButtons",

  addOptions: () => ({ buttons: [], entries: [], openPopover: () => {} }),

  addCommands() {
    return {
      openToolPopover:
        (id, block) =>
        ({ editor, dispatch }) => {
          const button = this.options.buttons.find((candidate) => candidate.id === id);
          const entry = this.options.entries.find((candidate) => candidate.id === id);
          if (!editor.isEditable) return false;
          if (button ? !button.popover || !available(editor, button) : !entry) return false;
          // `can()` зовёт команду всухую, без `dispatch`: поповер открывается
          // только настоящим вызовом.
          if (!dispatch) return true;
          if (button?.popover) {
            const { label, popover, popoverFrame } = button;
            this.options.openPopover({ label, popover, className: popoverFrame?.className });
          } else if (entry) {
            /*
              Кадром позже: пункт меню зовёт команду после `focus()` в цепочке,
              а Tiptap возвращает фокус в Документ в следующем кадре, и меню
              тем временем снимается. Поповер, открытый сразу, потерял бы фокус
              и закрылся как «фокус ушёл наружу» — как поповер картинки.
            */
            requestAnimationFrame(() => {
              if (!editor.isDestroyed) this.options.openPopover({ ...entry, block });
            });
          }
          return true;
        },
    };
  },

  addKeyboardShortcuts() {
    return Object.fromEntries(
      this.options.buttons.flatMap((button) =>
        button.shortcut
          ? [
              [
                keymapName(button.shortcut),
                () => {
                  if (button.popover) return this.editor.commands.openToolPopover(button.id);
                  if (!available(this.editor, button)) return false;
                  button.run(this.editor);
                  return true;
                },
              ],
            ]
          : []
      )
    );
  },
});
