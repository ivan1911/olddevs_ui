// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { createRef } from "react";
import { Slice } from "@tiptap/pm/model";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import type { Editor } from "@tiptap/core";
import { UiProvider } from "../src/i18n/UiProvider.js";
import { messages as ru } from "../src/locales/ru.js";
import {
  RichTextEditor,
  type RichTextEditorHandle,
  type RichTextEditorProps,
} from "../src/editor/index.js";
import { loadLazyBuiltins } from "./editor-lazy-builtins.js";

// Ленивые `codeBlock` и `table` (OLDSUI-111): `full` готов в `render` после загрузки чанков.
beforeAll(loadLazyBuiltins);

afterEach(cleanup);

/**
 * Картинки Редактора (OLDSUI-44): Блок `<figure>` с `<img>` и необязательной
 * подписью, вставка по адресу и загрузка через `onUploadImage`, ширина
 * пресетами.
 *
 * Проверяется снаружи — HTML на выходе, роли и имена; движок через `ref.editor`
 * только там, где jsdom не умеет ввода и событий буфера.
 */
function renderEditor(props: Partial<RichTextEditorProps> = {}) {
  const ref = createRef<RichTextEditorHandle>();
  const view = render(<RichTextEditor ref={ref} aria-label="Body" {...props} />);
  const editor = ref.current?.editor;
  if (!editor) throw new Error("the editor was not created inside render()");
  return { ...view, ref, editor };
}

const PHOTO = "https://cdn.example.com/photo.png";

/** Тексты, на которые поле ссылается `aria-describedby`: подсказка и ошибка. */
function describedBy(field: HTMLElement): string[] {
  return (field.getAttribute("aria-describedby") ?? "")
    .split(" ")
    .filter(Boolean)
    .map((id) => document.getElementById(id)?.textContent ?? "");
}

test("a figure keeps its image, alt text, width and caption", () => {
  const { editor } = renderEditor({
    defaultValue:
      `<figure><img src="${PHOTO}" alt="A lake" data-width="50">` +
      "<figcaption>The lake at <strong>dawn</strong></figcaption></figure>",
  });

  expect(editor.getHTML()).toBe(
    `<figure><img src="${PHOTO}" alt="A lake" data-width="50">` +
      "<figcaption>The lake at <strong>dawn</strong></figcaption></figure>"
  );
});

test("a bare image becomes a figure; an empty caption is not written", () => {
  const { editor } = renderEditor({
    defaultValue: `<p>Before</p><img src="${PHOTO}"><figure><img src="${PHOTO}" alt="x"><figcaption></figcaption></figure>`,
  });

  expect(editor.getHTML()).toBe(
    `<p>Before</p><figure><img src="${PHOTO}" alt=""></figure>` +
      `<figure><img src="${PHOTO}" alt="x"></figure>`
  );
});

test("the Image button inserts an image by its address with alt text", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: "<p>Intro</p><p></p>" });
  act(() => void editor.commands.setTextSelection(8));

  await user.click(screen.getByRole("button", { name: "Image" }));
  const popover = await screen.findByRole("dialog", { name: "Image" });
  const address = screen.getByRole("textbox", { name: "Image address" });
  expect(popover.contains(address)).toBe(true);
  expect(document.activeElement).toBe(address);

  // Адрес без схемы — как в строке браузера: получает `https://`.
  await user.type(address, "cdn.example.com/photo.png");
  await user.type(screen.getByRole("textbox", { name: "Alternative text" }), "A lake{Enter}");

  expect(screen.queryByRole("dialog", { name: "Image" })).toBeNull();
  // Пустой абзац под кареткой стал картинкой, а не остался пустым рядом с ней.
  expect(editor.getHTML()).toBe(`<p>Intro</p><figure><img src="${PHOTO}" alt="A lake"></figure>`);
  // Каретка — в подписи: следующий набор становится подписью.
  await waitFor(() => expect(document.activeElement).toBe(editor.view.dom));
  act(() => void editor.commands.insertContent("Dawn"));
  expect(editor.getHTML()).toBe(
    `<p>Intro</p><figure><img src="${PHOTO}" alt="A lake"><figcaption>Dawn</figcaption></figure>`
  );
});

