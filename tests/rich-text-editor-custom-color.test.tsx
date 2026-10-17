// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { createRef } from "react";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import { ModalOverlay } from "../src/components/overlays/ModalOverlay.js";
import { RichTextEditor, type RichTextEditorHandle } from "../src/editor/index.js";
import { contrastRatio } from "../src/editor/features/color/contrast.js";
import { UiProvider } from "../src/i18n/UiProvider.js";
import { messages as ru } from "../src/locales/ru.js";
import { loadLazyBuiltins } from "./editor-lazy-builtins.js";

// Lazy `codeBlock` and `table` (OLDSUI-111): `full` is ready in `render` after the chunks load.
beforeAll(loadLazyBuiltins);

/*
  A `CSS.escape` shim, the same as in `color-picker.test.tsx`: the react-aria popover
  calls it on open, and jsdom has no `CSS` object.
*/
if (typeof globalThis.CSS === "undefined")
  (globalThis as unknown as { CSS: { escape: (v: string) => string } }).CSS = {
    escape: (value: string) => String(value).replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`),
  };

afterEach(cleanup);

/**
 * Custom color through the kit's `ColorPicker` (OLDSUI-46, addendum): the
 * 'Custom color…' item in each grid of the 'Color' popover (OLDSUI-153) opens a popover with a color picker,
 * applying it and a contrast warning. Checked through `RichTextEditor`:
 * the way a person does it, not through internals.
 *
 * 'Color' is in the Bubble menu (OLDSUI-154): the bubble shows up over a non-empty
 * selection while the Document has focus, so the selection is set with focus.
 */
function renderEditor(html = "<p>Hello world</p>", props: Record<string, unknown> = {}) {
  const ref = createRef<RichTextEditorHandle>();
  render(<RichTextEditor ref={ref} aria-label="Body" defaultValue={html} {...props} />);
  const editor = ref.current!.editor!;
  selectHello(editor);
  return editor;
}

/** Select 'Hello' with focus in the Document: this is what opens the Bubble menu. */
function selectHello(editor: NonNullable<RichTextEditorHandle["editor"]>) {
  act(() => {
    editor.view.focus();
    editor.commands.setTextSelection({ from: 1, to: 6 });
  });
}

/** The Bubble menu: it has the 'Color' button (OLDSUI-154). */
const bubble = () => screen.findByRole("toolbar", { name: "Selection formatting" });

/** A theme in jsdom is the values that `prose.ts` puts into `--rte-*` on the Document. */
function theme(editor: NonNullable<RichTextEditorHandle["editor"]>, bg: string, fg: string) {
  editor.view.dom.style.setProperty("--rte-background", bg);
  editor.view.dom.style.setProperty("--rte-foreground", fg);
}

type Kind = "text" | "highlight";
const SECTION: Record<Kind, string> = { text: "Text color", highlight: "Highlight color" };

/** The 'Color' popover (OLDSUI-153) of the Bubble menu › the grid of the required kind. */
async function openColorGrid(user: ReturnType<typeof userEvent.setup>, kind: Kind) {
  await user.click(within(await bubble()).getByRole("button", { name: /^Color:/ }));
  const menu = await screen.findByRole("menu", { name: "Color" });
  return within(menu).getByRole("group", { name: SECTION[kind] });
}

/** 'Color' › 'Custom color…' of the required grid → the color picker popover. */
async function openCustom(kind: Kind, popoverName: string) {
  const user = userEvent.setup();
  const grid = await openColorGrid(user, kind);
  await user.click(within(grid).getByRole("menuitemradio", { name: "Custom color…" }));
  const popover = await screen.findByRole("dialog", { name: popoverName });
  return { user, popover };
}

/** The author's color is checked: 'Custom color…' of the required grid has `aria-checked`. */
async function expectCustomChecked(user: ReturnType<typeof userEvent.setup>, kind: Kind) {
  const grid = await openColorGrid(user, kind);
  expect(
    within(grid).getByRole("menuitemradio", { name: "Custom color…" }).getAttribute("aria-checked")
  ).toBe("true");
  await user.keyboard("{Escape}");
}

/** Opens the color picker and types the value into the HEX field, the way a person does it. */
async function typeHex(user: ReturnType<typeof userEvent.setup>, hex: string) {
  await user.click(screen.getByRole("button", { name: /^Color #/ }));
  const field = await screen.findByRole("textbox", { name: "HEX" });
  await user.clear(field);
  await user.type(field, `${hex}{Enter}`);
  await user.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("textbox", { name: "HEX" })).toBeNull());
}

test("both colour grids carry Custom color…", async () => {
  const user = userEvent.setup();
  renderEditor();

  // Palettes of different lengths: six tones and nine markers; removing is an icon (OLDSUI-160).
  for (const [kind, length] of [
    ["text", 6],
    ["highlight", 9],
  ] as const) {
    const grid = await openColorGrid(user, kind);
    // The swatches and 'Custom color…' are options of one choice.
    expect(within(grid).getAllByRole("menuitemradio"), kind).toHaveLength(length + 1);
    expect(within(grid).getByRole("menuitemradio", { name: "Custom color…" })).toBeDefined();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
  }
});

test("a custom text colour is applied from the popover as style on a span", async () => {
  const editor = renderEditor();
  const { user, popover } = await openCustom("text", "Custom text color");

  await typeHex(user, "#00AA55");
  await user.click(within(popover).getByRole("button", { name: "Apply" }));

  expect(editor.getHTML()).toBe('<p><span style="color:#00aa55">Hello</span> world</p>');
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  // The author's color is checked on 'Custom color…' of the text grid.
  await expectCustomChecked(user, "text");
});

test("a custom highlight is applied from the popover as style on a mark", async () => {
  const editor = renderEditor();
  const { user, popover } = await openCustom("highlight", "Custom highlight color");

  await typeHex(user, "#FFE066");
  await user.click(within(popover).getByRole("button", { name: "Apply" }));

  expect(editor.getHTML()).toBe('<p><mark style="background-color:#ffe066">Hello</mark> world</p>');
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  // The name of the Toolbar's 'Highlight' button states the author's color: the sample is for the eye, the name is for the ear.
  expect(
    within(screen.getByRole("toolbar", { name: "Formatting" })).getByRole("button", {
      name: "Highlight: Custom #ffe066",
    })
  ).toBeDefined();
  await expectCustomChecked(user, "highlight");
});

test.each([
  ["text", "Custom text color"],
  ["highlight", "Custom highlight color"],
] as const)(
  "Cancel in the %s grid › Custom color… applies nothing and returns focus to the document",
  async (kind, name) => {
    const editor = renderEditor();
    const { user, popover } = await openCustom(kind, name);

    await typeHex(user, "#00aa55");
    await user.click(within(popover).getByRole("button", { name: "Cancel" }));

    expect(editor.getHTML()).toBe("<p>Hello world</p>");
    await waitFor(() => expect(document.activeElement).toBe(editor.view.dom));
  }
);

test("palette and custom are exclusive from the grid too, and the checked item follows", async () => {
  const user = userEvent.setup();
  const editor = renderEditor('<p><span style="color:#00aa55">Hello</span> world</p>');

  let grid = await openColorGrid(user, "text");
  expect(
    within(grid).getByRole("menuitemradio", { name: "Custom color…" }).getAttribute("aria-checked")
  ).toBe("true");
  // The author's color matches none of the swatches: only 'Custom color…' is checked.
  expect(
    within(grid)
      .getAllByRole("menuitemradio")
      .filter((item) => item.getAttribute("aria-checked") === "true")
      .map((item) => item.textContent)
  ).toEqual(["Custom color…"]);

  await user.click(within(grid).getByRole("menuitemradio", { name: "Red" }));
  expect(editor.getHTML()).toBe('<p><span data-color="danger">Hello</span> world</p>');

  grid = await openColorGrid(user, "text");
  expect(
    within(grid).getByRole("menuitemradio", { name: "Red" }).getAttribute("aria-checked")
  ).toBe("true");
  await user.click(within(grid).getByRole("menuitem", { name: "Remove color" }));
  expect(editor.getHTML()).toBe("<p>Hello world</p>");
});

test("the popover opens on the current custom colour", async () => {
  const editor = renderEditor('<p><mark style="background-color:#ffe066">Hello</mark> world</p>');
  void editor;
  await openCustom("highlight", "Custom highlight color");

  expect(screen.getByRole("button", { name: "Color #ffe066" })).toBeDefined();
});

/*
  Contrast is a warning, not a block: the person sees the cost of the choice and decides
  for themselves. It is measured against the CURRENT theme: the Editor's background and main text come from
  the Document's `--rte-background` and `--rte-foreground`.
*/

test("a text colour that fails 4.5:1 against the editor background warns, and still applies", async () => {
  const editor = renderEditor();
  theme(editor, "#ffffff", "#111111");
  const { user, popover } = await openCustom("text", "Custom text color");

  await typeHex(user, "#ffff00");
  const status = within(popover).getByRole("status");
  expect(status.textContent).toMatch(/Low contrast: 1\.0:1 against the editor background/);
  expect(status.textContent).toMatch(/4\.5:1/);

  await user.click(within(popover).getByRole("button", { name: "Apply" }));
  expect(editor.getHTML()).toBe('<p><span style="color:#ffff00">Hello</span> world</p>');
});

test("a text colour that holds 4.5:1 does not warn; the live region stays", async () => {
  const editor = renderEditor();
  theme(editor, "#ffffff", "#111111");
  const { user, popover } = await openCustom("text", "Custom text color");

  await typeHex(user, "#000000");
  expect(within(popover).getByRole("status").textContent).toBe("");
});

test("the warning follows the current theme: the same colour is fine on dark and bad on light", async () => {
  const editor = renderEditor();
  theme(editor, "#1a1a1a", "#f5f5f5");
  const { user, popover } = await openCustom("text", "Custom text color");

  await typeHex(user, "#ffff00");
  expect(within(popover).getByRole("status").textContent).toBe("");
  // The needed pair is computed the way WCAG computes it, not as a literal from the test.
  expect(contrastRatio("#ffff00", "#1a1a1a")).toBeGreaterThan(4.5);
  expect(contrastRatio("#ffff00", "#ffffff")).toBeLessThan(1.1);
});

test("a highlight is judged by the dark marker text on it, not by the theme's body text", async () => {
  const editor = renderEditor();
  // The theme's light text would read well on a dark background, but on a marker it
  // is not used: the text on any marker is dark (`--marker-text`).
  theme(editor, "#1a1a1a", "#f5f5f5");
  editor.view.dom.style.setProperty("--marker-text", "#1a1a1a");
  const { user, popover } = await openCustom("highlight", "Custom highlight color");

  // Dark marker: dark text does not read on it, however light the theme's text is.
  await typeHex(user, "#202020");
  expect(within(popover).getByRole("status").textContent).toMatch(
    /Low contrast: dark text on this highlight is 1\.\d:1 \(4\.5:1 needed\)/
  );

  await typeHex(user, "#ffe066");
  expect(within(popover).getByRole("status").textContent).toBe("");
});

test("the highlight warning does not depend on the theme: the same colour gives the same answer", async () => {
  const editor = renderEditor();
  theme(editor, "#ffffff", "#111111");
  editor.view.dom.style.setProperty("--marker-text", "#1a1a1a");
  const { user, popover } = await openCustom("highlight", "Custom highlight color");

  await typeHex(user, "#ffe066");
  expect(within(popover).getByRole("status").textContent).toBe("");
  await typeHex(user, "#303030");
  expect(within(popover).getByRole("status").textContent).toMatch(/dark text on this highlight/);
});

test("the popover says custom colours do not follow the theme", async () => {
  renderEditor();
  const { popover } = await openCustom("text", "Custom text color");

  expect(within(popover).getByText(/does not change with the theme/i)).toBeDefined();
});

test("contrast helper: black on white is 21:1, same colours are 1:1, junk is NaN", () => {
  expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
  expect(contrastRatio("#336699", "#336699")).toBeCloseTo(1, 5);
  expect(contrastRatio("nope", "#ffffff")).toBeNaN();
});

/*
  Escape inside a popover belongs to the popover, not to the layer under it (ADR-0041): both
  `Popover` and the color picker inside it are Radix, and each Escape closes
  exactly one layer. The layer here is `ModalOverlay`, as before, when the item
  'Custom color…' lived in a react-aria menu. With a real `Dialog`, the combination is
  checked by the browser: `tests-visual/interactions.spec.ts`.
*/
test("Escape closes the picker, then the popover, and only then the layer under it", async () => {
  const user = userEvent.setup();
  const onClose = vi.fn();
  const ref = createRef<RichTextEditorHandle>();
  render(
    <ModalOverlay onClose={onClose}>
      <RichTextEditor ref={ref} aria-label="Body" defaultValue="<p>Hello world</p>" />
    </ModalOverlay>
  );
  const editor = ref.current!.editor!;
  selectHello(editor);

  const grid = await openColorGrid(user, "text");
  await user.click(within(grid).getByRole("menuitemradio", { name: "Custom color…" }));
  await screen.findByRole("dialog", { name: "Custom text color" });
  await user.click(screen.getByRole("button", { name: /^Color #/ }));
  await screen.findByRole("textbox", { name: "HEX" });

  await user.keyboard("{Escape}");
  expect(screen.queryByRole("textbox", { name: "HEX" })).toBeNull();
  expect(screen.getByRole("dialog", { name: "Custom text color" })).toBeDefined();
  expect(onClose).not.toHaveBeenCalled();

  await user.keyboard("{Escape}");
  await waitFor(() =>
    expect(screen.queryByRole("dialog", { name: "Custom text color" })).toBeNull()
  );
  expect(onClose).not.toHaveBeenCalled();

  // Control: without a popover, the same Escape closes the layer.
  await waitFor(() => expect(document.activeElement).toBe(editor.view.dom));
  await user.keyboard("{Escape}");
  expect(onClose).toHaveBeenCalledTimes(1);
});

test("the popover speaks the provider's language", async () => {
  const user = userEvent.setup();
  const ref = createRef<RichTextEditorHandle>();
  render(
    <UiProvider messages={ru}>
      <RichTextEditor ref={ref} aria-label="Body" defaultValue="<p>Hello world</p>" />
    </UiProvider>
  );
  const t = ru.editor;
  selectHello(ref.current!.editor!);

  const selection = await screen.findByRole("toolbar", { name: t.selectionToolbar });
  await user.click(
    within(selection).getByRole("button", { name: t.colorMenu({ current: t.colorDefault }) })
  );
  const menu = await screen.findByRole("menu", { name: t.color });
  const grid = within(menu).getByRole("group", { name: t.textColorSection });
  await user.click(within(grid).getByRole("menuitemradio", { name: t.colorCustom }));
  const popover = await screen.findByRole("dialog", { name: t.customColorText });
  expect(within(popover).getByRole("button", { name: t.customColorApply })).toBeDefined();
  expect(within(popover).getByRole("button", { name: t.customColorCancel })).toBeDefined();
  expect(within(popover).getByText(t.customColorThemeNote)).toBeDefined();
});

test("the colour tools off: no Color button, no Custom color entry", async () => {
  const user = userEvent.setup();
  renderEditor("<p>Hello</p>", { preset: "basic" });
  // Neither on the Toolbar nor in the Bubble menu over 'Hello' (OLDSUI-154).
  await bubble();
  expect(screen.queryByRole("button", { name: /color/i })).toBeNull();
  await user.click(
    within(screen.getByRole("toolbar", { name: "Formatting" })).getByRole("button", {
      name: "More formatting",
    })
  );
  expect(screen.queryByRole("menuitem", { name: /color|Highlight/i })).toBeNull();
});
