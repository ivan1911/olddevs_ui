// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createRef } from "react";
import { afterEach, beforeAll, describe, expect, test } from "vitest";
import {
  RichTextEditor,
  type RichTextEditorHandle,
  type RichTextEditorProps,
} from "../src/editor/index.js";
import { contrastRatio } from "../src/editor/features/color/contrast.js";
import { UiProvider } from "../src/i18n/UiProvider.js";
import { messages as ru } from "../src/locales/ru.js";
import {
  EDITOR_MARKERS,
  EDITOR_MARKER_NAMES,
  EDITOR_BRIGHT_MARKER_NAMES,
  EDITOR_PALE_MARKER_NAMES,
  EDITOR_TEXT_COLORS,
  EDITOR_TEXT_COLOR_NAMES,
  LEGACY_MARKER_NAMES,
} from "../src/editor/styles/palette.js";
import {
  EDITOR_MARKER_CLASS,
  EDITOR_TEXT_COLOR_CLASS,
  PROSE_CLASS,
} from "../src/editor/styles/prose.js";
import { TOOLS } from "../src/editor/core/tools.js";
import { loadLazyBuiltins } from "./editor-lazy-builtins.js";

// Lazy `codeBlock` and `table` (OLDSUI-111): `full` is ready in `render` after the chunks load.
beforeAll(loadLazyBuiltins);

afterEach(cleanup);

/**
 * Text color, highlight and alignment of a Block (OLDSUI-46).
 *
 * One promise: the Document gets palette names in `data-color` and `data-align`,
 * and `style` never appears (spec, 'Schema and security'). Checked
 * through `RichTextEditor`: by loading, pasting and commands, the way the Toolbar does it.
 */
function renderEditor(props: Partial<RichTextEditorProps> = {}) {
  const ref = createRef<RichTextEditorHandle>();
  render(<RichTextEditor ref={ref} aria-label="Body" {...props} />);
  const editor = ref.current?.editor;
  if (!editor) throw new Error("the editor was not created inside render()");
  return { ref, editor };
}

function paste(editor: NonNullable<RichTextEditorHandle["editor"]>, html: string) {
  act(() => void editor.view.pasteHTML(html, new Event("paste") as ClipboardEvent));
}

test("text colour and highlight round-trip as data-color, never as style", () => {
  const { editor } = renderEditor({
    defaultValue:
      '<p><span data-color="danger">red</span> <mark data-color="green">marked</mark></p>',
  });

  expect(editor.getHTML()).toBe(
    '<p><span data-color="danger">red</span> <mark data-color="green">marked</mark></p>'
  );
});

test("the marker wraps sub, sup and links, so its stroke stays on the line; text colour wraps the marker", () => {
  const { editor } = renderEditor({
    defaultValue:
      '<p><sup><mark data-color="yellow">2</mark></sup> ' +
      '<sub><mark data-color="green">2</mark></sub> ' +
      '<a href="https://example.com"><mark data-color="pink">link</mark></a> ' +
      '<mark data-color="yellow"><span data-color="danger">red</span></mark></p>',
  });

  expect(editor.getHTML()).toBe(
    '<p><mark data-color="yellow"><sup>2</sup></mark> ' +
      '<mark data-color="green"><sub>2</sub></mark> ' +
      '<mark data-color="pink"><a href="https://example.com" rel="noopener noreferrer">link</a></mark> ' +
      '<span data-color="danger"><mark data-color="yellow">red</mark></span></p>'
  );
});

test("the text palette is the six status tones, the marker palette offers nine colours by hue", () => {
  expect([...EDITOR_TEXT_COLOR_NAMES]).toEqual([
    "accent",
    "success",
    "warning",
    "danger",
    "lime",
    "muted",
  ]);
  // The 'Highlight color' grid is ordered by hue, as in Notion (OLDSUI-153).
  expect([...EDITOR_MARKER_NAMES]).toEqual([
    "gray",
    "brown",
    "orange",
    "yellow",
    "green",
    "blue",
    "purple",
    "pink",
    "red",
  ]);
  // The bright ones take dark text on top; the legacy Notion colors keep the main text color.
  expect([...EDITOR_BRIGHT_MARKER_NAMES]).toEqual(["yellow", "green", "pink"]);
  expect([...EDITOR_PALE_MARKER_NAMES]).toEqual([
    "gray",
    "brown",
    "orange",
    "blue",
    "purple",
    "red",
  ]);
});

