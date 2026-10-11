import type { ReactNode } from "react";

/**
 * Пустота, которую `== null` не видит.
 *
 * Один и тот же дефект кит ловил уже пять раз, и каждый раз чинил ОДНУ точку, а
 * не правило: подпись `""` не считалась отсутствующей (`Segmented`, потом
 * `CopyButton`, потом `ToggleGroup`), пустой массив детей не считался пустым
 * списком (`NotificationList`), `NaN` проходил проверку на «значение задано»
 * (`Progress`). Проверка `== null` ловит ровно `null` и `undefined` — а пустым
 * в разметке бывает ещё и `""`, и `[]`, и `false`, и `NaN`.
 *
 * Отсюда общее место и тест-семейство рядом с ним: починка одной кнопки
 * воспроизводит причину, починка предиката — нет.
 */

/**
 * Есть ли что показать: подпись, имя, содержимое ячейки.
 *
 * `false` тоже пустой — это результат `{flag && <Icon/>}`, самой частой идиомы
 * условного рендера. Ноль НЕ пустой: `0` — законное значение счётчика.
 *
 * Для пропа типа `string` предикат не нужен: там `value || fallback` выражает
 * то же правило и не спорит с сужением типов. `hasContent` — про `ReactNode`,
 * где пустыми бывают ещё `false` и массив.
 */
export function hasContent(value: ReactNode): boolean {
  if (value == null || value === false || value === "") return false;
  if (Array.isArray(value)) return value.some(hasContent);
  return true;
}

/**
 * Число, которое можно показать и объявить.
 *
 * `NaN` и бесконечности отсекаются вместе с `null`: они приходят из арифметики
 * потребителя (`loaded / total` при нулевом `total`) и до волны 26 проходили
 * насквозь — `width: NaN%` растягивал полосу прогресса на всю ширину, а
 * скринридер читал «NaN процентов».
 */
export function isShowableNumber(value: number | null | undefined): value is number {
  return value != null && Number.isFinite(value);
}
