"use client";

/** A CSS color read from clipboard HTML. `alpha` is 0..1; the channels are 0..255. */
export interface CssColor {
  red: number;
  green: number;
  blue: number;
  alpha: number;
}

/*
  The names Office writes. Word names its sixteen highlight colors (`mso-highlight:lime`, and
  `background:lightgrey` where Safari rewrites it), and Excel and Docs write hex. The list is short on
  purpose: it is the Word highlight colors, their CSS spellings, and a few common names, not all
  of CSS. An unknown name is not a color: the background is then simply not turned into a marker.
*/
const NAMED: Readonly<Record<string, string>> = {
  black: "000000",
  white: "ffffff",
  silver: "c0c0c0",
  gray: "808080",
  grey: "808080",
  lightgray: "d3d3d3",
  lightgrey: "d3d3d3",
  darkgray: "a9a9a9",
  darkgrey: "a9a9a9",
  maroon: "800000",
  darkred: "8b0000",
  red: "ff0000",
  purple: "800080",
  fuchsia: "ff00ff",
  magenta: "ff00ff",
  violet: "ee82ee",
  pink: "ffc0cb",
  brown: "a52a2a",
  orange: "ffa500",
  gold: "ffd700",
  yellow: "ffff00",
  // Word's own name for its olive highlight.
  darkyellow: "808000",
  olive: "808000",
  lime: "00ff00",
  green: "008000",
  darkgreen: "006400",
  teal: "008080",
  darkcyan: "008b8b",
  aqua: "00ffff",
  cyan: "00ffff",
  blue: "0000ff",
  darkblue: "00008b",
  navy: "000080",
};

const HEX = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const FUNCTION =
  /^rgba?\(\s*([\d.]+%?)\s*[,\s]\s*([\d.]+%?)\s*[,\s]\s*([\d.]+%?)\s*(?:[,/]\s*([\d.]+%?)\s*)?\)$/i;

function channel(text: string): number {
  const value = text.endsWith("%") ? (parseFloat(text) / 100) * 255 : parseFloat(text);
  return Math.min(255, Math.max(0, Math.round(value)));
}

/** One color token: `#d9e2f3`, `rgb(217, 226, 243)`, `lime`, `transparent`. Anything else is `null`. */
export function parseCssColor(token: string): CssColor | null {
  const text = token.trim().toLowerCase();
  if (text === "transparent") return { red: 0, green: 0, blue: 0, alpha: 0 };
  const named = NAMED[text];
  const hex = named ? `#${named}` : text;
  if (HEX.test(hex)) {
    let digits = hex.slice(1);
    if (digits.length <= 4) digits = digits.replace(/./g, (digit) => digit + digit);
    const value = (index: number) => parseInt(digits.slice(index, index + 2), 16);
    return {
      red: value(0),
      green: value(2),
      blue: value(4),
      alpha: digits.length === 8 ? value(6) / 255 : 1,
    };
  }
  const match = FUNCTION.exec(text);
  if (!match) return null;
  const alpha =
    match[4] === undefined ? 1 : parseFloat(match[4]) / (match[4].endsWith("%") ? 100 : 1);
  return {
    red: channel(match[1]!),
    green: channel(match[2]!),
    blue: channel(match[3]!),
    alpha: Math.min(1, Math.max(0, alpha)),
  };
}

/**
 * The color in the value of `background` or `background-color`. The shorthand may carry an image, a
 * repeat and a position next to the color (`url(a.png) no-repeat #fff`), so the value is cut into
 * tokens outside the brackets and the first one that is a color wins. A gradient has none.
 */
export function colorInBackground(value: string): CssColor | null {
  const tokens: string[] = [];
  let depth = 0;
  let current = "";
  for (const char of value) {
    if (char === "(") depth++;
    else if (char === ")") depth = Math.max(0, depth - 1);
    if (/\s/.test(char) && depth === 0) {
      if (current) tokens.push(current);
      current = "";
    } else current += char;
  }
  if (current) tokens.push(current);
  for (const token of tokens) {
    const color = parseCssColor(token);
    if (color) return color;
  }
  return null;
}
