/**
 * Общий словарь пропсов дизайн-системы.
 *
 * До выделения пакета одно и то же понятие называлось в каждом примитиве по-своему:
 * `kind` у Button, `active` у Chip, `status` у StatusBadge, `tone` у Tone. Ниже —
 * единственный допустимый набор имён; новые примитивы берут из него, а не изобретают.
 *
 * Три независимые оси:
 *
 *   size    — размер: одинаково означает одно и то же во всех примитивах
 *   tone    — семантический цвет: «что это значит», а не «как выглядит»
 *   variant — визуальная трактовка тона: насколько заметно он подан
 *
 * Булевы состояния называются `selected`, `disabled`, `loading` — не `active`,
 * не `isOpen`, не `enabled`. Отрицаний в именах не бывает.
 */

/** Размер. Не все примитивы поддерживают все три — но имена значат одно и то же. */
export type Size = "sm" | "md" | "lg";

/**
 * Размер кнопки: общая шкала плюс `xs`.
 *
 * `xs` вынесен из `Size`, а не добавлен в него, и это решение. `Size` —
 * словарь на весь кит: расширь его, и каждый примитив с осью размера начнёт
 * принимать значение, которого не умеет, а компилятор смолчит. Кнопка —
 * единственный заказчик четвёртой ступени, у неё она и живёт.
 */
export type ButtonSize = Size | "xs";

/**
 * Оттенки пользовательских меток: проект, ярлык, категория.
 *
 * Это НЕ тоны. Тон описывает смысл (`danger` — «действие разрушительно»), а
 * метка означает ровно то, что в неё вложил человек. Занимать смысловые тоны
 * под метки нельзя: кружок цвета `danger` рядом с проектом прочитается как
 * ошибка, а тон перестанет значить то, что значит.
 *
 * Имена по оттенку, а не по назначению. Имя уезжает в базу потребителя ключом
 * цвета и переживает смену значений; назначение у каждого потребителя своё, и
 * `label-1` через полгода не скажет никому ничего.
 *
 * Набор закрытый и не зависит ни от акцента, ни от бренда: переключив акцент,
 * пользователь не должен обнаружить, что все его проекты сменили цвет.
 */
export const LABEL_HUES = [
  "blue",
  "violet",
  "teal",
  "green",
  "amber",
  "red",
  "pink",
  "steel",
] as const;

export type LabelHue = (typeof LABEL_HUES)[number];

/**
 * Класс заливки по оттенку.
 *
 * Словарь, а не склейка `bg-label-${hue}`: Tailwind сканирует исходники как
 * текст, и собранного в рантайме класса в CSS не окажется — молча, без ошибки
 * сборки. Тот же запрет, что в `lib/field.ts`.
 */
export const LABEL_BG_CLASS: Record<LabelHue, string> = {
  blue: "bg-label-blue",
  violet: "bg-label-violet",
  teal: "bg-label-teal",
  green: "bg-label-green",
  amber: "bg-label-amber",
  red: "bg-label-red",
  pink: "bg-label-pink",
  steel: "bg-label-steel",
};

/** Класс текста тем же оттенком — для подписи рядом с меткой, не внутри неё. */
export const LABEL_TEXT_CLASS: Record<LabelHue, string> = {
  blue: "text-label-blue",
  violet: "text-label-violet",
  teal: "text-label-teal",
  green: "text-label-green",
  amber: "text-label-amber",
  red: "text-label-red",
  pink: "text-label-pink",
  steel: "text-label-steel",
};

/**
 * Семантический цвет. Описывает смысл, а не оттенок: `danger` — это «действие
 * разрушительно», а не «красный». Поэтому при смене темы или акцента смысл
 * сохраняется, а цвет меняется.
 */
export type Tone = "neutral" | "accent" | "success" | "warning" | "danger";

/**
 * Насколько заметно подан тон.
 *
 *   solid   — заливка цветом тона, текст контрастный
 *   soft    — приглушённая подложка (`*-soft`)
 *   outline — только рамка и текст
 *   ghost   — ни рамки, ни фона; подложка появляется на hover
 */
export type Variant = "solid" | "soft" | "outline" | "ghost";

/**
 * Плотность раскладки: сколько воздуха внутри строки данных.
 *
 * Ось системного уровня, а не таблицы: умолчание задаёт `UiProvider`, а
 * таблица его перекрывает (ADR-0023). Две ступени, а не три: «средняя»
 * плотность неотличима от одной из соседних, и выбор из трёх превращается в
 * гадание.
 */
export type Density = "comfortable" | "compact";

/**
 * Начертание цифр.
 *
 * `tabular` — цифры равной ширины (`font-variant-numeric: tabular-nums`): всё,
 * что тикает, пересчитывается или стоит колонкой, перестаёт ездить вбок при
 * смене знаков. Замер потребителя на Inter, кегль `md`: у строк ОДНОЙ длины
 * («0:00», «0:11», «1:38», «8:21») разбег ширины — 4.65 пикселя, у моноширинных
 * цифр — ноль. То есть секундный таймер ездит туда-сюда на каждом тике.
 *
 * Это НЕ моноширинное начертание: гарнитура остаётся своя, меняется только
 * ширина цифр. Тем, кому нужен второй шрифт (`font-mono`), он ставится отдельно.
 *
 * Ось строковая при единственном значении намеренно: рядом со временем встанут
 * `oldstyle` и `slashed-zero`, если появится заказчик, — и это не потребует
 * второго пропа и не превратит булево `tabular` в ложь.
 */
