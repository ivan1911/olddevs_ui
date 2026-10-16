// Происхождение: minimal-tiptap, `styles/partials/typography.css`, `lists.css`,
// `code.css` и `styles/index.css` (MIT, © 2024 Aslam,
// https://github.com/Aslam97/minimal-tiptap). Переписано Tailwind-классами на
// токенах кита. Лицензия — NOTICE в корне пакета.

import { CODE_THEME_CLASS } from "./codeTheme.js";
import type { EditorWrapperTone } from "../../i18n/messages.js";
import type { EditorMarkerName, EditorTextColorName } from "./palette.js";
import type { RichTextSurface } from "./surface.js";
import { EDITOR_PAPER_TOKENS_CLASS, EDITOR_TOKENS_CLASS } from "./tokens.js";

/**
 * Классы цвета текста и маркера по именам палитр (`palette.ts`).
 *
 * ПОЧЕМУ ЛИТЕРАЛЫ, А НЕ СБОРКА ИЗ ИМЕНИ ТОКЕНА. Tailwind читает исходник как
 * текст: `text-${token}` он не увидит, и класса в сборке не будет. Поэтому
 * каждый класс записан целиком, а соответствие записей токенам палитры держит
 * тест (`tests/rich-text-editor-color.test.tsx`), и `Record` не даёт забыть имя
 * при добавлении цвета.
 *
 * Используются дважды: селекторами на контейнере документа (ниже) и образцами
 * в меню Панели.
 */
export const EDITOR_TEXT_COLOR_CLASS: Record<EditorTextColorName, string> = {
  accent: "text-accent-strong",
  success: "text-success-strong",
  warning: "text-warning-strong",
  danger: "text-danger-strong",
  lime: "text-draft-strong",
  muted: "text-fg-2",
};

/**
 * Подложка маркера: токен `--marker-<имя>` компонентного слоя, значение у
 * каждой темы своё (`styles.css`).
 *
 * ПЕРЕМЕННАЯ ЧИТАЕТСЯ НАПРЯМУЮ — `bg-(--marker-gray)`, а не `bg-marker-gray`
 * через мост `@theme`. Мост (`--color-x: var(--x)`) объявлен на корне, и
 * `var()` в нём подставляется ТАМ: вложенная тема (`data-theme="light"` на
 * обёртке внутри тёмного приложения) значения моста уже не меняет. Прямая
 * ссылка подставляется на самом `mark` и берёт значение ближайшего предка с
 * `data-theme`. Класс читает глобальный токен, а не `--rte-*`: меню Панели
 * открывается порталом вне контейнера документа, где `--rte-*` нет.
 *
 * ТЕКСТ НА МАРКЕРЕ. У трёх ярких маркеров образец несёт и
 * `text-(--marker-text)`: их подложка одна во всех темах и яркая, а светлый
 * текст тёмной темы на ней не читался бы. У шести прежних цветов Notion подложки
 * свои у каждой темы (в тёмных — тёмные) и остаются под наследуемый основной
 * текст (`EDITOR_BRIGHT_MARKER_NAMES` в `palette.ts`).
 */
export const EDITOR_MARKER_CLASS: Record<EditorMarkerName, string> = {
  yellow: "bg-(--marker-yellow) text-(--marker-text)",
  green: "bg-(--marker-green) text-(--marker-text)",
  pink: "bg-(--marker-pink) text-(--marker-text)",
  gray: "bg-(--marker-gray)",
  brown: "bg-(--marker-brown)",
  orange: "bg-(--marker-orange)",
  purple: "bg-(--marker-purple)",
  blue: "bg-(--marker-blue)",
  red: "bg-(--marker-red)",
};

/**
 * Образец тона Обёртки в подменю «Тон ›» ручки: подпись пункта на
 * мягкой подложке тона с полосой слева — тот же вид, что у Обёртки в
 * Документе, только в миниатюре. Имя тона — словом, образец его только
 * подкрепляет.
 *
 * Токены кита напрямую, а не роли `--rte-tone-*`: меню открывается порталом вне
 * контейнера Документа, где ролей нет (как у `EDITOR_MARKER_CLASS`). Совпадение
 * токенов образца с ролями темы сторожит `tests/rich-text-editor-wrapper-tone.test.tsx`.
 */
export const EDITOR_WRAPPER_TONE_CLASS: Record<EditorWrapperTone, string> = {
  neutral: "rounded-xs border-l-[3px] border-(--fg-3) bg-(--bg-3) px-1.5",
  accent: "rounded-xs border-l-[3px] border-(--accent-strong) bg-(--accent-soft) px-1.5",
  success: "rounded-xs border-l-[3px] border-(--success-strong) bg-(--success-soft) px-1.5",
  warning: "rounded-xs border-l-[3px] border-(--warning-strong) bg-(--warning-soft) px-1.5",
  danger: "rounded-xs border-l-[3px] border-(--danger-strong) bg-(--danger-soft) px-1.5",
};

/**
 * Цвет и маркер в документе: `span[data-color]` и `mark[data-color]`.
 *
 * Селектор на каждое имя, а не одна переменная `--rte-color`: переменную
 * пришлось бы задавать тем же перечнем, а литеральный класс при этом остаётся
 * проверяемым гейтом контраста, который мерит те же пары токенов.
 *
 * СТАРЫЕ ИМЕНА МАРКЕРА (`mark[data-color=accent]` и ещё пять) красятся цветом,
 * в который их переводит Редактор при загрузке (`LEGACY_MARKER_NAMES`). Показ
 * HTML заново не разбирает: если сервер сохранил документ до новой палитры и
 * не перевёл имена очисткой (`sanitizeRichText`), без этих правил подсветка исчезла бы.
 */
