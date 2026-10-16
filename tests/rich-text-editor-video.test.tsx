// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import type { Editor } from "@tiptap/react";
import createDOMPurify from "dompurify";
import { createRef } from "react";
import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";
import { UiProvider } from "../src/i18n/UiProvider.js";
import { messages as ru } from "../src/locales/ru.js";
import {
  RichTextEditor,
  type RichTextEditorHandle,
  type RichTextEditorProps,
} from "../src/editor/index.js";
import { sanitizeRichText } from "../src/editor/schema-entry.js";
import { PRESETS, TOOLS } from "../src/editor/core/tools.js";
import { loadLazyBuiltins } from "./editor-lazy-builtins.js";

/**
 * Видео по ссылке (OLDSUI-281, ADR-0071): Инструменты `youtube` и `twitch`.
 *
 * Через публичный `RichTextEditor` и `sanitizeRichText`: вставка — Меню вставки,
 * вставка из буфера и `Enter`, результат — выходной HTML и Markdown Хэндла.
 * Каретка ставится командами движка: jsdom не умеет ввода в `contenteditable`.
 * Чанк видео ленивый, поэтому файл прогревает его один раз.
 */

const purify = createDOMPurify(window);

const YT = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
const TW = "https://www.twitch.tv/videos/1234567890";
const BOTH = ["youtube", "twitch"] as const;
const FULL_PLUS_VIDEO = [...PRESETS.full, ...BOTH];

/** Блок так, как его пишет Редактор. */
const escaped = (value: string) => value.replace(/&/g, "&amp;");
const video = (provider: string, src: string) =>
  `<div data-block="video" data-provider="${provider}" data-src="${escaped(src)}">` +
  `<a href="${escaped(src)}" rel="noopener noreferrer">${escaped(src)}</a></div>`;

// Ленивые `codeBlock`, `table` и видео: Редактор готов в `render` после загрузки чанков.
beforeAll(loadLazyBuiltins);

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderEditor(props: Partial<RichTextEditorProps> = {}) {
  const ref = createRef<RichTextEditorHandle>();
  const view = render(<RichTextEditor ref={ref} aria-label="Body" tools={[...BOTH]} {...props} />);
  const editor = ref.current?.editor;
  if (!editor) throw new Error("the editor was not created inside render()");
  return { ...view, editor, handle: ref.current! };
}

describe("the document form and the round trip", () => {
  test("a video block survives value → engine → HTML → sanitizer → value without loss", () => {
    const value = `<p>before</p>${video("youtube", YT)}${video("twitch", TW)}<p>after</p>`;
    const first = renderEditor({ defaultValue: value });
    const html = first.editor.getHTML();
    expect(html).toBe(value);
    const cleaned = sanitizeRichText(html, purify, [...BOTH]);
    expect(cleaned).toBe(value);
    first.unmount();
    const second = renderEditor({ defaultValue: cleaned });
    expect(second.editor.getHTML()).toBe(value);
  });
});

// ── Помощники ────────────────────────────────────────────────────────────

function focusField() {
  act(() => screen.getByRole("textbox", { name: "Body" }).focus());
}

/** Каретка — в конец текста `text` (или в его начало). */
function caretIn(editor: Editor, text: string, at: "end" | "start" = "end") {
  let found = -1;
  editor.state.doc.descendants((node, pos) => {
    if (found < 0 && node.isText && node.text === text) {
      found = at === "end" ? pos + node.nodeSize : pos;
    }
  });
  if (found < 0) throw new Error(`no text "${text}" in the document`);
  act(() => void editor.commands.setTextSelection(found));
}

function type(editor: Editor, text: string) {
  act(() => void editor.commands.insertContent(text));
}

/** `keydown` на документе; `true` — Редактор отпустил клавишу браузеру. */
function press(editor: Editor, key: string, init: KeyboardEventInit = {}) {
  const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init });
  act(() => void editor.view.dom.dispatchEvent(event));
  return !event.defaultPrevented;
}

/** Вставка текста из буфера: событие `paste` с `clipboardData`, как у браузера. */
function pasteText(editor: Editor, text: string) {
  const event = new Event("paste", { bubbles: true, cancelable: true }) as ClipboardEvent;
  Object.defineProperty(event, "clipboardData", {
    value: { getData: (type: string) => (type === "text/plain" ? text : "") },
  });
  act(() => void editor.view.dom.dispatchEvent(event));
  return event.defaultPrevented;
}

