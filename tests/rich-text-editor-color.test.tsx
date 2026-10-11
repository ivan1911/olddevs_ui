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

// Ленивые `codeBlock` и `table` (OLDSUI-111): `full` готов в `render` после загрузки чанков.
beforeAll(loadLazyBuiltins);

afterEach(cleanup);

/**
 * Цвет текста, маркер и выравнивание Блока (OLDSUI-46).
 *
 * Обещание одно: в документ уходят имена палитры в `data-color` и `data-align`,
 * а `style` не появляется никогда (спека, «Схема и безопасность»). Проверяется
 * через `RichTextEditor`: загрузкой, вставкой и командами, как это делает Панель.
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
  // Порядок сетки «Цвет маркера» — по оттенку, как в Notion (OLDSUI-153).
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
  // Яркие — с тёмным текстом поверх, прежние цвета Notion — с основным.
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

/** Выделить «Hello» с фокусом в Документе — так всплывает меню выделения. */
function selectHello(editor: Editor) {
  act(() => {
    editor.view.focus();
    editor.commands.setTextSelection({ from: 1, to: 6 });
  });
}

/** Панель и меню выделения: «Маркер» — на первой, «Цвет» — во втором (OLDSUI-154). */
const toolbar = (name = "Formatting") => screen.getByRole("toolbar", { name });
const bubble = (name = "Selection formatting") => screen.findByRole("toolbar", { name });

/** Поповер «Цвет» (OLDSUI-153) меню выделения над «Hello» › сетка нужного вида. */
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

  // Выбор из сетки перекрашивает; прежнее имя из Документа уходит.
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
  // Выравнивание — меню «Выравнивание» (OLDSUI-66); его пункты проверяет
  // `rich-text-editor-align-list-menus.test.tsx`.
  expect(screen.getByRole("button", { name: "Alignment: left" })).toBeDefined();
  // Цвет и маркер — кнопки с поповерами (OLDSUI-153), а не подменю «…». Без
  // дублей (OLDSUI-154): «Маркер» — на Панели, «Цвет» — в меню выделения.
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
  // «Цвет» — в меню выделения (OLDSUI-154), а над выключенным полем оно не
  // всплывает: кнопки «Цвет» нет вовсе, даже при выделении.
  selectHello(editor);
  // Кадр на показ плашки — и её нет; без ожидания таймаута `findByRole`.
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

  // Меню закрывает остальную страницу от скринридера, поэтому имена кнопок — до открытия.
  expect(screen.getByRole("button", { name: t.alignMenu({ current: "left" }) })).toBeDefined();
  expect(
    within(toolbar(t.toolbar)).getByRole("button", {
      name: t.highlight({ current: t.highlightNone }),
    })
  ).toBeDefined();
  // «Цвет» — в меню выделения (OLDSUI-154): «Text» выделен с фокусом в Документе.
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
  // Снятие — значком в конце каждой сетки (OLDSUI-160).
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
  Палитра ⇔ классы. Tailwind читает исходник текстом, поэтому классы записаны
  литералами, и сверка с токенами палитры — единственное, что не даёт им
  разойтись. Пары токенов меряет `npm run contrast` по тем же данным.
*/

