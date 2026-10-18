// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import type { Editor } from "@tiptap/react";
import { createRef, useRef } from "react";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import { Dialog } from "../src/components/overlays/Dialog.js";
import { Drawer } from "../src/components/overlays/Drawer.js";
import { UiProvider } from "../src/i18n/UiProvider.js";
import { messages as ru } from "../src/locales/ru.js";
import {
  RichTextEditor,
  useRichTextToolState,
  type RichTextEditorHandle,
  type RichTextEditorProps,
} from "../src/editor/index.js";
import { BlockSelection } from "../src/editor/core/blockSelection.js";
import { PRESETS, TOOLS } from "../src/editor/core/tools.js";
import { loadLazyBuiltins } from "./editor-lazy-builtins.js";

beforeAll(loadLazyBuiltins);

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/**
 * Fullscreen mode (OLDSUI-312, ADR-0082): the `fullscreen` Tool. A layer of the kit over the whole
 * window, with the field's own DOM moved into it. Through the public `RichTextEditor` and its Handle:
 * the layer is a `role="dialog"` named "Fullscreen", `Esc` is a real `keydown`, the page is the rest
 * of the document. jsdom has no layout, no stylesheet and no animations, so how it looks (the column,
 * the Toolbar across the window, the fade) is for the browser checks.
 */
function renderEditor(props: Partial<RichTextEditorProps> = {}) {
  const ref = createRef<RichTextEditorHandle>();
  const view = render(
    <>
      <button type="button">Outside</button>
      <RichTextEditor ref={ref} aria-label="Body" tools={[...TOOLS]} {...props} />
    </>
  );
  const handle = ref.current;
  if (!handle?.editor) throw new Error("the editor was not created inside render()");
  return { ...view, handle, editor: handle.editor };
}

const LAYER = { name: "Fullscreen" } as const;
const RESIZER = { name: "Resize the editor" } as const;
const layer = () => screen.queryByRole("dialog", LAYER);
const status = () => document.querySelector('[role="status"].sr-only')?.textContent ?? "";
const THREE = "<p>One</p><p>Two</p><p>Three</p>";

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

const open = (handle: RichTextEditorHandle) => {
  let result = false;
  act(() => void (result = handle.tool("fullscreen")!.open()));
  return result;
};
const close = (handle: RichTextEditorHandle) => {
  let result = false;
  act(() => void (result = handle.tool("fullscreen")!.close()));
  return result;
};

// --- The layer ---------------------------------------------------------------------------------

test("open() expands the field into a layer over the window, close() puts it back", async () => {
  const { handle, container } = renderEditor({ defaultValue: THREE });
  expect(layer()).toBeNull();
  const inPlace = within(container).getByRole("textbox", { name: "Body" });

  expect(open(handle)).toBe(true);

  const dialog = layer()!;
  expect(dialog).not.toBeNull();
  // The field's DOM is in the layer, which is in a portal: not under the field's root any more.
  expect(within(dialog).getByRole("textbox", { name: "Body" })).toBe(inPlace);
  expect(within(dialog).getByRole("toolbar", { name: "Formatting" })).not.toBeNull();
  expect(container.contains(dialog)).toBe(false);
  expect(dialog.getAttribute("aria-modal")).toBe("true");

  expect(close(handle)).toBe(true);
  await waitFor(() => expect(layer()).toBeNull());
  expect(within(container).getByRole("textbox", { name: "Body" })).toBe(inPlace);
});

test("toggle() flips it, and answers false where open() is refused", async () => {
  const { handle } = renderEditor({ defaultValue: THREE });
  const commands = handle.tool("fullscreen")!;

  act(() => void commands.toggle());
  expect(layer()).not.toBeNull();
  // Open already: open() changes nothing.
  expect(open(handle)).toBe(false);
  act(() => void commands.toggle());
  await waitFor(() => expect(layer()).toBeNull());
  // Closed already: close() changes nothing.
  expect(close(handle)).toBe(false);
});

