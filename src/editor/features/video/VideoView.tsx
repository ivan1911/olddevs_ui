"use client";

import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { cn } from "../../../lib/cn.js";
import type { VideoOptions } from "./video.js";
import { VideoPlayer } from "./VideoPlayer.js";
import { isVideoSrc, type VideoLink } from "./videoSrc.js";

/**
 * Видео в Редакторе: плеер сервиса (`VideoPlayer`) — сразу или, с `autoload: false`,
 * заглушка кита и плеер после щелчка.
 *
 * Хром блока (`contentEditable={false}`): ProseMirror не ставит в него каретку и
 * не читает его за содержимое. Блок — Атом, его выделяет щелчок вне плеера,
 * двигает и удаляет Ручка, как картинку; выделение рисует кольцо роли
 * `--rte-primary`. Щелчки и клавиши ВНУТРИ `iframe` идут плееру, а не Редактору:
 * браузер не отдаёт документу страницы события чужого документа. Поэтому и
 * выделение блока, и стрелки вокруг него работают, пока фокус в Редакторе; чтобы
 * выйти из плеера, достаточно Tab/Shift+Tab, как из любого `iframe`.
 * С `autoload: false` заглушка не обращается к сервису, пока автор не нажал
 * «Воспроизвести»: правка Документа не тянет плеер.
 *
 * Узел с чужой ссылкой (его мог поставить только сырой `ref.editor`) плеер не
 * рисует: остаётся пустая рамка без кнопки.
 */
export function VideoView({ node, selected, extension }: NodeViewProps) {
  const { provider, link } = node.attrs as { provider: VideoLink["provider"]; link: string };
  const autoload = (extension.options as VideoOptions).autoload[provider] ?? true;
  const valid = isVideoSrc(provider, link);
  return (
    <NodeViewWrapper
      data-video-node=""
      contentEditable={false}
      className={cn(
        "rounded-(--rte-radius)",
        selected && "outline-2 outline-offset-2 outline-(--rte-primary)"
      )}
    >
      {valid ? <VideoPlayer link={{ provider, src: link }} autoload={autoload} /> : null}
    </NodeViewWrapper>
  );
}
