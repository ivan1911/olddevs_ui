import { CODE_LANGUAGE_IDS } from "../features/code/codeLanguages.js";
import { EDITOR_LAYOUTS } from "../features/layout/columnLayouts.js";
import { CUSTOM_COLOR_STYLE_PATTERN } from "../features/color/customColor.js";
import { devWarn } from "../../lib/dev-warn.js";
import type { CustomAttribute, PrefixedName, ToolEntry } from "./customTool.js";
import { customToolOf } from "./toolDefinition.js";
import {
  EDITOR_ALIGNMENTS,
  EDITOR_MARKER_NAMES,
  EDITOR_TEXT_COLOR_NAMES,
  LEGACY_MARKER_NAMES,
} from "../styles/palette.js";
import { EDITOR_WRAPPER_TONES } from "../features/wrapper/wrapperTones.js";
import { isVideoProvider, isVideoSrc, VIDEO_BLOCK } from "../features/video/videoSrc.js";

/**
 * Схема Редактора ДАННЫМИ: белый список тегов и атрибутов, которые он
 * принимает и отдаёт.
 *
 * ЗАЧЕМ ОТДЕЛЬНЫМ СПИСКОМ, ЕСЛИ СХЕМУ И ТАК ЗАДАЮТ РАСШИРЕНИЯ. Расширения
 * Tiptap описывают схему кодом, и прочитать из них «что может прийти в HTML»
 * нельзя ни человеку, ни санитайзеру. А потребителю нужен ровно этот ответ:
 * санитизация на сервере — его ответственность (ADR-0050), и очистку
 * (`sanitizeRichText` ниже) кит строит отсюда, а не из исходника. Совпадение списка с
 * тем, что редактор реально отдаёт, сторожит
 * `tests/rich-text-editor-schema.test.tsx` — в обе стороны.
 *
 * Список растёт вместе с набором Блоков и Меток;
 * опубликован он на странице `RichTextView`, и таблица там сверяется с этим
 * файлом тестом (`tests/rich-text-view.test.tsx`). Атрибута `style` в нём нет,
 * кроме одного узкого исключения — произвольного цвета (`customColor` ниже):
 * цвет палитры и выравнивание пишутся в `data-*` (спека, «Схема и
 * безопасность»).
 *
 * Модуль серверно-безопасен: данные, без React и без движка. Его импорты —
 * `palette.ts`, `customColor.ts`, `codeLanguages.ts`, `columnLayouts.ts` и
 * `wrapperTones.ts`, тоже данные: имена палитры, языков, вариантов Раскладки и
 * тонов Обёртки живут там один раз; `videoSrc.ts` — имена видео и проверка
 * его адреса (чистые функции над строкой); ещё `lib/dev-warn.ts` — предупреждение
 * разработчику без зависимостей.
 */
