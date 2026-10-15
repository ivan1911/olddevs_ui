// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { createRef, useRef } from "react";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import { UiProvider } from "../src/i18n/UiProvider.js";
import { messages as ru } from "../src/locales/ru.js";
import {
  RICH_TEXT_PRESETS,
  RichTextEditor,
  tool,
  useRichTextToolState,
  type RichTextEditorHandle,
  type RichTextEditorProps,
} from "../src/editor/index.js";
import { PRESETS, TOOLS } from "../src/editor/core/tools.js";
import { loadLazyBuiltins } from "./editor-lazy-builtins.js";

// Ленивые `codeBlock` и `table`: `full` готов в `render` после загрузки чанков.
beforeAll(loadLazyBuiltins);

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/**
 * Невидимые символы (OLDSUI-278): Инструмент `invisibleCharacters` на расширении
 * Invisible Characters из Tiptap. Decoration поверх Документа — через публичный
 * `RichTextEditor` с конкретным `tools`: что видит автор (кнопка, знаки в DOM) и
 * что получает владелец (`onChange`, `getHTML()`, Состояние и Команда).
 */
function renderEditor(props: Partial<RichTextEditorProps> = {}) {
  const ref = createRef<RichTextEditorHandle>();
  const view = render(<RichTextEditor ref={ref} aria-label="Body" {...props} />);
  const handle = ref.current;
  if (!handle?.editor) throw new Error("the editor was not created inside render()");
  return { ...view, handle, editor: handle.editor };
}

const TOOLS_WITH = ["bold", "invisibleCharacters"] as const;
const CONTENT = "<p>one two</p><p>three<br>four</p><p></p>";

const button = () =>
  screen.queryByRole<HTMLButtonElement>("button", { name: "Invisible characters" });

/** Знаки в DOM Документа по виду: `space`, `break`, `paragraph`. */
function marks() {
  const count = (kind: string) =>
    document.querySelectorAll(`.tiptap-invisible-character--${kind}`).length;
  return { space: count("space"), break: count("break"), paragraph: count("paragraph") };
}

const HIDDEN = { space: 0, break: 0, paragraph: 0 };
const SHOWN = { space: 1, break: 1, paragraph: 3 };

test("the toolbar button shows and hides spaces, hard breaks and paragraph ends", async () => {
  const user = userEvent.setup();
  renderEditor({ tools: [...TOOLS_WITH], defaultValue: CONTENT });

  expect(button()?.getAttribute("aria-pressed")).toBe("false");
  expect(marks()).toEqual(HIDDEN);

  await user.click(button()!);
  expect(button()?.getAttribute("aria-pressed")).toBe("true");
  expect(marks()).toEqual(SHOWN);

  await user.click(button()!);
  expect(button()?.getAttribute("aria-pressed")).toBe("false");
  expect(marks()).toEqual(HIDDEN);
});

test("showing the marks leaves the value, onChange and the saved HTML alone", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  const { handle } = renderEditor({
    tools: [...TOOLS_WITH],
    defaultValue: CONTENT,
    onChange,
  });
  const before = handle.getHTML();

  await user.click(button()!);
  expect(marks()).toEqual(SHOWN);
  expect(handle.getHTML()).toBe(before);
  expect(handle.getHTML()).not.toContain("tiptap-invisible-character");
  expect(handle.getMarkdown()).not.toContain("·");

  // Правка при включённом показе: знаки следуют за текстом, в HTML их по-прежнему нет.
  act(() => void handle.editor!.chain().insertContentAt(4, " ").run());
  expect(marks().space).toBe(2);
  expect(handle.getHTML()).not.toContain("tiptap-invisible-character");

  await user.click(button()!);
  // Единственный `onChange` — от вставленного пробела, а не от показа и скрытия.
  await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
  expect(String(onChange.mock.calls[0]![0])).toBe(handle.getHTML());
  expect(String(onChange.mock.calls[0]![0])).not.toContain("invisible");
});

test("handle.tool().toggle() does the same as the button and reports success", async () => {
  const onChange = vi.fn();
  const { handle } = renderEditor({ tools: [...TOOLS_WITH], defaultValue: CONTENT, onChange });
  const before = handle.getHTML();

  const commands = handle.tool("invisibleCharacters");
  expect(commands).not.toBeNull();

  let result = false;
  act(() => void (result = commands!.toggle()));
  expect(result).toBe(true);
  expect(marks()).toEqual(SHOWN);
  expect(button()?.getAttribute("aria-pressed")).toBe("true");

  act(() => void commands!.toggle());
  expect(marks()).toEqual(HIDDEN);
  expect(button()?.getAttribute("aria-pressed")).toBe("false");

  expect(handle.getHTML()).toBe(before);
  // `onChange` отложенный: даём ему время прийти, если бы переключение его вызвало.
  await act(() => new Promise((resolve) => setTimeout(resolve, 150)));
  expect(onChange).not.toHaveBeenCalled();
});

test("handle.tool() is null without the tool", () => {
  const { handle } = renderEditor({ tools: ["bold"] });
  expect(handle.tool("invisibleCharacters")).toBeNull();
});

test("the option visible: true shows the marks from the start", () => {
  renderEditor({
    tools: ["bold", tool("invisibleCharacters", { visible: true })],
    defaultValue: CONTENT,
  });
  expect(button()?.getAttribute("aria-pressed")).toBe("true");
  expect(marks()).toEqual(SHOWN);
});

test("the marks are hidden by default, including in the full preset", () => {
  renderEditor({ defaultValue: CONTENT });
  expect(button()?.getAttribute("aria-pressed")).toBe("false");
  expect(marks()).toEqual(HIDDEN);
});

