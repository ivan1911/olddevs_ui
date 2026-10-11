// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import type { Editor } from "@tiptap/react";
import { createRef } from "react";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import { FormField } from "../src/components/inputs/FormField.js";
import { Form } from "../src/components/inputs/Form.js";
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

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

/**
 * Редактор с доступом к движку через `ref.editor`.
 *
 * Набор в jsdom идёт командами движка, а не событиями клавиатуры: ProseMirror
 * читает ввод из мутаций DOM и `beforeinput`, которых jsdom не воспроизводит.
 * Для значения и схемы это та же транзакция, что и от живой клавиатуры.
 */
function renderEditor(props: Partial<RichTextEditorProps> = {}) {
  const ref = createRef<RichTextEditorHandle>();
  const view = render(<RichTextEditor ref={ref} aria-label="Body" {...props} />);
  const editor = ref.current?.editor;
  if (!editor) throw new Error("the editor was not created inside render()");
  return { ...view, ref, editor };
}

/** Набор в конец документа — так, как дописывает автор. */
function typeAtEnd(editor: Editor, text: string) {
  act(() => {
    editor
      .chain()
      .setTextSelection(editor.state.doc.content.size - 1)
      .insertContent(text)
      .run();
  });
}

test("defaultValue becomes the document the author sees", () => {
  renderEditor({ defaultValue: "<h2>Title</h2><p>First paragraph</p>" });

  const field = screen.getByRole("textbox", { name: "Body" });
  expect(field.querySelector("h2")?.textContent).toBe("Title");
  expect(field.querySelector("p")?.textContent).toBe("First paragraph");
});

test("onChange is throttled: one call with the latest HTML after changeDelay", () => {
  const onChange = vi.fn();
  const { editor } = renderEditor({ onChange });
  vi.useFakeTimers();

  act(() => void editor.commands.insertContent("a"));
  act(() => void editor.commands.insertContent("b"));
  expect(onChange).not.toHaveBeenCalled();

  act(() => void vi.advanceTimersByTime(299));
  expect(onChange).not.toHaveBeenCalled();
  act(() => void vi.advanceTimersByTime(1));
  expect(onChange).toHaveBeenCalledTimes(1);
  expect(onChange).toHaveBeenLastCalledWith("<p>ab</p>");
});

test("blur hands the pending change over at once instead of waiting for the delay", () => {
  const onChange = vi.fn();
  const { editor } = renderEditor({ onChange });
  vi.useFakeTimers();

  act(() => void editor.commands.insertContent("draft"));
  act(() => void editor.view.dom.dispatchEvent(new FocusEvent("blur")));

  expect(onChange).toHaveBeenCalledTimes(1);
  expect(onChange).toHaveBeenLastCalledWith("<p>draft</p>");
  // Ожидание снято, а не отложено: таймер не отдаёт ту же правку второй раз.
  act(() => void vi.advanceTimersByTime(1000));
  expect(onChange).toHaveBeenCalledTimes(1);
});

test("name puts the current HTML into FormData, fresh at submit time", () => {
  const onChange = vi.fn();
  let submitted: FormData | null = null;
  const ref = createRef<RichTextEditorHandle>();
  render(
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submitted = new FormData(event.currentTarget);
      }}
    >
      <RichTextEditor
        ref={ref}
        aria-label="Body"
        name="body"
        defaultValue="<p>a</p>"
        onChange={onChange}
      />
      <button type="submit">Send</button>
    </form>
  );
  vi.useFakeTimers();

  typeAtEnd(ref.current!.editor!, "b");
  // Задержка не истекла — а отправка всё равно получает свежий HTML, и
  // потребитель узнаёт о правке до своего `onSubmit`.
  act(() => screen.getByRole("button", { name: "Send" }).click());

  expect(submitted!.get("body")).toBe("<p>ab</p>");
  expect(onChange).toHaveBeenLastCalledWith("<p>ab</p>");
});