function pasteHtml(editor: Editor, html: string) {
  act(() => void editor.view.pasteHTML(html, new Event("paste") as ClipboardEvent));
}

const link = (href: string) => `<a href="${href}" rel="noopener noreferrer">${href}</a>`;

// ── Без Инструмента блок становится ссылкой ────────────────────────────────

describe("a video block in value without its tool", () => {
  const value = `<p>before</p>${video("youtube", YT)}<p>after</p>`;

  test.each([
    ["no video tools, link on", [...PRESETS.full]],
    ["the other service only", [...PRESETS.full, "twitch"] as const],
  ])("%s: the block becomes its link, never nothing", (_name, tools) => {
    const { editor } = renderEditor({ tools: [...tools], defaultValue: value });
    expect(editor.getHTML()).toBe(`<p>before</p><p>${link(YT)}</p><p>after</p>`);
  });

  test("without the link tool the link is plain text", () => {
    const { editor } = renderEditor({ tools: ["bold"], defaultValue: value });
    expect(editor.getHTML()).toBe(`<p>before</p><p>${YT}</p><p>after</p>`);
  });

  test("the other service keeps its own block next to the degraded one", () => {
    const { editor } = renderEditor({
      tools: [...PRESETS.full, "twitch"],
      defaultValue: `${video("youtube", YT)}${video("twitch", TW)}`,
    });
    expect(editor.getHTML()).toBe(`<p>${link(YT)}</p>${video("twitch", TW)}`);
  });

  describe("the same document as a JSON envelope", () => {
    /** Конверт Редактора, у которого есть оба сервиса: в нём лежат узлы `video`. */
    const envelope = () => {
      const source = renderEditor({
        defaultValue: `<p>before</p>${video("youtube", YT)}${video("twitch", TW)}<p>after</p>`,
      });
      const json = source.handle.getJSON();
      cleanup();
      return json as never;
    };

    test.each([
      ["no video tools, link on", [...PRESETS.full]],
      ["the other service only", [...PRESETS.full, "twitch"] as const],
    ])("%s: the YouTube node becomes its link, never nothing", (_name, tools) => {
      const json = envelope();
      const { editor } = renderEditor({ tools: [...tools], defaultValue: json });
      const html = editor.getHTML();
      expect(html).toContain(link(YT));
      expect(html).not.toContain('data-provider="youtube"');
    });

    test("with no video tool both nodes keep their links", () => {
      const { editor } = renderEditor({ tools: [...PRESETS.full], defaultValue: envelope() });
      expect(editor.getHTML()).toBe(
        `<p>before</p><p>${link(YT)}</p><p>${link(TW)}</p><p>after</p>`
      );
    });

    test("setJSON on a live editor does the same", () => {
      const json = envelope();
      const { editor, handle } = renderEditor({ tools: [...PRESETS.full] });
      act(() => void handle.setJSON(json));
      expect(editor.getHTML()).toContain(link(YT));
      expect(editor.getHTML()).toContain(link(TW));
    });

    test("without the link tool the URL stays as text", () => {
      const { editor } = renderEditor({ tools: ["bold"], defaultValue: envelope() });
      expect(editor.getHTML()).toBe(`<p>before</p><p>${YT}</p><p>${TW}</p><p>after</p>`);
    });

    test("a node of a foreign address is dropped to nothing dangerous", () => {
      const json = {
        format: "olddevs-rich-text",
        version: 1,
        doc: {
          type: "doc",
          content: [
            { type: "video", attrs: { provider: "youtube", link: "https://evil.example/x" } },
          ],
        },
      } as never;
      const { editor } = renderEditor({ tools: [...PRESETS.full], defaultValue: json });
      expect(editor.getHTML()).not.toContain("data-block");
      expect(editor.getHTML()).not.toContain("evil.example");
    });
  });

  test("a foreign host in data-src is not a block: its inner link stays", () => {
    const { editor } = renderEditor({
      tools: FULL_PLUS_VIDEO,
      defaultValue:
        '<div data-block="video" data-provider="youtube" data-src="https://evil.example/x">' +
        '<a href="https://evil.example/x">x</a></div>',
    });
    expect(editor.getHTML()).not.toContain("data-block");
    expect(editor.getHTML()).toContain("https://evil.example/x");
  });

  test("an iframe in the value never reaches the document", () => {
    const { editor } = renderEditor({
      defaultValue: '<p>a</p><iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe>',
    });
    expect(editor.getHTML()).not.toMatch(/iframe/);
  });
});

