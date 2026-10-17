"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "../../../components/actions/Button.js";
import { useMessages } from "../../../i18n/useMessages.js";
import { PlayIcon } from "../../../icons.js";
import { cn } from "../../../lib/cn.js";
import { playerUrl, VIDEO_PROVIDER_NAME, type VideoLink } from "./videoLink.js";

export interface VideoPlayerProps {
  /** Video from the Document: the service and its canonical link. */
  link: VideoLink;
  /**
   * The player renders at once (the `autoload` option of the service's Tool, `true` by default).
   * `false` shows a Play placeholder and makes no request to the service until a click.
   */
  autoload?: boolean;
  className?: string;
}

/**
 * What the player is allowed to do: fullscreen and playback, which the player asks the page for.
 * Camera, microphone and geolocation are not in the list.
 */
const PLAYER_ALLOW = "autoplay; encrypted-media; fullscreen; picture-in-picture; web-share";

/**
 * Player frame: 16:9 across the full width of the column. The same classes are set as rules of
 * the Document container on the server-rendered Block `div[data-block=video]` (`VIDEO_CLASS` in
 * `prose.ts`). The Skeleton's Block and the server HTML of `RichTextView` have the same frame, so
 * the arrival of a chunk or an island does not change the height. The list exists for checking:
 * `tests/rich-text-view-video.test.tsx` compares it with `prose.ts`. Tailwind collects classes
 * from the sources as plain text, so `prose.ts` writes them out as literals instead of building
 * them from this string.
 */
export const PLAYER_FRAME =
  "relative aspect-video w-full overflow-hidden rounded-(--rte-radius) border " +
  "border-(--rte-code-border) bg-(--rte-code-background)";

/**
 * Video player (ADR-0071): the shared look of the node in the Editor and of the island in the View.
 *
 * BY DEFAULT THE PLAYER RENDERS AT ONCE (`autoload`, OLDSUI-287): an `iframe` with an address
 * that is built at display time (`playerUrl`). Twitch takes the domain of the current page from
 * `location`, not from the Document. An empty placeholder in place of the video looked broken.
 * `loading="lazy"` defers the request to the service until the frame nears the screen. There is
 * no autoplay: the player is on the page, but it does not play.
 *
 * WITH `autoload: false` THE PLACEHOLDER IS SHOWN, AND THERE IS NOT A SINGLE REQUEST TO THE
 * SERVICE UNTIL A CLICK. It renders only what the Document knows: the service name, the link, and
 * the Play button. The `iframe` appears after the click and starts at once. So reading the page
 * or editing the Document does not send the reader to YouTube or Twitch until they decide to
 * watch. This is for screens where privacy matters.
 *
 * THE PLAYER HAS A TITLE (`title`) for the screen reader, `loading="lazy"`, `allow` and
 * `referrerpolicy`. The policy is `strict-origin-when-cross-origin`: YouTube does not start the
 * player without a referrer, and the service does not need the full page address. After the
 * click, focus moves into the player, because the button it was on has disappeared. The player
 * that appears does not take focus itself.
 *
 * IF THE PLAYER ADDRESS CANNOT BE BUILT (`playerUrl` returned `null`), a link to the video stays
 * in place of the player (or the button), so the video can be opened at the service.
 *
 * Colors are the `--rte-*` roles of the Document container: the frame looks the same in the
 * Editor, in `RichTextView`, and on the `paper` surface.
 */
export function VideoPlayer({ link, autoload = true, className }: VideoPlayerProps) {
  const messages = useMessages().editor;
  // The address after a click. With `autoload` there is none: the player is built from the Document itself.
  const [clicked, setClicked] = useState<string | null>(null);
  const [clickFailed, setClickFailed] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);
  const service = VIDEO_PROVIDER_NAME[link.provider];
  // The player and the island mount only on the client (the node view, the portal after an
  // effect), so `location` is available here. The server `RichTextView` renders the link, not this component.
  const auto = autoload ? playerUrl(link, window.location.hostname, false) : null;
  const src = autoload ? auto : clicked;
  const unavailable = autoload ? auto === null : clickFailed;

  useEffect(() => {
    if (clicked) frame.current?.focus();
  }, [clicked]);

  return (
    <div data-video-player="" className={cn(PLAYER_FRAME, className)}>
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
          {unavailable ? (
            <a
              href={link.src}
              rel="noopener noreferrer"
              className="max-w-full truncate text-sm text-(--rte-link) underline underline-offset-2"
            >
              {link.src}
            </a>
          ) : (
            <>
              <Button
                type="button"
                size="sm"
                variant="solid"
                tone="accent"
                icon={<PlayIcon size={14} aria-hidden />}
                aria-label={messages.videoPlayLabel({ service })}
                onClick={() => {
                  const url = playerUrl(link, window.location.hostname);
                  if (url) setClicked(url);
                  else setClickFailed(true);
                }}
              >
                {messages.videoPlay}
              </Button>
              <span className="max-w-full truncate text-xs text-(--rte-secondary)">{link.src}</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
