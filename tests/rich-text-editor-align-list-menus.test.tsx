// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import type { Editor } from "@tiptap/react";
import { createRef } from "react";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import { ModalOverlay } from "../src/components/overlays/ModalOverlay.js";
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
  vi.restoreAllMocks();
});

/**
 * Меню «Выравнивание» и «Списки» на Панели (OLDSUI-66).
 *
 * Через публичный `RichTextEditor`, как меню «¶»: кнопка и пункты — ролями и
 * именами, результат — выходным HTML и шагами отмены. Каретка ставится
 * командами движка: jsdom не умеет ввода в `contenteditable`.
 */
function renderEditor(props: Partial<RichTextEditorProps> = {}) {
  const ref = createRef<RichTextEditorHandle>();
  const view = render(<RichTextEditor ref={ref} aria-label="Body" {...props} />);
  const editor = ref.current?.editor;
  if (!editor) throw new Error("the editor was not created inside render()");
  return { ...view, ref, editor };
}

/** Каретка в конец текста `text`. */
function caretIn(editor: Editor, text: string) {
  let found = -1;
  editor.state.doc.descendants((node, pos) => {
    if (found < 0 && node.isText && node.text === text) found = pos + node.nodeSize;
  });
  if (found < 0) throw new Error(`no text "${text}" in the document`);
  act(() => void editor.commands.setTextSelection(found));
}

const alignButton = () => screen.getByRole("button", { name: /^Alignment/ });
const listButton = () => screen.getByRole("button", { name: /^(Lists|List:)/ });
const textbox = () => screen.getByRole("textbox", { name: "Body" });

/** Пункты открытого меню: имя без подписи сочетания, отметка, подпись. */
function items(menuName: RegExp) {
  // Меню названо своей кнопкой (`aria-labelledby`), как в паттерне APG.
  const menu = screen.getByRole("menu", { name: menuName });
  return within(menu)
    .getAllByRole("menuitemradio")
    .map((item) => {
      const shortcut = item.querySelector("kbd")?.textContent ?? null;
      return {
        name: (item.textContent ?? "").replace(shortcut ?? "", ""),
        checked: item.getAttribute("aria-checked") === "true",
        shortcut,
      };
    });
}

const checkedIn = (menuName: RegExp) => items(menuName).find((item) => item.checked)?.name ?? null;

// --- Выравнивание ---------------------------------------------------------

test("the alignment menu offers left, center and right with shortcuts; left is checked by default", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: "<p>Title</p>" });
  caretIn(editor, "Title");

  expect(alignButton().getAttribute("aria-label")).toBe("Alignment: left");
  expect(alignButton().getAttribute("aria-haspopup")).toBe("menu");
  await user.click(alignButton());

  // jsdom — не Apple: `mod` подписан как Ctrl. По ширине нет (WCAG 1.4.8).
  expect(items(/^Alignment/)).toEqual([
    { name: "Align left", checked: true, shortcut: "Ctrl+Shift+L" },
    { name: "Align center", checked: false, shortcut: "Ctrl+Shift+E" },
    { name: "Align right", checked: false, shortcut: "Ctrl+Shift+R" },
  ]);
});

test("on Apple the alignment shortcuts are signed with ⌘ ⇧", async () => {
  vi.spyOn(navigator, "platform", "get").mockReturnValue("MacIntel");
  const user = userEvent.setup();
  renderEditor({ defaultValue: "<p>Title</p>" });

  await user.click(alignButton());

  expect(items(/^Alignment/).map((item) => item.shortcut)).toEqual(["⌘+⇧+L", "⌘+⇧+E", "⌘+⇧+R"]);
});

