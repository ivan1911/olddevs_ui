/**
 * Перестановка элементов при сбросе — чистая функция, проверяемая на массивах.
 *
 * Вынесена из `SortableList` по той же причине, что механика маски из
 * `MaskedInput` в `lib/mask.ts`: ошибка здесь стоит порядка данных пользователя,
 * а перебрать все входы удобнее на массивах, чем через перетаскивание в DOM.
 *
 * `useListData` из `react-stately` не используется: он лежит в дереве
 * транзитивно, но объявленной зависимостью кита не является (ADR-0028).
 */

export interface ReorderTarget<K> {
  /** Ключ элемента, рядом с которым сбросили. */
  key: K;
  dropPosition: "before" | "after" | "on";
}

/**
 * Новый порядок после сброса, или `null`, если сброс ничего не меняет.
 *
 * Перемещаемые вынимаются из списка целиком и вставляются перед целью или
 * после неё — так порядок внутри переносимой группы сохраняется.
 *
 * `null`, А НЕ ПРЕЖНИЙ МАССИВ, в двух случаях, и оба — не ошибка вызывающего:
 *
 * - цель сама среди перемещаемых. Раньше `findIndex` давал `-1`, и
 *   `slice(0, -1)` молча выбрасывал последний элемент списка — нашло ревью
 *   2.5.0. Сброс «на себя» — законный жест, и отвечать на него потерей данных
 *   нельзя;
 * - `dropPosition === "on"`: вложить в элемент списку некуда.
 */
export function reorder<K, T extends { id: K }>(
  items: readonly T[],
  keys: ReadonlySet<K>,
  target: ReorderTarget<K>
): T[] | null {
  if (target.dropPosition === "on") return null;

  const moving = items.filter((item) => keys.has(item.id));
  const rest = items.filter((item) => !keys.has(item.id));
  const at = rest.findIndex((item) => item.id === target.key);
  if (at === -1) return null;

  const index = target.dropPosition === "before" ? at : at + 1;
  return [...rest.slice(0, index), ...moving, ...rest.slice(index)];
}

/**
 * Место строки, пришедшей из другого списка группы: индекс в списке-приёмнике
 * или `null`, если положить её некуда.
 *
 * `target === null` — бросок на сам список, а не рядом со строкой: так
 * react-aria сообщает о пустом списке, и строка встаёт в конец. `"on"` —
 * вложить в строку нельзя, как и при перестановке.
 */
export function insertionIndex<K, T extends { id: K }>(
  items: readonly T[],
  target: ReorderTarget<K> | null
): number | null {
  if (target == null) return items.length;
  if (target.dropPosition === "on") return null;
  const at = items.findIndex((item) => item.id === target.key);
  if (at === -1) return null;
  return target.dropPosition === "before" ? at : at + 1;
}
