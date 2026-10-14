// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { Mark, Node } from "@tiptap/core";
import type { Editor } from "@tiptap/react";
import { createRef } from "react";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import {
  RICH_TEXT_PRESETS,
  RichTextEditor,
  type CustomTool,
  type RichTextEditorHandle,
  type RichTextEditorProps,
} from "../src/editor/index.js";
import { resetDevWarnings } from "../src/lib/dev-warn.js";
import { TOOLS } from "../src/editor/core/tools.js";
import {
  TEST_TOOLS,
  testBoxNode,
  testBoxTool,
  testCardNode,
  testCardTool,
  testMergeTagTool,
  testNoteTool,
} from "./editor-test-tools.js";
import { loadLazyBuiltins } from "./editor-lazy-builtins.js";

// Ленивые `codeBlock` и `table` (OLDSUI-111): `full` готов в `render` после загрузки чанков.
beforeAll(loadLazyBuiltins);

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  resetDevWarnings();
});

/**
 * Свой Инструмент: Блок, строчный атом и Метка в Редакторе (OLDSUI-103,
 * ADR-0058, разделы 1 и 2).
 *
 * Через публичный `RichTextEditor`: описание своего Инструмента приходит в
 * `tools` вперемешку с именами кита, результат — выходной HTML, `onChange`,
 * скрытое поле формы, Ручка Блока ролями и именами и ошибка поля. Тестовые
 * Инструменты — общий помощник `editor-test-tools.ts`. Каретка ставится
 * командами движка: jsdom не умеет ввода в `contenteditable`.
 */
function renderEditor(props: Partial<RichTextEditorProps> = {}) {
  const ref = createRef<RichTextEditorHandle>();
  const view = render(
    <RichTextEditor ref={ref} aria-label="Body" tools={[...TOOLS, ...TEST_TOOLS]} {...props} />
  );
  const editor = ref.current?.editor;
  if (!editor) throw new Error("the editor was not created inside render()");
  return { ...view, editor, handle: ref.current! };
}

/** Вставка HTML из буфера: разбор Схемой и транзакция с меткой `paste`. */
function paste(editor: Editor, html: string) {
  act(() => void editor.view.pasteHTML(html, new Event("paste") as ClipboardEvent));
}

/** Фокус в Документ и каретка в конец текста `text`. */
function caretIn(editor: Editor, text: string) {
  let found = -1;
  editor.state.doc.descendants((node, pos) => {
    if (found < 0 && node.isText && node.text === text) found = pos + node.nodeSize;
  });
  if (found < 0) throw new Error(`no text "${text}" in the document`);
  act(() => {
    editor.view.focus();
    editor.commands.setTextSelection(found);
  });
}

const tag = '<span data-block="test_mergeTag" data-test_key="first_name"></span>';
const box = (...blocks: string[]) => `<div data-block="test_box">${blocks.join("")}</div>`;
const card =
  '<div data-block="test_card" data-test_size="m" data-test_code="123" ' +
  'data-test_href="https://example.com/a">Card</div>';
const note = '<span data-mark="test_note" data-test_author="Ann">noted</span>';
const DOCUMENT = `<p>Hi ${tag} and ${note}</p>${box("<p>a</p>", "<p>b</p>")}${card}`;

// ── HTML-соглашение ────────────────────────────────────────────────────────

test("a custom block, inline atom and mark load from value and come back by the convention", () => {
  const { editor, handle } = renderEditor({ defaultValue: DOCUMENT });
  expect(handle.getHTML()).toBe(DOCUMENT);
  expect(editor.getHTML()).toBe(DOCUMENT);
});

test("foreign tags, attributes and values outside the rules are dropped", () => {
  const { handle } = renderEditor({
    defaultValue:
      '<div data-block="test_card" class="x" style="color:red" data-uid="1" ' +
      'data-test_size="xl" data-test_code="12a" data-test_href="javascript:alert(1)">Card</div>' +
      '<p><span data-block="test_mergeTag" data-test_key="Bad Key" onclick="x()"></span>' +
      '<span data-mark="test_note" data-test_author="<b>">x</span></p>',
  });
  expect(handle.getHTML()).toBe(
    '<div data-block="test_card">Card</div>' +
      '<p><span data-block="test_mergeTag"></span><span data-mark="test_note">x</span></p>'
  );
});