test("without changes the hidden field already carries defaultValue", () => {
  const { container } = renderEditor({ name: "body", defaultValue: "<p>Hello</p>" });

  const hidden = container.querySelector<HTMLInputElement>('input[type="hidden"][name="body"]');
  expect(hidden?.value).toBe("<p>Hello</p>");
});

test("FormData read outside of submit also sees the latest HTML", () => {
  const ref = createRef<RichTextEditorHandle>();
  const { container } = render(
    <form>
      <RichTextEditor ref={ref} aria-label="Body" name="body" />
    </form>
  );
  vi.useFakeTimers();

  typeAtEnd(ref.current!.editor!, "now");

  // Автосохранение по таймеру потребителя собирает форму без `submit` — и тоже
  // не должно отставать от набора на `changeDelay`. Браузер на `new FormData`
  // шлёт форме событие `formdata`; jsdom его не шлёт (TODO в его исходнике),
  // поэтому событие отправляется здесь так, как это делает браузер.
  const form = container.querySelector("form")!;
  const data = new FormData(form);
  const event = Object.assign(new Event("formdata"), { formData: data });
  act(() => void form.dispatchEvent(event));
  expect(data.get("body")).toBe("<p>now</p>");
});

test("a new value from outside replaces the document", () => {
  const { editor, rerender, ref } = renderEditor({ value: "<p>One</p>" });
  expect(editor.getHTML()).toBe("<p>One</p>");

  rerender(<RichTextEditor ref={ref} aria-label="Body" value="<h3>Two</h3>" />);

  expect(editor.getHTML()).toBe("<h3>Two</h3>");
});

test("the value echoed back by the owner keeps the document and the caret", () => {
  let latest = "<p>Hello</p>";
  const onChange = vi.fn((html: string) => (latest = html));
  const { editor, rerender, ref } = renderEditor({ value: latest, onChange, changeDelay: 0 });

  typeAtEnd(editor, " world");
  expect(latest).toBe("<p>Hello world</p>");
  const doc = editor.state.doc;
  const caret = editor.state.selection.from;

  // Владелец кладёт отданный HTML обратно в `value` — обычный цикл
  // управляемого поля. Пересоздание документа здесь сбросило бы курсор в начало
  // на каждой букве.
  rerender(
    <RichTextEditor
      ref={ref}
      aria-label="Body"
      value={latest}
      onChange={onChange}
      changeDelay={0}
    />
  );

  expect(editor.state.doc).toBe(doc);
  expect(editor.state.selection.from).toBe(caret);
});

test("replacing the value from outside is not reported back as an edit", () => {
  const onChange = vi.fn();
  const { rerender, ref } = renderEditor({ value: "<p>One</p>", onChange, changeDelay: 0 });

  rerender(
    <RichTextEditor
      ref={ref}
      aria-label="Body"
      value="<p>Two</p>"
      onChange={onChange}
      changeDelay={0}
    />
  );

  expect(onChange).not.toHaveBeenCalled();
});

test("the remaining-characters counter appears at 80% of maxLength", () => {
  const { editor } = renderEditor({ maxLength: 10, defaultValue: "<p>1234567</p>" });
  expect(screen.queryByText(/characters? left/)).toBeNull();

  typeAtEnd(editor, "8");

  expect(screen.getByText("2 characters left")).toBeTruthy();
});

test("the counter is part of the field description while it is shown", () => {
  const { editor } = renderEditor({ maxLength: 10, defaultValue: "<p>123456789</p>" });

  const counter = screen.getByText("1 character left");
  const describedBy = editor.view.dom.getAttribute("aria-describedby") ?? "";
  expect(describedBy.split(" ")).toContain(counter.id);
});

test("input over maxLength is blocked", () => {
  const { editor } = renderEditor({ maxLength: 5, defaultValue: "<p>1234</p>" });

  typeAtEnd(editor, "5");
  typeAtEnd(editor, "6");

  expect(editor.getText()).toBe("12345");
  expect(screen.getByText("0 characters left")).toBeTruthy();
});

