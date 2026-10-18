// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { createRef, useRef } from "react";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import { UiProvider } from "../src/i18n/UiProvider.js";
import { messages as ru } from "../src/locales/ru.js";
import {
  RICH_TEXT_PRESETS,
  RichTextEditor,
  tool,
  useRichTextToolState,
  type RichTextEditorHandle,
  type RichTextEditorProps,
} from "../src/editor/index.js";
import { PRESETS, TOOLS } from "../src/editor/core/tools.js";
import { loadLazyBuiltins } from "./editor-lazy-builtins.js";

// Lazy `codeBlock` and `table`: `full` is ready in `render` once the chunks load.
beforeAll(loadLazyBuiltins);

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/**
 * Invisible characters (OLDSUI-278): the `invisibleCharacters` Tool on the
 * Invisible Characters extension from Tiptap. A Decoration on top of the Document,
 * through the public `RichTextEditor` with a concrete `tools`: what the author sees
 * (the checkbox item in the More formatting menu, the marks in the DOM) and what
 * the owner gets (`onChange`, `getHTML()`, Tool state and Tool commands).
 */
function renderEditor(props: Partial<RichTextEditorProps> = {}) {
  const ref = createRef<RichTextEditorHandle>();
  const view = render(<RichTextEditor ref={ref} aria-label="Body" {...props} />);
  const handle = ref.current;
  if (!handle?.editor) throw new Error("the editor was not created inside render()");
  return { ...view, handle, editor: handle.editor };
}

const TOOLS_WITH = ["bold", "invisibleCharacters"] as const;
/** `full` without the other display modes (OLDSUI-312), which share the section: its own item stays alone in it. */
const FULL_ALONE = PRESETS.full.filter((name) => name !== "fullscreen" && name !== "focus");
const CONTENT = "<p>one two</p><p>three<br>four</p><p></p>";

type User = ReturnType<typeof userEvent.setup>;

const MORE = { name: "More formatting" } as const;
const moreButton = () => screen.queryByRole<HTMLButtonElement>("button", MORE);
const NAME = { name: "Invisible characters" } as const;

/** Open the More formatting menu (on the fixed Toolbar) and return it. */
async function openMore(user: User) {
  await user.click(moreButton()!);
  return screen.getByRole("menu", MORE);
}

/** The item of the open More formatting menu; `null` means there is no such item. */
const itemIn = (menu: HTMLElement) => within(menu).queryByRole("menuitemcheckbox", NAME);

/**
 * Toggle the display with the menu item in one click; the menu closes by itself.
 * Also wait for focus to return to the Document: it arrives a frame later, and a
 * More formatting menu opened right after would close on that late focus.
 */
async function toggleByItem(user: User) {
  await user.click(itemIn(await openMore(user))!);
  await waitFor(() =>
    expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Body" }))
  );
}

/** Whether the item is checked now: open the menu, read it, close it with Escape. */
async function itemChecked(user: User) {
  const menu = await openMore(user);
  const checked = itemIn(menu)?.getAttribute("aria-checked");
  await user.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("menu", MORE)).toBeNull());
  return checked;
}

/** Invisible characters in the Document's DOM, by kind: `space`, `break`, `paragraph`. */
function marks() {
  const count = (kind: string) =>
    document.querySelectorAll(`.tiptap-invisible-character--${kind}`).length;
  return { space: count("space"), break: count("break"), paragraph: count("paragraph") };
}

const HIDDEN = { space: 0, break: 0, paragraph: 0 };
const SHOWN = { space: 1, break: 1, paragraph: 3 };

test("the «…» item shows and hides spaces, hard breaks and paragraph ends", async () => {
  const user = userEvent.setup();
  renderEditor({ tools: [...TOOLS_WITH], defaultValue: CONTENT });

  expect(await itemChecked(user)).toBe("false");
  expect(marks()).toEqual(HIDDEN);

  await toggleByItem(user);
  expect(marks()).toEqual(SHOWN);
  expect(await itemChecked(user)).toBe("true");

  await toggleByItem(user);
  expect(marks()).toEqual(HIDDEN);
  expect(await itemChecked(user)).toBe("false");
});