test("a custom block does not take a kit tag: only its own data-block reads as it", () => {
  const { handle } = renderEditor({
    defaultValue: '<div data-block="test_other"><p>x</p></div><p>y</p>',
  });
  expect(handle.getHTML()).toBe("<p>x</p><p>y</p>");
});

test("an edit of a custom block reaches onChange and the form as convention HTML", () => {
  const onChange = vi.fn();
  const { editor, container } = renderEditor({
    defaultValue: "<p>Hi</p>",
    changeDelay: 0,
    onChange,
    name: "body",
  });
  act(() => {
    editor
      .chain()
      .focus("end")
      .insertContent({ type: "test_mergeTag", attrs: { test_key: "city" } })
      .insertContent({
        type: "test_card",
        attrs: { test_size: "l" },
        content: [{ type: "text", text: "New" }],
      })
      .run();
  });
  const html =
    '<p>Hi<span data-block="test_mergeTag" data-test_key="city"></span></p>' +
    '<div data-block="test_card" data-test_size="l">New</div>';
  expect(onChange).toHaveBeenLastCalledWith(html);
  expect(container.querySelector<HTMLInputElement>('input[name="body"]')?.value).toBe(html);
});

test("a command cannot write a value outside the rules into the document", () => {
  const { editor, handle } = renderEditor({ defaultValue: "<p>Hi</p>" });
  act(() => {
    editor
      .chain()
      .focus("end")
      .insertContent({ type: "test_mergeTag", attrs: { test_key: "Not Allowed" } })
      .run();
  });
  expect(handle.getHTML()).toBe('<p>Hi<span data-block="test_mergeTag"></span></p>');
});

test("pasted custom blocks pass by the same rules", () => {
  const { editor, handle } = renderEditor({ defaultValue: "<p>x</p>" });
  caretIn(editor, "x");
  paste(editor, `${box("<p>a</p>")}${card}`);
  expect(handle.getHTML()).toContain(box("<p>a</p>"));
  expect(handle.getHTML()).toContain(card);
});

// ── Выключенный свой Инструмент ───────────────────────────────────────────

test("a custom tool that is not passed removes its blocks from the schema", () => {
  const { editor, handle } = renderEditor({
    defaultValue: DOCUMENT,
    tools: [...TOOLS, testNoteTool],
  });
  // Атом без своего Инструмента пропадает, Блок разворачивается в содержимое.
  expect(handle.getHTML()).toBe(`<p>Hi and ${note}</p><p>a</p><p>b</p><p>Card</p>`);

  caretIn(editor, "Card");
  paste(editor, `${box("<p>pasted</p>")}<p>${tag}</p>`);
  expect(handle.getHTML()).not.toContain("data-block");
});

// ── Набор: пресеты и порядок ──────────────────────────────────────────────

test("the presets are exported as frozen arrays of tool names", () => {
  // Все встроенные, кроме Оглавления: `toc` включают только явно (ADR-0068).
  expect(RICH_TEXT_PRESETS.full).toEqual(TOOLS.filter((tool) => tool !== "toc"));
  expect(RICH_TEXT_PRESETS.basic).toContain("bold");
  expect(RICH_TEXT_PRESETS.basic).not.toContain("table");
  expect(Object.isFrozen(RICH_TEXT_PRESETS)).toBe(true);
  expect(Object.isFrozen(RICH_TEXT_PRESETS.full)).toBe(true);
});

test("the full preset plus a custom tool keeps the kit tools and adds the custom block", () => {
  const { handle } = renderEditor({
    defaultValue: `<h2>Title</h2><p>${tag}</p>`,
    tools: [...RICH_TEXT_PRESETS.full, testMergeTagTool],
  });
  expect(handle.getHTML()).toBe(`<h2>Title</h2><p>${tag}</p>`);
  expect(screen.getByRole("button", { name: "Bold" })).toBeTruthy();
});

test("the basic preset plus a custom mark: kit blocks outside basic are still dropped", () => {
  const { handle } = renderEditor({
    defaultValue: `<h2>Title</h2><p>${note}</p>`,
    tools: [...RICH_TEXT_PRESETS.basic, testNoteTool],
  });
  expect(handle.getHTML()).toBe(`<p>Title</p><p>${note}</p>`);
});

test("an unknown string in tools is still dropped silently", () => {
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  const { handle } = renderEditor({
    defaultValue: `<p>${tag}</p>`,
    tools: ["bold", "acme_unknown" as never, testMergeTagTool],
  });
  expect(handle.getHTML()).toBe(`<p>${tag}</p>`);
  expect(screen.queryByRole("alert")).toBeNull();
  expect(error).not.toHaveBeenCalled();
});

