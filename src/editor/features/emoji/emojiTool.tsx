"use client";

import { TextSelection } from "@tiptap/pm/state";
import type { Editor } from "@tiptap/react";
import { EmojiIcon } from "../../../icons.js";
import { EmojiGrid } from "./EmojiGrid.js";
import type { ToolDescriptor } from "../../core/toolDescriptor.js";

/**
 * Вставить эмодзи обычным текстом: в конец выделения, не заменяя его, и каретка
 * сразу за эмодзи.
 *
 * ПОЧЕМУ ПОСЛЕ ВЫДЕЛЕНИЯ, А НЕ ВМЕСТО. Эмодзи — не замена слова, а добавка к
 * нему; стереть выделенный абзац ради смайла на его краю — потеря, которую
 * человек заметит последним. Так решено владельцем.
 *
 * ОДНА ТРАНЗАКЦИЯ — одна правка на отмену. Она же проходит через `maxLength`:
 * фильтр транзакций отвергает вставку, уводящую документ за предел, целиком —
 * эмодзи не бывает «наполовину», и выделение остаётся на месте.
 *
 * Метки берутся у каретки (`insertText` без заданных меток): эмодзи в
 * жирном тексте жирный, как набранная буква. Вставка возможна, только когда
 * конец выделения лежит в тексте: у выделенной картинки или строки таблицы
 * текста нет, и `false` говорит об этом вызывающему.
 */
export function insertEmoji(editor: Editor, char: string): boolean {
  if (!editor.isEditable) return false;
  const { state, view } = editor;
  const { $to } = state.selection;
  if (!$to.parent.inlineContent) return false;
  const tr = state.tr.insertText(char, $to.pos);
  tr.setSelection(TextSelection.create(tr.doc, $to.pos + char.length));
  view.dispatch(tr.scrollIntoView());
  return true;
}

/**
 * Эмодзи на описании Инструмента (ADR-0058, п. 10.4) — проверка
 * кнопки с поповером на той же форме, что у своего Инструмента. Своей Схемы и
 * Extensions нет: эмодзи — обычный текст.
 *
 * Поповер — сетка `EmojiGrid` в рамке кита у кнопки. Выбор вставляет эмодзи и
 * закрывает поповер; фокус возвращается в Документ, а не на кнопку: человек
 * пришёл поставить смайл в текст и продолжает писать. Недоступна кнопка,
 * когда вставлять некуда — выделена картинка или ячейки таблицы.
 */
export const EMOJI_TOOL: ToolDescriptor = {
  name: "emoji",
  buttons: [
    {
      id: "emoji",
      label: ({ messages }) => messages.emoji,
      icon: EmojiIcon,
      can: (editor) => editor.state.selection.$to.parent.inlineContent,
      selectionMenu: true,
      popover: ({ editor, close }) => (
        <EmojiGrid
          onPick={(emoji) => {
            insertEmoji(editor, emoji.char);
            close();
          }}
          autoFocus={false}
        />
      ),
    },
  ],
};
