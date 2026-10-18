// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import type { Editor } from "@tiptap/react";
import { createRef } from "react";
import { afterEach, beforeAll, expect, test } from "vitest";
import { RichTextEditor, type RichTextEditorHandle } from "../src/editor/index.js";
import { loadLazyBuiltins } from "./editor-lazy-builtins.js";

beforeAll(loadLazyBuiltins);
afterEach(cleanup);

/**
 * The Block handle announces a group's result only when the Document changed (OLDSUI-307): a move
 * next to the footnote list is a no-op that the command still answers with `true`.
 */
const KEY = "aaaaaaa1";
const NOTES =
  '<section data-block="footnotes" role="doc-endnotes" aria-label="Footnotes"><ol>' +
  `<li id="fn-${KEY}"><p>Note one</p><a href="#fnref-${KEY}" role="doc-backlink">↩</a></li>` +
  "</ol></section>";
const DOC =
  `<p>First<sup data-footnote-ref="${KEY}"><a href="#fn-${KEY}" id="fnref-${KEY}" role="doc-noteref">1</a></sup></p>` +
  "<p>Second</p><p>Third</p>" +
  NOTES;

function renderEditor() {
  const ref = createRef<RichTextEditorHandle>();
  render(<RichTextEditor ref={ref} aria-label="Body" defaultValue={DOC} />);
  return ref.current!.editor!;
}

function selectAcross(editor: Editor, from: string, to: string) {
  let start = -1;
  let end = -1;
  editor.state.doc.descendants((node, pos) => {
    if (!node.isText) return;
    if (start < 0 && node.text === from) start = pos + 1;
    if (node.text === to) end = pos + node.nodeSize - 1;
  });
  act(() => {
    editor.view.focus();
    editor.commands.setTextSelection({ from: start, to: end });
  });
}

const announced = () => document.querySelector('[role="status"].sr-only')?.textContent ?? "";

async function item(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(screen.getByRole("button", { name: "Block actions" }));
  const menu = await screen.findByRole("menu", { name: "Block actions" });
  const found = Array.from(menu.querySelectorAll<HTMLElement>('[role^="menuitem"]')).find(
    (candidate) => candidate.textContent?.startsWith(name)
  );
  if (!found) throw new Error(`no item "${name}"`);
  return found;
}

test("Move down for a group just above the footnote list changes nothing and announces nothing", async () => {
  const user = userEvent.setup();
  const editor = renderEditor();
  selectAcross(editor, "Second", "Third");
  const before = editor.getHTML();

  await user.click(await item(user, "Move down"));

  expect(editor.getHTML()).toBe(before);
  expect(announced()).toBe("");
});

test("Move up for a group at the top is not offered, so nothing is announced", async () => {
  const user = userEvent.setup();
  const editor = renderEditor();
  selectAcross(editor, "First", "Second");

  const up = await item(user, "Move up");
  expect(up.getAttribute("aria-disabled")).toBe("true");
  await user.click(up);

  expect(announced()).toBe("");
});

test("Move up for a group that can move still announces the count", async () => {
  const user = userEvent.setup();
  const editor = renderEditor();
  selectAcross(editor, "Second", "Third");

  await user.click(await item(user, "Move up"));

  expect(announced()).toBe("Blocks moved: 2");
});
