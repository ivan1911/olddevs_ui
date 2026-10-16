"use client";

import { useLayoutEffect, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { VideoPlayer } from "./VideoPlayer.js";
import { parseVideoLink } from "./videoLink.js";
import { isVideoProvider, isVideoSrc, VIDEO_BLOCK, type VideoLink } from "./videoSrc.js";

export interface VideoIslandSlotsProps {
  /** Отпечаток HTML просмотра: сменился Документ — блоки новые, и остров ищет их заново. */
  docKey: string;
}

interface Found {
  element: HTMLElement;
  link: VideoLink;
}

/**
 * Тело острова видео (ADR-0071, п. 3); оболочка и ленивая загрузка —
 * `VideoIsland.tsx`. Устроен как остров своих Блоков (`BlockIslandSlots.tsx`).
 *
 * СЕРВЕРНЫЙ HTML ПЕРВИЧЕН. Блок приходит в разметке целиком — со ссылкой внутри — и
 * читается без JS, до гидрации и в Markdown. После монтирования его содержимое
 * заменяет `VideoPlayer`: заглушка с кнопкой «Воспроизвести» и, после щелчка, плеер
 * с адресом, собранным здесь же. Размонтирование острова возвращает ссылку.
 * Блок, у которого сервис или адрес не годятся (HTML не прошёл очистку, чужой
 * сервис), остаётся ссылкой: плеер строится только из того, что узнаёт `isVideoSrc`.
 *
 * ПОИСК — ОТ СВОЕГО МЕСТА В ДЕРЕВЕ, как у «Копировать»: пустой инертный
 * `<template>` стоит сразу за контейнером просмотра (или за метками других
 * островов), поэтому просмотр в теневом корне или `iframe` находит свои блоки.
 * Метка есть и в разметке сервера, и в первом клиентском проходе — гидрация
 * совпадает; порталы появляются только после эффекта.
 *
 * ЭФФЕКТ ЗАВИСИТ ОТ ДОКУМЕНТА (`docKey`), а не от пропсов просмотра: новый литерал у
 * родителя не должен перемонтировать плееры и обрывать воспроизведение.
 */
export default function VideoIslandSlots({ docKey }: VideoIslandSlotsProps) {
  const [found, setFound] = useState<Found[]>([]);
  const marker = useRef<HTMLTemplateElement>(null);

  useEffect(() => {
    let view = marker.current?.previousElementSibling;
    while (view?.localName === "template") view = view.previousElementSibling;
    const list: Found[] = [];
    for (const element of view?.querySelectorAll<HTMLElement>(`div[data-block="${VIDEO_BLOCK}"]`) ??
      []) {
      const provider = element.dataset.provider;
      const src = element.dataset.src ?? "";
      const link = parseVideoLink(src);
      if (isVideoProvider(provider) && isVideoSrc(provider, src) && link?.provider === provider) {
        // Блок внутри блока видео — вложенность, которой нет: оживает внешний.
        if (!element.parentElement?.closest(`div[data-block="${VIDEO_BLOCK}"]`)) {
          list.push({ element, link });
        }
      }
    }
    setFound(list);
  }, [docKey]);

  return (
    <>
      <template ref={marker} data-video-island="" />
      {found.map((item, index) => (
        <Slot key={`${docKey}:${index}`} item={item} />
      ))}
    </>
  );
}

/**
 * Одно вхождение блока. Содержимое серверного HTML снимается и заменяется пустым
 * корнем острова; корень встаёт ДО отрисовки плеера (`ready`), чтобы его эффекты
 * видели себя в документе. Размонтирование возвращает содержимое.
 */
function Slot({ item }: { item: Found }) {
  const { element, link } = item;
  const [root] = useState(() => {
    const span = document.createElement("span");
    span.style.display = "contents";
    return span;
  });
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    const original = [...element.childNodes];
    element.replaceChildren(root);
    setReady(true);
    return () => element.replaceChildren(...original);
  }, [element, root]);

  return ready ? createPortal(<VideoPlayer link={link} />, root) : null;
}