const COLOR_CLASS =
  "[&_span[data-color=accent]]:text-(--rte-text-accent) [&_span[data-color=success]]:text-(--rte-text-success) " +
  "[&_span[data-color=warning]]:text-(--rte-text-warning) [&_span[data-color=danger]]:text-(--rte-text-danger) " +
  "[&_span[data-color=lime]]:text-(--rte-text-lime) [&_span[data-color=muted]]:text-(--rte-text-muted) " +
  "[&_mark[data-color=gray]]:bg-(--marker-gray) [&_mark[data-color=brown]]:bg-(--marker-brown) " +
  "[&_mark[data-color=orange]]:bg-(--marker-orange) [&_mark[data-color=yellow]]:bg-(--marker-yellow) " +
  "[&_mark[data-color=green]]:bg-(--marker-green) [&_mark[data-color=blue]]:bg-(--marker-blue) " +
  "[&_mark[data-color=purple]]:bg-(--marker-purple) [&_mark[data-color=pink]]:bg-(--marker-pink) " +
  "[&_mark[data-color=red]]:bg-(--marker-red) " +
  "[&_mark[data-color=accent]]:bg-(--marker-blue) [&_mark[data-color=success]]:bg-(--marker-green) " +
  "[&_mark[data-color=warning]]:bg-(--marker-yellow) [&_mark[data-color=danger]]:bg-(--marker-red) " +
  "[&_mark[data-color=lime]]:bg-(--marker-green) [&_mark[data-color=muted]]:bg-(--marker-gray) " +
  // Текст на маркере тёмный (`--marker-text`), а не наследуемый:
  // подложка яркая и одна во всех темах, а браузерное `color: MarkText` иначе
  // перекрасило бы текст в чёрный на любой теме. Правило общее, поэтому тёмный
  // текст получает и цвет автора. Исключение — шесть прежних цветов Notion и старые
  // имена, которые переводятся в них: подложки прежние, в тёмных темах тёмные, и под
  // ними остаётся наследуемый основной текст.
  //
  // Без скругления и бокового отступа (решение владельца): ProseMirror режет
  // один маркер на несколько `mark` на каждой границе другой метки (жирный,
  // курсив, ссылка), и у каждого куска были свои углы и поля — сплошная пометка
  // распадалась на «пузыри» с просветами у точек и пробелов. Прямоугольные
  // куски без полей сливаются в одну полосу, как след текстовыделителя.
  "[&_mark]:text-(--marker-text) " +
  // Выделение поверх яркого маркера — плотнее общего (`selection-marker`,
  // `tokens.ts`), текст — тёмный текст маркера. Читаемые имена исключены: их
  // подложки в тёмных темах тёмные, и общее выделение на них видно.
  "[&_mark:not(:is([data-color=gray],[data-color=brown],[data-color=orange],[data-color=blue],[data-color=purple],[data-color=red],[data-color=accent],[data-color=danger],[data-color=muted]))]:selection:bg-(--rte-selection-marker) " +
  "[&_mark:not(:is([data-color=gray],[data-color=brown],[data-color=orange],[data-color=blue],[data-color=purple],[data-color=red],[data-color=accent],[data-color=danger],[data-color=muted]))]:selection:text-(--marker-text) " +
  "[&_mark[data-color=gray]]:text-inherit [&_mark[data-color=brown]]:text-inherit " +
  "[&_mark[data-color=orange]]:text-inherit [&_mark[data-color=blue]]:text-inherit " +
  "[&_mark[data-color=purple]]:text-inherit [&_mark[data-color=red]]:text-inherit " +
  "[&_mark[data-color=accent]]:text-inherit [&_mark[data-color=danger]]:text-inherit " +
  "[&_mark[data-color=muted]]:text-inherit " +
  // Выравнивание Блока (`p`, `h1`–`h4`) и столбца таблицы (`th`, `td`): `left`
  // не пишется. Селектор по атрибуту специфичнее `text-left` ячейки ниже
  // (`[&_:is(th,td)]`), поэтому столбец выравнивается без `!important`, а абзац
  // со своим `data-align` внутри ячейки — сильнее столбца: он ближе к тексту.
  "[&_[data-align=center]]:text-center [&_[data-align=right]]:text-right ";

