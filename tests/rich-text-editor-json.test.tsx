// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { createRef } from "react";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import {
  RICH_TEXT_PRESETS,
  RichTextEditor,
  type RichTextDocument,
  type RichTextEditorHandle,
  type RichTextEditorProps,
} from "../src/editor/index.js";
import { TOOLS } from "../src/editor/core/tools.js";
import { loadLazyBuiltins } from "./editor-lazy-builtins.js";
import { resetDevWarnings } from "../src/lib/dev-warn.js";
import { TEST_TOOLS, testLazyTool, testMergeTagTool } from "./editor-test-tools.js";

// Ленивые `codeBlock` и `table` (OLDSUI-111): `full` готов в `render` после загрузки чанков.
beforeAll(loadLazyBuiltins);

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  resetDevWarnings();
});

/**
 * JSON-конверт Документа (OLDSUI-180, ADR-0061): `getJSON()` и `setJSON()`
 * Хэндла рядом с HTML-значением.
 *
 * Шов один — публичный `RichTextEditor` с `ref`: что получает владелец
 * значения (`getHTML`, `onChange`, форма). Приведение дерева к Схеме и проверка
 * конверта отдельно не тестируются — их правила видны через компонент.
 */

function renderEditor(props: Partial<RichTextEditorProps> = {}) {
  const ref = createRef<RichTextEditorHandle>();
  render(<RichTextEditor ref={ref} aria-label="Body" {...props} />);
  const handle = ref.current;
  if (!handle?.editor) throw new Error("the editor was not created inside render()");
  return { handle, editor: handle.editor };
}

/** Документ со всем, что Markdown теряет при выгрузке (раздел «Markdown» страницы Редактора). */
const RICH = [
  '<h2 data-align="center">Title</h2>',
  "<p><u>under</u> ",
  '<span data-color="danger">red</span> ',
  '<mark style="background-color:#ffe066">marked</mark> ',
  '<span style="color:#336699">own</span></p>',
  '<figure><img src="https://example.com/a.png" alt="A" data-width="50"><figcaption>Caption</figcaption></figure>',
  '<table><tbody><tr><th colspan="2" data-align="center">Head</th></tr>',
  "<tr><td><p>a</p></td><td><p>b</p></td></tr></tbody></table>",
  '<div data-block="layout" data-layout="50-50">',
  '<div data-block="column"><p>left</p></div><div data-block="column"><p>right</p></div></div>',
  '<div data-block="wrapper" data-tone="accent"><p>inside</p></div>',
  '<ul data-type="taskList"><li data-type="taskItem" data-checked="true">',
  '<label><input type="checkbox" checked><span></span></label><div><p>done</p></div></li></ul>',
  '<pre><code class="language-python">print(1)</code></pre>',
].join("");

test("getJSON then setJSON brings back the same document, with everything Markdown loses", () => {
  const source = renderEditor({ defaultValue: RICH }).handle;
  const html = source.getHTML();
  // Образец и правда несёт то, что теряет Markdown, — иначе круг ничего не доказывает.
  for (const feature of [
    'data-align="center"',
    "<u>",
    'data-color="danger"',
    "background-color:#ffe066",
    "color:#336699",
    'data-width="50"',
    "<figcaption>",
    'colspan="2"',
    'data-block="layout"',
    'data-tone="accent"',
    'data-checked="true"',
    "language-python",
  ]) {
    expect(html).toContain(feature);
  }

  const exported = source.getJSON();
  expect(exported).toMatchObject({ format: "olddevs-rich-text", version: 1 });
  expect(exported?.doc.type).toBe("doc");

  const target = renderEditor().handle;
  let accepted = false;
  act(() => void (accepted = target.setJSON(JSON.parse(JSON.stringify(exported)))));
  expect(accepted).toBe(true);
  expect(target.getHTML()).toBe(html);
});

