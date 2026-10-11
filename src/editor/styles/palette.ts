/**
 * Палитры цвета текста и маркера Редактора ДАННЫМИ: имена, токены кита и
 * выравнивания.
 *
 * ПАЛИТРЫ ДВЕ, И ИМЁН У НИХ НЕТ ОБЩИХ. Цвет текста — шесть тонов
 * статуса кита; маркер — девять цветов: три ярких и шесть прежних. Оба пишутся в
 * `data-color`, но на разных тегах: `span[data-color]` берёт имя из текстовой
 * палитры, `mark[data-color]` — из палитры маркера. Имя чужой палитры на теге не
 * принимается.
 *
 * ОДНА ТАБЛИЦА НА ЧЕТЫРЕХ ПОТРЕБИТЕЛЕЙ: Схема (`schema.ts`) берёт отсюда белый
 * список имён, расширения (`extensions.ts`) — допустимые значения атрибутов,
 * Панель (`EditorToolbar.tsx`) — набор образцов, а `scripts/contrast.mjs` —
 * пары для проверки контраста. Имя цвета, добавленное в одном месте и
 * забытое в другом, было бы молчаливым дефектом: образец есть, а в сохранённом
 * HTML его нет. Поэтому место одно, а совпадение с классами `prose.ts` сторожит
 * `tests/rich-text-editor-color.test.tsx`.
 *
 * ЗАЧЕМ ИМЕНА, А НЕ ЗНАЧЕНИЯ. В документ уходит `data-color="danger"`, а не
 * `#eea8a0`: значение — дело темы (`dark`, `light`, `dim`), и один и тот же
 * сохранённый текст читается в каждой из них. Имя уезжает в базу потребителя и
 * переживает смену значений токенов.
 *
 * ЦВЕТ ТЕКСТА. `strong`-ступень тона подобрана под 4.5:1 на всех подложках
 * приложения. Оттенки меток (`--label-*`) подбирались под 3:1 (кружок рядом с
 * названием) и на `surface-elevated` в тёмных темах текстом не держат: синий
 * 3.5, красный 3.56. Ценой стала привязка к акценту: `accent` — цвет бренда
 * приложения, а не фиксированный синий. Индиго (`accent-alt`) в список не
 * вошёл: токен не имеет `strong`-ступени и даёт 2.3–3.5:1 текстом.
 *
 * МАРКЕР. Яркий, как настоящий текстовыделитель: жёлтый
 * `#ffea80`, ярко-зелёный `#aaff80`, розовый `#ff80bf`, одинаковые во всех темах
 * (`dark`, `light`, `dim`) и на листе `surface="paper"`. Текст на маркере всегда
 * тёмный — токен `--marker-text` (около 14:1 на жёлтом и зелёном, 7.5:1 на
 * розовом), и порог 4.5:1 держит он, а не `fg-0`. Шесть прежних цветов Notion
 * живут со своими значениями (`--marker-*` компонентного слоя, ADR-0003): у каждой
 * темы своё, и текст на них — основной. Их снова предлагает меню
 * (сетка «Цвет маркера», решение владельца) — см. `EDITOR_MARKERS`. Токен цветом
 * статуса не назван и от акцента с брендом не зависит: `blue` не меняется вслед
 * за `data-accent`.
 *
 * Модуль серверно-безопасен: данные, без React и без движка, и без импортов —
 * `scripts/contrast.mjs` читает его напрямую.
 */
export const EDITOR_TEXT_COLORS = [
  { name: "accent", text: "accent-strong" },
  { name: "success", text: "success-strong" },
  { name: "warning", text: "warning-strong" },
  { name: "danger", text: "danger-strong" },
  { name: "lime", text: "draft-strong" },
  { name: "muted", text: "fg-2" },
] as const;

/** Имя цвета текста: то, что пишется в `span[data-color]`. */
export type EditorTextColorName = (typeof EDITOR_TEXT_COLORS)[number]["name"];

/** Имена цвета текста по порядку палитры — белый список `span[data-color]`. */
export const EDITOR_TEXT_COLOR_NAMES: readonly EditorTextColorName[] = EDITOR_TEXT_COLORS.map(
  (color) => color.name
);

/**
 * Маркер: имя, токен подложки (`--marker-<имя>`) и признак «яркий».
 *
 * ВСЕ ДЕВЯТЬ В МЕНЮ (решение владельца). До того меню предлагало
 * только три ярких, а шесть прежних цветов Notion оставались читаемыми: Схема,
 * `RichTextView` и prose-стили их понимали, но выбрать их было нельзя. Сетка
 * «Цвет маркера» кружками показывает все девять: цвет выбирают глазами, и
 * девять различимых кружков — не перегруз, в отличие от девяти строк меню.
 *
 * ЯРКИЙ — ДРУГОЕ ОФОРМЛЕНИЕ ТЕКСТА. Подложка яркого (жёлтый, зелёный, розовый)
 * одна во всех темах, и текст на нём всегда тёмный — `--marker-text`. Подложки
 * прежних — свои у каждой темы (в тёмных — тёмные), текст на них основной. Это
 * же различает пары в `scripts/contrast.mjs`.
 *
 * Порядок меню — порядок этого массива: по оттенку, как в Notion.
 */
export const EDITOR_MARKERS = [
  { name: "gray", token: "marker-gray", bright: false },
  { name: "brown", token: "marker-brown", bright: false },
  { name: "orange", token: "marker-orange", bright: false },
  { name: "yellow", token: "marker-yellow", bright: true },
  { name: "green", token: "marker-green", bright: true },
  { name: "blue", token: "marker-blue", bright: false },
  { name: "purple", token: "marker-purple", bright: false },
  { name: "pink", token: "marker-pink", bright: true },
  { name: "red", token: "marker-red", bright: false },
] as const;

