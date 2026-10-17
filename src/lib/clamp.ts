/**
 * Clamp a number between bounds.
 *
 * Extracted when the expression had been written for the fourth time: `Pagination`, `Tabs`,
 * `SplitPanel` and `Rating`. The function is trivial, and its value is not in saving lines but in the
 * fact that a reversed range is handled the same way everywhere.
 *
 * When `min > max`, `max` is returned: the only variant in which the result stays within the declared
 * upper limit. A component that must not pass an invalid range outward should normalize the bounds
 * before the call, as `SplitPanel` does.
 *
 * `@internal`: not exported from the package. It is a utility of the kit, not part of its public API.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
