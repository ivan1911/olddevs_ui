"use client";

import { Link as TiptapLink, type LinkOptions } from "@tiptap/extension-link";
import { isAllowedLinkHref } from "../../core/schema.js";

/** `rel` каждой ссылки Документа: страница показа не отдаёт ей ни `opener`, ни `Referer`. */
export const LINK_REL = "noopener noreferrer";

/** Есть ли у адреса схема (`https:`, `mailto:`, `javascript:`…). */
const SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/**
 * Ссылка Документа — `Link` Tiptap, суженный до Схемы кита.
 *
 * ПОЧЕМУ `extend`, А НЕ `StarterKit.configure({ link })`. Опциями не убрать
 * лишнее из РАЗБОРА: атрибуты `target`, `class`, `title` и чужой `rel` Tiptap
 * читает из входящего `<a>` сам и отдаёт обратно, а `isAllowedUri` по
 * умолчанию пропускает относительные адреса и десяток схем (`ftp`, `tel`,
 * `sms`…). Здесь у Метки один атрибут — `href`, а `rel` пишется на выходе.
 *
 * АДРЕС ПРОВЕРЯЕТСЯ НА КАЖДОМ ВХОДЕ, и входы разные:
 *
 * - `<a href>` из `value` и вставки HTML — `parseHTML`, строго по Схеме;
 * - Markdown (`[текст](адрес)`) приходит JSON-ом мимо `parseHTML` —
 *   `parseMarkdown` снимает ссылку с чужим адресом, текст остаётся;
 * - автоссылка при наборе и адрес из буфера — значение linkify, у него часто
 *   нет схемы (`example.com`): схему подставит `defaultProtocol`, поэтому
 *   `isAllowedUri` отсекает только ЯВНУЮ чужую схему;
 * - вставка адреса поверх выделения (`linkOnPaste`) `isAllowedUri` не зовёт
 *   вовсе — её закрывает `shouldAutoLink`;
 * - на выходе `renderHTML` ещё раз сверяет адрес: Метку с чужим адресом мог
 *   поставить только сырой `ref.editor`, и в HTML она уходит без `href`.
 *
 * `Mod+K` и поповер адреса — не здесь: это кнопка описания Инструмента
 * (`linkTool.tsx`), и клавишу кнопки вешает кит (`toolButtons.ts`).
 */
export const RichLink = TiptapLink.extend<LinkOptions>({
  addOptions() {
    const parent = this.parent!();
    return {
      ...parent,
      // В Редакторе ссылка не открывается по щелчку: щелчок ставит каретку,
      // как в любом тексте. Адрес видно и правят в поповере.
      openOnClick: false,
      autolink: true,
      linkOnPaste: true,
      defaultProtocol: "https",
      HTMLAttributes: { rel: LINK_REL },
      isAllowedUri: (url) => {
        const trimmed = url.trim();
        return !SCHEME.test(trimmed) || isAllowedLinkHref(trimmed);
      },
      shouldAutoLink: (url) => {
        const trimmed = url.trim();
        if (SCHEME.test(trimmed) && !isAllowedLinkHref(trimmed)) return false;
        return parent.shouldAutoLink(url);
      },
    };
  },

  addAttributes() {
    return {
      href: {
        default: null,
        parseHTML: (element) => element.getAttribute("href")?.trim() ?? null,
        // `rel` — константа выхода, а не атрибут Метки: см. `renderHTML`.
        renderHTML: (attributes) => ({ href: attributes.href }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "a[href]",
        getAttrs: (dom) => (isAllowedLinkHref(dom.getAttribute("href") ?? "") ? null : false),
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const href = typeof HTMLAttributes.href === "string" ? HTMLAttributes.href : "";
    return ["a", isAllowedLinkHref(href) ? { href, rel: LINK_REL } : { rel: LINK_REL }, 0];
  },

  parseMarkdown: (token, helpers) => {
    const content = helpers.parseInline(token.tokens ?? []);
    const href = typeof token.href === "string" ? token.href.trim() : "";
    return isAllowedLinkHref(href) ? helpers.applyMark("link", content, { href }) : content;
  },
});

/** Похоже на адрес почты без схемы: `team@example.com`. */
const BARE_EMAIL = /^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/;

/**
 * Адрес из поля поповера — в адрес ссылки, или `null`, если такой ссылке в
 * Документе не быть.
 *
 * Человек пишет адрес так, как видит его в строке браузера: `example.com`, а
 * не `https://example.com`. Адрес без схемы поэтому получает `https://`, а
 * похожий на почту — `mailto:`. Однозначно это потому, что относительных
 * адресов Схема не принимает (`RICH_TEXT_SCHEMA.protocols`): начинающийся с
 * `/`, `#`, `?` или `.` адрес — ошибка, а не путь от текущей страницы.
 */
export function normalizeLinkInput(input: string): string | null {
  const value = input.trim();
  if (!value || /\s/.test(value)) return null;
  if (SCHEME.test(value)) return isAllowedLinkHref(value) ? value : null;
  if (/^[/#?.]/.test(value)) return null;
  return BARE_EMAIL.test(value) ? `mailto:${value}` : `https://${value}`;
}
