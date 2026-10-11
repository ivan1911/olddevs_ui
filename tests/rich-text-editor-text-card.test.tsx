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

// Ленивые `codeBlock` и `table` (OLDSUI-111): `full` готов в `render` после загрузки чанков.
beforeAll(loadLazyBuiltins);

// Карточка грузится лениво (`RichTextEditor.tsx`): чанк прогрет заранее, а `render` ждёт его в `act`.
beforeAll(() => import("../src/editor/ui/TextCard.js"));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  resetDevWarnings();
});

/**
 * Карточка у текста (OLDSUI-113, ADR-0058, п. 7.6–7.11).
 *
 * Через публичный `RichTextEditor` с тестовыми Метками из общего помощника:
 * роли, имена и текст, которые видит автор. Каретка и выделение ставятся
 * командами движка — jsdom не умеет ввода и раскладки. Положение Карточки и
 * переворот у края окна меряет браузер (`tests-visual`).
 *
 * Документ: «One |two three| four», Метка-замечание на «two three» (5–14).
 */
const SAMPLE = '<p>One <span data-mark="test_remark">two three</span> four</p>';
const INSIDE = 8;
const OUTSIDE = 2;

/** `render`, который дожидается ленивой Карточки. */
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

/** Фокус в Документ и каретка в позицию. */
function caretAt(editor: Engine, pos: number) {
  act(() => {
    editor.view.focus();
    editor.commands.setTextSelection(pos);
  });
}

/** Сочетание в документе — так, как его слышит движок: `keydown` на редактируемой области. */
function press(editor: Engine, init: KeyboardEventInit) {
  act(() => {
    editor.view.dom.dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init })
    );
  });
}

/**
 * Щелчок по Метке. Настоящий `user.click` до `click` не доходит: ProseMirror на
 * `mousedown` меряет позицию по координатам, а jsdom их не знает
 * (`elementFromPoint`). Каретку в редактируемом поле ставит `mouseup` браузера
 * — её тест ставит командой, а сам `click` шлёт событием.
 */
const markOf = (editor: Engine) =>
  editor.view.dom.querySelector('[data-mark="test_remark"]') as HTMLElement;
const clickMark = (editor: Engine) => act(() => void fireEvent.click(markOf(editor)));

const card = (name = "Remark") => screen.queryByRole("dialog", { name });

/** Фокус стоит в Документе, а не в Панели или Карточке. */
const focusInDocument = (editor: Engine) => expect(document.activeElement).toBe(editor.view.dom);

// ── Открытие ──────────────────────────────────────────────────────────────

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

  // Щелчок ставит каретку в диапазон (`mouseup`), и `click` застаёт её там.
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
  // Вставка до диапазона сдвинула его, каретка — вместе с ним.
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

// ── Несколько Карточек ────────────────────────────────────────────────────

const OVERLAP =
  '<p>One <span data-mark="test_topic">alpha <span data-mark="test_remark">beta</span> gamma</span> end</p>';

test("of overlapping ranges the narrowest opens", async () => {
  const { editor } = await renderEditor({
    defaultValue: OVERLAP,
    tools: [...RICH_TEXT_PRESETS.full, testTopicTool, testRemarkTool],
  });

  // «beta» (11–15) внутри «alpha beta gamma» (5–22): самый узкий — замечание.
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

// ── Клавиатура и фокус ────────────────────────────────────────────────────

test("Alt+F10 moves the focus into the open card, Escape returns the caret and hides it", async () => {
  const { editor } = await renderEditor();
  caretAt(editor, INSIDE);

  press(editor, { key: "F10", altKey: true });
  expect(card()!.contains(document.activeElement)).toBe(true);
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Reply" }));

  // Escape в Карточке: Radix слушает документ, и верхний слой — она.
  act(() => {
    document.activeElement!.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })
    );
  });
  expect(card()).toBeNull();
  focusInDocument(editor);
  // Каретка на прежнем месте.
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

  // Правка внутри диапазона и сдвиг каретки по нему карточку не возвращают…
  act(() => void editor.commands.insertContent("x"));
  caretAt(editor, 9);
  expect(card()).toBeNull();

  // …а выход из диапазона и возвращение — возвращают.
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

  // Каретка не двигалась, но щелчок по диапазону открывает Карточку снова.
  clickMark(editor);
  expect(card()).not.toBeNull();
});

test("while the card is hidden Alt+F10 leads to the toolbar", async () => {
  const { editor } = await renderEditor();
  caretAt(editor, INSIDE);

  // Открыта — Alt+F10 ведёт в Карточку.
  press(editor, { key: "F10", altKey: true });
  expect(card()!.contains(document.activeElement)).toBe(true);
  act(() => {
    document.activeElement!.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })
    );
  });
  expect(card()).toBeNull();

  // Спрятана — та же клавиша ведёт в Панель.
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

// ── Скринридер и язык ─────────────────────────────────────────────────────

test("the appearance is announced with the entry label and the shortcut", async () => {
  const { editor } = await renderEditor();
  // Живой регион кита, не регион Сообщения поля: он пуст, пока Карточки нет.
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

  // Подпись — функция от локали `UiProvider`: `de` даёт «Anmerkung».
  expect(screen.getByRole("dialog", { name: "Anmerkung" })).toBeDefined();
  const spoken = ru.editor.textCardShown({ label: "Anmerkung", shortcut: "Alt+F10" });
  expect(screen.getAllByRole("status").map((region) => region.textContent)).toContain(spoken);
  // Фраза ru-каталога — не английская.
  expect(spoken).not.toMatch(/card opened/);
});

// ── Режимы поля ───────────────────────────────────────────────────────────

test("a readOnly field opens the card by a click", async () => {
  const user = userEvent.setup();
  const { editor } = await renderEditor({ readOnly: true });

  clickMark(editor);
  expect(card()).not.toBeNull();
  expect(screen.queryByRole("toolbar")).toBeNull();

  // Щелчок по тексту мимо диапазона закрывает, щелчок мимо поля — тоже.
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

// ── Проверка набора ───────────────────────────────────────────────────────

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
  // Исключение — разработчику, отдельным аргументом: текст остаётся ключом «один раз».
  expect(error).toHaveBeenCalledWith(
    expect.stringMatching(/^RichTextEditor: text card "test_remark-textCard0" threw in rangeAt$/),
    expect.objectContaining({ message: "boom" })
  );
  // Поле живо.
  act(() => void editor.commands.insertContent("x"));
  expect(editor.getText()).toContain("x");
});
