"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { CheckIcon, CopyIcon } from "../../icons.js";
import { useMessages } from "../../i18n/useMessages.js";
import { cn } from "../../lib/cn.js";
import { hasContent } from "../../lib/empty.js";
import { Button, type ButtonProps } from "./Button.js";
import { BUTTON_ICON_SIZE } from "../../lib/button.js";

export interface CopyButtonProps extends Omit<
  ButtonProps,
  // `onCopy` вытесняется намеренно: у `<button>` он свой, буферный, и наш
  // одноимённый проп конфликтовал бы с ним по типу.
  "children" | "icon" | "onClick" | "value" | "onCopy"
> {
  /** Что скопировать. */
  value: string;
  /** Подпись рядом с иконкой. Без неё кнопка иконочная. */
  children?: ReactNode;
  /** Сколько держать состояние «скопировано», мс. */
  resetDelay?: number;
  /** Сообщить наружу, чем кончилось. Логи и метрики — забота потребителя. */
  onCopy?: (ok: boolean) => void;
}

/**
 * Кнопка «скопировать»: значение в буфер и внятный ответ пользователю.
 *
 * РЕЗУЛЬТАТ ОБЪЯВЛЯЕТСЯ, а не только меняет иконку. Галочка вместо иконки —
 * сигнал для глаз; пользователь скринридера, нажав кнопку, иначе не узнает,
 * сработала она или нет. Поэтому рядом стоит живая область, смонтированная
 * ВСЕГДА: вставленная вместе с текстом, она объявляется ненадёжно — часть
 * скринридеров успевает её пропустить. Тот же приём, что в `FileDropzone`.
 *
 * ОТКАЗ БУФЕРА — ЗАКОННЫЙ ИСХОД, а не исключение. `navigator.clipboard`
 * отсутствует в небезопасном контексте (страница по `http`), а запись может
 * быть запрещена разрешениями. Кнопка при этом не падает и не притворяется
 * успешной: она говорит, что скопировать не вышло, и значение остаётся
 * доступным для выделения руками.
 *
 * Таймер сбрасывается при размонтировании: иначе `setState` прилетал бы в
 * снятый компонент после закрытия попапа, в котором кнопка стояла.
 */
export function CopyButton({
  value,
  children,
  resetDelay = 2000,
  onCopy,
  className,
  ...rest
}: CopyButtonProps) {
  const messages = useMessages();
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current != null) clearTimeout(timer.current);
    },
    []
  );

  const copy = useCallback(async () => {
    let ok = false;
    try {
      // `navigator.clipboard` может отсутствовать целиком — в небезопасном
      // контексте его нет, и обращение к `writeText` упало бы на `undefined`.
      await navigator.clipboard.writeText(value);
      ok = true;
    } catch {
      ok = false;
    }

    setState(ok ? "copied" : "failed");
    onCopy?.(ok);

    if (timer.current != null) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), resetDelay);
  }, [value, onCopy, resetDelay]);

  const label =
    state === "copied"
      ? messages.copyButton.copied
      : state === "failed"
        ? messages.copyButton.failed
        : messages.copyButton.copy;

  const iconSize = BUTTON_ICON_SIZE[rest.size ?? "md"];

  return (
    <span className={cn("inline-flex items-center", className)}>
      <Button
        {...rest}
        // Имя кнопки МЕНЯЕТСЯ вместе с состоянием: «Скопировано» на кнопке,
        // которая ничего не скопировала, — ложь, и наоборот.
        aria-label={hasContent(children) ? undefined : label}
        icon={state === "copied" ? <CheckIcon size={iconSize} /> : <CopyIcon size={iconSize} />}
        iconOnly={!hasContent(children)}
        tone={state === "failed" ? "danger" : rest.tone}
        onClick={() => void copy()}
      >
        {children}
      </Button>

      {/* Область смонтирована всегда, подменяется только текст. */}
      <span role="status" aria-live="polite" className="sr-only">
        {state === "idle" ? "" : label}
      </span>
    </span>
  );
}