type Editor = NonNullable<RichTextEditorHandle["editor"]>;

/** Select 'Hello' with focus in the Document: this is what opens the Bubble menu. */
function selectHello(editor: Editor) {
  act(() => {
    editor.view.focus();
    editor.commands.setTextSelection({ from: 1, to: 6 });
  });
}

/** The Toolbar and the Bubble menu: 'Highlight' is on the first, 'Color' on the second (OLDSUI-154). */
const toolbar = (name = "Formatting") => screen.getByRole("toolbar", { name });
const bubble = (name = "Selection formatting") => screen.findByRole("toolbar", { name });

/** The 'Color' popover (OLDSUI-153) of the Bubble menu over 'Hello' › the grid of the required section. */
async function openColorGrid(
  user: ReturnType<typeof userEvent.setup>,
  editor: Editor,
  section: string
) {
  selectHello(editor);
  await user.click(within(await bubble()).getByRole("button", { name: /^Color:/ }));
  const menu = await screen.findByRole("menu", { name: "Color" });
  return within(menu).getByRole("group", { name: section });
}

test("each highlight circle carries its marker colour as a swatch and its name for the ear", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: "<p>Hello world</p>" });

  const grid = await openColorGrid(user, editor, "Highlight color");
  for (const name of EDITOR_MARKER_NAMES) {
    const item = within(grid).getByRole("menuitemradio", {
      name: name.charAt(0).toUpperCase() + name.slice(1),
    });
    const swatch = EDITOR_MARKER_CLASS[name]
      .split(" ")
      .map((cls) => `.${CSS.escape(cls)}`)
      .join("");
    expect(item.querySelector(swatch), name).not.toBeNull();
  }
});

test("a document saved with an old marker name opens with its migrated colour named and checked", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({
    defaultValue: '<p><mark data-color="accent">Hello</mark> world</p>',
  });
  act(() => void editor.commands.setTextSelection({ from: 1, to: 6 }));

  expect(within(toolbar()).getByRole("button", { name: "Highlight: Blue" })).toBeDefined();
  expect(editor.getHTML()).toBe('<p><mark data-color="blue">Hello</mark> world</p>');
  const grid = await openColorGrid(user, editor, "Highlight color");
  expect(
    within(grid).getByRole("menuitemradio", { name: "Blue" }).getAttribute("aria-checked")
  ).toBe("true");

  // Selecting a color in the grid recolors the text; the old name leaves the Document.
  await user.click(within(grid).getByRole("menuitemradio", { name: "Green" }));
  expect(editor.getHTML()).toBe('<p><mark data-color="green">Hello</mark> world</p>');
});

test("a pale marker name in a saved document keeps its name through load and export", () => {
  const html = EDITOR_PALE_MARKER_NAMES.map(
    (name) => `<p><mark data-color="${name}">m</mark></p>`
  ).join("");
  const { editor } = renderEditor({ defaultValue: html });

  expect(editor.getHTML()).toBe(html);
});

test("the full preset has colour, highlight and alignment, the basic one does not", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: "<p>Hello world</p>" });
  // Alignment is the 'Alignment' menu (OLDSUI-66); its items are checked by
  // `rich-text-editor-align-list-menus.test.tsx`.
  expect(screen.getByRole("button", { name: "Alignment: left" })).toBeDefined();
  // Color and highlight are buttons with popovers (OLDSUI-153), not items of a submenu under 'More formatting'. Without
  // duplicates (OLDSUI-154): 'Highlight' is on the Toolbar, 'Color' is in the Bubble menu.
  expect(within(toolbar()).getByRole("button", { name: "Highlight: None" })).toBeDefined();
  expect(within(toolbar()).queryByRole("button", { name: /^Color:/ })).toBeNull();
  selectHello(editor);
  const selection = await bubble();
  expect(within(selection).getByRole("button", { name: /^Color:/ })).toBeDefined();
  expect(within(selection).queryByRole("button", { name: /^Highlight/ })).toBeNull();
  cleanup();

  const basic = renderEditor({ preset: "basic", defaultValue: "<p>Hello world</p>" });
  selectHello(basic.editor);
  await bubble();
  expect(screen.queryByRole("button", { name: /color|Highlight|Align/ })).toBeNull();
  await user.click(within(toolbar()).getByRole("button", { name: "More formatting" }));
  expect(screen.queryByRole("menuitem", { name: /color|Highlight/ })).toBeNull();
});

