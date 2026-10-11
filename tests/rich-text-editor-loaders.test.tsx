// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { createRef } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, expect, test, vi } from "vitest";
import {
  RICH_TEXT_PRESETS,
  RichTextEditor,
  type RichTextEditorHandle,
  type RichTextEditorProps,
} from "../src/editor/index.js";
import { resetDevWarnings } from "../src/lib/dev-warn.js";
import { testLazyTool } from "./editor-test-tools.js";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  resetDevWarnings();
});

/**
 * Загрузчики своих Инструментов, Готовность, Скелет и «Повторить» (OLDSUI-110,
 * ADR-0058, п. 11.3–11.6). Через публичный `RichTextEditor`: что видит автор
 * (Документ, роли, ошибка поля) и что получает экран (Хэндл, `onReady`).
 * Высота Скелета — в браузере (`tests-visual/rich-text-editor-skeleton.spec.ts`).
 */

const VALUE = '<p>Before</p><div data-block="test_lazy">Lazy text</div>';

function renderEditor(props: Partial<RichTextEditorProps>) {
  const ref = createRef<RichTextEditorHandle>();
  const onReady = vi.fn();
  const view = render(
    <RichTextEditor ref={ref} aria-label="Body" value={VALUE} onReady={onReady} {...props} />
  );
  return { ...view, ref, onReady };
}

/** Промисы загрузчиков и эффекты Редактора отработали. */
const settle = () =>
  act(async () => void (await new Promise((resolve) => setTimeout(resolve, 10))));

test("until the loader settles: the Skeleton shows the Document, no input, a quiet Handle, no onReady", async () => {
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  const lazy = testLazyTool();
  const { ref, onReady, container } = renderEditor({
    tools: [...RICH_TEXT_PRESETS.basic, lazy.tool],
  });
  await settle();

  expect(lazy.loader.calls).toBe(1);
  // Документ виден статичным HTML, Блок своего Инструмента — тоже; ввода нет.
  expect(screen.getByText("Before")).toBeTruthy();
  expect(screen.getByText("Lazy text")).toBeTruthy();
  expect(screen.queryByRole("textbox")).toBeNull();
  expect(container.querySelector("[contenteditable]")).toBeNull();
  // Хэндл тихий: движка нет, запись не проходит, чтение отдаёт входящее значение.
  expect(ref.current?.editor).toBeNull();
  expect(ref.current?.insertHTML("<p>Template</p>")).toBe(false);
  expect(ref.current?.getHTML()).toBe(VALUE);
  expect(onReady).not.toHaveBeenCalled();
  expect(error).not.toHaveBeenCalled();

  lazy.resolve();
  await settle();

  expect(screen.getByRole("textbox", { name: "Body" })).toBeTruthy();
  expect(onReady).toHaveBeenCalledTimes(1);
  expect(ref.current?.editor).not.toBeNull();
  // Схема собрана уже с Частью для движка: Блок из `value` не потерялся.
  expect(ref.current?.getHTML()).toBe(VALUE);
  expect(ref.current?.insertHTML("<p>Template</p>")).toBe(true);
  // Скелет ушёл: Документ на экране один.
  expect(screen.getAllByText("Lazy text")).toHaveLength(1);
});

test("two editors with one loader call it once", async () => {
  const lazy = testLazyTool();
  const first = renderEditor({ tools: [lazy.tool] });
  const second = renderEditor({ tools: [lazy.tool] });
  lazy.resolve();
  await settle();

  expect(lazy.loader.calls).toBe(1);
  expect(first.onReady).toHaveBeenCalledTimes(1);
  expect(second.onReady).toHaveBeenCalledTimes(1);
  expect(screen.getAllByRole("textbox")).toHaveLength(2);
});

test("a failed loader: a field error with Retry, the Document stays; Retry reaches Readiness", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const lazy = testLazyTool();
  const { ref, onReady } = renderEditor({ tools: [lazy.tool] });
  lazy.reject();
  await settle();

  expect(screen.getByRole("alert").textContent).toBe(
    "The editor couldn't start. The document is unchanged."
  );
  expect(screen.getByText("Lazy text")).toBeTruthy();
  expect(screen.queryByRole("textbox")).toBeNull();
  expect(ref.current?.editor).toBeNull();
  expect(onReady).not.toHaveBeenCalled();

  await userEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(lazy.loader.calls).toBe(2);
  // Пока повтор идёт — снова Скелет без ошибки.
  expect(screen.queryByRole("alert")).toBeNull();
  lazy.resolve();
  await settle();

  expect(screen.getByRole("textbox", { name: "Body" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
  expect(onReady).toHaveBeenCalledTimes(1);
  expect(ref.current?.getHTML()).toBe(VALUE);
});

test("Retry calls only the loaders that failed", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const fine = testLazyTool();
  const broken = testLazyTool("test_broken");
  renderEditor({ tools: [fine.tool, broken.tool] });
  fine.resolve();
  broken.reject();
  await settle();

  await userEvent.click(screen.getByRole("button", { name: "Retry" }));
  broken.resolve();
  await settle();

  expect(fine.loader.calls).toBe(1);
  expect(broken.loader.calls).toBe(2);
  expect(screen.getByRole("textbox", { name: "Body" })).toBeTruthy();
});

test("the loaded engine is checked like an immediate one: a broken set is a field error without Retry", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  // Загрузчик отдал Часть без Node для Блока из правил.
  const lazy = testLazyTool("test_lazy", []);
  const { ref, onReady } = renderEditor({ tools: [lazy.tool] });
  lazy.resolve();
  await settle();

  expect(screen.getByRole("alert").textContent).toBe(
    "The editor couldn't start. The document is unchanged."
  );
  // Повтор не поможет: набор не изменится.
  expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
  expect(screen.getByText("Lazy text")).toBeTruthy();
  expect(ref.current?.editor).toBeNull();
  expect(onReady).not.toHaveBeenCalled();
});

test("the server renders the Skeleton without the Document; hydration matches, then the Document shows", async () => {
  const onRecoverableError = vi.fn();
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  const lazy = testLazyTool();
  const ui = <RichTextEditor aria-label="Body" value={VALUE} tools={[lazy.tool]} />;

  const html = renderToString(ui);
  expect(html).not.toContain("Lazy text");
  expect(html).not.toMatch(/ contenteditable="/);

  const container = document.createElement("div");
  container.innerHTML = html;
  document.body.append(container);
  await act(async () => void hydrateRoot(container, ui, { onRecoverableError }));
  // После гидратации Скелет показывает Документ, очищенный Схемой.
  expect(container.textContent).toContain("Lazy text");
  lazy.resolve();
  await settle();

  expect(onRecoverableError).not.toHaveBeenCalled();
  expect(error).not.toHaveBeenCalled();
  expect(container.querySelector("[contenteditable=true]")).not.toBeNull();
  container.remove();
});

test("without loaders the Skeleton is there too: the server renders the frame, not the Document", () => {
  const html = renderToString(<RichTextEditor aria-label="Body" value="<p>Static text</p>" />);

  expect(html).not.toContain("Static text");
  // Рамка с местом Панели есть и на сервере: появление Панели поле не сдвигает.
  expect(html).toContain("h-[30px]");
});