/**
 * Таблица Документа: `table > tbody > tr > th|td` без единого класса и `style`
 * в разметке (`tables.ts`), поэтому всё оформление — отсюда, и один и тот же
 * текст выглядит одинаково в Редакторе и в `RichTextView`.
 *
 * ПРОКРУТКА ПО ГОРИЗОНТАЛИ — НА САМОЙ `<table>`: `display: block` с
 * `overflow-x: auto` и `max-width: 100%`. Обёртки у таблицы быть не может:
 * `RichTextView` кладёт в страницу сохранённый HTML как есть, а Схема не знает
 * ни `div.tableWrapper`, ни `tabindex`. Внутри блока браузер строит
 * безымянную таблицу, и ширину ей задают столбцы: `min-w-24` на ячейке
 * (6 rem) не даёт столбцам сжаться в щель, и таблица из пяти столбцов на
 * экране в 375 px прокручивается внутри своего блока, а не раздвигает
 * страницу. Короткая таблица остаётся по ширине содержимого.
 *
 * ЦЕНА `display: block`. Часть скринридеров на `table` с таким `display` теряет
 * табличную семантику (ячейки читаются без строк и столбцов); в Chrome и
 * Firefox это давно исправлено, в Safari с VoiceOver — по версиям. Другой
 * способ — `table-layout: fixed` без прокрутки — делает столбцы одинаковыми и
 * узкими, а длинный столбец режет по слогам; для документа, который читают с
 * телефона, прокрутка меньшее зло. Прокручиваемая область без
 * фокусируемого содержимого в `RichTextView` (axe: `scrollable-region-focusable`)
 * срабатывает только когда таблица реально шире экрана; в Редакторе внутри
 * каждой ячейки есть каретка.
 *
 * `.selectedCell` — класс, которым движок таблиц помечает ячейки при выделении
 * мышью поперёк ячеек; без правила выделение не видно.
 *
 * `.ProseMirror-gapcursor` — «курсор-щель»: после стрелки вниз из последней
 * ячейки таблицы, которая стоит последним Блоком, каретке негде быть, и
 * движок рисует тонкую черту между Блоками (набор текста там создаёт абзац).
 * Своего стиля у расширения нет: без правила черта невидима, и человек с
 * клавиатуры не понял бы, где он. Показывается только в сфокусированном
 * поле.
 */
const TABLE_CLASS =
  "[&_table]:block [&_table]:max-w-full [&_table]:overflow-x-auto [&_table]:border-collapse " +
  "[&_:is(th,td)]:min-w-24 [&_:is(th,td)]:border [&_:is(th,td)]:border-(--rte-hr) " +
  "[&_:is(th,td)]:px-3 [&_:is(th,td)]:py-1.5 [&_:is(th,td)]:text-left [&_:is(th,td)]:align-top " +
  "[&_th]:bg-(--rte-code-background) [&_th]:font-semibold " +
  "[&_:is(th,td)>*:not(:last-child)]:mb-2 [&_.selectedCell]:bg-(--rte-selection) " +
  "[&_.ProseMirror-gapcursor]:pointer-events-none [&_.ProseMirror-gapcursor]:relative " +
  "[&_.ProseMirror-gapcursor]:hidden [&.ProseMirror-focused_.ProseMirror-gapcursor]:block " +
  "[&_.ProseMirror-gapcursor]:after:absolute [&_.ProseMirror-gapcursor]:after:-top-0.5 " +
  "[&_.ProseMirror-gapcursor]:after:w-5 [&_.ProseMirror-gapcursor]:after:border-t-2 " +
  "[&_.ProseMirror-gapcursor]:after:border-(--rte-foreground)";

/**
 * Раскладка: `div[data-block=layout]` — сетка, колонки — её ячейки,
 * доли — по варианту в `data-layout` (`columnLayouts.ts`). Ни классов, ни
 * `style` в разметке нет, поэтому сетка одна в Редакторе и в `RichTextView`.
 *
 * УЗКИЙ ЭКРАН — КОНТЕЙНЕРНЫЙ ЗАПРОС, А НЕ ПОРОГ ЭКРАНА. Документ живёт в
 * колонке страницы, в Dialog и в Drawer, и ширина окна о его ширине не говорит:
 * Drawer в 400 px на мониторе в 1920 px получил бы четыре колонки по 80 px.
 * Поэтому колонки встают рядом, только когда на каждую из них у самого
 * Документа есть около 14 rem: две — с 30 rem (480 px), три — с 40 rem
 * (640 px), четыре — с 48 rem (768 px); уже — столбцом, в порядке чтения.
 * Порог по числу колонок, а не общий: Раскладка в две колонки помещается в
 * Dialog шириной 560 px, а четыре колонки там были бы по 110 px. Контейнер — корень Документа, и только
 * когда в нём есть Раскладка (`:has`): `container-type: inline-size` отнимает у
 * элемента ширину по содержимому, и в сжимающем контексте (элемент flex-ряда
 * без ширины) Документ без Раскладки сжиматься по-прежнему может. Сама
 * Раскладка контейнером быть не может — запрос не меряет элемент, к которому
 * применяется, а обёртки у неё в Схеме нет.
 *
 * `minmax(0, …)` и `min-w-0` у колонки — длинное слово, таблица и блок кода
 * прокручиваются внутри своей колонки, а не раздвигают сетку.
 *
 * РАМКА — ТОЛЬКО В РЕДАКТОРЕ (`.ProseMirror`): пунктир показывает автору, где
 * кончается одна колонка и начинается другая, особенно пустая (образец
 * владельца). Читателю `RichTextView` граница не нужна — там колонки разделяет
 * только промежуток. Цвет — серый плейсхолдера (`--rte-muted-foreground`), а не
 * черты (`--rte-hr`): рамка пустой колонки — единственное, что показывает, где
 * её область, и бледная черта таблицы в светлой теме терялась на фоне поля.
 */
