"use client";

import type { JSONContent } from "@tiptap/core";
import type { Schema } from "@tiptap/pm/model";
import { isVideoProvider, isVideoSrc, VIDEO_BLOCK } from "./videoSrc.js";

/*
  БЛОК ВИДЕО БЕЗ ИНСТРУМЕНТОВ `youtube` И `twitch` — ССЫЛКОЙ (ADR-0071, «поведение
  без Инструмента»).

  HTML, Markdown и вставка уже читают такой блок как его ссылку: `div` снимается
  разбором, остаётся `a`. JSON-конверт идёт мимо разбора HTML, и узел `video`,
  которого нет в Схеме, `conformToSchema` разворачивал в его содержимое — а у
  Атома его нет, так что ссылка пропадала молча. Здесь он становится абзацем со
  ссылкой (или с адресом текстом, если Инструмента `link` нет), как формула без
  `mathematics` становится текстом (`mathAsText.ts`).
*/

/**
 * Узел `video` из JSON — абзацем со ссылкой на видео. `null` — это не блок видео
 * или его сервис и адрес не годятся (`isVideoSrc`): чужой адрес не оживает ссылкой.
 * Зовёт `conformToSchema`, когда узла `video` в Схеме нет.
 */
export function videoJsonAsLink(node: JSONContent, schema: Schema): JSONContent[] | null {
  if (node.type !== VIDEO_BLOCK) return null;
  const { provider, link } = (node.attrs ?? {}) as { provider?: unknown; link?: unknown };
  if (!isVideoProvider(provider) || typeof link !== "string" || !isVideoSrc(provider, link)) {
    return null;
  }
  const text: JSONContent = { type: "text", text: link };
  if (schema.marks.link) text.marks = [{ type: "link", attrs: { href: link } }];
  return [{ type: "paragraph", content: [text] }];
}
