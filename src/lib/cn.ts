import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * Слияние с разрешением конфликтов, знающее про шкалу кита.
 *
 * Штатный `twMerge` раскладывает `text-*` по группам, глядя на суффикс:
 * t-shirt-размер (`sm`, `md`, `2xl`) или произвольная длина — это размер
 * шрифта, всё остальное — цвет. Ступень `caption` под это правило не подходит,
 * и `text-caption` попадал в группу ЦВЕТА, конфликтуя с `text-fg-2`:
 *
 *     twMerge("text-caption", "text-fg-2") === "text-fg-2"   // размер съеден
 *     twMerge("text-fg-2", "text-caption") === "text-caption" // цвет съеден
 *
 * Молча, без ошибки сборки, и результат зависел от порядка аргументов. Так
 * `Text size="caption"` рисовался унаследованным кеглем, а `Kbd` терял цвет.
 *
 * Остальные шесть ступеней (`xs`, `sm`, `md`, `lg`, `xl`, `2xl`) — законные
 * t-shirt-размеры, и их `twMerge` разбирает сам.
 *
 * `rounded-control` — вторая такая ступень и ровно тот же случай. Радиус
 * контролов назван по роли, а не по размеру (см. `--r-control` в styles.css),
 * поэтому под t-shirt-правило не подходит: без регистрации ниже `twMerge` не
 * узнаёт в нём радиус вовсе и перестаёт разрешать конфликт —
 * `cn("rounded-control", "rounded-full")` вернул бы ОБА класса, и выиграл бы
 * тот, что ниже в CSS, а не тот, что передан последним.
 */
const merge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: ["caption"] }],
      rounded: [{ rounded: ["control"] }],
    },
  },
});

/**
 * Слияние Tailwind-классов с разрешением конфликтов: последний выигрывает.
 * Перенесено из `src/lib/utils.js` фронта — там остаются прикладные утилиты
 * (formatFileSize, maskTime, normalizeTime, pluralize), они пакету не нужны.
 *
 * Экспортируется наружу намеренно: у потребителя свой `cn` на голом `twMerge`,
 * и `cn("text-caption", "text-fg-2")` там сломается ровно так же. Пары
 * «ступень шкалы + цвет» собирайте этим.
 */
export function cn(...inputs: ClassValue[]): string {
  return merge(clsx(inputs));
}
