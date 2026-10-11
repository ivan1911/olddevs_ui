// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { Slice } from "@tiptap/pm/model";
import type { Editor } from "@tiptap/react";
import { createRef, StrictMode, type ReactElement } from "react";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import {
  RICH_TEXT_PRESETS,
  RichTextEditor,
  type CustomTool,
  type RichTextEditorHandle,
  type RichTextEditorProps,
} from "../src/editor/index.js";
import { resetDevWarnings } from "../src/lib/dev-warn.js";
import { testPasteFilterTool, testVideoLinkTool } from "./editor-test-tools.js";
import { loadLazyBuiltins } from "./editor-lazy-builtins.js";

// Ленивые `codeBlock` и `table` (OLDSUI-111): `full` готов в `render` после загрузки чанков.
beforeAll(loadLazyBuiltins);

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  resetDevWarnings();
});

/**
 * События Редактора (OLDSUI-108, ADR-0058, раздел 9): колбэки `onReady`,
 * `onFocus`, `onBlur` и порядок обработчиков вставки и drop.
 *
 * Через публичный `RichTextEditor`. Фокус переводится настоящим `focus()` и
 * кликами `user-event`: `focusin` и `focusout` в jsdom идут, как в браузере.
 */
function renderEditor(
  props: Partial<RichTextEditorProps> = {},
  ui?: (node: ReactElement) => ReactElement
) {
  const ref = createRef<RichTextEditorHandle>();
  const node = <RichTextEditor ref={ref} aria-label="Body" {...props} />;
  const view = render(ui ? ui(node) : node);
  const editor = ref.current?.editor;
  if (!editor) throw new Error("the editor was not created inside render()");
  return { ...view, ref, editor };
}

/** Редактор рядом с внешней кнопкой: уйти фокусом из поля, не покидая страницы. */
function renderBeside(props: Partial<RichTextEditorProps> = {}) {
  const ref = createRef<RichTextEditorHandle>();
  const view = render(
    <>
      <RichTextEditor ref={ref} aria-label="Body" {...props} />
      <button type="button">Outside</button>
    </>
  );
  return { ...view, ref, editor: ref.current!.editor! };
}

/** Фокус в Документ настоящим `focus()`: команда движка ставит его кадром позже. */
const focusDocument = (editor: Editor) => act(() => editor.view.dom.focus());

/** Пустая цепочка событий: даём таймерам и эффектам отработать. */
const settle = () =>
  act(async () => void (await new Promise((resolve) => setTimeout(resolve, 10))));

/* ---------------------------------------------------------------- onReady */

test("onReady fires once, with the handle already working", () => {
  let inside: { empty: boolean; insert: boolean } | null = null;
  const ref = createRef<RichTextEditorHandle>();
  const onReady = vi.fn(() => {
    inside = {
      empty: ref.current?.isEmpty() ?? false,
      insert: ref.current?.insertHTML("<p>Template</p>") ?? false,
    };
  });

  const { rerender } = render(<RichTextEditor ref={ref} aria-label="Body" onReady={onReady} />);

  expect(onReady).toHaveBeenCalledTimes(1);
  expect(onReady).toHaveBeenCalledWith();
  expect(inside).toEqual({ insert: true, empty: true });
  expect(ref.current?.getHTML()).toBe("<p>Template</p>");

  // Новый колбэк и перерисовка движок не пересоздают: повторного `onReady` нет.
  rerender(<RichTextEditor ref={ref} aria-label="Body" onReady={onReady} placeholder="Other" />);
  expect(onReady).toHaveBeenCalledTimes(1);
});

test("onReady fires once under StrictMode too", () => {
  const onReady = vi.fn();
  renderEditor({ onReady }, (node) => <StrictMode>{node}</StrictMode>);
  expect(onReady).toHaveBeenCalledTimes(1);
});

test.each([
  ["readOnly", { readOnly: true }],
  ["disabled", { disabled: true }],
])("onReady fires in a %s field as well", (_name, props) => {
  const onReady = vi.fn();
  renderEditor({ onReady, ...props });
  expect(onReady).toHaveBeenCalledTimes(1);
});

test("onReady stays silent when the tool set fails (the field shows an error, no engine)", () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const onReady = vi.fn();
  const broken: CustomTool = { name: "nope" as never, engine: [] };
  const ref = createRef<RichTextEditorHandle>();
  render(<RichTextEditor ref={ref} aria-label="Body" tools={[broken]} onReady={onReady} />);
  expect(onReady).not.toHaveBeenCalled();
  expect(ref.current?.editor).toBeNull();
});

test("onReady is not called on the server render", async () => {
  const { renderToString } = await import("react-dom/server");
  const onReady = vi.fn();
  renderToString(<RichTextEditor aria-label="Body" onReady={onReady} />);
  expect(onReady).not.toHaveBeenCalled();
});