test("a top-level custom block stays out of nested blocks", () => {
  const top: CustomTool = {
    ...testBoxTool,
    blocks: { test_box: { kind: "block", place: "top", container: true } },
  };
  const { handle } = renderEditor({
    defaultValue: `${box("<p>a</p>")}<blockquote>${box("<p>b</p>")}</blockquote>`,
    tools: [...TOOLS, top],
  });
  const html = handle.getHTML();
  expect(html.startsWith(box("<p>a</p>"))).toBe(true);
  expect(html).not.toContain(`<blockquote>${box("<p>b</p>")}`);
});

// ── Ручка Блока и Признаки ────────────────────────────────────────────────

const HANDLE = "Block actions";

async function openHandleMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: HANDLE }));
  return screen.findByRole("menu", { name: HANDLE });
}

/** Пункт меню по началу имени: в имя входит подпись сочетания. */
function item(menu: HTMLElement, name: string): HTMLElement {
  const found = Array.from(menu.querySelectorAll<HTMLElement>('[role^="menuitem"]')).find(
    (candidate) => candidate.textContent?.startsWith(name)
  );
  if (!found) throw new Error(`no item "${name}" in the menu`);
  return found;
}

test("the container trait gives the blocks inside their own block handle", async () => {
  const user = userEvent.setup();
  const { editor, handle } = renderEditor({
    defaultValue: `<p>out</p>${box("<p>a</p>", "<p>b</p>")}`,
  });
  caretIn(editor, "b");
  await user.click(item(await openHandleMenu(user), "Move up"));
  expect(handle.getHTML()).toBe(`<p>out</p>${box("<p>b</p>", "<p>a</p>")}`);

  // Первый Блок контейнера выше не уходит: Ручка — у Блока внутри, а не у контейнера.
  caretIn(editor, "b");
  const menu = await openHandleMenu(user);
  expect(item(menu, "Move up").getAttribute("aria-disabled")).toBe("true");
});

test("a block without traits gets the handle with add, move, duplicate and delete", async () => {
  const user = userEvent.setup();
  const { editor, handle } = renderEditor({ defaultValue: `<p>x</p>${card}` });
  caretIn(editor, "Card");
  const menu = await openHandleMenu(user);
  for (const name of ["Add", "Move up", "Move down", "Duplicate", "Delete"]) {
    expect(item(menu, name)).toBeTruthy();
  }
  // Без Признака «можно превратить в» «Формат ›» виден, но недоступен.
  expect(item(menu, "Format").getAttribute("aria-disabled")).toBe("true");
  await user.click(item(menu, "Duplicate"));
  expect(handle.getHTML()).toBe(`<p>x</p>${card}${card}`);
});

test("the turn-into trait opens Format for a custom block", async () => {
  const user = userEvent.setup();
  const turnable: CustomTool = {
    ...testCardTool,
    blocks: { test_card: { ...testCardTool.blocks!.test_card!, turnInto: true } },
  };
  const { editor, handle } = renderEditor({
    defaultValue: '<div data-block="test_card">Card</div>',
    tools: [...TOOLS, turnable],
  });
  caretIn(editor, "Card");
  await user.click(item(await openHandleMenu(user), "Format"));
  await user.click(item(await screen.findByRole("menu", { name: "Format" }), "Text"));
  expect(handle.getHTML()).toBe("<p>Card</p>");
});

test("the plain-atom trait keeps the selection menu off a selected custom atom", async () => {
  const BUBBLE = { name: "Selection formatting" } as const;
  const selectAtom = (plainAtom: boolean) => {
    const tool: CustomTool = {
      ...testMergeTagTool,
      blocks: { test_mergeTag: { ...testMergeTagTool.blocks!.test_mergeTag!, plainAtom } },
    };
    const { editor } = renderEditor({
      toolbar: "bubble",
      defaultValue: `<p>Hi ${tag}</p>`,
      tools: [...TOOLS, tool],
    });
    act(() => {
      editor.view.focus();
      editor.commands.setTextSelection({ from: 1, to: 3 });
    });
    return editor;
  };

  // Без Признака Меню выделения над атомом остаётся.
  let editor = selectAtom(false);
  await screen.findByRole("toolbar", BUBBLE);
  act(() => void editor.commands.setNodeSelection(4));
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(screen.queryByRole("toolbar", BUBBLE)).not.toBeNull();
  cleanup();

  editor = selectAtom(true);
  await screen.findByRole("toolbar", BUBBLE);
  act(() => void editor.commands.setNodeSelection(4));
  await waitFor(() => expect(screen.queryByRole("toolbar", BUBBLE)).toBeNull());
});

