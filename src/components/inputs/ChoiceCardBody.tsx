"use client";

import type { ReactNode } from "react";
import { Text } from "react-aria-components";
import { cn } from "../../lib/cn.js";
import { hasContent } from "../../lib/empty.js";
import { CHOICE_CARD_ICON } from "../../lib/choice-card.js";

/**
 * Content of a choice card, shared by `Radio` and `Checkbox`.
 *
 * It is not exported from the package: it is markup inside a label, not a consumer
 * component. The icon, the label and the description lie in a column, and the indicator
 * sits to the right of them. The selected state must not live in the border color alone.
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
  // `hasContent`, not `!= null`: an empty string or `{flag && …}` with a false flag would
  // produce an empty node, an extra gap in the card's column.
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
          // Inside the label, so that a click on the description selects the card. Hidden
          // from the name: it is read as a description via `aria-describedby` (see lib).
          <Text slot="description" aria-hidden="true" className="text-fg-3 text-[11px]">
            {description}
          </Text>
        )}
      </span>
      {indicator}
    </>
  );
}
