/**
 * Проверка контраста токенов по WCAG 2.x.
 *
 * Зачем отдельно от аддона a11y в Storybook: аддон проверяет отрендеренный DOM
 * конкретных историй и видит только те сочетания, которые история показала.
 * Здесь перебираются ВСЕ сочетания `variant × tone × тема × акцент`, включая
 * ещё не отрендеренные. Расхождение в числах между двумя инструментами —
 * не противоречие: они измеряют разное.
 *
 * Пары берутся из `variantClasses()`, то есть из реального вывода словаря,
 * а не из списка, переписанного руками. Список, переписанный руками, уже
 * отставал от кода: после правки `soft` в 0.1.1 у него изменился состав.
 *
 * Импорт `.ts` напрямую — Node снимает типы сам (без флага с 22.18). Нижняя
 * граница по Node в этом пакете и так выше: Storybook 10 требует 22.19+.
 *
 *   node scripts/contrast.mjs          только провалы
 *   node scripts/contrast.mjs --all    вся таблица
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { STATE_BORDER, TONE_TOKENS, variantClasses } from "../src/lib/variants.ts";
import { CHOICE_CARD_SELECTED_BORDER } from "../src/lib/choice-card.ts";
import { EDITOR_MARKERS, EDITOR_TEXT_COLORS } from "../src/editor/styles/palette.ts";
import { EDITOR_PAPER_TOKENS_CLASS, EDITOR_TOKENS_CLASS } from "../src/editor/styles/tokens.ts";
import { EDITOR_WRAPPER_TONES } from "../src/editor/features/wrapper/wrapperTones.ts";

const ROOT = resolve(import.meta.dirname, "..");

/**
 * Рамка выбранной карточки и рамка отмеченной коробки внутри неё — один признак
 * одного цвета, но словарей два: `choice-card.ts` не может импортировать
 * `variants.ts` в рантайме (Node не сопоставляет `.js` с `.ts`). Расхождение
 * словарей гейт ловит здесь, а не комментарием.
 */
for (const [tone, cls] of Object.entries(STATE_BORDER))
  if (CHOICE_CARD_SELECTED_BORDER[tone] !== cls)
    throw new Error(
      `CHOICE_CARD_SELECTED_BORDER.${tone} (${CHOICE_CARD_SELECTED_BORDER[tone]}) differs from ` +
        `STATE_BORDER.${tone} (${cls}) — the selected card and its checked box must share one colour.`
    );
const css = readFileSync(resolve(ROOT, "styles.css"), "utf8");

/** Текст — 4.5:1. Весь текст в примитивах мельче 18.66px bold / 24px, послаблений нет. */
const TEXT = 4.5;
/** Рамки, точки-индикаторы, иконки-индикаторы — 3:1, WCAG 1.4.11 Non-text Contrast. */
const NON_TEXT = 3;

/**
 * ВСЕ подложки приложения, а не только две. Считаем по худшей из четырёх:
 * `*-soft` полупрозрачны, и на более светлой подложке тот же токен даёт
 * меньший контраст, чем на фоне приложения.
 *
 * **Список был из двух — `surface-app` и `surface-panel` — и это стоило двух
 * пропущенных дефектов.** Оба нашёл аудит axe во фронте, пока скрипт рапортовал
 * ноль провалов: счётчик символов `TextControl` и подсказка `FormField`.
 * Расширение до четырёх вскрыло ещё 36 сочетаний, и они не бумажные — плашка
 * `StatusBadge` тона `warning` в карточке деталей давала живые 4.42.
 *
 * Закрыто перекалибровкой палитры 2026-08-06: тринадцать токенов (`*-strong`
 * у четырёх тонов, `text-muted`, `text-muted-2`) сдвинуты до порога 4.6 —
 * с запасом, потому что ровно 4.50 браузер округляет в 4.49. Решение
 * пользователя: приложение стало заметно контрастнее, тона в тёмных темах
 * светлее.
 *
 * Добавлять сюда новую подложку — значит проверять её честно. Если появится
 * пятая, гейт покраснеет, и это правильно.
 */
const SURFACES = ["surface-app", "surface-panel", "surface-panel-hover", "surface-elevated"];

/**
 * Токены, к которым порог не применяется.
 *
 * `line` (`--border-default`) — нейтральная рамка и разделитель. WCAG 1.4.11
 * требует 3:1 от границ, *необходимых для опознания* компонента; `soft` опознаётся
 * заливкой и контрастной подписью, а карточки и разделители — расположением.
 * Дотянуть его до 3:1 значило бы `#d9e2ec → #7192b8` в светлой теме, то есть
 * сделать резкими все рамки приложения разом. Решение пользователя, 2026-07-25.
 *
 * Рамки ТОНОВ (`accent`, `danger`, `warning`, `success`) под порогом остаются:
 * они несут смысл, а не отделяют блок от блока.
 */