test("a paste over maxLength keeps only what fits", () => {
  const { editor } = renderEditor({ maxLength: 5, defaultValue: "<p>123</p>" });
  act(() => void editor.commands.setTextSelection(editor.state.doc.content.size - 1));

  act(() => void editor.view.pasteHTML("<p>456789</p>", new Event("paste") as ClipboardEvent));

  // Вставка в почти полное поле отдаёт всё, что поместилось, а не ничего.
  expect(editor.getText()).toBe("12345");
});

test("a value longer than maxLength is loaded intact, not trimmed", () => {
  const { editor } = renderEditor({ maxLength: 3, value: "<p>123456</p>" });

  // Это данные владельца: обрезать их молча значило бы испортить запись при
  // первом же сохранении. Автор может сокращать текст, но не удлинять.
  expect(editor.getText()).toBe("123456");
  expect(screen.getByText("3 characters over the limit")).toBeTruthy();
  typeAtEnd(editor, "7");
  expect(editor.getText()).toBe("123456");
});

test("readOnly keeps the text readable and submitted, but not editable", () => {
  const { editor, container } = renderEditor({
    readOnly: true,
    name: "body",
    defaultValue: "<p>Fixed</p>",
  });
  const field = screen.getByRole("textbox", { name: "Body" });

  expect(field.getAttribute("contenteditable")).toBe("false");
  expect(field.getAttribute("aria-readonly")).toBe("true");
  expect(editor.isEditable).toBe(false);
  // Поле только для чтения — показанное значение, а не недоступный контрол:
  // в форму оно уходит, как у нативного `readonly`.
  expect(container.querySelector<HTMLInputElement>('input[name="body"]')?.disabled).toBe(false);
});

test("disabled is not editable and leaves the form, like a native field", () => {
  const { editor, container } = renderEditor({
    disabled: true,
    name: "body",
    defaultValue: "<p>Off</p>",
  });
  const field = screen.getByRole("textbox", { name: "Body" });

  expect(field.getAttribute("contenteditable")).toBe("false");
  expect(field.getAttribute("aria-disabled")).toBe("true");
  expect(editor.isEditable).toBe(false);
  expect(container.querySelector<HTMLInputElement>('input[name="body"]')?.disabled).toBe(true);
});

test("inside a disabled fieldset the editor is disabled like a native field", async () => {
  const ref = createRef<RichTextEditorHandle>();
  const { container } = render(
    <fieldset disabled>
      <RichTextEditor ref={ref} aria-label="Body" name="body" defaultValue="<p>Off</p>" />
    </fieldset>
  );
  const field = screen.getByRole("textbox", { name: "Body" });

  await waitFor(() => expect(ref.current!.editor!.isEditable).toBe(false));
  expect(field.getAttribute("contenteditable")).toBe("false");
  expect(field.getAttribute("aria-disabled")).toBe("true");
  expect(container.querySelector<HTMLInputElement>('input[name="body"]')?.disabled).toBe(true);
});

test("the editor follows the fieldset when it is disabled and enabled at runtime", async () => {
  const ref = createRef<RichTextEditorHandle>();
  const { container } = render(
    <fieldset>
      <RichTextEditor ref={ref} aria-label="Body" name="body" />
    </fieldset>
  );
  const fieldset = container.querySelector("fieldset")!;
  const hidden = () => container.querySelector<HTMLInputElement>('input[name="body"]')!;
  expect(ref.current!.editor!.isEditable).toBe(true);

  act(() => void (fieldset.disabled = true));
  await waitFor(() => expect(ref.current!.editor!.isEditable).toBe(false));
  expect(hidden().disabled).toBe(true);

  act(() => void (fieldset.disabled = false));
  await waitFor(() => expect(ref.current!.editor!.isEditable).toBe(true));
  expect(hidden().disabled).toBe(false);
  expect(screen.getByRole("textbox", { name: "Body" }).getAttribute("aria-disabled")).toBeNull();
});

