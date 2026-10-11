"use client";

import { useLayoutEffect, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ViewIsland } from "../core/viewIsland.js";

export interface BlockIslandSlotsProps {
  /** Острова, нужные Документу (`islandsFor`): компонент и объявленные атрибуты по имени Блока. */
  islands: readonly ViewIsland[];
  /** Отпечаток HTML просмотра: сменился Документ — Блоки новые, и остров ищет их заново. */
  docKey: string;
}

interface Found {
  element: HTMLElement;
  block: string;
  text: string;
  data: DOMStringMap;
  /** Ближайший Блок-предок среди найденных: Остров внешнего Блока владеет всем внутри. */
  parent: Found | undefined;
}

/**
 * Тело острова своих Блоков (ADR-0058, п. 3.3); оболочка и ленивая
 * загрузка — `BlockIsland.tsx`. Оживляет каждый Блок, у которого в описании есть `island`. Устроен как
 * `CodeCopyIsland` — «Копировать» у блоков кода.
 *
 * СЕРВЕРНЫЙ HTML ПЕРВИЧЕН. Блок приходит в разметке целиком и читается без JS и
 * до гидрации; здесь после монтирования в Блок встаёт компонент потребителя
 * вместо его содержимого, а при размонтировании Острова (смена `tools`, уход
 * Блока) содержимое возвращается. Компонент получает имя Блока, объявленные
 * атрибуты и текст — снятые с серверного HTML до замены.
 *
 * ПОИСК — ОТ СВОЕГО МЕСТА В ДЕРЕВЕ, как у «Копировать»: пустой инертный
 * `<template>` стоит сразу за контейнером просмотра (или за метками других
 * островов), и просмотр в теневом корне или `iframe` находит свои Блоки. Метка
 * есть и в разметке сервера, и в первом клиентском проходе — гидрация
 * совпадает; Острова появляются только после эффекта.
 *
 * ЭФФЕКТ ЗАВИСИТ ОТ ДОКУМЕНТА, а не от `tools`: новый литерал массива у
 * родителя не должен перемонтировать Острова и сбрасывать их состояние.
 * Находятся все Блоки с `data-block`, а какие из них оживут — решается при
 * отрисовке по текущим `islands`.
 */
export default function BlockIslandSlots({ islands, docKey }: BlockIslandSlotsProps) {
  const [found, setFound] = useState<Found[]>([]);
  const marker = useRef<HTMLTemplateElement>(null);

  useEffect(() => {
    let view = marker.current?.previousElementSibling;
    while (view?.localName === "template") view = view.previousElementSibling;
    const list: Found[] = [];
    for (const element of view?.querySelectorAll<HTMLElement>("[data-block]") ?? []) {
      const parent = element.parentElement?.closest<HTMLElement>("[data-block]");
      list.push({
        element,
        block: element.dataset.block ?? "",
        text: element.textContent ?? "",
        data: { ...element.dataset },
        parent: list.find((item) => item.element === parent),
      });
    }
    setFound(list);
  }, [docKey]);

  const has = (item: Found) => islands.some((entry) => entry.block === item.block);
  const covered = (item: Found) => {
    for (let up = item.parent; up; up = up.parent) if (has(up)) return true;
    return false;
  };

  return (
    <>
      <template ref={marker} data-block-island="" />
      {found.map((item, index) => {
        const entry = islands.find((candidate) => candidate.block === item.block);
        return entry && !covered(item) ? (
          <Slot key={`${docKey}:${index}`} item={item} entry={entry} />
        ) : null;
      })}
    </>
  );
}

/**
 * Одно вхождение Блока. Содержимое серверного HTML снимается и заменяется
 * пустым корнем Острова; корень встаёт ДО отрисовки компонента (`ready`), чтобы
 * его эффекты видели себя в документе. Размонтирование возвращает содержимое.
 */
function Slot({ item, entry }: { item: Found; entry: ViewIsland }) {
  const { element, block, text, data } = item;
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

  const Component = entry.island;
  const attributes: Record<string, string> = {};
  for (const name of Object.keys(entry.attributes ?? {})) {
    if (data[name] !== undefined) attributes[name] = data[name];
  }
  return ready
    ? createPortal(<Component block={block} attributes={attributes} text={text} />, root)
    : null;
}