/** Конверт с этим деревом Блоков. */
const envelope = (...content: unknown[]) =>
  ({ format: "olddevs-rich-text", version: 1, doc: { type: "doc", content } }) as RichTextDocument;
const paragraph = (...content: unknown[]) => ({ type: "paragraph", content });
const text = (value: string, marks?: unknown[]) => ({ type: "text", text: value, marks });

test("spaces the author typed survive the trip: JSON keeps the text as it is in the document", () => {
  const { handle } = renderEditor();
  act(() => void handle.setJSON(envelope(paragraph(text("two  spaces and a tail ")))));
  const exported = handle.getJSON();
  expect(exported?.doc.content?.[0]?.content?.[0]?.text).toBe("two  spaces and a tail ");

  const target = renderEditor().handle;
  act(() => void target.setJSON(exported));
  expect(target.getJSON()).toEqual(exported);
});

test("setJSON is an outside replacement: onChange gets the new HTML at once and only once", () => {
  const onChange = vi.fn();
  const { handle } = renderEditor({ defaultValue: "<p>old</p>", onChange });
  vi.useFakeTimers();

  act(() => void handle.setJSON(envelope(paragraph(text("new")))));

  expect(handle.getHTML()).toBe("<p>new</p>");
  expect(onChange).toHaveBeenCalledTimes(1);
  expect(onChange).toHaveBeenLastCalledWith("<p>new</p>");
  // Отложенный `onChange` от самой замены не отдаёт то же значение вторично.
  act(() => void vi.advanceTimersByTime(1000));
  expect(onChange).toHaveBeenCalledTimes(1);
});

test("maxLength does not cut a document from setJSON, as it does not cut value", () => {
  const { handle } = renderEditor({ maxLength: 3 });
  act(() => void handle.setJSON(envelope(paragraph(text("longer than three")))));
  expect(handle.getHTML()).toBe("<p>longer than three</p>");
});

test.each([
  ["not an object", "<p>x</p>"],
  ["null", null],
  ["another format", { ...envelope(paragraph(text("x"))), format: "prosemirror" }],
  ["a newer version", { ...envelope(paragraph(text("x"))), version: 2 }],
  ["no version", { format: "olddevs-rich-text", doc: envelope().doc }],
  ["a bare Tiptap tree", envelope(paragraph(text("x"))).doc],
  ["a root that is not doc", { ...envelope(), doc: paragraph(text("x")) }],
  ["content that is not a list", { ...envelope(), doc: { type: "doc", content: "x" } }],
  ["a broken node", envelope(paragraph(null))],
  ["an empty text node", envelope(paragraph(text("")))],
])("setJSON rejects %s: false, and neither the document nor onChange is touched", (_, value) => {
  const onChange = vi.fn();
  const { handle } = renderEditor({ defaultValue: "<p>old</p>", onChange });

  let accepted = true;
  act(() => void (accepted = handle.setJSON(value)));

  expect(accepted).toBe(false);
  expect(handle.getHTML()).toBe("<p>old</p>");
  expect(onChange).not.toHaveBeenCalled();
});

test("a block of a disabled tool unfolds into its text, an unknown mark comes off", () => {
  const { handle } = renderEditor({ tools: TOOLS.filter((tool) => tool !== "table") });
  const table = {
    type: "table",
    content: [
      {
        type: "tableRow",
        content: [{ type: "tableCell", content: [paragraph(text("cell"))] }],
      },
    ],
  };

  act(() => void handle.setJSON(envelope(table, paragraph(text("odd", [{ type: "glitter" }])))));

  expect(handle.getHTML()).toBe("<p>cell</p><p>odd</p>");
});

