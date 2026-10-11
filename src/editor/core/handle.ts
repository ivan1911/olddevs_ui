"use client";

import { createNodeFromContent, type JSONContent } from "@tiptap/core";
import { closeHistory } from "@tiptap/pm/history";
import type { Fragment } from "@tiptap/pm/model";
import type { Editor } from "@tiptap/react";
import type { RefObject } from "react";
import { textBetween } from "./atomText.js";
import { isRichTextDocument, type RichTextDocument } from "./jsonDocument.js";

/**
 * Плоские методы Хэндла (ADR-0058, раздел 8): то, что экран делает с Редактором
 * чаще всего. Остальное — `editor` (команды Меток, Блоков и своих Инструментов).
 *
 * Описаны отдельным интерфейсом, а `RichTextEditorHandle` его расширяет: тело
 * `RichTextEditor.tsx` остаётся компактным, а вся логика Хэндла живёт здесь.
 *
 * ДО МОНТАЖА МЕТОДЫ ТИХИЕ. Движок создаётся в браузере после первого рендера, и
 * на сервере его нет: чтение отдаёт известное значение, запись и фокус ничего не
 * делают, вставка возвращает `false`. Очереди вызовов и исключения отвергнуты —
 * экран, дернувший метод слишком рано, ничего не теряет молча и не падает.
 * Готовность как событие — `onReady`.
 */
export interface RichTextEditorHandleMethods {
  /**
   * Фокус в Документ: `"end"` — каретка в конец (по умолчанию, как всегда),
   * `"start"` — в начало, `"restore"` — туда, где выделение было до ухода
   * фокуса (после своего диалога, меню, внешней панели). В HTML-режиме — в поле
   * HTML.
   */
  focus(position?: "start" | "end" | "restore"): void;
  /** Снять фокус с Документа (в HTML-режиме — с поля HTML). */
  blur(): void;
  /**
   * Вставить HTML у каретки на месте выделения. `true` — вставлено, `false` —
   * не вставлено: движка ещё нет, поле только для чтения или выключено, вставка
   * вышла бы за `maxLength`, либо Схема отбросила всё вставленное (например,
   * Блок выключенного Инструмента).
   *
   * Вставка проходит через Схему, как входящий `value`, и сама фокус не берёт.
   * Это Правка автора: отдельный шаг истории, `onChange` после `changeDelay`,
   * предел `maxLength` действует — вставка, которая за него вышла, не
   * выполняется целиком, а не обрезается посередине.
   */
  insertHTML(html: string): boolean;
  /**
   * Вставить текст у каретки на месте выделения — буквально, без разбора HTML.
   * Перенос строки становится мягким переносом (в блоке кода — символом
   * переноса). Возвращает и работает как `insertHTML`.
   */
  insertText(text: string): boolean;
  /**
   * Текст Документа без разметки; Блоки разделены пустой строкой, атом — его
   * Текстом атома (`atomText.ts`). До монтажа — `""`. В HTML-режиме сначала
   * применяет правку поля HTML, как `getHTML()`.
   */
  getText(): string;
  /**
   * Выделенный текст по тому же правилу, что `getText()`: атом входит в него
   * только целиком. Для свёрнутого выделения (каретки) и до монтажа — `""`.
   */
  getSelectedText(): string;
  /**
   * Пуст ли Документ — по тому же правилу, что `required`: содержимое — текст,
   * любой Атом (разделитель, картинка, мягкий перенос, свой — даже без текста)
   * и таблица, в том числе с пустыми ячейками; пустой абзац, заголовок, список
   * или цитата — не содержимое. До монтажа судит по
   * входящему значению по тому же правилу; свой Блок там — всегда содержимое.
   */
  isEmpty(): boolean;
  /**
   * Отменить правку (Правка автора: `onChange` после `changeDelay`). Работает
   * при включённом Инструменте `history`, иначе, до монтажа, в HTML-режиме и в
   * поле, которое автор не может править, — ничего не делает.
   */
  undo(): void;
  /** Повторить отменённую правку. Условия — как у `undo()`. */
  redo(): void;
  /** Есть ли что отменить. Без Инструмента `history` и до монтажа — `false`. */
  canUndo(): boolean;
  /** Есть ли что повторить. Без Инструмента `history` и до монтажа — `false`. */
  canRedo(): boolean;
}

