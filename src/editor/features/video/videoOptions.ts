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
  Video options (ADR-0071, item 4; OLDSUI-287): defaults, value checks, and reading options from
  `tools`. The module is safe to run on the server, with no Tiptap and no React: Tool descriptions
  take their defaults from here, and `RichTextView` on the server takes the options for its island.
*/

/** Defaults: the player renders at once. One value serves both `youtube` and `twitch`; each Tool reads its own. */
export const VIDEO_DEFAULTS: VideoToolOptions = { autoload: true };

/** Value checks for the Options, by field name: one per field of `VIDEO_DEFAULTS`. */
export const VIDEO_CHECKS: Readonly<Record<string, (value: unknown) => boolean>> = {
  autoload: (value) => typeof value === "boolean",
};

/** Whether the player loads at once, per service. Data: it can be passed to the island across the RSC boundary. */
export type VideoAutoload = Readonly<Record<VideoProvider, boolean>>;

/**
 * The `autoload` option of each service, from `tools`: the `tool("youtube", …)` and
 * `tool("twitch", …)` entries over the defaults. It is read with the same `resolveToolOptions`
 * as the Editor uses (`expandTools`): an invalid value is replaced by the default, with the same
 * `console.error` in development. Without an entry the default applies (`true`). A service option
 * applies only to the Blocks of that service. Two entries for one Tool are a configuration error
 * that stops the Editor from starting. The View does not select the first one: it takes the
 * default and reports it.
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