/* --------------------------------------------------------- onFocus, onBlur */

test("onFocus fires once when focus enters the field, onBlur once when it leaves", async () => {
  const user = userEvent.setup();
  const onFocus = vi.fn();
  const onBlur = vi.fn();
  const { editor } = renderBeside({ onFocus, onBlur });
  expect(onFocus).not.toHaveBeenCalled();

  focusDocument(editor);
  expect(onFocus).toHaveBeenCalledTimes(1);
  expect(onFocus).toHaveBeenCalledWith();
  expect(onBlur).not.toHaveBeenCalled();

  await user.click(screen.getByRole("button", { name: "Outside" }));
  await waitFor(() => expect(onBlur).toHaveBeenCalledTimes(1));
  expect(onBlur).toHaveBeenCalledWith();
  expect(onFocus).toHaveBeenCalledTimes(1);

  // И обратно: новый вход в поле — новый `onFocus`.
  focusDocument(editor);
  expect(onFocus).toHaveBeenCalledTimes(2);
});

test("moving from the text to the toolbar and back is not a blur", async () => {
  const user = userEvent.setup();
  const onFocus = vi.fn();
  const onBlur = vi.fn();
  const { editor } = renderBeside({ onFocus, onBlur, defaultValue: "<p>Text</p>" });
  focusDocument(editor);

  const bold = screen.getByRole("button", { name: "Bold" });
  act(() => bold.focus());
  await settle();
  expect(document.activeElement).toBe(bold);

  focusDocument(editor);
  await settle();

  expect(onFocus).toHaveBeenCalledTimes(1);
  expect(onBlur).not.toHaveBeenCalled();

  // Уход из поля после этого всё ещё даёт один `onBlur`.
  await user.click(screen.getByRole("button", { name: "Outside" }));
  await waitFor(() => expect(onBlur).toHaveBeenCalledTimes(1));
});

test("moving into the link popover and back is not a blur", async () => {
  const user = userEvent.setup();
  const onFocus = vi.fn();
  const onBlur = vi.fn();
  const { editor } = renderBeside({ onFocus, onBlur, defaultValue: "<p>Text</p>" });
  act(() => void editor.commands.setTextSelection({ from: 1, to: 5 }));
  focusDocument(editor);

  await user.click(screen.getByRole("button", { name: "Link" }));
  const popover = await screen.findByRole("dialog", { name: "Link" });
  const address = await screen.findByRole("textbox", { name: /address|url/i });
  await waitFor(() => expect(popover.contains(document.activeElement)).toBe(true));
  expect(address).toBeDefined();
  await settle();

  expect(onFocus).toHaveBeenCalledTimes(1);
  expect(onBlur).not.toHaveBeenCalled();

  await user.keyboard("{Escape}");
  await settle();
  expect(onBlur).not.toHaveBeenCalled();

  await user.click(screen.getByRole("button", { name: "Outside" }));
  await waitFor(() => expect(onBlur).toHaveBeenCalledTimes(1));
});

test("the HTML field is part of the field: switching to it is not a blur", async () => {
  const user = userEvent.setup();
  const onFocus = vi.fn();
  const onBlur = vi.fn();
  const { editor } = renderBeside({ onFocus, onBlur, defaultValue: "<p>Text</p>" });
  focusDocument(editor);

  await user.click(screen.getByRole("button", { name: "HTML" }));
  await screen.findByRole("textbox", { name: "HTML source" });
  await settle();

  expect(onFocus).toHaveBeenCalledTimes(1);
  expect(onBlur).not.toHaveBeenCalled();
});

test("a pending onChange is flushed before onBlur, with the fresh HTML", async () => {
  const user = userEvent.setup();
  const calls: string[] = [];
  const { editor } = renderBeside({
    changeDelay: 5000,
    onChange: (html) => calls.push(`change:${html}`),
    onBlur: () => calls.push("blur"),
  });
  focusDocument(editor);
  act(() => void editor.commands.insertContent("draft"));
  expect(calls).toEqual([]);

  await user.click(screen.getByRole("button", { name: "Outside" }));
  await waitFor(() => expect(calls).toContain("blur"));

  expect(calls).toEqual(["change:<p>draft</p>", "blur"]);
});

test("leaving from the toolbar flushes the pending onChange before onBlur as well", async () => {
  const user = userEvent.setup();
  const calls: string[] = [];
  const { editor } = renderBeside({
    changeDelay: 5000,
    onChange: (html) => calls.push(`change:${html}`),
    onBlur: () => calls.push("blur"),
  });
  focusDocument(editor);
  act(() => void editor.commands.insertContent("draft"));
  act(() => screen.getByRole("button", { name: "Bold" }).focus());
  await settle();

  await user.click(screen.getByRole("button", { name: "Outside" }));
  await waitFor(() => expect(calls).toContain("blur"));

  expect(calls.at(-1)).toBe("blur");
  expect(calls.filter((call) => call.startsWith("change:"))).toEqual(["change:<p>draft</p>"]);
});