/** Что Хэндлу нужно от Редактора: движок и то, что знает только он. */
export interface HandleHost {
  editor: Editor | null;
  /** Поле принимает правки автора: не `readOnly` и не выключено. */
  editable: boolean;
  /** Последний HTML, о котором знает владелец значения, — ответ до монтажа. */
  known: () => string;
  /**
   * Начальный конверт из `defaultValue`: до монтажа HTML его ещё
   * нет — Схему знает только движок, — и пустоту решает дерево конверта.
   */
  initialDocument: () => RichTextDocument | undefined;
  /**
   * Таблица в Схеме: только тогда она содержимое и до монтажа. Без инструмента
   * `table` Схема выбросит её при разборе, и пустая таблица станет пустым полем.
   */
  tables: boolean;
  /** HTML-режим открыт: Документ скрыт, правит автор поле HTML. */
  sourceOpen: () => boolean;
  sourceField: () => HTMLTextAreaElement | null;
  /** Применить правку поля HTML к Документу (то же, что на `getHTML()`). */
  applySource: () => void;
  /** Переписать поле HTML заново — Документ изменился снаружи поля. */
  rewriteSource: (editor: Editor) => void;
  /** Пуст ли Документ по правилу кита, с учётом неприменённой правки поля HTML. */
  fieldEmpty: (editor: Editor) => boolean;
}

/** Тег целиком; комментарий и содержимое `script`/`style`/`template` разбор Схемой не видит. */
const TAG = /<[^>]*>/g;
const UNSEEN = /<!--[\s\S]*?-->|<(script|style|template)\b[\s\S]*?<\/\1\s*>/gi;
/**
 * Листья Документа — содержимое и без текста: мягкий перенос, линия, картинка,
 * свой Блок. Свой Блок до движка — всегда содержимое: атом ли он, знает только
 * его Часть для движка, а атом без текста — тоже содержимое.
 */
