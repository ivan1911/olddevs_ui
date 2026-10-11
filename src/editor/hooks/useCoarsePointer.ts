"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(pointer: coarse)";

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
 * Основной указатель — палец (`pointer: coarse`): телефон, планшет.
 *
 * ПОЧЕМУ JS, А НЕ МЕДИАЗАПРОС В CSS. Медиазапрос спрятал бы плавающую Панель,
 * но не заменил бы её фиксированной: это разные узлы с разной раскладкой, и
 * выбор между ними — ветка рендера. До гидратации ветки нет вовсе — движок и
 * Панели появляются только в браузере (`immediatelyRender: false`), — поэтому
 * мигания «не та Панель до гидратации» здесь не бывает.
 *
 * Подписка, а не разовый замер: планшет с подключённой мышью и ноутбук-
 * трансформер меняют основной указатель на лету.
 *
 * На сервере и без `matchMedia` — `false`: устройство неизвестно, и
 * остаётся то, что выбрал потребитель.
 */
export function useCoarsePointer(): boolean {
  return useSyncExternalStore(subscribe, snapshot, () => false);
}
