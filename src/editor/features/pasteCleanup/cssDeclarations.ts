"use client";

/*
  A small reader of CSS declarations for the paste cleanup steps. They need a handful of properties
  (`font-weight`, `text-align`, `background`) out of an inline `style` or an Excel class rule, and the
  clipboard HTML comes from a parse in jsdom or in the browser. `element.style` would give a different
  notation in each (`#D9E2F3` or `rgb(217, 226, 243)`, `bold` or `700`), and in jsdom it drops the
  `mso-*` properties. So the string is split by hand.
*/

export interface CssDeclaration {
  /** Lower case, without the surrounding space. */
  property: string;
  /** As written, without `!important`. */
  value: string;
}

/** Split `a:b; c:rgb(1, 2, 3);` into declarations. A `;` inside brackets or quotes is not a separator. */
export function parseDeclarations(text: string): CssDeclaration[] {
  const declarations: CssDeclaration[] = [];
  let depth = 0;
  let quote = "";
  let start = 0;
  const flush = (end: number) => {
    const part = text.slice(start, end);
    const colon = part.indexOf(":");
    if (colon > 0) {
      const property = part.slice(0, colon).trim().toLowerCase();
      const value = part
        .slice(colon + 1)
        .replace(/!\s*important\s*$/i, "")
        .trim();
      if (property && value) declarations.push({ property, value });
    }
    start = end + 1;
  };
  for (let i = 0; i < text.length; i++) {
    const char = text[i]!;
    if (quote) {
      if (char === quote) quote = "";
    } else if (char === '"' || char === "'") quote = char;
    else if (char === "(") depth++;
    else if (char === ")") depth = Math.max(0, depth - 1);
    else if (char === ";" && depth === 0) flush(i);
  }
  flush(text.length);
  return declarations;
}

/** The value of the last declaration of one of the properties, or `null`. The last one wins, as in CSS. */
export function lastValue(
  declarations: readonly CssDeclaration[],
  ...properties: string[]
): string | null {
  for (let i = declarations.length - 1; i >= 0; i--) {
    if (properties.includes(declarations[i]!.property)) return declarations[i]!.value;
  }
  return null;
}

/**
 * Change an element's `style`: drop the declarations of the given properties and add the new ones at
 * the end. The rest of the style is written back as it was; an empty `style` is removed.
 */
export function rewriteStyle(
  element: Element,
  drop: readonly string[],
  add: readonly CssDeclaration[] = []
): void {
  const kept = parseDeclarations(element.getAttribute("style") ?? "").filter(
    (declaration) => !drop.includes(declaration.property)
  );
  const text = [...kept, ...add]
    .map((declaration) => `${declaration.property}:${declaration.value}`)
    .join(";");
  if (text) element.setAttribute("style", text);
  else element.removeAttribute("style");
}