const LAYOUT_CLASS =
  "[&:has(>[data-block=layout])]:[container-type:inline-size] " +
  "[&:has(>[data-block=layout])]:[container-name:rte-document] " +
  "[&_[data-block=layout]]:grid [&_[data-block=layout]]:gap-4 " +
  "[&_[data-block=column]]:min-w-0 [&_[data-block=column]>*:not(:last-child)]:mb-3 " +
  "[&_[data-block=column]>:is(h1,h2,h3,h4):not(:first-child)]:mt-6 " +
  "@min-[30rem]/rte-document:[&_[data-layout='50-50']]:grid-cols-2 " +
  "@min-[30rem]/rte-document:[&_[data-layout='60-40']]:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] " +
  "@min-[30rem]/rte-document:[&_[data-layout='40-60']]:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] " +
  "@min-[40rem]/rte-document:[&_[data-layout='33-33-33']]:grid-cols-3 " +
  "@min-[48rem]/rte-document:[&_[data-layout='25-25-25-25']]:grid-cols-4 " +
  "[&.ProseMirror_[data-block=column]]:rounded-(--rte-radius) " +
  "[&.ProseMirror_[data-block=column]]:border [&.ProseMirror_[data-block=column]]:border-dashed " +
  "[&.ProseMirror_[data-block=column]]:border-(--rte-muted-foreground) " +
  "[&.ProseMirror_[data-block=column]]:p-2";

/**
 * Обёртка: `div[data-block=wrapper]` — группа Блоков без своего
 * вида, как у Redactor. Отступы между её Блоками — те же, что в Документе, и в
 * Редакторе, и в `RichTextView`: читатель видит текст так, будто обёртки нет.
 *
 * РАМКА БЕЗ ТОНА — ТОЛЬКО В РЕДАКТОРЕ, как у колонки Раскладки, и тем же
 * видом: серый пунктир плейсхолдера и внутренний отступ. Без неё автор не
 * видит, где кончается группа, а пустая Обёртка была бы невидима вовсе.
 *
 * ТОН (`data-tone`) — вид и для читателя, ОДИН в Редакторе и в
 * `RichTextView`: мягкая подложка тона и полоса 3 px слева сильной ступенью,
 * как callout GitHub и Notion и `soft` у `Alert`; текст — обычный текст
 * Документа. Пунктира у тонированной Обёртки нет и в Редакторе: границу и так
 * видно по подложке и полосе, а пунктир поверх подложки рисовал бы вторую
 * рамку, которой у читателя нет, — и автор видел бы не то, что опубликует.
 * Цвета — роли `--rte-tone-*` (`tokens.ts`): на листе `paper` у них свои
 * значения. Вид — только у пяти имён словаря: чужое имя в несанитизированном
 * HTML остаётся без вида, как неизвестный `data-color`.
 */
const WRAPPER_CLASS =
  "[&_[data-block=wrapper]>*:not(:last-child)]:mb-3 " +
  "[&_[data-block=wrapper]>:is(h1,h2,h3,h4):not(:first-child)]:mt-6 " +
  "[&.ProseMirror_[data-block=wrapper]:not([data-tone])]:rounded-(--rte-radius) " +
  "[&.ProseMirror_[data-block=wrapper]:not([data-tone])]:border " +
  "[&.ProseMirror_[data-block=wrapper]:not([data-tone])]:border-dashed " +
  "[&.ProseMirror_[data-block=wrapper]:not([data-tone])]:border-(--rte-muted-foreground) " +
  "[&.ProseMirror_[data-block=wrapper]:not([data-tone])]:p-2 " +
  "[&_[data-block=wrapper]:is([data-tone=neutral],[data-tone=accent],[data-tone=success],[data-tone=warning],[data-tone=danger])]:rounded-(--rte-radius) " +
  "[&_[data-block=wrapper]:is([data-tone=neutral],[data-tone=accent],[data-tone=success],[data-tone=warning],[data-tone=danger])]:border-l-[3px] " +
  "[&_[data-block=wrapper]:is([data-tone=neutral],[data-tone=accent],[data-tone=success],[data-tone=warning],[data-tone=danger])]:px-3 " +
  "[&_[data-block=wrapper]:is([data-tone=neutral],[data-tone=accent],[data-tone=success],[data-tone=warning],[data-tone=danger])]:py-2.5 " +
  // Вторичный текст на подложке тона — более контрастными ролями (`tokens.ts`, ⁴).
  "[&_[data-block=wrapper]:is([data-tone=neutral],[data-tone=accent],[data-tone=success],[data-tone=warning],[data-tone=danger])]:[--rte-link:var(--rte-tone-link)] " +
  "[&_[data-block=wrapper]:is([data-tone=neutral],[data-tone=accent],[data-tone=success],[data-tone=warning],[data-tone=danger])]:[--rte-secondary:var(--rte-tone-secondary)] " +
  "[&_[data-block=wrapper]:is([data-tone=neutral],[data-tone=accent],[data-tone=success],[data-tone=warning],[data-tone=danger])]:[--rte-muted:var(--rte-tone-muted)] " +
  "[&_[data-block=wrapper]:is([data-tone=neutral],[data-tone=accent],[data-tone=success],[data-tone=warning],[data-tone=danger])]:[--rte-text-muted:var(--rte-tone-muted)] " +
  "[&_[data-block=wrapper]:is([data-tone=neutral],[data-tone=accent],[data-tone=success],[data-tone=warning],[data-tone=danger])]:[--rte-muted-foreground:var(--rte-tone-muted-foreground)] " +
  "[&_[data-block=wrapper][data-tone=neutral]]:bg-(--rte-tone-neutral-background) " +
  "[&_[data-block=wrapper][data-tone=neutral]]:border-(--rte-tone-neutral-border) " +
  "[&_[data-block=wrapper][data-tone=accent]]:bg-(--rte-tone-accent-background) " +
  "[&_[data-block=wrapper][data-tone=accent]]:border-(--rte-tone-accent-border) " +
  "[&_[data-block=wrapper][data-tone=success]]:bg-(--rte-tone-success-background) " +
  "[&_[data-block=wrapper][data-tone=success]]:border-(--rte-tone-success-border) " +
  "[&_[data-block=wrapper][data-tone=warning]]:bg-(--rte-tone-warning-background) " +
  "[&_[data-block=wrapper][data-tone=warning]]:border-(--rte-tone-warning-border) " +
  "[&_[data-block=wrapper][data-tone=danger]]:bg-(--rte-tone-danger-background) " +
  "[&_[data-block=wrapper][data-tone=danger]]:border-(--rte-tone-danger-border)";