test("onFocus and onBlur work in a readOnly field", async () => {
  const user = userEvent.setup();
  const onFocus = vi.fn();
  const onBlur = vi.fn();
  const { editor } = renderBeside({ readOnly: true, defaultValue: "<p>Text</p>", onFocus, onBlur });

  act(() => editor.view.dom.focus());
  expect(onFocus).toHaveBeenCalledTimes(1);

  await user.click(screen.getByRole("button", { name: "Outside" }));
  await waitFor(() => expect(onBlur).toHaveBeenCalledTimes(1));
});

test("onChange keeps its contract: throttled, once with the latest HTML", () => {
  vi.useFakeTimers();
  try {
    const onChange = vi.fn();
    const { editor } = renderEditor({ onChange });
    act(() => void editor.commands.insertContent("ab"));
    expect(onChange).not.toHaveBeenCalled();
    act(() => void vi.advanceTimersByTime(300));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith("<p>ab</p>");
  } finally {
    vi.useRealTimers();
  }
});

/* ------------------------------------------------- порядок вставки и drop */

/** Вставка из буфера целым событием `paste`: данные буфера — объектом, как в тестах Markdown. */
function pasteEvent(
  editor: Editor,
  payload: { text?: string; html?: string; files?: File[] }
): boolean {
  const event = new Event("paste", { bubbles: true, cancelable: true });
  Object.assign(event, {
    clipboardData: {
      files: payload.files ?? [],
      getData: (type: string) =>
        (type === "text/plain" ? payload.text : type === "text/html" ? payload.html : "") ?? "",
      types: [
        ...(payload.text !== undefined ? ["text/plain"] : []),
        ...(payload.html !== undefined ? ["text/html"] : []),
      ],
    },
  });
  act(() => void editor.view.dom.dispatchEvent(event));
  return event.defaultPrevented;
}

/** Drop через `handleDrop` плагинов: позиции по координатам в jsdom нет. */
function dropFiles(editor: Editor, files: File[]): boolean {
  const event = Object.assign(new Event("drop", { cancelable: true }), {
    dataTransfer: { files },
    clientX: 0,
    clientY: 0,
  }) as unknown as DragEvent;
  let handled = false;
  act(() => {
    handled = !!editor.view.someProp("handleDrop", (handle) =>
      handle(editor.view, event, Slice.empty, false)
    );
  });
  return handled;
}

const pdf = () => new File(["%PDF"], "plan.pdf", { type: "application/pdf" });
const archive = () => new File(["PK"], "backup.zip", { type: "application/zip" });
const PHOTO = "https://cdn.example.com/photo.png";
const VIDEO = "https://video.example.com/watch/abc123";

test("a custom tool turns a pasted link into its own block before the built-in paste", () => {
  const { editor } = renderEditor({
    tools: [...RICH_TEXT_PRESETS.full, testVideoLinkTool],
    defaultValue: "<p>Intro</p>",
  });
  act(() => void editor.commands.setTextSelection(editor.state.doc.content.size - 1));

  expect(pasteEvent(editor, { text: VIDEO })).toBe(true);

  expect(editor.getHTML()).toBe(
    '<p>Intro</p><div data-block="test_video" data-test_id="abc123"></div>'
  );
});

test("it also beats the Markdown paste: a Markdown link to the video is taken whole", () => {
  const { editor } = renderEditor({
    tools: [...RICH_TEXT_PRESETS.full, testVideoLinkTool],
    defaultValue: "<p>Intro</p>",
  });
  act(() => void editor.commands.setTextSelection(editor.state.doc.content.size - 1));

  pasteEvent(editor, { text: `[Clip](${VIDEO})` });

  expect(editor.getHTML()).toBe(
    '<p>Intro</p><div data-block="test_video" data-test_id="abc123"></div>'
  );
  expect(editor.getHTML()).not.toContain("<a ");
});

test("without the custom tool the same text is pasted by the built-in paste", () => {
  const { editor } = renderEditor({ defaultValue: "<p>Intro</p>" });
  act(() => void editor.commands.setTextSelection(editor.state.doc.content.size - 1));

  pasteEvent(editor, { text: `[Clip](${VIDEO})` });

  expect(editor.getHTML()).toContain(`<a href="${VIDEO}"`);
});

test("the order does not depend on where the custom tool stands in tools", () => {
  // Свой Инструмент — первым в списке, встроенные — после: он всё равно раньше.
  const { editor } = renderEditor({
    tools: [testVideoLinkTool, ...RICH_TEXT_PRESETS.full],
    defaultValue: "<p>Intro</p>",
  });
  act(() => void editor.commands.setTextSelection(editor.state.doc.content.size - 1));

  pasteEvent(editor, { text: `[Clip](${VIDEO})` });

  expect(editor.getHTML()).toContain('data-block="test_video"');
  expect(editor.getHTML()).not.toContain("<a ");
});

