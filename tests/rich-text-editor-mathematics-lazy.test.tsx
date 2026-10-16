// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, expect, test, vi } from "vitest";
import {
  RICH_TEXT_PRESETS,
  RichTextEditor,
  type RichTextEditorHandle,
  type RichTextEditorProps,
} from "../src/editor/index.js";
import { PRESETS } from "../src/editor/core/tools.js";

afterEach(cleanup);

/**
 * `mathematics` ленив и вне пресетов (OLDSUI-280, ADR-0070, ADR-0058, п. 11.1).
 *
 * Модули чанка и KaTeX подменены обёртками, которые только отмечают импорт: так
 * видно, звался ли он. Подмена — граница сети, а не внутренности: содержимое
 * модулей настоящее. Кэш загрузчика живёт на модуле, поэтому порядок тестов
 * значим: `basic` и `full` идут раньше всех, пока чанк никто не грузил.
 */
const imported = vi.hoisted(() => [] as string[]);

vi.mock("../src/editor/features/mathematics/mathChunk.js", async (original) => {
  imported.push("chunk");
  return original();
});

vi.mock("../src/editor/features/mathematics/katexEngine.js", async (original) => {
  imported.push("katex");
  return original();
});

const VALUE =
  '<p>Euler <span data-type="inline-math" data-latex="e^{i\\pi}+1=0"></span> done</p>' +
  '<div data-type="block-math" data-latex="\\int_0^1 x\\,dx"></div>';

function renderEditor(props: Partial<RichTextEditorProps>) {
  const ref = createRef<RichTextEditorHandle>();
  const onReady = vi.fn();
  const view = render(<RichTextEditor ref={ref} aria-label="Body" onReady={onReady} {...props} />);
  return { ...view, ref, onReady };
}

/** Таймеры и эффекты Редактора отработали. */
const settle = () =>
  act(async () => void (await new Promise((resolve) => setTimeout(resolve, 30))));

test("neither preset names the tool, and basic and full never load the chunk or KaTeX", async () => {
  expect(PRESETS.full).not.toContain("mathematics");
  expect(PRESETS.basic).not.toContain("mathematics");
  expect(RICH_TEXT_PRESETS.full).not.toContain("mathematics");
  expect(RICH_TEXT_PRESETS.basic).not.toContain("mathematics");

  // `full` ждёт свои чанки (блок кода, таблица), `basic` готов сразу.
  const basic = renderEditor({ preset: "basic", value: VALUE });
  expect(basic.ref.current?.editor).not.toBeNull();
  const full = renderEditor({ preset: "full", value: VALUE });
  // Скелет `full` читает формулы текстом, как и движок: LaTeX не пропадает ни там, ни там.
  expect(full.container.textContent).toContain("Euler $e^{i\\pi}+1=0$ done");
  await waitFor(() => expect(full.onReady).toHaveBeenCalledTimes(1), { timeout: 10_000 });
  await settle();

  expect(full.ref.current?.editor).not.toBeNull();
  expect(imported).toEqual([]);
  // Формулы без Инструмента — текстом, а не потерей (`mathAsText.ts`).
  expect(full.ref.current?.getHTML()).toContain("<p>Euler $e^{i\\pi}+1=0$ done</p>");
});

test("with the tool the Skeleton shows the LaTeX source, then the chunk brings KaTeX and the field is ready", async () => {
  const { ref, onReady, container } = renderEditor({
    tools: ["bold", "insertMenu", "mathematics"],
    value: VALUE,
  });

  // Скелет, пока чанк едет: Документ статичным HTML, ввода нет, Готовности нет.
  expect(container.querySelector("[contenteditable]")).toBeNull();
  expect(ref.current?.editor).toBeNull();
  expect(onReady).not.toHaveBeenCalled();
  // Формулы видны своей формой с исходным LaTeX текстом (CSS красит его моноширинным),
  // а не пустыми местами: тот же разбор `data-latex`, что у движка.
  const inline = container.querySelector('span[data-type="inline-math"]');
  expect(inline?.textContent).toBe("e^{i\\pi}+1=0");
  expect(inline?.getAttribute("data-latex")).toBe("e^{i\\pi}+1=0");
  expect(container.querySelector('div[data-type="block-math"]')?.textContent).toBe(
    "\\int_0^1 x\\,dx"
  );
  expect(container.querySelector(".katex")).toBeNull();

  expect(await screen.findByRole("textbox", { name: "Body" }, { timeout: 10_000 })).toBeTruthy();
  expect(imported).toContain("chunk");
  expect(onReady).toHaveBeenCalledTimes(1);
  // KaTeX и CSS приехали вместе с чанком; формулы отрисованы, а HTML — прежний, без разметки KaTeX.
  expect(imported).toContain("katex");
  expect(container.querySelectorAll(".katex").length).toBeGreaterThanOrEqual(2);
  expect(ref.current?.getHTML()).toBe(
    '<p>Euler <span data-latex="e^{i\\pi}+1=0" data-type="inline-math"></span> done</p>' +
      '<div data-latex="\\int_0^1 x\\,dx" data-type="block-math"></div>'
  );
});

test("a second editor with the tool finds the chunk loaded and is ready inside render", () => {
  const { ref, onReady } = renderEditor({ tools: ["mathematics"], value: VALUE });

  expect(ref.current?.editor).not.toBeNull();
  expect(onReady).toHaveBeenCalledTimes(1);
});