test("the address field refuses data:, blob:, relative and foreign addresses", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: "<p>Text</p>" });

  await user.click(screen.getByRole("button", { name: "Image" }));
  const field = await screen.findByRole("textbox", { name: "Image address" });
  for (const address of [
    "data:image/png;base64,iVBORw0KGgo=",
    "blob:https://example.com/0b6b",
    "javascript:alert(1)",
    "/uploads/photo.png",
    "mailto:team@example.com",
  ]) {
    await user.clear(field);
    await user.type(field, `${address}{Enter}`);

    expect(screen.getByRole("dialog", { name: "Image" })).toBeDefined();
    expect(field.getAttribute("aria-invalid")).toBe("true");
    expect(describedBy(field)).toContain(
      "Enter an image address starting with https:// or http://"
    );
  }
  expect(editor.getHTML()).toBe("<p>Text</p>");
});

test("without the image tool there is no button and an <img> is dropped", () => {
  const { editor } = renderEditor({
    tools: ["bold"],
    defaultValue: `<p>Text</p><figure><img src="${PHOTO}"><figcaption>Cap</figcaption></figure>`,
  });

  expect(screen.queryByRole("button", { name: "Image" })).toBeNull();
  expect(editor.getHTML()).toBe("<p>Text</p><p>Cap</p>");
});

/** Обещание, которое тест решает сам: загрузка «идёт», пока он не скажет. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((ok, fail) => {
    resolve = ok;
    reject = fail;
  });
  return { promise, resolve, reject };
}

const photo = () => new File(["png"], "photo.png", { type: "image/png" });

/**
 * Вставка из буфера — тем же путём, каким её отдаёт движку ProseMirror:
 * `handlePaste` плагинов. `ClipboardEvent` и `DataTransfer` в jsdom нет,
 * поэтому буфер — объект с файлами и `getData`.
 */
function pasteFiles(editor: Editor, files: File[], html = ""): boolean {
  const event = Object.assign(new Event("paste", { cancelable: true }), {
    clipboardData: { files, getData: (type: string) => (type === "text/html" ? html : "") },
  }) as unknown as ClipboardEvent;
  let handled = false;
  act(() => {
    handled = !!editor.view.someProp("handlePaste", (handle) =>
      handle(editor.view, event, Slice.empty)
    );
  });
  return handled;
}

/** Живой регион сообщений о файлах — `role="status"` Редактора. */
function status(): string {
  return screen.getByRole("status").textContent ?? "";
}

test("an uploaded file shows a placeholder, then the image; one undo removes it", async () => {
  const upload = deferred<string>();
  const onUploadImage = vi.fn(() => upload.promise);
  const { editor } = renderEditor({ defaultValue: "<p>Text</p>", onUploadImage });
  act(() => void editor.commands.setTextSelection(5));
  const file = photo();

  expect(pasteFiles(editor, [file])).toBe(true);

  expect(onUploadImage).toHaveBeenCalledWith(file);
  expect(status()).toBe("Uploading photo.png…");
  expect(editor.view.dom.textContent).toContain("Uploading photo.png…");
  // Пока обещание не решено, в Документе картинки нет — ни `blob:`, ни base64.
  expect(editor.getHTML()).toBe("<p>Text</p>");

  await act(async () => upload.resolve(PHOTO));

  expect(editor.getHTML()).toBe(`<p>Text</p><figure><img src="${PHOTO}" alt=""></figure>`);
  expect(editor.view.dom.textContent).not.toContain("Uploading");
  expect(status()).toBe("photo.png uploaded");

  act(() => void editor.commands.undo());
  expect(editor.getHTML()).toBe("<p>Text</p>");
});

