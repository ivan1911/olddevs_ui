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

// Lazy `codeBlock` and `table` (OLDSUI-111): `full` is ready in `render` after the chunks load.
beforeAll(loadLazyBuiltins);

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/**
 * The "…" menu on the Toolbar, More formatting (OLDSUI-65): inline code,
 * underline, sub- and superscript, the Code block (OLDSUI-76), the submenus for the marker and
 * the text color, and clear styles.
 *
 * Through the public `RichTextEditor`: the button and the items are found by roles and names,
 * as a screen reader hears them; the result is the output HTML. The selection is set with
 * engine commands: jsdom cannot type into `contenteditable`.
 */
function renderEditor(props: Partial<RichTextEditorProps> = {}) {
  const ref = createRef<RichTextEditorHandle>();
  const view = render(<RichTextEditor ref={ref} aria-label="Body" {...props} />);
  const editor = ref.current?.editor;
  if (!editor) throw new Error("the editor was not created inside render()");
  return { ...view, ref, editor };
}

/** Selects the whole text `text`. */
function select(editor: Editor, text: string) {
  let from = -1;
  editor.state.doc.descendants((node, pos) => {
    if (from < 0 && node.isText && node.text?.includes(text)) from = pos + node.text.indexOf(text);
  });
  if (from < 0) throw new Error(`no text "${text}" in the document`);
  act(() => void editor.commands.setTextSelection({ from, to: from + text.length }));
}

const moreButton = () => screen.getByRole("button", { name: "More formatting" });
const textbox = () => screen.getByRole("textbox", { name: "Body" });

/** Items of the open menu (or submenu): role, name without the shortcut label, checked state, label. */
function items(menu: HTMLElement) {
  return Array.from(menu.querySelectorAll<HTMLElement>('[role^="menuitem"]')).map((item) => {
    const shortcut = item.querySelector("kbd")?.textContent ?? null;
    return {
      role: item.getAttribute("role"),
      name: (item.textContent ?? "").replace(shortcut ?? "", ""),
      checked: item.getAttribute("aria-checked") === "true",
      shortcut,
    };
  });
}

async function openMore(user: ReturnType<typeof userEvent.setup>) {
  await user.click(moreButton());
  return screen.getByRole("menu", { name: "More formatting" });
}

test("the full preset offers the rare marks, Code block, Quote and Clear formatting — colours are buttons now", async () => {
  const user = userEvent.setup();
  renderEditor({ defaultValue: "<p>Hello world</p>" });

  expect(moreButton().getAttribute("aria-haspopup")).toBe("menu");
  const menu = await openMore(user);

  // jsdom is not Apple: `mod` is labeled Ctrl.
  expect(items(menu)).toEqual([
    { role: "menuitemcheckbox", name: "Inline code", checked: false, shortcut: "Ctrl+E" },
    { role: "menuitemcheckbox", name: "Underline", checked: false, shortcut: "Ctrl+U" },
    { role: "menuitemcheckbox", name: "Strikethrough", checked: false, shortcut: "Ctrl+Shift+S" },
    { role: "menuitemcheckbox", name: "Superscript", checked: false, shortcut: "Ctrl+." },
    { role: "menuitemcheckbox", name: "Subscript", checked: false, shortcut: "Ctrl+," },
    // The submenu of the language Mark (OLDSUI-308): a section of its own, without a shortcut.
    { role: "menuitem", name: "Language", checked: false, shortcut: null },
    { role: "menuitemcheckbox", name: "Code block", checked: false, shortcut: "Ctrl+Alt+C" },
    // Quote is a check item next to the Code block (OLDSUI-154): it has moved out of "¶".
    { role: "menuitemcheckbox", name: "Quote", checked: false, shortcut: "Ctrl+Shift+B" },
    { role: "menuitem", name: "Clear formatting", checked: false, shortcut: "Ctrl+\\" },
    // A display mode of the Document, not formatting: the last section, without a shortcut (OLDSUI-278).
    { role: "menuitemcheckbox", name: "Invisible characters", checked: false, shortcut: null },
    // The other display modes share the section (OLDSUI-312).
    { role: "menuitemcheckbox", name: "Focus mode", checked: false, shortcut: null },
    { role: "menuitemcheckbox", name: "Fullscreen", checked: false, shortcut: null },
  ]);
});

