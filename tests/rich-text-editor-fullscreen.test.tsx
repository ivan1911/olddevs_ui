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

// --- Table column handles work in the layer ------------------------------------------------

test("the column handles of a table are mounted in the layer and find their bars", async () => {
  // jsdom has no layout: every cell is 100 x 20 px from the frame's corner, as in the handle's own test.
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
    this: HTMLElement
  ) {
    const box = (left: number, top: number, width: number, height: number) =>
      ({ left, top, width, height, right: left + width, bottom: top + height }) as DOMRect;
    if (this.tagName === "TD") {
      const row = this.parentElement!;
      return box(Array.from(row.children).indexOf(this) * 100, 0, 100, 20);
    }
    if (this.tagName === "TABLE") return box(0, 0, 300, 20);
    return box(0, 0, 0, 0);
  });
  const { handle, editor } = renderEditor({
    defaultValue:
      "<table><tbody><tr><td><p>a</p></td><td><p>b</p></td><td><p>c</p></td></tr></tbody></table>",
  });
  open(handle);
  caretIn(editor, "b");

  const handles = layer()!.querySelector("[data-table-column-handles]");
  expect(handles).not.toBeNull();
  // The bars are measured against the layer's own frame: two boundaries of three columns.
  await waitFor(() => expect(handles!.querySelectorAll("[data-column-handle]")).toHaveLength(2));
  // The handles sit in the Document area that scrolls, next to the Block handle, not in the page.
  expect(handles!.parentElement!.className).toContain("overflow-y-auto");
});

// --- The page behind is hidden from assistive technology ----------------------------------

test("everything outside the layer is aria-hidden while it is open, and restored after", async () => {
  const { handle, container } = renderEditor({ defaultValue: THREE });
  const sibling = document.createElement("div");
  document.body.append(sibling);
  expect(container.getAttribute("aria-hidden")).toBeNull();

  open(handle);

  expect(layer()!.getAttribute("aria-modal")).toBe("true");
  expect(container.getAttribute("aria-hidden")).toBe("true");
  expect(sibling.getAttribute("aria-hidden")).toBe("true");
  // The layer itself and its popovers are not hidden: the menu opens in a portal made later.
  expect(layer()!.closest("[aria-hidden=true]")).toBeNull();

  close(handle);
  await waitFor(() => expect(layer()).toBeNull());
  expect(container.getAttribute("aria-hidden")).toBeNull();
  expect(sibling.getAttribute("aria-hidden")).toBeNull();
  sibling.remove();
});

test("a live region outside the layer stays audible", () => {
  const { handle } = renderEditor({ defaultValue: THREE });
  const toast = document.createElement("div");
  toast.setAttribute("aria-live", "polite");
  document.body.append(toast);

  open(handle);

  expect(toast.getAttribute("aria-hidden")).toBeNull();
  toast.remove();
});

