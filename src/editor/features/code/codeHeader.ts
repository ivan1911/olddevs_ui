import { codeLanguage, normalizeCodeLanguage } from "./codeLanguages.js";

/*
  ШАПКА БЛОКА КОДА — одна полоса над кодом, общая у Редактора и у
  `RichTextView`. Слева язык, справа «Копировать»; код начинается
  сразу под полосой, и кнопки его не перекрывают. Полоса — хром блока:
  `select-none`, в выделение и в копию она не попадает.

  ОДНА КАРТОЧКА ИЗ ДВУХ ЧАСТЕЙ: у шапки скруглены верхние углы и своя рамка,
  а `pre` под ней теряет верхнюю рамку и верхнее скругление (`prose.ts` рисует
  ему целую). Класс обёртки и правила `prose.ts` живут в одном варианте
  `[&_pre]`, поэтому Tailwind ставит `border-top-width` и верхние радиусы ПОСЛЕ
  `border-width` и `border-radius` — порядок решает свойство, а не очерёдность
  в строке. Низ шапки — линия из токена разделителя `--rte-hr`, она тише рамки.

  Строки литеральные и целиком: Tailwind читает исходники как текст.
*/

/** Обёртка блока: сам `pre` внутри теряет верх рамки. */
export const CODE_BLOCK_CLASS = "[&_pre]:rounded-t-none [&_pre]:border-t-0";

export const CODE_HEADER_CLASS =
  "flex h-7 items-center justify-between gap-2 rounded-t-(--rte-radius) border " +
  "border-(--rte-code-border) border-b-(--rte-hr) bg-(--rte-code-block-background) " +
  "px-1 font-sans text-xs text-(--rte-code-block-foreground) select-none " +
  // Кнопки шапки (язык, «Копировать») — хром внутри Документа: `ghost`-кнопка
  // кита красит текст и наведение токенами темы ПРИЛОЖЕНИЯ, а они от вложенного
  // `data-theme` не пересчитываются — на листе `surface="paper"` в тёмном
  // приложении светлая иконка легла бы на белую шапку. Роли `--rte-*` лист
  // переназначает (`EDITOR_PAPER_TOKENS_CLASS`), поэтому текст и наведение —
  // ими. `button` под классом специфичнее классов кнопки, и её
  // словарь тонов не трогается.
  "[&_button]:text-(--rte-secondary) " +
  "[&_button:is([data-hovered],:hover)]:bg-(--rte-control-hover)";

/** Гнездо кнопки справа: строчная коробка иначе поднимала бы иконку по базовой линии. */
export const CODE_SLOT_CLASS = "inline-flex items-center";

/**
 * Подпись языка слева; отступ тот же, что у кнопки языка в Редакторе, цвет —
 * той же ролью `--rte-secondary`, что у кнопок шапки.
 */
export const CODE_LABEL_CLASS = "px-1.5 leading-6 font-semibold text-(--rte-secondary)";

/**
 * Блок кода в форме Документа: `<pre><code …>…</code></pre>` — с классом языка
 * или без; внутри `code` и токены подсветки, и голый текст. Закрывающий `</pre>`
 * внутри кода не встречается: текст экранирован.
 */
const BLOCK = /<pre>(<code(?: class="language-([\w+#-]+)")?>[\s\S]*?)<\/pre>/g;

const escapeAttribute = (value: string) => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");

/**
 * Есть ли в Документе хоть один блок кода — тот, что получит шапку
 * `withCodeHeaders`. По нему `RichTextView` решает, рисовать ли остров
 * «Копировать»: текстовому Документу остров не нужен. Выражение то же, что у
 * шапки, — новое, а не общее: у глобального выражения `test` сдвигает
 * `lastIndex`.
 */
export function hasCodeBlocks(html: string): boolean {
  return new RegExp(BLOCK.source).test(html);
}

/**
 * Шапка у каждого блока кода сохранённого Документа — строка в строку, на
 * сервере, при показе.
 *
 * ЗАЧЕМ РАЗМЕТКОЙ, А НЕ КЛИЕНТОМ. Подпись языка и сама полоса приходят в HTML
 * страницы: без JS документ читается так же, а место под кнопку не
 * появляется после гидрации и не двигает текст. Клиентский островок
 * (`CodeCopyIsland`) только вставляет кнопку в пустое гнездо
 * `data-code-copy`; значение атрибута — идентификатор этого просмотра, чтобы
 * два просмотра на странице не делили гнёзда.
 *
 * Название языка — из данных `codeLanguages.ts` по ПРИВЕДЁННОМУ имени, а не
 * подставленная из строки Документа: чужой класс в разметку не попадает. Блок
 * без языка и с неизвестным остаётся без подписи — каталог сообщений серверному
 * компоненту недоступен, а «Plain text» без перевода у русскоязычного
 * потребителя вышло бы на английском.
 *
 * Строка сюда приходит уже очищенной (она так же идёт в `innerHTML`); хелпер
 * новых источников разметки не открывает: в неё попадают только константы
 * модуля, подпись из списка языков и идентификатор просмотра с экранированием.
 */
export function withCodeHeaders(html: string, hostId: string): string {
  return html.replace(BLOCK, (_block, inner: string, name: string | undefined) => {
    const label = name ? (codeLanguage(normalizeCodeLanguage(name))?.label ?? "") : "";
    return (
      `<div class="${CODE_BLOCK_CLASS}" data-code-block>` +
      `<div class="${CODE_HEADER_CLASS}" data-code-header>` +
      `<span class="${CODE_LABEL_CLASS}">${label}</span>` +
      `<span class="${CODE_SLOT_CLASS}" data-code-copy="${escapeAttribute(hostId)}"></span>` +
      `</div><pre>${inner}</pre></div>`
    );
  });
}
