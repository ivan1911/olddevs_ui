/**
 * WCAG 2.x contrast for the custom color warning.
 *
 * WHY OUR OWN FORMULA WHEN THE PACKAGE HAS `scripts/contrast.mjs`. The script is the build gate over
 * the theme tokens, and it lives in Node and is not part of the package. Here the same calculation
 * is needed in the browser, over ONE custom color, so the two functions (parsing the hex notation
 * and the luminance ratio) have no dependencies. `react-aria` can do the same, but that is a color
 * subsystem of 61 kB gzip (ADR-0038), and pulling it into the Editor for two multiplications makes
 * no sense.
 *
 * Accepts only `#rgb` and `#rrggbb` (theme token values are always hex and opaque). Anything else
 * gives `NaN`: "cannot be measured", not "poor contrast", and then no warning is shown.
 *
 * The module is safe on the server: pure functions, no imports.
 */

/** WCAG 1.4.3 threshold for normal text. */
export const CONTRAST_TEXT = 4.5;

function channels(color: string): [number, number, number] | null {
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim());
  if (!hex) return null;
  const digits = hex[1]!.length === 3 ? [...hex[1]!].map((d) => d + d).join("") : hex[1]!;
  return [0, 2, 4].map((i) => parseInt(digits.slice(i, i + 2), 16)) as [number, number, number];
}

/** Relative luminance of an sRGB color per WCAG 2.x. */
function luminance([r, g, b]: [number, number, number]): number {
  const linear = (value: number) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

/** Contrast ratio of two colors, from 1 to 21; `NaN` if a color cannot be parsed. */
export function contrastRatio(first: string, second: string): number {
  const a = channels(first);
  const b = channels(second);
  if (!a || !b) return NaN;
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}

/**
 * The ratio as shown to a person: truncated, not rounded. Rounding 4.49 gives "4.5", and "4.5:1 is
 * below 4.5:1" would read as a bug.
 */
export function formatRatio(ratio: number): string {
  return (Math.floor(ratio * 10) / 10).toFixed(1);
}
