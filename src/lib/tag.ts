/**
 * Вид метки: одна капсула для `TagGroup` и для меток внутри `TagInput`.
 *
 * Вынесено в тот момент, когда метка появилась во втором месте. Пользователь
 * должен узнавать «метку» как одно понятие, а две рукописные копии этих строк
 * разошлись бы при первой же правке отступа — и разошлись бы молча.
 *
 * Строки без `` `${...}` ``: Tailwind сканирует исходники текстом, и каждый
 * класс обязан стоять в файле целиком (`tests/class-coverage.test.ts`).
 */

/**
 * Капсула метки.
 *
 * Правый отступ зависит от кнопки удаления: `data-allows-removing` ставит
 * react-aria на метку, у которой кнопка есть. Без кнопки симметричный отступ
 * `pr-2.5`; с кнопкой `pr-1` — иначе крестик отстоял бы от края вдвое дальше,
 * чем подпись от левого.
 *
 * Кольцо фокуса акцентное и со смещением: метка стоит в потоке плотно, и кольцо
 * вплотную съело бы соседние.
 */
export const TAG_CLASS =
  "bg-bg-3 text-fg-1 flex items-center gap-1 rounded-full px-2.5 py-0.5 text-sm outline-none " +
  "data-[allows-removing]:pr-1 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--accent-strong)]";

/** Кнопка удаления внутри метки. */
export const TAG_REMOVE_CLASS =
  "text-fg-3 hover:text-fg-0 flex cursor-pointer items-center rounded-full p-0.5 outline-none " +
  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[color:var(--accent-strong)]";
