"use client";

import { useEffect, useRef, type RefObject } from "react";
import { pushOverlayLayer } from "../lib/overlay-layer.js";

/**
 * Регистрация модального слоя в общем стеке (ADR-0041).
 *
 * Хук, а не прямой вызов в каждом компоненте, по двум причинам.
 *
 * ПЕРВАЯ — жизненный цикл. Регистрировать надо ИМЕННО В ЭФФЕКТЕ: стек —
 * модульный, и запись в него из тела компонента была бы побочным действием
 * рендера. В StrictMode React монтирует, размонтирует и монтирует снова, и
 * слой, положенный в рендере и снятый уборщиком, обратно уже не попадал —
 * подложка переставала считать себя верхней и молча переставала закрываться по
 * Escape. Один правильный цикл лучше четырёх копий.
 *
 * ВТОРАЯ — охват. ADR обещает, что в стеке состоят ВСЕ модальные слои кита, и
 * первая версия обещание не держала: регистрировался один `ModalOverlay`, то
 * есть стек решал «подложка против подложки» и ничего больше.
 */
export function useOverlayLayer(
  open: boolean,
  /** Узел слоя: по его положению в документе и определяется верхний. */
  nodeRef: RefObject<HTMLElement | null>
): { isTopmost: () => boolean } {
  const layerRef = useRef<ReturnType<typeof pushOverlayLayer> | null>(null);

  useEffect(() => {
    if (!open) return;
    const layer = pushOverlayLayer();
    layer.attach(nodeRef.current);
    layerRef.current = layer;
    return () => {
      layer.release();
      layerRef.current = null;
    };
  }, [open, nodeRef]);

  // Незарегистрированный слой верхним себя не считает: он закрыт.
  return { isTopmost: () => layerRef.current?.isTopmost() ?? false };
}