test("the kit Form disables the editor while it is pending", async () => {
  const ref = createRef<RichTextEditorHandle>();
  const tree = (pending: boolean) => (
    <Form pending={pending} onSubmit={() => {}}>
      <RichTextEditor ref={ref} aria-label="Body" />
    </Form>
  );
  const { rerender } = render(tree(false));
  expect(ref.current!.editor!.isEditable).toBe(true);

  rerender(tree(true));
  await waitFor(() => expect(ref.current!.editor!.isEditable).toBe(false));

  rerender(tree(false));
  await waitFor(() => expect(ref.current!.editor!.isEditable).toBe(true));
});

test("a required editor inside a disabled fieldset does not block the submit", async () => {
  const submitted: FormData[] = [];
  const { container } = render(
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submitted.push(new FormData(event.currentTarget));
      }}
    >
      <fieldset disabled>
        <RichTextEditor aria-label="Body" name="body" required />
      </fieldset>
    </form>
  );
  const form = container.querySelector("form")!;

  act(() => form.requestSubmit());

  expect(submitted).toHaveLength(1);
  expect(submitted[0]?.has("body")).toBe(false);
});

test("switching readOnly off makes the editor editable again", () => {
  const { editor, rerender, ref } = renderEditor({ readOnly: true });

  rerender(<RichTextEditor ref={ref} aria-label="Body" readOnly={false} />);

  expect(editor.isEditable).toBe(true);
  expect(screen.getByRole("textbox", { name: "Body" }).getAttribute("aria-readonly")).toBeNull();
});

test("inside FormField the hint and the error describe the field, the error marks it invalid", () => {
  const { rerender } = render(
    <FormField label="Body" hint="Markdown shortcuts work">
      <RichTextEditor aria-label="Body" aria-describedby="own" />
    </FormField>
  );
  const field = screen.getByRole("textbox", { name: "Body" });
  const hint = screen.getByText("Markdown shortcuts work");
  // Своё описание не вытесняется контекстным — атрибут хранит список.
  expect(field.getAttribute("aria-describedby")?.split(" ")).toEqual(["own", hint.id]);
  expect(field.getAttribute("aria-invalid")).toBeNull();

  rerender(
    <FormField label="Body" error="Too short">
      <RichTextEditor aria-label="Body" aria-describedby="own" />
    </FormField>
  );

  expect(field.getAttribute("aria-invalid")).toBe("true");
  expect(field.getAttribute("aria-describedby")).toContain(screen.getByRole("alert").id);
});

test("the FormField label names the field through htmlFor and id", () => {
  render(
    <FormField label="Description" htmlFor="description">
      <RichTextEditor id="description" />
    </FormField>
  );

  // `<label for>` у `contenteditable` браузер не связывает — это не
  // «labelable element». Имя доходит ссылкой на подпись.
  const field = screen.getByRole("textbox", { name: "Description" });
  expect(field.id).toBe("description");
});

test("the FormField label names the editor even without htmlFor and id", () => {
  render(
    <FormField label="Description">
      <RichTextEditor />
    </FormField>
  );

  // Подпись публикует свой `id` контекстом, и редактору не нужно ни искать её в
  // DOM, ни договариваться с вызывающим об одинаковых `id` и `htmlFor`.
  const field = screen.getByRole("textbox", { name: "Description" });
  const label = screen.getByText("Description");
  expect(field.getAttribute("aria-labelledby")).toBe(label.id);
  expect(label.id).not.toBe("");
});

test("a click on the FormField label moves focus into the editor", async () => {
  render(
    <FormField label="Description" htmlFor="description">
      <RichTextEditor id="description" />
    </FormField>
  );

  act(() => screen.getByText("Description").click());

  await waitFor(() =>
    expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Description" }))
  );
});

test("a click on a label that points at nothing still focuses the editor, and the label DOM stays FormField's own", async () => {
  render(
    <FormField label="Description">
      <RichTextEditor />
    </FormField>
  );
  const label = screen.getByText("Description");
  const before = label.outerHTML;

  act(() => label.click());

  await waitFor(() =>
    expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Description" }))
  );
  // Раньше поле дописывало подписи `id` и вешало её в `aria-labelledby` само;
  // теперь подпись читается, но не правится.
  expect(label.outerHTML).toBe(before);
});

