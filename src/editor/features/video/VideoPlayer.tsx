"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "../../../components/actions/Button.js";
import { useMessages } from "../../../i18n/useMessages.js";
import { PlayIcon } from "../../../icons.js";
import { cn } from "../../../lib/cn.js";
import { playerUrl, VIDEO_PROVIDER_NAME, type VideoLink } from "./videoLink.js";

export interface VideoPlayerProps {
  /** Видео из Документа: сервис и каноническая ссылка. */
  link: VideoLink;
  className?: string;
}

/**
 * Что разрешено плееру: полный экран и воспроизведение — то, чего плеер просит
 * у страницы; камеры, микрофона и геопозиции в списке нет.
 */
const PLAYER_ALLOW = "autoplay; encrypted-media; fullscreen; picture-in-picture; web-share";

/**
 * Плеер видео (ADR-0071): общий вид узла в Редакторе и Острова в Просмотре.
 *
 * ДО ЩЕЛЧКА — ЗАГЛУШКА, И НИ ОДНОГО ЗАПРОСА К СЕРВИСУ. Она рисует только то, что
 * знает Документ: название сервиса, ссылку и кнопку «Воспроизвести». `iframe`
 * появляется после нажатия, и адрес собирается в этот момент (`playerUrl`):
 * Twitch берёт домен текущей страницы из `location`, а не из Документа. Так
 * чтение страницы и правка Документа не отправляют читателя ни в YouTube, ни в
 * Twitch, пока он сам не решил смотреть.
 *
 * ПЛЕЕР — С ЗАГОЛОВКОМ (`title`) для скринридера, `loading="lazy"`, `allow` и
 * `referrerpolicy`. Политика `strict-origin-when-cross-origin`: YouTube не
 * запускает плеер без реферера, а полный адрес страницы сервису не нужен. После
 * щелчка фокус переходит в плеер: кнопка, на которой он стоял, исчезла.
 *
 * Цвета — роли `--rte-*` контейнера Документа: заглушка одинаково выглядит в
 * Редакторе, в `RichTextView` и на листе `paper`.
 */
export function VideoPlayer({ link, className }: VideoPlayerProps) {
  const messages = useMessages().editor;
  const [src, setSrc] = useState<string | null>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const service = VIDEO_PROVIDER_NAME[link.provider];

  useEffect(() => {
    if (src) frame.current?.focus();
  }, [src]);

  return (
    <div
      data-video-player=""
      className={cn(
        "relative aspect-video w-full overflow-hidden rounded-(--rte-radius) border " +
          "border-(--rte-code-border) bg-(--rte-code-background)",
        className
      )}
    >
      {src ? (
        <iframe
          ref={frame}
          src={src}
          title={messages.videoPlayer({ service })}
          loading="lazy"
          allow={PLAYER_ALLOW}
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          className="absolute inset-0 size-full border-0"
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center">
          <span className="text-sm font-semibold text-(--rte-secondary)">{service}</span>
          <Button
            type="button"
            size="sm"
            variant="solid"
            tone="accent"
            icon={<PlayIcon size={14} aria-hidden />}
            aria-label={messages.videoPlayLabel({ service })}
            onClick={() => setSrc(playerUrl(link, window.location.hostname))}
          >
            {messages.videoPlay}
          </Button>
          <span className="max-w-full truncate text-xs text-(--rte-secondary)">{link.src}</span>
        </div>
      )}
    </div>
  );
}