test("a custom paste filter runs first, and the Schema still parses its result", () => {
  const trace: string[] = [];
  const { editor } = renderEditor({
    tools: [...RICH_TEXT_PRESETS.full, testPasteFilterTool({ trace })],
    defaultValue: "<p></p>",
  });

  pasteEvent(editor, { html: "<p>keep <s>struck</s></p>", text: "keep struck" });

  expect(trace).toContain("transformPastedHTML");
  // Фильтр дописал `<script>` и `onclick`: Схема их не знает и отбрасывает.
  expect(editor.getHTML()).toBe("<p>keep <s>struck</s></p><p>added</p>");
});

test("a custom transaction past maxLength is rejected whole; the built-in paste is cut", () => {
  const { editor } = renderEditor({
    tools: [...RICH_TEXT_PRESETS.full, testPasteFilterTool()],
    defaultValue: "<p>1234</p>",
    maxLength: 8,
  });
  act(() => void editor.commands.setTextSelection(5));

  // Своя вставка за пределом: транзакция отклонена целиком, ни одного символа.
  pasteEvent(editor, { text: "!!abcdefgh" });
  expect(editor.getHTML()).toBe("<p>1234</p>");

  // Своя вставка в пределе проходит.
  pasteEvent(editor, { text: "!!ab" });
  expect(editor.getHTML()).toBe("<p>1234ab</p>");

  // Встроенная вставка за пределом режет хвост, как раньше.
  pasteEvent(editor, { text: "cdefgh" });
  expect(editor.getHTML()).toBe("<p>1234abcd</p>");
});

test("a custom tool takes a non-image file before the image upload", async () => {
  const onFile = vi.fn();
  const onUploadImage = vi.fn(async () => PHOTO);
  const { editor } = renderEditor({
    tools: [...RICH_TEXT_PRESETS.full, testPasteFilterTool({ onFile })],
    defaultValue: "<p>Text</p>",
    onUploadImage,
  });
  const file = pdf();

  expect(pasteEvent(editor, { files: [file] })).toBe(true);

  expect(onFile).toHaveBeenCalledWith(file, "paste");
  expect(onUploadImage).not.toHaveBeenCalled();
  expect(screen.queryByRole("alert")).toBeNull();
});

test("a custom tool takes a dropped non-image file", () => {
  const onFile = vi.fn();
  const onUploadImage = vi.fn(async () => PHOTO);
  const { editor } = renderEditor({
    tools: [...RICH_TEXT_PRESETS.full, testPasteFilterTool({ onFile })],
    defaultValue: "<p>Text</p>",
    onUploadImage,
  });
  const file = pdf();

  expect(dropFiles(editor, [file])).toBe(true);

  expect(onFile).toHaveBeenCalledWith(file, "drop");
  expect(onUploadImage).not.toHaveBeenCalled();
  expect(screen.queryByRole("alert")).toBeNull();
});

test("a file the custom tool leaves alone reaches the kit and gets the not-an-image message", () => {
  const onFile = vi.fn();
  const { editor } = renderEditor({
    tools: [...RICH_TEXT_PRESETS.full, testPasteFilterTool({ onFile })],
    defaultValue: "<p>Text</p>",
    onUploadImage: async () => PHOTO,
  });

  expect(pasteEvent(editor, { files: [archive()] })).toBe(true);

  expect(onFile).not.toHaveBeenCalled();
  expect(screen.getByRole("alert").textContent).toBe("backup.zip is not an image");
});

test("a dropped file the custom tool leaves alone gets the same message", () => {
  const { editor } = renderEditor({
    tools: [...RICH_TEXT_PRESETS.full, testPasteFilterTool()],
    defaultValue: "<p>Text</p>",
    onUploadImage: async () => PHOTO,
  });

  expect(dropFiles(editor, [archive()])).toBe(true);

  expect(screen.getByRole("alert").textContent).toBe("backup.zip is not an image");
});

test("an image is still uploaded by the kit when the custom tool does not take it", async () => {
  const onUploadImage = vi.fn(async () => PHOTO);
  const { editor } = renderEditor({
    tools: [...RICH_TEXT_PRESETS.full, testPasteFilterTool()],
    defaultValue: "<p>Text</p>",
    onUploadImage,
  });
  const photo = new File(["png"], "photo.png", { type: "image/png" });

  pasteEvent(editor, { files: [photo] });
  await act(async () => {});

  expect(onUploadImage).toHaveBeenCalledWith(photo);
  expect(editor.getHTML()).toContain(`<img src="${PHOTO}"`);
});
