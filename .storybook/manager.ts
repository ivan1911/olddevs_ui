import { addons } from "storybook/manager-api";
import { create } from "storybook/theming";
import pkg from "../package.json" with { type: "json" };

/**
 * Шапка боковой панели витрины — как на сайте ui.olddevs.ru: знак, название и
 * версия кита вместо логотипа Storybook. `static/mark.svg` и `static/logo.svg` —
 * копии узкого знака и логотипа главной сайта (`olddevs_ui_site/public/`,
 * собираются из геометрии `src/lib/brand.ts` сайта; правятся там, сюда —
 * копией). Из `static/` они раздаются рядом с витриной, и README берёт
 * логотип с адреса `https://ivan1911.github.io/olddevs_ui/logo.svg`.
 *
 * `brandTitle` Storybook вставляет как HTML. Адрес картинки относительный:
 * витрина живёт и в корне, и в подкаталоге GitHub Pages.
 *
 * Тема — по системной, как и без этого файла: `create` требует `base`, а без
 * него Storybook сам смотрит на `prefers-color-scheme`.
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
