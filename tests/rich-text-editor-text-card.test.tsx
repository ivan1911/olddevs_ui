// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { createElement, createRef, type ReactElement } from "react";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import { Dialog } from "../src/components/overlays/Dialog.js";
import {
  RICH_TEXT_PRESETS,
  RichTextEditor,
  type CustomTool,
  type RichTextEditorHandle,
  type RichTextEditorProps,
} from "../src/editor/index.js";
import { UiProvider } from "../src/i18n/UiProvider.js";
import { resetDevWarnings } from "../src/lib/dev-warn.js";
import { messages as ru } from "../src/locales/ru.js";
import { testRemarkTool, testTopicTool } from "./editor-test-tools.js";
import { loadLazyBuiltins } from "./editor-lazy-builtins.js";

// Lazy `codeBlock` and `table` (OLDSUI-111): `full` is ready in `render` once the chunks load.
beforeAll(loadLazyBuiltins);

// The Text card loads lazily (`RichTextEditor.tsx`): the chunk is warmed up in advance,
// and `render` waits for it in `act`.
beforeAll(() => import("../src/editor/ui/TextCard.js"));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  resetDevWarnings();
});

/**
 * Text card (OLDSUI-113, ADR-0058, items 7.6–7.11).
 *
 * Through the public `RichTextEditor`, with the test Marks from the shared helper:
 * the roles, names, and text the author sees. The caret and the selection are set by
 * engine commands, since jsdom cannot handle input or layout. The Text card's position and
 * its flip at the window edge are measured by the browser (`tests-visual`).
 *
 * Document: "One |two three| four", a remark Mark on "two three" (5–14).
 */
const SAMPLE = '<p>One <span data-mark="test_remark">two three</span> four</p>';
const INSIDE = 8;
const OUTSIDE = 2;

/** `render` that waits for the lazy Text card. */
async function renderAsync(ui: ReactElement) {
  let view!: ReturnType<typeof render>;
  await act(async () => {
    view = render(ui);
  });
  return view;
}

async function renderEditor(props: Partial<RichTextEditorProps> = {}) {
  const ref = createRef<RichTextEditorHandle>();
  const view = await renderAsync(
    <RichTextEditor
      ref={ref}
      aria-label="Body"
      defaultValue={SAMPLE}
      tools={[...RICH_TEXT_PRESETS.full, testRemarkTool]}
      {...props}
    />
  );
  const editor = ref.current?.editor;
  if (!editor) throw new Error("the editor was not created inside render()");
  return { ...view, ref, editor };
}

type Engine = Awaited<ReturnType<typeof renderEditor>>["editor"];

/** Focus in the Document and the caret at the position. */
function caretAt(editor: Engine, pos: number) {
  act(() => {
    editor.view.focus();
    editor.commands.setTextSelection(pos);
  });
}

/** A shortcut in the document, the way the engine hears it: `keydown` on the editable area. */
function press(editor: Engine, init: KeyboardEventInit) {
  act(() => {
    editor.view.dom.dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init })
    );
  });
}

/**
 * A click on the Mark. A real `user.click` never reaches `click`: ProseMirror on `mousedown`
 * measures the position from the coordinates, and jsdom does not know them
 * (`elementFromPoint`). The caret in the editable field is placed by the browser's `mouseup`;
 * the test places it with a command, and sends `click` as an event itself.
 */
const markOf = (editor: Engine) =>
  editor.view.dom.querySelector('[data-mark="test_remark"]') as HTMLElement;
const clickMark = (editor: Engine) => act(() => void fireEvent.click(markOf(editor)));

const card = (name = "Remark") => screen.queryByRole("dialog", { name });

/** Focus is in the Document, not in the Toolbar or the Text card. */
const focusInDocument = (editor: Engine) => expect(document.activeElement).toBe(editor.view.dom);

// ── Opening ───────────────────────────────────────────────────────────────

test("the caret inside the range opens the card named after the entry; outside it closes", async () => {
  const { editor } = await renderEditor();
  expect(card()).toBeNull();

  caretAt(editor, INSIDE);
  expect(card()).not.toBeNull();
  expect(within(card()!).getByText(/^Remark \d+-\d+$/)).toBeDefined();

  caretAt(editor, OUTSIDE);
  expect(card()).toBeNull();
});

