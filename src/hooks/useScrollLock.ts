"use client";

import { useEffect, useRef } from "react";

/**
 * Счётчик замков — МОДУЛЬНЫЙ, и это принципиально.
 *
 * Модалки вкладываются: поверх окна редактирования открывается диалог
 * подтверждения. Закрываясь, вложенный диалог не должен разблокировать
 * прокрутку, пока внешнее окно ещё открыто. Считаем замки, снимаем блокировку
 * на последнем.
 *
 * Отсюда же следует, что копий этого модуля в приложении должна быть РОВНО ОДНА.
 * Два счётчика (например, свой во фронте и свой в пакете) не видят друг друга,
 * и вложенный случай ломается молча: внутренний диалог снимает блокировку,
 * которую ставил внешний. Поэтому хук живёт здесь, рядом с классом
 * `body.scroll-locked` из `styles.css`, а не дублируется у потребителя.
 */
let lockCount = 0;

/**
 * Чей отступ стоял на `<body>` до первого замка.
 *
 * Замок ВОЗВРАЩАЕТ прежнее значение, а не стирает его. Раньше снятие
 * присваивало `paddingRight = ""` безусловно, и приложение, держащее на
 * `<body>` собственный inline-отступ (скажем, компенсацию под свою
 * фиксированную панель), теряло его навсегда после первого же открытого
 * диалога кита — до перезагрузки страницы.
 *
 * Модульная переменная рядом со счётчиком и по той же причине: замки
 * вкладываются, и запомнить исходное состояние можно только на переходе 0→1.
 */
let paddingBeforeLock = "";
/** Что положил сам замок — чтобы не затереть чужую правку. */
let paddingSetByLock = "";

function applyLock() {
  // Полоса прокрутки исчезает вместе с прокруткой, и содержимое прыгает вбок
  // на её ширину. Компенсируем отступом.
  const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
  paddingBeforeLock = document.body.style.paddingRight;
  document.body.classList.add("scroll-locked");
  paddingSetByLock = scrollbarWidth > 0 ? `${scrollbarWidth}px` : "";
  if (paddingSetByLock) document.body.style.paddingRight = paddingSetByLock;
}

function removeLock() {
  document.body.classList.remove("scroll-locked");

  /*
    Возвращаем прежнее значение — но только если в стиле всё ещё ЛЕЖИТ НАШЕ.

    Приложение вправе поменять отступ и при поднятом замке (своя панель
    появилась, пока открыт диалог). Безусловное восстановление затёрло бы эту
    правку — то есть тот же дефект, что чинился здесь, только с другой стороны.
  */
  if (document.body.style.paddingRight === paddingSetByLock) {
    if (paddingBeforeLock) document.body.style.paddingRight = paddingBeforeLock;
    else document.body.style.removeProperty("padding-right");
  }
  paddingBeforeLock = "";
  paddingSetByLock = "";
}

/** Блокирует прокрутку страницы, пока `isLocked` истинно. */
export function useScrollLock(isLocked: boolean): void {
  const wasLocked = useRef(false);

  useEffect(() => {
    if (isLocked && !wasLocked.current) {
      if (lockCount === 0) applyLock();
      lockCount++;
      wasLocked.current = true;
    } else if (!isLocked && wasLocked.current) {
      lockCount = Math.max(0, lockCount - 1);
      if (lockCount === 0) removeLock();
      wasLocked.current = false;
    }
  }, [isLocked]);

  // Размонтирование при поднятом замке — обычное дело: компонент с модалкой
  // может исчезнуть вместе с ней. Без этого счётчик залипает навсегда.
  useEffect(() => {
    return () => {
      if (wasLocked.current) {
        lockCount = Math.max(0, lockCount - 1);
        if (lockCount === 0) removeLock();
        wasLocked.current = false;
      }
    };
  }, []);
}