test("a failed upload leaves the document as it was and says so", async () => {
  const upload = deferred<string>();
  const { editor } = renderEditor({
    defaultValue: "<p>Text</p>",
    onUploadImage: () => upload.promise,
  });

  pasteFiles(editor, [photo()]);
  await act(async () => upload.reject(new Error("413")));

  expect(editor.getHTML()).toBe("<p>Text</p>");
  expect(editor.view.dom.textContent).not.toContain("Uploading");
  expect(screen.getByRole("alert").textContent).toBe(
    "Couldn't upload photo.png. The document is unchanged."
  );
  // Откатывать нечего: неудачная загрузка не оставила правки в истории.
  expect(editor.can().undo()).toBe(false);
});

test("an upload that resolves to a data: or relative address counts as a failure", async () => {
  for (const address of ["data:image/png;base64,iVBORw0KGgo=", "/uploads/photo.png"]) {
    const { editor, unmount } = renderEditor({
      defaultValue: "<p>Text</p>",
      onUploadImage: async () => address,
    });

    pasteFiles(editor, [photo()]);
    await act(async () => {});

    expect(editor.getHTML()).toBe("<p>Text</p>");
    expect(screen.getByRole("alert").textContent).toContain("Couldn't upload photo.png");
    unmount();
  }
});

test("without onUploadImage a pasted file is refused with a hint and nothing lands", () => {
  const { editor } = renderEditor({ defaultValue: "<p>Text</p>" });

  expect(pasteFiles(editor, [photo()])).toBe(true);

  expect(editor.getHTML()).toBe("<p>Text</p>");
  expect(screen.getByRole("alert").textContent).toBe(
    "Files can't be uploaded here. Insert the image by its address."
  );
});

test("a file that comes with text in the clipboard is left to the HTML paste", () => {
  // Так кладёт выделение Word: текст в HTML и снимок выделения картинкой.
  const onUploadImage = vi.fn(async () => PHOTO);
  const { editor } = renderEditor({ defaultValue: "<p>Text</p>", onUploadImage });

  expect(pasteFiles(editor, [photo()], "<p>Quarterly <b>report</b></p>")).toBe(false);
  expect(onUploadImage).not.toHaveBeenCalled();
});

test("a file that is not an image is refused by name", () => {
  const onUploadImage = vi.fn(async () => PHOTO);
  const { editor } = renderEditor({ defaultValue: "<p>Text</p>", onUploadImage });

  pasteFiles(editor, [new File(["%PDF"], "notes.pdf", { type: "application/pdf" })]);

  expect(onUploadImage).not.toHaveBeenCalled();
  expect(screen.getByRole("alert").textContent).toBe("notes.pdf is not an image");
});

test("a dropped file is uploaded like a pasted one", async () => {
  const onUploadImage = vi.fn(async () => PHOTO);
  const { editor } = renderEditor({ defaultValue: "<p>Text</p>", onUploadImage });
  const event = Object.assign(new Event("drop", { cancelable: true }), {
    dataTransfer: { files: [photo()] },
    clientX: 0,
    clientY: 0,
  }) as unknown as DragEvent;

  let handled = false;
  await act(async () => {
    handled = !!editor.view.someProp("handleDrop", (handle) =>
      handle(editor.view, event, Slice.empty, false)
    );
  });

  expect(handled).toBe(true);
  expect(editor.getHTML()).toContain(`<figure><img src="${PHOTO}" alt=""></figure>`);
});

test("without an uploader the popover offers no file upload", async () => {
  const user = userEvent.setup();
  renderEditor({ defaultValue: "<p></p>" });

  await user.click(screen.getByRole("button", { name: "Image" }));
  expect(await screen.findByRole("dialog", { name: "Image" })).toBeDefined();
  expect(screen.queryByRole("button", { name: "Upload from device" })).toBeNull();
  expect(document.querySelector('input[type="file"]')).toBeNull();
});

