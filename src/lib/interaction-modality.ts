/**
 * Модальность ввода: чем пользователь пришёл к фокусу.
 *
 * Зачем. `:focus-visible` отвечает на вопрос «рисовать ли кольцо», а не «кто
 * поставил фокус»: его ставит и клавиатура, и скринридер (свайп VoiceOver и
 * TalkBack, виртуальный курсор NVDA и JAWS) — страница при этом не получает ни
 * клавиши, ни указателя, фокус просто появляется. Для кольца это верно, а для
 * всплывающего без объявления содержимого (`HoverCard`) — нет: оно появилось бы
 * под скринридером ни с того ни с сего, а при экранной лупе ещё и закрыло бы
 * соседний текст.
 *
 * Три значения:
 * - `keyboard` — фокус пришёл, пока нажата навигационная клавиша;
 * - `pointer` — перед фокусом было нажатие мышью, пером или пальцем;
 * - `virtual` — фокус пришёл, а перед ним не было ни того, ни другого.
 *
 * Логика — та же, что у `useFocusVisible` в react-aria (оттуда же и определение
 * виртуальной модальности), но своя: это приватный экспорт пакета, который кит
 * не объявляет зависимостью (ADR-0004), а рисковать публичным поведением ради
 * неподдерживаемого пути нельзя. Модуль не знает про React и ничего не рисует.
 *
 * Слушатели ставятся один раз и лениво — при первом `trackInteractionModality()`,
 * а не при импорте: серверный код и компонент, которому модальность не нужна,
 * ничего не платят. Снимать их не нужно: восемь пассивных слушателей на страницу
 * дешевле, чем счётчик подписчиков и гонка «снял — тут же поставил».
 */
export type InteractionModality = "keyboard" | "pointer" | "virtual";

/**
 * Клавиши, которыми двигают фокус. Enter, пробел, буквы и Escape в список не
 * входят: они фокус не переводят, а когда программа переводит его после них
 * (закрылось окно — фокус вернулся на кнопку), всплывать карточке незачем.
 */
const NAVIGATION_KEYS = new Set([
  "Tab",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Home",
  "End",
  "PageUp",
  "PageDown",
]);

let installed = false;
let current: InteractionModality = "virtual";
/**
 * Событие, которое объясняет фокус. Клавиша живёт от keydown до keyup: за это
 * время фокус может прийти не один раз (Tab попал на обёртку, та передала его
 * вглубь), и все эти фокусы — от клавиши. После keyup клавиша ничего не
 * объясняет: свайп скринридера после давнего Tab не должен считаться
 * клавиатурным. Нажатие объясняет и программный фокус вслед за ним (обработчик
 * клика возвращает фокус на триггер) — это продолжение нажатия.
 */
let pending: "keyboard" | "pointer" | null = null;

const MODIFIER_KEYS = new Set(["Shift", "Control", "Alt", "Meta"]);

function onKeyDown(event: KeyboardEvent) {
  // Сами модификаторы — часть сочетания Shift+Tab, а не отдельное нажатие.
  if (MODIFIER_KEYS.has(event.key)) return;
  // С Meta и Ctrl Tab — переключение вкладок браузера, а не движение фокуса.
  // Alt допустим только с Tab: Alt+Tab ОС страница не видит, а Option+Tab в
  // Safari на macOS — единственный способ дойти клавишей до ссылок.
  const blocked = event.metaKey || event.ctrlKey || (event.altKey && event.key !== "Tab");
  if (blocked || !NAVIGATION_KEYS.has(event.key)) {
    // Другая клавиша (Enter, буква, Escape) — не навигация: фокус, который
    // программа поставит после неё, клавиатурным не считается.
    if (pending === "keyboard") pending = null;
    return;
  }
  pending = "keyboard";
  current = "keyboard";
}

function onKeyUp() {
  // Фокус от клавиши приходит на keydown. Отпущенная клавиша фокус больше не
  // объясняет: следующий фокус — уже не её, например свайп скринридера.
  if (pending === "keyboard") pending = null;
}

function onPointerDown() {
  pending = "pointer";
  current = "pointer";
}

/**
 * Слушаем `focusin`, а не `focus`: React строит `onFocus` на `focusin`, и
 * слушатель на `document` в фазе погружения сработает раньше его обработчика
 * при любом порядке этих двух событий в браузере.
 */
function onFocusIn() {
  current = pending ?? "virtual";
}

/**
 * Окно потеряло или вернуло фокус. Возвращая его, браузер ставит фокус обратно
 * на прежний элемент без клавиши и без указателя; прежняя модальность тут
 * устарела, и считать этот фокус клавиатурным нельзя.
 */
function onWindowFocusChange() {
  pending = null;
  current = "virtual";
}

/**
 * Ставит слушатели, если они ещё не стоят. Безопасно звать сколько угодно раз и
 * на сервере (там это пустая функция). Звать надо ДО фокуса, который предстоит
 * классифицировать: событие, уже прошедшее, задним числом не прочитать.
 */
export function trackInteractionModality(): void {
  if (installed || typeof document === "undefined" || typeof window === "undefined") return;
  installed = true;
  const options = { capture: true, passive: true } as const;
  document.addEventListener("keydown", onKeyDown, options);
  document.addEventListener("keyup", onKeyUp, options);
  document.addEventListener("pointerdown", onPointerDown, options);
  // Старые браузеры без Pointer Events и эмуляция мыши после касания.
  document.addEventListener("mousedown", onPointerDown, options);
  document.addEventListener("touchstart", onPointerDown, options);
  document.addEventListener("focusin", onFocusIn, options);
  window.addEventListener("blur", onWindowFocusChange);
  window.addEventListener("focus", onWindowFocusChange);
}

/**
 * Модальность последнего фокуса (в `onFocus` — того, что только что пришёл).
 * До первого события и до `trackInteractionModality()` — `virtual`: доказательств
 * клавиши нет, а ошибиться безопаснее в сторону «не открывать».
 */
export function getInteractionModality(): InteractionModality {
  return current;
}