test("a disabled field and Source mode do not open the layer", async () => {
  const user = userEvent.setup();
  const disabled = renderEditor({ defaultValue: THREE, disabled: true });
  expect(open(disabled.handle)).toBe(false);
  expect(layer()).toBeNull();
  disabled.unmount();

  const { handle } = renderEditor({ defaultValue: THREE });
  await user.click(screen.getByRole("button", { name: "HTML" }));
  expect(open(handle)).toBe(false);
  expect(layer()).toBeNull();
});

test("a read-only field opens it too: reading a long text is the point", () => {
  const { handle } = renderEditor({ defaultValue: THREE, readOnly: true });

  expect(open(handle)).toBe(true);

  expect(layer()).not.toBeNull();
  // There is no fixed Toolbar in `readOnly`: "Collapse" sits in the layer's corner.
  expect(within(layer()!).getByRole("button", { name: "Exit fullscreen" })).not.toBeNull();
});

test("the page is locked while the layer is open, and released after", async () => {
  const { handle, unmount } = renderEditor({ defaultValue: THREE });
  expect(document.body.classList.contains("scroll-locked")).toBe(false);

  open(handle);
  expect(document.body.classList.contains("scroll-locked")).toBe(true);

  close(handle);
  await waitFor(() => expect(document.body.classList.contains("scroll-locked")).toBe(false));

  open(handle);
  expect(document.body.classList.contains("scroll-locked")).toBe(true);
  unmount();
  expect(document.body.classList.contains("scroll-locked")).toBe(false);
});

test("the layer is in the stack of ADR-0041 and above a Dialog's step", () => {
  const { handle } = renderEditor({ defaultValue: THREE });
  open(handle);

  // `OVERLAY_LAYER.alert`: above `modal` (the Dialog), below `popover` (the Editor's own popovers).
  expect(layer()!.className).toContain("z-100");
});

// --- Nothing is lost ---------------------------------------------------------------------------

test("it is the same engine: the history, the caret and the focus go through both ways", async () => {
  const { handle, editor } = renderEditor({ defaultValue: THREE });
  caretIn(editor, "Two");
  act(() => void editor.chain().insertContent("!").run());
  const typed = handle.getHTML();
  const caret = editor.state.selection.from;

  open(handle);
  expect(handle.editor).toBe(editor);
  expect(editor.state.selection.from).toBe(caret);
  expect(document.activeElement).toBe(editor.view.dom);
  expect(handle.getHTML()).toBe(typed);

  act(() => void editor.commands.undo());
  expect(handle.getHTML()).toBe(THREE);
  act(() => void editor.commands.redo());
  expect(handle.getHTML()).toBe(typed);

  close(handle);
  await waitFor(() => expect(layer()).toBeNull());
  expect(handle.editor).toBe(editor);
  expect(editor.state.selection.from).toBe(caret);
  expect(document.activeElement).toBe(editor.view.dom);
  act(() => void editor.commands.undo());
  expect(handle.getHTML()).toBe(THREE);
});

test("onFocus and onBlur do not fire: the layer is a part of the field", async () => {
  const onFocus = vi.fn();
  const onBlur = vi.fn();
  const { handle, editor } = renderEditor({ defaultValue: THREE, onFocus, onBlur });
  act(() => editor.view.focus());
  expect(onFocus).toHaveBeenCalledTimes(1);

  open(handle);
  await act(() => new Promise((resolve) => setTimeout(resolve, 30)));
  close(handle);
  await waitFor(() => expect(layer()).toBeNull());
  await act(() => new Promise((resolve) => setTimeout(resolve, 30)));

  expect(onFocus).toHaveBeenCalledTimes(1);
  expect(onBlur).not.toHaveBeenCalled();

  // And a real departure still counts.
  await userEvent.setup().click(screen.getByRole("button", { name: "Outside" }));
  await waitFor(() => expect(onBlur).toHaveBeenCalledTimes(1));
});

test("the value and onChange are not touched by the mode", async () => {
  const onChange = vi.fn();
  const { handle } = renderEditor({ defaultValue: THREE, onChange });

  open(handle);
  close(handle);
  await waitFor(() => expect(layer()).toBeNull());
  await act(() => new Promise((resolve) => setTimeout(resolve, 150)));

  expect(onChange).not.toHaveBeenCalled();
  expect(handle.getHTML()).toBe(THREE);
});