export const RICH_TEXT_SCHEMA = {
  /**
   * Блоки. `h1` — только с инструментом `heading1`: экран, у
   * которого заголовок страницы стоит над Редактором, его выключает, и тогда
   * Редактор `h1` не отдаёт. Схема-данные перечисляют всё, что кит МОЖЕТ
   * отдать, а не то, что отдаёт при конкретном наборе `tools`.
   * `pre` — блок кода, внутри него `code`. `figure` — картинка: внутри неё
   * `img` и, если подпись не пуста, `figcaption`. Вне `figure` Редактор не
   * отдаёт ни `img`, ни `figcaption`.
   *
   * `label`, `input`, `span` и `div` — разметка пункта чек-листа, как её пишет
   * Tiptap: `<li data-type="taskItem"><label><input type="checkbox"><span>
   * </span></label><div>…</div></li>`. Вне пункта чек-листа Редактор их не
   * отдаёт, и `sanitizeRichText` держит их там же — хуком на предка.
   *
   * `div` с `data-block` — Раскладка: `div[data-block="layout"]`
   * с вариантом в `data-layout`, внутри от одной до четырёх
   * `div[data-block="column"]`, в колонке — Блоки, кроме другой Раскладки.
   * Раскладка — только Блок верхнего уровня: не в колонке, Обёртке, списке,
   * цитате и ячейке. Ширины колонок — вариантом, а не `style` (`layouts` ниже).
   *
   * `div[data-block="wrapper"]` — Обёртка, группа Блоков, как у
   * Redactor; тон, если есть, — в `data-tone` (`wrapperTones` ниже).
   * Стоит на верхнем уровне и прямо в колонке Раскладки; внутри — Блоки, кроме
   * другой Обёртки и Раскладки.
   *
   * `details` — сворачиваемый Блок: `details > summary` и следом
   * `div[data-type="detailsContent"]` с Блоками; `open` — только у `details` и
   * только пустым (`open=""`), так его пишет Редактор с Опцией `persist`.
   * `summary` вне `details` и обёртка содержимого вне него снимаются —
   * Блоки остаются подряд. Теги и атрибуты Блока открыты только в этой форме:
   * `iframe` и ему подобное так не открывается.
   *
   * `div[data-block="video"]` — видео по ссылке (ADR-0071): `data-provider`
   * (`youtube` или `twitch`), `data-src` — `https`-адрес видео на хосте этого
   * сервиса (YouTube: `youtube.com`, `youtu.be`; Twitch: `twitch.tv`,
   * `clips.twitch.tv`) и обычная ссылка внутри. Плеера в Документе нет, `iframe`
   * срезается по-прежнему: плеер рисует кит при показе.
   *
   * Формулы — `span[data-type="inline-math"]` в строке и `div[data-type="block-math"]`
   * Блоком, исходный LaTeX в `data-latex` (ADR-0070). Оба элемента всегда пусты:
   * отрисованная разметка KaTeX в Документ не попадает, её рисует Редактор и Остров
   * `RichTextView`. Пара `data-type` и `data-latex` открыта только на этих двух
   * тегах; `data-latex` — единственное значение атрибута, где допустим `<`.
   *
   * Таблица — `table > tbody > tr > th|td`, без `thead`, `colgroup` и
   * `caption`: строка-заголовок — это обычная первая строка из `th`. На ячейке
   * бывают только слияние (`colspan`, `rowspan`) и выравнивание столбца
   * (`data-align`); ширина столбцов не строится, и `style` и `colwidth` на
   * выходе не бывают. `tbody`, `tr`, `th` и `td` вне таблицы парсер HTML
   * выбрасывает сам, хук на это не нужен.
   */
  blocks: [
    "p",
    "h1",
    "h2",
    "h3",
    "h4",
    "ul",
    "ol",
    "li",
    "blockquote",
    "hr",
    "pre",
    "table",
    "tbody",
    "tr",
    "th",
    "td",
    "label",
    "input",
    "span",
    "div",
    "figure",
    "img",
    "figcaption",
    "details",
    "summary",
  ],
  /**
   * Метки и строчные узлы. `br` — мягкий перенос по Shift+Enter. `mark` —
   * маркер, всегда с `data-color`; `span` с `data-color` — цвет текста (тег
   * назван в `blocks`: там он же — разметка пункта чек-листа). `a` — ссылка,
   * её адрес ограничен схемами из `protocols`.
   */
  marks: ["strong", "em", "u", "s", "code", "sup", "sub", "mark", "br", "a"],
  /** Атрибуты по тегам. Всё, чего здесь нет, на выходе не появляется. */
  attributes: {
    /** Номер первого пункта — только когда он не 1. */
    ol: ["start"],
    /** Чек-лист: `data-type="taskList"`. */
    ul: ["data-type"],
    /**
     * Раскладка и её колонка: `data-block="layout"` и `data-block="column"`;
     * `data-layout` — вариант из `layouts`, только у Раскладки. Обёртка —
     * `data-block="wrapper"` и, если у неё есть тон, `data-tone` — имя из
     * `wrapperTones`, только у Обёртки. Обёртка содержимого сворачиваемого
     * Блока — `data-type="detailsContent"`, только прямо в `details`. Блочная
     * формула — `data-type="block-math"` с `data-latex`, только на `div`. Видео —
     * `data-block="video"` с `data-provider` (сервис) и `data-src` (ссылка на
     * видео этого сервиса, `isVideoSrc`). У `div` пункта чек-листа атрибутов нет.
     */
    div: [
      "data-block",
      "data-layout",
      "data-tone",
      "data-type",
      "data-provider",
      "data-src",
      "data-latex",
    ],
    /** Открытый сворачиваемый Блок: пустой `open`, только с Опцией `persist`. */
    details: ["open"],
    /** Пункт чек-листа: `data-type="taskItem"` и `data-checked="true|false"`. */
    li: ["data-type", "data-checked"],
    /** Флажок пункта чек-листа: всегда `type="checkbox"`, `checked` — у отмеченного. */
    input: ["type", "checked"],
    /**
     * Язык блока кода: только `language-<имя>` с именем из `codeLanguages` и
     * только на `code` внутри `pre`. Подсветка в Документ не пишется — токены
     * `hljs-*` живут декорациями Редактора (ADR-0051). Другие классы Редактор
     * не отдаёт, блок без языка — `<code>` без класса.
     */
    code: ["class"],
    /**
     * Цвет текста и маркер: имя в `data-color` ИЛИ произвольный цвет в `style`
     * (`customColor`) — вместе на одном элементе не бывают. Палитры две:
     * `span[data-color]` — имя из `textColors`, `mark[data-color]` — имя из
     * `markerColors`; имя чужой палитры на теге не принимается. Другое имя
     * Редактор не отдаёт и при загрузке отбрасывает вместе с обёрткой (старые
     * имена маркера он переводит — `legacyMarkerColors`). На `span` без
     * `data-color` и без `style` он тоже не бывает — пустой `span` есть только
     * в пункте чек-листа и у строчной формулы: `data-type="inline-math"` с
     * `data-latex`, только на `span`.
     */
    span: ["data-color", "style", "data-type", "data-latex"],
    mark: ["data-color", "style"],
    /**
     * Выравнивание Блока: значение из `alignments`, кроме `left` — оно
     * умолчание, и Редактор его не пишет (читает как отсутствие атрибута).
     */
    p: ["data-align"],
    /**
     * Ячейка таблицы: слияние — `colspan` и `rowspan`, целое больше 1 и не
     * больше `tableSpans` (1 Редактор не пишет — это умолчание); выравнивание
     * столбца — `data-align` со значением из `alignments`, кроме `left`, на
     * каждой ячейке столбца.
     */
    th: ["colspan", "rowspan", "data-align"],
    td: ["colspan", "rowspan", "data-align"],
    h1: ["data-align"],
    h2: ["data-align"],
    h3: ["data-align"],
    h4: ["data-align"],
    /**
     * Ссылка: `href` только со схемой из `protocols`, `rel` всегда
     * `"noopener noreferrer"`. `target` Редактор не отдаёт: новая вкладка —
     * решение страницы показа, а не данных Документа.
     */
    a: ["href", "rel"],
    /**
     * Картинка: `src` только абсолютный `http` или `https` (`imageProtocols`),
     * `alt` есть всегда — пустой у картинки без описания, — `data-width` —
     * значение из `imageWidths`, только у картинки с заданной шириной.
     */
    img: ["src", "alt", "data-width"],
  },
  /**
   * Допустимые значения `span[data-color]` — цвет текста: шесть тонов статуса.
   * Значение вне списка `sanitizeRichText` снимает вместе с атрибутом:
   * `ALLOWED_ATTR` у DOMPurify значений не проверяет, и проверять надо по
   * тегу — имя маркера на `span` не годится.
   */
  textColors: EDITOR_TEXT_COLOR_NAMES,
  /**
   * Допустимые значения `mark[data-color]` — маркер: девять названий цвета.
   * Те же правила, что у `textColors`, и свой тег.
   */
  markerColors: EDITOR_MARKER_NAMES,
  /**
   * Старые имена `mark[data-color]` — шесть имён цвета текста, которыми маркер
   * назывался до палитры Notion, — и цвет, в который их переводит Редактор при
   * загрузке и вставке. `sanitizeRichText` делает то же ДО проверки по
   * `markerColors`: иначе подсветка у сохранённого документа пропадёт. На
   * `span` перевода нет.
   */
  legacyMarkerColors: LEGACY_MARKER_NAMES,
  /**
   * ЕДИНСТВЕННОЕ место, где в документе бывает `style` — произвольный цвет,
   * выбранный автором в `ColorPicker`. Исключение узкое и принято
   * владельцем: у цвета автора нет имени, а носитель значения в HTML — `style`.
   *
   * `styles` — регулярное выражение (строкой) на ВСЁ значение атрибута по
   * тегу: `span` — только `color:#rrggbb`, `mark` — только
   * `background-color:#rrggbb`; строчные буквы, шесть цифр, без пробелов и
   * `;`, ничего больше. Любой другой `style` Редактор при загрузке и вставке
   * отбрасывает, а `sanitizeRichText` снимает — `ALLOWED_ATTR` у DOMPurify
   * значений не проверяет, поэтому в голом `richTextSanitizeConfig()` `style`
   * нет вовсе. `style` не бывает вместе с `data-color` на одном элементе.
   *
   * Цвет автора НЕ следует за темой — в отличие от `textColors` и `markerColors`: `#ff0000` одинаков
   * в `dark`, `light` и `dim`, и контраст на какой-то из тем может не держать.
   */
  customColor: {
    styles: CUSTOM_COLOR_STYLE_PATTERN,
  },
  /**
   * Языки блока кода — имена после `language-` в `class` у `<pre><code>`.
   * Псевдонимы (`py`, `yml`) Редактор при загрузке приводит к
   * имени, неизвестный язык — к блоку без класса; `sanitizeRichText` снимает
   * `class` со значением вне этого списка, псевдонимы тоже.
   */
  codeLanguages: CODE_LANGUAGE_IDS,
  /** Допустимые значения `data-align`; `left` читается, но не пишется. */
  alignments: EDITOR_ALIGNMENTS,
  /**
   * Варианты Раскладки — значения `div[data-layout]`: доли колонок в процентах
   * через дефис (`50-50`, `60-40`, `25-25-25-25`). Число колонок Раскладки
   * Редактор приводит к варианту при загрузке; сервер его не пересчитывает —
   * лишняя или недостающая колонка в показе ничего не ломает.
   */
  layouts: EDITOR_LAYOUTS,
  /**
   * Тоны Обёртки — значения `div[data-tone]`: имена словаря `Tone`
   * кита. Без тона атрибута нет; имя вне списка Редактор при загрузке
   * отбрасывает (Обёртка остаётся), `sanitizeRichText` снимает атрибут. Цвет
   * подставляет тема, как у `data-color`: в HTML нет ни `style`, ни роли.
   */
  wrapperTones: EDITOR_WRAPPER_TONES,
  /**
   * Схемы адреса ссылки. Только абсолютные адреса: `javascript:`, `data:` и
   * прочие схемы не проходят ни из `value`, ни из вставки, ни из поповера.
   *
   * ПОЧЕМУ БЕЗ ОТНОСИТЕЛЬНЫХ (`/docs`, `#part`, `page.html`). Документ — данные,
   * которые уезжают с экрана, где их написали: в `RichTextView` на другом
   * маршруте, в письмо, в Markdown, в соседний продукт на другом домене.
   * Относительный адрес там значит другое или ничего, а якорям в Документе не
   * на что указывать — у заголовков нет `id`. Заодно адрес без схемы в поповере
   * однозначен: `example.com` — это `https://example.com`, а не путь от
   * текущей страницы. Ослабить правило потом можно без ломки сохранённого,
   * ужесточить — уже нет.
   */
  protocols: ["http", "https", "mailto"],
  /**
   * Схемы адреса картинки — строже, чем у ссылки: `mailto:` картинкой не
   * бывает, а `data:` и `blob:` не пишутся никогда (спека, «Схема и
   * безопасность»). `data:` — это base64 внутри Документа: мегабайты в базе
   * потребителя и в каждом `onChange`; `blob:` — адрес, живущий только в
   * вкладке, где его создали, — после сохранения он ведёт в никуда.
   */
  imageProtocols: ["http", "https"],
  /**
   * Ширина картинки — доля ширины Документа в процентах: `data-width="50"`.
   * Без атрибута картинка показывается в своём размере, но не шире Документа.
   * Пресеты, а не любое число: ручки мышью прилипают к ним, и тот же набор
   * доступен с клавиатуры в поповере картинки.
   */
  imageWidths: ["50", "75", "100"],
  /**
   * Предел слияния ячейки: `colspan` не больше 20, `rowspan` не больше 50 —
   * столько же, сколько столбцов и строк у самой большой таблицы, которую
   * Редактор вставляет. Значение сверх предела, ноль, дробь и не-число
   * Редактор при загрузке и вставке читает как 1 (ячейка остаётся, слияние
   * распадается), а санитайзеру стоит снимать атрибут: `colspan="10000"` —
   * это десять тысяч пустых ячеек в каждом, кто таблицу откроет.
   */
  tableSpans: { colspan: 20, rowspan: 50 },
} as const satisfies {
  blocks: readonly string[];
  marks: readonly string[];
  attributes: Readonly<Record<string, readonly string[]>>;
  textColors: readonly string[];
  markerColors: readonly string[];
  legacyMarkerColors: Readonly<Record<string, string>>;
  codeLanguages: readonly string[];
  customColor: { readonly styles: Readonly<Record<string, string>> };
  alignments: readonly string[];
  layouts: readonly string[];
  wrapperTones: readonly string[];
  protocols: readonly string[];
  imageProtocols: readonly string[];
  imageWidths: readonly string[];
  tableSpans: { readonly colspan: number; readonly rowspan: number };
};

