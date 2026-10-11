"use client";

import { useEffect, useRef, useState } from "react";
import { CopyButton, type CopyButtonProps } from "../../../components/actions/CopyButton.js";
import { Tooltip, TooltipProvider } from "../../../components/overlays/Tooltip.js";
import { useMessages } from "../../../i18n/useMessages.js";
import { cn } from "../../../lib/cn.js";

/** Сколько держать «Скопировано» — столько же, сколько `CopyButton` по умолчанию. */
const RESET_MS = 2000;

export interface CodeCopyButtonProps extends Omit<
  CopyButtonProps,
  "value" | "children" | "onCopy" | "size" | "variant" | "resetDelay"
> {
  /** Текст блока строкой — то, что уйдёт в буфер (ADR-0039: копируется текст, а не DOM). */
  code: string;
}

/**
 * Кнопка «Копировать» в шапке блока кода: `CopyButton` кита с подсказкой
 * «Copy code» → «Copied».
 *
 * ПОДСКАЗКА НЕ ЗАМЕНЯЕТ ИМЯ. Имя кнопки и объявление результата — дело
 * `CopyButton` («Copy» → «Copied», живая область); подсказка лишь для глаз и
 * уточняет, ЧТО копируется. Состояние для неё берётся из `onCopy`, а не из
 * внутренностей кнопки.
 *
 * СВОЙ `TooltipProvider`, как у Панели и у панели картинки: корневой кит
 * оставляет потребителю, а Редактор и просмотр без него падали бы на Radix.
 * Подсказка вешается на обёртку — `CopyButton` сам ref не принимает.
 */
export function CodeCopyButton({ code, ...rest }: CodeCopyButtonProps) {
  const messages = useMessages();
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current != null) clearTimeout(timer.current);
    },
    []
  );

  const content =
    state === "copied"
      ? messages.copyButton.copied
      : state === "failed"
        ? messages.copyButton.failed
        : messages.editor.codeCopy;

  return (
    <TooltipProvider>
      <Tooltip content={content}>
        <span className="inline-flex">
          <CopyButton
            {...rest}
            value={code}
            // Иконка — 12 px, как шеврон у кнопки языка напротив: шапка в
            // строку текста `text-xs`, и стандартная иконка кнопки в ней
            // выглядел крупнее подписи. Зону нажатия (24 px) держит `xs`.
            className={cn("[&_svg]:size-3", rest.className)}
            size="xs"
            variant="ghost"
            resetDelay={RESET_MS}
            onCopy={(ok) => {
              setState(ok ? "copied" : "failed");
              if (timer.current != null) clearTimeout(timer.current);
              timer.current = setTimeout(() => setState("idle"), RESET_MS);
            }}
          />
        </span>
      </Tooltip>
    </TooltipProvider>
  );
}
