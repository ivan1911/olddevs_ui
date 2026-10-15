// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import type { ChainedCommands } from "@tiptap/core";
import type { Editor } from "@tiptap/react";
import { createRef } from "react";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import { Dialog } from "../src/components/overlays/Dialog.js";
import { UiProvider } from "../src/i18n/UiProvider.js";
import { messages as ru } from "../src/locales/ru.js";
import { DividerIcon } from "../src/icons.js";
import { BUILTIN_TOOLS } from "../src/editor/features/builtins.js";
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
 * Меню вставки: по `/` в тексте и по кнопке «+» на Панели (OLDSUI-43).
 *
 * Набор идёт командами движка, как в остальных тестах Редактора: jsdom не
 * умеет ввода в `contenteditable`. Клавиши, которые меню слушает, — настоящие
 * события `keydown` на поле: так их видит и ProseMirror, и стек слоёв Radix.
 */
function renderEditor(props: Partial<RichTextEditorProps> = {}) {
  const ref = createRef<RichTextEditorHandle>();
  const view = render(<RichTextEditor ref={ref} aria-label="Body" {...props} />);
  const editor = ref.current?.editor;
  if (!editor) throw new Error("the editor was not created inside render()");
  return { ...view, ref, editor };
}

/**
 * Фокус в поле. Не `commands.focus()`: Tiptap ставит фокус следующим кадром,
 * и в синхронном тесте его ещё нет.
 */
function focusField() {
  act(() => screen.getByRole("textbox", { name: "Body" }).focus());
}

/** Набрать текст в позицию курсора — транзакцией, как это сделал бы ввод. */
function type(editor: Editor, text: string) {
  act(() => void editor.commands.insertContent(text));
}

test("a slash at the start of an empty paragraph opens the insert menu", () => {
  const { editor } = renderEditor();
  focusField();

  type(editor, "/");

  expect(screen.getByRole("listbox", { name: "Insert block" })).toBeDefined();
});

/*
  Поле — часть комбобокса: фокус, пришедший в него при открытом списке
  (каретка, поставленная программно уже после `/`, возврат в окно браузера),
  не «уход наружу». Radix снимал на нём слой, а с ним — сессию `/`.
*/
test("focus coming back into the field keeps the slash list open", async () => {
  const { editor } = renderEditor();
  focusField();
  type(editor, "/");
  expect(screen.getByRole("listbox", { name: "Insert block" })).toBeDefined();

  act(() => (document.activeElement as HTMLElement).blur());
  focusField();
  // Radix подписывается на фокус снаружи с задержкой — даём ему кадр.
  await act(() => new Promise((resolve) => setTimeout(resolve, 20)));

  expect(screen.getByRole("listbox", { name: "Insert block" })).toBeDefined();
});

test("a slash after a space opens the menu, a slash inside a word does not", () => {
  const { editor } = renderEditor({ defaultValue: "<p>and</p>" });
  focusField();
  act(() => void editor.commands.setTextSelection(editor.state.doc.content.size - 1));

  type(editor, "/or");
  expect(screen.queryByRole("listbox")).toBeNull();

  type(editor, " /");
  expect(screen.getByRole("listbox", { name: "Insert block" })).toBeDefined();
});

/** Клавиша на поле — настоящим `keydown`, как его получат и движок, и Radix. */
function press(editor: Editor, key: string) {
  act(() => {
    editor.view.dom.dispatchEvent(
      new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true })
    );
  });
}

/** Имя текущей строки списка — та, на которую указывает поле. */
function activeOption(editor: Editor) {
  const id = editor.view.dom.getAttribute("aria-activedescendant");
  return id ? document.getElementById(id) : null;
}

