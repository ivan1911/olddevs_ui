// @vitest-environment jsdom
import createDOMPurify from "dompurify";
import { expect, test } from "vitest";
import {
  RICH_TEXT_SCHEMA,
  richTextSanitizeConfig,
  sanitizeRichText,
} from "../src/editor/schema-entry.js";
import {
  isPrimaryLanguage,
  normalizeLanguageTag,
  quoteSetOfLanguage,
} from "../src/editor/features/language/languageTag.js";

/**
 * The Text part language Mark in the Schema and the sanitizer (OLDSUI-308, ADR-0078): `span[lang]`
 * with any tag of the BCP 47 shape, on a real DOMPurify as on the consumer's server.
 */

const purify = createDOMPurify(window);
const clean = (html: string) => sanitizeRichText(html, purify);

test("the Schema lists span[lang] as data", () => {
  expect(RICH_TEXT_SCHEMA.attributes.span).toContain("lang");
});

test("a tag of the right shape passes on a span, whatever the language", () => {
  for (const tag of [
    "en",
    "ru",
    "de",
    "en-US",
    "zh-Hant-TW",
    "es-419",
    "de-CH-1996",
    "sr-Latn-RS",
  ]) {
    const html = `<p>a <span lang="${tag}">b</span></p>`;
    expect(clean(html), tag).toBe(html);
  }
});

test("the tag is written in its canonical case", () => {
  expect(clean('<p><span lang="EN-US">a</span> <span lang="zh-hant-tw">b</span></p>')).toBe(
    '<p><span lang="en-US">a</span> <span lang="zh-Hant-TW">b</span></p>'
  );
});

test("a value that is not a tag loses the attribute, and the text stays", () => {
  for (const value of [
    "",
    "x-none",
    "english",
    "e",
    "en US",
    "en-",
    "<b>",
    "a".repeat(40),
    "en_US",
  ]) {
    expect(clean(`<p>a <span lang="${value.replace(/"/g, "")}">b</span> c</p>`), value).toBe(
      "<p>a b c</p>"
    );
  }
});

test("lang is a span attribute only: other tags lose it", () => {
  expect(clean('<p lang="en">a</p><h2 lang="ru">b</h2><strong lang="de">c</strong>')).toBe(
    "<p>a</p><h2>b</h2><strong>c</strong>"
  );
  expect(clean('<p><a href="https://example.com" lang="en">x</a></p>')).toBe(
    '<p><a href="https://example.com" rel="noopener noreferrer">x</a></p>'
  );
});

test("span[lang] is not unwrapped, and it keeps company with a color and other Marks", () => {
  const nested =
    '<p><span lang="en"><span data-color="danger"><strong>hi</strong></span></span></p>';
  expect(clean(nested)).toBe(nested);
  const same = '<p><span lang="en" data-color="danger">hi</span></p>';
  expect(clean(same)).toBe(same);
  // A plain span without any attribute is still a stray wrapper.
  expect(clean("<p><span>hi</span></p>")).toBe("<p>hi</p>");
});

test("a language on a formula or inside the task markup is not a language mark", () => {
  expect(clean('<p><span data-type="inline-math" data-latex="x" lang="en"></span></p>')).toBe(
    '<p><span data-type="inline-math" data-latex="x"></span></p>'
  );
});

test("the bare config has no lang: the value is checked only by the hooks", () => {
  expect(richTextSanitizeConfig().ALLOWED_ATTR).not.toContain("lang");
  const bare = purify.sanitize('<p>a <span lang="en">b</span></p>', richTextSanitizeConfig());
  expect(bare).not.toContain("lang");
});

test("normalizeLanguageTag: case, whitespace and non-strings", () => {
  expect(normalizeLanguageTag(" EN-us ")).toBe("en-US");
  expect(normalizeLanguageTag("RU")).toBe("ru");
  expect(normalizeLanguageTag("ZH-HANS-cn")).toBe("zh-Hans-CN");
  expect(normalizeLanguageTag("en-u-ca-gregory")).toBe("en-u-ca-gregory");
  expect(normalizeLanguageTag("X-NONE")).toBeNull();
  expect(normalizeLanguageTag(null)).toBeNull();
  expect(normalizeLanguageTag(42)).toBeNull();
});

test("isPrimaryLanguage: the bare language covers its regions, not the other way round", () => {
  expect(isPrimaryLanguage("en", "en-US")).toBe(true);
  expect(isPrimaryLanguage("en-US", "en-US")).toBe(true);
  expect(isPrimaryLanguage("en-GB", "en-US")).toBe(false);
  expect(isPrimaryLanguage("en-US", "en")).toBe(false);
  expect(isPrimaryLanguage("de", "en")).toBe(false);
});

test("quoteSetOfLanguage knows the two catalog languages", () => {
  expect(quoteSetOfLanguage("en-GB")).toBe("en");
  expect(quoteSetOfLanguage("ru")).toBe("ru");
  expect(quoteSetOfLanguage("de")).toBeNull();
});
