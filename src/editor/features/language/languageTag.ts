import type { EditorQuoteSet } from "../../../i18n/messages.js";

/*
  Language tags of the `language` Tool (ADR-0078). The module is server-safe: pure functions over a
  string, with no React and no engine, because the Schema's sanitizer (`core/schema.ts`) checks and
  normalizes `span[lang]` with them on the consumer's server, next to the Editor.
*/

/**
 * The SHAPE of a BCP 47 language tag, not a list of languages (RFC 5646, section 2.1): a language
 * subtag, up to three extended-language subtags, a script, a region, variants, extensions and a
 * private-use tail. The Schema lets any tag of this shape through: HTML from another screen or from
 * Word carries `lang="de"` or `lang="zh-Hant-TW"`, and the server's sanitizer has no Options of the
 * screen to ask which languages the menu offers. Grandfathered tags (`i-klingon`) and Word's
 * `X-NONE` (no proofing language) have no such shape and are not accepted.
 *
 * The case does not matter: `EN-US` has the shape too, and `normalizeLanguageTag` writes it as `en-US`.
 */
export const LANGUAGE_TAG_PATTERN =
  "[a-z]{2,3}(?:-[a-z]{3}){0,3}(?:-[a-z]{4})?(?:-(?:[a-z]{2}|\\d{3}))?" +
  "(?:-(?:[a-z\\d]{5,8}|\\d[a-z\\d]{3}))*(?:-[0-9a-wy-z](?:-[a-z\\d]{2,8})+)*(?:-x(?:-[a-z\\d]{1,8})+)?";

const LANGUAGE_TAG = new RegExp(`^${LANGUAGE_TAG_PATTERN}$`, "i");

/** A tag longer than this is never a language: it keeps a hostile attribute from being stored. */
const MAX_TAG_LENGTH = 35;

/**
 * The tag in the canonical case of RFC 5646 (`EN-US` → `en-US`, `zh-hant-tw` → `zh-Hant-TW`), or
 * `null` if the value does not have the shape of a tag. Surrounding whitespace is ignored, as the
 * browser ignores it in `lang`.
 */
export function normalizeLanguageTag(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const tag = value.trim();
  if (tag.length > MAX_TAG_LENGTH || !LANGUAGE_TAG.test(tag)) return null;
  let tail = false;
  return tag
    .split("-")
    .map((subtag, index) => {
      if (index === 0) return subtag.toLowerCase();
      // From the first extension singleton on, subtags are lowercase (RFC 5646, section 2.1.1).
      if (tail || subtag.length === 1) {
        tail = true;
        return subtag.toLowerCase();
      }
      if (subtag.length === 4 && /^[a-z]+$/i.test(subtag)) {
        return subtag[0]!.toUpperCase() + subtag.slice(1).toLowerCase();
      }
      if (subtag.length === 2 && /^[a-z]+$/i.test(subtag)) return subtag.toUpperCase();
      return subtag.toLowerCase();
    })
    .join("-");
}

/**
 * Whether a mark with the tag `tag` repeats the page's language `primary`, so it adds nothing for the
 * reader: the same tag, or the bare language of a regional one (`en` on a page in `en-US`). A more
 * specific tag (`en-GB` on a page in `en`) is a real mark. Both are normalized, and the case is ignored.
 */
export function isPrimaryLanguage(tag: string, primary: string): boolean {
  const own = tag.toLowerCase();
  const page = primary.toLowerCase();
  return own === page || page.startsWith(`${own}-`);
}

/**
 * The quote set of a language for the `typography` Tool: `en…` gives curly quotes, `ru…` gives guillemets.
 * `null` means the kit has no set for the language, and the Tool uses its usual one.
 */
export function quoteSetOfLanguage(tag: string): EditorQuoteSet | null {
  const language = tag.split("-")[0]?.toLowerCase();
  return language === "en" || language === "ru" ? language : null;
}