test("an option that is not a boolean falls back to the default and warns in development", () => {
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  renderEditor({
    tools: ["bold", tool("invisibleCharacters", { visible: "yes" as never })],
    defaultValue: CONTENT,
  });
  expect(marks()).toEqual(HIDDEN);
  expect(error).toHaveBeenCalledWith(
    expect.stringContaining('tool "invisibleCharacters": ignored invalid options: visible')
  );
});

test("the state hook reports visible and follows the button and the command", async () => {
  const user = userEvent.setup();
  const seen: ({ visible: boolean } | null)[] = [];
  const handle = createRef<RichTextEditorHandle>();

  function Screen() {
    const state = useRichTextToolState(handle, "invisibleCharacters");
    seen.push(state);
    return (
      <>
        <output aria-label="visible">{String(state?.visible)}</output>
        <RichTextEditor
          ref={handle}
          aria-label="Body"
          tools={[...TOOLS_WITH]}
          defaultValue={CONTENT}
        />
      </>
    );
  }

  render(<Screen />);
  // Движок создаётся после первого рендера экрана: до того хук молчит.
  expect(seen[0]).toBeNull();
  expect(seen.at(-1)).toEqual({ visible: false });

  await user.click(button()!);
  expect(screen.getByLabelText("visible").textContent).toBe("true");

  act(() => void handle.current!.tool("invisibleCharacters")!.toggle());
  expect(screen.getByLabelText("visible").textContent).toBe("false");
});

test("the state hook is null when the tool is not in the set", () => {
  let state: unknown = "unset";
  function Screen() {
    const ref = useRef<RichTextEditorHandle>(null);
    state = useRichTextToolState(ref, "invisibleCharacters");
    return <RichTextEditor ref={ref} aria-label="Body" tools={["bold"]} />;
  }
  render(<Screen />);
  expect(state).toBeNull();
});

test("the button is on the fixed toolbar only: not floating, not bubble, not read-only", () => {
  for (const props of [
    { toolbar: "floating" },
    { toolbar: "bubble" },
    { toolbar: "none" },
    { readOnly: true },
  ] as const) {
    const { editor } = renderEditor({ ...props, tools: [...TOOLS_WITH], defaultValue: CONTENT });
    // Над выделением плавающая Панель и плашка показываются — кнопки нет и там.
    act(() => void editor.commands.setTextSelection({ from: 1, to: 4 }));
    expect(button(), JSON.stringify(props)).toBeNull();
    cleanup();
  }
});

test("the button needs the tool: not with basic, not without the name", () => {
  renderEditor({ preset: "basic" });
  expect(button()).toBeNull();
  cleanup();

  renderEditor({ tools: ["bold", "italic"] });
  expect(button()).toBeNull();
});

test("the full preset includes the tool, the basic one does not", () => {
  expect(PRESETS.full).toContain("invisibleCharacters");
  expect(PRESETS.basic).not.toContain("invisibleCharacters");
  expect(RICH_TEXT_PRESETS.full).toContain("invisibleCharacters");
  expect(RICH_TEXT_PRESETS.basic).not.toContain("invisibleCharacters");
  expect(TOOLS).toContain("invisibleCharacters");

  renderEditor({ preset: "full" });
  expect(button()).not.toBeNull();
});

test("the button sits at the right edge before Find, and the arrows reach it", async () => {
  const user = userEvent.setup();
  renderEditor({ defaultValue: CONTENT });

  const toolbar = screen.getByRole("toolbar", { name: "Formatting" });
  const names = Array.from(toolbar.querySelectorAll("button"), (node) =>
    node.getAttribute("aria-label")
  );
  const at = names.indexOf("Invisible characters");
  expect(names.slice(at)).toEqual(["Invisible characters", "Find", "Keyboard shortcuts"]);

  button()!.focus();
  await user.keyboard("{ArrowRight}");
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Find" }));
  await user.keyboard("{ArrowLeft}");
  expect(document.activeElement).toBe(button());
  // Клавиатурное нажатие переключает так же, как щелчок.
  await user.keyboard("{Enter}");
  expect(button()?.getAttribute("aria-pressed")).toBe("true");
  await user.keyboard(" ");
  expect(button()?.getAttribute("aria-pressed")).toBe("false");
});

test("in HTML mode the button is aria-disabled, stays in the arrow order and does nothing", async () => {
  const user = userEvent.setup();
  const { handle } = renderEditor({ defaultValue: CONTENT });
  await user.click(screen.getByRole("button", { name: "HTML" }));

  expect(button()?.getAttribute("aria-disabled")).toBe("true");
  expect(button()?.hasAttribute("disabled")).toBe(false);
  await user.click(button()!);
  expect(button()?.getAttribute("aria-pressed")).toBe("false");
  expect(handle.tool("invisibleCharacters")!.toggle()).toBe(false);

  await user.click(screen.getByRole("button", { name: "HTML" }));
  expect(marks()).toEqual(HIDDEN);
  expect(button()?.hasAttribute("aria-disabled")).toBe(false);
});

test("a disabled field disables the button", () => {
  renderEditor({ disabled: true, defaultValue: CONTENT });
  expect(button()?.disabled).toBe(true);
});

test("the button name and tooltip come from the Russian catalog", () => {
  render(
    <UiProvider messages={ru}>
      <RichTextEditor aria-label="Body" tools={[...TOOLS_WITH]} />
    </UiProvider>
  );
  expect(screen.getByRole("button", { name: ru.editor.invisibleCharacters })).not.toBeNull();
  expect(ru.editor.invisibleCharacters).not.toBe("Invisible characters");
});

test("no style tag of the extension lands in the page head", () => {
  renderEditor({ tools: [...TOOLS_WITH], defaultValue: CONTENT });
  expect(
    document.querySelector("style[data-tiptap-extension-invisible-characters-style]")
  ).toBeNull();
});