test("focus stays in the field; arrows move the active option through aria-activedescendant", () => {
  const { editor } = renderEditor();
  focusField();
  type(editor, "/");

  const field = screen.getByRole("textbox", { name: "Body" });
  const listbox = screen.getByRole("listbox", { name: "Insert block" });
  expect(document.activeElement).toBe(field);
  expect(field.getAttribute("aria-controls")).toBe(listbox.id);

  // Первый раздел — «Insert», его первая строка — текущая.
  const options = screen.getAllByRole("option");
  expect(activeOption(editor)).toBe(options[0]);
  expect(options[0]?.getAttribute("aria-selected")).toBe("true");

  press(editor, "ArrowDown");
  expect(activeOption(editor)).toBe(options[1]);
  expect(options[0]?.getAttribute("aria-selected")).toBe("false");

  // Стрелка вверх с первой строки уходит на последнюю.
  press(editor, "ArrowUp");
  press(editor, "ArrowUp");
  expect(activeOption(editor)).toBe(options.at(-1));
  expect(document.activeElement).toBe(field);
});

test("the menu lists both sections with icons, labels and hints", () => {
  const { editor } = renderEditor();
  focusField();
  type(editor, "/");

  const insert = screen.getByRole("group", { name: "Insert" });
  const turnInto = screen.getByRole("group", { name: "Turn into" });
  const names = (group: HTMLElement) =>
    Array.from(group.querySelectorAll('[role="option"]')).map((option) =>
      option.textContent?.trim()
    );

  expect(names(insert)).toEqual([
    "Code block```",
    "Divider---",
    "Table",
    "Image",
    "Layout",
    "Wrapper",
  ]);
  expect(names(turnInto)).toEqual([
    "ParagraphCtrl+Alt+0",
    "Heading 1#",
    "Heading 2##",
    "Heading 3###",
    "Heading 4####",
    "Bulleted list-",
    "Numbered list1.",
    "Checklist[ ]",
    "Quote>",
    "Code blockCtrl+Alt+C",
  ]);
  // Подсказка — для глаз: имя строки — только подпись.
  expect(screen.getByRole("option", { name: "Heading 2" })).toBeDefined();
});

test("typing after the slash filters by label and by alias", () => {
  const { editor } = renderEditor();
  focusField();

  type(editor, "/head");
  expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
    "Heading 1#",
    "Heading 2##",
    "Heading 3###",
    "Heading 4####",
  ]);

  act(() => void editor.commands.clearContent());
  type(editor, "/hr");
  expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual(["Divider---"]);
});

test("nothing matching leaves a 'Nothing found' row and no active option", () => {
  const { editor } = renderEditor();
  focusField();

  type(editor, "/zzz");

  const only = screen.getByRole("option");
  expect(only.textContent).toBe("Nothing found");
  expect(only.getAttribute("aria-disabled")).toBe("true");
  expect(editor.view.dom.hasAttribute("aria-activedescendant")).toBe(false);
});

test("filtering follows the provider's language and still knows the English labels", () => {
  const ref = createRef<RichTextEditorHandle>();
  render(
    <UiProvider messages={ru}>
      <RichTextEditor ref={ref} aria-label="Body" />
    </UiProvider>
  );
  const editor = ref.current!.editor!;
  focusField();
  // Запрос — начало русской подписи из каталога: литерал кириллицы держит
  // каталог, а не тест (гейт i18n).
  const t = ru.editor;
  type(editor, `/${t.blockquote.slice(0, 3)}`);

  expect(screen.getByRole("listbox", { name: t.insertMenu })).toBeDefined();
  expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
    `${t.blockquote}>`,
  ]);

  act(() => void editor.commands.clearContent());
  type(editor, "/quote");
  expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
    `${t.blockquote}>`,
  ]);
  expect(screen.getByRole("group", { name: t.turnIntoSection })).toBeDefined();
});

test("Enter turns the current block into the chosen one and removes the typed command", () => {
  const { editor } = renderEditor({ defaultValue: "<p>Title</p>" });
  focusField();
  act(() => void editor.commands.setTextSelection(6));
  type(editor, " /h3");
  press(editor, "Enter");

  expect(editor.getHTML()).toBe("<h3>Title </h3>");
  expect(screen.queryByRole("listbox")).toBeNull();
});

test("Enter on an Insert item adds the block after the current one", () => {
  const { editor } = renderEditor({ defaultValue: "<p>Intro</p>" });
  focusField();
  act(() => void editor.commands.setTextSelection(6));

  type(editor, " /divider");
  press(editor, "Enter");

  expect(editor.getHTML()).toBe("<p>Intro </p><hr><p></p>");
});