test("with an uploader the popover uploads a chosen file", async () => {
  const user = userEvent.setup();
  const onUploadImage = vi.fn(async () => PHOTO);
  const { editor } = renderEditor({ defaultValue: "<p></p>", onUploadImage });

  await user.click(screen.getByRole("button", { name: "Image" }));
  expect(await screen.findByRole("button", { name: "Upload from device" })).toBeDefined();
  const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
  expect(input.accept).toBe("image/*");
  await user.upload(input, photo());

  expect(screen.queryByRole("dialog", { name: "Image" })).toBeNull();
  await waitFor(() =>
    expect(editor.getHTML()).toBe(`<figure><img src="${PHOTO}" alt=""></figure>`)
  );
  expect(onUploadImage).toHaveBeenCalledTimes(1);
});

/** Клавиша в документе — так, как её слышит движок: `keydown` на редактируемой области. */
function press(editor: Editor, key: string) {
  act(() => {
    editor.view.dom.dispatchEvent(
      new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true })
    );
  });
}

const FIGURE = `<figure><img src="${PHOTO}" alt="A lake"></figure>`;

test("Enter on a selected image enters its caption; Enter in the caption leaves it", () => {
  const { editor } = renderEditor({ defaultValue: `<p>Intro</p>${FIGURE}` });
  // Картинка — сразу за абзацем «Intro» (0…7).
  act(() => void editor.commands.setNodeSelection(7));

  press(editor, "Enter");
  act(() => void editor.commands.insertContent("Dawn"));
  press(editor, "Enter");
  act(() => void editor.commands.insertContent("After"));

  expect(editor.getHTML()).toBe(
    `<p>Intro</p><figure><img src="${PHOTO}" alt="A lake"><figcaption>Dawn</figcaption></figure>` +
      "<p>After</p>"
  );
});

test("Backspace at the start of a caption selects the image instead of merging", () => {
  const { editor } = renderEditor({
    defaultValue: `<p>Intro</p><figure><img src="${PHOTO}" alt=""><figcaption>Dawn</figcaption></figure>`,
  });
  // Начало подписи: 7 — картинка, 8 — подпись, 9 — её первая буква.
  act(() => void editor.commands.setTextSelection(9));

  press(editor, "Backspace");

  expect(editor.state.selection.from).toBe(7);
  expect(editor.isActive("image")).toBe(true);
  expect(editor.getHTML()).toContain("<figcaption>Dawn</figcaption>");
});

test("block commands from inside a caption cannot turn the image into text", () => {
  const { editor } = renderEditor({
    defaultValue: `<figure><img src="${PHOTO}" alt=""><figcaption>Dawn</figcaption></figure>`,
  });
  act(() => void editor.commands.setTextSelection(3));

  act(() => void editor.chain().setHeading({ level: 2 }).run());
  act(() => void editor.chain().toggleBulletList().run());
  act(() => void editor.chain().setCodeBlock().run());

  expect(editor.getHTML()).toBe(
    `<figure><img src="${PHOTO}" alt=""><figcaption>Dawn</figcaption></figure>`
  );
});

test("width presets in the popover work from the keyboard and toggle off", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: `<p>Intro</p>${FIGURE}` });
  act(() => void editor.commands.setNodeSelection(7));
  const button = screen.getByRole("button", { name: "Image" });
  // Выделена картинка — кнопка нажата: поповер будет править её, а не вставлять новую.
  expect(button.getAttribute("aria-pressed")).toBe("true");

  await user.click(button);
  const group = await screen.findByRole("group", { name: "Width" });
  const half = screen.getByRole("button", { name: "50%" });
  expect(group.contains(half)).toBe(true);
  expect(half.getAttribute("aria-pressed")).toBe("false");
  // Значения существующей картинки — в полях.
  expect((screen.getByRole("textbox", { name: "Image address" }) as HTMLInputElement).value).toBe(
    PHOTO
  );
  half.focus();
  await user.keyboard("{Enter}");
  expect(half.getAttribute("aria-pressed")).toBe("true");
  await user.click(screen.getByRole("button", { name: "Apply" }));

  expect(editor.getHTML()).toBe(
    `<p>Intro</p><figure><img src="${PHOTO}" alt="A lake" data-width="50"></figure>`
  );

  // Тот же пресет повторно — назад к своему размеру картинки.
  await waitFor(() => expect(document.activeElement).toBe(editor.view.dom));
  await user.click(screen.getByRole("button", { name: "Image" }));
  await user.click(await screen.findByRole("button", { name: "50%" }));
  await user.click(screen.getByRole("button", { name: "Apply" }));
  expect(editor.getHTML()).toBe(`<p>Intro</p>${FIGURE}`);
});