/**
 * Правила Схемы своего Блока — данные из описания своего Инструмента
 * (`CustomBlock`) с заполненными умолчаниями. Признаков Блока здесь нет: это
 * поведение Редактора, а не то, что может прийти в HTML.
 */
export interface RichTextCustomBlockRules {
  /** Блочный — `div[data-block="<имя>"]`, строчный — `span[data-block="<имя>"]`. */
  kind: "block" | "inline";
  /** `top` — только верхний уровень Документа (бывает только у блочного). */
  place: "anywhere" | "top";
  /** Свои атрибуты: имя без `data-` — вид значения. */
  attributes: Readonly<Record<PrefixedName, CustomAttribute>>;
}

/** Правила Схемы своей Метки — `span[data-mark="<имя>"]` и её атрибуты. */
export interface RichTextCustomMarkRules {
  attributes: Readonly<Record<PrefixedName, CustomAttribute>>;
}

/** Схема данными с правилами своих Инструментов — результат `richTextSchema(tools)`. */
export type RichTextSchema = typeof RICH_TEXT_SCHEMA & {
  /** Свои Блоки и строчные атомы — по имени Блока. */
  customBlocks: Readonly<Record<PrefixedName, RichTextCustomBlockRules>>;
  /** Свои Метки — по имени Метки. */
  customMarks: Readonly<Record<PrefixedName, RichTextCustomMarkRules>>;
};

/**
 * Имя своего Блока, Метки и Инструмента: Префикс потребителя (буква, буквы и
 * цифры), подчёркивание, остаток-слово — `acme_mergeTag`. В именах кита
 * подчёркивания не бывает, поэтому своё и встроенное не пересекаются.
 *
 * @internal Им же проверяет набор Редактор (`customToolEngine.ts`).
 */
export const CUSTOM_NAME = /^[A-Za-z][A-Za-z0-9]*_\w+$/;
/**
 * Имя своего атрибута — то же, но строчными: в HTML имена атрибутов без регистра.
 *
 * @internal
 */
export const CUSTOM_ATTRIBUTE_NAME = /^[a-z][a-z0-9]*_[a-z0-9_]+$/;

/**
 * HTML-соглашение своего правила (ADR-0058, п. 2): блочный Блок — `div`,
 * строчный Блок и Метка — `span`; Блок помечен `data-block`, Метка —
 * `data-mark`, значение — имя. Одно место на Редактор (`customToolEngine.ts`:
 * разбор, вывод, сверка `renderHTML`) и очистку на сервере.
 *
 * @internal
 */
export function customElement(kind: "block" | "inline" | "mark"): {
  tag: "div" | "span";
  marker: "data-block" | "data-mark";
} {
  return {
    tag: kind === "block" ? "div" : "span",
    marker: kind === "mark" ? "data-mark" : "data-block",
  };
}

/** Свои атрибуты с годным именем — остальные сервер не читает. */
function customAttributes(
  attributes: Readonly<Record<string, CustomAttribute>> | undefined
): Record<PrefixedName, CustomAttribute> {
  return Object.fromEntries(
    Object.entries(attributes ?? {}).filter(([name]) => CUSTOM_ATTRIBUTE_NAME.test(name))
  );
}

/**
 * Схема Редактора данными для набора `tools` — тот же массив, что получает
 * Редактор (ADR-0058, п. 2.3): Схема кита плюс правила своих Блоков и Меток.
 *
 * ИМЕНА КИТА БЕЛЫЙ СПИСОК НЕ СУЖАЮТ. Схема кита — по-прежнему всё, что кит
 * может отдать, при любом наборе: экраны с `basic` и `full` пишут один
 * Документ, и сервер одного не вправе срезать то, что записал другой. Описания
 * своих Инструментов только добавляют правила. Без аргумента — Схема кита без
 * своих правил; сама константа `RICH_TEXT_SCHEMA` не меняется.
 *
 * Правила с именем без Префикса потребителя здесь не читаются: Редактор такой
 * набор отвергает ошибкой поля, а у сервера ошибок нет — и описание с именем
 * кита (`wrapper`, атрибут `tone`) не должно открыть обход правил кита.
 *
 * Читаются только данные описания (`blocks`, `marks`), Extensions не
 * трогаются: модуль с описанием своего Инструмента импортируется на сервере,
 * и Tiptap здесь не нужен.
 */
