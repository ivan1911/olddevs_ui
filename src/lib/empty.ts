import type { ReactNode } from "react";

/**
 * Emptiness that `== null` does not see.
 *
 * The kit has already caught the same defect five times, and each time it fixed ONE spot rather than
 * the rule: the label `""` was not treated as missing (`Segmented`, then `CopyButton`, then
 * `ToggleGroup`), an empty array of children was not treated as an empty list (`NotificationList`),
 * and `NaN` passed the "value is set" check (`Progress`). The `== null` check catches exactly `null`
 * and `undefined`, but in markup "empty" can also mean `""`, `[]`, `false` or `NaN`.
 *
 * Hence a shared place for the rule, and a family of tests beside it: fixing one button leaves the
 * cause in place, while fixing the predicate removes it.
 */

/**
 * Whether there is something to show: a label, a name, cell content.
 *
 * `false` is empty too: it is the result of `{flag && <Icon/>}`, the most common conditional-render
 * idiom. Zero is NOT empty: `0` is a legitimate counter value.
 *
 * A prop of type `string` does not need the predicate: there `value || fallback` expresses the same
 * rule and does not conflict with type narrowing. `hasContent` is about `ReactNode`, where `false`
 * and arrays are also empty.
 */
export function hasContent(value: ReactNode): boolean {
  if (value == null || value === false || value === "") return false;
  if (Array.isArray(value)) return value.some(hasContent);
  return true;
}

/**
 * A number that can be shown and announced.
 *
 * `NaN` and infinities are filtered out along with `null`: they come from the consumer's arithmetic
 * (`loaded / total` with a zero `total`), and until wave 26 they passed straight through. `width: NaN%`
 * stretched the progress bar across the full width, and the screen reader read "NaN percent".
 */
export function isShowableNumber(value: number | null | undefined): value is number {
  return value != null && Number.isFinite(value);
}
