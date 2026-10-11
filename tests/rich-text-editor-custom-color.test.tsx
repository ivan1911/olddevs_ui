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

// Ленивые `codeBlock` и `table` (OLDSUI-111): `full` готов в `render` после загрузки чанков.
beforeAll(loadLazyBuiltins);

/*
  Шим `CSS.escape` — тот же, что в `color-picker.test.tsx`: поповер react-aria
  зовёт его при открытии, а в jsdom объекта `CSS` нет.
*/
if (typeof globalThis.CSS === "undefined")
  (globalThis as unknown as { CSS: { escape: (v: string) => string } }).CSS = {
    escape: (value: string) => String(value).replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`),
  };

afterEach(cleanup);

/**
 * Произвольный цвет через `ColorPicker` кита (OLDSUI-46, дополнение): пункт
 * «Свой цвет…» у каждой сетки поповера «Цвет» (OLDSUI-153) открывает поповер с выбором цвета,
 * применением и предупреждением о контрасте. Проверяется через `RichTextEditor`:
 * как это делает человек, а не через внутренности.
 *
 * «Цвет» — в меню выделения (OLDSUI-154): плашка всплывает над непустым
 * выделением, пока у Документа фокус, поэтому выделение ставится с фокусом.
 */
function renderEditor(html = "<p>Hello world</p>", props: Record<string, unknown> = {}) {
  const ref = createRef<RichTextEditorHandle>();
  render(<RichTextEditor ref={ref} aria-label="Body" defaultValue={html} {...props} />);
  const editor = ref.current!.editor!;
  selectHello(editor);
  return editor;
}

/** Выделить «Hello» с фокусом в Документе — так всплывает меню выделения. */
function selectHello(editor: NonNullable<RichTextEditorHandle["editor"]>) {
  act(() => {
    editor.view.focus();
    editor.commands.setTextSelection({ from: 1, to: 6 });
  });
}

/** Меню выделения: в нём кнопка «Цвет» (OLDSUI-154). */
const bubble = () => screen.findByRole("toolbar", { name: "Selection formatting" });

/** Тема в jsdom — это значения, которые `prose.ts` кладёт в `--rte-*` на документе. */
function theme(editor: NonNullable<RichTextEditorHandle["editor"]>, bg: string, fg: string) {
  editor.view.dom.style.setProperty("--rte-background", bg);
  editor.view.dom.style.setProperty("--rte-foreground", fg);
}

type Kind = "text" | "highlight";
const SECTION: Record<Kind, string> = { text: "Text color", highlight: "Highlight color" };

/** Поповер «Цвет» (OLDSUI-153) меню выделения › сетка нужного вида. */
async function openColorGrid(user: ReturnType<typeof userEvent.setup>, kind: Kind) {
  await user.click(within(await bubble()).getByRole("button", { name: /^Color:/ }));
  const menu = await screen.findByRole("menu", { name: "Color" });
  return within(menu).getByRole("group", { name: SECTION[kind] });
}

/** «Цвет» › «Свой цвет…» нужной сетки → поповер выбора. */
async function openCustom(kind: Kind, popoverName: string) {
  const user = userEvent.setup();
  const grid = await openColorGrid(user, kind);
  await user.click(within(grid).getByRole("menuitemradio", { name: "Custom color…" }));
  const popover = await screen.findByRole("dialog", { name: popoverName });
  return { user, popover };
}

/** Цвет автора отмечен: «Свой цвет…» нужной сетки — `aria-checked`. */
async function expectCustomChecked(user: ReturnType<typeof userEvent.setup>, kind: Kind) {
  const grid = await openColorGrid(user, kind);
  expect(
    within(grid).getByRole("menuitemradio", { name: "Custom color…" }).getAttribute("aria-checked")
  ).toBe("true");
  await user.keyboard("{Escape}");
}

/** Раскрывает выбор цвета и вводит значение в поле HEX, как это делает человек. */
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

  // Палитры разной длины: шесть тонов и девять маркеров; снятие — значком (OLDSUI-160).
  for (const [kind, length] of [
    ["text", 6],
    ["highlight", 9],
  ] as const) {
    const grid = await openColorGrid(user, kind);
    // Кружки и «Свой цвет…» — варианты одного выбора.
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
  // Цвет автора отмечен у «Свой цвет…» сетки текста.
  await expectCustomChecked(user, "text");
});

test("a custom highlight is applied from the popover as style on a mark", async () => {
  const editor = renderEditor();
  const { user, popover } = await openCustom("highlight", "Custom highlight color");

  await typeHex(user, "#FFE066");
  await user.click(within(popover).getByRole("button", { name: "Apply" }));

  expect(editor.getHTML()).toBe('<p><mark style="background-color:#ffe066">Hello</mark> world</p>');
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  // Имя кнопки «Маркер» Панели называет цвет автора: образец глазу, имя слуху.
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
  // Цвет автора не совпадает ни с одним кружком: отмечен только «Свой цвет…».
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
  Контраст — предупреждение, а не запрет: человек видит цену выбора и решает
  сам. Меряется по ТЕКУЩЕЙ теме: фон и основной текст Редактора берутся из
  `--rte-background` и `--rte-foreground` документа.
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
  // Нужная пара считается так же, как её считает WCAG, а не литералом из теста.
  expect(contrastRatio("#ffff00", "#1a1a1a")).toBeGreaterThan(4.5);
  expect(contrastRatio("#ffff00", "#ffffff")).toBeLessThan(1.1);
});

test("a highlight is judged by the dark marker text on it, not by the theme's body text", async () => {
  const editor = renderEditor();
  // Светлый текст темы на тёмной подложке читался бы хорошо, но на маркере он
  // не стоит: текст на любом маркере тёмный (`--marker-text`).
  theme(editor, "#1a1a1a", "#f5f5f5");
  editor.view.dom.style.setProperty("--marker-text", "#1a1a1a");
  const { user, popover } = await openCustom("highlight", "Custom highlight color");

  // Тёмный маркер: тёмный текст на нём не читается, как бы ни был светел текст темы.
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
  Escape в поповере принадлежит поповеру, а не слою под ним (ADR-0041): и
  `Popover`, и выбор цвета внутри него — Radix, и каждый Escape закрывает
  ровно один слой. Слой здесь — `ModalOverlay`, как и прежде, когда пункт
  «Свой цвет…» лежал в меню react-aria. С настоящим `Dialog` сочетание
  проверяет браузер: `tests-visual/interactions.spec.ts`.
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

  // Контроль: без поповера тот же Escape закрывает слой.
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
  // Ни на Панели, ни в меню выделения над «Hello» (OLDSUI-154).
  await bubble();
  expect(screen.queryByRole("button", { name: /color/i })).toBeNull();
  await user.click(
    within(screen.getByRole("toolbar", { name: "Formatting" })).getByRole("button", {
      name: "More formatting",
    })
  );
  expect(screen.queryByRole("menuitem", { name: /color|Highlight/i })).toBeNull();
});
