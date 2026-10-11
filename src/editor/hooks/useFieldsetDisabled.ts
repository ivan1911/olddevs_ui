"use client";

import { useEffect, useState, type RefObject } from "react";

/**
 * Лежит ли узел внутри выключенного `<fieldset disabled>` — и следит за ним.
 *
 * ЗАЧЕМ DOM, А НЕ КОНТЕКСТ. Кит выключает форму на время запроса именно через
 * `<fieldset disabled>` (`Form pending`), и поле, которое смотрит в `Form`,
 * остаётся слепым к любому чужому `fieldset` — а потребитель вправе
 * выключить группу полей сам. Родные поля реагируют на оба случая одинаково, и
 * чтобы редактор не отличался, он читает то, что читает браузер, — атрибут
 * предка. Второй канал через контекст `Form` дублировал бы это правило и всё
 * равно не покрыл бы чужие `fieldset`.
 *
 * Обход идёт по предкам, а не по ближайшему `fieldset`: вложенный в выключенный
 * тоже выключен. Исключение браузера повторено — потомки ПЕРВОГО `<legend>`
 * выключенного набора остаются доступными.
 *
 * Переключения ловит `MutationObserver` на атрибуте `disabled` каждого предка:
 * `Form pending` переключает его без перемонтажа детей. Перенос самого узла в
 * другой `fieldset` не отслеживается — такое DOM-перемещение React не делает.
 */
export function useFieldsetDisabled(ref: RefObject<HTMLElement | null>): boolean {
  const [disabled, setDisabled] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const fieldsets: HTMLFieldSetElement[] = [];
    for (let el = node.parentElement; el; el = el.parentElement) {
      if (el.localName === "fieldset") fieldsets.push(el as HTMLFieldSetElement);
    }
    if (fieldsets.length === 0) return;

    const inFirstLegend = (fieldset: HTMLFieldSetElement) =>
      Array.from(fieldset.children)
        .find((child) => child.localName === "legend")
        ?.contains(node) ?? false;
    const read = () =>
      setDisabled(fieldsets.some((fieldset) => fieldset.disabled && !inFirstLegend(fieldset)));

    read();
    const observer = new MutationObserver(read);
    for (const fieldset of fieldsets) {
      observer.observe(fieldset, { attributes: true, attributeFilter: ["disabled"] });
    }
    return () => observer.disconnect();
  }, [ref]);

  return disabled;
}