test("an Insert item in an empty paragraph replaces it instead of adding a block", () => {
  const { editor } = renderEditor({ defaultValue: "<p>Intro</p>" });
  focusField();
  act(() => void editor.commands.setTextSelection(6));
  act(() => void editor.commands.splitBlock());

  type(editor, "/code");
  press(editor, "Enter");

  expect(editor.getHTML()).toBe("<p>Intro</p><pre><code></code></pre>");
  // Курсор — внутри нового блока кода: набор продолжается в нём.
  expect(editor.state.selection.$from.parent.type.name).toBe("codeBlock");
});

test("turning a list item into a heading takes it out of the list", () => {
  const { editor } = renderEditor({ defaultValue: "<ul><li><p>Point</p></li></ul>" });
  focusField();
  act(() => void editor.commands.setTextSelection(3));

  type(editor, "/h2");
  press(editor, "Enter");

  expect(editor.getHTML()).toBe("<h2>Point</h2>");
});

test("Escape closes the menu and keeps the typed text; the same command does not reopen", () => {
  const { editor } = renderEditor();
  focusField();

  type(editor, "/hea");
  press(editor, "Escape");

  expect(screen.queryByRole("listbox")).toBeNull();
  expect(editor.getHTML()).toBe("<p>/hea</p>");
  expect(editor.view.dom.hasAttribute("aria-controls")).toBe(false);

  type(editor, "d");
  expect(screen.queryByRole("listbox")).toBeNull();
});

test("a space ends the command: the menu closes and the text stays", () => {
  const { editor } = renderEditor();
  focusField();

  type(editor, "/h3 ");

  expect(screen.queryByRole("listbox")).toBeNull();
  expect(editor.getHTML()).toBe("<p>/h3 </p>");
});

test("a slash inside a code block is just a slash", () => {
  const { editor } = renderEditor({ defaultValue: "<pre><code>cd</code></pre>" });
  focusField();
  act(() => void editor.commands.setTextSelection(3));

  type(editor, " /");

  expect(screen.queryByRole("listbox")).toBeNull();
});

/*
  Заголовок 1 — надстройка над `heading` (OLDSUI-62): пункт есть только вместе
  с `heading1`, как в меню «¶». Без него — только 2–4 (тест ниже).
*/
test("Heading 1 turns the block into an H1 and carries the shortcut of the table", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: "<p>Title</p>" });
  act(() => void editor.commands.setTextSelection(3));

  await user.click(screen.getByRole("button", { name: "Insert block" }));
  await user.click(screen.getByRole("menuitem", { name: /Heading 1/ }));

  expect(editor.getHTML()).toBe("<h1>Title</h1>");
  expect(BUILTIN_TOOLS.heading?.insertItems?.find((item) => item.id === "heading1")?.keys).toEqual([
    "mod",
    "alt",
    "1",
  ]);
});

test("a disabled tool has no item, and without insertMenu the slash is just a slash", () => {
  const { editor } = renderEditor({ tools: ["insertMenu", "heading", "bulletList"] });
  focusField();
  type(editor, "/");

  expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
    "ParagraphCtrl+Alt+0",
    "Heading 2##",
    "Heading 3###",
    "Heading 4####",
    "Bulleted list-",
  ]);
  // Раздела без пунктов нет вовсе.
  expect(screen.queryByRole("group", { name: "Insert" })).toBeNull();
  cleanup();

  const basic = renderEditor({ preset: "basic" });
  focusField();
  type(basic.editor, "/");
  expect(screen.queryByRole("listbox")).toBeNull();
  expect(basic.editor.view.dom.hasAttribute("aria-autocomplete")).toBe(false);
});

/**
 * Escape при открытом меню принадлежит меню, а не окну вокруг поля (ADR-0041).
 *
 * Здесь настоящий `Dialog`, а не подложка, как в тесте списка стилей: список
 * Меню вставки — слой Radix, той же библиотеки, что окно, и в jsdom их стек
 * работает так же, как в браузере.
 */
