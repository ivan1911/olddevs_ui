import type { EmojiCategory, EmojiName } from "../../../i18n/messages.js";

/**
 * The Editor's emoji set: curated data, with no emoji library.
 *
 * WHAT IS HERE AND WHAT IS NOT. Categories in order; each emoji has a character and a name key.
 * The names are not here: a screen reader speaks them, so they are interface strings, and they
 * live in the `editor` message catalog (`emojiName`, `emojiCategory`), by key. There is no full
 * Unicode set, no search, no "recent" and no skin tones, and there will not be: the grid is a quick
 * way to a dozen familiar characters, not the OS emoji picker.
 *
 * THE MODULE IS SERVER-SAFE: no React, no `"use client"`, no DOM. It is data, and the server may
 * read it too (for example, to check that a string is one of the set's emoji).
 *
 * EMOJI IS PLAIN TEXT. It has no Block and no Mark of its own, like `clearFormatting`: the Schema,
 * the sanitizer and Markdown do not change, and the inserted character goes into the output HTML
 * and into `getMarkdown` like any other text. Characters with a presentation variant (`❤️`, `✌️`,
 * `✈️`) store the `U+FE0F` selector: without it, some platforms render them in black and white.
 *
 * The key types (`EmojiCategory`, `EmojiName`) live in the message catalog (`i18n/messages.ts`),
 * not here: the catalog is part of the main entry point, and it is not allowed to import from
 * `src/editor/` (`tests/editor-entry.test.ts`). The catalog must name every key, and the set may
 * take names only from there; the compiler ties the two together, so a name forgotten on one side
 * will not build.
 *
 * The same emoji may sit in two categories ("Favorites" repeats some of the others): its name key
 * is then shared, while its position in the grid is its own.
 */

/** Categories of the set, in display order. */
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
  /** The character itself: it is what gets inserted into the Document. */
  char: string;
  /** Name key in the message catalog (`editor.emojiName`). */
  name: EmojiName;
}

/** Number of emoji in a grid row: both the grid width and the step of the up and down arrows. */
export const EMOJI_COLUMNS = 10;

const e = (char: string, name: EmojiName): Emoji => ({ char, name });

/**
 * The set itself. The size of each category is a multiple of `EMOJI_COLUMNS`: a grid row never
 * crosses from one category into another, and the down arrow always lands on the emoji directly
 * below the current one.
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
