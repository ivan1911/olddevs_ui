// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import type { Editor } from "@tiptap/react";
import { createRef } from "react";
import { afterEach, beforeAll, beforeEach, expect, test, vi } from "vitest";
import { UiProvider } from "../src/i18n/UiProvider.js";
import { messages as ru } from "../src/locales/ru.js";
import { TagIcon } from "../src/icons.js";
import {
  RICH_TEXT_PRESETS,
  RichTextEditor,
  type CustomTool,
  type RichTextEditorHandle,
  type RichTextEditorProps,
  type TriggerItem,
} from "../src/editor/index.js";
import { resetDevWarnings } from "../src/lib/dev-warn.js";
import { testMergeTagTool } from "./editor-test-tools.js";
import { loadLazyBuiltins } from "./editor-lazy-builtins.js";

// Lazy `codeBlock` and `table` (OLDSUI-111): `full` is ready in `render` once the chunks load.
beforeAll(loadLazyBuiltins);

beforeEach(resetDevWarnings);

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/**
 * A custom trigger character (ADR-0064, OLDSUI-193): typing `@` opens the same
 * list as `/`, and selecting an item hands the item and the `@query` range to the Tool's
 * handler.
 *
 * Through the public `RichTextEditor`. Typing goes through engine commands, as in the
 * Slash menu tests: jsdom cannot handle input in `contenteditable`. The Tool is an inline
 * atom, `test_mergeTag`, from the shared helper, with the `@` trigger.
 */
const PEOPLE: TriggerItem[] = [
  { id: "ada", label: "Ada Lovelace", data: "ada" },
  { id: "alan", label: "Alan Turing", data: "alan" },
  { id: "grace", label: "Grace Hopper", data: "grace" },
];

function filterPeople(query: string): TriggerItem[] {
  return PEOPLE.filter((person) => person.label.toLowerCase().includes(query.toLowerCase()));
}

/** Replace `@query` with the atom and a space, the way the consumer's handler does it. */
function insertMention(item: TriggerItem, range: { from: number; to: number }, editor: Editor) {
  editor
    .chain()
    .focus()
    .insertContentAt(range, [
      { type: "test_mergeTag", attrs: { test_key: String(item.data) } },
      { type: "text", text: " " },
    ])
    .run();
}

function mentionTool(overrides: Partial<NonNullable<CustomTool["trigger"]>> = {}): CustomTool {
  return {
    ...testMergeTagTool,
    trigger: {
      char: "@",
      items: filterPeople,
      onSelect: (item, { editor, range }) => insertMention(item, range, editor),
      ...overrides,
    },
  };
}

function renderEditor(
  props: Partial<RichTextEditorProps> = {},
  tools: RichTextEditorProps["tools"] = [...RICH_TEXT_PRESETS.full, mentionTool()]
) {
  const ref = createRef<RichTextEditorHandle>();
  const view = render(<RichTextEditor ref={ref} aria-label="Body" tools={tools} {...props} />);
  const editor = ref.current?.editor;
  if (!editor) throw new Error("the editor was not created inside render()");
  return { ...view, ref, editor };
}

function focusField() {
  act(() => screen.getByRole("textbox", { name: "Body" }).focus());
}

/** Type text at the cursor position with a transaction, as real input would. */
function type(editor: Editor, text: string) {
  act(() => void editor.commands.insertContent(text));
}

/** A key press on the field is a real `keydown`, the way both the engine and Radix receive it. */
function press(editor: Editor, key: string) {
  act(() => {
    editor.view.dom.dispatchEvent(
      new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true })
    );
  });
}

const LIST = { name: "Suggestions" };
const optionNames = () => screen.getAllByRole("option").map((option) => option.textContent);
const mentions = (editor: Editor) =>
  editor
    .getJSON()
    .content?.flatMap((block) =>
      (block.content ?? [])
        .filter((node) => node.type === "test_mergeTag")
        .map((node) => (node as { attrs?: { test_key?: string } }).attrs?.test_key)
    );

