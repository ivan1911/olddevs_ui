// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import type { Editor } from "@tiptap/react";
import { createRef } from "react";
import { afterEach, beforeAll, expect, test } from "vitest";
import {
  RichTextEditor,
  type RichTextEditorHandle,
  type RichTextEditorProps,
} from "../src/editor/index.js";
import { UiProvider } from "../src/i18n/UiProvider.js";
import { messages as ru } from "../src/locales/ru.js";
import { loadLazyBuiltins } from "./editor-lazy-builtins.js";

// Lazy `codeBlock` and `table` (OLDSUI-111): `full` is ready in `render` after the chunks load.
beforeAll(loadLazyBuiltins);

afterEach(cleanup);

/**
 * Column widths from the keyboard (OLDSUI-310, ADR-0080, decision 6): the "Column" submenu has
 * "Wider" and "Narrower" with the current width, and the "Table" menu has "Equal columns" and "Fit
 * columns to content". Each action is one edit and is announced through the Field notice.
 */
function renderEditor(props: Partial<RichTextEditorProps> = {}) {
  const ref = createRef<RichTextEditorHandle>();
  const view = render(<RichTextEditor ref={ref} aria-label="Body" {...props} />);
  const editor = ref.current?.editor;
  if (!editor) throw new Error("the editor was not created inside render()");
  return { ...view, ref, editor, handle: ref.current! };
}

const cols = (...shares: number[]) =>
  `<colgroup>${shares.map((share) => `<col data-width="${share}">`).join("")}</colgroup>`;
const row = (...cells: string[]) =>
  `<tr>${cells.map((cell) => `<td><p>${cell}</p></td>`).join("")}</tr>`;
const table = (colgroup: string, ...rows: string[]) =>
  `<table>${colgroup}<tbody>${rows.join("")}</tbody></table>`;

const SIZED = table(cols(40, 60), row("a1", "a2"), row("b1", "b2"));
const BARE = table("", row("a1", "a2"), row("b1", "b2"));
const THREE = table(cols(35, 35, 30), row("a", "b", "c"));

function caretIn(editor: Editor, text: string) {
  let found = -1;
  editor.state.doc.descendants((node, pos) => {
    if (found < 0 && node.isText && node.text === text) found = pos + node.nodeSize;
  });
  if (found < 0) throw new Error(`no text "${text}" in the document`);
  act(() => void editor.commands.setTextSelection(found));
}

type User = ReturnType<typeof userEvent.setup>;

async function openMenu(user: User) {
  await user.click(screen.getByRole("button", { name: "Table" }));
  return screen.getByRole("menu", { name: "Table" });
}

async function columnMenu(user: User) {
  const menu = await openMenu(user);
  await user.hover(within(menu).getByRole("menuitem", { name: "Column" }));
  return screen.findByRole("menu", { name: "Column" });
}

async function choose(user: User, submenu: string, name: string) {
  const menu = await openMenu(user);
  await user.hover(within(menu).getByRole("menuitem", { name: submenu }));
  const sub = await screen.findByRole("menu", { name: submenu });
  await user.click(within(sub).getByRole("menuitem", { name }));
}

const announced = () => screen.getByRole("status").textContent;

test("the Column submenu shows the current width as the name of the group with Wider and Narrower", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: SIZED });
  caretIn(editor, "a1");

  const column = await columnMenu(user);

  const group = within(column).getByRole("group", { name: "Column width: 40%" });
  expect(
    within(group)
      .getAllByRole("menuitem")
      .map((item) => item.textContent)
  ).toEqual(["Wider", "Narrower"]);
});

test("the width in the group's name follows the column under the caret", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: SIZED });
  caretIn(editor, "a2");

  const column = await columnMenu(user);

  expect(within(column).getByRole("group", { name: "Column width: 60%" })).toBeDefined();
});

test("a table sized by its content says so", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: BARE });
  caretIn(editor, "a1");

  const column = await columnMenu(user);

  expect(within(column).getByRole("group", { name: "Column width: fits content" })).toBeDefined();
});

test("Wider takes a step from the right neighbour, announces the width and is one undo", async () => {
  const user = userEvent.setup();
  const { editor, handle } = renderEditor({ defaultValue: SIZED });
  caretIn(editor, "a1");

  await choose(user, "Column", "Wider");

  expect(handle.getHTML()).toBe(table(cols(45, 55), row("a1", "a2"), row("b1", "b2")));
  expect(announced()).toBe("Column width: 45%");

  act(() => void editor.commands.undo());
  expect(handle.getHTML()).toBe(SIZED);
});

