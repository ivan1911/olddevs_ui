/**
 * Стекло всплывающих поверхностей Редактора: полупрозрачная
 * подложка своей поверхности с размытием того, что под ней.
 *
 * ЗНАЧЕНИЯ — КАК У ТОСТОВ (ADR-0010): 82 % цвета в `color-mix` и размытие в
 * 14px. Это уже принятое стекло кита; второе со своими числами разошлось бы с
 * ним при первой правке. Подсказка не в счёт: у неё свои 85 % и 10px, и
 * Редактор её не трогает.
 *
 * ЦВЕТ — ТОКЕН СВОЕЙ ПОВЕРХНОСТИ, а не новый. Панель лежит на `bg-1`, списки
 * меню — на `surface-elevated`, меню выделения — на инверсной; тема меняет
 * токен, и стекло меняется вместе с ним без отдельных значений на тему. Внутри
 * меню выделения переназначен только мост `--color-*` (`SelectionBubble.tsx`),
 * а сырые `--bg-1` и `--surface-inverse` — нет, поэтому здесь читаются они.
 *
 * ПОЧЕМУ ТОЛЬКО РЕДАКТОР. Поверхности попадают сюда классом: `Menu` и
 * `PopoverContent` принимают `className`, а `tailwind-merge` в `cn` снимает
 * сплошную подложку панели. Те же компоненты вне Редактора остаются
 * сплошными, и публичный API не меняется.
 *
 * СПЛОШНОЙ ФОЛБЭК. `prefers-reduced-transparency` (просьба системы убрать
 * прозрачность) и `prefers-contrast: more` возвращают сплошной токен и
 * снимают размытие: под полупрозрачной подложкой контраст текста зависит от
 * того, что лежит под меню, и проверить его `scripts/contrast.mjs` не может.
 *
 * НА iOS — ТОЖЕ СПЛОШНАЯ. В Safari на iOS 27 меню Редактора вышли
 * без подложки вовсе: пункты легли на текст Документа в полную силу. Подложку
 * стеклянного элемента iOS-WebKit не нарисовал, а воспроизвести это вне
 * устройства не вышло — безголовый WebKit размытие не рисует вовсе, и разницы
 * не видно. Условие `@supports (-webkit-touch-callout: none)` понимает только
 * WebKit на iOS (Chrome там — тот же WebKit), десктоп его не видит и стекло
 * сохраняет.
 */

/*
  ИМЕНА КЛАССОВ — ЦЕЛИКОМ, БЕЗ СБОРКИ ИЗ КУСКОВ. Tailwind (и у нас, и у
  потребителя через `@source` на `dist`) находит класс только как целое слово
  в исходнике. Подложка, собранная шаблонной строкой из имени токена, в CSS не
  попадала: размытие было, а подложка оставалась прозрачной.
*/

/** Размытие и его снятие при просьбе убрать прозрачность или поднять контраст. */
const BLUR =
  "backdrop-blur-[14px] [@media(prefers-reduced-transparency:reduce)]:backdrop-blur-none " +
  "contrast-more:backdrop-blur-none [@supports(-webkit-touch-callout:none)]:backdrop-blur-none";

/** Плавающая Панель, панель картинки, поповеры Редактора — поверхность `bg-1`. */
export const GLASS_PANEL_CLASS =
  "bg-[color-mix(in_srgb,var(--bg-1)_82%,transparent)] " +
  "[@media(prefers-reduced-transparency:reduce)]:bg-bg-1 contrast-more:bg-bg-1 " +
  "[@supports(-webkit-touch-callout:none)]:bg-bg-1 " +
  BLUR;

/** Списки меню Редактора — поверхность `surface-elevated`, как у `Menu`. */
export const GLASS_MENU_CLASS =
  "bg-[color-mix(in_srgb,var(--surface-elevated)_82%,transparent)] " +
  "[@media(prefers-reduced-transparency:reduce)]:bg-surface-elevated " +
  "contrast-more:bg-surface-elevated [@supports(-webkit-touch-callout:none)]:bg-surface-elevated " +
  BLUR;

/** Меню выделения — инверсная поверхность. */
export const GLASS_INVERSE_CLASS =
  "bg-[color-mix(in_srgb,var(--surface-inverse)_82%,transparent)] " +
  "[@media(prefers-reduced-transparency:reduce)]:bg-surface-inverse " +
  "contrast-more:bg-surface-inverse [@supports(-webkit-touch-callout:none)]:bg-surface-inverse " +
  BLUR;
