"use client";

import { Node } from "@tiptap/core";
import { VideoIcon } from "../../../icons.js";
import { devError } from "../../../lib/dev-warn.js";
import type { InsertItem } from "../../core/insertItems.js";
import type { ToolDescriptor, ToolEngineContext } from "../../core/toolDescriptor.js";
import { loaded } from "../../core/toolLoader.js";
// Только тип: статический импорт модуля втянул бы чанк в «старт».
import type * as VideoChunkModule from "./videoChunk.js";
import { videoLinkOf } from "./videoLink.js";
import { VIDEO_BLOCK, VIDEO_PROVIDERS, type VideoProvider } from "./videoSrc.js";

type VideoChunk = typeof VideoChunkModule;

const loadVideo = () => import("./videoChunk.js");

/**
 * Чанк видео, если он уже загружен. Поповер пункта «Видео» рисуется только при
 * живом движке, а движок с видео создаётся после загрузчика, — поэтому там, где
 * чанк нужен, он уже есть.
 */
const videoChunk = (): VideoChunk | undefined => loaded(loadVideo) as VideoChunk | undefined;

/*
  Форма блока видео для Скелета: тот же узел с тем же разбором `div[data-block]`
  и той же разметкой (`div > a`), но без вида с плеером, плагинов вставки и
  Markdown. Скелет показывает ссылку — то же, что видит читатель без JS.
*/
const VideoShape = Node.create({
  name: VIDEO_BLOCK,
  group: "block",
  atom: true,
  addAttributes: () => ({
    provider: { default: null, rendered: false },
    link: { default: null, rendered: false },
  }),
  parseHTML: () => [
    {
      tag: `div[data-block="${VIDEO_BLOCK}"]`,
      getAttrs: (element) => {
        // Адрес в Документе уже канонический (`videoLinkOf`): Скелету его переписывать незачем.
        const link = videoLinkOf(
          element.getAttribute("data-provider"),
          element.getAttribute("data-src") ?? ""
        );
        return link ? { provider: link.provider, link: link.src } : false;
      },
    },
  ],
  renderHTML: ({ node }) => [
    "div",
    {
      "data-block": VIDEO_BLOCK,
      "data-provider": node.attrs.provider,
      "data-src": node.attrs.link,
    },
    ["a", { href: node.attrs.link, rel: "noopener noreferrer" }, node.attrs.link],
  ],
});

/** Сервисы, включённые в Редакторе: имена Инструментов `youtube` и `twitch` набора. */
const providersOf = (has: ToolEngineContext["has"]): VideoProvider[] =>
  VIDEO_PROVIDERS.filter((provider) => has(provider));

/** Узлы по набору сервисов: один и тот же объект у обоих Инструментов (см. `engineOf`). */
const NODES = new Map<string, ReturnType<VideoChunk["createVideoNode"]>>();

/**
 * Узел `video` общий у двух Инструментов, а Extensions с тем же именем дважды не
 * регистрируются. Оба описания отдают один и тот же объект: набор сервисов узел
 * берёт из `has`, то есть из того, что включено на самом деле, и по нему же его
 * запоминает. Дубль по ссылке `createEditorExtensions` убирает.
 */
const engineOf = ({ has }: ToolEngineContext) => {
  const providers = providersOf(has);
  const key = providers.join();
  let node = NODES.get(key);
  if (!node) {
    // Движок собирается после загрузчика (`load`), так что чанк здесь есть. Нет — Схема
    // остаётся без узла, и блоки видео читаются ссылками, как без Инструмента.
    const chunk = videoChunk();
    if (!chunk) {
      devError("RichTextEditor: the video chunk is not loaded when the engine is built");
      return [];
    }
    NODES.set(key, (node = chunk.createVideoNode(providers)));
  }
  return [node];
};

/**
 * Единственный пункт «Видео» Меню вставки на оба Инструмента (ADR-0071, п. 6).
 * Он стоит в описании каждого, а `insertItemsFor` склеивает записи с одним `id` в
 * одну и сводит их слова для поиска: слово «twitch» находит пункт, только если
 * Twitch включён. Поповер — поле ссылки: сервис определяется по адресу среди
 * включённых.
 */
const videoItem = (alias: VideoProvider): InsertItem => ({
  id: VIDEO_BLOCK,
  section: "insert",
  label: (m) => m.video,
  icon: VideoIcon,
  aliases: [alias, "embed", "player"],
  // Пункт с поповером `run` не зовёт: `applyInsertItem` открывает поповер.
  run: (chain) => chain,
  popover: ({ editor, close }) => {
    const VideoForm = videoChunk()?.VideoForm;
    return VideoForm && <VideoForm editor={editor} onDone={close} />;
  },
});

/**
 * Описание Инструмента сервиса. Оба — одно и то же, кроме имени и слова поиска
 * пункта: блок общий, а сервис решает набор `tools`.
 */
const videoTool = (name: VideoProvider): ToolDescriptor => ({
  name,
  load: loadVideo,
  engine: engineOf,
  skeleton: () => [VideoShape],
  blocks: { [VIDEO_BLOCK]: { plainAtom: true } },
  kitTags: ["div", "a"],
  insertItems: [videoItem(name)],
});

/**
 * Видео по ссылке на описании Инструментов (ADR-0071, ADR-0048: заказчика при
 * выпуске не было, API по расширениям Youtube и Twitch из Tiptap). Расширения
 * Tiptap не подключаются: распознавание ссылок и адрес плеера — код кита
 * (`videoLink.ts`). Вне пресетов: включаются явной записью в `tools`.
 *
 * Блок общий — `video`; какие сервисы разрешены, решает набор `tools`. Extensions
 * ленивые (чанк `videoChunk.ts`), как у таблицы и блока кода: Скелет показывает
 * ссылку, пока чанк идёт.
 */
export const YOUTUBE_TOOL: ToolDescriptor = videoTool("youtube");

export const TWITCH_TOOL: ToolDescriptor = videoTool("twitch");
