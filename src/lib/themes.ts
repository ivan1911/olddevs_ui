/**
 * Реестр тем кита: какие оси существуют, как привести значение к допустимому и
 * как применить его к документу.
 *
 * Зачем это в ките, а не у потребителя. Оси объявлены в `styles.css`, но наружу
 * до 2.1.0 не отдавались — и каждый потребитель переписывал списки константами
 * у себя. В продукте-потребителе это `["light","dark","dim"]` в одном месте
 * и `value === "violet" ? "violet" : "blue"` в другом; второй проект написал бы
 * их третий раз, и разошлись бы они молча. Решение — ADR-0020.
 *
 * Компонента переключателя здесь нет и не будет: `Segmented` уже даёт нужную
 * форму, а кнопка завязана на хранилище и раскладку конкретного приложения.
 * Готовый рецепт — `docs/recipes/theme-switcher.md`.
 */

/**
 * Темы. Порядок значим ровно в одном месте — первая считается умолчанием,
 * потому что именно она живёт в `:root` без своего атрибута.
 */
export const UI_THEMES = ["dark", "light", "dim"] as const;

/** Акценты. `blue` — база `:root`, `violet` — оверлей `[data-accent]`. */
export const UI_ACCENTS = ["blue", "violet"] as const;

/** Бренды. `base` — отсутствие оверлея, а не оверлей с таким именем. */
export const UI_BRANDS = ["base", "teal"] as const;

export type UiTheme = (typeof UI_THEMES)[number];
export type UiAccent = (typeof UI_ACCENTS)[number];
export type UiBrand = (typeof UI_BRANDS)[number];

export interface UiThemePrefs {
  theme?: UiTheme;
  accent?: UiAccent;
  brand?: UiBrand;
}

/** Умолчания каждой оси — то состояние, в котором ни один оверлей не задан. */
export const DEFAULT_THEME_PREFS: Required<UiThemePrefs> = {
  theme: "dark",
  accent: "blue",
  brand: "base",
};

/**
 * Приведение значения к допустимому.
 *
 * Аргумент типизирован как `unknown` намеренно: единственный интересный вызов —
 * из хранилища, а `localStorage` возвращает что угодно, включая строку от
 * прошлой версии приложения. Функция, принимающая `UiTheme`, защищала бы ровно
 * тот случай, где защита не нужна.
 */
function normalize<T extends string>(list: readonly T[], value: unknown, fallback: T): T {
  return list.includes(value as T) ? (value as T) : fallback;
}

export const normalizeTheme = (value: unknown): UiTheme =>
  normalize(UI_THEMES, value, DEFAULT_THEME_PREFS.theme);

export const normalizeAccent = (value: unknown): UiAccent =>
  normalize(UI_ACCENTS, value, DEFAULT_THEME_PREFS.accent);

export const normalizeBrand = (value: unknown): UiBrand =>
  normalize(UI_BRANDS, value, DEFAULT_THEME_PREFS.brand);

/**
 * Выставить оси на элементе — обычно `document.documentElement`.
 *
 * Применяются ВСЕ ТРИ оси, а недоданные берутся из умолчаний: функция задаёт
 * состояние целиком, а не правит одну ось поверх неизвестного текущего.
 * Частичное применение выглядело бы удобнее ровно до первого случая, когда
 * бренд остался от прошлого экрана, и никто не понял почему.
 *
 * `base` СНИМАЕТ `data-brand`, а не пишет `data-brand="base"`: блока с таким
 * именем в CSS нет, и оставленный атрибут выглядел бы работающим оверлеем.
 * Тот же выбор сделан в декораторе витрины — иначе снимки и приложение
 * расходились бы на пустом месте.
 */
export function applyTheme(root: HTMLElement, prefs: UiThemePrefs = {}): void {
  root.setAttribute("data-theme", normalizeTheme(prefs.theme));
  root.setAttribute("data-accent", normalizeAccent(prefs.accent));

  const brand = normalizeBrand(prefs.brand);
  if (brand === "base") root.removeAttribute("data-brand");
  else root.setAttribute("data-brand", brand);
}

/**
 * Строка скрипта, применяющего сохранённую тему ДО первой отрисовки.
 *
 * Возвращается строка, а не выполняется код: куда её вставить, знает фреймворк
 * потребителя, а не кит. В Next это `<Script strategy="beforeInteractive">`, в
 * обычном приложении — `<script>` в шаблоне. Кит остаётся
 * фреймворк-нейтральным и при этом закрывает место, где ошибаются: без раннего
 * применения пользователь видит вспышку чужой темы между отрисовкой и
 * гидратацией.
 *
 * Кит здесь начинает отдавать исполняемый JavaScript, и это осознанное
 * расширение его границы — разбор и цена в ADR-0020.
 *
 * Формат хранения: JSON-объект `{ theme, accent, brand }` по ключу
 * `storageKey`. Пишет его потребитель, читает этот скрипт; любое поле может
 * отсутствовать или врать — normalize отработает.
 *
 * Списки осей подставляются из констант выше, а не пишутся в шаблоне руками:
 * иначе скрипт разошёлся бы с реестром — тем самым дефектом, ради которого
 * реестр и заведён.
 */
/**
 * Литерал для вставки в ТЕЛО `<script>`.
 *
 * `JSON.stringify` закрывает кавычки, но не `<`, а этого мало: значение
 * попадает внутрь тега, и последовательность `</script>` закрывает его на
 * месте — остаток кода вываливается в разметку как текст. Живого XSS здесь
 * нет, ключ задаёт разработчик; но кит генерирует код под
 * `dangerouslySetInnerHTML`, и защита в один символ здесь ставится по
 * умолчанию, а не по факту нападения.
 */
const scriptLiteral = (value: string) => JSON.stringify(value).replace(/</g, "\\u003c");

export function themeInitScript({ storageKey }: { storageKey: string }): string {
  const t = JSON.stringify(UI_THEMES);
  const a = JSON.stringify(UI_ACCENTS);
  const b = JSON.stringify(UI_BRANDS);
  const d = DEFAULT_THEME_PREFS;

  //
  // `try` обнимает ТОЛЬКО чтение и разбор — то единственное, что здесь умеет
  // бросить: `localStorage` недоступен в приватном режиме, а в ключе может
  // лежать что угодно от прошлой версии приложения. Общий `try` вокруг всего
  // тела выглядел бы осторожнее, но при битом JSON не выставлял бы НИ ОДНОГО
  // атрибута, и документ оставался бы без осей вовсе — тест поймал ровно это.
  return (
    `(function(){` +
    `var r=document.documentElement,p={};` +
    `try{p=JSON.parse(localStorage.getItem(${scriptLiteral(storageKey)})||"{}")||{}}catch(e){}` +
    `var n=function(l,v,f){return l.indexOf(v)===-1?f:v};` +
    `r.setAttribute("data-theme",n(${t},p.theme,${JSON.stringify(d.theme)}));` +
    `r.setAttribute("data-accent",n(${a},p.accent,${JSON.stringify(d.accent)}));` +
    `var b=n(${b},p.brand,${JSON.stringify(d.brand)});` +
    `if(b==="base"){r.removeAttribute("data-brand")}else{r.setAttribute("data-brand",b)}` +
    `})();`
  );
}