test("Narrower gives a step to the right neighbour", async () => {
  const user = userEvent.setup();
  const { editor, handle } = renderEditor({ defaultValue: SIZED });
  caretIn(editor, "a1");

  await choose(user, "Column", "Narrower");

  expect(handle.getHTML()).toBe(table(cols(35, 65), row("a1", "a2"), row("b1", "b2")));
  expect(announced()).toBe("Column width: 35%");
});

test("the last column takes from the neighbour on its left", async () => {
  const user = userEvent.setup();
  const { editor, handle } = renderEditor({ defaultValue: THREE });
  caretIn(editor, "c");

  await choose(user, "Column", "Wider");

  expect(handle.getHTML()).toBe(table(cols(35, 30, 35), row("a", "b", "c")));
  expect(announced()).toBe("Column width: 35%");
});

test("at the limit the item is unavailable: a neighbour keeps its 5%", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: table(cols(95, 5), row("a", "b")) });
  caretIn(editor, "a");

  const column = await columnMenu(user);

  expect(
    within(column).getByRole("menuitem", { name: "Wider" }).getAttribute("aria-disabled")
  ).toBe("true");
  expect(
    within(column).getByRole("menuitem", { name: "Narrower" }).getAttribute("aria-disabled")
  ).toBeNull();
});

test("the first step in a table without widths starts from equal columns when nothing can be measured", async () => {
  const user = userEvent.setup();
  const { editor, handle } = renderEditor({ defaultValue: BARE });
  caretIn(editor, "a1");

  await choose(user, "Column", "Wider");

  // jsdom has no layout, so the columns count as equal: 50/50, then a step.
  expect(handle.getHTML()).toBe(table(cols(55, 45), row("a1", "a2"), row("b1", "b2")));
});

test("Equal columns makes every column the same width in one edit", async () => {
  const user = userEvent.setup();
  const { editor, handle } = renderEditor({
    defaultValue: THREE.replace(cols(35, 35, 30), cols(60, 25, 15)),
  });
  caretIn(editor, "a");

  const menu = await openMenu(user);
  await user.click(within(menu).getByRole("menuitem", { name: "Equal columns" }));

  expect(handle.getHTML()).toBe(table(cols(35, 35, 30), row("a", "b", "c")));
  expect(announced()).toBe("Equal columns");
  act(() => void editor.commands.undo());
  expect(handle.getHTML()).toContain(cols(60, 25, 15));
});

test("Fit columns to content removes the widths and is unavailable when there are none", async () => {
  const user = userEvent.setup();
  const { editor, handle } = renderEditor({ defaultValue: SIZED });
  caretIn(editor, "a1");

  let menu = await openMenu(user);
  await user.click(within(menu).getByRole("menuitem", { name: "Fit columns to content" }));

  expect(handle.getHTML()).toBe(BARE);
  expect(announced()).toBe("Fit columns to content");

  caretIn(editor, "a1");
  menu = await openMenu(user);
  expect(
    within(menu)
      .getByRole("menuitem", { name: "Fit columns to content" })
      .getAttribute("aria-disabled")
  ).toBe("true");
});

test("Equal columns is unavailable when the columns are already equal", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: table(cols(50, 50), row("a", "b")) });
  caretIn(editor, "a");

  const menu = await openMenu(user);

  expect(
    within(menu).getByRole("menuitem", { name: "Equal columns" }).getAttribute("aria-disabled")
  ).toBe("true");
});

test("the menu and the announcement speak Russian", async () => {
  const user = userEvent.setup();
  const labels = ru.editor;
  const ref = createRef<RichTextEditorHandle>();
  render(
    <UiProvider locale="ru" messages={ru}>
      <RichTextEditor ref={ref} aria-label="Body" defaultValue={SIZED} />
    </UiProvider>
  );
  caretIn(ref.current!.editor!, "a1");

  await user.click(screen.getByRole("button", { name: labels.table }));
  const menu = screen.getByRole("menu", { name: labels.table });
  await user.hover(within(menu).getByRole("menuitem", { name: labels.tableColumn }));
  const column = await screen.findByRole("menu", { name: labels.tableColumn });
  expect(
    within(column).getByRole("group", { name: labels.tableColumnWidth({ percent: 40 }) })
  ).toBeDefined();
  await user.click(within(column).getByRole("menuitem", { name: labels.tableColumnWider }));

  expect(announced()).toBe(labels.tableColumnWidth({ percent: 45 }));
  // The Russian catalog has its own words, and the percent sign follows a no-break space.
  expect(labels.tableColumnWidth({ percent: 45 })).toContain("\u00a0%");
  expect(labels.tableColumnWidth({ percent: null })).not.toBe(
    labels.tableColumnWidth({ percent: 45 })
  );
});
