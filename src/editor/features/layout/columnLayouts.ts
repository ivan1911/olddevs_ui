import type { EditorLayoutVariant } from "../../../i18n/messages.js";

/**
 * Варианты Блока «Раскладка» — ДАННЫМИ: их читают Схема-данные и
 * очистка на сервере (`schema.ts`), Редактор и стили Документа (`prose.ts`).
 *
 * ИМЯ ВАРИАНТА — ШИРИНЫ КОЛОНОК В ПРОЦЕНТАХ ЧЕРЕЗ ДЕФИС: `50-50`, `60-40`,
 * `25-25-25-25`. Одна запись на все шесть вариантов, и из имени без словаря
 * читаются и число колонок, и их доли — в базе потребителя, в санитайзере и в
 * HTML от чужого редактора, где ширины приходят тем же `flex-basis: 50%`.
 * Порядок — порядок меню (образец владельца): одна, две, три, четыре колонки,
 * 60/40, 40/60.
 *
 * Модуль серверно-безопасен: данные и чистые функции, без движка.
 */
export const EDITOR_LAYOUTS = [
  "100",
  "50-50",
  "33-33-33",
  "25-25-25-25",
  "60-40",
  "40-60",
] as const satisfies readonly EditorLayoutVariant[];

export type EditorLayout = (typeof EDITOR_LAYOUTS)[number];

/** Вариант по умолчанию — пункт «Раскладка» Меню вставки: две равные колонки. */
export const DEFAULT_LAYOUT: EditorLayout = "50-50";

/** Предел колонок: больше четырёх в Схеме нет. */
export const MAX_LAYOUT_COLUMNS = 4;

const known: ReadonlySet<string> = new Set(EDITOR_LAYOUTS);

/** Имя варианта из Схемы или `null`. */
export function layoutFrom(value: unknown): EditorLayout | null {
  return typeof value === "string" && known.has(value) ? (value as EditorLayout) : null;
}

/** Доли колонок варианта в процентах. */
export function layoutWidths(layout: EditorLayout): number[] {
  return layout.split("-").map(Number);
}

/** Число колонок варианта. */
export function layoutColumnCount(layout: EditorLayout): number {
  return layoutWidths(layout).length;
}

/**
 * Ближайший вариант для `count` колонок (1–4) с долями `widths`.
 *
 * Чужой HTML несёт ширины числами (`flex-basis: 55%`), а у Схемы их шесть
 * пресетов; ширины перетаскиванием не меняются (решение владельца). Поэтому
 * берётся вариант с тем же числом колонок и наименьшей суммой отклонений долей,
 * а без годных долей — равные колонки. Доли нормируются к 100: `1fr 1fr` и
 * `30% 20%` — тоже 60/40.
 */
export function nearestLayout(count: number, widths: readonly number[] = []): EditorLayout {
  const columns = Math.min(Math.max(1, Math.floor(count) || 1), MAX_LAYOUT_COLUMNS);
  const candidates = EDITOR_LAYOUTS.filter((layout) => layoutColumnCount(layout) === columns);
  const total = widths.reduce((sum, width) => sum + width, 0);
  const usable =
    widths.length === columns && total > 0 && widths.every((width) => width > 0)
      ? widths.map((width) => (width / total) * 100)
      : null;
  if (!usable) return candidates[0]!;
  const distance = (layout: EditorLayout) =>
    layoutWidths(layout).reduce((sum, width, index) => sum + Math.abs(width - usable[index]!), 0);
  return candidates.reduce((best, layout) => (distance(layout) < distance(best) ? layout : best));
}