/**
 * Сворачиваемый Блок (Details): в Просмотре — родной `details > summary` с
 * `div[data-type=detailsContent]`, в Редакторе — `div[data-type=details]` с
 * кнопкой раскрытия, заголовком `summary` и содержимым в обёртке (представление
 * узла Tiptap). Рамка, отступы и ритм Блоков внутри — одни в обоих видах, чтобы
 * читатель видел то, что набирал автор.
 *
 * ПРОСМОТР — БЕЗ JAVASCRIPT. Раскрывает и скрывает сам браузер, маркер
 * `summary` — его, родной: он доступен скринридеру и с клавиатуры (Tab, Enter,
 * Space) без единой строки кита. Свёрнутое содержимое прячет `details`, а не
 * наше правило.
 *
 * РЕДАКТОР. Маркер `summary` снят (`list-none`): его заменяет кнопка слева,
 * шеврон которой рисует CSS (`border-r` + `border-b`, повёрнутые на 45°), а
 * раскрытость — класс `is-open` на `div`. Кнопка — настоящий `button` с именем
 * из каталога и `aria-expanded`. Скрытое содержимое прячет атрибут `hidden`,
 * который ставит само представление Tiptap.
 */
const DETAILS_BOX =
  "[&_:is(details,div[data-type=details])]:rounded-(--rte-radius) " +
  "[&_:is(details,div[data-type=details])]:border [&_:is(details,div[data-type=details])]:border-(--rte-hr) " +
  "[&_:is(details,div[data-type=details])]:px-3 [&_:is(details,div[data-type=details])]:py-2 " +
  "[&_summary]:font-medium [&_details>summary]:cursor-pointer " +
  "[&_div[data-type=detailsContent]>*:not(:last-child)]:mb-3 " +
  "[&_div[data-type=detailsContent]>:is(h1,h2,h3,h4):not(:first-child)]:mt-6 " +
  "[&_details[open]>summary]:mb-2 ";

const DETAILS_EDITOR =
  "[&_div[data-type=details]]:flex [&_div[data-type=details]]:items-start " +
  "[&_div[data-type=details]]:gap-1.5 " +
  "[&_div[data-type=details]>div]:min-w-0 [&_div[data-type=details]>div]:flex-1 " +
  "[&_div[data-type=details]_summary]:list-none " +
  "[&_div[data-type=details].is-open>div>summary]:mb-2 " +
  "[&_div[data-type=details]>button]:relative [&_div[data-type=details]>button]:mt-px " +
  "[&_div[data-type=details]>button]:size-6 [&_div[data-type=details]>button]:shrink-0 " +
  "[&_div[data-type=details]>button]:cursor-pointer [&_div[data-type=details]>button]:rounded-(--rte-radius) " +
  "[&_div[data-type=details]>button]:text-(--rte-secondary) " +
  "[&_div[data-type=details]>button]:before:absolute [&_div[data-type=details]>button]:before:left-1/2 " +
  "[&_div[data-type=details]>button]:before:top-1/2 [&_div[data-type=details]>button]:before:size-1.5 " +
  "[&_div[data-type=details]>button]:before:-translate-x-1/2 [&_div[data-type=details]>button]:before:-translate-y-1/2 " +
  "[&_div[data-type=details]>button]:before:-rotate-45 [&_div[data-type=details]>button]:before:border-r-2 " +
  "[&_div[data-type=details]>button]:before:border-b-2 [&_div[data-type=details]>button]:before:border-current " +
  "[&_div[data-type=details]>button]:before:content-[''] " +
  "[&_div[data-type=details].is-open>button]:before:rotate-45";

const DETAILS_CLASS = DETAILS_BOX + DETAILS_EDITOR;

/**
 * Формулы (Инструмент `mathematics`, ADR-0070): `span[data-type=inline-math]` в строке
 * и `div[data-type=block-math]` Блоком. Вид один в Редакторе и в Просмотре.
 *
 * ИСХОДНИК И ОТРИСОВКА. До отрисовки (Скелет Редактора, `RichTextView` без JS и до
 * Острова) внутри элемента стоит исходный LaTeX текстом, и такой элемент — без
 * `.katex` внутри — красится моноширинным: автор видит, где формула, а читатель
 * читает исходник. Отрисованная формула — разметка KaTeX, ей своего шрифта не
 * нужно: его несёт CSS KaTeX. Формула с ошибкой (`inline-math-error`,
 * `block-math-error` у вида узла, `data-math-error` у Острова) остаётся исходником
 * — он моноширинный по тому же правилу — и подчёркнута волной цветом ошибки.
 *
 * БЛОК. Центрируется и прокручивается по горизонтали, если шире Документа; поля
 * `.katex-display` сняты, ритм Блоков задаёт Документ. Исходник блока — слева и с
 * переносами строк, как набрал автор.
 *
 * РЕДАКТОР. Вид узла (`tiptap-mathematics-render--editable`) кликабелен: щелчок
 * открывает Поповер, наведение подсвечивает. Выбранная стрелками формула
 * обведена — на ней работает Enter.
 */