const DECORATIVE = new Set(["line", "line-soft"]);

const THEMES = ["dark", "light", "dim"];
const ACCENTS = ["blue", "violet"];

/**
 * Бренды. `base` — кит без атрибута `data-brand`, остальные приходят оверлеями.
 *
 * Список написан руками НАМЕРЕННО и сверяется с CSS ниже: бренд, объявленный в
 * `styles.css` и забытый здесь, роняет скрипт. Автоподхват выглядел бы удобнее
 * и был бы хуже — гейт молча измерял бы не то, что отгружается. Ровно так уже
 * терялись пары: цветной токен жил в CSS, а проверка его не видела.
 */
const BRANDS = ["base", "teal"];

// ─── разбор styles.css ────────────────────────────────────────────────────────

/** Тело блока по селектору. Скобки считаются: внутри `@theme` лежат `@keyframes`. */
function blockBody(pattern) {
  const m = css.match(pattern);
  if (!m) throw new Error(`styles.css has no block ${pattern}`);
  let i = css.indexOf("{", m.index) + 1;
  const start = i;
  for (let depth = 1; depth > 0; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}") depth--;
  }
  return css.slice(start, i - 1);
}

function decls(body) {
  const out = {};
  for (const m of body.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}

/** Мост «утилита Tailwind → токен»: `--color-accent-soft: var(--accent-soft)`. */
const themeBridge = decls(blockBody(/@theme\s*\{/));

/**
 * Токены маркера Редактора живут в своих блоках на `[data-theme]` ЛЮБОГО
 * элемента (вложенная тема, OLDSUI-46), а не на `:root[data-theme]`: тёмные
 * значения — у `:root` и любой темы, кроме `light`, светлые — у `light`. Здесь они
 * добавляются к базе и к светлой теме, как если бы стояли в их блоках.
 */
const MARKER_DARK = decls(blockBody(/:root,\s*\[data-theme\]:not\(\[data-theme="light"\]\)\s*\{/));
const MARKER_LIGHT = decls(blockBody(/^\[data-theme="light"\]\s*\{/m));
/**
 * Яркие маркеры и тёмный текст на них (OLDSUI-61): один блок на `:root` и любую
 * тему, значение у всех тем общее, поэтому здесь они добавляются к базе, а не к
 * тёмной или светлой теме.
 */
const MARKER_BRIGHT = decls(blockBody(/^:root,\s*\[data-theme\]\s*\{/m));

const BASE = { ...decls(blockBody(/:root\s*\{/)), ...MARKER_DARK, ...MARKER_BRIGHT };
const THEME_VARS = {
  dark: {},
  light: { ...decls(blockBody(/:root\[data-theme="light"\]\s*\{/)), ...MARKER_LIGHT },
  dim: decls(blockBody(/:root\[data-theme="dim"\]\s*\{/)),
};
const ACCENT_VARS = {
  blue: {},
  violet: decls(blockBody(/:root\[data-accent="violet"\]\s*\{/)),
};

/**
 * Блоки, где тема и акцент перестают быть независимыми. Такой блок специфичнее
 * и стоит в CSS после обоих, поэтому и здесь накладывается последним.
 */
const COMBINED = {
  "light/violet": decls(blockBody(/:root\[data-theme="light"\]\[data-accent="violet"\]\s*\{/)),
};

/**
 * Оверлеи брендов. Бренд объявляет свои примитивы внутри своего блока, поэтому
 * `decls` забирает и палитру, и присвоения ролей — `resolveVar` дальше проходит
 * ту же цепочку, что и в базе.
 */
const BRAND_VARS = {
  base: {},
  teal: decls(blockBody(/:root\[data-brand="teal"\]\s*\{/)),
};

/** Блоки, где бренд и тема перестают быть независимыми — как у акцента выше. */
const BRAND_COMBINED = {
  "light/teal": decls(blockBody(/:root\[data-theme="light"\]\[data-brand="teal"\]\s*\{/)),
};

/**
 * Сверка списка с содержимым CSS. Бренд, добавленный в `styles.css` и не
 * внесённый сюда, не должен пройти молча: гейт обязан либо мерить его, либо
 * упасть.
 */
const declaredBrands = [
  ...new Set([...css.matchAll(/\[data-brand="([\w-]+)"\]/g)].map((m) => m[1])),
];
const unmeasured = declaredBrands.filter((b) => !BRANDS.includes(b));
if (unmeasured.length) {
  throw new Error(
    `Brand(s) ${unmeasured.map((b) => `"${b}"`).join(", ")} are declared in styles.css but absent from BRANDS ` +
      `in scripts/contrast.mjs. The gate would not measure them — add the brand to BRANDS and to BRAND_VARS.`
  );
}

/**
 * Роли `--rte-*` Документа в теме приложения (`EDITOR_TOKENS_CLASS`): классы на
 * контейнере Документа, а не блок `styles.css`. Значения — ссылки на токены
 * кита, поэтому их можно класть к любой теме: `resolveVar` дойдёт по ссылке до
 * значения темы. Пары тона Обёртки (OLDSUI-78) меряют роли, а не токены: что
 * стоит в строке классов, то и проверяется.
 */
const rteRoles = (classes, pattern) =>
  Object.fromEntries([...classes.matchAll(pattern)].map((m) => [m[1], m[2]]));
/** Вторичный текст в Обёртке с тоном: роли `--rte-tone-<роль>` (`tokens.ts`). */
const TONE_TEXT_ROLES = ["link", "secondary", "muted", "muted-foreground"];

const THEME_ROLES = rteRoles(EDITOR_TOKENS_CLASS, /(?:^|\s)\[--(rte-[\w-]+):([^\]]+)\]/g);

/**
 * Порядок наложения повторяет каскад в CSS: база → тема → акцент → пара
 * «тема + акцент» → бренд → пара «тема + бренд». Бренд идёт ПОСЛЕ акцента,
 * потому что в файле его блок стоит ниже при равной специфичности — заданный
 * бренд отменяет ось акцента целиком.
 */
const varsFor = (theme, accent, brand) => ({
  ...THEME_ROLES,
  ...BASE,
  ...THEME_VARS[theme],
  ...ACCENT_VARS[accent],
  ...(COMBINED[`${theme}/${accent}`] ?? {}),
  ...BRAND_VARS[brand],
  ...(BRAND_COMBINED[`${theme}/${brand}`] ?? {}),
});

function resolveVar(name, vars, depth = 0) {
  if (depth > 10) throw new Error(`Circular reference to --${name}`);
  const value = vars[name];
  if (value === undefined) throw new Error(`Token --${name} is not declared in any theme`);
  const ref = value.match(/^var\(--([\w-]+)\)$/);
  return ref ? resolveVar(ref[1], vars, depth + 1) : value;
}

// ─── цвет ─────────────────────────────────────────────────────────────────────

const TRANSPARENT = { r: 0, g: 0, b: 0, a: 0 };

function parseColor(value) {
  const hex = value.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const h =
      hex[1].length === 3
        ? hex[1]
            .split("")
            .map((c) => c + c)
            .join("")
        : hex[1];
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
      a: 1,
    };
  }
  const fn = value.match(/^rgba?\(([^)]+)\)$/);
  if (fn) {
    const [r, g, b, a = "1"] = fn[1].split(/[,/]/).map((p) => p.trim());
    return { r: +r, g: +g, b: +b, a: +a };
  }
  throw new Error(`Could not parse colour: ${value}`);
}

/**
 * Альфа-композит: полупрозрачный `fg` поверх непрозрачного `bg`.
 *
 * Каналы округляются до целых — как их округляет браузер, прежде чем показать.
 * Без округления расчёт расходится с axe примерно на 0.02, и токен, подобранный
 * «ровно на 4.50», в браузере оказывается 4.49. Один раз так и вышло: скрипт
 * был зелёный, axe на том же элементе — красный.
 */
const composite = (fg, bg) => ({
  r: Math.round(fg.a * fg.r + (1 - fg.a) * bg.r),
  g: Math.round(fg.a * fg.g + (1 - fg.a) * bg.g),
  b: Math.round(fg.a * fg.b + (1 - fg.a) * bg.b),
  a: 1,
});

function luminance({ r, g, b }) {
  const ch = (v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
}

function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Цвет по классу Tailwind: `bg-accent-soft` → `--color-accent-soft` → `--accent-soft`. */
function colorOfClass(className, vars) {
  if (className === "bg-transparent") return TRANSPARENT;
  // Прямая ссылка на переменную: `bg-(--marker-gray)` — маркер читает токен без
  // моста `@theme` (мост подставил бы значение корня во вложенной теме).
  const direct = className.match(/^(?:bg|text|border)-\(--([\w-]+)\)$/);
  if (direct) return parseColor(resolveVar(direct[1], vars));
  // Модификатор непрозрачности Tailwind: `bg-label-red/25` — токен с альфой 25 %.
  const [utility, opacity] = className.split("/");
  const name = utility.replace(/^(bg|text|border)-/, "");
  const bridged = themeBridge[`color-${name}`];
  if (bridged === undefined) throw new Error(`Class ${className} leads to no token`);
  const ref = bridged.match(/^var\(--([\w-]+)\)$/);
  const color = parseColor(ref ? resolveVar(ref[1], vars) : bridged);
  return opacity === undefined ? color : { ...color, a: color.a * (Number(opacity) / 100) };
}

// ─── пары ─────────────────────────────────────────────────────────────────────

/**
 * Худший контраст пары по всем подложкам. Возвращает и подложку — без неё
 * непонятно, что чинить: цвет или место, где примитив стоит.
 */
function worstRatio(fgClass, bgClass, vars) {
  let worst = null;
  for (const surface of SURFACES) {
    const base = parseColor(resolveVar(surface, vars));
    const bg = composite(colorOfClass(bgClass, vars), base);
    const fg = composite(colorOfClass(fgClass, vars), bg);
    const ratio = contrast(fg, bg);
    if (!worst || ratio < worst.ratio) worst = { ratio, surface };
  }
  return worst;
}

/** Токен без префикса утилиты: `border-accent` и `bg-accent` — один и тот же цвет. */
const token = (cls) => cls.replace(/^(bg|text|border)-/, "");

/**
 * Пары из реального вывода словаря.
 *
 * Дедупликация по «род × токен × подложка», а не по классу: `outline` и `ghost`
 * дают одну и ту же пару, а рамка тона и его же точка-индикатор — один цвет на
 * одной подложке, то есть одно вычисление. Иначе таблица распухает строками,
 * которые отличаются только подписью.
 */
function pairs() {
  const out = new Map();
  const add = (kind, required, fgClass, bgClass, label) => {
    if (DECORATIVE.has(token(fgClass))) return;
    const key = `${kind}|${token(fgClass)}|${token(bgClass)}`;
    if (!out.has(key)) out.set(key, { kind, required, fgClass, bgClass, label });
  };

  for (const tone of Object.keys(TONE_TOKENS)) {
    for (const variant of ["solid", "soft", "outline", "ghost"]) {
      const classes = variantClasses(variant, tone)
        .split(/\s+/)
        .filter((c) => !c.startsWith("hover:"));
      const text = classes.find((c) => c.startsWith("text-"));
      const bg = classes.find((c) => c.startsWith("bg-")) ?? "bg-transparent";
      const border = classes.find((c) => c.startsWith("border-") && c !== "border-transparent");

      if (text) add("text", TEXT, text, bg, `${variant}/${tone} — text`);
      // Рамка сравнивается с тем, что снаружи: она отделяет примитив от подложки.
      if (border)
        add("non-text", NON_TEXT, border, "bg-transparent", `${token(border)} — border/indicator`);
    }
    const dot = TONE_TOKENS[tone].dotBg;
    add("non-text", NON_TEXT, dot, "bg-transparent", `${token(dot)} — border/indicator`);

    // Выбранное состояние — отдельная пара, потому что `variantClasses()` её не
    // отдаёт: это не вариант подачи тона, а состояние поверх любого из них.
    // Без этой строки `selected:bg-bg-3` у `neutral` остался бы единственным
    // сочетанием словаря, которое скрипт не видит: у остальных тонов пара
    // совпадает с `soft` и проверяется там, а у нейтрального подложка своя —
    // на шаг темнее, чем hover, иначе выбранное неотличимо от наведённого.
    const strip = (c) => c.replace(/^selected:/, "");
    add(
      "text",
      TEXT,
      strip(TONE_TOKENS[tone].selectedFg),
      strip(TONE_TOKENS[tone].selectedBg),
      `selected/${tone} — text`
    );
  }

  /*
   * Метки пользователя: восемь оттенков, порог нетекстовый.
   *
   * Метка — кружок или полоска рядом с названием, то есть графический признак,
   * а не подпись: WCAG 1.4.11, 3:1. Подпись рядом с ней рисуется обычным
   * текстом на подложке приложения и проверяется своими парами выше.
   *
   * Проверять их обязательно и обязательно во всех темах: набор, подобранный в
   * тёмной, в светлой обычно разваливается — половина оттенков сливается с
   * фоном. Без этих строк комментарий в `styles.css` про «проверяет contrast»
   * был бы обещанием, которого никто не выполняет.
   */
  for (const hue of ["blue", "violet", "teal", "green", "amber", "red", "pink", "steel"])
    add("non-text", NON_TEXT, `bg-label-${hue}`, "bg-transparent", `label/${hue} — indicator`);

  /*
    Рамка выбранной карточки выбора (`appearance="card"`).

    Это признак состояния, а не украшение: WCAG 1.4.11, 3:1. Меряется дважды —
    против подложек приложения (снаружи рамки) и против самой карточки, `bg-2`
    (внутри). Пары `border-<тон>-strong` против подложек уже есть выше, но
    рамка `neutral` у карточки своя (`border-fg-3`, а не `border-line`, который
    гейт пропускает как декоративный), и внутренняя сторона у всех пяти — новый
    контекст. Рядом с рамкой в карточке всегда есть и второй признак — кружок
    или галочка, но порог рамка обязана держать и сама.
  */
  for (const [tone, cls] of Object.entries(CHOICE_CARD_SELECTED_BORDER)) {
    add("non-text", NON_TEXT, cls, "bg-transparent", `card/${tone} — selected border outside`);
    add("non-text", NON_TEXT, cls, "bg-bg-2", `card/${tone} — selected border on the card`);
  }

  /*
    Рамка отмеченной коробки `Checkbox` (и `mixed` — у него та же коробка) и
    включённой дорожки `Toggle`: `STATE_BORDER` из `variants.ts`.

    Отмеченность — признак состояния, WCAG 1.4.11, 3:1. **Заливка отмеченной
    коробки против подложки порога не держит**: `solid/<тон>` даёт 1.07–2.9 у
    четырёх тонов из пяти (`success` проходит), в тёмных темах на
    `surface-elevated` и в светлой у `neutral`/`warning`. Гейт с парами
    «заливка против подложки и против `bg-2`» падал на 48 сочетаниях из 288.
    Значения токенов кита не менялись (заметное изменение вида), поэтому границу
    коробки несёт рамка, и меряется то, что компонент рисует на самом деле:
    рамка против подложек приложения (флажок в строке и в таблице) и против
    `bg-2` — подложки карточки, внутри которой коробка стоит в `appearance="card"`.
    Галочка на заливке меряется парами `solid/<тон> — text` выше.
  */
  for (const [tone, cls] of Object.entries(STATE_BORDER)) {
    add("non-text", NON_TEXT, cls, "bg-transparent", `checkbox/${tone} — checked box edge outside`);
    add("non-text", NON_TEXT, cls, "bg-bg-2", `checkbox/${tone} — checked box edge on the card`);
  }

  /*
    Палитры цвета текста и маркера Редактора (`src/editor/styles/palette.ts`, OLDSUI-46).

    Это текст документа, который читают, — порог текстовый, 4.5:1, на всех
    подложках: Редактор стоит на `bg-2`, а `RichTextView` — на фоне страницы.

    Цвет текста — `strong`-ступень тона прямо на подложке приложения. Маркер —
    непрозрачная подложка `--marker-<имя>`. Три ярких (жёлтый,
    зелёный, розовый) одинаковы во всех темах, и текст на них ВСЕГДА тёмный —
    `--marker-text`, а не `fg-0` темы (OLDSUI-61). Шесть прежних цветов
    Notion сохранили свои значения (светлая пастель, тёмная приглушённая; сумрак
    берёт тёмную) и текст `fg-0`: `mark` с их именем оставляет цвет
    наследуемым. Девять маркеров × три темы × бренд — всё это перебирается
    ниже, как у любой пары. Цветной текст на маркере ДРУГОГО цвета гейт не
    меряет: автор выбрал это сам и видит результат.
  */
  for (const { name, text } of EDITOR_TEXT_COLORS)
    add("text", TEXT, `text-${text}`, "bg-transparent", `editor text colour ${name}`);
  for (const { name, token, bright } of EDITOR_MARKERS)
    add(
      "text",
      TEXT,
      bright ? "text-(--marker-text)" : "text-fg-0",
      `bg-(--${token})`,
      `editor marker ${name} — ${bright ? "dark marker text" : "body text"}`
    );

  // Текстовые токены вне словаря тонов: они задают иерархию подписей.
  for (const [cls, label] of [
    ["text-fg-1", "text-secondary on a surface"],
    ["text-fg-2", "text-muted on a surface"],
    ["text-fg-3", "text-muted-2 on a surface"],
  ])
    add("text", TEXT, cls, "bg-transparent", label);

  /*
    Выделенный текст (OLDSUI-116): глобальный `::selection` и роль
    `--rte-selection` Документа в теме — обе стоят на `--selection`, а текст
    поверх — основной. Заливка выделения теперь плотная (до 45 % альфы), и
    светлый текст на ней в тёмных темах — ровно то, что может упасть ниже 4.5.
    Различимость самой заливки от подложки (1.5–2:1) гейт не меряет: 3:1 там
    не цель, см. `--selection` в `styles.css`.
  */
  add("text", TEXT, "text-fg-0", "bg-(--selection)", "selected text");

  // Те же токены ВНУТРИ поля ввода, на `bg-2`.
  //
  // Это отдельный контекст, а не тот же самый: подложка поля светлее фона
  // страницы, и приглушённый текст, проходящий порог на втором, проваливает
  // его на первой. Ровно так и вышло со счётчиком символов `TextControl` —
  // `text-fg-3` дал 4.0 при требуемых 4.5, и увидел это только аудит axe,
  // потому что скрипт такой пары не знал.
  add("text", TEXT, "text-fg-2", "bg-bg-2", "text-muted inside a field");

  /*
    Приглушённый текст ВНУТРИ КАРТОЧКИ, тоже на `bg-2`.

    Отдельная пара, потому что это отдельный контекст: подсказка `FormField`,
    подпись под значением, вторая строка в блоке — всё это `text-fg-3` как
    ТЕКСТ, а не как значок. Скрипт знал `fg-3` на `bg-2` только с не-текстовым
    порогом (слот иконки, 3:1) и текстовый провал пропускал.

    Нашёл это аудит axe во фронте: подсказка «Необязательно. Укажите сюжет…»
    в блоке загрузки дала 4.0 при требуемых 4.5, и та же пара била по строке
    «Полный доступ» в сайдбаре. Скрипт при этом рапортовал ноль провалов.
  */
  add("text", TEXT, "text-fg-3", "bg-bg-2", "text-muted-2 inside a card");

  // `fg-3` внутри поля — цвет СЛОТА ИКОНКИ (лупа поиска, единица измерения), а
  // не текста, поэтому порог не-текстовый. Текстом внутри поля он не бывает:
  // счётчик символов взял `fg-2` именно потому, что 4.5 на этой подложке не
  // проходил, а плейсхолдер кит не красит вовсе — там цвет браузера.
  add("non-text", NON_TEXT, "text-fg-3", "bg-bg-2", "text-muted-2 — icon inside a field");

  /*
    Тон `draft` — пометка несохранённых правок. Он не в `TONE_TOKENS`: своего
    варианта подачи у него нет, компоненты его не принимают, это палитра для
    прикладного экрана (рамка изменённой карточки и подпись рядом с ней).

    Поэтому пары заводятся руками — иначе токен остался бы единственным цветным
    в `styles.css`, которого гейт не видит. Ровно так уже терялись пары, из-за
    которых ниже стоят три отдельных `add` для `fg-2`/`fg-3`.
  */
  add("text", TEXT, "text-draft-strong", "bg-transparent", "draft-strong — label");
  add("non-text", NON_TEXT, "border-draft-strong", "bg-transparent", "draft-strong — border");
  add("non-text", NON_TEXT, "border-draft", "bg-transparent", "draft — border/indicator");

  /*
    Звезда `Rating` — тот же случай, что и `draft`: собственный токен
    компонентного слоя (ADR-0040), которого нет ни в `TONE_TOKENS`, ни в осях
    компонентов. Без этой пары гейт его не увидел бы вовсе.

    Порог не-текстовый: ряд звёзд несёт величину визуально — это не украшение.
    Незакрашенная звезда взята второй парой: она значит «не выбрано», и отличать
    её от закрашенной надо глазом.
  */
  add("non-text", NON_TEXT, "text-rating-star", "bg-bg-1", "rating-star — filled star");
  add("non-text", NON_TEXT, "text-fg-3", "bg-bg-1", "text-muted-2 — empty star");

  /*
    Инверсная поверхность — меню выделения Редактора (`toolbar="bubble"`,
    OLDSUI-69): светлая плашка в тёмных темах, тёмная в светлой.

    Плашка непрозрачна, поэтому подложка приложения под ней в расчёт не идёт —
    меряется пара «то, что на плашке, — сама плашка» в трёх её состояниях:
    покой, наведение, нажатие (нажатая метка, открытое меню). Подписей в
    плашке нет, только значки, но порог у её текста — текстовый: токен назван
    «текст на инверсной», и подпись на нём обязана читаться. Значки меряются
    отдельно, 3:1 (WCAG 1.4.11). Контур фокуса — `accent-on-inverse`, тоже
    3:1, и тоже на всех трёх подложках: фокус бывает и на нажатой кнопке.
  */
  for (const [bg, state] of [
    ["bg-surface-inverse", "at rest"],
    ["bg-surface-inverse-hover", "hovered"],
    ["bg-surface-inverse-pressed", "pressed"],
  ]) {
    add("text", TEXT, "text-text-on-inverse", bg, `inverse surface ${state} — text`);
    add("non-text", NON_TEXT, "text-text-on-inverse", bg, `inverse surface ${state} — icon`);
    add(
      "non-text",
      NON_TEXT,
      "text-accent-on-inverse",
      bg,
      `inverse surface ${state} — focus ring`
    );
  }

  /*
    Тон Обёртки Редактора (OLDSUI-78): мягкая подложка тона и полоса 3 px слева,
    роли `--rte-tone-<тон>-background` и `-border` (`tokens.ts`).

    Текст на подложке — обычный текст Документа (`--rte-foreground`) и
    вторичный, который Обёртка с тоном берёт ролями `--rte-tone-*`: ссылка,
    цитата, приглушённый (подпись, выполненный пункт, серый цвет текста) и
    подсказка. Порог текстовый, на всех подложках приложения: подложки тонов
    полупрозрачны, и на самой светлой из них контраст меньше. Цвет текста автора
    (палитра и свой цвет) гейт здесь не меряет — выбор автора. Полоса — признак
    тона, WCAG 1.4.11, 3:1, против того, что вокруг Обёртки: подложки приложения
    снаружи и её собственной заливки внутри.
  */
  for (const tone of EDITOR_WRAPPER_TONES) {
    const background = `bg-(--rte-tone-${tone}-background)`;
    const border = `border-(--rte-tone-${tone}-border)`;
    add("text", TEXT, "text-(--rte-foreground)", background, `wrapper tone ${tone} — body text`);
    for (const role of TONE_TEXT_ROLES)
      add("text", TEXT, `text-(--rte-tone-${role})`, background, `wrapper tone ${tone} — ${role}`);
    add("non-text", NON_TEXT, border, "bg-transparent", `wrapper tone ${tone} — stripe outside`);
    add("non-text", NON_TEXT, border, background, `wrapper tone ${tone} — stripe on its fill`);
  }

  return [...out.values()];
}

// ─── лист `surface="paper"` Редактора ─────────────────────────────────────────

/*
  Лист (OLDSUI-52) — светлый Документ в ЛЮБОЙ теме приложения, поэтому пары
  выше, мерящие токены кита на подложках темы, его не покрывают: роли `--rte-*`
  листа смотрят в примитивы светлой темы, а акцент — в заливку темы приложения.
  Здесь каждая пара меряется против самого листа (`--rte-background`) во всех
  темах × акцентах × брендах.

  Значения ролей — из `EDITOR_PAPER_TOKENS_CLASS`, той же строки классов, что
  стоит на листе, а не из списка, переписанного руками. Лист несёт вложенный
  `data-theme="light"`, поэтому маркеры и тема подсветки берут светлые блоки
  `styles.css`; в светлом приложении акцентные роли — вариант по корню.
*/
const PAPER = rteRoles(EDITOR_PAPER_TOKENS_CLASS, /(?:^|\s)\[--(rte-[\w-]+):([^\]]+)\]/g);
const PAPER_LIGHT_ROOT = rteRoles(
  EDITOR_PAPER_TOKENS_CLASS,
  /\[:root\[data-theme=light\]_&\]:\[--(rte-[\w-]+):([^\]]+)\]/g
);
const CODE_LIGHT = decls(blockBody(/:where\(\[data-theme="light"\]\)\s*\{/));
if (!PAPER["rte-background"] || !CODE_LIGHT["rte-code-block-background"])
  throw new Error(
    "The paper roles or the light code theme could not be read — the gate would be blind."
  );

const paperVarsFor = (theme, accent, brand) => ({
  ...varsFor(theme, accent, brand),
  ...MARKER_LIGHT,
  ...CODE_LIGHT,
  ...PAPER,
  ...(theme === "light" ? PAPER_LIGHT_ROOT : {}),
});

function paperPairs() {
  const out = [];
  const add = (kind, required, fg, bg, label) => out.push({ kind, required, fg, bg, label });
  for (const role of [
    "rte-foreground",
    "rte-secondary",
    "rte-muted",
    "rte-muted-foreground",
    "rte-link",
    ...EDITOR_TEXT_COLORS.map(({ name }) => `rte-text-${name}`),
  ])
    add("text", TEXT, role, null, `paper: ${role}`);
  for (const { name, token, bright } of EDITOR_MARKERS)
    add(
      "text",
      TEXT,
      bright ? "marker-text" : "rte-foreground",
      token,
      `paper: marker ${name} — ${bright ? "dark marker text" : "body text"}`
    );
  add("text", TEXT, "rte-foreground", "rte-code-background", "paper: inline code, table header");
  add("text", TEXT, "rte-foreground", "rte-selection", "paper: selected text and cells");
  add("text", TEXT, "rte-secondary", "rte-control-hover", "paper: code header button, hovered");
  add("text", TEXT, "rte-secondary", "rte-code-block-background", "paper: code header text");
  for (const role of Object.keys(CODE_LIGHT))
    if (role !== "rte-code-block-background")
      add("text", TEXT, role, "rte-code-block-background", `paper: code ${role}`);
  add("non-text", NON_TEXT, "rte-ring", null, "paper: focus of a control in the document");
  add("non-text", NON_TEXT, "rte-primary", null, "paper: checkbox, selected image outline");
  // Тон Обёртки на листе (OLDSUI-78) — те же три пары, что в теме, против листа.
  for (const tone of EDITOR_WRAPPER_TONES) {
    const background = `rte-tone-${tone}-background`;
    const border = `rte-tone-${tone}-border`;
    add("text", TEXT, "rte-foreground", background, `paper: wrapper tone ${tone} — body text`);
    for (const role of TONE_TEXT_ROLES)
      add("text", TEXT, `rte-tone-${role}`, background, `paper: wrapper tone ${tone} — ${role}`);
    add("non-text", NON_TEXT, border, null, `paper: wrapper tone ${tone} — stripe outside`);
    add(
      "non-text",
      NON_TEXT,
      border,
      background,
      `paper: wrapper tone ${tone} — stripe on its fill`
    );
  }
  return out;
}

/** Пара на листе: подложка (если есть) поверх листа, текст поверх неё. */
function paperRatio({ fg, bg }, vars) {
  const sheet = parseColor(resolveVar("rte-background", vars));
  const under = bg ? composite(parseColor(resolveVar(bg, vars)), sheet) : sheet;
  return contrast(composite(parseColor(resolveVar(fg, vars)), under), under);
}

// ─── самопроверка расчёта ─────────────────────────────────────────────────────

/**
 * Якорь из исходной спецификации контраста: `#1f7ae0` на `rgba(31,122,224,0.16)` поверх `#26272d` = 2.95.
 * Это состояние токенов на момент замера в спеке.
 *
 * Цвета здесь ЛИТЕРАЛЬНЫЕ, а не взятые из `styles.css`, и это принципиально:
 * проверяется формула и альфа-композит, а не текущая палитра. Читай якорь из
 * токенов — и он бы падал при каждой законной правке `--accent`, то есть ровно
 * тогда, когда скрипт нужнее всего. Один раз так и вышло.
 */
function selfCheck() {
  const bg = composite(parseColor("rgba(31, 122, 224, 0.16)"), parseColor("#26272d"));
  const ratio = contrast(parseColor("#1f7ae0"), bg);
  if (Math.abs(ratio - 2.95) > 0.06) {
    console.error(
      `The self-check did not add up: #1f7ae0 on rgba(31,122,224,0.16) over #26272d = ` +
        `${ratio.toFixed(2)}, expected 2.95. The formula is broken — the table below cannot be trusted.`
    );
    process.exit(2);
  }
}

// ─── прогон ───────────────────────────────────────────────────────────────────

selfCheck();

const showAll = process.argv.includes("--all");
const ALL_PAIRS = pairs();
const rows = [];

for (const pair of ALL_PAIRS)
  for (const theme of THEMES)
    for (const accent of ACCENTS)
      for (const brand of BRANDS) {
        // У бренда своя ось акцента: мерить его дважды, по разу на каждый
        // акцент, значило бы удвоить строки, не добавив ни одного сочетания.
        if (brand !== "base" && accent !== ACCENTS[0]) continue;
        const vars = varsFor(theme, accent, brand);
        const { ratio, surface } = worstRatio(pair.fgClass, pair.bgClass, vars);
        rows.push({ ...pair, theme, accent, brand, ratio, surface, ok: ratio >= pair.required });
      }

const PAPER_PAIRS = paperPairs();
for (const pair of PAPER_PAIRS)
  for (const theme of THEMES)
    for (const accent of ACCENTS)
      for (const brand of BRANDS) {
        if (brand !== "base" && accent !== ACCENTS[0]) continue;
        const ratio = paperRatio(pair, paperVarsFor(theme, accent, brand));
        rows.push({
          ...pair,
          theme,
          accent,
          brand,
          ratio,
          surface: "paper sheet",
          ok: ratio >= pair.required,
        });
      }

/** `dark/blue` для базы, `dark/teal` для бренда — акцент у бренда свой. */
const variantLabel = (r) => `${r.theme}/${r.brand === "base" ? r.accent : r.brand}`;

const failed = rows.filter((r) => !r.ok);
const shown = (showAll ? rows : failed).sort((a, b) => a.ratio - b.ratio);

if (shown.length) {
  const col = (rs, get) => Math.max(...rs.map((r) => get(r).length));
  const w = {
    label: col(shown, (r) => r.label),
    theme: col(shown, (r) => variantLabel(r)),
    surface: col(shown, (r) => r.surface),
  };
  console.log(
    `${"pair".padEnd(w.label)}  ${"theme/accent".padEnd(w.theme)}  ${"surface".padEnd(w.surface)}  actual  required`
  );
  for (const r of shown)
    console.log(
      `${r.label.padEnd(w.label)}  ${variantLabel(r).padEnd(w.theme)}  ` +
        `${r.surface.padEnd(w.surface)}  ${r.ratio.toFixed(2).padStart(7)}  ${r.required.toFixed(1).padStart(9)}`
    );
  console.log();
}

const textRows = rows.filter((r) => r.kind === "text");
console.log(
  `Checked ${rows.length} combinations: ${ALL_PAIRS.length} pairs + ${PAPER_PAIRS.length} paper-sheet pairs × ${THEMES.length} themes × ` +
    `(${ACCENTS.length} base accents + ${BRANDS.length - 1} brand).\n` +
    `Failures: ${failed.length} — of them text ${failed.filter((r) => r.kind === "text").length} ` +
    `of ${textRows.length}, non-text ${failed.length - failed.filter((r) => r.kind === "text").length} ` +
    `of ${rows.length - textRows.length}.`
);

process.exit(failed.length ? 1 : 0);
