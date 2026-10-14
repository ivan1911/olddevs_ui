"use client";

import type { Editor } from "@tiptap/react";
import { useCallback, useRef, useSyncExternalStore, type RefObject } from "react";
import { toolSignals, watchHandleEditor } from "../core/handleWatchers.js";
import { toolOptions } from "../core/toolDescriptor.js";
import type { RichTextTools } from "../core/toolOptions.js";
import type { RichTextEditorHandle } from "../RichTextEditor.js";
import { searchSnapshot } from "../features/search/searchSnapshot.js";
import { tocSnapshot } from "../features/toc/tocSnapshot.js";

/**
 * Состояние Инструмента по имени: тип из карты `RichTextTools`. Имя, которого в
 * карте нет, — `unknown`: типизация добровольна, и Инструмент без записи в карте
 * не ломает сборку.
 */
export type RichTextToolState<Name extends string> = Name extends keyof RichTextTools
  ? RichTextTools[Name] extends { state: infer State }
    ? State
    : unknown
  : unknown;

/** Снимок встроенного Инструмента; `null` — Инструмента в движке нет. */
const SNAPSHOTS = new Map<string, (editor: Editor, ref: object) => unknown>([
  [
    "search",
    (editor, ref) => {
      const { tools, searchOpen } = toolSignals(ref);
      return tools?.has("search") ? searchSnapshot(editor, searchOpen === true) : null;
    },
  ],
  [
    "toc",
    (editor, ref) => {
      const { tools, tocAt } = toolSignals(ref);
      const options = tools && toolOptions(tools, "toc");
      return options && tocSnapshot(editor, options, tocAt);
    },
  ],
]);

/** Равенство по значению для снимков: простые данные — примитивы, массивы и объекты. */
function sameValue(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  const keys = Object.keys(left);
  return (
    keys.length === Object.keys(right).length &&
    keys.every((key) => key in right && sameValue(left[key], right[key]))
  );
}

/**
 * Состояние встроенного Инструмента для своего экрана: «3 из 12» в Строке
 * статуса из Поиска, внешняя навигация из заголовков Оглавления. Имя —
 * Инструмент из набора `tools`, а тип снимка выводится из карты
 * `RichTextTools`: `search` отдаёт `SearchToolState`, `toc` — `TocToolState`.
 *
 * ПЕРЕРИСОВКА — ТОЛЬКО ПРИ СМЕНЕ СНИМКА. Снимок пересчитывается на каждую
 * транзакцию движка и на сигналы кита, которых в движке нет: открытие и закрытие
 * панели Поиска, смена текущего раздела Оглавления при прокрутке. Экран
 * перерисовывается, когда результат стал другим (сравнение по значению, как у
 * `useRichTextEditorState`), поэтому набор текста, не меняющий снимок, его не
 * трогает. Срез из `selector` сравнивается так же: `(state) => state.total`
 * подписывает экран на одно число.
 *
 * `null` — до монтажа и в первом рендере экрана, на сервере, а также когда
 * Инструмента нет в наборе `tools`: пресеты `toc` не включают, его включают
 * именем или записью `tool("toc")`. Селектор при `null` не вызывается. Один и
 * тот же `ref` отдаётся в `RichTextEditor`.
 *
 * Снимок — данные без DOM-узлов и позиций ProseMirror; изменять его не нужно.
 * Хук в стартовый граф `RichTextEditor` не входит: его цена — только у экрана,
 * который его импортировал.
 *
 * @example
 * const ref = useRef<RichTextEditorHandle>(null);
 * const total = useRichTextToolState(ref, "search", (state) => state.total);
 * const headings = useRichTextToolState(ref, "toc", (state) => state.headings);
 */
export function useRichTextToolState<Name extends string>(
  ref: RefObject<RichTextEditorHandle | null>,
  name: Name
): RichTextToolState<Name> | null;
export function useRichTextToolState<Name extends string, Slice>(
  ref: RefObject<RichTextEditorHandle | null>,
  name: Name,
  selector: (state: RichTextToolState<Name>) => Slice
): Slice | null;
export function useRichTextToolState(
  ref: RefObject<RichTextEditorHandle | null>,
  name: string,
  selector?: (state: never) => unknown
): unknown {
  const last = useRef<{ value: unknown } | null>(null);

  const subscribe = useCallback(
    (listener: () => void) => {
      // Транзакции движка — на текущем движке; он меняется — пересаживаем слушателя.
      let followed: Editor | null = null;
      const follow = () => {
        followed?.off("transaction", listener);
        const editor = ref.current?.editor ?? null;
        followed = editor && !editor.isDestroyed ? editor : null;
        followed?.on("transaction", listener);
      };
      follow();
      const stop = watchHandleEditor(ref, () => {
        follow();
        listener();
      });
      return () => {
        stop();
        followed?.off("transaction", listener);
      };
    },
    [ref]
  );

  const read = (): unknown => {
    const editor = ref.current?.editor;
    const snapshot =
      editor && !editor.isDestroyed ? (SNAPSHOTS.get(name)?.(editor, ref) ?? null) : null;
    const value = snapshot === null || !selector ? snapshot : selector(snapshot as never);
    // Прежняя ссылка, пока значение то же: иначе React видит новый снимок на каждый рендер.
    if (last.current && sameValue(last.current.value, value)) return last.current.value;
    last.current = { value };
    return value;
  };

  return useSyncExternalStore(subscribe, read, () => null);
}
