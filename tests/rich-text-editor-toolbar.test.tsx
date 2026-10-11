// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { createRef } from "react";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
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
 * Панель Редактора: фиксированная, над полем (OLDSUI-41).
 *
 * Проверяется снаружи — ролями и именами, как её видит скринридер, — и
 * результатом в HTML. Движок доступен через `ref.editor` только там, где jsdom
 * не умеет ввода: выделение и набор идут командами, как в остальных тестах
 * Редактора.
 */
function renderEditor(props: Partial<RichTextEditorProps> = {}) {
  const ref = createRef<RichTextEditorHandle>();
  const view = render(
    <>
      <button type="button">Before</button>
      <RichTextEditor ref={ref} aria-label="Body" {...props} />
    </>
  );
  const editor = ref.current?.editor;
  if (!editor) throw new Error("the editor was not created inside render()");
  return { ...view, ref, editor };
}

test("the toolbar is one Tab stop between the outside and the document", async () => {
  const user = userEvent.setup();
  renderEditor();

  const toolbar = screen.getByRole("toolbar", { name: "Formatting" });
  screen.getByRole("button", { name: "Before" }).focus();

  await user.tab();
  expect(toolbar.contains(document.activeElement)).toBe(true);
  await user.tab();
  expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Body" }));
});

test("arrows, Home and End move between the toolbar actions", async () => {
  const user = userEvent.setup();
  renderEditor({ preset: "basic" });
  screen.getByRole("button", { name: "Before" }).focus();
  await user.tab();

  // Первая остановка — первая кнопка Панели: в `basic` это «Жирный» — «¶» из
  // одного «Текста» не рисуется (OLDSUI-154).
  const first = screen.getByRole("button", { name: "Bold" });
  expect(document.activeElement).toBe(first);
  await user.keyboard("{ArrowRight}");
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Italic" }));
  await user.keyboard("{End}");
  // Последняя остановка — справочник сочетаний у правого края (OLDSUI-67).
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Keyboard shortcuts" }));
  await user.keyboard("{Home}");
  expect(document.activeElement).toBe(first);
});

test("toggle buttons report the marks and blocks under the caret with aria-pressed", () => {
  const { editor } = renderEditor({
    defaultValue: "<p><strong>bold</strong> plain</p><ul><li><p>listed</p></li></ul>",
  });
  const bold = screen.getByRole("button", { name: "Bold" });
  const italic = screen.getByRole("button", { name: "Italic" });

  act(() => void editor.commands.setTextSelection(3));
  expect(bold.getAttribute("aria-pressed")).toBe("true");
  expect(italic.getAttribute("aria-pressed")).toBe("false");

  // Список под кареткой объявляет не кнопка, а имя меню «Списки» (OLDSUI-66).
  act(() => void editor.commands.setTextSelection(editor.state.doc.content.size - 4));
  expect(bold.getAttribute("aria-pressed")).toBe("false");
  expect(screen.getByRole("button", { name: "List: bulleted" })).toBeDefined();
});

test("one-shot actions are plain buttons, not toggles", () => {
  renderEditor();

  for (const name of ["Undo", "Redo"]) {
    expect(screen.getByRole("button", { name }).hasAttribute("aria-pressed"), name).toBe(false);
  }
});

test("a button applies its formatting to the selection", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: "<p>Hello world</p>" });
  act(() => void editor.commands.setTextSelection({ from: 1, to: 6 }));

  await user.click(screen.getByRole("button", { name: "Italic" }));
  expect(editor.getHTML()).toBe("<p><em>Hello</em> world</p>");

  await user.click(screen.getByRole("button", { name: "Undo" }));
  expect(editor.getHTML()).toBe("<p>Hello world</p>");
});

test("the tooltip names the action together with its shortcut", async () => {
  const user = userEvent.setup();
  renderEditor();
  const bold = screen.getByRole("button", { name: "Bold" });

  // jsdom — не Apple: `mod` подписан как Ctrl.
  expect(bold.getAttribute("aria-keyshortcuts")).toBe("Control+B");
  await user.hover(bold);
  expect((await screen.findByRole("tooltip")).textContent).toBe("BoldCtrl+B");
});

/**
 * Имена кнопок Панели по порядку — то, что услышит скринридер, — и `|` на
 * месте разделителя групп. Справочник сочетаний у правого края не считается:
 * он не зависит от `tools`, и его место и состав проверяет
 * `rich-text-editor-shortcuts.test.tsx`.
 */
