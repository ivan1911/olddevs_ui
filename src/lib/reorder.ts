/**
 * Reordering items on drop. A pure function that is tested on arrays.
 *
 * Extracted from `SortableList` for the same reason as the mask logic of `MaskedInput`
 * in `lib/mask.ts`: a bug here costs the user their data order, and it is easier to
 * exhaust all inputs on arrays than by dragging in the DOM.
 *
 * `useListData` from `react-stately` is not used: it is in the tree transitively, but
 * it is not a declared dependency of the kit (ADR-0028).
 */

export interface ReorderTarget<K> {
  /** Key of the item the drop landed next to. */
  key: K;
  dropPosition: "before" | "after" | "on";
}

/**
 * The new order after the drop, or `null` if the drop changes nothing.
 *
 * The moved items are taken out of the list as a whole and inserted before or after the
 * target, so their order within the moved group is preserved.
 *
 * `null`, NOT THE PREVIOUS ARRAY, in two cases. Neither one is a caller error:
 *
 * - the target is itself among the moved items. Previously `findIndex` returned `-1`,
 *   and `slice(0, -1)` silently dropped the last item of the list. The 2.5.0 review
 *   found it. Dropping an item onto itself is a legitimate gesture, and answering it
 *   with data loss is not acceptable;
 * - `dropPosition === "on"`: a list has no place to nest an item.
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
 * The place for a row that came from another list of the group: an index in the receiving
 * list, or `null` if the row cannot be placed there.
 *
 * `target === null` means the drop is on the list itself, not next to a row. This is how
 * react-aria reports an empty list, and the row goes to the end. `"on"` means the row
 * cannot be nested into another row, the same as in reordering.
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
