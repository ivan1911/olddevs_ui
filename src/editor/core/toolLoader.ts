"use client";

import { devError } from "../../lib/dev-warn.js";

/*
  Загрузчики Extensions (ADR-0058, п. 1.3 и 11.3–11.6).

  Промис кэшируется на самой функции загрузчика, а не на Редакторе: второй
  Редактор на странице с тем же Инструментом ничего не ждёт и загрузчик не
  зовёт. Упавший остаётся в кэше упавшим — иначе каждая перерисовка звала бы
  его снова; заново его зовёт только «Повторить» (`retry`). Механизм общий:
  встроенный Инструмент с ленивыми Extensions кладёт свой загрузчик в
  то же поле описания (`ToolDescriptor.load`).
*/

/** Загрузчик Extensions: функция с динамическим импортом. */
export type ToolLoader = () => Promise<unknown>;

/** Ход загрузки: промис не отклоняется никогда, итог — в `done` или `failed`. */
export interface ToolLoad {
  promise: Promise<void>;
  value?: unknown;
  done?: true;
  failed?: true;
}

const LOADS = new WeakMap<ToolLoader, ToolLoad>();

/** Запустить загрузчик, если он ещё не звался (или упал и это повтор). */
export function startLoad(loader: ToolLoader, retry?: boolean): ToolLoad {
  let load = LOADS.get(loader);
  if (!load || (retry && load.failed)) {
    const next: ToolLoad = (load = {} as ToolLoad);
    next.promise = new Promise((resolve) => resolve(loader())).then(
      (value) => {
        next.value = value;
        next.done = true;
      },
      (error: unknown) => {
        next.failed = true;
        devError("RichTextEditor: a tool loader failed", error);
      }
    );
    LOADS.set(loader, next);
  }
  return load;
}

/** Что отдал загрузчик; до конца загрузки — `undefined`. */
export const loaded = (loader: ToolLoader): unknown => LOADS.get(loader)?.value;