export function richTextSchema(tools: readonly ToolEntry[] = []): RichTextSchema {
  const customBlocks: Record<PrefixedName, RichTextCustomBlockRules> = {};
  const customMarks: Record<PrefixedName, RichTextCustomMarkRules> = {};
  for (const entry of tools) {
    // Строка — имя кита, Настроенный встроенный — его опции: Схемы у них нет.
    const tool = customToolOf(entry);
    if (!tool) continue;
    for (const [name, block] of Object.entries(tool.blocks ?? {})) {
      if (!CUSTOM_NAME.test(name)) continue;
      const kind = block.kind === "inline" ? "inline" : "block";
      customBlocks[name as PrefixedName] = {
        kind,
        place: kind === "block" && block.place === "top" ? "top" : "anywhere",
        attributes: customAttributes(block.attributes),
      };
    }
    for (const [name, mark] of Object.entries(tool.marks ?? {})) {
      if (CUSTOM_NAME.test(name)) {
        customMarks[name as PrefixedName] = { attributes: customAttributes(mark.attributes) };
      }
    }
  }
  return { ...RICH_TEXT_SCHEMA, customBlocks, customMarks };
}

/** Имена атрибутов HTML своих правил: `data-mark` и `data-<имя>` каждого своего атрибута. */
function customAttributeNames(schema: RichTextSchema): string[] {
  const rules = [...Object.values(schema.customBlocks), ...Object.values(schema.customMarks)];
  return [
    ...(Object.keys(schema.customMarks).length > 0 ? ["data-mark"] : []),
    ...rules.flatMap((rule) => Object.keys(rule.attributes).map((name) => `data-${name}`)),
  ];
}

/**
 * Атрибуты и теги Схемы, которые без проверки по тегу и значению опасны.
 *
 * `ALLOWED_ATTR` у DOMPurify — один список на все теги, и значений он не
 * проверяет. Для большинства атрибутов Схемы это безвредно: `data-color` на
 * `<p>` или `start` на `<ul>` ничего не красят и ничего не исполняют. Для этих —
 * нет: `style` пропустил бы любой CSS (`position:fixed` поверх страницы),
 * `class` — любой класс Tailwind потребителя (`fixed inset-0 z-50`), `src` у
 * `<img>` DOMPurify пропускает с `data:` в обход `ALLOWED_URI_REGEXP`,
 * `colspan="10000"` — десять тысяч пустых ячеек у каждого читателя, `type` и
 * `checked` делают из флажка любое поле ввода. А `<input>` и `<img>` без своих
 * атрибутов — пустое текстовое поле и битая картинка.
 *
 * Поэтому они разрешаются ТОЛЬКО вместе с хуками `sanitizeRichText`, которые
 * сверяют тег и значение. Голый `richTextSanitizeConfig()` их не знает.
 */
const HOOK_GUARDED_ATTRIBUTES: readonly string[] = [
  "style",
  "class",
  "src",
  "colspan",
  "rowspan",
  "type",
  "checked",
  // Адрес видео: чужой скрипт ленивой загрузки читает именно `data-src`.
  "data-src",
];
const HOOK_GUARDED_TAGS: readonly string[] = ["input", "img"];

/** Атрибуты Схемы, несущие адрес: их DOMPurify сверяет с `ALLOWED_URI_REGEXP`. */
const URI_ATTRIBUTES: readonly string[] = ["href", "src"];

/**
 * Конфиг очистки для DOMPurify — ЗАКРЫТЫЙ ПО УМОЛЧАНИЮ. Безопасный путь —
 * `sanitizeRichText(html, DOMPurify)` ниже: он ставит хуки Схемы и пропускает
 * разметку Редактора целиком. Этот конфиг — для того, кто передаёт его
 * DOMPurify напрямую: без хуков он не пропустит ничего опасного, но и часть
 * разметки Редактора потеряется (цвет автора, язык блока кода, слияние ячеек,
 * флажки чек-листа и картинки — `HOOK_GUARDED_ATTRIBUTES`).
 *
 * ПОЧЕМУ ФУНКЦИЯ НА МАССИВАХ, А НЕ ЗАВИСИМОСТЬ. DOMPurify кит не ставит и не
 * импортирует: очистка — дело сервера потребителя (ADR-0050), а у него свой
 * выбор — DOMPurify с jsdom, `isomorphic-dompurify`, другой санитайзер. Здесь
 * только данные Схемы в форме, которую DOMPurify принимает, поэтому тип результата
 * свой, а не его `Config`: структурно он ему присваивается.
 *
 * ПОЧЕМУ КАЖДЫЙ РАЗ НОВЫЕ МАССИВЫ. DOMPurify и вызывающий код вольны менять
 * конфиг (`ALLOWED_ATTR.push("data-color")`), и общий массив протёк бы такой
 * правкой в соседние вызовы.
 *
 * Что остаётся в общем `ALLOWED_ATTR` — безвредно на любом теге и с любым
 * значением: имена `data-*` Схемы (их читает только типографика, и только свои
 * значения), `start`, `alt`, `rel` и `href` — адрес сверяет выражение ниже.
 * `ALLOW_DATA_ATTR` и `ALLOW_ARIA_ATTR` выключены: по умолчанию DOMPurify
 * пропускает любые `data-*` и `aria-*`, а Схема знает свои `data-*` —
 * `data-type`, `data-checked`, `data-color`, `data-align` и `data-width`, они
 * названы в `ALLOWED_ATTR` поимённо и попадают туда из `attributes`.
 *
 * АДРЕС ССЫЛКИ — `ALLOWED_URI_REGEXP` по `protocols`, той же политикой, что в
 * Редакторе: `javascript:`, `data:`, `ftp:` и относительные адреса `href` не
 * проходят. DOMPurify сверяет с этим выражением не только `href`, а КАЖДЫЙ
 * разрешённый атрибут, кроме «безопасных для URI», — и строгое выражение
 * срезало бы `start="3"` и `data-type="taskList"`. Поэтому все атрибуты Схемы,
 * кроме адресов (`href` и `src`), объявлены безопасными (`ADD_URI_SAFE_ATTR`)
 * и сверяются только со списком имён. Атрибут, который добавит следующий
 * срез, попадёт туда сам.
 *
 * Модуль серверно-безопасен: функция над данными, без React и без движка.
 */
export function richTextSanitizeConfig(): RichTextSanitizeConfig {
  return sanitizeConfig(false);
}

/**
 * Конфиг Схемы: закрытый — без охраняемых хуками атрибутов и тегов, полный — с
 * ними и с атрибутами своих Блоков и Меток (`data-mark`, `data-<имя>`): их
 * значения тоже сверяют только хуки.
 */
function sanitizeConfig(withHooks: boolean, custom?: RichTextSchema): RichTextSanitizeConfig {
  const attributes = [
    ...new Set<string>([
      ...Object.values(RICH_TEXT_SCHEMA.attributes).flat(),
      ...(custom ? customAttributeNames(custom) : []),
    ]),
  ].filter((name) => withHooks || !HOOK_GUARDED_ATTRIBUTES.includes(name));
  return {
    ALLOWED_TAGS: [...RICH_TEXT_SCHEMA.blocks, ...RICH_TEXT_SCHEMA.marks].filter(
      (tag) => withHooks || !HOOK_GUARDED_TAGS.includes(tag)
    ),
    ALLOWED_ATTR: attributes,
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: false,
    ALLOWED_URI_REGEXP: linkProtocolPattern(),
    ADD_URI_SAFE_ATTR: attributes.filter((name) => !URI_ATTRIBUTES.includes(name)),
  };
}

