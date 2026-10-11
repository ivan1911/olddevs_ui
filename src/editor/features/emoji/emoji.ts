import type { EmojiCategory, EmojiName } from "../../../i18n/messages.js";

/**
 * Набор эмодзи Редактора: курированные данные, без библиотеки эмодзи.
 *
 * ЧТО ЗДЕСЬ И ЧЕГО НЕТ. Категории по порядку, у каждого эмодзи — символ и ключ
 * имени. Имён здесь нет: их озвучивает скринридер, а значит они — строки
 * интерфейса и живут в каталоге сообщений `editor` (`emojiName`,
 * `emojiCategory`), по ключу. Полного Unicode-набора, поиска, «недавних» и
 * оттенков кожи нет и не будет: сетка — быстрый путь к дюжине привычных
 * символов, а не палитра ОС.
 *
 * МОДУЛЬ СЕРВЕРНО-БЕЗОПАСЕН: ни React, ни `"use client"`, ни DOM. Это данные,
 * и читать их вправе и сервер (например, чтобы проверить, что строка — один
 * из эмодзи набора).
 *
 * ЭМОДЗИ — ОБЫЧНЫЙ ТЕКСТ. Своего Блока и Метки у него нет, как у
 * `clearFormatting`: Схема, санитайзер и Markdown не меняются, а вставленный
 * символ попадает в выходной HTML и в `getMarkdown` как любой другой текст.
 * Символы с вариантом оформления (`❤️`, `✌️`, `✈️`) хранят селектор `U+FE0F`:
 * без него часть платформ рисует их чёрно-белыми.
 *
 * Типы ключей (`EmojiCategory`, `EmojiName`) живут в каталоге сообщений
 * (`i18n/messages.ts`), а не здесь: каталог — часть главного входа, а ему
 * запрещено тянуться в `src/editor/` (`tests/editor-entry.test.ts`). Каталог
 * обязан назвать каждый ключ, а набор — брать имена только оттуда, и компилятор
 * сводит их: забытое имя в одной из двух сторон не соберётся.
 *
 * Один и тот же эмодзи вправе стоять в двух категориях («Избранное» повторяет
 * часть остальных): ключ имени у него тогда общий, а позиция в сетке — своя.
 */

/** Категории набора по порядку показа. */
export const EMOJI_CATEGORIES: readonly EmojiCategory[] = [
  "favorites",
  "smileys",
  "gestures",
  "animals",
  "food",
  "activities",
  "travel",
];

export interface Emoji {
  /** Сам символ — он и вставляется в Документ. */
  char: string;
  /** Ключ имени в каталоге сообщений (`editor.emojiName`). */
  name: EmojiName;
}

/** Сколько эмодзи в строке сетки: и ширина сетки, и шаг стрелок вверх и вниз. */
export const EMOJI_COLUMNS = 10;

const e = (char: string, name: EmojiName): Emoji => ({ char, name });

/**
 * Сам набор. Размер каждой категории кратен `EMOJI_COLUMNS`: строка сетки не
 * переходит из категории в категорию, и стрелка вниз всегда попадает на
 * эмодзи прямо под текущим.
 */
export const EMOJI_SET: Readonly<Record<EmojiCategory, readonly Emoji[]>> = {
  favorites: [
    e("😂", "faceWithTearsOfJoy"),
    e("❤️", "redHeart"),
    e("🤣", "rollingOnTheFloorLaughing"),
    e("👍", "thumbsUp"),
    e("😭", "loudlyCrying"),
    e("🙏", "foldedHands"),
    e("😘", "blowingKiss"),
    e("🥰", "smilingWithHearts"),
    e("😍", "heartEyes"),
    e("🎉", "partyPopper"),
    e("😁", "beamingFace"),
    e("🔥", "fire"),
    e("🎂", "birthdayCake"),
    e("😳", "flushedFace"),
    e("😎", "sunglassesFace"),
    e("✨", "sparkles"),
    e("👀", "eyes"),
    e("👉", "pointingRight"),
    e("💯", "hundredPoints"),
    e("😡", "angryFace"),
  ],
  smileys: [
    e("🙂", "slightlySmiling"),
    e("😄", "grinningSmilingEyes"),
    e("😆", "grinningSquinting"),
    e("😉", "winkingFace"),
    e("😍", "heartEyes"),
    e("😛", "tongueFace"),
    e("😊", "smilingBlushing"),
    e("😏", "smirkingFace"),
    e("🤔", "thinkingFace"),
    e("😪", "sleepyFace"),
  ],
  gestures: [
    e("👍", "thumbsUp"),
    e("👎", "thumbsDown"),
    e("✌️", "victoryHand"),
    e("👏", "clappingHands"),
    e("🙌", "raisedHands"),
    e("🤦", "facepalm"),
    e("🤷", "shrug"),
    e("👊", "oncomingFist"),
    e("👋", "wavingHand"),
    e("👌", "okHand"),
  ],
  animals: [
    e("🐶", "dog"),
    e("🐱", "cat"),
    e("🐭", "mouse"),
    e("🐹", "hamster"),
    e("🐰", "rabbit"),
    e("🐻", "bear"),
    e("🐼", "panda"),
    e("🦁", "lion"),
    e("🐷", "pig"),
    e("🐸", "frog"),
  ],
  food: [
    e("🍏", "greenApple"),
    e("🍕", "pizza"),
    e("🍔", "hamburger"),
    e("🍟", "frenchFries"),
    e("🍝", "spaghetti"),
    e("🍣", "sushi"),
    e("🍨", "iceCream"),
    e("🍩", "doughnut"),
    e("🍪", "cookie"),
    e("🍰", "shortcake"),
  ],
  activities: [
    e("⚽", "soccerBall"),
    e("🏀", "basketball"),
    e("🏈", "americanFootball"),
    e("⚾", "baseball"),
    e("🎾", "tennis"),
    e("🎳", "bowling"),
    e("🏌️", "golfer"),
    e("🎣", "fishing"),
    e("🚴", "cyclist"),
    e("🎮", "videoGame"),
  ],
  travel: [
    e("✈️", "airplane"),
    e("🚗", "car"),
    e("🚲", "bicycle"),
    e("🚆", "train"),
    e("⛵", "sailboat"),
    e("🗺️", "worldMap"),
    e("🏖️", "beach"),
    e("🏔️", "mountain"),
    e("🏕️", "camping"),
    e("🧳", "luggage"),
  ],
};