test("the popover removes the selected image", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: `<p>Intro</p>${FIGURE}` });
  act(() => void editor.commands.setNodeSelection(7));

  await user.click(screen.getByRole("button", { name: "Image" }));
  await user.click(await screen.findByRole("button", { name: "Remove image" }));

  expect(editor.getHTML()).toBe("<p>Intro</p>");
});

test("a document with only an image is not empty for the form", () => {
  const ref = createRef<RichTextEditorHandle>();
  const { container } = render(
    <form>
      <RichTextEditor ref={ref} aria-label="Body" name="body" required defaultValue={FIGURE} />
    </form>
  );
  const form = container.querySelector("form")!;

  expect(ref.current!.getHTML()).toBe(FIGURE);
  expect(form.checkValidity()).toBe(true);
  expect(new FormData(form).get("body")).toBe(FIGURE);
});

test("Markdown images become figures within the address policy and leave as ![alt](src)", () => {
  const { ref, editor } = renderEditor();

  act(() =>
    ref.current!.setMarkdown(
      `Before ![A lake](${PHOTO}) after\n\n![x](data:image/png;base64,iVBORw0KGgo=)\n\n![](/rel.png)`
    )
  );

  // Картинка внутри строки — свой Блок между двумя половинами абзаца; чужие
  // адреса пропадают вместе с картинкой.
  expect(editor.getHTML()).toBe(
    `<p>Before </p><figure><img src="${PHOTO}" alt="A lake"></figure><p> after</p>`
  );
  expect(ref.current!.getMarkdown()).toBe(`Before \n\n![A lake](${PHOTO})\n\n after`);
});

test("a figure's caption and width do not survive Markdown", () => {
  const { ref } = renderEditor({
    defaultValue: `<figure><img src="${PHOTO}" alt="A lake" data-width="50"><figcaption>Dawn</figcaption></figure>`,
  });

  expect(ref.current!.getMarkdown()).toBe(`![A lake](${PHOTO})`);
});

test("pasted Markdown with an image inserts the figure", () => {
  const { editor } = renderEditor({ defaultValue: "<p></p>" });

  // Обычный `paste` с текстом буфера: `pasteText` движка — это «вставить как
  // простой текст», и Markdown в нём не разбирается намеренно.
  const event = Object.assign(new Event("paste", { bubbles: true, cancelable: true }), {
    clipboardData: {
      getData: (type: string) => (type === "text/plain" ? `![Lake](${PHOTO})` : ""),
      types: ["text/plain"],
    },
  });
  act(() => void editor.view.dom.dispatchEvent(event));

  expect(editor.getHTML()).toBe(`<figure><img src="${PHOTO}" alt="Lake"></figure>`);
});

test("the insert menu adds an image through the same popover", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: "<p>Intro</p>" });
  act(() => void editor.commands.setTextSelection(3));

  await user.click(screen.getByRole("button", { name: "Insert block" }));
  const insert = screen.getByRole("group", { name: "Insert" });
  const item = screen.getByRole("menuitem", { name: "Image" });
  expect(insert.contains(item)).toBe(true);
  await user.click(item);

  const address = await screen.findByRole("textbox", { name: "Image address" });
  await user.type(address, `${PHOTO}{Enter}`);

  // Новый Блок — после текущего, как у остальных пунктов «Добавить».
  expect(editor.getHTML()).toBe(`<p>Intro</p><figure><img src="${PHOTO}" alt=""></figure>`);
});

