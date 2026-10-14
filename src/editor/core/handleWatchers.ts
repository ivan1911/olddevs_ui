import type { RefObject } from "react";

/*
  Хук-селектор не знает, когда у `ref` появится движок: Редактор создаёт его
  после первого рендера экрана и перерисовывается сам, а экран — нет. Поэтому
  подписки живут по самому объекту `ref`, который есть с первого рендера, и
  Редактор сообщает об смене движка по нему.

  Модуль вынесен из `handle.ts` и не знает движка: подписаться на смену движка
  нужно и `RichTextToc`, а ему Tiptap в бандл не нужен.
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