// ── Пресеты: вне full и basic ──────────────────────────────────────────────

describe("out of the presets", () => {
  test("neither full nor basic names the video tools", () => {
    expect(PRESETS.full).not.toContain("youtube");
    expect(PRESETS.full).not.toContain("twitch");
    expect(PRESETS.basic).not.toContain("youtube");
    expect(PRESETS.basic).not.toContain("twitch");
    expect(TOOLS).toContain("youtube");
    expect(TOOLS).toContain("twitch");
  });

  test("full does not offer «Video» in the insert menu and its document degrades blocks to links", () => {
    const { editor } = renderEditor({
      tools: undefined,
      preset: "full",
      defaultValue: video("youtube", YT),
    });
    focusField();
    expect(editor.getHTML()).toBe(`<p>${link(YT)}</p>`);
    type(editor, "/video");
    expect(screen.queryByRole("option", { name: "Video" })).toBeNull();
  });
});

// ── Меню вставки: один пункт «Видео» ──────────────────────────────────────

async function openVideoPopover(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Insert block" }));
  await user.click(screen.getByRole("menuitem", { name: "Video" }));
  return screen.findByRole("textbox", { name: "Video link" });
}

describe("the insert menu", () => {
  test("has one «Video» item for both services, and none without the tools", async () => {
    const user = userEvent.setup();
    renderEditor({ tools: FULL_PLUS_VIDEO });
    await user.click(screen.getByRole("button", { name: "Insert block" }));
    expect(screen.getAllByRole("menuitem", { name: "Video" })).toHaveLength(1);
    cleanup();

    renderEditor({ tools: [...PRESETS.full] });
    await user.click(screen.getByRole("button", { name: "Insert block" }));
    expect(screen.queryByRole("menuitem", { name: "Video" })).toBeNull();
  });

  test.each([
    ["youtube only", [...PRESETS.full, "youtube"]],
    ["twitch only", [...PRESETS.full, "twitch"]],
  ])("%s: the item is there, once", async (_name, tools) => {
    const user = userEvent.setup();
    renderEditor({ tools: tools as RichTextEditorProps["tools"] });
    await user.click(screen.getByRole("button", { name: "Insert block" }));
    expect(screen.getAllByRole("menuitem", { name: "Video" })).toHaveLength(1);
  });

  test("the slash menu finds it by its words, the service name only when that service is on", () => {
    const { editor } = renderEditor({ tools: [...PRESETS.full, "youtube"] });
    focusField();
    for (const word of ["video", "embed", "youtube"]) {
      type(editor, `/${word}`);
      expect(screen.getByRole("option", { name: /Video/ })).toBeTruthy();
      act(() => void editor.commands.clearContent());
    }
    type(editor, "/twitch");
    expect(screen.queryByRole("option", { name: /Video/ })).toBeNull();
  });

  test("a YouTube link in the popover becomes a block with the caret in a new paragraph below", async () => {
    const user = userEvent.setup();
    const { editor } = renderEditor({ tools: FULL_PLUS_VIDEO, defaultValue: "<p>Intro</p>" });
    caretIn(editor, "Intro");
    const field = await openVideoPopover(user);
    await user.type(field, "https://youtu.be/dQw4w9WgXcQ{Enter}");

    expect(editor.getHTML()).toBe(`<p>Intro</p>${video("youtube", YT)}<p></p>`);
    expect(editor.state.selection.$from.parent.type.name).toBe("paragraph");
    expect(editor.state.selection.$from.parent.textContent).toBe("");
    expect(screen.queryByRole("textbox", { name: "Video link" })).toBeNull();
  });

  test("the service is detected from the address among the enabled tools: a Twitch link", async () => {
    const user = userEvent.setup();
    const { editor } = renderEditor({ tools: FULL_PLUS_VIDEO, defaultValue: "<p>Intro</p>" });
    caretIn(editor, "Intro");
    const field = await openVideoPopover(user);
    await user.type(field, "twitch.tv/videos/1234567890");
    await user.click(screen.getByRole("button", { name: "Insert" }));
    expect(editor.getHTML()).toBe(`<p>Intro</p>${video("twitch", TW)}<p></p>`);
  });

  test("an empty paragraph is replaced by the block", async () => {
    const user = userEvent.setup();
    const { editor } = renderEditor({
      tools: FULL_PLUS_VIDEO,
      defaultValue: "<p>Intro</p><p></p><p>Outro</p>",
    });
    act(() => void editor.commands.setTextSelection(editor.state.doc.child(0).nodeSize + 1));
    const field = await openVideoPopover(user);
    await user.type(field, `${YT}{Enter}`);
    expect(editor.getHTML()).toBe(`<p>Intro</p>${video("youtube", YT)}<p>Outro</p>`);
  });

  test("the insertion is one undo step", async () => {
    const user = userEvent.setup();
    const { editor } = renderEditor({ tools: FULL_PLUS_VIDEO, defaultValue: "<p>Intro</p>" });
    caretIn(editor, "Intro");
    const field = await openVideoPopover(user);
    await user.type(field, `${YT}{Enter}`);
    expect(editor.getHTML()).toContain("data-block");
    act(() => void editor.commands.undo());
    expect(editor.getHTML()).toBe("<p>Intro</p>");
  });

  test("a foreign link is an error in the field and nothing is inserted", async () => {
    const user = userEvent.setup();
    const { editor } = renderEditor({ tools: FULL_PLUS_VIDEO, defaultValue: "<p>Intro</p>" });
    caretIn(editor, "Intro");
    const field = await openVideoPopover(user);
    await user.type(field, "https://vimeo.com/12345{Enter}");

    expect(await screen.findByText("Enter a link to a YouTube / Twitch video")).toBeTruthy();
    expect(editor.getHTML()).toBe("<p>Intro</p>");
    // Поповер остался открытым, ошибка уходит с правкой.
    await user.type(field, "x");
    expect(screen.queryByText(/Enter a link to a/)).toBeNull();
  });

  test("a link of a service that is not enabled is the same error, naming only the enabled one", async () => {
    const user = userEvent.setup();
    const { editor } = renderEditor({
      tools: [...PRESETS.full, "twitch"],
      defaultValue: "<p>Intro</p>",
    });
    caretIn(editor, "Intro");
    const field = await openVideoPopover(user);
    await user.type(field, `${YT}{Enter}`);
    expect(await screen.findByText("Enter a link to a Twitch video")).toBeTruthy();
    expect(editor.getHTML()).toBe("<p>Intro</p>");
  });

  test("the labels follow the catalog language", async () => {
    const user = userEvent.setup();
    render(
      <UiProvider messages={ru} locale="ru">
        <RichTextEditor aria-label="Body" tools={FULL_PLUS_VIDEO} defaultValue="<p>Intro</p>" />
      </UiProvider>
    );
    await user.click(screen.getByRole("button", { name: ru.editor.insertMenu }));
    await user.click(screen.getByRole("menuitem", { name: ru.editor.video }));
    const field = await screen.findByRole("textbox", { name: ru.editor.videoLink });
    await user.type(field, "https://vimeo.com/1{Enter}");
    expect(
      await screen.findByText(ru.editor.videoNotFound({ services: "YouTube / Twitch" }))
    ).toBeTruthy();
  });
});

