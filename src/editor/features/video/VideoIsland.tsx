"use client";

import { lazy, Suspense } from "react";
import type { VideoIslandSlotsProps } from "./VideoIslandSlots.js";

/*
  Остров видео у `RichTextView` (ADR-0071, п. 3) — оболочка.

  ПОЧЕМУ ТЕЛО ГРУЗИТСЯ ОТДЕЛЬНО. Плеер, поиск блоков и портал нужны только
  Документу с видео, а `RichTextView` читают и без него: страница с текстом и кодом
  платит за остров лишь тем, что здесь стоит `lazy`, а сам `RichTextView`
  монтирует остров только когда видео есть в HTML (`hasVideoBlocks`). Пока чанк
  идёт, виден серверный HTML блока — ссылка, она же «до загрузки острова». Опция
  `autoload` приходит данными с сервера (`videoAutoloadOf(tools)`).
*/
const Slots = lazy(() => import("./VideoIslandSlots.js"));

export function VideoIsland(props: VideoIslandSlotsProps) {
  return (
    <Suspense fallback={null}>
      <Slots {...props} />
    </Suspense>
  );
}