const MATH_CLASS =
  "[&_:is(span[data-type=inline-math],div[data-type=block-math]):not(:has(.katex))]:font-mono " +
  "[&_:is(span[data-type=inline-math],div[data-type=block-math]):not(:has(.katex))]:text-[0.9em] " +
  "[&_div[data-type=block-math]]:overflow-x-auto [&_div[data-type=block-math]]:py-1 " +
  "[&_div[data-type=block-math]]:text-center " +
  "[&_div[data-type=block-math]:not(:has(.katex))]:text-left " +
  "[&_div[data-type=block-math]:not(:has(.katex))]:whitespace-pre-wrap " +
  "[&_.katex-display]:my-0 " +
  "[&_:is(.inline-math-error,.block-math-error,[data-math-error])]:text-(--rte-text-danger) " +
  "[&_:is(.inline-math-error,.block-math-error,[data-math-error])]:underline " +
  "[&_:is(.inline-math-error,.block-math-error,[data-math-error])]:decoration-wavy " +
  "[&_.tiptap-mathematics-render--editable]:cursor-pointer " +
  "[&_.tiptap-mathematics-render--editable]:rounded-(--rte-radius) " +
  "[&_.tiptap-mathematics-render--editable:hover]:bg-(--rte-control-hover) " +
  "[&_.tiptap-mathematics-render.ProseMirror-selectednode]:outline-2 " +
  "[&_.tiptap-mathematics-render.ProseMirror-selectednode]:outline-(--rte-ring) ";

/**
 * Невидимые символы (Инструмент `invisibleCharacters`): расширение Tiptap
 * вставляет в разметку виджеты `span.tiptap-invisible-character` с модификатором
 * `--space`, `--break` или `--paragraph`; пустой `span` несёт знак в `::before`.
 * Собственный CSS расширения кит не подключает (`injectCSS: false`) и рисует
 * знаки сам, токенами.
 *
 * НЕ ДВИГАЮТ ТЕКСТ. Знак — `inline-block` нулевой ширины, а высота строки — `1em`,
 * поэтому перенос строк и высота абзацев такие же, как со скрытыми знаками.
 * Выделение и мышь знаки не видят (`select-none`, `pointer-events-none`), копирование
 * их не берёт: их нет в Документе. Цвет — приглушённый (`--rte-muted-foreground`),
 * а на тонированной Обёртке он уже пересчитан под её фон (`WRAPPER_CLASS`).
 *
 * В пустом первом абзаце знак абзаца скрыт: его место занимает подсказка поля
 * (`is-editor-empty`, `RichTextEditor.tsx`), и «¶» лёг бы поверх её текста.
 * Знаки в Просмотре не появляются: класса там нет ни у кого.
 */
const INVISIBLE_CHARACTERS_CLASS =
  "[&_.tiptap-invisible-character]:pointer-events-none [&_.tiptap-invisible-character]:select-none " +
  "[&_.tiptap-invisible-character]:before:inline-block [&_.tiptap-invisible-character]:before:w-0 " +
  "[&_.tiptap-invisible-character]:before:font-normal [&_.tiptap-invisible-character]:before:not-italic " +
  "[&_.tiptap-invisible-character]:before:leading-none " +
  "[&_.tiptap-invisible-character]:before:text-(--rte-muted-foreground) " +
  "[&_.tiptap-invisible-character--space]:before:content-['·'] " +
  "[&_.tiptap-invisible-character--break]:before:content-['↵'] " +
  "[&_.tiptap-invisible-character--paragraph]:before:content-['¶'] " +
  "[&_p.is-editor-empty:first-child>.tiptap-invisible-character--paragraph]:hidden ";

/**
 * Свой Блок потребителя (ADR-0058, п. 3.2): `div[data-block]` с
 * именем, которого нет у кита. Кит даёт ему ритм абзаца и больше ничего — вид
 * задаёт CSS потребителя по `data-block` и токенам кита. Сам Блок отступ уже
 * получает как любой Блок своего места (`[&>*:not(:last-child)]:mb-3` и
 * соседи); здесь — Блоки ВНУТРИ своего Блока-контейнера, с тем же ритмом, что
 * в Документе и Обёртке. Иначе абзацы контейнера слипались бы.
 *
 * ТОЛЬКО БЛОКИ, А НЕ ЛЮБОЙ РЕБЁНОК. У своего Блока со строчным содержимым
 * дети — текст, Метки и атомы, и правило `>*` дало бы отступ атому, которому
 * CSS потребителя поставил `inline-block`. Блоки Документа — теги Схемы кита и
 * `div` (свои Блоки и контейнеры кита).
 *
 * ПОЧЕМУ ПЕРЕЧЕНЬ ИМЁН КИТА, А НЕ «ИМЯ С ПОДЧЁРКИВАНИЕМ». Своё имя отличает
 * подчёркивание (Префикс потребителя), но `_` в произвольном варианте Tailwind
 * читает как пробел, а экранирование ломает класс (`tests/rich-text-view.test.tsx`).
 * Раскладка исключена — её дети колонки сетки, Обёртка и колонка имеют то же
 * правило своё.
 */