// ── Голая ссылка в пустом абзаце ──────────────────────────────────────────

describe("a bare video link", () => {
  test("pasted into an empty paragraph becomes the block", () => {
    const { editor } = renderEditor({
      tools: FULL_PLUS_VIDEO,
      defaultValue: "<p>Intro</p><p></p>",
    });
    focusField();
    act(() => void editor.commands.setTextSelection(editor.state.doc.content.size - 1));
    expect(pasteText(editor, `  ${YT}\n`)).toBe(true);
    expect(editor.getHTML()).toBe(`<p>Intro</p>${video("youtube", YT)}<p></p>`);
    // Одна отмена возвращает пустой абзац.
    act(() => void editor.commands.undo());
    expect(editor.getHTML()).toBe("<p>Intro</p><p></p>");
  });

  test("a Twitch link pasted into an empty paragraph, and a short YouTube form", () => {
    const { editor } = renderEditor({ tools: FULL_PLUS_VIDEO, defaultValue: "<p></p>" });
    focusField();
    act(() => void editor.commands.setTextSelection(1));
    pasteText(editor, "twitch.tv/videos/1234567890");
    expect(editor.getHTML()).toBe(`${video("twitch", TW)}<p></p>`);
  });

  test("pasted into a paragraph with text it stays an ordinary paste", () => {
    const { editor } = renderEditor({ tools: FULL_PLUS_VIDEO, defaultValue: "<p>Intro</p>" });
    focusField();
    caretIn(editor, "Intro");
    pasteText(editor, YT);
    expect(editor.getHTML()).not.toContain("data-block");
  });

  test("a link of a service that is off, or a foreign one, is not turned into a block", () => {
    const { editor } = renderEditor({
      tools: [...PRESETS.full, "twitch"],
      defaultValue: "<p></p>",
    });
    focusField();
    act(() => void editor.commands.setTextSelection(1));
    pasteText(editor, YT);
    expect(editor.getHTML()).not.toContain("data-block");
    act(() => void editor.commands.clearContent());
    pasteText(editor, "https://vimeo.com/12345");
    expect(editor.getHTML()).not.toContain("data-block");
  });

  test("two lines of pasted text are not one link", () => {
    const { editor } = renderEditor({ tools: FULL_PLUS_VIDEO, defaultValue: "<p></p>" });
    focusField();
    act(() => void editor.commands.setTextSelection(1));
    pasteText(editor, `${YT}\nhttps://example.com`);
    expect(editor.getHTML()).not.toContain("data-block");
  });

  test("typed and confirmed with Enter becomes the block, the caret goes below", () => {
    const { editor } = renderEditor({
      tools: FULL_PLUS_VIDEO,
      defaultValue: "<p>Intro</p><p></p>",
    });
    focusField();
    act(() => void editor.commands.setTextSelection(editor.state.doc.content.size - 1));
    type(editor, YT);
    expect(press(editor, "Enter")).toBe(false);
    expect(editor.getHTML()).toBe(`<p>Intro</p>${video("youtube", YT)}<p></p>`);
    expect(editor.state.selection.$from.parent.type.name).toBe("paragraph");
    // Следующий Enter — уже обычный перенос в пустом абзаце, не вторая вставка.
    type(editor, "text");
    expect(editor.getHTML()).toBe(`<p>Intro</p>${video("youtube", YT)}<p>text</p>`);
  });

  test("a link with a mark (as the autolink writes it) is the same", () => {
    const { editor } = renderEditor({
      tools: FULL_PLUS_VIDEO,
      defaultValue: `<p>Intro</p><p><a href="${YT}">${YT}</a></p>`,
    });
    focusField();
    caretIn(editor, YT);
    press(editor, "Enter");
    expect(editor.getHTML()).toBe(`<p>Intro</p>${video("youtube", YT)}<p></p>`);
  });

  test("a sentence with a link, and Enter in it, stay text", () => {
    const { editor } = renderEditor({ tools: FULL_PLUS_VIDEO, defaultValue: `<p>Watch ${YT}</p>` });
    focusField();
    caretIn(editor, `Watch ${YT}`);
    press(editor, "Enter");
    expect(editor.getHTML()).not.toContain("data-block");
  });

  test("a link is not a block without the tool", () => {
    const { editor } = renderEditor({ tools: [...PRESETS.full], defaultValue: "<p></p>" });
    focusField();
    act(() => void editor.commands.setTextSelection(1));
    pasteText(editor, YT);
    type(editor, " ");
    expect(editor.getHTML()).not.toContain("data-block");
  });
});

