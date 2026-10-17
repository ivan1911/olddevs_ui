/**
 * Surface of the Document area.
 *
 * - `"theme"` (default) — the Document follows the app theme, as in Notion,
 *   Confluence and Slack.
 * - `"paper"` — a light sheet in any app theme (dark, dim, brand), like "Switch
 *   Mode" in Word: text, links, markers, tables, code and author colors look as
 *   in the light theme. The Toolbar, popovers, menus and dialogs stay in the app
 *   theme, and so does the field focus ring.
 *
 * The module is server-safe: it holds data and a type, with no React and no engine.
 */
export type RichTextSurface = "theme" | "paper";

/**
 * Attributes of the Document container. `data-theme="light"` is a nested theme for
 * whatever is declared on `[data-theme]` of any element: markers (`--marker-*`)
 * and the code highlighting theme (`styles.css`). The sheet gets its `--rte-*`
 * roles from a class (`EDITOR_PAPER_TOKENS_CLASS`), because the kit's tokens do
 * not react to the nested theme. `data-surface` is for the consumer and the tests:
 * no styles are attached to it.
 */
export function surfaceAttributes(surface: RichTextSurface): Record<string, string> {
  return surface === "paper" ? { "data-surface": "paper", "data-theme": "light" } : {};
}
