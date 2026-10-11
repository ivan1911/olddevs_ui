"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "../../lib/cn.js";
import { hasOpenAriaOverlay, OVERLAY_LAYER } from "../../lib/overlay-layer.js";
import { useOverlayLayer } from "../../hooks/useOverlayLayer.js";

export interface ModalOverlayProps {
  /** Вызывается по клику на подложку и по Escape. */
  onClose: () => void;
  /** Класс z-index: у приложения несколько слоёв оверлеев. */
  zIndex?: string;
  /** Вертикальное выравнивание содержимого. */
  align?: "center" | "start";
  /** Цвет подложки; по умолчанию `--overlay-scrim`. */
  backdrop?: string;
  /** Радиус размытия подложки. */
  blur?: string;
  /** Закрывать ли по Escape. */
  escape?: boolean;
  /** Классы на обёртку содержимого. */
  className?: string;
  /** Содержимое поверх подложки — само окно. */
  children?: ReactNode;
}

/**
 * Затемнённая подложка под модальным окном.
 *
 * ЧЕГО ЗДЕСЬ НЕТ И ПОЧЕМУ. Это не диалог, а только подложка: ни `role="dialog"`,
 * ни `aria-modal`, ни ловушки фокуса, ни блокировки прокрутки. Полноценный
 * диалог требует доступного имени, а имя знает только вызывающий — навесить
 * `role="dialog"` без имени значит сделать хуже, чем без роли вовсе:
 * скринридер объявит безымянный диалог. Ловушка фокуса и блокировка прокрутки
 * во фронте живут отдельными хуками (`useScrollLock`), и тащить их сюда —
 * отдельное решение, а не побочный эффект переезда.
 *
 * То есть примитив честно делает одно: гасит фон, ловит Escape и клик мимо.
 *
 * ВЫХОДНОЙ АНИМАЦИИ ЗДЕСЬ НЕТ, и это не недоделка. Волна 29 дала уход всем
 * оверлеям кита, кроме этого: у `ModalOverlay` нет пропа `open` — потребитель
 * монтирует его условием (`{isOpen && <ModalOverlay>}`), и в момент закрытия
 * узла уже нет в дереве. Анимировать нечего: уходить должен элемент, а он
 * исчез до того, как о закрытии стало известно.
 *
 * Дать ему уход можно только одним способом: принять `open` внутрь и удерживать
 * узел самому, пока идёт анимация, — как это делают Radix и react-aria. Это
 * смена контракта и поломка существующих вызовов, то есть отдельное решение, а
 * не побочный эффект волны про движение.
 */
export function ModalOverlay({
  onClose,
  zIndex = OVERLAY_LAYER.modal,
  align = "center",
  backdrop = "var(--overlay-scrim)",
  blur = "4px",
  escape = true,
  className,
  children,
}: ModalOverlayProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const layer = useOverlayLayer(true, rootRef);

  useEffect(() => {
    if (!escape) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;

      /*
        Отвечает ТОЛЬКО верхний слой, и только если чужой не занял событие.

        Слушатель висел на `document` в фазе всплытия и реагировал на любой
        Escape: две вложенные подложки схлопывались одним нажатием, а `Select`
        или `Popover` внутри подложки закрывался вместе с ней целиком. Radix к
        этому моменту уже обработал событие в фазе ЗАХВАТА и позвал
        `preventDefault()` — подложка это игнорировала. Разбор — ADR-0041.
      */
      if (e.defaultPrevented) return;
      if (hasOpenAriaOverlay()) return;
      if (!layer.isTopmost()) return;
      onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [escape, onClose]);

  return (
    <div
      ref={rootRef}
      onClick={onClose}
      className={cn(
        "animate-fadein fixed inset-0 flex justify-center overflow-auto p-6",
        zIndex,
        align === "start" ? "items-start" : "items-center"
      )}
      style={{ background: backdrop, backdropFilter: `blur(${blur})` }}
    >
      <div
        // Клик по содержимому не должен закрывать окно — всплытие останавливается
        // здесь, а не проверкой `e.target === e.currentTarget` снаружи.
        onClick={(e) => e.stopPropagation()}
        className={cn("animate-sheetin", className)}
      >
        {children}
      </div>
    </div>
  );
}