test("there is no toolbar button for it any more: the row is untouched", () => {
  renderEditor({ defaultValue: CONTENT });
  const toolbar = screen.getByRole("toolbar", { name: "Formatting" });
  const names = Array.from(toolbar.querySelectorAll("button"), (node) =>
    node.getAttribute("aria-label")
  );
  expect(names).not.toContain("Invisible characters");
  // The right edge is still Find and the shortcut reference.
  expect(names.slice(-3)).toEqual(["Redo", "Find", "Keyboard shortcuts"]);
});

test("the item is a menuitemcheckbox in its own last section, set off by a divider", async () => {
  const user = userEvent.setup();
  renderEditor({ tools: [...FULL_ALONE], defaultValue: CONTENT });
  const menu = await openMore(user);

  const item = itemIn(menu)!;
  const all = Array.from(menu.querySelectorAll('[role^="menuitem"]'));
  expect(all.at(-1)).toBe(item);
  // The section is its own: a divider comes before it, and "Clear formatting" stays where it was.
  const section = item.closest('[role="group"]')!;
  expect(section.querySelectorAll('[role^="menuitem"]')).toHaveLength(1);
  expect(section.previousElementSibling?.getAttribute("role")).toBe("separator");
  expect(within(menu).getByRole("menuitem", { name: /^Clear formatting/ })).toBeDefined();
  expect(item.querySelector("svg")).not.toBeNull();
  expect(item.querySelector("kbd")).toBeNull();
});

test("choosing the item closes the menu and leaves the focus in the Document", async () => {
  const user = userEvent.setup();
  renderEditor({ tools: [...TOOLS_WITH], defaultValue: CONTENT });

  await toggleByItem(user);
  expect(screen.queryByRole("menu", MORE)).toBeNull();
  // Focus returns to the Document a frame later, as with the other More formatting items.
  await waitFor(() =>
    expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Body" }))
  );
});

test("showing the marks leaves the value, onChange and the saved HTML alone", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  const { handle } = renderEditor({
    tools: [...TOOLS_WITH],
    defaultValue: CONTENT,
    onChange,
  });
  const before = handle.getHTML();

  await toggleByItem(user);
  expect(marks()).toEqual(SHOWN);
  expect(handle.getHTML()).toBe(before);
  expect(handle.getHTML()).not.toContain("tiptap-invisible-character");
  expect(handle.getMarkdown()).not.toContain("·");

  // An edit while the marks are shown: they follow the text, and the HTML still has none.
  act(() => void handle.editor!.chain().insertContentAt(4, " ").run());
  expect(marks().space).toBe(2);
  expect(handle.getHTML()).not.toContain("tiptap-invisible-character");

  await toggleByItem(user);
  // The only `onChange` comes from the inserted space, not from showing or hiding.
  await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
  expect(String(onChange.mock.calls[0]![0])).toBe(handle.getHTML());
  expect(String(onChange.mock.calls[0]![0])).not.toContain("invisible");
});

test("handle.tool().toggle() does the same as the item and reports success", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  const { handle } = renderEditor({ tools: [...TOOLS_WITH], defaultValue: CONTENT, onChange });
  const before = handle.getHTML();

  const commands = handle.tool("invisibleCharacters");
  expect(commands).not.toBeNull();

  let result = false;
  act(() => void (result = commands!.toggle()));
  expect(result).toBe(true);
  expect(marks()).toEqual(SHOWN);
  expect(await itemChecked(user)).toBe("true");

  act(() => void commands!.toggle());
  expect(marks()).toEqual(HIDDEN);
  expect(await itemChecked(user)).toBe("false");

  expect(handle.getHTML()).toBe(before);
  // `onChange` is deferred: give it time to arrive, in case toggling had called it.
  await act(() => new Promise((resolve) => setTimeout(resolve, 150)));
  expect(onChange).not.toHaveBeenCalled();
});

test("handle.tool() is null without the tool", () => {
  const { handle } = renderEditor({ tools: ["bold"] });
  expect(handle.tool("invisibleCharacters")).toBeNull();
});

test("the option visible: true shows the marks from the start", async () => {
  const user = userEvent.setup();
  renderEditor({
    tools: ["bold", tool("invisibleCharacters", { visible: true })],
    defaultValue: CONTENT,
  });
  expect(await itemChecked(user)).toBe("true");
  expect(marks()).toEqual(SHOWN);
});