test("JSON is not a way around the schema: unsafe attributes go exactly as in HTML", () => {
  const unsafe = envelope(
    paragraph(
      text("script", [{ type: "link", attrs: { href: "javascript:alert(1)" } }]),
      text(" red", [{ type: "textStyle", attrs: { color: "url(x)" } }]),
      text(" bad", [{ type: "highlight", attrs: { color: "not-a-palette-name" } }])
    ),
    { type: "image", attrs: { src: "data:image/png;base64,AAAA", alt: "x" } },
    { type: "image", attrs: { src: "https://example.com/a.png", alt: "ok", width: "13" } }
  );
  const { handle } = renderEditor();
  act(() => void handle.setJSON(unsafe));
  const fromJSON = handle.getHTML();

  // Тот же Документ HTML-строкой, как его отдал бы движок без проверок Схемы.
  const raw = renderEditor().editor;
  raw.commands.setContent(unsafe.doc, { emitUpdate: false });
  const sameAsHTML = renderEditor({ defaultValue: raw.getHTML() }).handle.getHTML();

  expect(fromJSON).toBe(sameAsHTML);
  // И в самом Документе: вывод ссылки Tiptap и сам снимает опасный адрес, а
  // состояние без второго прохода его бы хранило.
  expect(JSON.stringify(handle.getJSON())).not.toContain("javascript:");
  expect(fromJSON).not.toContain("javascript:");
  expect(fromJSON).not.toContain("data:image");
  expect(fromJSON).not.toContain("url(x)");
  expect(fromJSON).not.toContain("not-a-palette-name");
});

test("a custom tool goes round through JSON and is checked by its own rules", () => {
  const tools = [...TOOLS, ...TEST_TOOLS];
  const tag = '<span data-block="test_mergeTag" data-test_key="first_name"></span>';
  const source = renderEditor({ tools, defaultValue: `<p>Hi ${tag}</p>` }).handle;
  const exported = source.getJSON();

  const target = renderEditor({ tools }).handle;
  act(() => void target.setJSON(exported));
  expect(target.getHTML()).toBe(source.getHTML());

  // Ключ вне шаблона Инструмента (`[a-z_]+`) снимается, как в HTML.
  const bad = envelope(
    paragraph(text("Hi "), { type: "test_mergeTag", attrs: { test_key: "Bad Key!" } })
  );
  act(() => void target.setJSON(bad));
  // Сверка по Документу, а не по выводу: вывод HTML своего Инструмента сам
  // не пишет плохой ключ, а в состоянии он остался бы и ушёл бы в `getJSON()`.
  expect(JSON.stringify(target.getJSON())).not.toContain("Bad Key!");
  expect(target.getHTML()).not.toContain("Bad Key!");
});

test("without the custom tool its atom disappears and its container unfolds", () => {
  const { handle } = renderEditor();
  act(
    () =>
      void handle.setJSON(
        envelope(paragraph(text("Hi "), { type: "test_mergeTag", attrs: { test_key: "name" } }), {
          type: "test_box",
          content: [paragraph(text("inside"))],
        })
      )
  );
  expect(handle.getHTML()).toBe("<p>Hi </p><p>inside</p>");
});

test("an empty document goes out as an envelope and comes back empty, with onChange of an empty string", () => {
  const empty = renderEditor().handle.getJSON();
  expect(empty).toMatchObject({ format: "olddevs-rich-text", version: 1 });

  const onChange = vi.fn();
  const { handle } = renderEditor({ defaultValue: "<p>old</p>", onChange });
  act(() => void handle.setJSON(empty));
  expect(handle.getHTML()).toBe("");
  expect(onChange).toHaveBeenLastCalledWith("");

  act(() => void handle.setJSON({ format: "olddevs-rich-text", version: 1, doc: { type: "doc" } }));
  expect(handle.getHTML()).toBe("");
  expect(handle.isEmpty()).toBe(true);
});

test("setJSON does not take the focus", () => {
  const { handle, editor } = renderEditor();
  act(() => void handle.setJSON(envelope(paragraph(text("x")))));
  expect(editor.isFocused).toBe(false);
});

