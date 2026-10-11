"use client";

import type { ReactNode } from "react";
import { Text } from "react-aria-components";
import { cn } from "../../lib/cn.js";
import { hasContent } from "../../lib/empty.js";
import { CHOICE_CARD_ICON } from "../../lib/choice-card.js";

/**
 * Содержимое карточки выбора — общее для `Radio` и `Checkbox`.
 *
 * Не экспортируется из пакета: это разметка внутри метки, а не компонент
 * потребителя. Иконка, подпись и описание лежат столбцом, индикатор —
 * справа от них: выбранность не должна жить одним цветом рамки.
 */
export function ChoiceCardBody({
  icon,
  label,
  labelClassName,
  description,
  indicator,
}: {
  icon?: ReactNode;
  label?: ReactNode;
  labelClassName: string;
  description?: ReactNode;
  indicator: ReactNode;
}) {
  // `hasContent`, а не `!= null`: пустая строка или `{flag && …}` при ложном
  // флаге дали бы пустой узел — лишний зазор в столбце карточки.
  return (
    <>
      {hasContent(icon) && (
        <span aria-hidden="true" className={CHOICE_CARD_ICON}>
          {icon}
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        {hasContent(label) && (
          <span className={cn("text-fg-0 font-medium", labelClassName)}>{label}</span>
        )}
        {hasContent(description) && (
          // Внутри метки, чтобы щелчок по описанию выбирал карточку, и скрыто от
          // имени: читается как описание через `aria-describedby` (см. lib).
          <Text slot="description" aria-hidden="true" className="text-fg-3 text-[11px]">
            {description}
          </Text>
        )}
      </span>
      {indicator}
    </>
  );
}
