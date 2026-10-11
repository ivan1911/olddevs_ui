// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { createRef } from "react";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import { Dialog } from "../src/components/overlays/Dialog.js";
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
 * Ссылка Редактора (OLDSUI-42): Метка `a` с адресом из разрешённых схем,
 * `rel="noopener noreferrer"` на выходе и поповер с полем адреса.
 *
 * Проверяется снаружи — HTML на выходе, роли и имена; движок через `ref.editor`
 * только там, где jsdom не умеет ввода: выделение и набор идут командами.
 */
function renderEditor(props: Partial<RichTextEditorProps> = {}) {
  const ref = createRef<RichTextEditorHandle>();
  const view = render(<RichTextEditor ref={ref} aria-label="Body" {...props} />);
  const editor = ref.current?.editor;
  if (!editor) throw new Error("the editor was not created inside render()");
  return { ...view, ref, editor };
}

test("a loaded link keeps its address and leaves with rel and nothing else", () => {
  const { editor } = renderEditor({
    defaultValue:
      '<p><a href="https://example.com/a?b=1" target="_blank" class="x" title="t" rel="ugc">site</a></p>',
  });

  expect(editor.getHTML()).toBe(
    '<p><a href="https://example.com/a?b=1" rel="noopener noreferrer">site</a></p>'
  );
});

/** Ссылки с адресами вне Схемы: схема чужая, адрес относительный или спрятан пробелами. */
const HOSTILE_LINKS =
  '<p><a href="javascript:alert(1)">js</a> <a href=" java\tscript:alert(1)">tab</a> ' +
  '<a href="data:text/html,x">data</a> <a href="ftp://example.com">ftp</a> ' +
  '<a href="/docs">relative</a> <a href="mailto:team@example.com">mail</a></p>';

test("a link outside the protocol policy loses its wrapper on load and on paste", () => {
  const { editor } = renderEditor({ defaultValue: HOSTILE_LINKS });
  const loaded = editor.getHTML();
  act(() => void editor.commands.clearContent());
  act(() => void editor.view.pasteHTML(HOSTILE_LINKS, new Event("paste") as ClipboardEvent));
  const pasted = editor.getHTML();

  for (const html of [loaded, pasted]) {
    expect(html.match(/<a /g)).toHaveLength(1);
    expect(html).toContain('<a href="mailto:team@example.com" rel="noopener noreferrer">mail</a>');
    // Текст отброшенной ссылки остаётся — уходит только обёртка.
    expect(html).toContain("js tab data ftp relative");
  }
});

test("a Markdown link with a foreign address keeps only its text", () => {
  const { ref, editor } = renderEditor();

  act(() => ref.current!.setMarkdown("[bad](javascript:alert(1)) and [good](https://example.com)"));

  expect(editor.getHTML()).toBe(
    '<p>bad and <a href="https://example.com" rel="noopener noreferrer">good</a></p>'
  );
});

test("without the link tool an anchor is plain text", () => {
  const { editor } = renderEditor({
    tools: ["bold"],
    defaultValue: '<p><a href="https://example.com">site</a></p>',
  });

  expect(editor.getHTML()).toBe("<p>site</p>");
});

test("an address typed in the text becomes a link once the word ends", () => {
  const { editor } = renderEditor();

  // Набор — как его видит движок: по символу за транзакцию, пробел закрывает слово.
  for (const char of "see example.com and ftp://example.org ") {
    act(() => void editor.commands.insertContent(char));
  }

  expect(editor.getHTML()).toBe(
    '<p>see <a href="https://example.com" rel="noopener noreferrer">example.com</a> and ftp://example.org </p>'
  );
});