test("an explicit aria-label beats the FormField label", () => {
  render(
    <FormField label="Description" htmlFor="description">
      <RichTextEditor id="description" aria-label="Product description" />
    </FormField>
  );

  expect(screen.getByRole("textbox", { name: "Product description" })).toBeTruthy();
});

test("without any name the field falls back to the catalog name", () => {
  render(<RichTextEditor />);

  expect(screen.getByRole("textbox", { name: "Rich text editor" })).toBeTruthy();
});

test("required is announced on the field", () => {
  renderEditor({ required: true });

  expect(screen.getByRole("textbox", { name: "Body" }).getAttribute("aria-required")).toBe("true");
});

/**
 * Форма с обязательным редактором. `requestSubmit()`, а не щелчок по кнопке:
 * он проходит ту же проверку ограничений, что и кнопка, и не зависит от того,
 * как jsdom реализует активацию.
 */
function renderRequiredForm(props: Partial<RichTextEditorProps> = {}) {
  const submitted: FormData[] = [];
  const ref = createRef<RichTextEditorHandle>();
  const view = render(
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submitted.push(new FormData(event.currentTarget));
      }}
    >
      <RichTextEditor ref={ref} aria-label="Body" name="body" required {...props} />
    </form>
  );
  const form = view.container.querySelector("form")!;
  return { ...view, ref, form, submitted, editor: () => ref.current!.editor! };
}

test("an empty required editor blocks the submit and takes the focus", async () => {
  const { form, submitted } = renderRequiredForm();

  act(() => form.requestSubmit());

  // Как нативное `required`: отправка не состоялась, а фокус — в редакторе,
  // чтобы автору не пришлось искать, какое поле не заполнено.
  expect(submitted).toHaveLength(0);
  await waitFor(() =>
    expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Body" }))
  );
});

test("the blocking message comes from the catalog and follows the locale", () => {
  const { form, unmount } = renderRequiredForm();
  expect(form.querySelector("input:invalid")).not.toBeNull();
  const message = (root: HTMLElement) =>
    root.querySelector<HTMLInputElement>("input:invalid")?.validationMessage;
  expect(message(form)).toBe("Fill in this field");
  unmount();

  const ruForm = render(
    <UiProvider messages={ru}>
      <form>
        <RichTextEditor aria-label="Body" name="body" required />
      </form>
    </UiProvider>
  );
  expect(message(ruForm.container)).toBe(ru.editor.required);
});

test("content lifts the block, and the HTML reaches FormData", () => {
  const { form, submitted, editor } = renderRequiredForm();
  typeAtEnd(editor(), "Hello");

  act(() => form.requestSubmit());

  // Задержка `onChange` ещё не истекла, а форма уже разрешает отправку:
  // валидность следует за документом, а не за отложенным значением.
  expect(submitted).toHaveLength(1);
  expect(submitted[0]?.get("body")).toBe("<p>Hello</p>");
});

test("clearing the document blocks the submit again", () => {
  const { form, submitted, editor, ref } = renderRequiredForm({ defaultValue: "<p>Text</p>" });
  expect(form.checkValidity()).toBe(true);

  act(() => ref.current!.clear());
  act(() => form.requestSubmit());

  expect(submitted).toHaveLength(0);
  expect(editor().isEmpty).toBe(true);
});

test("a document of one atom block without any text counts as content", () => {
  // `<hr>` — блок без текста. Будущие картинки и таблицы относятся к нему же:
  // пустым документ считается, только когда в нём нет ни текста, ни такого блока.
  const { form, submitted } = renderRequiredForm({ defaultValue: "<hr>" });

  act(() => form.requestSubmit());

  expect(submitted).toHaveLength(1);
});

test("an editor that is not required never blocks the submit", () => {
  const { form, submitted } = renderRequiredForm({ required: false });

  act(() => form.requestSubmit());

  expect(submitted).toHaveLength(1);
  expect(submitted[0]?.get("body")).toBe("");
});

test("readOnly and disabled required editors do not block, like native fields", () => {
  for (const mode of [{ readOnly: true }, { disabled: true }]) {
    const { form, submitted, unmount } = renderRequiredForm(mode);

    act(() => form.requestSubmit());

    expect(submitted).toHaveLength(1);
    unmount();
  }
});