// ── HTML расширений Tiptap ────────────────────────────────────────────────

describe("the HTML of the Tiptap extensions", () => {
  const youtubeNode =
    '<div data-youtube-video=""><iframe width="640" height="480" allowfullscreen="true" autoplay="false" ' +
    'src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?controls=0&start=30"></iframe></div>';
  const twitchNode =
    '<div data-twitch-video=""><iframe src="https://player.twitch.tv/?video=1234567890&parent=example.com&autoplay=true" ' +
    'allowfullscreen frameborder="0"></iframe></div>';

  test("pasted: the player address goes back to the link of the video, never an iframe", () => {
    const { editor } = renderEditor({ tools: FULL_PLUS_VIDEO, defaultValue: "<p>Intro</p>" });
    focusField();
    caretIn(editor, "Intro");
    pasteHtml(editor, youtubeNode + twitchNode);
    const html = editor.getHTML();
    expect(html).toContain(video("youtube", `${YT}&t=30`));
    expect(html).toContain(video("twitch", TW));
    expect(html).not.toMatch(/iframe|nocookie|player\.twitch|parent=/);
  });

  test("loaded as a value, the same", () => {
    const { editor } = renderEditor({ tools: FULL_PLUS_VIDEO, defaultValue: youtubeNode });
    expect(editor.getHTML()).toBe(video("youtube", `${YT}&t=30`));
  });

  test("a service that is off gives no block and no player: the markup is dropped", () => {
    const { editor } = renderEditor({
      tools: [...PRESETS.full, "twitch"],
      defaultValue: `<p>a</p>${youtubeNode}`,
    });
    expect(editor.getHTML()).toBe("<p>a</p>");
  });

  test("a player of a foreign host is not turned into a block", () => {
    const { editor } = renderEditor({
      tools: FULL_PLUS_VIDEO,
      defaultValue:
        '<div data-youtube-video=""><iframe src="https://evil.example/embed/x"></iframe></div>',
    });
    expect(editor.getHTML()).not.toMatch(/data-block|iframe|evil/);
  });
});

