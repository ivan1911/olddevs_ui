"use client";

import { useEditorState, type Editor } from "@tiptap/react";
import { useCallback, useEffect, useSyncExternalStore, type RefObject } from "react";
import { watchHandleEditor } from "../core/handle.js";
import type { RichTextEditorHandle } from "../RichTextEditor.js";

/**
 * The slice of Editor state for the screen's own toolbar: active Marks, whether a command
 * can run, the selection, anything that `selector` computes from `editor`.
 *
 * RE-RENDERS ONLY ON A SLICE CHANGE. The hook sits on Tiptap's `useEditorState`: the selector
 * runs on every transaction, and the component re-renders when the result has become different
 * (compared by value, so a selector may return an object). Typing that does not change the slice
 * does not touch the toolbar.
 *
 * SAFE BEFORE MOUNT AND UNDER SSR. While there is no engine (on the server, in the screen's
 * first render) it returns `null`, and the selector is not called. When the engine appears,
 * the screen re-renders by itself. The same `ref` is passed to `RichTextEditor`.
 *
 * The toolbar's commands are called through `ref.current.editor.chain().focus()…run()`;
 * the toolbar's buttons need `preventDefault` on `mousedown`, otherwise the click would
 * take focus away.
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
    `useEditorState` rebuilds the snapshot only on the engine's transactions: it has no event
    for a change of `editor` itself, so a slice taken while it was `null` would stay stale
    until the first edit. The empty transaction when the engine appears does what the Editor
    does for the placeholder: neither the document nor the history is affected.
  */
  useEffect(() => {
    if (editor && !editor.isDestroyed) editor.view.dispatch(editor.state.tr);
  }, [editor]);
  return state;
}