export type Numeric = "tabular";

/** Класс на каждое значение оси. Строки литеральные — их сканирует Tailwind. */
export const NUMERIC_CLASS: Record<Numeric, string> = {
  tabular: "tabular-nums",
};

/**
 * Атомы тона — готовые классы Tailwind, из которых примитивы собирают свой вид.
 *
 * ВАЖНО: все значения здесь — **литеральные строки целиком**. Tailwind сканирует
 * исходники как текст и не исполняет код, поэтому класс, собранный в рантайме
 * (`hover:${t.bg}`), в CSS не попадёт — молча, без ошибки сборки. По той же
 * причине здесь нет матрицы `variant × tone`, генерируемой на лету: только
 * плоский список готовых строк, каждую из которых сканер видит.
 *
 * Все тона названы полными именами, а не историческими алиасами: `bg-success`,
 * а не `bg-ok`; `bg-danger`, а не `bg-err`; `--accent`, а не телеграмное `--tg`.
 * Значения идентичны (`--ok: var(--success)` и так далее), поэтому вид не
 * меняется — но словарь тонов и словарь классов перестают расходиться в именах.
 * Алиасы остаются в `styles.css` ради фронта, где их ещё десятки.
 */
export interface ToneAtoms {
  /** Текст цветом тона. */
  fg: string;
  /** Приглушённая подложка. */
  bg: string;
  /** Рамка цветом тона. */
  border: string;
  /**
   * Заливка тоном + контрастный текст.
   *
   * Цвет текста здесь НЕ одинаков у всех тонов: `warning` и `success` берут
   * тёмный (`--text-on-warning`/`--text-on-success`), остальные — белый
   * `--text-on-accent`. Белый на жёлтом даёт 1.87 при требуемых 4.5, и это
   * не чинится подбором оттенка. Второе такое отступление после `softFg`
   * у `neutral`; про текст на `warning` и `success` — docs/palette.md.
   */
  solid: string;
  /** Hover для `solid`. */
  solidHover: string;
  /** Hover-подложка для `outline` и `ghost`. */
  softHover: string;
  /**
   * Текст поверх приглушённой подложки в `soft`.
   *
   * Для `neutral` он намеренно контрастнее, чем `fg`: `soft/neutral` — это
   * вторичная кнопка с полноценной подписью, а `ghost`/`outline` того же тона —
   * приглушённые. Один `fg` на оба случая делал подпись вторичной кнопки блёклой.
   */
  softFg: string;
  /** Hover-подложка для `soft`. */
  softBgHover: string;
  /** Сплошная заливка тоном без текста — для точек-индикаторов и полосок. */
  dotBg: string;
  /**
   * Подложка выбранного элемента: пункт меню, опция списка, строка таблицы,
   * отмеченный флажок.
   *
   * Вариант `selected:` — из плагина `tailwindcss-react-aria-components`, и он
   * единственный в этом словаре, у которого нет CSS-эквивалента вовсе:
   * псевдокласса «выбран» в CSS не существует, а элементы react-aria сплошь и
   * рядом отрисованы дивами с ролью, где не сработал бы даже `:checked`.
   * Остальные атомы (`hover:`, `disabled:`) плагин переопределяет на двойной
   * селектор, поэтому их править под RAC не понадобилось — см. `styles.css`.
   */
  selectedBg: string;
  /** Текст выбранного элемента. Пара к `selectedBg`. */
  selectedFg: string;
  /**
   * Подложка в момент удержания — пункт меню под нажатой кнопкой мыши.
   *
   * Отложен от T2 до появления `Menu`, который первым его и рендерит: покрытие
   * классов проверяет только те классы, что есть в разметке примитивов, и атом,
   * который никто не рисует, лежал бы в словаре непроверенным.
   *
   * `pressed:` вместо `active:` — родной `:active` срабатывает и на мыши, но
   * react-aria ставит `data-pressed` одинаково для мыши, касания и клавиатуры,
   * а `:active` от клавиши не срабатывает вовсе.
   */
  pressedBg: string;
}

/**
 * Рамка поля, не прошедшего валидацию.
 *
 * Вне словаря тонов намеренно: «невалидно» — это всегда `danger`, независимо от
 * того, каким тоном покрашен сам контрол. Поле в таблице тонов, одинаковое во
 * всех пяти строках, — это константа, притворившаяся осью.
 */
export const INVALID_BORDER_CLASS = "invalid:border-danger-strong";