test("a disabled field switches colour, highlight and alignment off", async () => {
  const { editor } = renderEditor({ disabled: true, defaultValue: "<p>Hello world</p>" });

  for (const name of ["Highlight: None", "More formatting", "Alignment: left"]) {
    expect((screen.getByRole("button", { name }) as HTMLButtonElement).disabled, name).toBe(true);
  }
  // 'Color' is in the Bubble menu (OLDSUI-154), and the Bubble menu does not appear over a disabled field:
  // there is no 'Color' button at all, even with a selection.
  selectHello(editor);
  // Wait one frame for the bubble to show up: it is not there, and no `findByRole` timeout is needed.
  await act(() => new Promise((resolve) => requestAnimationFrame(resolve)));
  expect(screen.queryByRole("toolbar", { name: "Selection formatting" })).toBeNull();
  expect(screen.queryByRole("button", { name: /^Color:/ })).toBeNull();
});

test("names come from the provider's catalog", async () => {
  const user = userEvent.setup();
  const ref = createRef<RichTextEditorHandle>();
  render(
    <UiProvider messages={ru}>
      <RichTextEditor ref={ref} aria-label="Body" defaultValue="<p>Text</p>" />
    </UiProvider>
  );
  const t = ru.editor;

  // An open menu hides the rest of the page from screen readers, so button names are read before it opens.
  expect(screen.getByRole("button", { name: t.alignMenu({ current: "left" }) })).toBeDefined();
  expect(
    within(toolbar(t.toolbar)).getByRole("button", {
      name: t.highlight({ current: t.highlightNone }),
    })
  ).toBeDefined();
  // 'Color' is in the Bubble menu (OLDSUI-154): 'Text' is selected with focus in the Document.
  act(() => {
    ref.current!.editor!.view.focus();
    ref.current!.editor!.commands.setTextSelection({ from: 1, to: 5 });
  });
  const selection = await bubble(t.selectionToolbar);
  await user.click(
    within(selection).getByRole("button", { name: t.colorMenu({ current: t.colorDefault }) })
  );
  const menu = await screen.findByRole("menu", { name: t.color });
  const names = (section: string) =>
    within(within(menu).getByRole("group", { name: section }))
      .getAllByRole("menuitemradio")
      .map((item) => item.getAttribute("aria-label") ?? item.textContent);
  expect(names(t.textColorSection)).toEqual([
    t.colorCustom,
    t.colorAccent,
    t.colorSuccess,
    t.colorWarning,
    t.colorDanger,
    t.colorLime,
    t.colorMuted,
  ]);
  expect(names(t.highlightSection)).toEqual([
    t.colorCustom,
    t.markerGray,
    t.markerBrown,
    t.markerOrange,
    t.markerYellow,
    t.markerGreen,
    t.markerBlue,
    t.markerPurple,
    t.markerPink,
    t.markerRed,
  ]);
  // Removing is an icon at the end of each grid (OLDSUI-160).
  expect(
    within(within(menu).getByRole("group", { name: t.textColorSection })).getByRole("menuitem", {
      name: t.colorRemove,
    })
  ).toBeDefined();
  expect(
    within(within(menu).getByRole("group", { name: t.highlightSection })).getByRole("menuitem", {
      name: t.highlightRemove,
    })
  ).toBeDefined();
});

/*
  Palette ⇔ classes. Tailwind reads the source as text, so the classes are written as
  literals, and the check against the palette tokens is the only thing that keeps them in sync.
  `npm run contrast` measures the token pairs from the same data.
*/