test("every text colour has its class, every marker has its token class, in the editor and in the view", () => {
  const prose = new Set(PROSE_CLASS.split(/\s+/));

  expect(Object.keys(EDITOR_TEXT_COLOR_CLASS).sort()).toEqual([...EDITOR_TEXT_COLOR_NAMES].sort());
  expect(Object.keys(EDITOR_MARKER_CLASS).sort()).toEqual([...EDITOR_MARKER_NAMES].sort());
  for (const { name, text } of EDITOR_TEXT_COLORS) {
    expect(EDITOR_TEXT_COLOR_CLASS[name]).toBe(`text-${text}`);
    // Документ читает роль `--rte-text-<имя>`, а не токен кита: на листе
    // `surface="paper"` у роли светлое значение (OLDSUI-52). Роль ⇔ токен
    // палитры сверяет `tests/rich-text-paper.test.tsx`.
    expect(
      prose.has(`[&_span[data-color=${name}]]:text-(--rte-text-${name})`),
      `${name} text`
    ).toBe(true);
  }
  for (const { name, token } of EDITOR_MARKERS) {
    expect(token).toBe(`marker-${name}`);
    // Образец яркого маркера несёт и тёмный текст: подложка яркая во всех
    // темах. Прежние цвета Notion оставляют цвет текста наследуемым — их
    // подложки свои у каждой темы.
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

  // Прежние шесть подложек тёмные в тёмной теме и рассчитаны под светлый
  // основной текст: тёмный токен их бы погасил.
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
  Маркер следует за БЛИЖАЙШЕЙ темой, а не только за корнем: на `surface="paper"`
  область документа оборачивается во вложенный `data-theme="light"` внутри
  тёмного приложения. Поэтому значения токенов объявлены на `[data-theme]`
  любого элемента (не на `:root[data-theme]`), а читаются переменной напрямую —
  без моста `@theme`, который подставил бы значение корня. Каскад в браузере
  проверяет `tests-visual/` (вложенная тема), здесь — устройство CSS.
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
      // Моста `@theme` у маркера нет: он подставил бы значение корня и в
      // обёртке с другой темой.
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
    // Тёмный текст: контраст с каждым ярким маркером не ниже 4.5:1.
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
    // Настоящий каскад на настоящих правилах `styles.css` (jsdom умеет и
    // сопоставление селекторов, и наследование пользовательских свойств).
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
      // Яркие маркеры и тёмный текст на них одинаковы в любой обёртке.
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
  Произвольный цвет (OLDSUI-46, дополнение): единственное место, где в сохранённом
  HTML есть `style`. Пишется строго `color:#rrggbb` на `span` и
  `background-color:#rrggbb` на `mark`, и никогда вместе с `data-color`.
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

  // Не `#rrggbb` — не ставится.
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
      // Общее правило `mark` — тёмный текст на любой подложке, в том числе цвета автора.
      token !== "[&_mark]:text-(--marker-text)"
  );

  // Текст — по правилу на имя; маркер — по правилу на имя и на старое имя
  // (`LEGACY_MARKER_NAMES`: документ, сохранённый до новой палитры, читается без миграции).
  expect(colouring.length).toBe(
    EDITOR_TEXT_COLORS.length + EDITOR_MARKERS.length + Object.keys(LEGACY_MARKER_NAMES).length
  );
  for (const rule of colouring) expect(rule, rule).toContain("[data-color=");
  // Текст на маркере тёмный: и у ярких маркеров, и у цвета автора. Прежние
  // шесть имён оставляют свой наследуемый цвет (`text-inherit` по имени).
  expect(PROSE_CLASS.split(/\s+/)).toContain("[&_mark]:text-(--marker-text)");
});

test("selection over a bright marker is denser, and the kit's global ::selection is layered so it can be overridden", () => {
  const styles = readFileSync(resolve(import.meta.dirname, "..", "styles.css"), "utf8");
  // Вне слоя глобальное `::selection` побеждало бы любую утилиту `selection:`
  // и роли Редактора (`--rte-selection`, `--rte-selection-marker`) не работали бы.
  const unlayered = styles.replace(/@layer base \{[\s\S]*?\n\}/g, "");
  expect(unlayered).not.toMatch(/^::selection\s*\{/m);
  expect(styles).toMatch(/@layer base \{\s*::selection \{/);
  expect(PROSE_CLASS).toContain(":selection:bg-(--rte-selection-marker)");
  expect(PROSE_CLASS).toContain(":selection:text-(--marker-text)");
});

test("the dense marker selection skips exactly the pale markers and the old names for them", () => {
  // Прежние цвета Notion и старые имена, ведущие в них, — подложки прежние и в тёмных
  // темах тёмные: на них общее выделение, а не плотное с тёмным текстом.
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
