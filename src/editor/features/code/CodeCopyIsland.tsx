"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CodeCopyButton } from "./CodeCopyButton.js";

export interface CodeCopyIslandProps {
  /** Идентификатор просмотра: гнёзда его блоков помечены им же (`withCodeHeaders`). */
  hostId: string;
  /** Отпечаток HTML просмотра: сменился Документ — гнёзда новые, и остров ищет их заново. */
  docKey: string;
}

interface Slot {
  element: HTMLElement;
  code: string;
}

/**
 * Островок клиента у `RichTextView`: вставляет кнопку «Копировать» в гнёзда
 * шапок блоков кода.
 *
 * ЗАЧЕМ ОН. `RichTextView` — серверный компонент, и обработчика клика у него
 * быть не может. Шапка с подписью языка и пустым гнездом приходит в HTML от
 * сервера; здесь, после монтирования, в каждое гнездо своего просмотра
 * вставляется порталом `CodeCopyButton`. До гидрации и без JS кнопки нет, а
 * документ читается так же.
 *
 * ЧТО КОПИРУЕТСЯ — `textContent` элемента `code` рядом с гнездом. Для текста
 * без разметки и для блока, уже подсвеченного `highlightCodeBlocks` (токены —
 * `span` внутри `code`), это один и тот же исходный код: токены текста не
 * добавляют (ADR-0039: копируется текст, а не разметка).
 *
 * ГНЁЗДА ИЩУТСЯ ОТ СВОЕГО МЕСТА В ДЕРЕВЕ, а не по глобальному `document`. У
 * серверного компонента нет ссылки, которую можно передать клиентскому, поэтому
 * остров рисует пустой инертный `<template>` сразу за контейнером просмотра
 * (`RichTextView` ставит их соседями) и после монтирования берёт его соседа
 * слева. Так просмотр в теневом корне или в `iframe`, которых глобальный
 * `document` не видит, получает свои кнопки, а обход идёт только по своему
 * контейнеру, а не по всей странице. Идентификатор гнезда сверяется всё равно:
 * гнездо с чужим идентификатором кнопку не получает.
 *
 * `<template>` есть и в разметке сервера, и в первом клиентском проходе, а
 * порталы появляются только после эффекта — разметка сервера и гидрации
 * совпадают. `<template>` браузер не показывает и в дерево доступности не
 * кладёт; во флексе и гриде родителя он не занимает ячейку.
 */
export function CodeCopyIsland({ hostId, docKey }: CodeCopyIslandProps) {
  const [slots, setSlots] = useState<Slot[]>([]);
  const markerRef = useRef<HTMLTemplateElement>(null);

  useEffect(() => {
    const view = markerRef.current?.previousElementSibling;
    const found = [...(view?.querySelectorAll<HTMLElement>("[data-code-copy]") ?? [])]
      .filter((element) => element.dataset.codeCopy === hostId)
      .map((element) => ({
        element,
        code: element.closest("[data-code-block]")?.querySelector("pre > code")?.textContent ?? "",
      }));
    setSlots(found);
  }, [hostId, docKey]);

  return (
    <>
      <template ref={markerRef} data-code-copy-island="" />
      {slots.map(({ element, code }, index) =>
        createPortal(<CodeCopyButton code={code} />, element, `${hostId}:${index}`)
      )}
    </>
  );
}
