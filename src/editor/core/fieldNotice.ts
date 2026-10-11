"use client";

// Сообщение поля (ADR-0058, раздел 7): одно место под полем, куда
// кит и свои Инструменты сообщают о результате действия. Раньше это было
// внутренним состоянием сообщений о картинках; теперь — команда движка.

import { Extension } from "@tiptap/core";

/**
 * Тон Сообщения поля. `status` невидим и только озвучивается; `error` видна
 * строкой `role="alert"` под полем.
 */
export type FieldNoticeTone = "status" | "error";

/**
 * Сообщение поля — данные, а не React-узел: тон и готовый текст. Текст кит не
 * переводит: Инструмент берёт его из своего каталога на языке экрана, а кит —
 * из каталога сообщений (`editor.*`). Своих длительностей, кнопок закрытия и
 * спиннеров у сообщения нет.
 */
export interface FieldNotice {
  /** Тон сообщения: `status` только озвучивается, `error` видна строкой под полем. */
  tone: FieldNoticeTone;
  /** Готовый текст на языке экрана; кит его не переводит. */
  text: string;
}

export interface FieldNoticeOptions {
  /** Показать сообщение; `null` — снять. Состояние держит `RichTextEditor`. */
  onNotice: (notice: FieldNotice | null) => void;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    fieldNotice: {
      /**
       * Показать Сообщение поля: новое заменяет прежнее, `null` снимает. Документ,
       * история и `onChange` не затрагиваются. `error` уходит сама со следующей
       * Правкой автора, `status` остаётся, пока его не заменят или не снимут.
       *
       * Свой Инструмент зовёт её из Части для движка (`this.editor.commands`),
       * экран — через `handle.editor`. Сообщение без текста — то же, что `null`.
       */
      showNotice: (notice: FieldNotice | null) => ReturnType;
    };
  }
}

/**
 * Команда `showNotice`. Живёт в каждом Редакторе независимо от набора
 * Инструментов: сообщить об ошибке вставки может и Инструмент без картинок.
 *
 * ПОЧЕМУ БЕЗ ТРАНЗАКЦИИ. Сообщение — не часть Документа: команда ничего не
 * пишет в `tr`, поэтому в историю и `onChange` оно не попадает, а Правку автора
 * (она снимает `error`) от неё отличить легко — это единственное, что порождает
 * событие `update`. Проба `editor.can()` команду не исполняет (`dispatch` пуст).
 */
export const FieldNoticeExtension = Extension.create<FieldNoticeOptions>({
  name: "fieldNotice",

  addOptions() {
    return { onNotice: () => {} };
  },

  addCommands() {
    return {
      showNotice:
        (notice) =>
        ({ dispatch }) => {
          if (dispatch) this.options.onNotice(notice && notice.text !== "" ? notice : null);
          return true;
        },
    };
  },
});
