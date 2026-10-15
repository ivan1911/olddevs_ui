// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, expect, test, vi } from "vitest";
import {
  RichTextEditor,
  type RichTextEditorHandle,
  type RichTextEditorProps,
} from "../src/editor/index.js";

afterEach(cleanup);

/**
 * Ленивые встроенные `codeBlock` и `table` (OLDSUI-111, ADR-0058, п. 11.1):
 * их Extensions грузятся тем же загрузчиком, что у своего Инструмента.
 * `basic`, где их нет, не грузит их вовсе и готов сразу; `full` до загрузки
 * обоих чанков показывает Скелет и доходит до Готовности после них.
 *
 * Модуль чанка подменён обёрткой, которая только отмечает импорт: так видно,
 * звался ли он. Подмена — граница сети, а не внутренности: содержимое чанка —
 * настоящее.
 */
const imported = vi.hoisted(() => [] as string[]);

vi.mock("../src/editor/features/code/codeBlock.js", async (original) => {
  imported.push("codeBlock");
  return original();
});

vi.mock("../src/editor/features/table/tables.js", async (original) => {
  imported.push("table");
  return original();
});

const VALUE =
  '<p>Intro</p><pre><code class="language-python">print(1)</code></pre>' +
  "<table><tbody><tr><th><p>Name</p></th></tr><tr><td><p>Ada</p></td></tr></tbody></table>";

function renderEditor(props: Partial<RichTextEditorProps>) {
  const ref = createRef<RichTextEditorHandle>();
  const onReady = vi.fn();
  const view = render(<RichTextEditor ref={ref} aria-label="Body" onReady={onReady} {...props} />);
  return { ...view, ref, onReady };
}

/** Таймеры и эффекты Редактора отработали. */
const settle = () =>
  act(async () => void (await new Promise((resolve) => setTimeout(resolve, 20))));

// Порядок тестов значим: кэш загрузчика живёт на модуле, и первый `full` его греет.

test("basic loads neither chunk and is ready inside render", async () => {
  const { ref, onReady } = renderEditor({ preset: "basic", value: "<p>Comment</p>" });

  expect(ref.current?.editor).not.toBeNull();
  expect(onReady).toHaveBeenCalledTimes(1);
  await settle();
  expect(imported).toEqual([]);
});

test("full shows the Skeleton until both chunks load, then reaches Readiness without losing blocks", async () => {
  const { ref, onReady, container } = renderEditor({ value: VALUE });

  // Скелет, пока чанки едут: Документ статичным HTML, ввода нет, Готовности нет.
  expect(screen.getByText("print(1)")).toBeTruthy();
  expect(screen.getByText("Ada")).toBeTruthy();
  expect(container.querySelector("[contenteditable]")).toBeNull();
  expect(ref.current?.editor).toBeNull();
  expect(onReady).not.toHaveBeenCalled();
  // Блоки видны своей формой, а не текстом: блок кода с языком и шапкой, таблица
  // со строкой-заголовком — поле не прыгает с приходом чанков.
  expect(container.querySelector("pre > code.language-python")?.textContent).toBe("print(1)");
  expect(container.querySelector("[data-code-header]")?.textContent).toBe("Python");
  expect(container.querySelector("table > tbody > tr > th")?.textContent).toBe("Name");

  expect(await screen.findByRole("textbox", { name: "Body" }, { timeout: 10_000 })).toBeTruthy();
  expect([...imported].sort()).toEqual(["codeBlock", "table"]);
  expect(onReady).toHaveBeenCalledTimes(1);
  // Схема собрана с Extensions обоих Инструментов: блок кода с языком и таблица из `value` на месте.
  expect(ref.current?.getHTML()).toBe(VALUE);
  // Меню «Таблица» и окно вставки — из того же чанка.
  expect(screen.getByRole("button", { name: "Table" })).toBeTruthy();
});

test("a second full editor finds the chunks loaded and is ready inside render", () => {
  const { ref, onReady } = renderEditor({ value: VALUE });

  expect(ref.current?.editor).not.toBeNull();
  expect(onReady).toHaveBeenCalledTimes(1);
  expect(ref.current?.getHTML()).toBe(VALUE);
});
