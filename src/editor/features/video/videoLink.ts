/**
 * Видео по ссылке — ДАННЫЕ и правила распознавания (ADR-0071): общий модуль
 * очистки на сервере (`schema.ts`), узла Редактора и Острова Просмотра.
 *
 * ЧТО ЛЕЖИТ В ДОКУМЕНТЕ. Не плеер, а ссылка: `data-provider` (сервис) и
 * `data-src` — ссылка на видео в каноническом виде. Адрес плеера собирается при
 * показе (`playerUrl`): у Twitch в нём домен страницы (`parent`), и Документ,
 * сохранённый в админке, на публичном сайте с другим доменом показывал бы
 * неработающий плеер. YouTube всегда идёт через `youtube-nocookie.com`.
 *
 * ПО ОБРАЗЦУ РАСШИРЕНИЙ TIPTAP YOUTUBE И TWITCH (решение владельца 2026-10-16:
 * свой код, пакеты расширений не ставятся): какие ссылки считаются видео и как из
 * них достаётся идентификатор — правила их `utils`, переписанные на разбор `URL`,
 * а не на одно выражение: хост сверяется по имени, а не по подстроке, поэтому
 * `youtube.com.evil.example` и `youtube.com@evil.example` видео не дают.
 *
 * Модуль серверно-безопасен: данные и чистые функции над строкой, без React и
 * без движка. Нужен глобальный `URL`: он есть в браузере и в Node.
 */

/** Значение `div[data-block]` блока видео. */
export const VIDEO_BLOCK = "video";

/** Сервисы видео: значения `data-provider`, они же имена Инструментов. */
export const VIDEO_PROVIDERS = ["youtube", "twitch"] as const;

export type VideoProvider = (typeof VIDEO_PROVIDERS)[number];

/** Название сервиса словами — подпись заглушки и имя плеера. Это имена брендов: не переводятся. */
export const VIDEO_PROVIDER_NAME: Readonly<Record<VideoProvider, string>> = {
  youtube: "YouTube",
  twitch: "Twitch",
};

/** Видео в каноническом виде: сервис и ссылка, которая и лежит в Документе. */
export interface VideoLink {
  provider: VideoProvider;
  /** `https`-ссылка на видео своего сервиса; та же, что `href` внутри блока. */
  src: string;
}

/** Идентификатор видео, плейлиста, клипа: буквы, цифры, `_` и `-`. */
const ID = /^[\w-]{1,64}$/;
/** Номер записи Twitch: цифры, перед ними допускается `v` (так пишет сам плеер). */
const TWITCH_VIDEO_ID = /^v?(\d{1,20})$/;
/** Метка времени Twitch: `1h2m3s`, `45m`, `30s`; хотя бы одна часть. */
const TWITCH_TIME = /^(?=\d)(?:\d+h)?(?:\d+m)?(?:\d+s)?$/;

/**
 * Имена верхнего уровня `twitch.tv`, которые не канал: ссылка на них видео не
 * даёт. Список — служебные разделы сайта, не весь словарь запретных имён.
 */
const TWITCH_RESERVED = new Set([
  "directory",
  "videos",
  "downloads",
  "jobs",
  "p",
  "settings",
  "subscriptions",
  "friends",
  "wallet",
  "turbo",
  "store",
  "prime",
  "search",
  "popout",
  "embed",
  "moderator",
  "broadcast",
  "bits",
  "dashboard",
  "inventory",
  "drops",
  "u",
  "team",
  "clips",
]);

/**
 * Разобрать текст как адрес: `https://…`, `http://…`, `//…` или без схемы
 * (`youtu.be/…`). Другая схема, пробелы, логин, пароль и порт — не адрес видео.
 */