const CUSTOM_BLOCK_CLASS =
  "[&_div[data-block]:not([data-block=layout],[data-block=column],[data-block=wrapper])>:is(p,h1,h2,h3,h4,ul,ol,blockquote,hr,pre,table,figure,div):not(:last-child)]:mb-3 " +
  "[&_div[data-block]:not([data-block=layout],[data-block=column],[data-block=wrapper])>:is(h1,h2,h3,h4):not(:first-child)]:mt-6";

/**
 * Типографика Документа — общая для Редактора и будущего `RichTextView`.
 *
 * ОДИН МОДУЛЬ НА ДВОИХ, потому что обещание спеки — «текст в Редакторе и на
 * странице выглядит одинаково». Две копии классов разошлись бы на первой же
 * правке отступа, и заметил бы это только автор, открывший документ после
 * сохранения.
 *
 * КЛАССЫ ВЕШАЮТСЯ НА КОНТЕЙНЕР и находят теги по имени (`[&_h2]:…`), а не на
 * узлы Документа. Оригинал помечал узлы классами (`heading-node`, `list-node`),
 * и они уезжали в сохранённый HTML — в базу потребителя и в белый список его
 * санитайзера. Здесь HTML остаётся чистым, а оформление живёт снаружи.
 *
 * Отступы между Блоками — только у прямых детей контейнера и внутри цитаты:
 * правило «у всех, кроме последнего» на любой глубине раздвигало бы абзацы
 * внутри пункта списка.
 *
 * Модуль серверно-безопасен: строка классов, без React и без движка.
 */