test("the change of mode is announced through the Field notice", async () => {
  const { handle } = renderEditor({ defaultValue: THREE });

  open(handle);
  await waitFor(() => expect(status()).toBe("Fullscreen mode on"));

  close(handle);
  await waitFor(() => expect(layer()).toBeNull());
  await waitFor(() => expect(status()).toBe("Fullscreen mode off"));
});

test("the strings speak the provider's language", async () => {
  const ref = createRef<RichTextEditorHandle>();
  render(
    <UiProvider messages={ru}>
      <RichTextEditor ref={ref} aria-label="Body" tools={[...TOOLS]} defaultValue={THREE} />
    </UiProvider>
  );
  act(() => void ref.current!.tool("fullscreen")!.open());

  const dialog = screen.getByRole("dialog", { name: ru.editor.fullscreen });
  expect(within(dialog).getByRole("button", { name: ru.editor.fullscreenExit })).not.toBeNull();
  await waitFor(() => expect(status()).toBe(ru.editor.fullscreenOpened));
});

test("maxHeight and resizable do not apply in the layer, and come back after it", async () => {
  const { handle } = renderEditor({
    defaultValue: THREE,
    maxHeight: 120,
    resizable: true,
  });
  const area = () => document.querySelector<HTMLElement>("[class*='overflow-y-auto']")!;
  expect(area().style.height || area().style.maxHeight).not.toBe("");
  expect(screen.queryByRole("slider", RESIZER)).not.toBeNull();

  open(handle);
  expect(area().style.height).toBe("");
  expect(area().style.maxHeight).toBe("");
  expect(screen.queryByRole("slider", RESIZER)).toBeNull();

  close(handle);
  await waitFor(() => expect(layer()).toBeNull());
  expect(area().style.height || area().style.maxHeight).not.toBe("");
});

// --- The ways in and out -----------------------------------------------------------------------

const MORE = { name: "More formatting" } as const;

test("the «…» item opens the layer, and the Toolbar's «Collapse» button closes it", async () => {
  const user = userEvent.setup();
  renderEditor({ defaultValue: THREE });

  await user.click(screen.getByRole("button", MORE));
  const item = within(screen.getByRole("menu", MORE)).getByRole("menuitemcheckbox", LAYER);
  expect(item.getAttribute("aria-checked")).toBe("false");
  await user.click(item);

  const dialog = await screen.findByRole("dialog", LAYER);
  // The visible button at the right edge of the Toolbar, after the shortcut reference.
  const toolbar = within(dialog).getByRole("toolbar", { name: "Formatting" });
  const names = Array.from(toolbar.querySelectorAll("button"), (node) =>
    node.getAttribute("aria-label")
  );
  expect(names.at(-1)).toBe("Exit fullscreen");

  await user.click(within(toolbar).getByRole("button", { name: "Exit fullscreen" }));
  await waitFor(() => expect(layer()).toBeNull());
  expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Body" }));
});

test("the «…» item inside the layer shows the mark and closes it", async () => {
  const user = userEvent.setup();
  const { handle } = renderEditor({ defaultValue: THREE });
  open(handle);

  await user.click(within(layer()!).getByRole("button", MORE));
  const item = within(screen.getByRole("menu", MORE)).getByRole("menuitemcheckbox", LAYER);
  expect(item.getAttribute("aria-checked")).toBe("true");
  await user.click(item);

  await waitFor(() => expect(layer()).toBeNull());
});

test("without a fixed Toolbar, «Collapse» is in the corner of the layer", async () => {
  const user = userEvent.setup();
  const { handle } = renderEditor({ defaultValue: THREE, toolbar: "none" });
  open(handle);

  const button = within(layer()!).getByRole("button", { name: "Exit fullscreen" });
  expect(within(layer()!).queryByRole("toolbar")).toBeNull();
  await user.click(button);

  await waitFor(() => expect(layer()).toBeNull());
});