function toolbarLayout() {
  const toolbar = screen.getByRole("toolbar", { name: "Formatting" });
  return (
    Array.from(toolbar.querySelectorAll('button, [role="separator"]'))
      .map((node) =>
        node.getAttribute("role") === "separator"
          ? "|"
          : (node.getAttribute("aria-label") ?? node.textContent)
      )
      // Правый край — «Поиск» (OLDSUI-151) и справочник: они не группа кита, у них свои тесты.
      .filter((name) => name !== "Keyboard shortcuts" && name !== "Find")
  );
}

/** Только кнопки, без разделителей. */
const toolbarButtons = () => toolbarLayout().filter((name) => name !== "|");

/*
  Раскладка компактной Панели (OLDSUI-66) — порядок кита: «+» · HTML (OLDSUI-76) ·
  «¶» · выравнивание ▾ | жирный · курсив · маркер · «…» | списки ▾ |
  ссылка · картинка · таблица ▾ · эмодзи | отмена · повтор. Отдельных кнопок
  выравнивания, списков, разделителя и Блока кода нет: первые два — меню,
  разделитель — в Меню вставки, Блок кода — пункт «…» (OLDSUI-76).
*/
test("the full preset lays the toolbar out in the kit's order, groups split by separators", () => {
  renderEditor();

  expect(toolbarLayout()).toEqual([
    "Insert block",
    "HTML",
    "Block type: Text",
    "Alignment: left",
    "|",
    "Bold",
    "Italic",
    // «Цвет» — в меню выделения, на Панели только «Маркер» (OLDSUI-154).
    "Highlight: None",
    "More formatting",
    "|",
    "Lists",
    "|",
    "Link",
    "Image",
    "Table",
    "Emoji",
    "|",
    "Undo",
    "Redo",
  ]);
  for (const name of [
    "Align left",
    "Bulleted list",
    "Numbered list",
    "Checklist",
    "Divider",
    "Code block",
  ]) {
    expect(screen.queryByRole("button", { name }), name).toBeNull();
  }
});

test("the basic preset keeps only its tools' buttons and menus, without empty groups", () => {
  renderEditor({ preset: "basic" });

  // Цитата, строчный код и зачёркнутый — пункты «…»; «¶» из одного «Текста» не
  // рисуется (OLDSUI-154); маркера и меню выравнивания в basic нет.
  expect(toolbarLayout()).toEqual([
    "Bold",
    "Italic",
    "More formatting",
    "|",
    "Lists",
    "|",
    "Link",
    "|",
    "Undo",
    "Redo",
  ]);
});

test("the shortcuts reference is the last button of the fixed toolbar", () => {
  renderEditor();

  const toolbar = screen.getByRole("toolbar", { name: "Formatting" });
  expect(Array.from(toolbar.querySelectorAll("button")).at(-1)?.getAttribute("aria-label")).toBe(
    "Keyboard shortcuts"
  );
});

test("tools is an exact list and wins over the preset, in the kit's order", () => {
  renderEditor({ preset: "basic", tools: ["taskList", "bold", "underline", "align"] });

  // Чек-лист — в «Списки ▾», а не в «¶»: без заголовков «¶» нет (OLDSUI-154).
  expect(toolbarButtons()).toEqual(["Alignment: left", "Bold", "More formatting", "Lists"]);
});

/*
  Имя из JS без типов или из более новой версии кита: Редактор его не знает и
  молча отбрасывает (решение владельца, OLDSUI-98), а не падает и не теряет
  остальной набор.
*/
test("an unknown name in tools is dropped silently, the rest of the set works", () => {
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  const { editor } = renderEditor({
    tools: ["bold", "acme_unknown", "italic"] as unknown as RichTextEditorProps["tools"],
    defaultValue: "<p><strong>b</strong> <em>i</em> <u>u</u></p>",
  });

  expect(toolbarButtons()).toEqual(["Bold", "Italic"]);
  expect(editor.getHTML()).toBe("<p><strong>b</strong> <em>i</em> u</p>");
  expect(error).not.toHaveBeenCalled();
  error.mockRestore();
});

const EVERYTHING =
  "<h2>Title</h2><p><strong>b</strong> <em>i</em> <u>u</u> <s>s</s> <code>c</code> " +
  "<sup>sup</sup> <sub>sub</sub></p><ul><li><p>bullet</p></li></ul>" +
  '<ul data-type="taskList"><li data-type="taskItem" data-checked="true"><p>task</p></li></ul>' +
  '<blockquote><p>quote</p></blockquote><pre><code class="language-js">code()</code></pre><hr>';