test("on Apple the shortcuts are signed with ⌘", async () => {
  vi.spyOn(navigator, "platform", "get").mockReturnValue("MacIntel");
  const user = userEvent.setup();
  renderEditor();

  const menu = await openMore(user);
  expect(items(menu).map((item) => item.shortcut)).toEqual([
    "⌘+E",
    "⌘+U",
    "⌘+⇧+S",
    "⌘+.",
    "⌘+,",
    null,
    "⌘+⌥+C",
    "⌘+⇧+B",
    "⌘+\\",
    null,
    null,
    null,
  ]);
  // Key symbols are set in a proportional font, as in \`Kbd\`: in a monospace stack the \`⇧\`
  // glyph is missing, and the fallback glyph comes out thin (OLDSUI-117).
  const strike = within(menu).getByRole("menuitemcheckbox", { name: /Strikethrough/ });
  expect(
    [...strike.querySelectorAll("kbd [data-key-symbol]")].map((node) => node.textContent)
  ).toEqual(["⌘", "⇧"]);
});

test("items come from the enabled tools: basic has inline code, strikethrough and Quote", async () => {
  const user = userEvent.setup();
  const { unmount } = renderEditor({ preset: "basic" });
  // Strikethrough no longer sits in the Toolbar row: it is in "…" (OLDSUI-60).
  expect(items(await openMore(user)).map((item) => item.name)).toEqual([
    "Inline code",
    "Strikethrough",
    "Quote",
  ]);
  unmount();

  // The marker has its own button next to it (OLDSUI-153), and it is not in "…".
  renderEditor({ tools: ["bold", "highlight", "subscript"] });
  expect(items(await openMore(user)).map((item) => item.name)).toEqual(["Subscript"]);
});

test("without a single tool of the menu there is no button at all", () => {
  renderEditor({ tools: ["bold", "italic", "link", "history"] });

  expect(screen.queryByRole("button", { name: "More formatting" })).toBeNull();
});

test("the checks follow the marks under the caret and in the selection", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({
    defaultValue: "<p><u>under</u> <code>code</code> x<sup>2</sup> plain</p>",
  });
  const checkedNames = async () => {
    const menu = await openMore(user);
    const names = items(menu)
      .filter((item) => item.checked)
      .map((item) => item.name);
    await user.keyboard("{Escape}");
    return names;
  };

  act(() => void editor.commands.setTextSelection(3));
  expect(await checkedNames()).toEqual(["Underline"]);
  select(editor, "code");
  expect(await checkedNames()).toEqual(["Inline code"]);
  select(editor, "2");
  expect(await checkedNames()).toEqual(["Superscript"]);
  select(editor, "plain");
  expect(await checkedNames()).toEqual([]);
});

test("choosing a mark sets it, closes the menu, returns focus and undoes in one step", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: "<p>Hello world</p>" });
  select(editor, "Hello");

  await openMore(user);
  await user.click(screen.getByRole("menuitemcheckbox", { name: /Underline/ }));

  expect(editor.getHTML()).toBe("<p><u>Hello</u> world</p>");
  expect(screen.queryByRole("menu")).toBeNull();
  await waitFor(() => expect(document.activeElement).toBe(textbox()));

  act(() => void editor.commands.undo());
  expect(editor.getHTML()).toBe("<p>Hello world</p>");
});

test("choosing a checked mark takes it off", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: "<p><sub>Hello</sub> world</p>" });
  select(editor, "Hello");

  await openMore(user);
  const subscript = screen.getByRole("menuitemcheckbox", { name: /Subscript/ });
  expect(subscript.getAttribute("aria-checked")).toBe("true");
  await user.click(subscript);

  expect(editor.getHTML()).toBe("<p>Hello world</p>");
});

test("Clear formatting removes every mark from the selection in one step", async () => {
  const user = userEvent.setup();
  const doc = '<p><strong>Bold</strong> <mark data-color="pink">marked</mark></p>';
  const { editor } = renderEditor({ defaultValue: doc });
  act(() => void editor.commands.selectAll());

  await openMore(user);
  await user.click(screen.getByRole("menuitem", { name: /Clear formatting/ }));

  expect(editor.getHTML()).toBe("<p>Bold marked</p>");
  await waitFor(() => expect(document.activeElement).toBe(textbox()));
  act(() => void editor.commands.undo());
  expect(editor.getHTML()).toBe(doc);
});

test("in a code block the marks have nothing to do and are unavailable", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: "<pre><code>let x = 1;</code></pre>" });
  select(editor, "let");

  const menu = await openMore(user);
  for (const name of ["Inline code", "Underline", "Strikethrough", "Superscript", "Subscript"]) {
    const item = within(menu).getByRole("menuitemcheckbox", { name: new RegExp(name) });
    expect(item.getAttribute("aria-disabled"), name).toBe("true");
  }
  // The Code block, on the other hand, is checked and available: selecting it turns the Block back into text.
  const codeBlock = within(menu).getByRole("menuitemcheckbox", { name: /Code block/ });
  expect(codeBlock.getAttribute("aria-checked")).toBe("true");
  expect(codeBlock.hasAttribute("aria-disabled")).toBe(false);
});

