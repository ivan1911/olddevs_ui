"use client";

import type { CustomIslandProps } from "@olddevs/ui/editor";
import { useState } from "react";

/**
 * Остров своего Блока: клиентский компонент потребителя из модуля с
 * директивой. Серверная страница `/editor` получает от импорта лишь ссылку на
 * него и кладёт её в `tools` просмотра.
 */
export function FixtureBadge({ attributes, text }: CustomIslandProps) {
  const [on, setOn] = useState(false);
  return (
    <button type="button" aria-pressed={on} onClick={() => setOn(!on)}>
      {attributes.fixture_label ?? text}
    </button>
  );
}