test("an at sign at the start of an empty paragraph opens the list of the trigger", () => {
  const { editor } = renderEditor();
  focusField();

  type(editor, "@");

  expect(screen.getByRole("listbox", LIST)).toBeDefined();
  expect(optionNames()).toEqual(["Ada Lovelace", "Alan Turing", "Grace Hopper"]);
});

test("the text after the at sign is the query, and the list follows it", () => {
  const items = vi.fn(filterPeople);
  const { editor } = renderEditor({}, [...RICH_TEXT_PRESETS.full, mentionTool({ items })]);
  focusField();

  type(editor, "@gr");

  expect(items).toHaveBeenLastCalledWith("gr");
  expect(optionNames()).toEqual(["Grace Hopper"]);
});

test("Enter picks the active item: onSelect gets the item and the range of the typed text", () => {
  const onSelect = vi.fn(
    (
      item: TriggerItem,
      ctx: { editor: Editor; range: { from: number; to: number }; query: string }
    ) => insertMention(item, ctx.range, ctx.editor)
  );
  const { editor } = renderEditor({}, [...RICH_TEXT_PRESETS.full, mentionTool({ onSelect })]);
  focusField();
  type(editor, "Hi @al");

  press(editor, "Enter");

  expect(onSelect).toHaveBeenCalledTimes(1);
  const [item, ctx] = onSelect.mock.calls[0]!;
  expect(item.id).toBe("alan");
  expect(ctx.query).toBe("al");
  expect(ctx.editor).toBe(editor);
  // "@al" starts at position 5: the paragraph opens at 1, and "Hi " takes 3 characters.
  expect(ctx.range).toEqual({ from: 4, to: 7 });
  expect(mentions(editor)).toEqual(["alan"]);
  expect(editor.getText()).not.toContain("@al");
  expect(screen.queryByRole("listbox")).toBeNull();
});

test("a click on a row picks it, and the list closes", async () => {
  const { editor } = renderEditor();
  focusField();
  type(editor, "@");

  await userEvent.click(screen.getByRole("option", { name: "Grace Hopper" }));

  expect(mentions(editor)).toEqual(["grace"]);
  expect(screen.queryByRole("listbox")).toBeNull();
});

test("one transaction replaces the text, so one undo restores it", () => {
  const { editor } = renderEditor();
  focusField();
  type(editor, "@ada");
  press(editor, "Enter");
  expect(mentions(editor)).toEqual(["ada"]);

  act(() => void editor.commands.undo());

  expect(mentions(editor)).toEqual([]);
});

test("focus stays in the field; arrows move the active option through aria-activedescendant", () => {
  const { editor } = renderEditor();
  focusField();
  type(editor, "@");

  const field = screen.getByRole("textbox", { name: "Body" });
  const listbox = screen.getByRole("listbox", LIST);
  const options = screen.getAllByRole("option");
  expect(document.activeElement).toBe(field);
  expect(field.getAttribute("aria-controls")).toBe(listbox.id);
  expect(field.getAttribute("aria-activedescendant")).toBe(options[0]?.id);

  press(editor, "ArrowDown");
  expect(field.getAttribute("aria-activedescendant")).toBe(options[1]?.id);
  // Up arrow from the first row moves to the last one.
  press(editor, "ArrowUp");
  press(editor, "ArrowUp");
  expect(field.getAttribute("aria-activedescendant")).toBe(options.at(-1)?.id);

  press(editor, "Enter");
  expect(mentions(editor)).toEqual(["grace"]);
  expect(field.getAttribute("aria-controls")).toBeNull();
});

test("an at sign after a space opens the list, inside a word it does not", () => {
  const { editor } = renderEditor({ defaultValue: "<p>mail</p>" });
  focusField();
  act(() => void editor.commands.setTextSelection(editor.state.doc.content.size - 1));

  type(editor, "@example.com");
  expect(screen.queryByRole("listbox")).toBeNull();

  type(editor, " @");
  expect(screen.getByRole("listbox", LIST)).toBeDefined();
});

test("an at sign in a code block is a plain character", () => {
  const { editor } = renderEditor({ defaultValue: "<pre><code>x </code></pre>" });
  focusField();
  act(() => void editor.commands.setTextSelection(editor.state.doc.content.size - 1));

  type(editor, "@");

  expect(screen.queryByRole("listbox")).toBeNull();
});