test("every text colour has its class, every marker has its token class, in the editor and in the view", () => {
  const prose = new Set(PROSE_CLASS.split(/\s+/));

  expect(Object.keys(EDITOR_TEXT_COLOR_CLASS).sort()).toEqual([...EDITOR_TEXT_COLOR_NAMES].sort());
  expect(Object.keys(EDITOR_MARKER_CLASS).sort()).toEqual([...EDITOR_MARKER_NAMES].sort());
  for (const { name, text } of EDITOR_TEXT_COLORS) {
    expect(EDITOR_TEXT_COLOR_CLASS[name]).toBe(`text-${text}`);
    // The Document reads the role `--rte-text-<name>`, not a kit token: on paper
    // (`surface="paper"`) the role has a light value (OLDSUI-52). The role ⇔ palette token
    // check is in `tests/rich-text-paper.test.tsx`.
    expect(
      prose.has(`[&_span[data-color=${name}]]:text-(--rte-text-${name})`),
      `${name} text`
    ).toBe(true);
  }
  for (const { name, token } of EDITOR_MARKERS) {
    expect(token).toBe(`marker-${name}`);
    // A bright marker sample also carries dark text: its background is bright in every
    // theme. The legacy Notion colors leave the text color inherited; their backgrounds
    // are specific to each theme.
    expect(EDITOR_MARKER_CLASS[name]).toBe(
      (EDITOR_BRIGHT_MARKER_NAMES as readonly string[]).includes(name)
        ? `bg-(--${token}) text-(--marker-text)`
        : `bg-(--${token})`
    );
    expect(prose.has(`[&_mark[data-color=${name}]]:bg-(--${token})`), `${name} marker`).toBe(true);
  }
  expect(prose.has("[&_[data-align=center]]:text-center")).toBe(true);
  expect(prose.has("[&_[data-align=right]]:text-right")).toBe(true);
});

test("the view paints an old marker name with the colour it migrates to", () => {
  const prose = new Set(PROSE_CLASS.split(/\s+/));

  for (const [legacy, name] of Object.entries(LEGACY_MARKER_NAMES)) {
    expect(prose.has(`[&_mark[data-color=${legacy}]]:bg-(--marker-${name})`), legacy).toBe(true);
  }
});

test("a pale marker keeps its own text colour, any other mark gets the dark marker text", () => {
  const prose = new Set(PROSE_CLASS.split(/\s+/));

  // The six legacy backgrounds are dark in the dark theme and designed for the light main text:
  // a dark token would hide them.
  for (const name of EDITOR_PALE_MARKER_NAMES) {
    expect(prose.has(`[&_mark[data-color=${name}]]:text-inherit`), name).toBe(true);
  }
  for (const name of EDITOR_BRIGHT_MARKER_NAMES) {
    expect(prose.has(`[&_mark[data-color=${name}]]:text-inherit`), name).toBe(false);
  }
  expect(prose.has("[&_mark]:text-(--marker-text)")).toBe(true);
});

test("a text colour token has a Tailwind bridge", () => {
  const styles = readFileSync(resolve(import.meta.dirname, "..", "styles.css"), "utf8");

  for (const { name, text } of EDITOR_TEXT_COLORS) {
    expect(styles, `${name}: --color-${text}`).toContain(`--color-${text}:`);
  }
});