// ── Markdown ──────────────────────────────────────────────────────────────

describe("Markdown", () => {
  test("a video is written as its link on its own line", () => {
    const { handle } = renderEditor({
      defaultValue: `<p>Intro</p>${video("youtube", YT)}${video("twitch", TW)}<p>Outro</p>`,
    });
    expect(handle.getMarkdown()).toBe(`Intro\n\n${YT}\n\n${TW}\n\nOutro`);
  });

  test("a line with a video link comes back as the block, if the service is on", () => {
    const { handle, editor } = renderEditor({ tools: FULL_PLUS_VIDEO });
    act(() => void handle.setMarkdown(`Intro\n\n${YT}\n\n<${TW}>\n\nOutro`));
    expect(editor.getHTML()).toBe(
      `<p>Intro</p>${video("youtube", YT)}${video("twitch", TW)}<p>Outro</p>`
    );
    expect(handle.getMarkdown()).toBe(`Intro\n\n${YT}\n\n${TW}\n\nOutro`);
  });

  test("a link inside a sentence, a titled link and a link in a list stay links", () => {
    const { handle, editor } = renderEditor({ tools: FULL_PLUS_VIDEO });
    act(
      () =>
        void handle.setMarkdown(
          `See ${YT} now\n\n[watch](${YT})\n\n- ${YT}\n\n${YT} and more\n${TW}`
        )
    );
    expect(editor.getHTML()).not.toContain("data-block");
  });

  test("a link of a service that is off stays a link", () => {
    const { handle, editor } = renderEditor({ tools: [...PRESETS.full, "twitch"] });
    act(() => void handle.setMarkdown(`${YT}\n\n${TW}`));
    expect(editor.getHTML()).toBe(`<p>${link(YT)}</p>${video("twitch", TW)}`);
  });

  test("without any video tool the block's link is exported as text", () => {
    const { handle, editor } = renderEditor({ tools: [...PRESETS.full] });
    act(() => void editor.commands.setContent(video("youtube", YT), { emitUpdate: false }));
    expect(handle.getMarkdown()).toContain(YT);
  });
});

// ── Заглушка и плеер ──────────────────────────────────────────────────────

