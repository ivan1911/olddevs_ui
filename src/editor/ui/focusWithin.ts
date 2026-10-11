import type { EditorView } from "@tiptap/pm/view";

/**
 * Фокус в документе Редактора или внутри его плавающей панели — условие показа
 * `BubbleMenu` (Панель над выделением, панель картинки).
 *
 * АКТИВНЫЙ ЭЛЕМЕНТ — ИЗ ДОКУМЕНТА САМОЙ ПАНЕЛИ, а не из глобального `document`.
 * Редактор в `iframe` или теневом корне живёт в чужом документе: глобальный
 * `document.activeElement` там — сам `iframe`, и панель пряталась бы от
 * собственной кнопки в фокусе. И второе: `BubbleMenu` зовёт условие по
 * таймеру, который может сработать после того, как окно уже снято (размонтаж,
 * конец теста), — обращение к глобальному `document` тогда падает, а у
 * `ownerDocument` элемента он есть всегда.
 */
export function focusWithin(view: Pick<EditorView, "hasFocus">, element: HTMLElement): boolean {
  return view.hasFocus() || element.contains(element.ownerDocument.activeElement);
}

/**
 * Куда щелчок мимо поповера или меню ставит фокус осознанно: поле, кнопка,
 * ссылка, документ. Фокус на таком элементе после закрытия не отбирают; на
 * теле страницы или на контейнере окна (ловушка фокуса `Dialog` ставит его
 * туда, когда фокусный узел исчез) он оказался сам — его возвращают.
 */
export const FOCUS_TARGET =
  'a[href], button, input, select, textarea, summary, [contenteditable]:not([contenteditable="false"]), [tabindex]:not([tabindex="-1"])';
