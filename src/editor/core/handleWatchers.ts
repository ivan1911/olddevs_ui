import type { RefObject } from "react";
import type { ToolList } from "./toolDescriptor.js";

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

/**
 * Сигналы кита для `useRichTextToolState`: то, что меняется не транзакцией
 * движка, а интерфейсом Инструмента, и поэтому в движке его не прочитать.
 * Редактор кладёт их по `ref`, как и сообщение о движке, и хук получает
 * уведомление той же подпиской.
 */
export interface ToolSignals {
  /** Набор Инструментов этого Редактора: есть ли Инструмент и с какими Опциями. */
  tools?: ToolList;
  /** Панель Поиска открыта (состояние React в `RichTextEditor`). */
  searchOpen?: boolean;
  /** Индекс текущего раздела Оглавления (вычисляет `TocCore` от прокрутки). */
  tocAt?: number;
}

const signals = new WeakMap<object, ToolSignals>();

/**
 * Редактор сообщает сигналы Инструментов: слитые с прежними, подписчикам идёт то
 * же уведомление, что и о смене движка.
 */
export function publishToolSignals(ref: unknown, next: ToolSignals): void {
  if (typeof ref !== "object" || ref === null) return;
  signals.set(ref, { ...signals.get(ref), ...next });
  notifyHandleEditor(ref);
}

/** Сигналы Инструментов Редактора, привязанного к `ref`. */
export function toolSignals(ref: object): ToolSignals {
  return signals.get(ref) ?? {};
}
