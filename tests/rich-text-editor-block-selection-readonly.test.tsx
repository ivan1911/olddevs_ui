// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { createRef } from "react";
import { afterEach, beforeAll, beforeEach, expect, test } from "vitest";
import {
  RichTextEditor,
  type RichTextEditorHandle,
  type RichTextEditorProps,
} from "../src/editor/index.js";
import { BlockSelection } from "../src/editor/core/blockSelection.js";
import { TOOLS } from "../src/editor/core/tools.js";
import { loadLazyBuiltins } from "./editor-lazy-builtins.js";

beforeAll(loadLazyBuiltins);
afterEach(cleanup);

/**
 * Block selection in a read-only field (ADR-0077, decision 13): a read-only Document has no
 * `tabindex` of its own, so without one it could never hold the keyboard focus that `Esc` and
 * `Shift+↑/↓` need. The Tool makes it focusable; a disabled field stays out of the Tab order.
 * Real clicks and keys through `userEvent`, not events dispatched on the Document.
 */
const THREE = "<p>One</p><p>Two</p><p>Three</p>";

function renderEditor(props: Partial<RichTextEditorProps> = {}) {
  const ref = createRef<RichTextEditorHandle>();
  const view = render(
    <RichTextEditor
      ref={ref}
      aria-label="Body"
      tools={[...TOOLS]}
      defaultValue={THREE}
      {...props}
    />
  );
  return { ...view, editor: ref.current!.editor! };
}

/** jsdom has no layout: the engine's own mouse handling asks where a point is, and finds nothing. */
beforeEach(() => {
  (document as unknown as { elementFromPoint: () => null }).elementFromPoint = () => null;
});
afterEach(
  () => void delete (document as unknown as { elementFromPoint?: () => null }).elementFromPoint
);

const count = (editor: { state: { selection: unknown } }) =>
  editor.state.selection instanceof BlockSelection ? editor.state.selection.count : 0;

test("a read-only Document is focusable, and a click into it focuses it", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ readOnly: true });

  expect(editor.view.dom.tabIndex).toBe(0);
  await user.click(screen.getByText("Two"));

  expect(document.activeElement).toBe(editor.view.dom);
});

test("in a read-only field a click, Esc and Shift+Down select and extend Blocks", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ readOnly: true });

  await user.click(screen.getByText("One"));
  await user.keyboard("{Escape}");
  expect(count(editor)).toBe(1);

  await user.keyboard("{Shift>}{ArrowDown}{/Shift}");
  expect(count(editor)).toBe(2);
  expect(editor.getHTML()).toBe(THREE);
});

test("a read-only Document is in the Tab order", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ readOnly: true });

  await user.tab();

  expect(document.activeElement).toBe(editor.view.dom);
});

test("a disabled field has no tabindex, and an editable one keeps the engine's own", () => {
  const disabled = renderEditor({ disabled: true });
  expect(disabled.editor.view.dom.hasAttribute("tabindex")).toBe(false);
  disabled.unmount();

  const editable = renderEditor();
  expect(editable.editor.view.dom.getAttribute("tabindex")).toBe("0");
});

test("the Document becomes focusable when the field turns read-only, and not when it is disabled", () => {
  const { editor, rerender } = renderEditor();
  const render_ = (props: Partial<RichTextEditorProps>) =>
    rerender(
      <RichTextEditor aria-label="Body" tools={[...TOOLS]} defaultValue={THREE} {...props} />
    );

  render_({ readOnly: true });
  expect(editor.view.dom.tabIndex).toBe(0);

  render_({ disabled: true });
  expect(editor.view.dom.hasAttribute("tabindex")).toBe(false);

  render_({});
  expect(editor.view.dom.getAttribute("tabindex")).toBe("0");
});

test("without the Tool a read-only Document is not in the Tab order", () => {
  const { editor } = renderEditor({ readOnly: true, tools: ["bold"] });

  expect(editor.view.dom.hasAttribute("tabindex")).toBe(false);
});
