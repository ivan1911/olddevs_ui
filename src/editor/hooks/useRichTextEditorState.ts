"use client";

import { useEditorState, type Editor } from "@tiptap/react";
import { useCallback, useEffect, useSyncExternalStore, type RefObject } from "react";
import { watchHandleEditor } from "../core/handle.js";
import type { RichTextEditorHandle } from "../RichTextEditor.js";

/**
 * Срез состояния Редактора для своей панели экрана: активные Метки, возможность
 * команды, выделение — всё, что `selector` вычислит из `editor`.
 *
 * ПЕРЕРИСОВКА — ТОЛЬКО ПРИ СМЕНЕ СРЕЗА. Хук сидит на `useEditorState` Tiptap:
 * селектор считается на каждую транзакцию, а компонент перерисовывается, когда
 * результат стал другим (сравнение по значению, поэтому селектор вправе вернуть
 * объект). Набор текста, не меняющий срез, панель не трогает.
 *
 * БЕЗОПАСЕН ДО МОНТАЖА И ПРИ SSR. Пока движка нет — на сервере, в первом рендере
 * экрана — возвращает `null`, селектор не вызывается. Когда движок появится,
 * экран перерисуется сам. Один и тот же `ref` отдаётся в `RichTextEditor`.
 *
 * Команды панели вызываются через `ref.current.editor.chain().focus()…run()`;
 * кнопкам панели нужен `preventDefault` на `mousedown`, иначе клик снимет фокус.
 *
 * @example
 * const ref = useRef<RichTextEditorHandle>(null);
 * const state = useRichTextEditorState(ref, (editor) => ({ bold: editor.isActive("bold") }));
 */
export function useRichTextEditorState<T>(
  ref: RefObject<RichTextEditorHandle | null>,
  selector: (editor: Editor) => T
): T | null {
  const editor = useSyncExternalStore(
    useCallback((listener) => watchHandleEditor(ref, listener), [ref]),
    () => ref.current?.editor ?? null,
    () => null
  );
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => (current ? selector(current) : null),
  });
  /*
    `useEditorState` пересобирает снимок только на транзакции движка: у него
    нет события на смену самого `editor`, и срез, взятый при `null`, оставался
    бы прежним до первой правки. Пустая транзакция при появлении движка — то же,
    что Редактор делает для плейсхолдера: документ и история не затронуты.
  */
  useEffect(() => {
    if (editor && !editor.isDestroyed) editor.view.dispatch(editor.state.tr);
  }, [editor]);
  return state;
}
