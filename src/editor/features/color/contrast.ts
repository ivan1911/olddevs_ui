/**
 * Контраст WCAG 2.x для предупреждения о произвольном цвете.
 *
 * ЗАЧЕМ СВОЯ ФОРМУЛА, КОГДА В ПАКЕТЕ ЕСТЬ `scripts/contrast.mjs`. Скрипт — гейт
 * сборки над токенами темы, он живёт в Node и в пакет не входит. Здесь тот же
 * расчёт нужен в браузере, над ОДНИМ цветом автора, поэтому две функции — разбор
 * шестнадцатеричной записи и отношение яркостей — без зависимостей. `react-aria`
 * умеет то же, но это цветовая подсистема на 61 кБ gzip (ADR-0038), и тащить её
 * в Редактор ради двух умножений незачем.
 *
 * Принимает только `#rgb` и `#rrggbb` (значения токенов темы — всегда
 * шестнадцатеричные и непрозрачные). Остальное — `NaN`: «измерить нельзя»,
 * а не «контраст плохой», и предупреждение тогда не показывается.
 *
 * Модуль серверно-безопасен: чистые функции, без импортов.
 */

/** Порог WCAG 1.4.3 для обычного текста. */
export const CONTRAST_TEXT = 4.5;

function channels(color: string): [number, number, number] | null {
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim());
  if (!hex) return null;
  const digits = hex[1]!.length === 3 ? [...hex[1]!].map((d) => d + d).join("") : hex[1]!;
  return [0, 2, 4].map((i) => parseInt(digits.slice(i, i + 2), 16)) as [number, number, number];
}

/** Относительная яркость sRGB по WCAG 2.x. */
function luminance([r, g, b]: [number, number, number]): number {
  const linear = (value: number) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

/** Отношение контраста двух цветов, от 1 до 21; `NaN`, если цвет не разобран. */
export function contrastRatio(first: string, second: string): number {
  const a = channels(first);
  const b = channels(second);
  if (!a || !b) return NaN;
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}

/**
 * Отношение для показа человеку: усечено, а не округлено. «4.5:1 — ниже 4.5:1»
 * читалось бы как ошибка, а 4.49 при округлении именно так и выглядит.
 */
export function formatRatio(ratio: number): string {
  return (Math.floor(ratio * 10) / 10).toFixed(1);
}
