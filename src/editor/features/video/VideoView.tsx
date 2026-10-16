"use client";

import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { cn } from "../../../lib/cn.js";
import { VideoPlayer } from "./VideoPlayer.js";
import { isVideoSrc, type VideoLink } from "./videoLink.js";

/**
 * Видео в Редакторе: заглушка кита и, после щелчка, плеер (`VideoPlayer`).
 *
 * Хром блока (`contentEditable={false}`): ProseMirror не ставит в него каретку и
 * не читает его за содержимое. Блок — Атом, его выделяет щелчок вне кнопки,
 * двигает и удаляет Ручка, как картинку; выделение рисует кольцо роли
 * `--rte-primary`. Заглушка не обращается к сервису, пока автор не нажал
 * «Воспроизвести»: правка Документа не тянет плеер.
 *
 * Узел с чужой ссылкой (его мог поставить только сырой `ref.editor`) плеер не
 * рисует: остаётся пустая рамка без кнопки.
 */
export function VideoView({ node, selected }: NodeViewProps) {
  const { provider, link } = node.attrs as { provider: VideoLink["provider"]; link: string };
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
      {valid ? <VideoPlayer link={{ provider, src: link }} /> : null}
    </NodeViewWrapper>
  );
}