test("the envelope type fits what getJSON returns and what setJSON takes", () => {
  const { handle } = renderEditor({ defaultValue: "<p>typed</p>" });
  const exported: RichTextDocument | null = handle.getJSON();
  if (!exported) throw new Error("the editor is mounted, getJSON must not be null");
  const stored: RichTextDocument = { ...exported, doc: { ...exported.doc } };
  let accepted = false;
  act(() => void (accepted = handle.setJSON(stored)));
  expect(accepted).toBe(true);
});

const sourceButton = () => screen.getByRole<HTMLButtonElement>("button", { name: "HTML" });
const sourceField = () => screen.getByRole<HTMLTextAreaElement>("textbox", { name: "HTML source" });

test("in HTML mode getJSON applies the field edit first, setJSON rewrites the field", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  const { handle } = renderEditor({ defaultValue: "<p>old</p>", onChange });
  await user.click(sourceButton());

  act(() => void fireEvent.change(sourceField(), { target: { value: "<h2>Edited</h2>" } }));
  expect(handle.getJSON()?.doc.content?.[0]).toMatchObject({ type: "heading" });
  expect(onChange).toHaveBeenLastCalledWith("<h2>Edited</h2>");

  act(() => void fireEvent.change(sourceField(), { target: { value: "<p>unsaved</p>" } }));
  act(() => void handle.setJSON(envelope(paragraph(text("from json")))));
  expect(sourceField().value).toBe("<p>from json</p>");
  expect(onChange).toHaveBeenLastCalledWith("<p>from json</p>");
});

// --- до монтажа и начальный конверт ------------------------------------------------------

test("before mount getJSON is null and setJSON changes nothing", () => {
  const seen: Record<string, unknown> = {};
  render(
    <RichTextEditor
      aria-label="Body"
      defaultValue="<p>Known</p>"
      ref={(handle) => {
        // Колбэк-`ref` получает Хэндл при монтаже, когда движка ещё нет.
        if (!handle || "json" in seen) return;
        seen.json = handle.getJSON();
        seen.set = handle.setJSON(envelope(paragraph(text("x"))));
      }}
    />
  );

  expect(seen).toEqual({ json: null, set: false });
});

test("defaultValue takes an envelope: the document opens without onChange and without an undo step", () => {
  const onChange = vi.fn();
  const { handle } = renderEditor({
    defaultValue: envelope({ type: "heading", attrs: { level: 2 }, content: [text("Template")] }),
    onChange,
  });

  expect(handle.getHTML()).toBe("<h2>Template</h2>");
  expect(handle.canUndo()).toBe(false);
  expect(onChange).not.toHaveBeenCalled();
});

test("an envelope from defaultValue goes to the form field as HTML", () => {
  const { container } = render(
    <RichTextEditor
      aria-label="Body"
      name="body"
      defaultValue={envelope(paragraph(text("Sent")))}
    />
  );
  const hidden = container.querySelector<HTMLInputElement>('input[type="hidden"][name="body"]');
  expect(hidden?.value).toBe("<p>Sent</p>");
});

test("an envelope in defaultValue is checked like setJSON: a rejected one is an empty document and one error", () => {
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  const { handle } = renderEditor({
    defaultValue: { format: "olddevs-rich-text", version: 2, doc: { type: "doc" } } as never,
  });

  expect(handle.getHTML()).toBe("");
  expect(error).toHaveBeenCalledTimes(1);
  expect(String(error.mock.calls[0]?.[0])).toContain("defaultValue");
});

test("an envelope in defaultValue passes the schema like any other input", () => {
  const { handle } = renderEditor({
    defaultValue: envelope(
      paragraph(text("link", [{ type: "link", attrs: { href: "javascript:alert(1)" } }]))
    ),
  });
  expect(JSON.stringify(handle.getJSON())).not.toContain("javascript:");
  expect(handle.getHTML()).toBe("<p>link</p>");
});

test("value wins over an envelope in defaultValue, as it wins over an HTML one", () => {
  const { handle } = renderEditor({
    value: "<p>owned</p>",
    defaultValue: envelope(paragraph(text("ignored"))),
  });
  expect(handle.getHTML()).toBe("<p>owned</p>");
});

