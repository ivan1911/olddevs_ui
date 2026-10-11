"use client";

// Что стоит под полем внутри рамки: Сообщение поля и Строка статуса
// (ADR-0058, раздел 7). Вынесено из `RichTextEditor.tsx`.

import type { ReactNode } from "react";
import type { FieldNotice } from "../core/fieldNotice.js";

/**
 * Сообщение поля. Живой регион смонтирован всегда, даже пока он пуст:
 * скринридер объявляет изменение региона, а не его появление. Поэтому он здесь
 * и у Редактора без картинок — сообщение может прийти от любого Инструмента.
 *
 * `status` — в регион без вида: ход загрузки глазу показывает плейсхолдер в
 * Документе, а внутри `contenteditable` живой регион читается не везде. `error`
 * — видимая строка `role="alert"`: она требует действия, и Документ при этом
 * не изменился — без строки это выглядело бы как «ничего не случилось».
 */
export function FieldNoticeView({
  notice,
  action,
}: {
  notice: FieldNotice | null;
  /** Действие у ошибки — «Повторить» упавшего загрузчика; вне `role="alert"`. */
  action?: ReactNode;
}) {
  return (
    <>
      <div role="status" className="sr-only">
        {notice?.tone === "status" ? notice.text : ""}
      </div>
      {notice?.tone === "error" && (
        <div className="flex items-center gap-2 pb-1.5">
          <p role="alert" className="text-danger-strong text-xs">
            {notice.text}
          </p>
          {action}
        </div>
      )}
    </>
  );
}

/** Есть ли у экрана что показать: пустые значения React строки не рисуют. */
function hasContent(status: ReactNode): boolean {
  return status != null && status !== false && status !== true && status !== "";
}

/**
 * Строка статуса: своё содержимое экрана у начала, счётчик кита в конце.
 *
 * Контейнер без `role` и `aria-live`: число слов, обновляющееся на каждую
 * правку, не должно зачитываться, а «Сохранено» экран при желании оборачивает в
 * `role="status"` сам. Строка стоит внутри рамки поля и потому видна при
 * `readOnly` и `disabled`. `counterId` остаётся у счётчика — на него ссылается
 * `aria-describedby` поля; содержимое экрана в описание не входит.
 */
export function StatusLine({
  status,
  counter,
  counterId,
}: {
  status: ReactNode;
  counter: string | null;
  counterId: string;
}) {
  const own = hasContent(status);
  if (!own && counter == null) return null;
  return (
    // `text-fg-2`, а не `text-fg-3`: строка стоит внутри поля, на `bg-2`, и
    // третья ступень там не держит 4.5 — та же причина, что у счётчика
    // `TextControl`. Экран красит своё содержимое сам, если ему нужен другой тон.
    <div
      data-status-line
      className="text-fg-2 flex items-center gap-2 pb-1.5 text-[11px] tabular-nums"
    >
      {own && <div className="min-w-0 flex-1">{status}</div>}
      {counter != null && (
        <span id={counterId} className="ms-auto">
          {counter}
        </span>
      )}
    </div>
  );
}
