"use client";

import { NodeSelection, TextSelection } from "@tiptap/pm/state";
import type { BubbleMenuProps } from "@tiptap/react/menus";
import { useEffect, useMemo, type RefObject } from "react";
import { focusWithin } from "./focusWithin.js";
import { isImageSelection } from "../features/image/image.js";

/**
 * Общее у всего, что всплывает над выделением на `BubbleMenu` Tiptap: у
 * плавающей Панели (`toolbar="floating"`) и у меню выделения
 * (`toolbar="bubble"`). Условие показа и позиция у них одни: две
 * копии разъехались бы молча, и плашка показывалась бы там, где Панель — нет.
 */

/**
 * Условие показа — умолчание `BubbleMenu` плюс два исключения: над
 * выделенной картинкой стоит её собственная панель (`ImageToolbar`), и меню
 * форматирования спорило бы с ней за одно место; над выделенным своим Блоком
 * с Признаком «атом без меню форматирования» (`plainAtom` в spec узла) Меток
 * не ставят.
 *
 * Пустое выделение, пустой текст под выделением, нередактируемое поле и фокус
 * вне документа и вне самого меню — не показывать.
 *
 * ОТКРЫТОЕ ИЗ МЕНЮ — ТОЖЕ «ФОКУС ВНУТРИ». Списки «¶», «…», цвета и сетка эмодзи
 * живут в портале, вне узла меню, и фокус в них для `focusWithin` — снаружи.
 * А условие пересчитывается таймером после каждой правки: жирный за миг до
 * открытия «¶» прятал плашку вместе с кнопкой меню, и Escape возвращал фокус в
 * никуда. Пока у кнопки внутри меню `aria-expanded="true"` (его ставят и
 * react-aria, и Radix), человек работает с меню — прятать его нельзя.
 */
export const showOverSelection: NonNullable<BubbleMenuProps["shouldShow"]> = ({
  editor,
  view,
  state,
  from,
  to,
  element,
}) => {
  const { selection } = state;
  if (selection.empty || !editor.isEditable || isImageSelection(selection)) return false;
  // Признак «атом без меню форматирования» своего Блока (ADR-0058, п. 1.4).
  if (selection instanceof NodeSelection && selection.node.type.spec.plainAtom === true) {
    return false;
  }
  const emptyText = !state.doc.textBetween(from, to).length && selection instanceof TextSelection;
  if (emptyText) return false;
  return focusWithin(view, element) || element.querySelector('[aria-expanded="true"]') !== null;
};

/**
 * Позиция — над выделением, с переворотом под него у верхнего края окна и
 * сдвигом от боковых краёв.
 *
 * `strategy: "absolute"` (умолчание), а не `fixed`: меню лежит в DOM Редактора
 * и едет вместе с текстом в любом контейнере прокрутки — в окне, в ящике, в
 * карточке. `fixed` пересчитывался бы только на прокрутке окна. Цена — предок
 * с `overflow: hidden` срежет меню у края; на странице компонента это сказано.
 */
export const SELECTION_MENU_OPTIONS = {
  placement: "top",
  offset: 8,
  flip: true,
  shift: { padding: 8 },
} as const satisfies BubbleMenuProps["options"];

/**
 * Опции плашки с прокруткой области Документа (ADR-0059). Плагин `BubbleMenu`
 * пересчитывает позицию на прокрутке окна; когда Документ прокручивается
 * внутри рамки (`maxHeight`, `resizable`), слушать надо его область, иначе
 * плашка висит на месте, а текст под ней уезжает. Без области — окно.
 */
export function useSelectionMenuOptions(
  scrollTarget: HTMLElement | undefined,
  options: NonNullable<BubbleMenuProps["options"]> = SELECTION_MENU_OPTIONS
): NonNullable<BubbleMenuProps["options"]> {
  return useMemo(
    () => (scrollTarget ? { ...options, scrollTarget } : options),
    [scrollTarget, options]
  );
}

/**
 * Убрать узел `BubbleMenu` из обхода Tab.
 *
 * Плагин ставит своему узлу `tabindex="0"` — ради щелчков по пустому месту
 * меню, которые иначе сняли бы фокус с документа. Но это лишняя остановка
 * Tab перед `role="toolbar"`, у которого остановка уже есть. `-1` оставляет
 * узел фокусируемым щелчком и убирает его из обхода. Эффект родителя идёт
 * после эффекта `BubbleMenu`, создающего плагин, — значение доживает.
 */
export function useOutOfTabOrder(ref: RefObject<HTMLElement | null>, dependency: unknown): void {
  useEffect(() => {
    ref.current?.setAttribute("tabindex", "-1");
  }, [ref, dependency]);
}
