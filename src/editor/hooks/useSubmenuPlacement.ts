"use client";

import { useSyncExternalStore } from "react";

/** Уже `sm` (640): на такой ширине подменю сбоку от пункта не помещается. */
const QUERY = "(max-width: 639px)";

function subscribe(onChange: () => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {};
  const list = window.matchMedia(QUERY);
  list.addEventListener("change", onChange);
  return () => list.removeEventListener("change", onChange);
}

function snapshot(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia(QUERY).matches;
}

/**
 * Где открыть подменю Редактора: сбоку от пункта или под ним.
 *
 * Сбоку — привычно на десктопе. На телефоне места нет ни справа, ни слева:
 * меню само занимает середину экрана, и react-aria, перевернув подменю на
 * другую сторону, ширину его не ужимает — на iPhone сетка размера таблицы
 * уехала за левый край. Поэтому на узком экране подменю встаёт под своим
 * пунктом, поверх родительского меню, как в меню самого телефона; по
 * поперечной оси react-aria его сдвигает в экран.
 *
 * Ширина, а не указатель (`useCoarsePointer`): дело в месте. Телефон,
 * повёрнутый горизонтально, и планшет оставляют подменю сбоку.
 *
 * JS, а не CSS: место подменю — проп поповера, а не класс. Подписка — экран
 * поворачивают на лету. На сервере и без `matchMedia` — сбоку: подменю
 * открывается только в браузере, по действию пользователя.
 */
export function useSubmenuPlacement(): "bottom start" | "right top" {
  const narrow = useSyncExternalStore(subscribe, snapshot, () => false);
  return narrow ? "bottom start" : "right top";
}