test("a click on the range opens the card; hovering does not", async () => {
  const user = userEvent.setup();
  const { editor } = await renderEditor();

  await user.hover(markOf(editor));
  expect(card()).toBeNull();

  // A click places the caret in the range (`mouseup`), and `click` finds it there.
  act(() => {
    editor.view.focus();
    editor.commands.setTextSelection(INSIDE);
  });
  clickMark(editor);
  expect(card()).not.toBeNull();
});

test("an expanded selection closes the card, a collapsed caret brings it back", async () => {
  const { editor } = await renderEditor();
  caretAt(editor, INSIDE);
  expect(card()).not.toBeNull();

  act(() => void editor.commands.setTextSelection({ from: 6, to: 12 }));
  expect(card()).toBeNull();

  act(() => void editor.commands.setTextSelection(INSIDE));
  expect(card()).not.toBeNull();
});

test("the card follows the range when the text before it changes", async () => {
  const { editor } = await renderEditor();
  caretAt(editor, INSIDE);
  expect(screen.getByText("Remark 5-14")).toBeDefined();

  act(() => editor.view.dispatch(editor.state.tr.insertText("abc", 1)));
  // An insertion before the range shifted it, and the caret moved with it.
  expect(screen.getByText("Remark 8-17")).toBeDefined();
});

test("typing inside the range keeps the card and the focus in the document", async () => {
  const { editor } = await renderEditor();
  caretAt(editor, INSIDE);
  expect(card()).not.toBeNull();

  act(() => void editor.commands.insertContent("xy"));
  expect(card()).not.toBeNull();
  expect(screen.getByText("Remark 5-16")).toBeDefined();
  focusInDocument(editor);
});

test("the card closes when its range disappears", async () => {
  const { editor } = await renderEditor();
  caretAt(editor, INSIDE);
  expect(card()).not.toBeNull();

  act(
    () => void editor.chain().setTextSelection({ from: 5, to: 14 }).unsetMark("test_remark").run()
  );
  act(() => void editor.commands.setTextSelection(INSIDE));
  expect(card()).toBeNull();
});

test("the card is a non-modal dialog: the document keeps the focus on open", async () => {
  const { editor } = await renderEditor();
  caretAt(editor, INSIDE);

  expect(card()?.getAttribute("aria-modal")).not.toBe("true");
  focusInDocument(editor);
});

// ── Several Text cards ────────────────────────────────────────────────────

const OVERLAP =
  '<p>One <span data-mark="test_topic">alpha <span data-mark="test_remark">beta</span> gamma</span> end</p>';

test("of overlapping ranges the narrowest opens", async () => {
  const { editor } = await renderEditor({
    defaultValue: OVERLAP,
    tools: [...RICH_TEXT_PRESETS.full, testTopicTool, testRemarkTool],
  });

  // "beta" (11–15) inside "alpha beta gamma" (5–22): the narrowest one is the remark.
  caretAt(editor, 13);
  expect(card("Remark")).not.toBeNull();
  expect(card("Topic")).toBeNull();

  caretAt(editor, 7);
  expect(card("Topic")).not.toBeNull();
  expect(card("Remark")).toBeNull();
});

test("of ranges of equal width the tool earlier in tools opens", async () => {
  const same =
    '<p>One <span data-mark="test_topic"><span data-mark="test_remark">same</span></span> end</p>';
  const first = await renderEditor({
    defaultValue: same,
    tools: [...RICH_TEXT_PRESETS.full, testTopicTool, testRemarkTool],
  });
  caretAt(first.editor, 7);
  expect(card("Topic")).not.toBeNull();
  expect(card("Remark")).toBeNull();
  first.unmount();

  const second = await renderEditor({
    defaultValue: same,
    tools: [...RICH_TEXT_PRESETS.full, testRemarkTool, testTopicTool],
  });
  caretAt(second.editor, 7);
  expect(card("Remark")).not.toBeNull();
  expect(card("Topic")).toBeNull();
});

// ── Keyboard and focus ────────────────────────────────────────────────────

test("Alt+F10 moves the focus into the open card, Escape returns the caret and hides it", async () => {
  const { editor } = await renderEditor();
  caretAt(editor, INSIDE);

  press(editor, { key: "F10", altKey: true });
  expect(card()!.contains(document.activeElement)).toBe(true);
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Reply" }));

  // Escape in the Text card: Radix listens on the document, and the top layer is the card.
  act(() => {
    document.activeElement!.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })
    );
  });
  expect(card()).toBeNull();
  focusInDocument(editor);
  // The caret stays where it was.
  expect(editor.state.selection.head).toBe(INSIDE);
});