/*
  A marker follows the NEAREST theme, not only the root: with `surface="paper"`, the Document
  area is wrapped in a nested `data-theme="light"` inside the dark app. So the token values are
  declared on `[data-theme]` of any element (not on `:root[data-theme]`) and read directly through
  the variable directly, without
  an `@theme` bridge, which would substitute the root value. The cascade in the browser
  is checked by `tests-visual/` (nested theme); here, the CSS structure.
*/
describe("marker tokens follow the nearest theme", () => {
  const styles = readFileSync(resolve(import.meta.dirname, "..", "styles.css"), "utf8");
  const blockOf = (selector: string) => {
    const at = styles.indexOf(`\n${selector} {`);
    expect(at, `styles.css has the block ${selector}`).toBeGreaterThan(-1);
    return styles.slice(at, styles.indexOf("\n}", at));
  };
  const dark = blockOf(':root,\n[data-theme]:not([data-theme="light"])');
  const light = blockOf('[data-theme="light"]');
  const bright = blockOf(":root,\n[data-theme]");
  const paleMarkers = EDITOR_MARKERS.filter(({ name }) =>
    (EDITOR_PALE_MARKER_NAMES as readonly string[]).includes(name)
  );
  const brightMarkers = EDITOR_MARKERS.filter(({ name }) =>
    (EDITOR_BRIGHT_MARKER_NAMES as readonly string[]).includes(name)
  );

  test.each(paleMarkers.map(({ name, token }) => [name, token] as const))(
    "pale %s has a value for dark/dim and a value for light, on any element",
    (name, token) => {
      expect(dark, `${name} dark`).toMatch(
        new RegExp(`--${token}:\\s*var\\(--od-marker-${name}-d\\);`)
      );
      expect(light, `${name} light`).toMatch(
        new RegExp(`--${token}:\\s*var\\(--od-marker-${name}-l\\);`)
      );
      // The marker has no `@theme` bridge: it would substitute the root value in a
      // wrapper with another theme.
      expect(styles).not.toContain(`--color-${token}:`);
    }
  );

  test.each(brightMarkers.map(({ name, token }) => [name, token] as const))(
    "bright %s is one value in every theme: declared once for any element, absent from the theme blocks",
    (name, token) => {
      expect(bright, `${name} bright`).toMatch(
        new RegExp(`--${token}:\\s*var\\(--od-marker-${name}\\);`)
      );
      expect(dark).not.toContain(`--${token}:`);
      expect(light).not.toContain(`--${token}:`);
      expect(styles).not.toContain(`--color-${token}:`);
    }
  );

  test("the bright marker values and the dark marker text are the ones in the spec", () => {
    const value = (name: string) =>
      new RegExp(`--od-marker-${name}:\\s*(#[0-9a-f]{6});`, "i").exec(styles)?.[1];
    expect(value("yellow")).toBe("#ffea80");
    expect(value("green")).toBe("#aaff80");
    expect(value("pink")).toBe("#ff80bf");
    expect(bright).toMatch(/--marker-text:\s*var\(--od-marker-text\);/);
    expect(dark).not.toContain("--marker-text:");
    expect(light).not.toContain("--marker-text:");
    // Dark text: contrast with each bright marker is at least 4.5:1.
    const text = /--od-marker-text:\s*(#[0-9a-f]{6});/i.exec(styles)?.[1];
    expect(text).toBeDefined();
    for (const name of ["yellow", "green", "pink"]) {
      expect(contrastRatio(text!, value(name)!), name).toBeGreaterThanOrEqual(4.5);
    }
  });

  test("the nearest-theme blocks do not hide behind :root[data-theme], which only the root matches", () => {
    expect(light).not.toContain(":root[data-theme");
    expect(styles.indexOf('\n[data-theme="light"] {')).toBeGreaterThan(
      styles.indexOf(':root,\n[data-theme]:not([data-theme="light"]) {')
    );
  });

  test("a nested data-theme wrapper gets its own marker values; the app around it keeps its own", () => {
    // A real cascade over the real rules of `styles.css` (jsdom supports both selector matching and
    // custom property inheritance).
    const style = document.createElement("style");
    style.textContent = `${dark}\n}\n${light}\n}\n${bright}\n}`;
    document.head.append(style);
    document.documentElement.dataset.theme = "dark";
    document.body.innerHTML =
      '<div id="app"><mark id="outside"></mark>' +
      '<div id="paper" data-theme="light"><mark id="inside"></mark>' +
      '<div data-theme="dim"><mark id="deep"></mark></div></div></div>';
    const marker = (id: string, token: string) =>
      getComputedStyle(document.getElementById(id)!).getPropertyValue(`--${token}`);

    try {
      for (const { name, token } of paleMarkers) {
        expect(marker("outside", token), `${name} in the dark app`).toBe(
          `var(--od-marker-${name}-d)`
        );
        expect(marker("inside", token), `${name} in the nested light wrapper`).toBe(
          `var(--od-marker-${name}-l)`
        );
        expect(marker("deep", token), `${name} in a dim wrapper inside the light one`).toBe(
          `var(--od-marker-${name}-d)`
        );
      }
      // Bright markers and the dark text on them are the same in any wrapper.
      for (const { name, token } of brightMarkers) {
        for (const id of ["outside", "inside", "deep"]) {
          expect(marker(id, token), `${name} in #${id}`).toBe(`var(--od-marker-${name})`);
        }
      }
      for (const id of ["outside", "inside", "deep"]) {
        expect(marker(id, "marker-text"), `marker text in #${id}`).toBe("var(--od-marker-text)");
      }
    } finally {
      style.remove();
      delete document.documentElement.dataset.theme;
    }
  });

  test("the prose and the swatches read the token variable itself", () => {
    for (const { name, token } of EDITOR_MARKERS) {
      expect(EDITOR_MARKER_CLASS[name]).toContain(`bg-(--${token})`);
    }
    expect(PROSE_CLASS).not.toMatch(/data-theme/);
  });
});

/*
  Custom color (OLDSUI-46, addendum): the only place where the saved HTML has a `style`. It is
  written strictly as `color:#rrggbb` on `span` and `background-color:#rrggbb` on `mark`, and never
  together with `data-color`.
*/

test("a custom text colour round-trips as style on a span, lowercase six-digit hex", () => {
  const { editor } = renderEditor({
    defaultValue:
      '<p><span style="color:#ff0000">red</span> <span style="color:#1A2B3C">mixed</span></p>',
  });

  expect(editor.getHTML()).toBe(
    '<p><span style="color:#ff0000">red</span> <span style="color:#1a2b3c">mixed</span></p>'
  );
});

test("a custom highlight round-trips as style on a mark", () => {
  const { editor } = renderEditor({
    defaultValue: '<p><mark style="background-color:#ffee00">m</mark></p>',
  });

  expect(editor.getHTML()).toBe('<p><mark style="background-color:#ffee00">m</mark></p>');
});

test("only a lone #rrggbb declaration is a custom colour; every other style is dropped", () => {
  const { editor } = renderEditor({
    defaultValue:
      '<p><span style="color:#f00">a</span><span style="color:rgb(255,0,0)">b</span>' +
      '<span style="color:red">c</span><span style="color:#ff0000;font-size:40px">d</span>' +
      '<span style="background-color:#ff0000">e</span><span style="color:#ff0000 !important">f</span>' +
      '<span style="color:var(--x)">g</span><span style="color:#ff00001">h</span>' +
      '<mark style="color:#ff0000">i</mark><mark style="background-color:#fff">j</mark>' +
      '<mark style="background:#ffee00">k</mark></p>',
  });

  expect(editor.getHTML()).toBe("<p>abcdefghijk</p>");
});

test("a custom colour keeps its element tag: style on other tags is dropped", () => {
  const { editor } = renderEditor({
    defaultValue:
      '<p style="color:#ff0000">p</p><p><b style="color:#ff0000">b</b><em style="color:#ff0000">e</em></p>',
  });

  expect(editor.getHTML()).not.toContain("style");
});

test("a palette name and a style never meet on one element", () => {
  const { editor } = renderEditor({
    defaultValue:
      '<p><span data-color="danger" style="color:#00ff00">a</span>' +
      '<span data-color="hotpink" style="color:#00ff00">b</span>' +
      '<mark data-color="green" style="background-color:#00ff00">c</mark></p>',
  });

  expect(editor.getHTML()).toBe(
    '<p><span data-color="danger">a</span>b<mark data-color="green">c</mark></p>'
  );
});

test("setColor and setHighlight take a custom colour; palette and custom replace each other", () => {
  const { editor } = renderEditor({ defaultValue: "<p>Hello world</p>" });
  act(() => void editor.commands.setTextSelection({ from: 1, to: 6 }));

  act(() => void editor.commands.setColor("#FF0000"));
  expect(editor.getHTML()).toBe('<p><span style="color:#ff0000">Hello</span> world</p>');
  act(() => void editor.commands.setColor("danger"));
  expect(editor.getHTML()).toBe('<p><span data-color="danger">Hello</span> world</p>');
  act(() => void editor.commands.setColor("#00ff00"));
  expect(editor.getHTML()).toBe('<p><span style="color:#00ff00">Hello</span> world</p>');

  act(() => void editor.commands.setHighlight({ color: "#FFEE00" }));
  act(() => void editor.commands.setHighlight({ color: "green" }));
  act(() => void editor.commands.setHighlight({ color: "#ffee00" }));
  expect(editor.getHTML()).toBe(
    '<p><span style="color:#00ff00"><mark style="background-color:#ffee00">Hello</mark></span> world</p>'
  );

  // Anything other than `#rrggbb` is not applied.
  for (const bad of ["#fff", "rgb(0,0,0)", "chartreuse", "#ggg000", "#ff0000; x:y"]) {
    act(() => void editor.commands.setColor(bad));
    act(() => void editor.commands.setHighlight({ color: bad }));
  }
  expect(editor.getHTML()).toBe(
    '<p><span style="color:#00ff00"><mark style="background-color:#ffee00">Hello</mark></span> world</p>'
  );

  act(() => void editor.commands.unsetColor());
  act(() => void editor.commands.unsetHighlight());
  expect(editor.getHTML()).toBe("<p>Hello world</p>");
});

test("a custom colour survives copy and paste inside the editor, a foreign one does not", () => {
  const { editor } = renderEditor();

  paste(editor, '<p><span style="color:#ff0000">own</span></p>');
  expect(editor.getHTML()).toBe('<p><span style="color:#ff0000">own</span></p>');

  act(() => void editor.commands.clearContent());
  paste(
    editor,
    '<p><span style="color: rgb(255, 0, 0)">word</span><span style="color:#ff0000;font-size:40px">gdocs</span></p>'
  );
  expect(editor.getHTML()).toBe("<p>wordgdocs</p>");
});

test("colour tools off: a custom colour is dropped on paste as well", () => {
  const without = (...names: string[]) => TOOLS.filter((tool) => !names.includes(tool));
  const { editor } = renderEditor({ tools: without("color", "highlight") });

  paste(
    editor,
    '<p><span style="color:#ff0000">a</span><mark style="background-color:#ffee00">b</mark></p>'
  );
  expect(editor.getHTML()).toBe("<p>ab</p>");
});

test("palette classes never reach a custom colour: every span and mark colour rule keys on data-color", () => {
  const colouring = PROSE_CLASS.split(/\s+/).filter(
    (token) =>
      /^\[&_(span|mark)\b.*\]:(text|bg)-/.test(token) &&
      !token.endsWith(":text-inherit") &&
      // The shared `mark` rule: dark text on any background, including the author's custom colors.
      token !== "[&_mark]:text-(--marker-text)"
  );

  // Text has one rule per name; a marker has one rule per name and one per legacy name
  // (`LEGACY_MARKER_NAMES`: a Document saved before the new palette loads without migration).
  expect(colouring.length).toBe(
    EDITOR_TEXT_COLORS.length + EDITOR_MARKERS.length + Object.keys(LEGACY_MARKER_NAMES).length
  );
  for (const rule of colouring) expect(rule, rule).toContain("[data-color=");
  // Text on a marker is dark: on bright markers and on the author's custom color. The six legacy
  // names keep their own inherited color (`text-inherit` by name).
  expect(PROSE_CLASS.split(/\s+/)).toContain("[&_mark]:text-(--marker-text)");
});

test("selection over a bright marker is denser, and the kit's global ::selection is layered so it can be overridden", () => {
  const styles = readFileSync(resolve(import.meta.dirname, "..", "styles.css"), "utf8");
  // Outside the layer, the global `::selection` would beat any `selection:` utility, and the
  // Editor's roles (`--rte-selection`, `--rte-selection-marker`) would not work.
  const unlayered = styles.replace(/@layer base \{[\s\S]*?\n\}/g, "");
  expect(unlayered).not.toMatch(/^::selection\s*\{/m);
  expect(styles).toMatch(/@layer base \{\s*::selection \{/);
  expect(PROSE_CLASS).toContain(":selection:bg-(--rte-selection-marker)");
  expect(PROSE_CLASS).toContain(":selection:text-(--marker-text)");
});

test("the dense marker selection skips exactly the pale markers and the old names for them", () => {
  // The legacy Notion colors and the old names that lead to them keep their backgrounds, which
  // stay dark in dark themes: they get the shared selection, not the dense one with dark text.
  const pale = new Set<string>(EDITOR_PALE_MARKER_NAMES);
  const dark = [
    ...EDITOR_PALE_MARKER_NAMES,
    ...Object.entries(LEGACY_MARKER_NAMES)
      .filter(([, marker]) => pale.has(marker))
      .map(([name]) => name),
  ].sort();
  const rule = PROSE_CLASS.match(/\[&_mark:not\(:is\(([^)]*)\)\)\]:selection:bg-/);
  expect(rule, "the selection rule over markers").not.toBeNull();
  const excluded = [...rule![1]!.matchAll(/data-color=([a-z]+)/g)].map((m) => m[1]!).sort();
  expect(excluded).toEqual(dark);
});
