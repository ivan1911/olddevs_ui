// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { createRef } from "react";
import { afterEach, beforeAll, expect, test } from "vitest";
import { Menu, MenuButton, MenuItem, MenuTrigger } from "../src/components/overlays/Menu.js";
import { Popover, PopoverContent, PopoverTrigger } from "../src/components/overlays/Popover.js";
import {
  GLASS_INVERSE_CLASS,
  GLASS_MENU_CLASS,
  GLASS_PANEL_CLASS,
} from "../src/editor/styles/glass.js";
import {
  RICH_TEXT_PRESETS,
  RichTextEditor,
  type RichTextEditorHandle,
  type RichTextEditorProps,
} from "../src/editor/index.js";
import { loadLazyBuiltins } from "./editor-lazy-builtins.js";
import { testAskTool, testPickerTool, testRemarkTool } from "./editor-test-tools.js";

// Lazy `codeBlock` and `table` (OLDSUI-111): `full` is ready in `render` once the chunks load.
beforeAll(loadLazyBuiltins);

// The Text card loads lazily (`RichTextEditor.tsx`), so its chunk is warmed up in advance.
beforeAll(() => import("../src/editor/ui/TextCard.js"));

afterEach(cleanup);

/**
 * Glass on the Editor's floating surfaces (OLDSUI-118): the floating Toolbar,
 * the Bubble menu, menu lists and popovers get a semi-transparent background of
 * their own surface with a blurred backdrop. The same `Menu` and `Popover`
 * outside the Editor stay solid.
 *
 * jsdom does not compute styles, so the test checks the surface class: what
 * comes out of it on screen is shown by the stories and visual snapshots.
 */
function renderEditor(props: Partial<RichTextEditorProps> = {}) {
  const ref = createRef<RichTextEditorHandle>();
  const view = render(
    <RichTextEditor ref={ref} aria-label="Body" defaultValue="<p>Hello world</p>" {...props} />
  );
  const editor = ref.current?.editor;
  if (!editor) throw new Error("the editor was not created inside render()");
  return { ...view, editor };
}

/** Solid backgrounds that Glass replaces: they must not stay next to it. */
const SOLID = ["bg-bg-1", "bg-surface-elevated", "bg-surface-inverse"];

/**
 * The surface's classes as a whole: the background, the blur, the solid
 * fallback, and not a single solid background without a condition. Keep both
 * `cn` calls: otherwise the outcome would depend on the order of rules in CSS,
 * not on the markup.
 */
function expectSurface(node: Element | null, surface: string) {
  expect(node).not.toBeNull();
  expect(node).toHaveProperty("className");
  const classes = new Set((node as HTMLElement).className.split(/\s+/));
  for (const name of surface.split(/\s+/)) expect(classes).toContain(name);
  for (const name of SOLID) expect(classes).not.toContain(name);
}

/** Popover panel of a list: the popover node that holds the menu. */
const panelOf = (menu: HTMLElement) => menu.closest("[data-trigger]");

test("the floating toolbar sits on the glass panel surface", async () => {
  const { editor } = renderEditor({ toolbar: "floating" });
  act(() => editor.view.focus());
  act(() => void editor.commands.setTextSelection({ from: 1, to: 6 }));

  const toolbar = await screen.findByRole("toolbar", { name: "Formatting" });
  // The classes sit on the `BubbleMenu` node, the wrapper of the Toolbar.
  expectSurface(toolbar.closest('[class*="backdrop-blur"]'), GLASS_PANEL_CLASS);
});

test("the selection bubble sits on the glass inverse surface", async () => {
  const { editor } = renderEditor({ toolbar: "bubble" });
  act(() => editor.view.focus());
  act(() => void editor.commands.setTextSelection({ from: 1, to: 6 }));

  const bubble = await screen.findByRole("toolbar", { name: "Selection formatting" });
  expectSurface(bubble.closest('[class*="backdrop-blur"]'), GLASS_INVERSE_CLASS);
});

test.each([
  ["More formatting", /^More formatting$/],
  ["block type", /^Block type/],
  ["alignment", /^Alignment/],
  ["lists", /^(Lists|List:)/],
  ["insert", /^Insert block$/],
  ["table", /^Table$/],
])("the %s menu of the toolbar opens on the glass menu surface", async (_, name) => {
  renderEditor({ preset: "full" });
  await userEvent.click(screen.getByRole("button", { name }));

  expectSurface(panelOf(await screen.findByRole("menu")), GLASS_MENU_CLASS);
});

test.each([
  ["Link", "Hello", "Formatting"],
  ["Emoji", null, "Formatting"],
  ["Keyboard shortcuts", null, "Formatting"],
  // Color-grid popovers (OLDSUI-153) use the same Glass as the Editor's popovers.
  // "Color" is in the Bubble menu, "Highlight" is on the Toolbar (OLDSUI-154).
  ["Color: Default", "Hello", "Selection formatting"],
  ["Highlight: None", null, "Formatting"],
])("the %s popover opens on the glass panel surface", async (name, selection, toolbar) => {
  const { editor } = renderEditor({ preset: "full" });
  if (selection) {
    act(() => editor.view.focus());
    act(() => void editor.commands.setTextSelection({ from: 1, to: 1 + selection.length }));
  }
  const host = await screen.findByRole("toolbar", { name: toolbar });
  await userEvent.click(within(host).getByRole("button", { name }));

  expectSurface(await screen.findByRole("dialog"), GLASS_PANEL_CLASS);
});