const LEAF = /<(?:br|hr|img)\b|\sdata-block\s*=\s*["']?[A-Za-z][A-Za-z0-9]*_/i;
/** Таблица — содержимое и с пустыми ячейками (`emptiness.ts`). */
const TABLE = /<table\b/i;
/** В блоке кода пробелы — текст; разбор снимает только перенос в конце. */
const CODE = /<pre\b[^>]*>([\s\S]*?)<\/pre\s*>/gi;

/**
 * Пустое входящее значение до движка — по правилу пустоты кита (`emptiness.ts`,
 * на нём держатся `required` и `isEmpty()` после монтажа). Разобрать HTML
 * Схемой без движка нельзя (на сервере нет DOM), поэтому судим по строке:
 * пусто, если нет ни листа, ни таблицы (при включённом `table`), ни текста.
 * Пустые обёртки (абзац, заголовок, список, цитата, Метка) — не содержимое; пробелы между тегами
 * разбор схлопывает, а неразрывный пробел и мнемоника — текст.
 */
function isBlankHtml(html: string, tables: boolean): boolean {
  const seen = html.replace(UNSEEN, "");
  if (LEAF.test(seen) || (tables && TABLE.test(seen))) return false;
  const text = seen
    .replace(CODE, (_, code: string) => (code.replace(TAG, "").replace(/\n$/, "") ? "x" : ""))
    .replace(TAG, "");
  return /^[ \t\n\f\r]*$/.test(text);
}

/** Листья дерева — содержимое и без текста; правило то же, что у `LEAF`. */
const LEAF_NODES: ReadonlySet<string> = new Set(["hardBreak", "horizontalRule", "image"]);
/** Свой Блок — имя с префиксом Инструмента, как `data-block` в `LEAF`. */
const CUSTOM_NODE = /^[A-Za-z][A-Za-z0-9]*_/;

/**
 * Пустой начальный конверт до движка — по тому же правилу, что `isBlankHtml`,
 * но по дереву: пусто, если нет ни листа, ни таблицы (при включённом `table`),
 * ни своего Блока, ни текста. Пробелы в конверте не схлопываются
 * (`jsonDocument.ts`), поэтому пробел — уже текст. Отвергнутый конверт даст
 * пустой Документ — он пуст.
 */
function isBlankDocument(value: RichTextDocument, tables: boolean): boolean {
  if (!isRichTextDocument(value)) return true;
  const filled = (node: JSONContent | null | undefined): boolean => {
    if (!node || typeof node !== "object") return false;
    const type = String(node.type ?? "");
    if (type === "text") return !!node.text;
    if (LEAF_NODES.has(type) || CUSTOM_NODE.test(type) || (tables && type === "table")) return true;
    return Array.isArray(node.content) && node.content.some(filled);
  };
  return !filled(value.doc);
}

function usable(editor: Editor | null): editor is Editor {
  return editor !== null && !editor.isDestroyed;
}

/**
 * Правка автора через цепочку команд. `true`, если Документ изменился:
 * транзакцию, которую не пропустил предел, движок отвергает молча, и по
 * неизменной ссылке на документ это видно. `closeHistory` с обеих сторон делает
 * вставку отдельным шагом истории — отмена убирает её одну, а не вместе с
 * набором перед ней.
 */
function authorEdit(
  host: HandleHost,
  change: (chain: ReturnType<Editor["chain"]>) => ReturnType<Editor["chain"]>
): boolean {
  const { editor } = host;
  if (!usable(editor) || !host.editable) return false;
  host.applySource();
  const before = editor.state.doc;
  change(
    editor.chain().command(({ tr }) => {
      closeHistory(tr);
      return true;
    })
  ).run();
  if (editor.state.doc === before) return false;
  editor.view.dispatch(closeHistory(editor.state.tr));
  host.rewriteSource(editor);
  return true;
}

/**
 * Разбор HTML вставки Схемой — как у входящего `value`. `null`, если Схема
 * отбросила всё: `insertContent` Tiptap в этом случае вставил бы СТРОКУ как
 * текст («<hr>» буквами), а нам нужен отказ.
 */
function parseHtml(editor: Editor, html: string) {
  // Для строки Tiptap всегда отдаёт фрагмент.
  const content = createNodeFromContent(html, editor.schema) as Fragment;
  return content.size > 0 ? content : null;
}

/** Текст со строками: перенос — мягкий перенос Документа, а в коде — сам символ. */
function textContent(text: string, inCode: boolean): JSONContent[] {
  if (inCode) return [{ type: "text", text }];
  return text
    .split(/\r\n|\r|\n/)
    .flatMap((line, index): JSONContent[] => [
      ...(index > 0 ? [{ type: "hardBreak" }] : []),
      ...(line ? [{ type: "text", text: line }] : []),
    ]);
}

/** Методы Хэндла поверх движка Редактора. */
export function createHandleMethods(host: HandleHost): RichTextEditorHandleMethods {
  const { editor } = host;
  const history = (command: "undo" | "redo") => {
    // HTML-режим: Документ скрыт, а у поля HTML своя нативная отмена.
    if (!usable(editor) || !host.editable || host.sourceOpen()) return;
    // Без Инструмента `history` команды у движка нет — отмена тихая.
    if (typeof editor.commands[command] === "function") editor.commands[command]();
  };
  const available = (command: "undo" | "redo") => {
    if (!usable(editor) || !host.editable || host.sourceOpen()) return false;
    const can = editor.can()[command] as (() => boolean) | undefined;
    return can?.() === true;
  };

  return {
    focus: (position = "end") => {
      if (host.sourceOpen()) {
        const field = host.sourceField();
        field?.focus();
        if (position === "start") field?.setSelectionRange(0, 0);
        else if (position === "end")
          field?.setSelectionRange(field.value.length, field.value.length);
        return;
      }
      // Tiptap: `null` — оставить выделение, где оно было, и вернуть фокус.
      if (usable(editor)) editor.commands.focus(position === "restore" ? null : position);
    },
    blur: () => {
      if (host.sourceOpen()) host.sourceField()?.blur();
      else if (usable(editor)) editor.commands.blur();
    },
    insertHTML: (html) => {
      const content = usable(editor) && html.trim() ? parseHtml(editor, html) : null;
      return content !== null && authorEdit(host, (chain) => chain.insertContent(content));
    },
    insertText: (text) =>
      !!text &&
      authorEdit(host, (chain) =>
        chain.insertContent(
          textContent(
            text,
            !!usable(editor) && !!editor.state.selection.$from.parent.type.spec.code
          )
        )
      ),
    getText: () => {
      if (!usable(editor)) return "";
      host.applySource();
      return editor.getText();
    },
    getSelectedText: () => {
      if (!usable(editor) || host.sourceOpen()) return "";
      const { from, to, empty } = editor.state.selection;
      return empty ? "" : textBetween(editor.state.doc, from, to, "\n\n");
    },
    isEmpty: () => {
      if (usable(editor)) return host.fieldEmpty(editor);
      const initial = host.initialDocument();
      return initial
        ? isBlankDocument(initial, host.tables)
        : isBlankHtml(host.known(), host.tables);
    },
    undo: () => history("undo"),
    redo: () => history("redo"),
    canUndo: () => available("undo"),
    canRedo: () => available("redo"),
  };
}

/*
  Хук-селектор не знает, когда у `ref` появится движок: Редактор создаёт его
  после первого рендера экрана и перерисовывается сам, а экран — нет. Поэтому
  подписки живут по самому объекту `ref`, который есть с первого рендера, и
  Редактор сообщает об смене движка по нему.
*/
const watchers = new WeakMap<object, Set<() => void>>();

/** Подписка хука на смену движка у Редактора, привязанного к этому `ref`. */
export function watchHandleEditor(ref: RefObject<unknown>, listener: () => void): () => void {
  let set = watchers.get(ref);
  if (!set) watchers.set(ref, (set = new Set()));
  set.add(listener);
  return () => void set.delete(listener);
}

/** Редактор сообщает: движок у `ref` появился или сменился. */
export function notifyHandleEditor(ref: unknown): void {
  if (typeof ref !== "object" || ref === null) return;
  watchers.get(ref)?.forEach((listener) => listener());
}