test("the item is in the selection bubble's «…» menu too", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ toolbar: "bubble", defaultValue: THREE });
  act(() => {
    editor.view.focus();
    editor.commands.setTextSelection({ from: 2, to: 4 });
  });
  const bubble = await screen.findByRole("toolbar", { name: "Selection formatting" });

  await user.click(within(bubble).getByRole("button", MORE));
  await user.click(within(screen.getByRole("menu", MORE)).getByRole("menuitemcheckbox", LAYER));

  await screen.findByRole("dialog", LAYER);
});

test("State is { open }, and the hook follows both ways", async () => {
  const seen: (boolean | null)[] = [];
  function Probe() {
    const ref = useRef<RichTextEditorHandle>(null);
    seen.push(useRichTextToolState(ref, "fullscreen", (state) => state.open));
    return (
      <>
        <RichTextEditor ref={ref} aria-label="Body" tools={[...TOOLS]} defaultValue={THREE} />
        <button type="button" onClick={() => ref.current?.tool("fullscreen")?.toggle()}>
          Toggle
        </button>
      </>
    );
  }
  const user = userEvent.setup();
  render(<Probe />);
  expect(seen.at(-1)).toBe(false);

  await user.click(screen.getByRole("button", { name: "Toggle" }));
  expect(seen.at(-1)).toBe(true);
  // Inside the layer the page is outside the field, but the button is still reachable by a script.
  act(() => screen.getByRole("button", { name: "Toggle", hidden: true }).click());
  expect(seen.at(-1)).toBe(false);
  await waitFor(() => expect(layer()).toBeNull());
});

test("the Tool is in `full`, not in `basic`; without it there is no item and no Command", async () => {
  const user = userEvent.setup();
  expect(PRESETS.full).toContain("fullscreen");
  expect(PRESETS.basic).not.toContain("fullscreen");

  const { handle } = renderEditor({
    tools: PRESETS.full.filter((name) => name !== "fullscreen"),
    defaultValue: THREE,
  });
  await user.click(screen.getByRole("button", MORE));
  expect(within(screen.getByRole("menu", MORE)).queryByRole("menuitemcheckbox", LAYER)).toBeNull();
  expect(handle.tool("fullscreen")).toBeNull();
});

// --- Esc: one level at a time (ADR-0041, ADR-0077) ----------------------------------------------

test("Esc collapses the field", async () => {
  const user = userEvent.setup();
  const { handle } = renderEditor({
    tools: PRESETS.full.filter((name) => name !== "blockSelection"),
    defaultValue: THREE,
  });
  open(handle);
  expect(layer()).not.toBeNull();

  await user.keyboard("{Escape}");

  await waitFor(() => expect(layer()).toBeNull());
});

test("with blockSelection the first Esc selects the Block, the second clears it and collapses", async () => {
  const user = userEvent.setup();
  const { handle, editor } = renderEditor({ defaultValue: THREE });
  open(handle);
  caretIn(editor, "Two");

  await user.keyboard("{Escape}");
  expect(editor.state.selection).toBeInstanceOf(BlockSelection);
  expect(layer()).not.toBeNull();

  await user.keyboard("{Escape}");
  expect(editor.state.selection).not.toBeInstanceOf(BlockSelection);
  await waitFor(() => expect(layer()).toBeNull());
});

test("Esc in an open menu of the layer closes the menu and keeps the layer", async () => {
  const user = userEvent.setup();
  const { handle } = renderEditor({ defaultValue: THREE });
  open(handle);

  await user.click(within(layer()!).getByRole("button", MORE));
  expect(screen.getByRole("menu", MORE)).not.toBeNull();
  await user.keyboard("{Escape}");

  await waitFor(() => expect(screen.queryByRole("menu", MORE)).toBeNull());
  expect(layer()).not.toBeNull();
});

test("Esc in the Slash menu of the layer closes the menu and keeps the layer", async () => {
  const user = userEvent.setup();
  const { handle, editor } = renderEditor({
    tools: PRESETS.full.filter((name) => name !== "blockSelection"),
    defaultValue: "<p></p>",
  });
  open(handle);
  act(() => editor.view.focus());
  await user.keyboard("/");
  await screen.findByRole("listbox");

  await user.keyboard("{Escape}");

  await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
  expect(layer()).not.toBeNull();
});

