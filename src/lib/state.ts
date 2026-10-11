import type { Size } from "./variants.js";

/**
 * Раскладка «состояния экрана»: пусто и отказ.
 *
 * Вынесено из `EmptyState` в момент появления `ErrorState`. Геометрия у них
 * одна и та же — вертикальная центровка, иконка, заголовок, пояснение, слот
 * действия, — а различаются они тоном и ролью в дереве доступности. Копипаст
 * этой таблицы разошёлся бы: у пакета уже есть такая история с полями поиска
 * во фронте, ради которой и заведён `SearchControl`.
 *
 * Строки литеральные и целиком — Tailwind сканирует исходники как текст.
 */
export type StateSize = Extract<Size, "sm" | "md">;

export const STATE_ROOT = "flex flex-col items-center justify-center text-center";
export const STATE_ICON = "flex";
export const STATE_TITLE = "font-semibold";
export const STATE_DESCRIPTION = "max-w-[360px]";

export const STATE_LAYOUT: Record<
  StateSize,
  { root: string; icon: string; title: string; description: string; action: string }
> = {
  sm: {
    root: "gap-1 px-3 py-4",
    icon: "mb-0.5",
    title: "text-[13px]",
    description: "text-xs",
    action: "mt-1.5",
  },
  md: {
    root: "gap-1.5 px-4 py-10",
    icon: "mb-1",
    title: "text-md",
    description: "text-[13px]",
    action: "mt-3",
  },
};