/** Имя маркера: то, что пишется в `mark[data-color]`. */
export type EditorMarkerName = (typeof EDITOR_MARKERS)[number]["name"];

/** Имена маркера по порядку меню — белый список `mark[data-color]`. */
export const EDITOR_MARKER_NAMES: readonly EditorMarkerName[] = EDITOR_MARKERS.map(
  (marker) => marker.name
);

/** Яркие маркеры: подложка одна во всех темах, текст на ней — `--marker-text`. */
export const EDITOR_BRIGHT_MARKER_NAMES: readonly EditorMarkerName[] = EDITOR_MARKERS.filter(
  (marker) => marker.bright
).map((marker) => marker.name);

/** Прежние маркеры Notion: подложка своя у каждой темы, текст на ней основной. */
export const EDITOR_PALE_MARKER_NAMES: readonly EditorMarkerName[] = EDITOR_MARKERS.filter(
  (marker) => !marker.bright
).map((marker) => marker.name);

/**
 * Имена маркера ДО палитры Notion и их перевод в ближайший цвет.
 *
 * Прежний маркер делил имена с цветом текста и красил подложку `soft`-ступенью
 * тона. Документы, сохранённые тогда, несут на `mark` одно из шести имён, и
 * отбросить их значило бы молча снять подсветку с чужого текста. Поэтому имя
 * переводится при загрузке и вставке, а `RichTextView` красит его тем же цветом
 * (`prose.ts`), если сервер сохранил старый HTML как есть.
 *
 * Перевод — по оттенку подложки, а не по смыслу тона:
 *
 * - `accent` → `blue`: акцент кита синий (у бренда другой, но сохранённый
 *   документ видел синий);
 * - `success` → `green`, `danger` → `red`, `muted` → `gray`: одноимённые цвета;
 * - `warning` → `yellow`: янтарь `warning-soft` ближе к жёлтому Notion, чем к
 *   оранжевому — тот красноватее;
 * - `lime` → `green`: подложка лайма читается зелёной (оттенок 83° лежит между
 *   жёлтым и зелёным, но у `warning` жёлтый уже занят, и слить с ним «черновик»
 *   значило бы отдать ему смысл предупреждения).
 *
 * Работает только на `mark`: на `span` цвета текста не переименовываются.
 */
export const LEGACY_MARKER_NAMES = {
  accent: "blue",
  success: "green",
  warning: "yellow",
  danger: "red",
  lime: "green",
  muted: "gray",
} as const satisfies Record<EditorTextColorName, EditorMarkerName>;

/** Имя маркера из атрибута `mark[data-color]`: новое как есть, старое — переведённое. */
export function markerNameFromAttribute(value: string | null | undefined): EditorMarkerName | null {
  if (value === null || value === undefined) return null;
  if ((EDITOR_MARKER_NAMES as readonly string[]).includes(value)) return value as EditorMarkerName;
  return Object.hasOwn(LEGACY_MARKER_NAMES, value)
    ? LEGACY_MARKER_NAMES[value as keyof typeof LEGACY_MARKER_NAMES]
    : null;
}

/**
 * Выравнивание Блока. `left` — умолчание: атрибут не пишется, и документ без
 * выравнивания остаётся таким, каким был до среза. `justify` намеренно нет:
 * текст «по ширине» без переносов по слогам рвётся «реками» пробелов, а WCAG
 * (1.4.8, AAA) советует его не использовать.
 */
export const EDITOR_ALIGNMENTS = ["left", "center", "right"] as const;

/** Значение `data-align`. */
export type EditorAlignment = (typeof EDITOR_ALIGNMENTS)[number];

/** Выравнивание по умолчанию — то, что не пишется в атрибут. */
export const DEFAULT_ALIGNMENT: EditorAlignment = "left";

/**
 * Выравнивание, которое пишется в Схему, из чужого атрибута: `center` или
 * `right`; `left` (умолчание), `start`, `justify` и прочее — `null`.
 */
function writtenAlignment(value: string | null | undefined): EditorAlignment | null {
  const normalized = value?.trim().toLowerCase();
  return normalized === "center" || normalized === "right" ? normalized : null;
}

/**
 * Выравнивание элемента входящего HTML (`value` и вставка).
 *
 * Своё — `data-align`, точным значением, как его пишет Редактор. Чужое
 * читается тоже, но только переводом в имя Схемы: `style="text-align: …"` (так
 * выравнивают Word, Excel и Google Docs) и устаревший атрибут `align`. Сами
 * `style` и `align` в документ не попадают — на выходе только `data-align`.
 */
export function alignmentFromElement(element: HTMLElement): EditorAlignment | null {
  const own = element.getAttribute("data-align");
  if (own !== null) {
    return (EDITOR_ALIGNMENTS as readonly string[]).includes(own) && own !== DEFAULT_ALIGNMENT
      ? (own as EditorAlignment)
      : null;
  }
  // Разбор строки, а не `element.style`: регистр имени свойства и пробелы
  // вокруг двоеточия CSSOM разных сред (браузер, jsdom, сервер) понимает
  // по-разному, а значение здесь нужно одно.
  const style = /(?:^|;)\s*text-align\s*:\s*([a-z-]+)/i.exec(element.getAttribute("style") ?? "");
  return writtenAlignment(style?.[1]) ?? writtenAlignment(element.getAttribute("align"));
}
