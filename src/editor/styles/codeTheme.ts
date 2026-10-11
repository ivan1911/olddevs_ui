// Происхождение цветов: highlight.js, `styles/github.css` и `styles/github-dark.css`
// (BSD-3-Clause, © 2006 Ivan Sagalaev, https://github.com/highlightjs/highlight.js).
// Значения цветов перенесены в `styles.css`, соответствие классов `hljs-*` ролям —
// сюда, Tailwind-классами. Лицензия — NOTICE в корне пакета.

/**
 * Тема подсветки блока кода (ADR-0051): GitHub Light в теме `light`,
 * GitHub Dark в `dark` и `dim`. Это ВТОРАЯ СИСТЕМА ЦВЕТА кита, и живёт она
 * только в блоке кода: токены кита ничего не знают о `hljs-*`, а тема
 * подсветки — о токенах. Решение владельца — привычные цвета подсветки вместо
 * сопоставления с токенами (ADR-0051, п. 5).
 *
 * ДВЕ ПОЛОВИНЫ, И КАЖДАЯ НА СВОЁМ МЕСТЕ.
 *
 * - ЦВЕТА — переменные `--rte-hl-*` и `--rte-code-block-*` в `styles.css`, на
 *   элементах с `data-theme` (и на `:root` без него). Блок кода наследует их
 *   от БЛИЖАЙШЕГО предка с темой, поэтому Документ во вложенной светлой
 *   «бумаге» (`data-theme="light"` внутри тёмного приложения) получает GitHub
 *   Light. Значения здесь не задаются намеренно: класс на контейнере
 *   перебил бы унаследованное, и вложенная тема перестала бы работать.
 * - ПРАВИЛА — эта строка классов, часть `PROSE_CLASS` на контейнере Документа
 *   (Редактор и `RichTextView`), и та же строка — на корне токенов
 *   `highlightCodeNodes` для `CodeView` (ADR-0052): роль токена →
 *   переменная, и ничего про тему.
 *   Tailwind потребителя находит классы в `dist` по той же строке `@source`,
 *   что и остальные классы кита; ни CSS-модулей, ни отдельного файла стилей.
 *   Только классы: в разметке ни одного `style`.
 *
 * ПОДЛОЖКА — ТЕМЫ, А НЕ КИТА. Цвета GitHub подобраны к своему фону (`#ffffff`
 * и `#0d1117`); на подложке кода кита (`--bg-3`) тёмные тона не держат 4.5:1
 * (ключевое слово — 3.95, комментарий — 3.24). Поэтому блок кода целиком
 * берёт фон и основной цвет темы подсветки, а строчный `code` остаётся на
 * токенах кита. Одно отступление от GitHub Light — `built_in` и `symbol`
 * (`#953800` вместо `#e36209`, см. `styles.css`). `section`, `addition` и
 * `deletion` не перенесены: их дают грамматики Markdown и diff, которых у
 * Редактора нет (а `section` тёмной темы контраст не держит).
 *
 * ПОЧЕМУ `[class*=hljs-built]`, А НЕ `.hljs-built_in`. В произвольном варианте
 * Tailwind `_` — это пробел, а `\_` попадает в имя класса с обратной косой и
 * не совпадает с классом в разметке. Подстрока однозначна: других областей на
 * `built` у highlight.js нет. По той же причине `this` и `self`
 * (`hljs-variable language_`) ловятся как `.hljs-variable[class*=language]`.
 *
 * СОСТАВНЫЕ СЕЛЕКТОРЫ И ДЕКОРАЦИИ. В `RichTextView` токены вложены, как их
 * отдал lowlight (`.hljs-meta > .hljs-string`), а декорации Редактора
 * сплющивают вложенность в один `span class="hljs-meta hljs-string"`. Поэтому
 * строка и ключевое слово названы ещё и парой классов (`.hljs-meta.hljs-string`)
 * — это поднимает специфичность их группы над `.hljs-meta`, и одинаковый код
 * красится одинаково в правке и на странице.
 *
 * Модуль серверно-безопасен: строка классов, без React и без движка.
 */
export const CODE_THEME_CLASS =
  // Класс целиком в одной строке: Tailwind читает исходник как текст, и класс,
  // разорванный `+`, он бы не нашёл.
  "[&_:is(.hljs-doctag,.hljs-keyword,.hljs-template-tag,.hljs-template-variable,.hljs-type,.hljs-variable[class*=language],.hljs-meta.hljs-keyword)]:text-(--rte-hl-keyword) " +
  "[&_.hljs-title]:text-(--rte-hl-title) " +
  // Markdown: заголовок — цветом заголовка и жирным, как в теме GitHub; ссылка — подчёркнутой.
  "[&_.hljs-section]:text-(--rte-hl-title) [&_.hljs-section]:font-bold [&_.hljs-link]:underline " +
  "[&_:is(.hljs-attr,.hljs-attribute,.hljs-literal,.hljs-meta,.hljs-number,.hljs-operator,.hljs-variable,.hljs-selector-attr,.hljs-selector-class,.hljs-selector-id)]:text-(--rte-hl-constant) " +
  "[&_:is(.hljs-regexp,.hljs-string,.hljs-meta.hljs-string)]:text-(--rte-hl-string) " +
  "[&_:is([class*=hljs-built],.hljs-symbol)]:text-(--rte-hl-variable) " +
  "[&_:is(.hljs-comment,.hljs-code,.hljs-formula)]:text-(--rte-hl-comment) " +
  "[&_:is(.hljs-name,.hljs-quote,.hljs-selector-tag,.hljs-selector-pseudo)]:text-(--rte-hl-tag) " +
  "[&_.hljs-subst]:text-(--rte-code-block-foreground) [&_.hljs-bullet]:text-(--rte-hl-bullet) " +
  "[&_.hljs-emphasis]:italic [&_.hljs-strong]:font-bold ";
