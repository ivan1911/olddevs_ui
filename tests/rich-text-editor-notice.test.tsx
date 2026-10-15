// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import {
  RichTextEditor,
  type RichTextEditorHandle,
  type RichTextEditorProps,
} from "../src/editor/index.js";
import { UiProvider } from "../src/i18n/UiProvider.js";
import { messages as ru } from "../src/locales/ru.js";
import { loadLazyBuiltins } from "./editor-lazy-builtins.js";

// Ленивые `codeBlock` и `table` (OLDSUI-111): `full` готов в `render` после загрузки чанков.
beforeAll(loadLazyBuiltins);

afterEach(cleanup);

/**
 * Сообщение поля и Строка статуса (OLDSUI-112, ADR-0058, раздел 7).
 *
 * Сообщение поля — одна команда движка `showNotice`: свой Инструмент зовёт её
 * из Extensions, экран — через `handle.editor`. Здесь она вызывается из
 * `ref.editor` — так же, как её позовёт код экрана; публичной формы своего
 * Инструмента, откуда её звал бы Инструмент, пока нет (OLDSUI-103). Сообщения о
 * картинках идут тем же каналом — их ожидания в `rich-text-editor-image.test.tsx`.
 */
function renderEditor(props: Partial<RichTextEditorProps> = {}) {
  const ref = createRef<RichTextEditorHandle>();
  const view = render(<RichTextEditor ref={ref} aria-label="Body" {...props} />);
  const editor = ref.current?.editor;
  if (!editor) throw new Error("the editor was not created inside render()");
  return { ...view, ref, editor };
}

/** Живой регион Сообщения поля — его текст озвучивается и невидим. */
const announced = () => screen.getByRole("status").textContent;

test("a status notice is announced and has no visible line", () => {
  const { editor } = renderEditor({ defaultValue: "<p>Text</p>" });

  act(() => void editor.commands.showNotice({ tone: "status", text: "Draft restored" }));

  expect(announced()).toBe("Draft restored");
  expect(screen.queryByRole("alert")).toBeNull();
  // Невидим: текст есть только внутри живого региона, видимой копии нет.
  expect(screen.getAllByText("Draft restored")).toHaveLength(1);
  expect(screen.getByRole("status").className).toContain("sr-only");
});

test("an error notice is a visible role=alert line under the field", () => {
  const { editor } = renderEditor({ defaultValue: "<p>Text</p>" });

  act(() => void editor.commands.showNotice({ tone: "error", text: "Could not insert the card" }));

  expect(screen.getByRole("alert").textContent).toBe("Could not insert the card");
  expect(announced()).toBe("");
});

test("the notice is available without the image tool, in a custom set", () => {
  const { editor } = renderEditor({ tools: ["bold"], defaultValue: "<p>Text</p>" });

  act(() => void editor.commands.showNotice({ tone: "status", text: "Saved to drafts" }));
  expect(announced()).toBe("Saved to drafts");

  act(() => void editor.commands.showNotice({ tone: "error", text: "Not saved" }));
  expect(screen.getByRole("alert").textContent).toBe("Not saved");
});

test("a new notice replaces the previous one: one place, the last message", () => {
  const { editor } = renderEditor({ defaultValue: "<p>Text</p>" });

  act(() => void editor.commands.showNotice({ tone: "error", text: "First failure" }));
  act(() => void editor.commands.showNotice({ tone: "error", text: "Second failure" }));
  expect(screen.getAllByRole("alert")).toHaveLength(1);
  expect(screen.getByRole("alert").textContent).toBe("Second failure");

  // Тон другой — прежнее уходит целиком: ни строки ошибки, ни старого объявления.
  act(() => void editor.commands.showNotice({ tone: "status", text: "Retrying" }));
  expect(screen.queryByRole("alert")).toBeNull();
  expect(announced()).toBe("Retrying");

  act(() => void editor.commands.showNotice({ tone: "error", text: "Gave up" }));
  expect(announced()).toBe("");
  expect(screen.getByRole("alert").textContent).toBe("Gave up");
});

