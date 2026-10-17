// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { createRef } from "react";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
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
  vi.unstubAllGlobals();
});

/**
 * The floating Toolbar (OLDSUI-42): above a non-empty selection, and on touch
 * screens it is fixed, so that it does not compete with the system selection menu.
 *
 * Selection and focus are set by engine commands (`ref.editor`): jsdom cannot select
 * with the mouse or the keyboard. Focus is `view.focus()`, not the
 * `focus()` command, which sets it in the next frame.
 */
function renderEditor(props: Partial<RichTextEditorProps> = {}) {
  const ref = createRef<RichTextEditorHandle>();
  const view = render(
    <RichTextEditor
      ref={ref}
      aria-label="Body"
      toolbar="floating"
      defaultValue="<p>Hello world</p>"
      {...props}
    />
  );
  const editor = ref.current?.editor;
  if (!editor) throw new Error("the editor was not created inside render()");
  act(() => editor.view.focus());
  return { ...view, ref, editor };
}

test("the floating toolbar appears over a non-empty selection only", async () => {
  const { editor } = renderEditor();

  act(() => void editor.commands.setTextSelection(3));
  expect(screen.queryByRole("toolbar", { name: "Formatting" })).toBeNull();

  act(() => void editor.commands.setTextSelection({ from: 1, to: 6 }));
  const toolbar = await screen.findByRole("toolbar", { name: "Formatting" });
  expect(toolbar.querySelector('[aria-label="Bold"]')).not.toBeNull();

  act(() => void editor.commands.setTextSelection(3));
  await waitFor(() => expect(screen.queryByRole("toolbar", { name: "Formatting" })).toBeNull());
});

/** A touch screen: `matchMedia("(pointer: coarse)")` matches, and the change is reported. */
function stubPointer(initial: "coarse" | "fine") {
  let coarse = initial === "coarse";
  const listeners = new Set<() => void>();
  vi.stubGlobal(
    "matchMedia",
    (query: string) =>
      ({
        get matches() {
          return query === "(pointer: coarse)" && coarse;
        },
        media: query,
        addEventListener: (_: string, listener: () => void) => listeners.add(listener),
        removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
      }) as unknown as MediaQueryList
  );
  return {
    switchTo(next: "coarse" | "fine") {
      coarse = next === "coarse";
      act(() => listeners.forEach((listener) => listener()));
    },
  };
}

test("on a touch screen the floating toolbar falls back to the fixed one, and back", async () => {
  const pointer = stubPointer("coarse");
  const { editor } = renderEditor();

  // The fixed Toolbar is visible without a selection: that is the exception.
  act(() => void editor.commands.setTextSelection(3));
  expect(screen.getByRole("toolbar", { name: "Formatting" })).toBeDefined();

  pointer.switchTo("fine");
  expect(screen.queryByRole("toolbar", { name: "Formatting" })).toBeNull();
  act(() => void editor.commands.setTextSelection({ from: 1, to: 6 }));
  expect(await screen.findByRole("toolbar", { name: "Formatting" })).toBeDefined();
});

/** `Alt+F10` in the Document, the way the engine hears it. */
function pressAltF10(editor: RichTextEditorHandle["editor"]) {
  act(() => {
    editor!.view.dom.dispatchEvent(
      new KeyboardEvent("keydown", { key: "F10", altKey: true, bubbles: true, cancelable: true })
    );
  });
}

test("Alt+F10 moves focus from the selection into the floating toolbar, Shift+Tab back", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ preset: "basic" });
  act(() => void editor.commands.setTextSelection({ from: 1, to: 6 }));

  // Immediately, without waiting for the show delay: the keyboard shows the Toolbar by itself.
  pressAltF10(editor);
  const toolbar = screen.getByRole("toolbar", { name: "Formatting" });
  // The first button of the `basic` Toolbar is Bold: '¶' is not shown for a lone 'Text'
  // (OLDSUI-154), and Italic follows Bold.
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Bold" }));
  expect(toolbar.getAttribute("aria-keyshortcuts")).toBe("Alt+F10");

  await user.keyboard("{ArrowRight}");
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Italic" }));
  await user.keyboard("{ArrowLeft}{Enter}");
  expect(editor.getHTML()).toBe("<p><strong>Hello</strong> world</p>");
  // The action returns focus to the Document, to the same selection (in the next frame).
  await waitFor(() => expect(document.activeElement).toBe(editor.view.dom));

  pressAltF10(editor);
  await user.tab({ shift: true });
  expect(document.activeElement).toBe(editor.view.dom);
  expect(editor.state.selection.from).toBe(1);
  expect(editor.state.selection.to).toBe(6);
});

test("Alt+F10 reaches the fixed toolbar too, and does nothing without a toolbar", () => {
  const { editor } = renderEditor({ toolbar: "fixed", preset: "basic" });

  pressAltF10(editor);
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Bold" }));
  cleanup();

  const without = renderEditor({ toolbar: "none" });
  pressAltF10(without.editor);
  expect(document.activeElement).toBe(without.editor.view.dom);
});