/** Форма, которую принимает `DOMPurify.sanitize`; подмножество его `Config`. */
export interface RichTextSanitizeConfig {
  ALLOWED_TAGS: string[];
  ALLOWED_ATTR: string[];
  ALLOW_DATA_ATTR: false;
  ALLOW_ARIA_ATTR: false;
  /** Схемы адреса ссылки — `RICH_TEXT_SCHEMA.protocols`. */
  ALLOWED_URI_REGEXP: RegExp;
  /** Атрибуты, которые DOMPurify не сверяет с `ALLOWED_URI_REGEXP`: все, кроме `href` и `src`. */
  ADD_URI_SAFE_ATTR: string[];
}

/** Событие хука `uponSanitizeAttribute`: подмножество того, что передаёт DOMPurify. */
export interface RichTextAttributeHookEvent {
  attrName: string;
  attrValue: string;
  keepAttr: boolean;
}

/**
 * Экземпляр DOMPurify — ровно то, чем пользуется `sanitizeRichText`.
 *
 * ПОЧЕМУ СТРУКТУРНЫЙ ТИП, А НЕ ИМПОРТ ИЗ `dompurify`. Пакета в зависимостях кита
 * нет и не будет (ADR-0050): потребитель приносит свой — `dompurify` с jsdom
 * или `isomorphic-dompurify`. Экземпляр любого из них присваивается этому типу
 * без приведений; это сторожит `tests/editor-sanitize.test.tsx` на настоящем
 * DOMPurify.
 */
export interface RichTextPurifier {
  sanitize(dirty: string, config: RichTextSanitizeConfig): string;
  addHook(
    entryPoint: "uponSanitizeAttribute",
    hook: (node: Element, event: RichTextAttributeHookEvent) => void
  ): void;
  addHook(entryPoint: "afterSanitizeAttributes", hook: (node: Element) => void): void;
  removeHook(
    entryPoint: "uponSanitizeAttribute",
    hook?: (node: Element, event: RichTextAttributeHookEvent) => void
  ): unknown;
  removeHook(entryPoint: "afterSanitizeAttributes", hook?: (node: Element) => void): unknown;
}

/**
 * Очистить HTML Документа по Схеме Редактора — безопасный путь по умолчанию
 * (ADR-0050): `sanitizeRichText(html, DOMPurify)` на сервере потребителя.
 *
 * ПОЧЕМУ ХЕЛПЕР, А НЕ РЕЦЕПТ НА СТРАНИЦЕ. Политика по тегам — где `style`
 * бывает и с каким значением, какой `class` у `code`, где живут `label` и
 * `input` — жила только в хуках, которые потребитель копировал со страницы
 * `RichTextView`. Конфиг при этом разрешал `style` и `class` на любом теге:
 * забытый или устаревший при копировании хук молча пропускал любой CSS. Теперь
 * хуки — код кита, они меняются вместе со Схемой, а без них конфиг закрыт.
 *
 * ХУКИ — НА ВРЕМЯ ОДНОГО ВЫЗОВА. DOMPurify держит хуки на экземпляре, а
 * экземпляр у потребителя общий (комментарии, письма, свои правила).
 * Поставленные навсегда, правила Схемы срабатывали бы в чужой очистке. Хелпер
 * ставит их перед `sanitize` и снимает после — по ссылке на функцию, поэтому
 * свои хуки потребителя остаются на месте. Снятие по ссылке — DOMPurify 3.2+;
 * старый `removeHook` без функции снимает последний поставленный, то есть тоже
 * наш. `sanitize` синхронный: чужой вызов между установкой и снятием не
 * вклинится.
 *
 * Что проверяют хуки (всё, что Редактор пишет, проходит без изменений):
 *
 * - `label`, `input`, `span`, `div` — только разметка пункта чек-листа; `input`
 *   — только `type="checkbox"`;
 * - `ol[start]` — только на `ol`; `ul`/`li[data-type]`, `li[data-checked]` —
 *   только значения чек-листа;
 * - `code[class]` — только канонический `language-<имя>` из `codeLanguages`;
 * - `span[data-color]` и `mark[data-color]` — только имена своей палитры, старые
 *   имена маркера переводятся (`legacyMarkerColors`); `mark` без цвета
 *   снимается;
 * - `style` — только `color:#rrggbb` на `span` и `background-color:#rrggbb` на
 *   `mark` и никогда вместе с `data-color`;
 * - `data-align` — известное значение на `p`, `h1`–`h4`, `th`, `td`;
 * - Раскладка — `div[data-block="layout"]` с вариантом из `layouts` и только
 *   вне колонки, списка, цитаты и таблицы; `div[data-block="column"]` — только
 *   прямо в ней. Иначе обёртка снимается, Блоки остаются подряд;
 * - Обёртка — `div[data-block="wrapper"]` на верхнем уровне или прямо в
 *   колонке Раскладки, не в другой Обёртке, списке, цитате и таблице; иначе
 *   снимается так же, вместе с тоном; `data-tone` — имя из `wrapperTones` и
 *   только на Обёртке;
 * - сворачиваемый Блок — `details` с `summary` прямо в нём и обёрткой содержимого
 *   `div[data-type="detailsContent"]` тоже прямо в нём; `open` — только пустой и
 *   только на `details`. `summary` и обёртка вне `details` теряют тег, их Блоки
 *   остаются подряд;
 * - формула — `span[data-type="inline-math"]` или `div[data-type="block-math"]` с
 *   `data-latex`: пара открыта только на этих тегах, сам элемент пуст, а в `data-latex`
 *   допустим `<` (это текст LaTeX, не разметка). Без `data-latex` элемент теряет обёртку;
 * - `colspan`, `rowspan` — на `th`/`td`, целое от 1 до `tableSpans`;
 * - видео — `div[data-block="video"]` с `data-provider` из `VIDEO_PROVIDERS` и
 *   `data-src`: `https`-адрес видео на хосте этого сервиса (`isVideoSrc`).
 *   Блок без годного сервиса или адреса, и блок видео внутри блока видео,
 *   теряет обёртку — остаётся ссылка внутри. `iframe` срезается всегда;
 * - ссылка — `href` по `protocols` (выражение конфига), `rel` всегда
 *   `"noopener noreferrer"`, ссылка без адреса становится текстом;
 * - картинка — `img` с абсолютным `http`/`https` прямо в `figure`, без `data:`
 *   и `blob:`, `data-width` — пресет, `alt` есть всегда; `figcaption` — только
 *   в `figure`.
 *
 * Токенов подсветки `hljs-*` в Схеме нет, и хелпер их снимает: подсветка —
 * после очистки (`highlightCodeBlocks`, ADR-0051).
 *
 * СВОИ ИНСТРУМЕНТЫ — ТРЕТЬИМ АРГУМЕНТОМ (ADR-0058, п. 2.3): тот же массив
 * `tools`, что у Редактора. Свой Блок проходит как `div[data-block="<имя>"]`
 * (строчный — `span`), своя Метка — как `span[data-mark="<имя>"]`, их атрибуты
 * `data-<имя>` — только на своём элементе и только со значением по виду из
 * правил (список, шаблон, адрес по политике протоколов ссылки); значение с
 * разметкой не проходит никогда. Чужие теги и атрибуты на своём элементе
 * снимаются, Блок с местом `top` вне верхнего уровня теряет обёртку, как
 * Раскладка. Имена Инструментов кита белый список не сужают (`richTextSchema`).
 * Без третьего аргумента очистка та же, что была до своих Инструментов.
 *
 * Модуль серверно-безопасен: DOM даёт экземпляр DOMPurify, кит его не
 * импортирует.
 */
