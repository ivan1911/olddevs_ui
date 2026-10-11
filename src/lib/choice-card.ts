import type { Tone } from "./variants.js";

/**
 * Вид набора вариантов выбора.
 *
 * Имя оси — `appearance`, а не `variant`: `variant` в ките уже значит
 * solid/soft/outline/ghost (подачу тона), а здесь меняется не подача, а сама
 * форма варианта — строка с кружком или карточка. Словарь ADR-0036 имени не
 * занимает и не запрещает: в категории «Оформление» оно новое по смыслу, а
 * новый смысл получает новое имя.
 */
export type ChoiceAppearance = "default" | "card";

/**
 * Рамка выбранной карточки по тону.
 *
 * Свой словарь, а не `TONE_TOKENS[tone].border`: у `neutral` там `border-line` —
 * нейтральная рамка-разделитель, которую гейт контраста не меряет намеренно
 * (она не несёт смысла). Выбранная карточка рамкой СООБЩАЕТ состояние, то есть
 * это признак по WCAG 1.4.11 с порогом 3:1, и для `neutral` берётся `fg-3`.
 * Остальные тона — те же `*-strong`, что и у рамок кита.
 *
 * Те же значения, что у `STATE_BORDER` в `variants.ts` (рамка отмеченной
 * коробки флажка и включённого `Toggle`): рамка карточки и рамка коробки внутри
 * неё — один признак одного цвета. Словарь не ссылается на тот: скрипт гейта
 * грузит `choice-card.ts` напрямую через Node, а он не сопоставляет `.js` с
 * `.ts` — рантайм-импорт отсюда его роняет. Гейт меряет оба словаря.
 *
 * Литеральные строки целиком: Tailwind сканирует исходники как текст.
 * `scripts/contrast.mjs` читает этот словарь и меряет каждую запись против
 * подложек и против самой карточки — `bg-2`.
 */
export const CHOICE_CARD_SELECTED_BORDER: Record<Tone, string> = {
  neutral: "border-fg-3",
  accent: "border-accent-strong",
  success: "border-success-strong",
  warning: "border-warning-strong",
  danger: "border-danger-strong",
};

/** Рамка карточки, пока ничего не выбрано. Такая же нейтральная, как у полей. */
export const CHOICE_CARD_IDLE_BORDER = "border-line";

/** Рамка карточки с ошибкой — `danger` независимо от тона набора. */
export const CHOICE_CARD_INVALID_BORDER = "border-danger-strong";

/**
 * Каркас карточки: рамка и подложка на `RadioField`/`CheckboxField`. Отступа у
 * каркаса нет — его держит метка (см. `CHOICE_CARD_LABEL`).
 */
export const CHOICE_CARD_BASE = "flex flex-col rounded-lg border bg-bg-2 transition-colors";

/** Раскладка карточки в строке с переносом: растёт, но не уезжает в полосу. */
export const CHOICE_CARD_ROW = "max-w-xs flex-1 basis-48";

/**
 * Метка карточки — область нажатия на всю карточку.
 *
 * ВСЯ КАРТОЧКА — ЭТО МЕТКА, вместе с описанием. Метка накрывает рамку (`-m-px`
 * и отступ на пиксель больше), поэтому щелчок в любую точку карточки — щелчок
 * по родному радио или флажку. Первый вариант растягивал на карточку
 * псевдоэлемент метки, а описание оставлял соседом; он работал мышью, но
 * псевдоэлемент перехватывает указатель у всего содержимого, и браузерные
 * проверки (Playwright) не могли щёлкнуть по описанию: «метка перехватывает
 * указатель».
 *
 * Описание внутри метки не попадает в доступное имя: оно скрыто от
 * вспомогательных технологий (`aria-hidden`), а читается через
 * `aria-describedby`, которым его связывает react-aria, — ссылка по
 * идентификатору работает и на скрытый элемент.
 */
export const CHOICE_CARD_LABEL =
  "-m-px flex cursor-pointer items-start gap-3 rounded-lg p-[13px] disabled:cursor-default";

/** Кольцо фокуса на карточке, а не на кружке: ориентир клавиатуры — вся карточка. */
export const CHOICE_CARD_FOCUS_RING = "ring-accent-strong ring-offset-bg-1 ring-2 ring-offset-1";

/** Слот иконки: декоративный, поэтому вне имени и фиксированного размера. */
export const CHOICE_CARD_ICON = "text-fg-1 mt-0.5 flex size-5 shrink-0 items-center justify-center";