const PROSE_RULES =
  "text-(--rte-foreground) text-md leading-6 break-words " +
  // Выделение текста и фокус контролов внутри Документа — ролями `--rte-*`, а
  // не глобальными правилами `styles.css` (`::selection` красит текст в
  // `--text-primary`, `:focus-visible` — контур в `--accent-strong`): на
  // светлом листе в тёмном приложении те дали бы светлый текст на светлом
  // выделении и бледный контур на белом.
  "selection:bg-(--rte-selection) selection:text-(--rte-foreground) " +
  "[&_:focus-visible]:outline-(--rte-ring) " +
  COLOR_CLASS +
  CODE_THEME_CLASS +
  // Блоки верхнего уровня и внутри цитаты.
  "[&>*:not(:last-child)]:mb-3 [&_blockquote>*:not(:last-child)]:mb-2 " +
  // Заголовки. H1 — только у Документа с инструментом `heading1`:
  // одна типографика для Редактора и `RichTextView`, ступенью выше H2.
  "[&_:is(h1,h2,h3,h4)]:font-semibold [&>:is(h1,h2,h3,h4):not(:first-child)]:mt-6 " +
  "[&_h1]:text-2xl [&_h2]:text-xl [&_h3]:text-lg [&_h4]:text-md " +
  // Списки: маркеры снимает preflight Tailwind, здесь они возвращаются.
  "[&_:is(ul,ol)]:pl-6 [&_ul]:list-disc [&_ol]:list-decimal " +
  "[&_ul_ul]:list-[circle] [&_ol_ol]:list-[lower-alpha] [&_li+li]:mt-1 " +
  // Цитата: полоса слева вместо псевдоэлемента оригинала — тот же вид без
  // `position: relative` на каждом Блоке.
  "[&_blockquote]:border-l-4 [&_blockquote]:border-(--rte-quote) [&_blockquote]:pl-3.5 " +
  "[&_blockquote]:text-(--rte-secondary) " +
  "[&_hr]:my-4 [&_hr]:h-0.5 [&_hr]:border-0 [&_hr]:bg-(--rte-hr) " +
  // Ссылка — как `Link variant="inline"` кита: акцентом и ВСЕГДА с
  // подчёркиванием. Ссылка внутри абзаца, отличная от текста одним цветом,
  // для дальтоника не отличается ничем (WCAG 1.4.1).
  "[&_a]:text-(--rte-link) [&_a]:underline [&_a]:underline-offset-2 " +
  "[&_code]:rounded-(--rte-radius) [&_code]:border [&_code]:border-(--rte-code-border) " +
  "[&_code]:bg-(--rte-code-background) [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono " +
  "[&_code]:text-[0.9em] " +
  // Блок кода: блоком с прокруткой по горизонтали — длинная строка кода не
  // переносится. Фон и основной цвет — темы подсветки, а не токенов кита
  // (`codeTheme.ts`, ADR-0051): цвета токенов GitHub держат контраст только на
  // своём фоне. Внутренний `code` сбрасывает оформление строчного, иначе рамка
  // рисовалась бы дважды, а шрифт уменьшался бы второй раз.
  "[&_pre]:rounded-(--rte-radius) [&_pre]:border [&_pre]:border-(--rte-code-border) " +
  "[&_pre]:bg-(--rte-code-block-background) [&_pre]:text-(--rte-code-block-foreground) " +
  "[&_pre]:overflow-x-auto [&_pre]:px-3 [&_pre]:py-2 " +
  "[&_pre]:font-mono [&_pre]:text-[0.9em] [&_pre]:leading-5 " +
  "[&_pre_code]:rounded-none [&_pre_code]:border-0 [&_pre_code]:bg-transparent " +
  "[&_pre_code]:p-0 [&_pre_code]:text-[length:inherit] " +
  // Кнопки и подпись в шапке блока кода красятся ролями `--rte-*` в самой
  // шапке (`CODE_HEADER_CLASS`, `codeHeader.ts`).
  // Чек-лист: флажок рядом с текстом пункта вместо маркера. Флажок — родной
  // `input` движка, цвет — акцентом через `accent-color`. Выполненный пункт
  // зачёркнут и приглушён до `fg-2`, а не `fg-3`: на `bg-2` третья ступень не
  // держит 4.5, а текст пункта остаётся текстом, который читают.
  //
  // Пункт ищется как ребёнок `ul[data-type=taskList]`, а не по своему
  // `data-type`: в сохранённом HTML атрибут у пункта есть, а в Редакторе его
  // рисует представление узла движка — и `data-type` на `li` не ставит.
  // `relative` — опора для скрытой подписи флажка, которую движок
  // позиционирует абсолютно.
  "[&_ul[data-type=taskList]]:list-none [&_ul[data-type=taskList]]:pl-1 " +
  "[&_ul[data-type=taskList]>li]:relative [&_ul[data-type=taskList]>li]:flex " +
  "[&_ul[data-type=taskList]>li]:items-start [&_ul[data-type=taskList]>li]:gap-2 " +
  "[&_ul[data-type=taskList]>li>label]:mt-[5px] [&_ul[data-type=taskList]>li>label]:flex " +
  "[&_ul[data-type=taskList]>li>label]:shrink-0 " +
  "[&_ul[data-type=taskList]>li>div]:min-w-0 [&_ul[data-type=taskList]>li>div]:flex-1 " +
  "[&_li[data-checked=true]>div]:text-(--rte-muted) [&_li[data-checked=true]>div]:line-through " +
  "[&_input[type=checkbox]]:size-3.5 [&_input[type=checkbox]]:cursor-pointer " +
  "[&_input[type=checkbox]]:accent-(--rte-primary) " +
  // Картинка: по центру, не шире Документа, своего размера без `data-width`.
  // Ширина пресетом задаётся `figure` — по ней же идёт подпись, — а `img`
  // заполняет её. Селектор через `:has`, потому что атрибут лежит на `img`
  // (Схема: `img[data-width]`), а в Редакторе между `figure` и `img` ещё
  // рамка с ручками.
  //
  // Значение атрибута — В КАВЫЧКАХ. Без них `[data-width=50]` — невалидный
  // селектор (значение без кавычек обязано быть идентификатором, а он не
  // начинается с цифры): браузер правило отбрасывает, а оптимизатор Tailwind
  // молча собирает из него `figure:has()`. Пресеты ширины тогда не работали ни
  // в Редакторе, ни в Просмотре — картинка шла своей шириной.
  "[&_figure]:mx-auto [&_figure]:w-fit [&_figure]:max-w-full " +
  "[&_figure_img]:block [&_figure_img]:h-auto [&_figure_img]:max-w-full " +
  "[&_figure_img]:rounded-(--rte-radius) [&_figure_img[data-width]]:w-full " +
  "[&_figure:has(img[data-width='50'])]:w-1/2 [&_figure:has(img[data-width='75'])]:w-3/4 " +
  "[&_figure:has(img[data-width='100'])]:w-full " +
  // Подпись — `fg-2`, как выполненный пункт чек-листа: на `bg-2` она держит 4.5.
  "[&_figcaption]:mt-1.5 [&_figcaption]:text-center [&_figcaption]:text-sm " +
  "[&_figcaption]:text-(--rte-muted) " +
  TABLE_CLASS +
  " " +
  LAYOUT_CLASS +
  " " +
  WRAPPER_CLASS +
  " " +
  DETAILS_CLASS +
  " " +
  MATH_CLASS +
  INVISIBLE_CHARACTERS_CLASS +
  CUSTOM_BLOCK_CLASS;

/**
 * Типографика Документа — общая для Редактора и `RichTextView` — на токенах
 * темы приложения (`surface="theme"`, по умолчанию).
 */
export const PROSE_CLASS = EDITOR_TOKENS_CLASS + " " + PROSE_RULES;

/**
 * Край листа `surface="paper"`: светлый фон, рамка и тень. Рамка и тень — токены
 * ТЕМЫ ПРИЛОЖЕНИЯ, а не листа: они отделяют лист от того, что вокруг него, и
 * видны на тёмной подложке так же, как на светлой. `scheme-light` — родной
 * флажок чек-листа и полосы прокрутки рисуются светлыми.
 */
export const PAPER_SHEET_CLASS =
  "rounded-(--r-sm) border border-(--line) bg-(--rte-background) px-4 py-3 " +
  "shadow-[var(--shadow-1)] scheme-light";

/** Та же типографика на светлом листе (`surface="paper"`). */
export const PAPER_PROSE_CLASS =
  EDITOR_PAPER_TOKENS_CLASS + " " + PAPER_SHEET_CLASS + " " + PROSE_RULES;

/** Классы контейнера Документа для поверхности. */
export function proseClass(surface: RichTextSurface): string {
  return surface === "paper" ? PAPER_PROSE_CLASS : PROSE_CLASS;
}