test("the marks are hidden by default, including in the full preset", async () => {
  const user = userEvent.setup();
  renderEditor({ defaultValue: CONTENT });
  expect(await itemChecked(user)).toBe("false");
  expect(marks()).toEqual(HIDDEN);
});

test("an option that is not a boolean falls back to the default and warns in development", () => {
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  renderEditor({
    tools: ["bold", tool("invisibleCharacters", { visible: "yes" as never })],
    defaultValue: CONTENT,
  });
  expect(marks()).toEqual(HIDDEN);
  expect(error).toHaveBeenCalledWith(
    expect.stringContaining('tool "invisibleCharacters": ignored invalid options: visible')
  );
});

test("the state hook reports visible and follows the item and the command", async () => {
  const user = userEvent.setup();
  const seen: ({ visible: boolean } | null)[] = [];
  const handle = createRef<RichTextEditorHandle>();

  function Screen() {
    const state = useRichTextToolState(handle, "invisibleCharacters");
    seen.push(state);
    return (
      <>
        <output aria-label="visible">{String(state?.visible)}</output>
        <RichTextEditor
          ref={handle}
          aria-label="Body"
          tools={[...TOOLS_WITH]}
          defaultValue={CONTENT}
        />
      </>
    );
  }

  render(<Screen />);
  // The engine is created after the screen's first render: until then the hook is silent.
  expect(seen[0]).toBeNull();
  expect(seen.at(-1)).toEqual({ visible: false });

  await toggleByItem(user);
  expect(screen.getByLabelText("visible").textContent).toBe("true");

  act(() => void handle.current!.tool("invisibleCharacters")!.toggle());
  expect(screen.getByLabelText("visible").textContent).toBe("false");
});

test("the state hook is null when the tool is not in the set", () => {
  let state: unknown = "unset";
  function Screen() {
    const ref = useRef<RichTextEditorHandle>(null);
    state = useRichTextToolState(ref, "invisibleCharacters");
    return <RichTextEditor ref={ref} aria-label="Body" tools={["bold"]} />;
  }
  render(<Screen />);
  expect(state).toBeNull();
});

test("the item is in the fixed toolbar's «…» only: not floating, not bubble, not read-only", async () => {
  const user = userEvent.setup();
  // `strike`, so that the floating Toolbar and the Bubble menu have a More formatting button at all.
  const tools = [...TOOLS_WITH, "strike"] as const;

  for (const toolbar of ["floating", "bubble"] as const) {
    const { editor } = renderEditor({ toolbar, tools: [...tools], defaultValue: CONTENT });
    act(() => editor.view.focus());
    act(() => void editor.commands.setTextSelection({ from: 1, to: 4 }));
    const bar = await screen.findByRole("toolbar", {
      name: toolbar === "bubble" ? "Selection formatting" : "Formatting",
    });
    await user.click(within(bar).getByRole("button", MORE));
    const menu = screen.getByRole("menu", MORE);
    expect(itemIn(menu), toolbar).toBeNull();
    // The other More formatting items are in place.
    expect(within(menu).getByRole("menuitemcheckbox", { name: /^Strikethrough/ })).toBeDefined();
    cleanup();
  }

  for (const props of [{ toolbar: "none" }, { readOnly: true }] as const) {
    renderEditor({ ...props, tools: [...tools], defaultValue: CONTENT });
    expect(moreButton(), JSON.stringify(props)).toBeNull();
    cleanup();
  }
});

test("floating and bubble draw no empty «…» when the item is the only reason for it", async () => {
  for (const toolbar of ["floating", "bubble"] as const) {
    const { editor } = renderEditor({ toolbar, tools: [...TOOLS_WITH], defaultValue: CONTENT });
    act(() => editor.view.focus());
    act(() => void editor.commands.setTextSelection({ from: 1, to: 4 }));
    const bar = await screen.findByRole("toolbar", {
      name: toolbar === "bubble" ? "Selection formatting" : "Formatting",
    });
    expect(within(bar).queryByRole("button", MORE), toolbar).toBeNull();
    expect(within(bar).getByRole("button", { name: "Bold" })).toBeDefined();
    cleanup();
  }
});

test("the item needs the tool: not with basic, not without the name", async () => {
  const user = userEvent.setup();
  renderEditor({ preset: "basic" });
  expect(itemIn(await openMore(user))).toBeNull();
  cleanup();

  renderEditor({ tools: ["bold", "italic", "strike"] });
  expect(itemIn(await openMore(user))).toBeNull();
});