test("a disabled tool drops its markup from loaded and pasted content", () => {
  const { editor } = renderEditor({ preset: "basic", defaultValue: EVERYTHING });
  const loaded = editor.getHTML();
  act(() => void editor.commands.clearContent());
  act(() => void editor.view.pasteHTML(EVERYTHING, new Event("paste") as ClipboardEvent));
  const pasted = editor.getHTML();

  for (const html of [loaded, pasted]) {
    expect(html).toMatch(/<strong>b<\/strong>/);
    expect(html).toMatch(/<ul><li><p>bullet/);
    expect(html).toMatch(/<blockquote>/);
    // Отключённое в `basic` — заголовок, подчёркивание, индексы, чек-лист,
    // блок кода и разделитель — пропадает, а текст из них остаётся.
    expect(html).not.toMatch(/<h2|<u>|<sup>|<sub>|taskList|<pre|<hr/);
    expect(html).toContain("Title");
    expect(html).toContain("code()");
  }
});

test("a disabled tool's shortcut does nothing", () => {
  const pressCtrlU = (editor: RichTextEditorHandle["editor"]) =>
    act(() => {
      editor!.view.dom.dispatchEvent(
        new KeyboardEvent("keydown", { key: "u", ctrlKey: true, bubbles: true, cancelable: true })
      );
    });

  const withUnderline = renderEditor({ tools: ["underline"], defaultValue: "<p>word</p>" });
  act(() => void withUnderline.editor.commands.setTextSelection({ from: 1, to: 5 }));
  pressCtrlU(withUnderline.editor);
  // Контроль: сочетание вообще доходит до движка в jsdom.
  expect(withUnderline.editor.getHTML()).toBe("<p><u>word</u></p>");
  cleanup();

  const without = renderEditor({ tools: ["bold"], defaultValue: "<p>word</p>" });
  act(() => void without.editor.commands.setTextSelection({ from: 1, to: 5 }));
  pressCtrlU(without.editor);
  expect(without.editor.getHTML()).toBe("<p>word</p>");
});

test("toolbar none keeps the schema of the preset but shows no toolbar", () => {
  const { editor } = renderEditor({ toolbar: "none", defaultValue: "<p><u>u</u></p>" });

  expect(screen.queryByRole("toolbar")).toBeNull();
  expect(editor.getHTML()).toBe("<p><u>u</u></p>");
});

test("read-only mode has no toolbar", () => {
  renderEditor({ readOnly: true });

  expect(screen.queryByRole("toolbar")).toBeNull();
});

test("a disabled field shows the toolbar with every action switched off", () => {
  renderEditor({ disabled: true, preset: "basic" });

  const toolbar = screen.getByRole("toolbar", { name: "Formatting" });
  for (const button of toolbar.querySelectorAll("button")) {
    expect(button.disabled, button.getAttribute("aria-label") ?? "").toBe(true);
  }
});

test("the toolbar speaks the provider's language", () => {
  render(
    <UiProvider messages={ru}>
      <RichTextEditor aria-label="Body" defaultValue="<h2>Title</h2>" />
    </UiProvider>
  );

  // Ожидания — из русского каталога, а не литералами: гейт i18n держит
  // кириллицу в каталоге, и проверяется здесь именно то, что Панель берёт
  // строки у провайдера, а не у фолбэка.
  const t = ru.editor;
  expect(screen.getByRole("toolbar", { name: t.toolbar })).toBeDefined();
  expect(screen.getByRole("button", { name: t.bold })).toBeDefined();
  expect(
    screen.getByRole("button", { name: t.blockType({ current: t.heading({ level: 2 }) }) })
  ).toBeDefined();
  expect(screen.queryByRole("button", { name: "Bold" })).toBeNull();
});

test("the checklist checkbox is named from the catalog", () => {
  render(
    <UiProvider messages={ru}>
      <RichTextEditor
        aria-label="Body"
        defaultValue='<ul data-type="taskList"><li data-type="taskItem" data-checked="true"><p>Buy milk</p></li></ul>'
      />
    </UiProvider>
  );

  const checkbox = screen.getByRole("checkbox", {
    name: ru.editor.taskCheckbox({ text: "Buy milk" }),
  });
  expect(ru.editor.taskCheckbox({ text: "Buy milk" })).not.toMatch(/^Done/);
  expect((checkbox as HTMLInputElement).checked).toBe(true);
});
