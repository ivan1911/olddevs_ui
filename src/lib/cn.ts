import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * Class merge that resolves conflicts and knows the kit's scale.
 *
 * The stock `twMerge` sorts `text-*` into groups by looking at the suffix: a t-shirt size (`sm`, `md`,
 * `2xl`) or an arbitrary length is a font size, everything else is a color. The `caption` step does not
 * fit that rule, so `text-caption` landed in the COLOR group and conflicted with `text-fg-2`:
 *
 *     twMerge("text-caption", "text-fg-2") === "text-fg-2"   // the size is dropped
 *     twMerge("text-fg-2", "text-caption") === "text-caption" // the color is dropped
 *
 * Silently, with no build error, and the result depended on the argument order. So `Text size="caption"`
 * rendered with the inherited font size, and `Kbd` lost its color.
 *
 * The other six steps (`xs`, `sm`, `md`, `lg`, `xl`, `2xl`) are legitimate t-shirt sizes, and `twMerge`
 * parses them itself.
 *
 * `rounded-control` is a second such step, and exactly the same case. The control radius is named by
 * role, not by size (see `--r-control` in styles.css), so the t-shirt rule does not fit it. Without the
 * registration below, `twMerge` does not recognize it as a radius at all and stops resolving the
 * conflict: `cn("rounded-control", "rounded-full")` would return BOTH classes, and the one that comes
 * later in the CSS would win, not the one passed last.
 */
const merge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: ["caption"] }],
      rounded: [{ rounded: ["control"] }],
    },
  },
});

/**
 * Merge of Tailwind classes with conflict resolution: the last one wins.
 * Moved from `src/lib/utils.js` of the front-end app. The application utilities stay there
 * (formatFileSize, maskTime, normalizeTime, pluralize), because the package does not need them.
 *
 * Exported on purpose: the consumer has its own `cn` on bare `twMerge`, and `cn("text-caption", "text-fg-2")`
 * breaks there in exactly the same way. Build "scale step + color" pairs with this function.
 */
export function cn(...inputs: ClassValue[]): string {
  return merge(clsx(inputs));
}