test("showNotice(null) clears either tone", () => {
  const { editor } = renderEditor({ defaultValue: "<p>Text</p>" });

  act(() => void editor.commands.showNotice({ tone: "error", text: "Failure" }));
  act(() => void editor.commands.showNotice(null));
  expect(screen.queryByRole("alert")).toBeNull();

  act(() => void editor.commands.showNotice({ tone: "status", text: "Working" }));
  act(() => void editor.commands.showNotice(null));
  expect(announced()).toBe("");
});

test("an author edit clears the error, but not the status", () => {
  const { editor } = renderEditor({ defaultValue: "<p>Text</p>" });

  act(() => void editor.commands.showNotice({ tone: "error", text: "Failure" }));
  act(() => void editor.commands.insertContent("!"));
  expect(screen.queryByRole("alert")).toBeNull();

  act(() => void editor.commands.showNotice({ tone: "status", text: "Working" }));
  act(() => void editor.commands.insertContent("!"));
  expect(announced()).toBe("Working");
});

test("a notice does not touch the document, the history or onChange", () => {
  vi.useFakeTimers();
  try {
    const onChange = vi.fn();
    const { editor } = renderEditor({ defaultValue: "<p>Text</p>", onChange, changeDelay: 0 });
    const before = editor.getHTML();

    act(() => void editor.commands.showNotice({ tone: "error", text: "Failure" }));
    act(() => void editor.commands.showNotice({ tone: "status", text: "Working" }));
    act(() => void editor.commands.showNotice(null));
    act(() => void vi.runAllTimers());

    expect(editor.getHTML()).toBe(before);
    expect(editor.can().undo()).toBe(false);
    expect(onChange).not.toHaveBeenCalled();
  } finally {
    vi.useRealTimers();
  }
});

test("`can()` does not show the notice: only a real call does", () => {
  const { editor } = renderEditor({ defaultValue: "<p>Text</p>" });

  act(() => void editor.can().showNotice({ tone: "error", text: "Failure" }));

  expect(screen.queryByRole("alert")).toBeNull();
});

test("a notice with no text is the same as no notice", () => {
  const { editor } = renderEditor({ defaultValue: "<p>Text</p>" });

  act(() => void editor.commands.showNotice({ tone: "error", text: "Failure" }));
  act(() => void editor.commands.showNotice({ tone: "error", text: "" }));

  expect(screen.queryByRole("alert")).toBeNull();
});

test("a read-only field still shows a notice; the editor is not enabled by it", () => {
  const { editor } = renderEditor({ readOnly: true, defaultValue: "<p>Text</p>" });

  act(() => void editor.commands.showNotice({ tone: "error", text: "Failure" }));

  expect(screen.getByRole("alert").textContent).toBe("Failure");
  expect(editor.isEditable).toBe(false);
});

test("a notice is shown as plain text: markup in it is not interpreted", () => {
  const { editor } = renderEditor({ defaultValue: "<p>Text</p>" });

  act(() => void editor.commands.showNotice({ tone: "error", text: "Failure: 100% <b>" }));

  expect(screen.getByRole("alert").textContent).toBe("Failure: 100% <b>");
});

test("the image notices go through the same place: one alert for a custom and a file notice", async () => {
  const { editor } = renderEditor({ defaultValue: "<p>Text</p>" });

  act(() => void editor.commands.showNotice({ tone: "error", text: "Custom failure" }));
  // Файл без загрузчика отклоняется сообщением кита — оно заменяет своё.
  const file = new File(["x"], "photo.png", { type: "image/png" });
  act(() => void editor.commands.uploadImages([file]));

  expect(screen.getAllByRole("alert")).toHaveLength(1);
  expect(screen.getByRole("alert").textContent).toBe(
    "Files can't be uploaded here. Insert the image by its address."
  );
});

