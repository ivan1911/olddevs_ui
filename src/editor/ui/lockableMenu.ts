"use client";

import { useState } from "react";

/**
 * Недоступная кнопка меню — `aria-disabled`, а не `disabled`: APG советует
 * оставлять действия панели фокусируемыми, иначе стрелки перепрыгивают кнопку
 * молча (как у кнопок Панели, `EditorToolbar`). Тип `MenuButton` атрибута не
 * знает, а кнопка react-aria передаёт его в DOM.
 */
export function unavailableProps(unavailable: boolean | undefined): object {
  return unavailable ? { "aria-disabled": true } : {};
}

/**
 * Меню Панели, которое бывает недоступным (HTML-режим, `aria-disabled`):
 * управляемый `MenuTrigger`. Недоступная кнопка нажимается — фокус и стрелки у
 * неё есть, — но меню не открывает, а ставшее недоступным открытое меню
 * закрывается. Общий каркас «¶», «…», «Выравнивания», «Списков», «+» и
 * «Таблицы»: `trigger` — пропы `MenuTrigger`, `button` — пропы кнопки меню,
 * `close` — закрыть меню из кода (выбор не пунктом, а, например, в сетке).
 *
 * Отдельным модулем, а не в `FormatMenus.tsx`: каркасом пользуются и меню
 * фич (таблица), и тянуть ради него форматные меню фича не должна — иначе
 * общий UI и фича импортируют друг друга (ADR-0060, пункт 14).
 */
export function useLockableMenu(unavailable: boolean) {
  const [open, setOpen] = useState(false);
  return {
    trigger: {
      isOpen: open && !unavailable,
      onOpenChange: (next: boolean) => setOpen(next && !unavailable),
    },
    button: unavailableProps(unavailable),
    close: () => setOpen(false),
  };
}