describe("the placeholder and the player", () => {
  test("before a click: the service name, the link and a Play button, no iframe, no request", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    renderEditor({ defaultValue: video("youtube", YT) + video("twitch", TW) });
    expect(document.querySelector("iframe")).toBeNull();
    const play = screen.getByRole("button", { name: "Play YouTube video" });
    expect(within(play).queryByText("Play")).toBeTruthy();
    expect(await screen.findByRole("button", { name: "Play Twitch video" })).toBeTruthy();
    expect(document.body.textContent).toContain("YouTube");
    expect(document.body.textContent).toContain(YT);
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  test("a click builds the nocookie player with title, lazy loading, allow and referrerpolicy", async () => {
    const user = userEvent.setup();
    renderEditor({ defaultValue: video("youtube", YT) });
    await user.click(screen.getByRole("button", { name: "Play YouTube video" }));
    const frame = document.querySelector("iframe")!;
    expect(frame.getAttribute("src")).toBe(
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1"
    );
    expect(frame.getAttribute("title")).toBe("YouTube video");
    expect(frame.getAttribute("loading")).toBe("lazy");
    expect(frame.getAttribute("allow")).toContain("fullscreen");
    expect(frame.getAttribute("referrerpolicy")).toBe("strict-origin-when-cross-origin");
    expect(frame.hasAttribute("allowfullscreen")).toBe(true);
    expect(screen.queryByRole("button", { name: /Play/ })).toBeNull();
    // Фокус перешёл с исчезнувшей кнопки в плеер.
    expect(document.activeElement).toBe(frame);
  });

  test("Twitch takes the host of the current page as parent", async () => {
    const user = userEvent.setup();
    renderEditor({ defaultValue: video("twitch", TW) });
    await user.click(screen.getByRole("button", { name: "Play Twitch video" }));
    const frame = document.querySelector("iframe")!;
    expect(frame.getAttribute("src")).toBe(
      `https://player.twitch.tv/?video=1234567890&parent=${window.location.hostname}&autoplay=true`
    );
    expect(frame.getAttribute("title")).toBe("Twitch video");
  });

  test("the document keeps the link: no player, no parent, no iframe in the value", async () => {
    const user = userEvent.setup();
    const { editor } = renderEditor({ defaultValue: video("twitch", TW) });
    await user.click(screen.getByRole("button", { name: "Play Twitch video" }));
    expect(editor.getHTML()).toBe(video("twitch", TW));
  });

  test("the placeholder works in a read-only editor too, with the caption in the catalog language", async () => {
    const user = userEvent.setup();
    render(
      <UiProvider messages={ru} locale="ru">
        <RichTextEditor
          aria-label="Body"
          tools={[...BOTH]}
          readOnly
          defaultValue={video("youtube", YT)}
        />
      </UiProvider>
    );
    await user.click(
      screen.getByRole("button", { name: ru.editor.videoPlayLabel({ service: "YouTube" }) })
    );
    expect(document.querySelector("iframe")?.getAttribute("title")).toBe(
      ru.editor.videoPlayer({ service: "YouTube" })
    );
  });
});

// ── Атом ─────────────────────────────────────────────────────────────────

describe("the block is an atom", () => {
  test("it is selected as a whole and deleted by Backspace in one step", () => {
    const { editor } = renderEditor({
      tools: ["history", ...BOTH],
      defaultValue: `<p>Intro</p>${video("youtube", YT)}<p>Outro</p>`,
    });
    focusField();
    act(() => void editor.commands.setNodeSelection(editor.state.doc.child(0).nodeSize));
    expect(editor.state.selection.constructor.name).toBe("NodeSelection");
    press(editor, "Backspace");
    expect(editor.getHTML()).toBe("<p>Intro</p><p>Outro</p>");
    act(() => void editor.commands.undo());
    expect(editor.getHTML()).toBe(`<p>Intro</p>${video("youtube", YT)}<p>Outro</p>`);
  });

  test("its text for the counter and the copy is its link", () => {
    const { editor, handle } = renderEditor({
      defaultValue: `<p>Hi</p>${video("youtube", YT)}`,
    });
    expect(editor.getText()).toBe(`Hi\n\n${YT}`);
    expect(handle.getText?.() ?? editor.getText()).toContain(YT);
  });

  test("it can sit in a list item, a quote and a column", () => {
    const { editor } = renderEditor({
      tools: FULL_PLUS_VIDEO,
      defaultValue:
        `<blockquote><p>q</p>${video("youtube", YT)}</blockquote>` +
        `<div data-block="layout" data-layout="50-50"><div data-block="column">${video("twitch", TW)}</div>` +
        '<div data-block="column"><p>r</p></div></div>',
    });
    expect(editor.getHTML()).toContain(`<blockquote><p>q</p>${video("youtube", YT)}</blockquote>`);
    expect(editor.getHTML()).toContain(video("twitch", TW));
  });
});