test("in a Dialog the window's content is hidden by the layer and comes back with it", async () => {
  const ref = createRef<RichTextEditorHandle>();
  render(
    <Dialog open onClose={() => {}} title="Edit">
      <RichTextEditor ref={ref} aria-label="Body" tools={[...TOOLS]} defaultValue={THREE} />
    </Dialog>
  );
  const dialog = screen.getByRole("dialog", { name: "Edit" });
  const portal = dialog.closest("body > *") as HTMLElement;
  expect(portal.getAttribute("aria-hidden")).toBeNull();

  act(() => void ref.current!.tool("fullscreen")!.open());
  expect(portal.getAttribute("aria-hidden")).toBe("true");
  expect(layer()!.closest("[aria-hidden=true]")).toBeNull();

  act(() => void ref.current!.tool("fullscreen")!.close());
  await waitFor(() => expect(layer()).toBeNull());
  expect(portal.getAttribute("aria-hidden")).toBeNull();
  // The Dialog is as it was, with its own modality.
  expect(screen.getByRole("dialog", { name: "Edit" })).toBe(dialog);
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

// --- Focus stays in the layer -----------------------------------------------------------------

/** Presses Tab (or Shift+Tab) `times` times and returns the element that held focus after each press. */
async function tabPath(user: ReturnType<typeof userEvent.setup>, times: number, back = false) {
  const path: (Element | null)[] = [];
  for (let i = 0; i < times; i += 1) {
    await user.tab({ shift: back });
    path.push(document.activeElement);
  }
  return path;
}

test.each([
  ["page", (child: React.ReactNode) => child],
  [
    "Dialog",
    (child: React.ReactNode) => (
      <Dialog open onClose={() => {}} title="Edit">
        {child}
      </Dialog>
    ),
  ],
  [
    "Drawer",
    (child: React.ReactNode) => (
      <Drawer open onClose={() => {}} title="Edit">
        {child}
      </Drawer>
    ),
  ],
] as const)(
  "in a %s: Tab and Shift+Tab loop inside the layer and never reach the page",
  async (_, wrap) => {
    const user = userEvent.setup();
    const ref = createRef<RichTextEditorHandle>();
    render(
      wrap(<RichTextEditor ref={ref} aria-label="Body" tools={[...TOOLS]} defaultValue={THREE} />)
    );
    act(() => void ref.current!.tool("fullscreen")!.open());
    const root = layer()!;
    await waitFor(() => expect(root.contains(document.activeElement)).toBe(true));

    // Far more presses than the layer has stops: the path has to come round to where it started.
    const forward = await tabPath(user, 60);
    expect(forward.every((element) => element && root.contains(element))).toBe(true);
    const first = forward[0]!;
    expect(forward.slice(1).includes(first)).toBe(true);

    const backward = await tabPath(user, 60, true);
    expect(backward.every((element) => element && root.contains(element))).toBe(true);
    expect(backward.slice(1).includes(backward[0]!)).toBe(true);
  }
);

test("Tab from the last stop lands on the first one, and Shift+Tab from the first on the last", async () => {
  const user = userEvent.setup();
  const { handle } = renderEditor({ defaultValue: THREE });
  open(handle);
  const root = layer()!;
  await waitFor(() => expect(root.contains(document.activeElement)).toBe(true));

  // Walk to the wrap: the first element seen again is the first stop, the one before it the last.
  const path = await tabPath(user, 60);
  const seenAgain = path.findIndex((element, index) => path.indexOf(element) < index);
  expect(seenAgain).toBeGreaterThan(0);
  const first = path[path.indexOf(path[seenAgain]!)]!;
  const last = path[seenAgain - 1]!;

  (first as HTMLElement).focus();
  await user.tab({ shift: true });
  expect(document.activeElement).toBe(last);
  await user.tab();
  expect(document.activeElement).toBe(first);
});

test("the page behind the layer is inert while it is open, and as it was after", async () => {
  const { handle, container } = renderEditor({ defaultValue: THREE });
  const toast = document.createElement("div");
  toast.setAttribute("role", "status");
  const stale = document.createElement("div");
  stale.setAttribute("inert", "");
  document.body.append(toast, stale);

  open(handle);
  expect(container.hasAttribute("inert")).toBe(true);
  expect(layer()!.closest("[inert]")).toBeNull();
  // A live region stays reachable and audible.
  expect(toast.hasAttribute("inert")).toBe(false);

  close(handle);
  await waitFor(() => expect(layer()).toBeNull());
  expect(container.hasAttribute("inert")).toBe(false);
  // What was inert before is not ours to restore.
  expect(stale.hasAttribute("inert")).toBe(true);
  toast.remove();
  stale.remove();
});

test("focus that lands in the page behind the layer is sent back into it", async () => {
  const { handle } = renderEditor({ defaultValue: THREE });
  open(handle);
  const root = layer()!;
  const bold = within(root).getByRole("button", { name: "Bold" });
  act(() => bold.focus());
  expect(document.activeElement).toBe(bold);

  // An engine without `inert`, or a script: the page's own control takes focus.
  act(() => screen.getByRole("button", { name: "Outside", hidden: true }).focus());

  expect(root.contains(document.activeElement)).toBe(true);
  expect(document.activeElement).toBe(bold);
});

test("Tab from <body> (after a click on a bare patch of the layer) stays in the layer", async () => {
  const user = userEvent.setup();
  const { handle } = renderEditor({ defaultValue: THREE });
  open(handle);
  const root = layer()!;
  act(() => (document.activeElement as HTMLElement | null)?.blur());
  expect(document.activeElement).toBe(document.body);

  const path = await tabPath(user, 3);
  expect(path.every((element) => element && root.contains(element))).toBe(true);
});

// --- The app shell does not reach into the layer ----------------------------------------------

test("the layer overrides --topbar-h: the Toolbar sticks to the window, not under the app's bar", () => {
  const ref = createRef<RichTextEditorHandle>();
  render(
    <div style={{ "--topbar-h": "56px" } as React.CSSProperties} data-testid="app">
      <RichTextEditor ref={ref} aria-label="Body" tools={[...TOOLS]} defaultValue={THREE} />
    </div>
  );
  // In the page the Toolbar reads the bar the app (its `TopBar`) publishes.
  expect(getComputedStyle(screen.getByTestId("app")).getPropertyValue("--topbar-h")).toBe("56px");

  act(() => void ref.current!.tool("fullscreen")!.open());

  // The layer is portaled to <body>, but a portal inside a themed subtree would inherit the value
  // all the same, so the layer says its own: the whole window is the layer's, there is no bar above.
  expect(getComputedStyle(layer()!).getPropertyValue("--topbar-h")).toBe("0px");
});