test("«…» is on the fixed toolbar when the item is the only reason for it", async () => {
  const user = userEvent.setup();
  renderEditor({ tools: [...TOOLS_WITH], defaultValue: CONTENT });

  expect(moreButton()).not.toBeNull();
  const menu = await openMore(user);
  expect(
    Array.from(menu.querySelectorAll('[role^="menuitem"]'), (node) => node.textContent)
  ).toEqual(["Invisible characters"]);

  await user.click(itemIn(menu)!);
  expect(marks()).toEqual(SHOWN);
});

test("the full preset includes the tool, the basic one does not", async () => {
  const user = userEvent.setup();
  expect(PRESETS.full).toContain("invisibleCharacters");
  expect(PRESETS.basic).not.toContain("invisibleCharacters");
  expect(RICH_TEXT_PRESETS.full).toContain("invisibleCharacters");
  expect(RICH_TEXT_PRESETS.basic).not.toContain("invisibleCharacters");
  expect(TOOLS).toContain("invisibleCharacters");

  renderEditor({ preset: "full" });
  expect(itemIn(await openMore(user))).not.toBeNull();
});

test("the item is reached from the keyboard and toggled with Enter and Space", async () => {
  const user = userEvent.setup();
  renderEditor({ tools: [...FULL_ALONE], defaultValue: CONTENT });

  moreButton()!.focus();
  await user.keyboard("{Enter}");
  const menu = screen.getByRole("menu", MORE);
  // `↑` from the start of the list goes to the end: the last item is "Invisible characters".
  await user.keyboard("{ArrowUp}");
  expect(document.activeElement).toBe(itemIn(menu));

  await user.keyboard("{Enter}");
  expect(marks()).toEqual(SHOWN);
  expect(screen.queryByRole("menu", MORE)).toBeNull();

  // Space toggles the same way as Enter.
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("textbox")));
  moreButton()!.focus();
  await user.keyboard("{Enter}");
  const again = await screen.findByRole("menu", MORE);
  await user.keyboard("{ArrowUp}");
  expect(itemIn(again)?.getAttribute("aria-checked")).toBe("true");
  await user.keyboard(" ");
  expect(marks()).toEqual(HIDDEN);
});

test("in HTML mode «…» is locked, the item cannot be reached and the command returns false", async () => {
  const user = userEvent.setup();
  const { handle } = renderEditor({ defaultValue: CONTENT });
  await user.click(screen.getByRole("button", { name: "HTML" }));

  expect(moreButton()?.getAttribute("aria-disabled")).toBe("true");
  await user.click(moreButton()!);
  expect(screen.queryByRole("menu", MORE)).toBeNull();
  expect(handle.tool("invisibleCharacters")!.toggle()).toBe(false);
  expect(marks()).toEqual(HIDDEN);

  await user.click(screen.getByRole("button", { name: "HTML" }));
  expect(moreButton()?.hasAttribute("aria-disabled")).toBe(false);
  expect(handle.tool("invisibleCharacters")!.toggle()).toBe(true);
  expect(marks()).toEqual(SHOWN);
});

test("a disabled field disables «…»", () => {
  renderEditor({ disabled: true, defaultValue: CONTENT });
  expect(moreButton()?.disabled).toBe(true);
});

test("the item name comes from the Russian catalog", async () => {
  const user = userEvent.setup();
  render(
    <UiProvider messages={ru}>
      <RichTextEditor aria-label="Body" tools={[...TOOLS_WITH]} />
    </UiProvider>
  );
  await user.click(screen.getByRole("button", { name: ru.editor.moreFormatting }));
  const menu = screen.getByRole("menu", { name: ru.editor.moreFormatting });
  expect(
    within(menu).getByRole("menuitemcheckbox", { name: ru.editor.invisibleCharacters })
  ).not.toBeNull();
  expect(ru.editor.invisibleCharacters).not.toBe("Invisible characters");
});

test("no style tag of the extension lands in the page head", () => {
  renderEditor({ tools: [...TOOLS_WITH], defaultValue: CONTENT });
  expect(
    document.querySelector("style[data-tiptap-extension-invisible-characters-style]")
  ).toBeNull();
});