test("Escape in the document hides the card until the caret leaves the range", async () => {
  const { editor } = await renderEditor();
  caretAt(editor, INSIDE);
  expect(card()).not.toBeNull();

  act(() => {
    editor.view.dom.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })
    );
  });
  expect(card()).toBeNull();

  // An edit inside the range, or a caret move within it, does not bring the card back…
  act(() => void editor.commands.insertContent("x"));
  caretAt(editor, 9);
  expect(card()).toBeNull();

  // …but leaving the range and coming back does.
  caretAt(editor, OUTSIDE);
  caretAt(editor, INSIDE);
  expect(card()).not.toBeNull();
});

test("close hides the card until the caret leaves; a click on the range opens it again", async () => {
  const user = userEvent.setup();
  const { editor } = await renderEditor();
  caretAt(editor, INSIDE);

  press(editor, { key: "F10", altKey: true });
  await user.click(screen.getByRole("button", { name: "Close" }));
  expect(card()).toBeNull();
  focusInDocument(editor);

  // The caret did not move, but a click on the range opens the card again.
  clickMark(editor);
  expect(card()).not.toBeNull();
});

test("while the card is hidden Alt+F10 leads to the toolbar", async () => {
  const { editor } = await renderEditor();
  caretAt(editor, INSIDE);

  // Open: Alt+F10 leads to the Text card.
  press(editor, { key: "F10", altKey: true });
  expect(card()!.contains(document.activeElement)).toBe(true);
  act(() => {
    document.activeElement!.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })
    );
  });
  expect(card()).toBeNull();

  // Hidden: the same key leads to the Toolbar.
  press(editor, { key: "F10", altKey: true });
  const toolbar = screen.getByRole("toolbar", { name: "Formatting" });
  expect(toolbar.contains(document.activeElement)).toBe(true);
});

test("Alt+F10 without an open card still leads to the toolbar", async () => {
  const { editor } = await renderEditor();
  caretAt(editor, OUTSIDE);

  press(editor, { key: "F10", altKey: true });
  expect(screen.getByRole("toolbar", { name: "Formatting" }).contains(document.activeElement)).toBe(
    true
  );
});

test("the card closes when the focus leaves the field", async () => {
  const user = userEvent.setup();
  const ref = createRef<RichTextEditorHandle>();
  await renderAsync(
    <>
      <RichTextEditor
        ref={ref}
        aria-label="Body"
        defaultValue={SAMPLE}
        tools={[...RICH_TEXT_PRESETS.full, testRemarkTool]}
      />
      <button type="button">Outside</button>
    </>
  );
  caretAt(ref.current!.editor!, INSIDE);
  expect(card()).not.toBeNull();

  await user.click(screen.getByRole("button", { name: "Outside" }));
  await waitFor(() => expect(card()).toBeNull());
});

test("inside a Dialog Escape closes the card first and the Dialog on the second press", async () => {
  const onClose = vi.fn();
  const ref = createRef<RichTextEditorHandle>();
  await renderAsync(
    <Dialog open onClose={onClose} title="Editing">
      <RichTextEditor
        ref={ref}
        aria-label="Body"
        defaultValue={SAMPLE}
        tools={[...RICH_TEXT_PRESETS.full, testRemarkTool]}
      />
    </Dialog>
  );
  const editor = ref.current!.editor!;
  caretAt(editor, INSIDE);
  expect(card()).not.toBeNull();

  act(() => {
    editor.view.dom.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })
    );
  });
  expect(card()).toBeNull();
  expect(onClose).not.toHaveBeenCalled();

  act(() => {
    editor.view.dom.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })
    );
  });
  expect(onClose).toHaveBeenCalledTimes(1);
});

// ── Screen reader and language ────────────────────────────────────────────

test("the appearance is announced with the entry label and the shortcut", async () => {
  const { editor } = await renderEditor();
  // The kit's live region, not the field message region: it is empty while there is no Text card.
  const regions = () => screen.getAllByRole("status").map((region) => region.textContent);
  expect(regions().join("")).toBe("");

  caretAt(editor, INSIDE);
  expect(regions()).toContain("Remark card opened. Press Alt+F10 to move into it.");

  caretAt(editor, OUTSIDE);
  expect(regions().join("")).toBe("");
});