export function sanitizeRichText(
  html: string,
  purify: RichTextPurifier,
  tools?: readonly ToolEntry[]
): string {
  // Хуки — замыкания на Схему этого вызова: снимаются по ссылке, как и раньше.
  const schema = richTextSchema(tools);
  const onAttribute = (node: Element, event: RichTextAttributeHookEvent) =>
    checkAttribute(node, event, schema);
  const onStructure = (node: Element) => checkStructure(node, schema);
  purify.addHook("uponSanitizeAttribute", onAttribute);
  purify.addHook("afterSanitizeAttributes", onStructure);
  try {
    return purify.sanitize(html, sanitizeConfig(true, schema));
  } finally {
    purify.removeHook("afterSanitizeAttributes", onStructure);
    purify.removeHook("uponSanitizeAttribute", onAttribute);
  }
}

const has = (list: readonly string[], value: string) => list.includes(value);

/** Слияние ячеек: только `th` и `td`, только цифры и не больше предела Схемы. */
function isSpan(node: Element, value: string, max: number): boolean {
  return (
    (node.nodeName === "TH" || node.nodeName === "TD") &&
    /^\d{1,6}$/.test(value) &&
    Number(value) >= 1 &&
    Number(value) <= max
  );
}

/**
 * Каждый атрибут Схемы — только на своём теге и со своим значением. Общий
 * `ALLOWED_ATTR` DOMPurify пускает его куда угодно и с любым значением; правило
 * здесь оставляет его там и таким, где и каким его пишет Редактор.
 */
const ATTRIBUTE_RULES: Record<string, (node: Element, value: string) => boolean> = {
  start: (node) => node.nodeName === "OL",
  "data-type": (node, value) =>
    (node.nodeName === "UL" && value === "taskList") ||
    (node.nodeName === "LI" && value === "taskItem") ||
    // Обёртка содержимого сворачиваемого Блока: только `div` прямо в `details`.
    (node.nodeName === "DIV" &&
      value === DETAILS_CONTENT &&
      node.parentElement?.nodeName === "DETAILS") ||
    // Формула: строчная — `span`, блочная — `div`; значение чужого тега не проходит.
    (node.nodeName === "SPAN" && value === INLINE_MATH) ||
    (node.nodeName === "DIV" && value === BLOCK_MATH),
  // Исходный LaTeX — текст, а не разметка, поэтому правила «без `<`» (ADR-0070) к нему
  // нет: DOMPurify экранирует его при выводе. Но только у формулы: тот же атрибут на
  // другом теге или рядом с чужим `data-type` снимается. `data-type` читается из
  // разметки, а не из решения хука: DOMPurify обходит атрибуты в своём порядке.
  "data-latex": (node) => isFormula(node),
  // Открытый Блок: `open=""`, как его пишет Редактор; значение `open="open"` из
  // чужого HTML атрибут теряет, Блок остаётся закрытым.
  open: (node, value) => node.nodeName === "DETAILS" && value === "",
  "data-checked": (node, value) =>
    node.nodeName === "LI" &&
    node.getAttribute("data-type") === "taskItem" &&
    (value === "true" || value === "false"),
  // Цвет — только на `span` и `mark` и только имя ИХ палитры: у цвета текста и у
  // маркера списки разные, имя маркера на `span` не проходит.
  "data-color": (node, value) =>
    (node.nodeName === "SPAN" && has(RICH_TEXT_SCHEMA.textColors, value)) ||
    (node.nodeName === "MARK" && has(RICH_TEXT_SCHEMA.markerColors, value)),
  // `style` — только произвольный цвет автора, выражения — из Схемы. Любой другой
  // CSS и `style` на других тегах снимаются.
  style: (node, value) => {
    const tag = node.nodeName.toLowerCase();
    const pattern =
      tag === "span" || tag === "mark" ? RICH_TEXT_SCHEMA.customColor.styles[tag] : undefined;
    return pattern !== undefined && new RegExp(pattern).test(value);
  },
  // Раскладка, колонка и Обёртка — только `div`; вариант — только у Раскладки.
  "data-block": (node, value) =>
    node.nodeName === "DIV" &&
    (value === LAYOUT_BLOCK ||
      value === COLUMN_BLOCK ||
      value === WRAPPER_BLOCK ||
      value === VIDEO_BLOCK),
  "data-layout": (node, value) =>
    node.nodeName === "DIV" &&
    node.getAttribute("data-block") === LAYOUT_BLOCK &&
    has(RICH_TEXT_SCHEMA.layouts, value),
  // Тон — только у Обёртки и только имя из словаря тонов.
  "data-tone": (node, value) =>
    node.nodeName === "DIV" &&
    node.getAttribute("data-block") === WRAPPER_BLOCK &&
    has(RICH_TEXT_SCHEMA.wrapperTones, value),
  // Видео: сервис из списка и адрес на хосте этого сервиса. Сервис читается с
  // самого элемента: DOMPurify обходит атрибуты в своём порядке.
  "data-provider": (node, value) =>
    node.nodeName === "DIV" &&
    node.getAttribute("data-block") === VIDEO_BLOCK &&
    isVideoProvider(value),
  "data-src": (node, value) =>
    node.nodeName === "DIV" &&
    node.getAttribute("data-block") === VIDEO_BLOCK &&
    isVideoSrc(node.getAttribute("data-provider") ?? "", value),
  "data-align": (node, value) =>
    ["P", "H1", "H2", "H3", "H4", "TH", "TD"].includes(node.nodeName) &&
    has(RICH_TEXT_SCHEMA.alignments, value),
  colspan: (node, value) => isSpan(node, value, RICH_TEXT_SCHEMA.tableSpans.colspan),
  rowspan: (node, value) => isSpan(node, value, RICH_TEXT_SCHEMA.tableSpans.rowspan),
  type: (node, value) => node.nodeName === "INPUT" && value === "checkbox",
  checked: (node) => node.nodeName === "INPUT",
  // Язык блока кода — только канонический «language-<имя>» и только на `code`:
  // псевдоним, второй класс рядом и класс на других тегах снимаются. Без списка
  // классов на уровне модуля: вызов `map` там не вытряхивается и ехал бы в каждый
  // импорт `@olddevs/ui/editor`, даже без очистки.
  class: (node, value) =>
    node.nodeName === "CODE" &&
    value.startsWith("language-") &&
    has(RICH_TEXT_SCHEMA.codeLanguages, value.slice("language-".length)),
  // Схему адреса уже сверил `ALLOWED_URI_REGEXP` конфига; здесь — тег.
  href: (node) => node.nodeName === "A",
  rel: (node) => node.nodeName === "A",
  // Адрес картинки — только абсолютный http и https. `ALLOWED_URI_REGEXP` здесь не
  // помогает: `data:` в `src` у `<img>` DOMPurify пропускает в обход него.
  src: (node, value) => node.nodeName === "IMG" && isAllowedImageSrc(value),
  alt: (node) => node.nodeName === "IMG",
  "data-width": (node, value) =>
    node.nodeName === "IMG" && has(RICH_TEXT_SCHEMA.imageWidths, value),
};

/** Ключ записи — только собственное поле: `constructor` и `__proto__` правилом не станут. */
function own<T>(record: Readonly<Record<string, T>>, key: string | null): T | undefined {
  return key !== null && Object.hasOwn(record, key) ? record[key] : undefined;
}