test("the placeholder comes from the catalog unless given", () => {
  const { editor } = renderEditor();
  const empty = () => editor.view.dom.querySelector("p");

  expect(empty()?.getAttribute("data-placeholder")).toBe("Start writing…");
  expect(editor.view.dom.getAttribute("aria-placeholder")).toBe("Start writing…");

  cleanup();
  const custom = renderEditor({ placeholder: "Describe the change" });
  expect(custom.editor.view.dom.querySelector("p")?.getAttribute("data-placeholder")).toBe(
    "Describe the change"
  );
});

test("the editor speaks the locale of UiProvider", () => {
  render(
    <UiProvider locale="ru-RU" messages={ru}>
      <RichTextEditor maxLength={10} defaultValue="<p>12345678</p>" />
    </UiProvider>
  );

  expect(screen.getByRole("textbox", { name: ru.editor.label })).toBeTruthy();
  expect(screen.getByText(ru.editor.remaining({ count: 2 }))).toBeTruthy();
});

test("the handle reads the HTML now and clears the document for the owner", () => {
  const onChange = vi.fn();
  const { ref, editor } = renderEditor({ defaultValue: "<p>Keep</p>", onChange });
  vi.useFakeTimers();

  typeAtEnd(editor, " going");
  // Без ожидания задержки — и без лишнего `onChange`: чтение не правка.
  expect(ref.current!.getHTML()).toBe("<p>Keep going</p>");

  act(() => ref.current!.clear());

  expect(editor.isEmpty).toBe(true);
  expect(ref.current!.getHTML()).toBe("");
  expect(onChange).toHaveBeenCalledTimes(1);
  expect(onChange).toHaveBeenLastCalledWith("");
  act(() => void vi.advanceTimersByTime(1000));
  expect(onChange).toHaveBeenCalledTimes(1);
});

test("focus() puts the caret into the document", async () => {
  const { ref } = renderEditor({ defaultValue: "<p>Text</p>" });

  act(() => ref.current!.focus());

  // Tiptap ставит фокус в следующем кадре — ради клавиатуры iOS.
  await waitFor(() =>
    expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Body" }))
  );
});

/** Ввод текста тем путём, которым его получает ProseMirror от браузера. */
function typeText(editor: Editor, text: string) {
  act(() => {
    for (const char of text) {
      const { from, to } = editor.state.selection;
      const handled = editor.view.someProp("handleTextInput", (handler) =>
        handler(editor.view, from, to, char, () => editor.state.tr.insertText(char, from, to))
      );
      if (!handled) editor.view.dispatch(editor.state.tr.insertText(char, from, to));
    }
  });
}

test("markdown shortcuts turn into blocks and marks while typing", () => {
  const { editor } = renderEditor();

  typeText(editor, "## Title");
  expect(editor.getHTML()).toBe("<h2>Title</h2>");

  act(() => void editor.commands.setContent(""));
  typeText(editor, "> quote");
  expect(editor.getHTML()).toBe("<blockquote><p>quote</p></blockquote>");

  act(() => void editor.commands.setContent(""));
  typeText(editor, "**bold** and `code` ");
  expect(editor.getHTML()).toBe("<p><strong>bold</strong> and <code>code</code> </p>");

  act(() => void editor.commands.setContent(""));
  typeText(editor, "# Top");
  // H1 даёт инструмент `heading1` (в full он есть); без него — `heading1.test.tsx`.
  expect(editor.getHTML()).toBe("<h1>Top</h1>");
});

test("keyboard shortcuts toggle marks", () => {
  const { editor } = renderEditor({ defaultValue: "<p>word</p>" });
  act(() => void editor.commands.selectAll());

  act(() => {
    editor.view.dom.dispatchEvent(
      new KeyboardEvent("keydown", { key: "b", ctrlKey: true, bubbles: true })
    );
  });

  expect(editor.getHTML()).toBe("<p><strong>word</strong></p>");
});
