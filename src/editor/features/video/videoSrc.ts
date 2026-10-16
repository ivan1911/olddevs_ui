/**
 * Видео по ссылке — ЛЁГКАЯ ЧАСТЬ ДАННЫХ (ADR-0071): то, что нужно очистке на
 * сервере (`schema.ts`), `RichTextView` и описаниям Инструментов в «старте», —
 * имена, проверка `data-src` и признак видео в HTML. Разбор ссылок и адрес плеера
 * лежат отдельно (`videoLink.ts`) и в «старт» не попадают: схема на сервере и
 * Просмотр без видео за них не платят.
 *
 * ЧТО ЛЕЖИТ В ДОКУМЕНТЕ. Не плеер, а ссылка: `data-provider` (сервис) и
 * `data-src` — `https`-ссылка на видео в каноническом виде, как её пишет Редактор
 * (`parseVideoLink`). Проверка `data-src` — два выражения по числу сервисов, а не
 * разбор: очистка не принимает ничего, кроме того, что пишет сам кит, и хост в
 * них назван целиком (`www.youtube.com`, `www.twitch.tv`, `clips.twitch.tv`), так
 * что `youtube.com.evil.example` и `youtube.com@evil.example` не проходят.
 *
 * Модуль серверно-безопасен: данные и чистые функции над строкой, без React и
 * без движка.
 */

/** Значение `div[data-block]` блока видео. */
export const VIDEO_BLOCK = "video";

/** Сервисы видео: значения `data-provider`, они же имена Инструментов. */
export const VIDEO_PROVIDERS = ["youtube", "twitch"] as const;

export type VideoProvider = (typeof VIDEO_PROVIDERS)[number];

/** Видео в каноническом виде: сервис и ссылка, которая и лежит в Документе. */
export interface VideoLink {
  provider: VideoProvider;
  /** `https`-ссылка на видео своего сервиса; та же, что `href` внутри блока. */
  src: string;
}

/**
 * Каноническая ссылка по сервису. YouTube — ролик (`watch?v=`, с началом `&t=`
 * в секундах) или плейлист; Twitch — запись (`/videos/<число>`, с началом
 * `?t=1h2m3s`), канал или клип (`clips.twitch.tv`). Идентификатор — буквы,
 * цифры, `_` и `-`.
 */
const SRC: Readonly<Record<VideoProvider, RegExp>> = {
  youtube:
    /^https:\/\/www\.youtube\.com\/(?:watch\?v=[\w-]{1,64}(?:&t=\d{1,7})?|playlist\?list=[\w-]{1,64})$/,
  twitch:
    /^https:\/\/(?:www\.twitch\.tv\/(?:videos\/\d{1,20}(?:\?t=(?=\d)(?:\d+h)?(?:\d+m)?(?:\d+s)?)?|[\w-]{1,64})|clips\.twitch\.tv\/[\w-]{1,64})$/,
};

/** Значение `data-provider` — сервис кита. */
export function isVideoProvider(value: unknown): value is VideoProvider {
  return value === "youtube" || value === "twitch";
}

/**
 * Годится ли значение `data-src` у сервиса `provider`: каноническая
 * `https`-ссылка на видео этого сервиса. Одно правило на очистку на сервере,
 * Редактор и Остров. Адрес плеера (`youtube-nocookie.com`, `player.twitch.tv`),
 * `http`, `youtu.be` и значение с разметкой не проходят.
 */
export function isVideoSrc(provider: string, value: string): boolean {
  return isVideoProvider(provider) && SRC[provider].test(value);
}

/**
 * Есть ли в HTML Документа блок видео. Блок в очищенном HTML всегда записан как
 * `data-block="video"` в двойных кавычках (так пишет сериализатор DOM), поэтому
 * проверка — подстрока: по ней `RichTextView` решает, нужен ли Остров.
 */
export function hasVideoBlocks(html: string): boolean {
  return html.includes(`data-block="${VIDEO_BLOCK}"`);
}