/**
 * Правила своего элемента: свой Блок — по `data-block` и тегу своего вида,
 * своя Метка — `span` по `data-mark`. Тег сверяется здесь, а не полагается на
 * уже проверенный `data-block`: DOMPurify обходит атрибуты в своём порядке.
 */
function customRulesOf(
  node: Element,
  schema: RichTextSchema
): RichTextCustomBlockRules | RichTextCustomMarkRules | undefined {
  const tag = node.nodeName.toLowerCase();
  const block = own(schema.customBlocks, node.getAttribute("data-block"));
  if (block) return tag === customElement(block.kind).tag ? block : undefined;
  return tag === customElement("mark").tag
    ? own(schema.customMarks, node.getAttribute("data-mark"))
    : undefined;
}

/**
 * Атрибут своего элемента: `true` и `false` — решение, `undefined` — дело
 * правил кита. На своём элементе бывают только `data-block`, `data-mark` и
 * свои `data-<имя>` по его правилам; атрибуты кита (`data-color`, `style`) там
 * чужие.
 */
function customAttributeAllowed(
  node: Element,
  { attrName, attrValue }: RichTextAttributeHookEvent,
  schema: RichTextSchema
): boolean | undefined {
  if (attrName === "data-mark") {
    return node.nodeName === "SPAN" && own(schema.customMarks, attrValue) !== undefined;
  }
  const rules = customRulesOf(node, schema);
  if (attrName === "data-block") {
    const block = own(schema.customBlocks, attrValue);
    return block ? rules === block : undefined;
  }
  const attribute = attrName.startsWith("data-")
    ? own(rules?.attributes ?? {}, attrName.slice("data-".length))
    : undefined;
  if (attribute) return isAllowedAttributeValue(attribute, attrValue);
  return rules ? false : undefined;
}

/** Хук `uponSanitizeAttribute`: атрибут Схемы — по правилу своего имени. */
function checkAttribute(
  node: Element,
  event: RichTextAttributeHookEvent,
  schema: RichTextSchema
): void {
  const custom = customAttributeAllowed(node, event, schema);
  if (custom !== undefined) {
    if (!custom) event.keepAttr = false;
    return;
  }
  // Документ, сохранённый до палитры маркера Notion, несёт на `mark` старое имя
  // (`accent`, `success`, …). Его переводят до проверки, как Редактор при
  // загрузке; иначе подсветка пропала бы, а голый `mark` снимается ниже.
  if (event.attrName === "data-color" && node.nodeName === "MARK") {
    const legacy = RICH_TEXT_SCHEMA.legacyMarkerColors as Record<string, string>;
    if (Object.hasOwn(legacy, event.attrValue)) event.attrValue = legacy[event.attrValue]!;
  }
  const allowed = ATTRIBUTE_RULES[event.attrName];
  if (allowed && !allowed(node, event.attrValue)) event.keepAttr = false;
}

/**
 * `label`, `input`, `span` и `div` — разметка пункта чек-листа. Вне пункта
 * обёртка снимается, а содержимое остаётся, как и у любого неразрешённого тега.
 */
const TASK_ITEM = 'li[data-type="taskItem"]';
const PARENT_OF: Record<string, string> = {
  LABEL: TASK_ITEM,
  DIV: TASK_ITEM,
  INPUT: `${TASK_ITEM} > label`,
  SPAN: `${TASK_ITEM} > label`,
};

/** Значение `div[data-type]` обёртки содержимого сворачиваемого Блока (`details.ts`). */
const DETAILS_CONTENT = "detailsContent";

/** Значения `data-type` формул: строчная — `span`, блочная — `div` (ADR-0070). */
const INLINE_MATH = "inline-math";
const BLOCK_MATH = "block-math";

/** Формула в форме, которую пишет Редактор: тег и `data-type` из пары. */
function isFormula(node: Element): boolean {
  const type = node.getAttribute("data-type");
  return (
    (node.nodeName === "SPAN" && type === INLINE_MATH) ||
    (node.nodeName === "DIV" && type === BLOCK_MATH)
  );
}

/** Значения `div[data-block]`: Раскладка, её колонка и Обёртка. */
const LAYOUT_BLOCK = "layout";
const COLUMN_BLOCK = "column";
const WRAPPER_BLOCK = "wrapper";

/**
 * Где Раскладки быть не может: в другой Раскладке (её колонке), в Обёртке, в
 * списке, цитате, ячейке и сворачиваемом Блоке. Редактор такую не отдаёт — у колонки и прочих контейнеров
 * в Схеме движка её нет, — и при загрузке разворачивает в Блоки подряд.
 */
const NOT_A_LAYOUT_PLACE = "div[data-block], li, blockquote, th, td, details";

/**
 * Раскладка, колонка и Обёртка: `true` — элемент обработан (оставлен или
 * снят). Родитель обходится раньше детей, поэтому колонка снятой Раскладки уже
 * не находит её над собой и снимается тоже, а Обёртка снятой колонки
 * проверяется по новому месту.
 */
function checkLayout(node: Element): boolean {
  const block = node.nodeName === "DIV" ? node.getAttribute("data-block") : null;
  // Обёртка — на верхнем уровне или прямо в колонке: тот же список мест, где
  // нет Раскладки, только колонка её принимает.
  if (block === WRAPPER_BLOCK) {
    const parent = node.parentElement;
    if (
      parent?.closest(NOT_A_LAYOUT_PLACE) &&
      !parent.matches(`div[data-block="${COLUMN_BLOCK}"]`)
    ) {
      node.replaceWith(...node.childNodes);
    }
    return true;
  }
  if (block === LAYOUT_BLOCK) {
    if (!node.hasAttribute("data-layout") || node.parentElement?.closest(NOT_A_LAYOUT_PLACE)) {
      node.replaceWith(...node.childNodes);
    }
    return true;
  }
  if (block === COLUMN_BLOCK) {
    if (!node.parentElement?.matches(`div[data-block="${LAYOUT_BLOCK}"]`)) {
      node.replaceWith(...node.childNodes);
    }
    return true;
  }
  return false;
}

/**
 * Свой элемент: `true` — обработан (оставлен или снят). Блок с местом `top` —
 * только прямо в Документе: вложенный теряет обёртку, содержимое остаётся.
 */
function checkCustom(node: Element, schema: RichTextSchema): boolean {
  const rules = customRulesOf(node, schema);
  if (!rules) return false;
  const parent = node.parentElement;
  // Верхний уровень — прямо в `body` разбора DOMPurify. По имени, а не по
  // `ownerDocument.body`: у документа разбора DOMPurify его может не быть.
  if ("place" in rules && rules.place === "top" && parent && parent.nodeName !== "BODY") {
    node.replaceWith(...node.childNodes);
  }
  return true;
}

/**
 * Блок видео: `true` — элемент обработан. Без годного сервиса и адреса (хук
 * атрибутов снял то, чего не должно быть) и внутри другого блока видео он теряет
 * обёртку; остаётся ссылка, которую читатель видит и без плеера.
 */
function checkVideo(node: Element): boolean {
  if (node.nodeName !== "DIV" || node.getAttribute("data-block") !== VIDEO_BLOCK) return false;
  const provider = node.getAttribute("data-provider");
  const src = node.getAttribute("data-src");
  const valid = provider !== null && src !== null && isVideoSrc(provider, src);
  if (!valid || node.parentElement?.closest(`div[data-block="${VIDEO_BLOCK}"]`)) {
    node.replaceWith(...node.childNodes);
  }
  return true;
}