test("choosing an alignment aligns the block, names it on the button, undoes in one step and returns focus", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: "<p>Title</p>" });
  caretIn(editor, "Title");
  const leftIcon = alignButton().querySelector("svg")?.innerHTML;

  await user.click(alignButton());
  await user.click(screen.getByRole("menuitemradio", { name: /Align center/ }));

  expect(editor.getHTML()).toBe('<p data-align="center">Title</p>');
  expect(screen.queryByRole("menu")).toBeNull();
  expect(alignButton().getAttribute("aria-label")).toBe("Alignment: center");
  // Значок кнопки — текущее выравнивание глазу.
  expect(alignButton().querySelector("svg")?.innerHTML).not.toBe(leftIcon);
  await waitFor(() => expect(document.activeElement).toBe(textbox()));

  await user.click(alignButton());
  expect(checkedIn(/^Alignment/)).toBe("Align center");
  await user.keyboard("{Escape}");

  act(() => void editor.commands.undo());
  expect(editor.getHTML()).toBe("<p>Title</p>");
});

test("left takes the alignment off, and choosing the current one adds no undo step", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: '<p data-align="right">Title</p>' });
  caretIn(editor, "Title");
  expect(alignButton().getAttribute("aria-label")).toBe("Alignment: right");

  await user.click(alignButton());
  await user.click(screen.getByRole("menuitemradio", { name: /Align right/ }));
  expect(editor.getHTML()).toBe('<p data-align="right">Title</p>');
  expect(editor.can().undo()).toBe(false);
  await waitFor(() => expect(document.activeElement).toBe(textbox()));

  await user.click(alignButton());
  await user.click(screen.getByRole("menuitemradio", { name: /Align left/ }));
  // Влево — умолчание: атрибута в Документе нет.
  expect(editor.getHTML()).toBe("<p>Title</p>");
});

test("without the align tool there is no alignment menu", () => {
  renderEditor({ preset: "basic" });

  expect(screen.queryByRole("button", { name: /^Alignment/ })).toBeNull();
});

// --- Списки ---------------------------------------------------------------

test("the lists menu offers the three kinds with shortcuts; outside a list nothing is checked", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: "<p>Item</p>" });
  caretIn(editor, "Item");

  expect(listButton().getAttribute("aria-label")).toBe("Lists");
  expect(listButton().getAttribute("aria-haspopup")).toBe("menu");
  await user.click(listButton());

  expect(items(/^Lists/)).toEqual([
    { name: "Bulleted list", checked: false, shortcut: "Ctrl+Shift+8" },
    { name: "Numbered list", checked: false, shortcut: "Ctrl+Shift+7" },
    { name: "Checklist", checked: false, shortcut: "Ctrl+Shift+9" },
  ]);
});

test("the check and the button name follow the list under the caret, inside a quote too", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({
    defaultValue:
      "<ul><li><p>Bullet</p></li></ul><ol><li><p>Step</p></li></ol>" +
      '<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p>Task</p></li></ul>' +
      "<blockquote><ol><li><p>Quoted step</p></li></ol></blockquote>",
  });

  const cases = [
    ["Bullet", "List: bulleted", "Bulleted list"],
    ["Step", "List: numbered", "Numbered list"],
    ["Task", "List: checklist", "Checklist"],
    ["Quoted step", "List: numbered", "Numbered list"],
  ] as const;
  for (const [text, name, item] of cases) {
    caretIn(editor, text);
    expect(listButton().getAttribute("aria-label"), text).toBe(name);
    await user.click(listButton());
    expect(checkedIn(/^List/), text).toBe(item);
    await user.keyboard("{Escape}");
  }
});

test("choosing a list wraps the block, undoes in one step and returns focus", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: "<p>Item</p>" });
  caretIn(editor, "Item");
  const plainIcon = listButton().querySelector("svg")?.innerHTML;

  await user.click(listButton());
  await user.click(screen.getByRole("menuitemradio", { name: /Numbered list/ }));

  expect(editor.getHTML()).toBe("<ol><li><p>Item</p></li></ol>");
  expect(listButton().getAttribute("aria-label")).toBe("List: numbered");
  expect(listButton().querySelector("svg")?.innerHTML).not.toBe(plainIcon);
  await waitFor(() => expect(document.activeElement).toBe(textbox()));

  act(() => void editor.commands.undo());
  expect(editor.getHTML()).toBe("<p>Item</p>");
});