// ── Ошибка сборки набора ──────────────────────────────────────────────────

/** Набор с ошибкой: поле с ошибкой, без движка, с прежним значением формы. */
function expectFieldError(tools: RichTextEditorProps["tools"], reason: RegExp) {
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  const ref = createRef<RichTextEditorHandle>();
  const { container } = render(
    <RichTextEditor ref={ref} aria-label="Body" name="body" defaultValue={DOCUMENT} tools={tools} />
  );
  expect(screen.getByRole("alert").textContent).toBe(
    "The editor couldn't start. The document is unchanged."
  );
  expect(screen.queryByRole("textbox")).toBeNull();
  expect(ref.current?.editor).toBeNull();
  expect(ref.current?.getHTML()).toBe(DOCUMENT);
  expect(container.querySelector<HTMLInputElement>('input[name="body"]')?.value).toBe(DOCUMENT);
  // Исключение движка, если было, идёт вторым аргументом (`devError`).
  expect(error.mock.calls.some(([message]) => reason.test(String(message)))).toBe(true);
}

test("a tool name without a consumer prefix is a field error", () => {
  expectFieldError(
    [...TOOLS, { ...testBoxTool, name: "box" as never }],
    /custom tool "box": the name needs a consumer prefix/
  );
});

test("a block, mark or attribute name without a prefix is a field error", () => {
  const unprefixed = Node.create({ name: "box", content: "block+" });
  expectFieldError(
    [
      ...TOOLS,
      { name: "test_box", engine: [unprefixed], blocks: { box: { kind: "block" } } as never },
    ],
    /"box" in blocks needs a consumer prefix/
  );
  cleanup();
  expectFieldError(
    [
      ...TOOLS,
      {
        ...testCardTool,
        blocks: { test_card: { kind: "block", attributes: { size: { kind: "url" } } as never } },
      },
    ],
    /attribute "size" needs a lowercase consumer prefix/
  );
});

test("two tools with one name, or one block name in two tools, are a field error", () => {
  expectFieldError([...TOOLS, testBoxTool, testBoxTool], /two tools share this name/);
  cleanup();
  expectFieldError(
    [...TOOLS, testBoxTool, { ...testBoxTool, name: "test_other" }],
    /"test_box" is taken by another block or mark/
  );
});

test("an engine node or mark without a rule is a field error", () => {
  expectFieldError(
    [...TOOLS, { ...testBoxTool, engine: [testBoxNode, testCardNode] }],
    /node "test_card" of engine has no rule in blocks/
  );
  cleanup();
  expectFieldError(
    [...TOOLS, { ...testBoxTool, engine: [testBoxNode, Mark.create({ name: "test_x" })] }],
    /mark "test_x" of engine has no rule in marks/
  );
});

test("a rule without its engine node is a field error", () => {
  expectFieldError(
    [...TOOLS, { ...testCardTool, engine: [testBoxNode] }],
    /"test_card" in blocks has no node at the top level of engine/
  );
});

test("an engine attribute without a rule is a field error", () => {
  const colored = Node.create({
    name: "test_card",
    content: "inline*",
    addAttributes: () => ({ color: { default: null } }),
  });
  expectFieldError(
    [...TOOLS, { ...testCardTool, engine: [colored] }],
    /node "test_card" has attribute "color" with no rule/
  );
});

test("an engine node that renders past the convention is a field error", () => {
  const paragraphLike = Node.create({
    name: "test_card",
    content: "inline*",
    renderHTML: ({ HTMLAttributes }) => ["p", HTMLAttributes, 0],
  });
  expectFieldError(
    [...TOOLS, { ...testCardTool, engine: [paragraphLike] }],
    /node "test_card" must render <div data-block="test_card">/
  );
});

test("an engine that the schema cannot build is a field error", () => {
  const broken = Node.create({ name: "test_box", content: "test_missing+" });
  expectFieldError([...TOOLS, { ...testBoxTool, engine: [broken] }], /the schema failed to build/);
});