function toUrl(input: string): URL | null {
  const text = input.trim();
  if (!text || /\s/.test(text) || text.length > 2048) return null;
  let full = text;
  if (/^https?:\/\//i.test(text)) full = text;
  else if (text.startsWith("//")) full = `https:${text}`;
  else if (text.includes("://") || /^[a-z][a-z\d+.-]*:(?!\d)/i.test(text)) return null;
  else full = `https://${text}`;
  try {
    const url = new URL(full);
    return url.username === "" && url.password === "" && url.port === "" ? url : null;
  } catch {
    return null;
  }
}

/** Сегменты пути без пустых: `/a//b/` → `["a", "b"]`. */
const segments = (url: URL) => url.pathname.split("/").filter(Boolean);

/** Секунды из метки времени YouTube: `90`, `90s`, `1h2m3s`. `null` — метки нет или она не годится. */
function youtubeStart(value: string | null): number | null {
  if (!value) return null;
  const parts = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/.exec(value);
  if (!parts || !(parts[1] || parts[2] || parts[3])) return null;
  const seconds = Number(parts[1] ?? 0) * 3600 + Number(parts[2] ?? 0) * 60 + Number(parts[3] ?? 0);
  return seconds > 0 && seconds < 1e7 ? seconds : null;
}

function youtubeLink(id: string, start: number | null): VideoLink | null {
  return ID.test(id)
    ? {
        provider: "youtube",
        src: `https://www.youtube.com/watch?v=${id}${start ? `&t=${start}` : ""}`,
      }
    : null;
}

function youtubePlaylist(list: string | null): VideoLink | null {
  return list && ID.test(list)
    ? { provider: "youtube", src: `https://www.youtube.com/playlist?list=${list}` }
    : null;
}

/** Имя хоста без `www.` и мобильных поддоменов. */
function bareHost(url: URL, ...prefixes: string[]): string {
  const host = url.hostname.toLowerCase();
  for (const prefix of prefixes) if (host.startsWith(prefix)) return host.slice(prefix.length);
  return host;
}

/**
 * Ссылка на YouTube: ролик (`watch?v=`, `youtu.be/`, `/shorts/`, `/live/`,
 * `/embed/`, `/v/`) или плейлист (`/playlist?list=`). `embed` разбирается
 * потому, что это тоже ссылка на видео, хотя кит её не пишет.
 */
function fromYoutube(url: URL, hosts: readonly string[]): VideoLink | null {
  const host = bareHost(url, "www.", "m.", "music.");
  if (!hosts.includes(host)) return null;
  const parts = segments(url);
  const start = youtubeStart(url.searchParams.get("t") ?? url.searchParams.get("start"));
  if (host === "youtu.be") {
    return parts.length === 1 ? youtubeLink(parts[0]!, start) : null;
  }
  const [first, second] = parts;
  if (first === "watch" && parts.length === 1) {
    const id = url.searchParams.get("v");
    return id ? youtubeLink(id, start) : youtubePlaylist(url.searchParams.get("list"));
  }
  if (first === "playlist" && parts.length === 1)
    return youtubePlaylist(url.searchParams.get("list"));
  if (first === "embed" && second === "videoseries" && parts.length === 2) {
    return youtubePlaylist(url.searchParams.get("list"));
  }
  if ((first === "embed" || first === "v" || first === "shorts" || first === "live") && second) {
    return parts.length === 2 ? youtubeLink(second, start) : null;
  }
  return null;
}

function twitchTime(url: URL): string {
  const time = url.searchParams.get("t") ?? url.searchParams.get("time");
  return time && TWITCH_TIME.test(time) ? time : "";
}

/**
 * Ссылка на Twitch: запись (`/videos/<число>`), клип (`clips.twitch.tv/<имя>`,
 * `/<канал>/clip/<имя>`) или канал (`/<канал>`).
 */
function fromTwitch(url: URL): VideoLink | null {
  const host = bareHost(url, "www.", "m.");
  const parts = segments(url);
  if (host === "clips.twitch.tv") {
    return parts.length === 1 && parts[0] !== "embed" && ID.test(parts[0]!)
      ? { provider: "twitch", src: `https://clips.twitch.tv/${parts[0]}` }
      : null;
  }
  if (host !== "twitch.tv") return null;
  if (parts[0] === "videos" && parts.length === 2) {
    const id = /^\d{1,20}$/.exec(parts[1]!)?.[0];
    const time = twitchTime(url);
    return id
      ? { provider: "twitch", src: `https://www.twitch.tv/videos/${id}${time ? `?t=${time}` : ""}` }
      : null;
  }
  if (parts.length === 3 && parts[1] === "clip" && ID.test(parts[0]!) && ID.test(parts[2]!)) {
    return { provider: "twitch", src: `https://clips.twitch.tv/${parts[2]}` };
  }
  if (parts.length === 1 && ID.test(parts[0]!) && !TWITCH_RESERVED.has(parts[0]!.toLowerCase())) {
    return { provider: "twitch", src: `https://www.twitch.tv/${parts[0]}` };
  }
  return null;
}

const YOUTUBE_HOSTS = ["youtube.com", "youtu.be"] as const;

/**
 * Ссылка на видео в каноническом виде или `null`, если это не видео. Хосты —
 * из ADR-0071: YouTube — `youtube.com`, `youtu.be`; Twitch — `twitch.tv`,
 * `clips.twitch.tv` (с `www.`, а у YouTube ещё `m.` и `music.`). Схема `http`
 * и ссылка без схемы принимаются, канонический вид всегда `https`.
 */
export function parseVideoLink(input: string): VideoLink | null {
  const url = toUrl(input);
  return url && (fromYoutube(url, YOUTUBE_HOSTS) ?? fromTwitch(url));
}

/**
 * Годится ли значение `data-src` у сервиса `provider`: `https`-адрес хоста этого
 * сервиса, который распознаётся как видео. Одно правило на очистку на сервере,
 * Редактор и Остров. Значение с разметкой и пробелами не проходит.
 */
export function isVideoSrc(provider: string, value: string): boolean {
  return (
    /^https:\/\//i.test(value) &&
    !/[\s<>"']/.test(value) &&
    parseVideoLink(value)?.provider === provider
  );
}

/** Значение `data-provider` — сервис кита. */
export function isVideoProvider(value: unknown): value is VideoProvider {
  return (VIDEO_PROVIDERS as readonly unknown[]).includes(value);
}

/**
 * Адрес плеера из адреса, который пишут расширения Tiptap (`iframe src`), —
 * обратно в ссылку на видео. Узнаются плеер YouTube (`/embed/<id>`,
 * `/embed/videoseries?list=`, в том числе `youtube-nocookie.com`) и плееры
 * Twitch (`player.twitch.tv/?video=` или `?channel=`, `clips.twitch.tv/embed`).
 * Параметры плеера (`autoplay`, `parent`, `origin`…) не переносятся.
 */
export function videoLinkFromPlayer(input: string | null | undefined): VideoLink | null {
  const url = input ? toUrl(input) : null;
  if (!url) return null;
  const host = bareHost(url, "www.");
  if (host === "youtube-nocookie.com") {
    return fromYoutube(url, ["youtube-nocookie.com"]);
  }
  if (host === "player.twitch.tv") {
    const video = TWITCH_VIDEO_ID.exec(url.searchParams.get("video") ?? "")?.[1];
    const channel = url.searchParams.get("channel");
    const time = twitchTime(url);
    if (video) {
      return {
        provider: "twitch",
        src: `https://www.twitch.tv/videos/${video}${time ? `?t=${time}` : ""}`,
      };
    }
    return channel && ID.test(channel) ? parseVideoLink(`https://www.twitch.tv/${channel}`) : null;
  }
  if (host === "clips.twitch.tv" && url.pathname === "/embed") {
    const clip = url.searchParams.get("clip");
    return clip && ID.test(clip) ? parseVideoLink(`https://clips.twitch.tv/${clip}`) : null;
  }
  // Ссылка на сам ролик в `src` (YouTube принимает и такое) — обычная ссылка.
  return fromYoutube(url, YOUTUBE_HOSTS) ?? fromTwitch(url);
}

/**
 * Адрес плеера для показа. `parentHost` — имя хоста текущей страницы
 * (`location.hostname`): Twitch не запускает плеер без него. Плеер стартует сразу
 * (`autoplay`): его собирают только после щелчка «Воспроизвести».
 */
export function playerUrl(link: VideoLink, parentHost: string): string | null {
  const url = parseVideoLink(link.src);
  if (!url || url.provider !== link.provider) return null;
  const source = new URL(url.src);
  if (url.provider === "youtube") {
    const list = source.searchParams.get("list");
    if (list) return `https://www.youtube-nocookie.com/embed/videoseries?list=${list}&autoplay=1`;
    const start = source.searchParams.get("t");
    return (
      `https://www.youtube-nocookie.com/embed/${source.searchParams.get("v")}?autoplay=1` +
      (start ? `&start=${start}` : "")
    );
  }
  const parent = encodeURIComponent(parentHost);
  if (source.hostname === "clips.twitch.tv") {
    return (
      `https://clips.twitch.tv/embed?clip=${source.pathname.slice(1)}` +
      `&parent=${parent}&autoplay=true`
    );
  }
  const parts = segments(source);
  const time = source.searchParams.get("t");
  const target = parts[0] === "videos" ? `video=${parts[1]}` : `channel=${parts[0]}`;
  return (
    `https://player.twitch.tv/?${target}&parent=${parent}&autoplay=true` +
    (time ? `&time=${time}` : "")
  );
}

/**
 * Есть ли в HTML Документа блок видео. Блок в очищенном HTML всегда записан как
 * `data-block="video"` в двойных кавычках (так пишет сериализатор DOM), поэтому
 * проверка — подстрока: по ней `RichTextView` решает, нужен ли Остров.
 */
export function hasVideoBlocks(html: string): boolean {
  return html.includes(`data-block="${VIDEO_BLOCK}"`);
}
