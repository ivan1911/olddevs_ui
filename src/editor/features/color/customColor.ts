/**
 * Произвольный цвет Редактора ДАННЫМИ: единственная форма, в которой он
 * существует в документе, и разбор, который её сторожит.
 *
 * ЗАЧЕМ `style`, КОГДА ВЕЗДЕ ИМЕНА. Палитры (`palette.ts`) — имена, и
 * значение подставляет тема. Произвольный цвет — это значение автора, и имени у
 * него нет; единственный носитель значения в HTML, который понимают и браузер,
 * и письмо, и экспорт, — `style`. Исключение из правила «`style` в документе
 * нет» УЗКОЕ и утверждено владельцем: одно объявление, один
 * шестнадцатеричный цвет, два тега.
 *
 *   - `<span style="color:#rrggbb">` — цвет текста;
 *   - `<mark style="background-color:#rrggbb">` — маркер.
 *
 * Строчные буквы, ровно шесть цифр, ничего больше в `style` и никогда вместе с
 * `data-color` на одном элементе: цвет у метки один, палитры или произвольный.
 *
 * ЧТО ПРИНИМАЕТСЯ ИЗ ЧУЖОГО HTML (загрузка и вставка). Только это объявление —
 * без учёта регистра и пробелов, с необязательной точкой с запятой; регистр
 * приводится к нижнему. Всё остальное — `#abc`, `rgb()`, `red`, `var(--x)`,
 * `!important`, второе объявление рядом — отбрасывается вместе с обёрткой,
 * текст остаётся. Перевод `rgb(255, 0, 0)` в `#ff0000` (так пишут Word и
 * Google Docs) технически прост, но расширил бы поверхность разбора форматами,
 * которые санитайзер на сервере потребителя обязан был бы знать тоже, а
 * угадывание за автора кит отверг уже для палитры (`styleExtensions.ts`).
 * Строгая форма — это ещё и то, что очистка `sanitizeRichText` проверяет одним
 * регулярным выражением (`RICH_TEXT_SCHEMA.customColor`).
 *
 * Модуль серверно-безопасен: данные и чистые функции, без импортов.
 */

/** Свойство CSS, которое несёт цвет, по тегу метки. */
export const CUSTOM_COLOR_PROPERTY = {
  span: "color",
  mark: "background-color",
} as const;

/** Вид произвольного цвета: текст или маркер. */
export type CustomColorKind = "text" | "highlight";

/** Свойство CSS по виду цвета. */
export const CUSTOM_COLOR_PROPERTY_BY_KIND: Record<CustomColorKind, string> = {
  text: CUSTOM_COLOR_PROPERTY.span,
  highlight: CUSTOM_COLOR_PROPERTY.mark,
};

/** Шестнадцатеричный цвет в каноничной записи: `#rrggbb`, строчные. */
export const CUSTOM_COLOR_PATTERN = /^#[0-9a-f]{6}$/;

/**
 * `#RRGGBB` → `#rrggbb`; всё остальное — `null`. Входит и в команды, и в разбор,
 * так что значение с другим регистром не создаёт двух записей одного цвета.
 */
export function normalizeCustomColor(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const lower = value.toLowerCase();
  return CUSTOM_COLOR_PATTERN.test(lower) ? lower : null;
}

/**
 * Цвет из значения `style` — только если это ОДНО объявление нужного свойства
 * с `#rrggbb`. Пробелы вокруг и хвостовая `;` терпятся: так браузер сам пишет
 * `style` после правки через DOM.
 */
export function customColorFromStyle(
  style: string | null,
  property: (typeof CUSTOM_COLOR_PROPERTY)[keyof typeof CUSTOM_COLOR_PROPERTY]
): string | null {
  if (style === null) return null;
  const match = /^\s*([a-z-]+)\s*:\s*(#[0-9a-f]{6})\s*;?\s*$/i.exec(style);
  return match && match[1]!.toLowerCase() === property ? normalizeCustomColor(match[2]) : null;
}

/** Значение `style`, как его пишет Редактор: `color:#ff0000`, без пробелов и `;`. */
export function customColorStyle(
  property: (typeof CUSTOM_COLOR_PROPERTY)[keyof typeof CUSTOM_COLOR_PROPERTY],
  color: string
): string {
  return `${property}:${color}`;
}

/**
 * Допустимое значение `style` по тегу — регулярным выражением СТРОКОЙ, как его
 * публикует Схема (`RICH_TEXT_SCHEMA.customColor.styles`): строка не зависит от
 * движка регулярных выражений санитайзера и переносится в конфиг как есть.
 * Значение без пробелов и без `;` — именно так его пишет Редактор.
 */
export const CUSTOM_COLOR_STYLE_PATTERN = {
  span: `^${CUSTOM_COLOR_PROPERTY.span}:#[0-9a-f]{6}$`,
  mark: `^${CUSTOM_COLOR_PROPERTY.mark}:#[0-9a-f]{6}$`,
} as const;