/**
 * The Code block is an item in "…", not a Toolbar button (OLDSUI-76): it is used
 * rarely. The check item of its own section is the Block, not the Mark.
 */
test("Code block is a check item of the menu, not a toolbar button", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: "<p>Hello world</p>" });
  select(editor, "Hello");

  expect(screen.queryByRole("button", { name: "Code block" })).toBeNull();
  const menu = await openMore(user);
  const item = within(menu).getByRole("menuitemcheckbox", { name: /Code block/ });
  expect(item.getAttribute("aria-checked")).toBe("false");
  expect(item.querySelector("kbd")?.textContent).toBe("Ctrl+Alt+C");
  await user.click(item);

  expect(editor.getHTML()).toBe("<pre><code>Hello world</code></pre>");
  expect(screen.queryByRole("menu")).toBeNull();
  await waitFor(() => expect(document.activeElement).toBe(textbox()));

  // The caret in the Code block: the item is checked, and selecting it turns the Block back into text.
  const again = await openMore(user);
  const checked = within(again).getByRole("menuitemcheckbox", { name: /Code block/ });
  expect(checked.getAttribute("aria-checked")).toBe("true");
  await user.click(checked);
  expect(editor.getHTML()).toBe("<p>Hello world</p>");
});

test("the Code block item is one step to undo", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: "<p>Hello world</p>" });
  select(editor, "Hello");

  await openMore(user);
  await user.click(screen.getByRole("menuitemcheckbox", { name: /Code block/ }));
  expect(editor.getHTML()).toBe("<pre><code>Hello world</code></pre>");
  act(() => void editor.commands.undo());
  expect(editor.getHTML()).toBe("<p>Hello world</p>");
});

test("without the codeBlock tool there is no item; with it alone the menu holds just that item", async () => {
  const user = userEvent.setup();
  const { unmount } = renderEditor({ tools: ["bold", "underline"] });
  expect(items(await openMore(user)).map((item) => item.name)).toEqual(["Underline"]);
  unmount();

  renderEditor({ tools: ["bold", "codeBlock"] });
  expect(screen.queryByRole("button", { name: "Code block" })).toBeNull();
  expect(items(await openMore(user)).map((item) => item.name)).toEqual(["Code block"]);
});

test("a disabled field switches the button off", () => {
  renderEditor({ disabled: true });

  expect((moreButton() as HTMLButtonElement).disabled).toBe(true);
});

/**
 * Escape in a menu belongs to the menu, not to the layer under it (ADR-0041). The layer is
 * `ModalOverlay`: a react-aria menu inside a Radix modal does not open in jsdom. For the real
 * `Dialog` and `Drawer`, see `tests-visual/interactions.spec.ts`.
 */
test("Escape in the menu closes it, not the layer under it", async () => {
  const user = userEvent.setup();
  const onClose = vi.fn();
  render(
    <ModalOverlay onClose={onClose}>
      <RichTextEditor aria-label="Body" />
    </ModalOverlay>
  );

  act(() => moreButton().focus());
  await user.keyboard("{Enter}");
  // The react-aria menu opens and closes over the next frames: under the load of a full run,
  // an instant check caught the intermediate state.
  expect(await screen.findByRole("menu", { name: "More formatting" })).toBeDefined();
  await user.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
  expect(onClose).not.toHaveBeenCalled();

  // Control check: without an open menu, the same Escape closes the layer. Focus goes back into
  // the Document, not to the "…" button: a tooltip may open on that button, and the first Escape
  // through the layer stack would go to it.
  act(() => textbox().focus());
  // The first Escape in the text selects the Block (the `blockSelection` Tool, ADR-0077); the layer closes on the second.
  await user.keyboard("{Escape}");
  expect(onClose).not.toHaveBeenCalled();
  await user.keyboard("{Escape}");
  expect(onClose).toHaveBeenCalledTimes(1);
});

test("the menu speaks the provider's language", async () => {
  const user = userEvent.setup();
  render(
    <UiProvider messages={ru}>
      <RichTextEditor aria-label="Body" defaultValue="<p>Text</p>" />
    </UiProvider>
  );

  // The expectations come from the Russian catalog: the i18n gate keeps Cyrillic in the catalog.
  const t = ru.editor;
  await user.click(screen.getByRole("button", { name: t.moreFormatting }));
  const menu = screen.getByRole("menu", { name: t.moreFormatting });
  expect(items(menu).map((item) => item.name)).toEqual([
    t.code,
    t.underline,
    t.strike,
    t.superscript,
    t.subscript,
    t.language,
    t.codeBlock,
    t.blockquote,
    t.clearFormatting,
    t.invisibleCharacters,
    t.focusMode,
    t.fullscreen,
  ]);
});