/** Хук `afterSanitizeAttributes`: место элемента в Документе. */
function checkStructure(node: Element, schema: RichTextSchema): void {
  if (checkLayout(node) || checkVideo(node) || checkCustom(node, schema)) return;
  // Формула — лист: пустой элемент с `data-latex`. Отрисованная разметка KaTeX в
  // Документ не попадает (ADR-0070), поэтому дети снимаются; без исходника
  // элемент теряет обёртку, как любой лишний `span` и `div`.
  if (isFormula(node)) {
    if (node.hasAttribute("data-latex")) node.replaceChildren();
    else node.replaceWith(...node.childNodes);
    return;
  }
  // Без `type="checkbox"` поле ввода — обычное текстовое: такого флажка нет.
  if (node.nodeName === "INPUT" && node.getAttribute("type") !== "checkbox") {
    node.remove();
    return;
  }
  // Цвет у метки один — палитры или автора, поэтому рядом с `data-color` `style`
  // снимается. `span` с цветом бывает где угодно; `mark` без цвета снимается:
  // голый маркер браузер красит жёлтым.
  if (node.hasAttribute("data-color")) node.removeAttribute("style");
  const coloured = node.hasAttribute("data-color") || node.hasAttribute("style");
  if (node.nodeName === "MARK" && !coloured) {
    node.replaceWith(...node.childNodes);
    return;
  }
  if (node.nodeName === "SPAN" && coloured) return;
  // Сворачиваемый Блок: `summary` — только прямо в `details`, обёртка
  // содержимого с `data-type` — тоже (атрибут уже снят хуком, если она не там).
  // Вне Блока они теряют обёртку, содержимое остаётся.
  if (node.nodeName === "SUMMARY") {
    if (node.parentElement?.nodeName !== "DETAILS") node.replaceWith(...node.childNodes);
    return;
  }
  if (node.nodeName === "DIV" && node.getAttribute("data-type") === DETAILS_CONTENT) return;
  // Картинка — `img` с адресом прямо внутри `figure`, и только так: `figure`
  // без годной картинки разворачивается в содержимое, `img` вне `figure` или без
  // адреса удаляется, `figcaption` вне `figure` теряет обёртку.
  if (node.nodeName === "FIGURE") {
    const img = node.querySelector(":scope > img");
    if (!img || !isAllowedImageSrc(img.getAttribute("src") ?? "")) {
      node.replaceWith(...node.childNodes);
    }
    return;
  }
  if (node.nodeName === "IMG") {
    if (!node.hasAttribute("src") || node.parentElement?.nodeName !== "FIGURE") {
      node.remove();
      return;
    }
    if (!node.hasAttribute("alt")) node.setAttribute("alt", "");
    return;
  }
  if (node.nodeName === "FIGCAPTION") {
    if (node.parentElement?.nodeName !== "FIGURE") node.replaceWith(...node.childNodes);
    return;
  }
  // Ссылка, у которой адрес срезан (чужая схема), остаётся текстом; у ссылки
  // с адресом `rel` всегда тот, что пишет Редактор.
  if (node.nodeName === "A") {
    if (!node.hasAttribute("href")) {
      node.replaceWith(...node.childNodes);
      return;
    }
    node.setAttribute("rel", "noopener noreferrer");
  }
  const parent = PARENT_OF[node.nodeName];
  if (parent && !node.parentElement?.matches(parent)) node.replaceWith(...node.childNodes);
}

/**
 * Символы, которые браузер вырезает из адреса перед разбором: пробелы и
 * управляющие. `java\tscript:` для него — `javascript:`, поэтому схема
 * сверяется после их удаления. Набор тот же, что `ATTR_WHITESPACE` у DOMPurify:
 * Редактор и очистка на сервере обязаны видеть один и тот же адрес.
 */
// eslint-disable-next-line no-control-regex -- управляющие символы и есть предмет проверки
const URI_WHITESPACE = /[\u0000-\u0020\u00A0\u1680\u180E\u2000-\u2029\u205F\u3000]/g;

/** Адрес начинается с разрешённой схемы — из `RICH_TEXT_SCHEMA.protocols`. */
function linkProtocolPattern(): RegExp {
  return new RegExp(`^(?:${RICH_TEXT_SCHEMA.protocols.join("|")}):`, "i");
}

/**
 * Годится ли адрес для ссылки Документа: абсолютный, со схемой из
 * `RICH_TEXT_SCHEMA.protocols`. Им проверяют и Редактор (загрузка, вставка,
 * поповер), и конфиг очистки — правило одно на обе стороны.
 *
 * @internal Не входит в публичные входы: потребителю хватает конфига.
 */
export function isAllowedLinkHref(href: string): boolean {
  return linkProtocolPattern().test(href.replace(URI_WHITESPACE, ""));
}

/**
 * Годится ли адрес для картинки Документа: абсолютный `http` или `https`
 * (`RICH_TEXT_SCHEMA.imageProtocols`) с именем хоста. `https:photo.png` без
 * `//` браузер разобрал бы относительно страницы — такой адрес не проходит.
 *
 * @internal Не входит в публичные входы: потребителю хватает `sanitizeRichText`.
 */
export function isAllowedImageSrc(src: string): boolean {
  const pattern = new RegExp(`^(?:${RICH_TEXT_SCHEMA.imageProtocols.join("|")})://[^/?#]`, "i");
  return pattern.test(src.replace(URI_WHITESPACE, ""));
}

/**
 * Годится ли значение своего атрибута по его виду (`CustomAttribute`). Одна
 * проверка на Редактор (`customToolEngine.ts`) и очистку на сервере.
 *
 * Значение с `<` не проходит никогда, какой бы ни был шаблон: HTML в атрибутах
 * запрещён (ADR-0058, п. 2.5) — содержимое Блока живёт разметкой Документа в
 * его детях, где его чистит та же Схема.
 *
 * @internal Наружу отдаётся через `customTool.ts`.
 */
export function isAllowedAttributeValue(rule: CustomAttribute, value: string): boolean {
  if (value.includes("<")) return false;
  if (rule.kind === "list") return rule.values.includes(value);
  if (rule.kind === "pattern") return patternOf(rule)?.test(value) ?? false;
  return rule.kind === "url" && isAllowedLinkHref(value);
}

/**
 * Выражения правил `pattern` — по одному на правило: очистка зовёт проверку на
 * каждый атрибут каждого вызова, и компилировать шаблон заново там незачем.
 * Ключ — объект правила (`richTextSchema` его не копирует), `null` — шаблон не
 * выражение.
 */
const PATTERNS = new WeakMap<CustomAttribute, RegExp | null>();

/**
 * Выражение правила или `null`. Битый шаблон Редактор отвергает ошибкой поля
 * (`customToolsError`), а у сервера ошибок нет: очистка не падает, значение по
 * такому правилу не проходит, разработчик видит предупреждение. Шаблон в
 * тексте — данные описания, не меняющиеся от вызова к вызову.
 */
function patternOf(rule: Extract<CustomAttribute, { kind: "pattern" }>): RegExp | null {
  let pattern = PATTERNS.get(rule);
  if (pattern === undefined) {
    try {
      pattern = new RegExp(`^(?:${rule.pattern})$`);
    } catch {
      pattern = null;
      devWarn(
        `sanitizeRichText: the custom attribute pattern "${rule.pattern}" is not a regular ` +
          "expression, so no value passes it. Fix the pattern in the tool's rules."
      );
    }
    PATTERNS.set(rule, pattern);
  }
  return pattern;
}
