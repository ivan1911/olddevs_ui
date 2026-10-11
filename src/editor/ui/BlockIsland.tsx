"use client";

import { lazy, Suspense } from "react";
import type { BlockIslandSlotsProps } from "./BlockIslandSlots.js";

/*
  Остров своих Блоков у `RichTextView` (ADR-0058, п. 3.3) — оболочка.

  ПОЧЕМУ ТЕЛО ГРУЗИТСЯ ОТДЕЛЬНО. Поиск Блоков, замена содержимого и портал нужны
  только Документу со своим Блоком, а `RichTextView` читают и без них. Отдельный
  чанк не входит в первую загрузку просмотра: страница с текстом и кодом платит
  за остров лишь тем, что здесь стоит `lazy`. Пока чанк идёт, виден серверный HTML
  Блока — это и есть «до загрузки Острова» из ADR.
*/
const Slots = lazy(() => import("./BlockIslandSlots.js"));

export function BlockIsland(props: BlockIslandSlotsProps) {
  return (
    <Suspense fallback={null}>
      <Slots {...props} />
    </Suspense>
  );
}
