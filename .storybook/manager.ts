import { addons } from "storybook/manager-api";
import { create } from "storybook/theming";
import pkg from "../package.json" with { type: "json" };

/**
 * The header of the showcase's sidebar, as on the ui.olddevs.ru site: the mark, the name and
 * the kit version instead of the Storybook logo. `static/mark.svg` and `static/logo.svg` are
 * copies of the narrow mark and the logo from the site's home page (`olddevs_ui_site/public/`,
 * built from the geometry in the site's `src/lib/brand.ts`; they are edited there and copied
 * here by hand). They are served from `static/` next to the showcase, and the README takes the
 * logo from `https://ivan1911.github.io/olddevs_ui/logo.svg`.
 *
 * Storybook inserts `brandTitle` as HTML. The image address is relative: the showcase lives
 * both at the root and in a subdirectory of GitHub Pages.
 *
 * The theme follows the system setting, as it would without this file: `create` requires
 * `base`, and without it Storybook checks `prefers-color-scheme` itself.
 */
const base = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";

addons.setConfig({
  theme: create({
    base,
    brandTitle:
      '<span style="display:inline-flex;align-items:center;gap:6px">' +
      '<img src="mark.svg" alt="" width="12" height="18">' +
      `Olddevs UI<span style="font-weight:400;font-size:12px;opacity:.6">${pkg.version}</span></span>`,
    brandUrl: "https://ui.olddevs.ru",
    brandTarget: "_blank",
  }),
});