test("with an envelope the Skeleton is the frame without the Document until the editor is ready", async () => {
  const lazy = testLazyTool();
  const { container } = render(
    <RichTextEditor
      aria-label="Body"
      tools={[...RICH_TEXT_PRESETS.full, lazy.tool]}
      defaultValue={envelope(paragraph(text("Later")))}
    />
  );
  expect(container.textContent).not.toContain("Later");

  await act(async () => lazy.resolve());
  expect(container.textContent).toContain("Later");
});

/*
  До монтажа и после — одно правило пустоты, как у HTML-значения: Блок без
  текста — пусто; текст (в конверте пробелы не схлопываются), мягкий перенос,
  атом и таблица — содержимое.
*/
const EMPTINESS: [string, unknown][] = [
  ["no content", { format: "olddevs-rich-text", version: 1, doc: { type: "doc" } }],
  ["an empty paragraph", envelope(paragraph())],
  ["an empty heading", envelope({ type: "heading", attrs: { level: 2 } })],
  [
    "an empty list",
    envelope({ type: "bulletList", content: [{ type: "listItem", content: [paragraph()] }] }),
  ],
  ["an empty quote", envelope({ type: "blockquote", content: [paragraph()] })],
  ["an empty code block", envelope({ type: "codeBlock" })],
  ["a rejected envelope", { format: "olddevs-rich-text", version: 2 }],
  ["a space", envelope(paragraph(text(" ")))],
  ["text", envelope(paragraph(text("Text")))],
  ["a soft break", envelope(paragraph({ type: "hardBreak" }))],
  ["a rule", envelope({ type: "horizontalRule" })],
  ["an image", envelope({ type: "image", attrs: { src: "https://example.com/a.png" } })],
  [
    "an empty table",
    envelope({
      type: "table",
      content: [{ type: "tableRow", content: [{ type: "tableCell", content: [paragraph()] }] }],
    }),
  ],
  [
    "a custom atom",
    envelope(paragraph({ type: "test_mergeTag", attrs: { test_key: "first_name" } })),
  ],
];

test.each(EMPTINESS)("isEmpty before mount agrees with the mounted field: %s", (_, value) => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  let before: boolean | undefined;
  let handle: RichTextEditorHandle | null = null;
  render(
    <RichTextEditor
      aria-label="Body"
      defaultValue={value as RichTextDocument}
      tools={[...RICH_TEXT_PRESETS.full, testMergeTagTool]}
      ref={(current) => {
        handle = current;
        if (current && before === undefined) before = current.isEmpty();
      }}
    />
  );

  expect(handle!.editor).not.toBeNull();
  expect(before).toBe(handle!.isEmpty());
});

test("a tree that cannot be built is rejected with its cause in the development console", () => {
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  const { handle } = renderEditor({ defaultValue: "<p>old</p>" });

  let accepted = true;
  act(() => void (accepted = handle.setJSON(envelope(paragraph(text(""))))));

  expect(accepted).toBe(false);
  expect(error).toHaveBeenCalledTimes(1);
  expect(String(error.mock.calls[0]?.[0])).toContain("could not be built");
  // Причина — вторым аргументом: у кривого файла и у бросившего Инструмента виден стек.
  expect(error.mock.calls[0]?.[1]).toBeInstanceOf(Error);
});

test("a re-render of the owner keeps the form field value the Editor wrote", () => {
  const { container, rerender } = render(
    <RichTextEditor
      aria-label="Body"
      name="body"
      defaultValue={envelope(paragraph(text("Sent")))}
    />
  );
  rerender(
    <RichTextEditor
      aria-label="Body"
      name="body"
      className="changed"
      defaultValue={envelope(paragraph(text("Sent")))}
    />
  );
  const hidden = container.querySelector<HTMLInputElement>('input[type="hidden"][name="body"]');
  expect(hidden?.value).toBe("<p>Sent</p>");
});
