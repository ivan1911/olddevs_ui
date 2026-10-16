import { devError } from "../../../lib/dev-warn.js";
import type { ToolEntry } from "../../core/customTool.js";
import {
  configuredBuiltins,
  repeatedConfigured,
  resolveToolOptions,
  type VideoToolOptions,
} from "../../core/toolOptions.js";
import { VIDEO_PROVIDERS, type VideoProvider } from "./videoSrc.js";

/*
  Опции видео (ADR-0071, п. 4; OLDSUI-287): умолчания, проверки значений и чтение опций
  из `tools`. Модуль серверно-безопасен, без Tiptap и React: описания Инструментов
  берут отсюда умолчания, а `RichTextView` на сервере — опции для своего Острова.
*/

/** Умолчания: плеер встаёт сразу. Одни на `youtube` и `twitch`, каждый Инструмент читает свои. */
export const VIDEO_DEFAULTS: VideoToolOptions = { autoload: true };

/** Проверки значений Опций по имени поля — по одной на поле `VIDEO_DEFAULTS`. */
export const VIDEO_CHECKS: Readonly<Record<string, (value: unknown) => boolean>> = {
  autoload: (value) => typeof value === "boolean",
};

/** Грузится ли плеер сразу, по сервисам: данные, их можно отдать острову через границу RSC. */
export type VideoAutoload = Readonly<Record<VideoProvider, boolean>>;

/**
 * Опция `autoload` каждого сервиса из `tools`: запись `tool("youtube", …)` и
 * `tool("twitch", …)` поверх умолчаний. Читает её тем же `resolveToolOptions`, что
 * Редактор (`expandTools`): неверное значение заменяется умолчанием с тем же
 * `console.error` в разработке; записи нет — умолчание (`true`). Опция сервиса
 * действует на блоки только этого сервиса. Две записи одного Инструмента — ошибка
 * набора, на которой Редактор не стартует; Просмотр не выбирает «первую», а берёт
 * умолчание и сообщает.
 */
export function videoAutoloadOf(tools: readonly ToolEntry[] | undefined): VideoAutoload {
  const configured = configuredBuiltins(tools);
  const autoload = {} as Record<VideoProvider, boolean>;
  for (const provider of VIDEO_PROVIDERS) {
    const own = configured.filter((entry) => entry.name === provider);
    const twice = repeatedConfigured(own);
    if (twice) {
      devError(`RichTextView: tool "${provider}": two tool() entries share this name`);
    }
    autoload[provider] = (
      resolveToolOptions(
        "RichTextView",
        provider,
        VIDEO_DEFAULTS,
        VIDEO_CHECKS,
        twice ? undefined : own[0]
      ) as VideoToolOptions
    ).autoload;
  }
  return autoload;
}