test("a pasted address over a selection links it only within the policy", () => {
  const { editor } = renderEditor({ defaultValue: "<p>docs and files</p>" });

  act(() => void editor.commands.setTextSelection({ from: 1, to: 5 }));
  act(
    () =>
      void editor.view.pasteText("https://example.com/docs", new Event("paste") as ClipboardEvent)
  );
  act(() => void editor.commands.setTextSelection({ from: 10, to: 15 }));
  act(
    () =>
      void editor.view.pasteText("ftp://example.com/files", new Event("paste") as ClipboardEvent)
  );

  const html = editor.getHTML();
  expect(html).toContain('<a href="https://example.com/docs" rel="noopener noreferrer">docs</a>');
  // Ни ссылки на `ftp:`, ни ссылки без адреса — пустой Метки, которую
  // выход сохранил бы как `<a rel>` без `href`.
  expect(html).not.toMatch(/href="(?!https?:)/);
  expect(html).not.toContain("<a rel=");
});

test("a click on a link inside the editor places the caret and opens nothing", () => {
  const open = vi.spyOn(window, "open").mockImplementation(() => null);
  const { editor } = renderEditor({
    defaultValue: '<p><a href="https://example.com">site</a></p>',
  });
  const anchor = editor.view.dom.querySelector("a")!;

  /*
    Щелчок — тем же путём, каким его отдаёт движку ProseMirror: `handleClick`
    плагинов. Настоящий щелчок jsdom до него не доводит — позицию по
    координатам ему мерить нечем (`elementFromPoint`).
  */
  const event = new MouseEvent("click", { button: 0, bubbles: true });
  Object.defineProperty(event, "target", { value: anchor });
  const handled = editor.view.someProp("handleClick", (handle) => handle(editor.view, 2, event));

  expect(handled).toBeFalsy();
  expect(open).not.toHaveBeenCalled();
  open.mockRestore();
});

test("the Link button reports a link under the caret and names its shortcut", () => {
  const { editor } = renderEditor({
    defaultValue: '<p>plain <a href="https://example.com">site</a></p>',
  });
  const button = screen.getByRole("button", { name: "Link" });

  act(() => void editor.commands.setTextSelection(3));
  expect(button.getAttribute("aria-pressed")).toBe("false");
  act(() => void editor.commands.setTextSelection(9));
  expect(button.getAttribute("aria-pressed")).toBe("true");
  // jsdom — не Apple: `mod` — это Ctrl.
  expect(button.getAttribute("aria-keyshortcuts")).toBe("Control+K");
});

/** `Mod+K` в документе — так, как его слышит движок: `keydown` на редактируемой области. */
function pressModK(editor: RichTextEditorHandle["editor"]) {
  act(() => {
    editor!.view.dom.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true, cancelable: true })
    );
  });
}

test("Mod+K opens the address field; Enter links the selection and returns to the text", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: "<p>Read the docs</p>" });
  act(() => void editor.commands.setTextSelection({ from: 10, to: 14 }));

  pressModK(editor);
  const popover = await screen.findByRole("dialog", { name: "Link" });
  const field = screen.getByRole("textbox", { name: "Address" });
  expect(popover.contains(field)).toBe(true);
  expect(document.activeElement).toBe(field);

  await user.type(field, "example.com/docs{Enter}");

  expect(screen.queryByRole("dialog", { name: "Link" })).toBeNull();
  expect(editor.getHTML()).toBe(
    '<p>Read the <a href="https://example.com/docs" rel="noopener noreferrer">docs</a></p>'
  );
  // Radix возвращает фокус таймером после размонтирования поповера.
  await waitFor(() => expect(document.activeElement).toBe(editor.view.dom));
});

test("Escape in the address field cancels and returns to the text", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: "<p>Read the docs</p>" });
  act(() => void editor.commands.setTextSelection({ from: 10, to: 14 }));

  pressModK(editor);
  await user.type(await screen.findByRole("textbox", { name: "Address" }), "example.com");
  await user.keyboard("{Escape}");

  expect(screen.queryByRole("dialog", { name: "Link" })).toBeNull();
  expect(editor.getHTML()).toBe("<p>Read the docs</p>");
  await waitFor(() => expect(document.activeElement).toBe(editor.view.dom));
  // Выделение то же, что до поповера: можно открыть его снова или писать дальше.
  expect(editor.state.selection.from).toBe(10);
  expect(editor.state.selection.to).toBe(14);
});

/*
  Кнопка, сочетание, строка справочника и Метка ссылки приходят из одного
  описания Инструмента (ADR-0058, п. 10): без `link` нет ни одного из них.
*/
test("without the link tool there is no Link button, Mod+K opens nothing and the reference has no Link row", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({
    tools: ["bold", "emoji"],
    defaultValue: "<p>Read the docs</p>",
  });
  act(() => void editor.commands.setTextSelection({ from: 10, to: 14 }));

  expect(screen.queryByRole("button", { name: "Link" })).toBeNull();
  pressModK(editor);
  expect(screen.queryByRole("dialog", { name: "Link" })).toBeNull();

  await user.click(screen.getByRole("button", { name: "Keyboard shortcuts" }));
  const reference = await screen.findByRole("dialog", { name: "Keyboard shortcuts" });
  const rows = [...reference.querySelectorAll("tbody th")].map((cell) => cell.textContent);
  expect(rows).toContain("Bold");
  expect(rows).not.toContain("Link");
});

