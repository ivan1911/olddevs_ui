// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { createRef } from "react";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import { RichTextEditor, type RichTextEditorHandle } from "../src/editor/index.js";
import { loadLazyBuiltins } from "./editor-lazy-builtins.js";

beforeAll(loadLazyBuiltins);

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/**
 * The Block handle right after a menu action (OLDSUI-311, a flaky `rich-text-editor-block-range`).
 * An action returns focus to the Document with Tiptap's `focus()`, which waits for an animation
 * frame. The handle is shown while the Document has focus, so in that frame it used to disappear
 * and come back: a flicker for the eye, and a race for a test that looks for the handle at once.
 * The frame is held back here, so the gap is the whole test, not a matter of timing.
 */
test("the handle stays on screen between a menu action and the frame that refocuses the Document", async () => {
  const user = userEvent.setup();
  const ref = createRef<RichTextEditorHandle>();
  render(<RichTextEditor ref={ref} aria-label="Body" defaultValue="<p>One</p><p>Two</p>" />);
  const editor = ref.current!.editor!;
  act(() => {
    editor.view.focus();
    editor.commands.setTextSelection(2);
  });
  await user.click(screen.getByRole("button", { name: "Block actions" }));
  const menu = await screen.findByRole("menu", { name: "Block actions" });

  // From here no frame runs: the refocus of the Document is pending.
  vi.stubGlobal("requestAnimationFrame", () => 0);
  await user.click(within(menu).getByRole("menuitem", { name: /^Move down/ }));

  expect(editor.getHTML()).toBe("<p>Two</p><p>One</p>");
  expect(screen.queryByRole("button", { name: "Block actions" })).not.toBeNull();
});