test("nothing found shows the same row as the slash menu", () => {
  const { editor } = renderEditor();
  focusField();

  type(editor, "@zzz");

  const rows = screen.getAllByRole("option");
  expect(rows.map((row) => row.textContent)).toEqual(["Nothing found"]);
  expect(rows[0]?.getAttribute("aria-disabled")).toBe("true");
  // Enter on an empty list is an ordinary line break: there is no item, and the session stays open.
  press(editor, "Enter");
  expect(mentions(editor)).toEqual([]);
});

test("a space ends the query: the list closes and the text stays", () => {
  const { editor } = renderEditor();
  focusField();
  type(editor, "@ad");
  expect(screen.getByRole("listbox", LIST)).toBeDefined();

  type(editor, " ");

  expect(screen.queryByRole("listbox")).toBeNull();
  expect(editor.getText()).toContain("@ad");
});

test("Escape closes the list and leaves the typed text", async () => {
  const { editor } = renderEditor();
  focusField();
  type(editor, "@ad");
  expect(screen.getByRole("listbox", LIST)).toBeDefined();

  await userEvent.keyboard("{Escape}");

  expect(screen.queryByRole("listbox")).toBeNull();
  expect(editor.getText()).toContain("@ad");
});

test("items may be a promise: the list shows once it settles, a stale answer is dropped", async () => {
  const pending = new Map<string, (items: TriggerItem[]) => void>();
  const items = vi.fn(
    (query: string) => new Promise<TriggerItem[]>((resolve) => pending.set(query, resolve))
  );
  const { editor } = renderEditor({}, [...RICH_TEXT_PRESETS.full, mentionTool({ items })]);
  focusField();

  type(editor, "@a");
  type(editor, "l");
  // While there is no response yet, "No results" does not flicker.
  expect(screen.queryByText("Nothing found")).toBeNull();

  // The response to "a" arrived after the "al" query and changes nothing.
  await act(async () => pending.get("al")?.([PEOPLE[1]!]));
  await act(async () => pending.get("a")?.(PEOPLE));
  expect(optionNames()).toEqual(["Alan Turing"]);
});

test("Enter while the answer to a new query is on its way picks nothing from the old list", async () => {
  const pending = new Map<string, (items: TriggerItem[]) => void>();
  const items = vi.fn(
    (query: string) => new Promise<TriggerItem[]>((resolve) => pending.set(query, resolve))
  );
  const onSelect = vi.fn();
  const { editor } = renderEditor({}, [
    ...RICH_TEXT_PRESETS.full,
    mentionTool({ items, onSelect }),
  ]);
  focusField();

  type(editor, "@a");
  await act(async () => pending.get("a")?.(PEOPLE));
  expect(optionNames()[0]).toBe("Ada Lovelace");

  // "al" is still in flight; the screen shows the "a" list. Enter does not pick
  // Ada Lovelace from it.
  type(editor, "l");
  await userEvent.keyboard("{Enter}");
  expect(onSelect).not.toHaveBeenCalled();
  expect(editor.getText()).toContain("@al");

  await act(async () => pending.get("al")?.([PEOPLE[1]!]));
  await userEvent.keyboard("{Enter}");
  expect(onSelect).toHaveBeenCalledWith(PEOPLE[1], expect.anything());
});

test("a rejected promise is an empty list and a console error in development", async () => {
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  const { editor } = renderEditor({}, [
    ...RICH_TEXT_PRESETS.full,
    mentionTool({ items: () => Promise.reject(new Error("offline")) }),
  ]);
  focusField();

  type(editor, "@");

  await waitFor(() => expect(optionNames()).toEqual(["Nothing found"]));
  expect(error).toHaveBeenCalledWith(
    'RichTextEditor: custom tool "test_mergeTag": trigger.items failed',
    expect.objectContaining({ message: "offline" })
  );
});