test("the live region is there in the Russian locale too, with kit strings from the catalog", () => {
  const ref = createRef<RichTextEditorHandle>();
  render(
    <UiProvider locale="ru-RU" messages={ru}>
      <RichTextEditor ref={ref} aria-label="Body" defaultValue="<p>Text</p>" />
    </UiProvider>
  );
  const editor = ref.current!.editor!;

  act(() => void editor.commands.uploadImages([new File(["x"], "a.png", { type: "image/png" })]));

  expect(screen.getByRole("alert").textContent).toBe(ru.editor.imageFilesUnsupported);
});

/* Строка статуса. */

test("the status line shows the screen's content at the start and the counter at the end", () => {
  renderEditor({
    maxLength: 10,
    defaultValue: "<p>123456789</p>",
    status: <span>Saved</span>,
  });

  const saved = screen.getByText("Saved");
  const counter = screen.getByText("1 character left");
  // Одна строка: ближайший общий предок своего содержимого и счётчика.
  let row = saved.parentElement as HTMLElement;
  while (!row.contains(counter)) row = row.parentElement as HTMLElement;

  // Своё содержимое раньше счётчика кита, счётчик — последний в строке.
  expect(saved.compareDocumentPosition(counter) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(row.lastElementChild?.contains(counter)).toBe(true);
  expect(row.querySelector('[contenteditable="true"]')).toBeNull();
});

test("the status line has no role and is not a live region", () => {
  renderEditor({ status: <span>Saved</span>, defaultValue: "<p>Text</p>" });

  let node: HTMLElement | null = screen.getByText("Saved");
  while (node && node.getAttribute("contenteditable") !== "true" && node !== document.body) {
    expect(node.getAttribute("role")).toBeNull();
    expect(node.getAttribute("aria-live")).toBeNull();
    node = node.parentElement;
  }
  // Единственный `status` на поле — невидимый регион Сообщения поля, пустой.
  expect(screen.getByRole("status").textContent).toBe("");
  expect(screen.getByRole("status").contains(screen.getByText("Saved"))).toBe(false);
});

test("a screen that wants 'Saved' read aloud wraps it in its own role=status", () => {
  renderEditor({
    status: <span role="status">Saved</span>,
    defaultValue: "<p>Text</p>",
  });

  expect(screen.getAllByRole("status").some((region) => region.textContent === "Saved")).toBe(true);
});

test("the status line is shown without maxLength and without a counter", () => {
  renderEditor({ status: <span>12 words</span>, defaultValue: "<p>Text</p>" });

  expect(screen.getByText("12 words")).toBeTruthy();
});

test("an empty status is no line at all", () => {
  for (const status of [null, undefined, false, ""]) {
    const { container, unmount } = renderEditor({ status, defaultValue: "<p>Text</p>" });
    expect(container.querySelector("[data-status-line]")).toBeNull();
    unmount();
  }
});

test("the status line is visible when the field is read-only and when it is disabled", () => {
  for (const props of [{ readOnly: true }, { disabled: true }]) {
    const { unmount } = renderEditor({
      ...props,
      status: <span>Saved</span>,
      maxLength: 10,
      defaultValue: "<p>123456789</p>",
    });

    expect(screen.getByText("Saved")).toBeTruthy();
    expect(screen.getByText("1 character left")).toBeTruthy();
    unmount();
  }
});

test("the counter keeps its aria-describedby; the status line does not join the description", () => {
  const { editor } = renderEditor({
    maxLength: 10,
    defaultValue: "<p>123456789</p>",
    status: <span>Saved</span>,
  });

  const counter = screen.getByText("1 character left");
  const describedBy = (editor.view.dom.getAttribute("aria-describedby") ?? "").split(" ");

  expect(describedBy).toContain(counter.id);
  expect(describedBy).toHaveLength(1);
});

test("the status line follows the screen's state", () => {
  const { rerender } = render(
    <RichTextEditor aria-label="Body" defaultValue="<p>Text</p>" status={<span>Saving…</span>} />
  );
  expect(screen.getByText("Saving…")).toBeTruthy();

  rerender(
    <RichTextEditor aria-label="Body" defaultValue="<p>Text</p>" status={<span>Saved</span>} />
  );
  expect(screen.queryByText("Saving…")).toBeNull();
  expect(screen.getByText("Saved")).toBeTruthy();
});
