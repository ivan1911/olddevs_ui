---
"@olddevs/ui": minor
---

English is now the source of the kit's text. The Reference in `docs/` is English only (the `*.en.md` pairs are gone; the Russian Translation lives on the documentation site), `README.ru.md` is a Translation of `README.md`, and the JSDoc shown in editor hovers and in the `.d.ts` files is English, so the hints are readable for every consumer. The glossary (`docs/glossary.md`) is the English source of the kit's terms. No runtime behavior and no public API changed; the Russian message catalog (`locales/ru`) is unchanged. The `docs:translations` script and `tests/docs-translations.test.ts` are removed, and `tests/i18n-gate.test.ts` now also forbids Cyrillic in `docs/` and `README.md` and counts Russian comments per file (`tests/comment-debt.json`, now empty).