test("an item with an icon draws it; the list is named by label of the trigger", () => {
  const { editor } = renderEditor({}, [
    ...RICH_TEXT_PRESETS.full,
    mentionTool({
      label: ({ locale }) => `People ${locale}`,
      items: () => [{ id: "t", label: "Tagged", icon: TagIcon }],
    }),
  ]);
  focusField();

  type(editor, "@");

  const listbox = screen.getByRole("listbox", { name: "People en-US" });
  expect(listbox.querySelector("svg")).not.toBeNull();
});

test("without a label the list is named from the catalog, in the language of UiProvider", () => {
  const ref = createRef<RichTextEditorHandle>();
  render(
    <UiProvider locale="ru-RU" messages={ru}>
      <RichTextEditor
        ref={ref}
        aria-label="Body"
        tools={[...RICH_TEXT_PRESETS.full, mentionTool()]}
      />
    </UiProvider>
  );
  const editor = ref.current!.editor!;
  focusField();

  type(editor, "@");

  expect(screen.getByRole("listbox", { name: ru.editor.triggerList })).toBeDefined();
  act(() => void editor.commands.clearContent());
  type(editor, "@zzz");
  expect(optionNames()).toEqual([ru.editor.nothingFound]);
});

test("the slash menu and the trigger list live side by side", () => {
  const { editor } = renderEditor();
  focusField();

  type(editor, "/");
  expect(screen.getByRole("listbox", { name: "Insert block" })).toBeDefined();
  expect(screen.queryByRole("listbox", LIST)).toBeNull();

  act(() => void editor.commands.clearContent());
  type(editor, "@");
  expect(screen.getByRole("listbox", LIST)).toBeDefined();
  expect(screen.queryByRole("listbox", { name: "Insert block" })).toBeNull();
});

test("a trigger works without the insert menu in the tool set", () => {
  const { editor } = renderEditor({}, ["bold", mentionTool()]);
  focusField();

  type(editor, "@");

  expect(screen.getByRole("listbox", LIST)).toBeDefined();
});

test("a second trigger with its own character has its own list", () => {
  const tags: CustomTool = {
    name: "test_tags",
    engine: [],
    trigger: {
      char: "#",
      items: (query) => [{ id: `tag-${query}`, label: `Tag ${query}` }],
      onSelect: (item, { editor, range }) =>
        void editor.chain().insertContentAt(range, `#${item.id} `).run(),
    },
  };
  const { editor } = renderEditor({}, [...RICH_TEXT_PRESETS.full, mentionTool(), tags]);
  focusField();

  type(editor, "#rel");
  expect(optionNames()).toEqual(["Tag rel"]);

  press(editor, "Enter");
  expect(editor.getText()).toContain("#tag-rel");
});

function expectFieldError(tools: RichTextEditorProps["tools"], reason: RegExp) {
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  render(<RichTextEditor aria-label="Body" tools={tools} />);
  expect(screen.getByRole("alert").textContent).toBe(
    "The editor couldn't start. The document is unchanged."
  );
  expect(error.mock.calls.some(([message]) => reason.test(String(message)))).toBe(true);
}

test("two tools with one trigger character are a field error", () => {
  const other: CustomTool = {
    name: "test_other",
    engine: [],
    trigger: { char: "@", items: () => [], onSelect: () => {} },
  };
  expectFieldError(
    [...RICH_TEXT_PRESETS.full, mentionTool(), other],
    /the trigger character "@" is taken by another tool/
  );
});

test.each(["/", " ", "", "@@", "\n"])("the character %j is not a valid trigger", (char) => {
  expectFieldError(
    [...RICH_TEXT_PRESETS.full, mentionTool({ char })],
    /trigger\.char is one printable character, not a space and not \//
  );
  cleanup();
});

test("a trigger without items or onSelect is a field error", () => {
  expectFieldError(
    [...RICH_TEXT_PRESETS.full, mentionTool({ items: undefined as never })],
    /trigger needs items and onSelect functions/
  );
});

test("a read-only field never opens the list", () => {
  const { editor } = renderEditor({ readOnly: true });

  type(editor, "@");

  expect(screen.queryByRole("listbox")).toBeNull();
});