test("on an existing link the field shows its address and can remove the link", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({
    defaultValue: '<p>See <a href="https://example.com/old">the site</a> now</p>',
  });
  // Каретка внутри ссылки, без выделения.
  act(() => void editor.commands.setTextSelection(8));

  await user.click(screen.getByRole("button", { name: "Link" }));
  const field = await screen.findByRole("textbox", { name: "Address" });
  expect((field as HTMLInputElement).value).toBe("https://example.com/old");

  await user.clear(field);
  await user.type(field, "https://example.com/new{Enter}");
  expect(editor.getHTML()).toBe(
    '<p>See <a href="https://example.com/new" rel="noopener noreferrer">the site</a> now</p>'
  );
  await waitFor(() => expect(document.activeElement).toBe(editor.view.dom));

  act(() => void editor.commands.setTextSelection(8));
  pressModK(editor);
  await user.click(await screen.findByRole("button", { name: "Remove link" }));
  expect(editor.getHTML()).toBe("<p>See the site now</p>");
});

test("a new link has no Remove action; without a selection the address goes in as its text", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: "<p>Write to:</p>" });
  act(() => void editor.commands.setTextSelection(10));

  pressModK(editor);
  expect(screen.queryByRole("button", { name: "Remove link" })).toBeNull();
  await user.type(screen.getByRole("textbox", { name: "Address" }), "team@example.com");
  await user.click(screen.getByRole("button", { name: "Apply" }));

  expect(editor.getHTML()).toBe(
    '<p>Write to:<a href="mailto:team@example.com" rel="noopener noreferrer">team@example.com</a></p>'
  );
});

test("the field refuses an address outside the policy and says what it accepts", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: "<p>Click me</p>" });
  act(() => void editor.commands.setTextSelection({ from: 1, to: 6 }));

  pressModK(editor);
  const field = screen.getByRole("textbox", { name: "Address" });
  for (const address of ["javascript:alert(1)", "/relative/path", "ftp://example.com"]) {
    await user.clear(field);
    await user.type(field, `${address}{Enter}`);

    expect(screen.getByRole("dialog", { name: "Link" })).toBeDefined();
    expect(field.getAttribute("aria-invalid")).toBe("true");
    expect(field.getAttribute("aria-describedby")).toBeTruthy();
    const message = document.getElementById(field.getAttribute("aria-describedby")!);
    expect(message?.textContent).toBe("Enter a web address (http, https) or an email (mailto)");
  }
  expect(editor.getHTML()).toBe("<p>Click me</p>");
});

/**
 * Escape в поповере ссылки принадлежит поповеру, а не окну (ADR-0041, спека,
 * история 23). И `Dialog`, и `Popover` кита — Radix, и стек слоёв Radix
 * решает это сам; тест сторожит, что поповер остаётся в этом стеке, а не
 * становится своим слоем мимо него.
 */
test("Escape in the link popover inside a Dialog closes the popover, not the window", async () => {
  const user = userEvent.setup();
  const onClose = vi.fn();
  const ref = createRef<RichTextEditorHandle>();
  render(
    <Dialog open onClose={onClose} title="Edit article">
      <RichTextEditor ref={ref} aria-label="Body" defaultValue="<p>Read the docs</p>" />
    </Dialog>
  );
  const editor = ref.current!.editor!;
  // `view.focus()`, а не команда `focus()`: команда ставит фокус в следующем
  // кадре и забрала бы его у уже открытого поповера.
  act(() => editor.view.focus());
  act(() => void editor.commands.setTextSelection({ from: 10, to: 14 }));

  pressModK(editor);
  expect(await screen.findByRole("textbox", { name: "Address" })).toBeDefined();
  await user.keyboard("{Escape}");

  expect(screen.queryByRole("textbox", { name: "Address" })).toBeNull();
  expect(screen.getByRole("dialog", { name: "Edit article" })).toBeDefined();
  expect(onClose).not.toHaveBeenCalled();

  // Контроль: без поповера тот же Escape закрывает окно.
  await waitFor(() => expect(document.activeElement).toBe(editor.view.dom));
  await user.keyboard("{Escape}");
  expect(onClose).toHaveBeenCalledTimes(1);
});

test("the link popover speaks the provider's language", async () => {
  const user = userEvent.setup();
  const ref = createRef<RichTextEditorHandle>();
  render(
    <UiProvider messages={ru}>
      <RichTextEditor ref={ref} aria-label="Body" defaultValue="<p>Click me</p>" />
    </UiProvider>
  );
  const editor = ref.current!.editor!;
  act(() => void editor.commands.setTextSelection({ from: 1, to: 6 }));

  // Ожидания — из русского каталога, а не литералами (гейт i18n).
  const t = ru.editor;
  await user.click(screen.getByRole("button", { name: t.link }));
  expect(screen.getByRole("dialog", { name: t.link })).toBeDefined();
  const field = screen.getByRole("textbox", { name: t.linkAddress });
  await user.type(field, "javascript:x{Enter}");
  expect(document.getElementById(field.getAttribute("aria-describedby")!)?.textContent).toBe(
    t.linkInvalid
  );
  expect(screen.getByRole("button", { name: t.linkApply })).toBeDefined();
  expect(screen.queryByRole("button", { name: "Apply" })).toBeNull();
});