test("in a Russian interface the label and the announcement come from the catalog", async () => {
  const ref = createRef<RichTextEditorHandle>();
  await renderAsync(
    <UiProvider locale="de-DE" messages={ru}>
      <RichTextEditor
        ref={ref}
        aria-label="Body"
        defaultValue={SAMPLE}
        tools={[...RICH_TEXT_PRESETS.full, testRemarkTool]}
      />
    </UiProvider>
  );
  caretAt(ref.current!.editor!, INSIDE);

  // The label is a function of the `UiProvider` locale: `de` gives "Anmerkung".
  expect(screen.getByRole("dialog", { name: "Anmerkung" })).toBeDefined();
  const spoken = ru.editor.textCardShown({ label: "Anmerkung", shortcut: "Alt+F10" });
  expect(screen.getAllByRole("status").map((region) => region.textContent)).toContain(spoken);
  // The phrase from the ru catalog is not English.
  expect(spoken).not.toMatch(/card opened/);
});

// ── Field modes ───────────────────────────────────────────────────────────

test("a readOnly field opens the card by a click", async () => {
  const user = userEvent.setup();
  const { editor } = await renderEditor({ readOnly: true });

  clickMark(editor);
  expect(card()).not.toBeNull();
  expect(screen.queryByRole("toolbar")).toBeNull();

  // A click on the text outside the range closes the card, and so does a click outside the field.
  clickMark(editor);
  expect(card()).not.toBeNull();
  await user.click(document.body);
  await waitFor(() => expect(card()).toBeNull());
});

test("a disabled field shows no card", async () => {
  const { editor } = await renderEditor({ disabled: true });
  act(() => void editor.commands.setTextSelection(INSIDE));
  expect(card()).toBeNull();
});

test("HTML mode shows no card", async () => {
  const user = userEvent.setup();
  const { editor } = await renderEditor();
  caretAt(editor, INSIDE);
  expect(card()).not.toBeNull();

  await user.click(screen.getByRole("button", { name: "HTML" }));
  expect(card()).toBeNull();
});

test("a tool left out of tools takes its card with it", async () => {
  const { editor } = await renderEditor({ tools: [...RICH_TEXT_PRESETS.full] });
  act(() => void editor.commands.setTextSelection(INSIDE));
  expect(card()).toBeNull();
  expect(screen.queryByRole("status", { name: "" })?.textContent ?? "").not.toMatch(/card opened/);
});

// ── Typing check ──────────────────────────────────────────────────────────

test("a card without rangeAt or render fails the field, not the page", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const broken: CustomTool = {
    ...testRemarkTool,
    textCards: [{ label: "Remark", render: () => createElement("div") } as never],
  };
  render(
    <RichTextEditor
      aria-label="Body"
      defaultValue={SAMPLE}
      tools={[...RICH_TEXT_PRESETS.full, broken]}
    />
  );
  expect(screen.getByRole("alert").textContent).toMatch(/couldn't start/);
});

test("a rangeAt that throws or lies does not break the field", async () => {
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  const lying: CustomTool = {
    ...testRemarkTool,
    textCards: [
      {
        label: "Throws",
        rangeAt: () => {
          throw new Error("boom");
        },
        render: () => createElement("div"),
      },
      {
        label: "Reversed",
        rangeAt: () => ({ from: 9, to: 3 }),
        render: () => createElement("div"),
      },
      {
        label: "Beyond",
        rangeAt: () => ({ from: 0, to: 9999 }),
        render: () => createElement("div"),
      },
    ],
  };
  const { editor } = await renderEditor({ tools: [...RICH_TEXT_PRESETS.full, lying] });
  caretAt(editor, INSIDE);

  expect(screen.queryAllByRole("dialog")).toHaveLength(0);
  // The exception goes to the developer as a separate argument: the text stays the key,
  // warned about once.
  expect(error).toHaveBeenCalledWith(
    expect.stringMatching(/^RichTextEditor: text card "test_remark-textCard0" threw in rangeAt$/),
    expect.objectContaining({ message: "boom" })
  );
  // The field is alive.
  act(() => void editor.commands.insertContent("x"));
  expect(editor.getText()).toContain("x");
});