test("another kind turns the list into it in one step, as the block type menu does", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: "<ul><li><p>Item</p></li></ul>" });
  caretIn(editor, "Item");

  await user.click(listButton());
  await user.click(screen.getByRole("menuitemradio", { name: /Checklist/ }));

  expect(editor.getHTML()).toBe(
    '<ul data-type="taskList"><li data-checked="false" data-type="taskItem"><label><input type="checkbox"><span></span></label><div><p>Item</p></div></li></ul>'
  );
  act(() => void editor.commands.undo());
  expect(editor.getHTML()).toBe("<ul><li><p>Item</p></li></ul>");
});

test("choosing the checked list again takes the list off", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: "<ol><li><p>Item</p></li></ol>" });
  caretIn(editor, "Item");

  await user.click(listButton());
  await user.click(screen.getByRole("menuitemradio", { name: /Numbered list/ }));

  expect(editor.getHTML()).toBe("<p>Item</p>");
  expect(listButton().getAttribute("aria-label")).toBe("Lists");
  act(() => void editor.commands.undo());
  expect(editor.getHTML()).toBe("<ol><li><p>Item</p></li></ol>");
});

test("items come from the enabled list tools; a single one is still a menu; none — no menu", async () => {
  const user = userEvent.setup();
  const basic = renderEditor({ preset: "basic" });
  await user.click(listButton());
  expect(items(/^Lists/).map((item) => item.name)).toEqual(["Bulleted list", "Numbered list"]);
  basic.unmount();

  // Меню с одним пунктом остаётся меню: кнопка не превращается в переключатель.
  const single = renderEditor({ tools: ["taskList"] });
  await user.click(listButton());
  expect(items(/^Lists/).map((item) => item.name)).toEqual(["Checklist"]);
  single.unmount();

  renderEditor({ tools: ["bold", "align"] });
  expect(screen.queryByRole("button", { name: /^(Lists|List:)/ })).toBeNull();
});

// --- Общее ------------------------------------------------------------------

test("Enter, Space and ArrowDown open both menus; Escape closes and returns focus to the button", async () => {
  const user = userEvent.setup();
  renderEditor({ defaultValue: "<p>Title</p>" });

  for (const button of [alignButton, listButton]) {
    for (const key of ["{Enter}", " ", "{ArrowDown}"]) {
      act(() => button().focus());
      await user.keyboard(key);
      expect(document.activeElement?.closest('[role="menu"]'), key).not.toBeNull();

      await user.keyboard("{Escape}");
      expect(screen.queryByRole("menu"), key).toBeNull();
      await waitFor(() => expect(document.activeElement, key).toBe(button()));
    }
  }
});

test("Escape in the menus closes the menu, not the layer under it", async () => {
  const user = userEvent.setup();
  const onClose = vi.fn();
  render(
    <ModalOverlay onClose={onClose}>
      <RichTextEditor aria-label="Body" />
    </ModalOverlay>
  );

  for (const button of [alignButton, listButton]) {
    await user.click(button());
    expect(screen.getByRole("menu")).toBeDefined();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).toBeNull();
  }
  expect(onClose).not.toHaveBeenCalled();
});

test("both menus speak the provider's language", async () => {
  const user = userEvent.setup();
  render(
    <UiProvider messages={ru}>
      <RichTextEditor
        aria-label="Body"
        defaultValue={'<ol><li><p data-align="center">Title</p></li></ol>'}
      />
    </UiProvider>
  );

  // Ожидания — из русского каталога: гейт i18n держит кириллицу в каталоге.
  const t = ru.editor;
  const align = screen.getByRole("button", { name: t.alignMenu({ current: "center" }) });
  const lists = screen.getByRole("button", { name: t.listMenu({ current: "orderedList" }) });

  await user.click(align);
  const alignMenu = screen.getByRole("menu", { name: align.getAttribute("aria-label")! });
  expect(
    within(alignMenu).getByRole("menuitemradio", { name: new RegExp(t.alignCenter) })
  ).toBeDefined();
  await user.keyboard("{Escape}");

  await user.click(lists);
  const listMenu = screen.getByRole("menu", { name: lists.getAttribute("aria-label")! });
  expect(
    within(listMenu).getByRole("menuitemradio", { name: new RegExp(t.orderedList) })
  ).toBeDefined();
});