export const TONE_TOKENS: Record<Tone, ToneAtoms> = {
  neutral: {
    fg: "text-fg-1",
    bg: "bg-bg-2",
    border: "border-line",
    solid: "bg-bg-4 text-fg-0",
    solidHover: "hover:bg-bg-3",
    softHover: "hover:bg-bg-2",
    softFg: "text-fg-0",
    softBgHover: "hover:bg-bg-3",
    dotBg: "bg-fg-3",
    selectedBg: "selected:bg-bg-3",
    selectedFg: "selected:text-fg-0",
    pressedBg: "pressed:bg-bg-4",
  },
  accent: {
    fg: "text-accent-strong",
    bg: "bg-accent-soft",
    border: "border-accent-strong",
    solid: "bg-accent text-text-on-accent",
    // Единственный тон с собственным hover-токеном; остальные гасятся прозрачностью.
    solidHover: "hover:bg-accent-hover",
    softHover: "hover:bg-accent-soft",
    softFg: "text-accent-strong",
    softBgHover: "hover:opacity-90",
    dotBg: "bg-accent-strong",
    selectedBg: "selected:bg-accent-soft",
    selectedFg: "selected:text-accent-strong",
    pressedBg: "pressed:bg-accent-soft",
  },
  success: {
    fg: "text-success-strong",
    bg: "bg-success-soft",
    border: "border-success-strong",
    // Не `text-on-accent`: белый на зелёном даёт 2.61. См. docs/palette.md.
    solid: "bg-success text-text-on-success",
    solidHover: "hover:opacity-90",
    softHover: "hover:bg-success-soft",
    softFg: "text-success-strong",
    softBgHover: "hover:opacity-90",
    dotBg: "bg-success-strong",
    selectedBg: "selected:bg-success-soft",
    selectedFg: "selected:text-success-strong",
    pressedBg: "pressed:bg-success-soft",
  },
  warning: {
    fg: "text-warning-strong",
    bg: "bg-warning-soft",
    border: "border-warning-strong",
    // Не `text-on-accent`: белый на жёлтом даёт 1.87 и не чинится подбором оттенка.
    solid: "bg-warning text-text-on-warning",
    solidHover: "hover:opacity-90",
    softHover: "hover:bg-warning-soft",
    softFg: "text-warning-strong",
    softBgHover: "hover:opacity-90",
    dotBg: "bg-warning-strong",
    selectedBg: "selected:bg-warning-soft",
    selectedFg: "selected:text-warning-strong",
    pressedBg: "pressed:bg-warning-soft",
  },
  danger: {
    fg: "text-danger-strong",
    bg: "bg-danger-soft",
    border: "border-danger-strong",
    solid: "bg-danger text-text-on-accent",
    solidHover: "hover:opacity-90",
    softHover: "hover:bg-danger-soft",
    softFg: "text-danger-strong",
    softBgHover: "hover:opacity-90",
    dotBg: "bg-danger-strong",
    selectedBg: "selected:bg-danger-soft",
    selectedFg: "selected:text-danger-strong",
    pressedBg: "pressed:bg-danger-soft",
  },
};

/**
 * Рамка признака состояния «выбрано / отмечено».
 *
 * Отдельный словарь, а не `TONE_TOKENS[tone].border`: у `neutral` там
 * `border-line` — рамка-разделитель, которую гейт контраста пропускает как
 * декоративную. Рамка признака состояния несёт смысл и держит 3:1 по WCAG
 * 1.4.11, поэтому у `neutral` здесь `fg-3`, у остальных — те же `*-strong`.
 *
 * Зачем она отмеченному флажку и включённому `Toggle`: их заливка (`solid`,
 * `bg-accent`) против подложки даёт 1.07–2.9 — у четырёх тонов из пяти, в
 * тёмных темах на `surface-elevated` и в светлой у `neutral`/`warning`. Менять
 * значения токенов ради этого — заметное изменение вида всего кита, поэтому
 * границу компонента отдаёт рамка: она и отделяет коробку от подложки. Галочка
 * на заливке проходит порог сама (пары `solid/<тон> — text`).
 *
 * Литеральные строки целиком: Tailwind сканирует исходники как текст.
 * `scripts/contrast.mjs` читает этот словарь и меряет каждую запись против
 * подложек приложения и против карточки — `bg-2`.
 */
export const STATE_BORDER: Record<Tone, string> = {
  neutral: "border-fg-3",
  accent: "border-accent-strong",
  success: "border-success-strong",
  warning: "border-warning-strong",
  danger: "border-danger-strong",
};

/** Классы для пары `variant` + `tone`. Общая логика для всех примитивов с обеими осями. */
export function variantClasses(variant: Variant, tone: Tone): string {
  const t = TONE_TOKENS[tone];
  switch (variant) {
    case "solid":
      return `border-transparent ${t.solid} ${t.solidHover}`;
    case "soft":
      // Рамка и контрастный текст — не украшение: без них вторичная кнопка
      // сливается с фоном панели. Воспроизводит прежний kind="ghost".
      return `${t.border} ${t.bg} ${t.softFg} ${t.softBgHover}`;
    case "outline":
      return `${t.border} ${t.fg} bg-transparent ${t.softHover}`;
    case "ghost":
      return `border-transparent ${t.fg} bg-transparent ${t.softHover}`;
  }
}