/*
  Surfaces of the OLDSUI-98 epic float above the Document just like the
  built-in ones and sit on the same Glass: the popover frame of a custom Tool
  entry (at the button and at the caret) and the Text card.
*/
test("the popover of a custom tool button opens on the glass panel surface", async () => {
  renderEditor({ tools: [...RICH_TEXT_PRESETS.full, testPickerTool] });
  await userEvent.click(screen.getByRole("button", { name: "Picker" }));

  expectSurface(await screen.findByRole("dialog", { name: "Picker" }), GLASS_PANEL_CLASS);
});

test("the popover of a custom insert item opens at the caret on the glass panel surface", async () => {
  const { editor } = renderEditor({ tools: [...RICH_TEXT_PRESETS.full, testAskTool] });
  act(() => editor.view.focus());
  await userEvent.click(screen.getByRole("button", { name: /^Insert block$/ }));
  await userEvent.click(
    within(await screen.findByRole("menu")).getByRole("menuitem", { name: /^Ask/ })
  );

  expectSurface(await screen.findByRole("dialog", { name: "Ask" }), GLASS_PANEL_CLASS);
});

test("the text card opens on the glass panel surface", async () => {
  // The Text card is a lazy chunk: `render` inside `act` waits for it.
  const ref = createRef<RichTextEditorHandle>();
  await act(async () => {
    render(
      <RichTextEditor
        ref={ref}
        aria-label="Body"
        defaultValue='<p>One <span data-mark="test_remark">two three</span> four</p>'
        tools={[...RICH_TEXT_PRESETS.full, testRemarkTool]}
      />
    );
  });
  const editor = ref.current?.editor;
  if (!editor) throw new Error("the editor was not created inside render()");
  act(() => {
    editor.view.focus();
    editor.commands.setTextSelection(8);
  });

  expectSurface(await screen.findByRole("dialog", { name: "Remark" }), GLASS_PANEL_CLASS);
});

test("the same Menu and Popover outside the editor stay solid", async () => {
  render(
    <>
      <MenuTrigger>
        <MenuButton>Actions</MenuButton>
        <Menu>
          <MenuItem>Rename</MenuItem>
        </Menu>
      </MenuTrigger>
      <Popover>
        <PopoverTrigger>Details</PopoverTrigger>
        <PopoverContent aria-label="Details">Body</PopoverContent>
      </Popover>
    </>
  );

  await userEvent.click(screen.getByRole("button", { name: "Actions" }));
  const panel = panelOf(await screen.findByRole("menu"));
  expect(panel?.className).toContain("bg-surface-elevated");
  expect(panel?.className).not.toContain("backdrop-blur");

  await userEvent.keyboard("{Escape}");
  await userEvent.click(screen.getByRole("button", { name: "Details" }));
  const dialog = await screen.findByRole("dialog", { name: "Details" });
  expect(dialog.className).toContain("bg-bg-1");
  expect(dialog.className).not.toContain("backdrop-blur");
});

test("every glass surface turns solid when transparency is reduced or contrast raised", () => {
  for (const [surface, token] of [
    [GLASS_PANEL_CLASS, "bg-bg-1"],
    [GLASS_MENU_CLASS, "bg-surface-elevated"],
    [GLASS_INVERSE_CLASS, "bg-surface-inverse"],
  ] as const) {
    const classes = surface.split(/\s+/);
    for (const query of ["[@media(prefers-reduced-transparency:reduce)]", "contrast-more"]) {
      expect(classes).toContain(`${query}:${token}`);
      expect(classes).toContain(`${query}:backdrop-blur-none`);
    }
  }
});

/*
  Glass does not hold on iOS (OLDSUI-147): in Safari on iOS 27 the Editor's
  menus came out without a background, and the items sat over the Document's
  text at full strength. `-webkit-touch-callout` is understood only by WebKit
  on iOS (Chrome there is the same WebKit), so the condition matches exactly
  that engine and leaves the desktop alone.
*/
test.each([
  ["panel", GLASS_PANEL_CLASS, "bg-bg-1"],
  ["menu", GLASS_MENU_CLASS, "bg-surface-elevated"],
  ["inverse", GLASS_INVERSE_CLASS, "bg-surface-inverse"],
])("on iOS WebKit the %s glass falls back to its solid surface without blur", (_, glass, solid) => {
  const classes = glass.split(/\s+/);
  expect(classes).toContain(`[@supports(-webkit-touch-callout:none)]:${solid}`);
  expect(classes).toContain("[@supports(-webkit-touch-callout:none)]:backdrop-blur-none");
});