test("Escape inside a Dialog closes only the menu", () => {
  const onClose = vi.fn();
  const ref = createRef<RichTextEditorHandle>();
  render(
    <Dialog open onClose={onClose} title="Edit">
      <RichTextEditor ref={ref} aria-label="Body" />
    </Dialog>
  );
  const editor = ref.current!.editor!;
  focusField();
  type(editor, "/");
  expect(screen.getByRole("listbox")).toBeDefined();

  press(editor, "Escape");
  expect(screen.queryByRole("listbox")).toBeNull();
  expect(onClose).not.toHaveBeenCalled();
  expect(editor.getHTML()).toBe("<p>/</p>");

  // Контроль: без меню тот же Escape закрывает окно.
  press(editor, "Escape");
  expect(onClose).toHaveBeenCalledTimes(1);
});

test("a descriptor added to the registry shows up without touching the menu", () => {
  const ran = vi.fn((chain: ChainedCommands) => chain.insertContent("<p>made</p>"));
  const original = BUILTIN_TOOLS.bold;
  BUILTIN_TOOLS.bold = {
    ...original!,
    insertItems: [
      {
        id: "testOnly",
        section: "insert",
        label: () => "Test block",
        icon: DividerIcon,
        aliases: ["zebra"],
        run: ran,
      },
    ],
  };
  try {
    const { editor } = renderEditor({ tools: ["insertMenu", "bold"] });
    focusField();
    type(editor, "/zebra");

    expect(screen.getByRole("option", { name: "Test block" })).toBeDefined();
    press(editor, "Enter");
    expect(ran).toHaveBeenCalledTimes(1);
    expect(editor.getHTML()).toBe("<p>made</p>");
  } finally {
    BUILTIN_TOOLS.bold = original;
  }
});

test("the plus button opens the same items as a menu and applies them to the selection", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: "<p>Intro</p>" });
  act(() => void editor.commands.setTextSelection(3));

  const plus = screen.getByRole("button", { name: "Insert block" });
  expect(plus.getAttribute("aria-haspopup")).toBe("true");
  // «+» — первая кнопка Панели.
  const toolbar = screen.getByRole("toolbar", { name: "Formatting" });
  expect(toolbar.querySelector("button")).toBe(plus);

  await user.click(plus);
  const menu = screen.getByRole("menu", { name: "Insert block" });
  expect(menu).toBeDefined();
  expect(screen.getByRole("group", { name: "Insert" })).toBeDefined();
  expect(screen.getByRole("group", { name: "Turn into" })).toBeDefined();

  await user.click(screen.getByRole("menuitem", { name: /Quote/ }));
  expect(editor.getHTML()).toBe("<blockquote><p>Intro</p></blockquote>");
  // Набор продолжается в документе, а не на кнопке «+».
  await waitFor(() =>
    expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Body" }))
  );

  await user.click(plus);
  await user.click(screen.getByRole("menuitem", { name: /Divider/ }));
  expect(editor.getHTML()).toBe("<blockquote><p>Intro</p></blockquote><hr><p></p>");
});

test("the basic preset has no plus button", () => {
  renderEditor({ preset: "basic" });

  expect(screen.queryByRole("button", { name: "Insert block" })).toBeNull();
});

test("«+» with a gap cursor between two tables inserts there instead of throwing", async () => {
  const { GapCursor } = await import("@tiptap/pm/gapcursor");
  const user = userEvent.setup();
  const table =
    "<table><tbody><tr><th><p>h</p></th></tr><tr><td><p>c</p></td></tr></tbody></table>";
  const { editor } = renderEditor({ defaultValue: table + table });
  const between = editor.state.doc.child(0).nodeSize;
  act(() =>
    editor.view.dispatch(
      editor.state.tr.setSelection(new GapCursor(editor.state.doc.resolve(between)))
    )
  );

  await user.click(screen.getByRole("button", { name: "Insert block" }));
  await user.click(screen.getByRole("menuitem", { name: /Divider/ }));
  // Линия встаёт в щель, между двумя таблицами.
  expect(editor.getHTML()).toMatch(/<\/table><hr>(<p><\/p>)?<table>/);
});