test("a slash command finds the image by its alias", () => {
  const { editor } = renderEditor();
  act(() => screen.getByRole("textbox", { name: "Body" }).focus());

  act(() => void editor.commands.insertContent("/img"));

  expect(screen.getByRole("option", { name: "Image" })).toBeDefined();
});

test("a selected image shows its own toolbar: width presets, edit and remove", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: `<p>Intro</p>${FIGURE}` });
  act(() => editor.view.focus());
  expect(screen.queryByRole("toolbar", { name: "Image" })).toBeNull();

  act(() => void editor.commands.setNodeSelection(7));
  const toolbar = await screen.findByRole("toolbar", { name: "Image" });
  const wide = screen.getByRole("button", { name: "75%" });
  expect(toolbar.contains(wide)).toBe(true);
  expect(wide.getAttribute("aria-pressed")).toBe("false");

  await user.click(wide);
  expect(editor.getHTML()).toBe(
    `<p>Intro</p><figure><img src="${PHOTO}" alt="A lake" data-width="75"></figure>`
  );
  // Картинка остаётся выделенной — следующий пресет жмётся сразу.
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "75%" }).getAttribute("aria-pressed")).toBe("true")
  );

  await user.click(screen.getByRole("button", { name: "Edit image" }));
  expect(await screen.findByRole("dialog", { name: "Image" })).toBeDefined();
  expect(
    (screen.getByRole("textbox", { name: "Alternative text" }) as HTMLInputElement).value
  ).toBe("A lake");
});

test("the floating formatting toolbar stays away from a selected image", async () => {
  const { editor } = renderEditor({ toolbar: "floating", defaultValue: `<p>Intro</p>${FIGURE}` });
  act(() => editor.view.focus());

  act(() => void editor.commands.setNodeSelection(7));

  expect(await screen.findByRole("toolbar", { name: "Image" })).toBeDefined();
  expect(screen.queryByRole("toolbar", { name: "Formatting" })).toBeNull();
});

test("Alt+F10 on a selected image moves focus into the image toolbar", async () => {
  const { editor } = renderEditor({ defaultValue: `<p>Intro</p>${FIGURE}` });
  act(() => editor.view.focus());
  act(() => void editor.commands.setNodeSelection(7));
  await screen.findByRole("toolbar", { name: "Image" });

  act(() => {
    editor.view.dom.dispatchEvent(
      new KeyboardEvent("keydown", { key: "F10", altKey: true, bubbles: true, cancelable: true })
    );
  });

  expect(document.activeElement).toBe(screen.getByRole("button", { name: "50%" }));
});

test("the image popover and file messages speak the provider's language", async () => {
  const user = userEvent.setup();
  const ref = createRef<RichTextEditorHandle>();
  render(
    <UiProvider messages={ru}>
      <RichTextEditor ref={ref} aria-label="Body" defaultValue="<p>Text</p>" />
    </UiProvider>
  );
  const editor = ref.current!.editor!;
  // Ожидания — из русского каталога, а не литералами (гейт i18n).
  const t = ru.editor;

  pasteFiles(editor, [photo()]);
  expect(screen.getByRole("alert").textContent).toBe(t.imageFilesUnsupported);

  await user.click(screen.getByRole("button", { name: t.image }));
  expect(await screen.findByRole("dialog", { name: t.image })).toBeDefined();
  const field = screen.getByRole("textbox", { name: t.imageAddress });
  expect(describedBy(screen.getByRole("textbox", { name: t.imageAlt }))).toContain(t.imageAltHint);
  await user.type(field, "data:x{Enter}");
  expect(describedBy(field)).toContain(t.imageInvalid);
  expect(screen.getByRole("button", { name: t.imageInsert })).toBeDefined();
});