test.each([
  [
    "Dialog",
    (onClose: () => void, child: React.ReactNode) => (
      <Dialog open onClose={onClose} title="Edit">
        {child}
      </Dialog>
    ),
  ],
  [
    "Drawer",
    (onClose: () => void, child: React.ReactNode) => (
      <Drawer open onClose={onClose} title="Edit">
        {child}
      </Drawer>
    ),
  ],
] as const)(
  "in a %s: Esc selects the Block, then collapses the field, then closes the window",
  async (_, wrap) => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const ref = createRef<RichTextEditorHandle>();
    render(
      wrap(
        onClose,
        <RichTextEditor ref={ref} aria-label="Body" tools={[...TOOLS]} defaultValue={THREE} />
      )
    );
    const editor = ref.current!.editor!;
    act(() => void ref.current!.tool("fullscreen")!.open());
    // The layer sits above the window, and the window is still there.
    expect(layer()).not.toBeNull();
    caretIn(editor, "Two");

    await user.keyboard("{Escape}");
    expect(editor.state.selection).toBeInstanceOf(BlockSelection);
    expect(layer()).not.toBeNull();
    expect(onClose).not.toHaveBeenCalled();

    await user.keyboard("{Escape}");
    await waitFor(() => expect(layer()).toBeNull());
    expect(onClose).not.toHaveBeenCalled();

    // The field is back in the window and holds focus; the next Esc is the window's own.
    await waitFor(() => expect(document.activeElement).toBe(editor.view.dom));
    await user.keyboard("{Escape}");
    expect(editor.state.selection).toBeInstanceOf(BlockSelection);
    expect(onClose).not.toHaveBeenCalled();
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  }
);

test("in a Dialog without blockSelection: the first Esc collapses the field, the next closes the window", async () => {
  const user = userEvent.setup();
  const onClose = vi.fn();
  const ref = createRef<RichTextEditorHandle>();
  render(
    <Dialog open onClose={onClose} title="Edit">
      <RichTextEditor
        ref={ref}
        aria-label="Body"
        tools={PRESETS.full.filter((name) => name !== "blockSelection")}
        defaultValue={THREE}
      />
    </Dialog>
  );
  act(() => void ref.current!.tool("fullscreen")!.open());

  await user.keyboard("{Escape}");
  await waitFor(() => expect(layer()).toBeNull());
  expect(onClose).not.toHaveBeenCalled();

  await user.keyboard("{Escape}");
  expect(onClose).toHaveBeenCalledTimes(1);
});

test("a click in the layer is not a click outside the Dialog around it", async () => {
  const user = userEvent.setup();
  const onClose = vi.fn();
  const ref = createRef<RichTextEditorHandle>();
  render(
    <Dialog open onClose={onClose} title="Edit">
      <RichTextEditor ref={ref} aria-label="Body" tools={[...TOOLS]} defaultValue={THREE} />
    </Dialog>
  );
  act(() => void ref.current!.tool("fullscreen")!.open());

  // A pointer press in the text (a `click` would reach ProseMirror's hit test, which jsdom lacks).
  fireEvent.pointerDown(within(layer()!).getByRole("textbox", { name: "Body" }));
  await user.click(within(layer()!).getByRole("button", { name: "Bold" }));

  expect(onClose).not.toHaveBeenCalled();
  expect(layer()).not.toBeNull();
});

test("the Insert table dialog opened from the layer is above it", async () => {
  const user = userEvent.setup();
  const { handle } = renderEditor({ defaultValue: THREE });
  open(handle);

  await user.click(within(layer()!).getByRole("button", { name: /^Table/ }));
  await user.click(await screen.findByRole("menuitem", { name: /Insert table/ }));

  const table = await screen.findByRole("dialog", { name: "Insert table" });
  expect(table.parentElement!.className).toContain("z-100");
  // Esc closes the dialog first: it is the top layer, the field stays expanded.
  await user.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "Insert table" })).toBeNull());
  expect(layer()).not.toBeNull();
});
