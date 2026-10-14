// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useRef } from "react";
import { afterEach, beforeAll, beforeEach, expect, test, vi } from "vitest";
import {
  RICH_TEXT_PRESETS,
  RichTextEditor,
  useRichTextToolState,
  type RichTextEditorHandle,
  type TocToolState,
} from "../src/editor/index.js";
import { loadLazyBuiltins } from "./editor-lazy-builtins.js";
import { installPageGeometry, page } from "./editor-toc-geometry.js";

/**
 * Текущий раздел в Состоянии `toc` и подсвеченный штрих полосы (OLDSUI-268) — одно
 * и то же значение без единой прокрутки: сразу после загрузки ленивого ядра
 * Оглавления и после выхода из HTML-режима, где ядро размонтировано.
 *
 * Файл НЕ прогревает чанк ядра (`RichTextToc.js`): первая проверка идёт ровно в
 * том порядке, в каком его увидит экран, — Редактор нарисован, ядро ещё грузится.
 * Прогрев тут поставил бы тест в зависимость от порядка проверок.
 */

beforeAll(loadLazyBuiltins);

let removeGeometry: () => void;

beforeEach(() => {
  removeGeometry = installPageGeometry();
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  removeGeometry();
});

const ARTICLE = "<h1>One</h1><p>x</p><h2>Two</h2><p>x</p><h2>Three</h2><p>x</p><h2>Four</h2>";

let snapshot: TocToolState | null = null;

function Screen() {
  const ref = useRef<RichTextEditorHandle>(null);
  snapshot = useRichTextToolState(ref, "toc");
  return (
    <RichTextEditor
      ref={ref}
      aria-label="Body"
      defaultValue={ARTICLE}
      tools={[...RICH_TEXT_PRESETS.full, "toc"]}
    />
  );
}

const strip = () => screen.queryByRole("button", { name: "Table of contents" });
/** Индекс штриха, подсвеченного как текущий. */
const marked = () =>
  [...(strip()?.querySelectorAll("[data-toc-stroke]") ?? [])].findIndex((stroke) =>
    stroke.hasAttribute("data-current")
  );

test("the current section in the State is the highlighted stroke as soon as the lazy core has loaded", async () => {
  // Страница уже прокручена: третий заголовок у верхнего края.
  page.scrolledTo = 2;
  render(<Screen />);

  // Ядро ещё не пришло: полосы нет, а снимок отдаёт заголовки.
  expect(snapshot?.headings).toHaveLength(4);
  await waitFor(() => expect(marked()).toBe(2));
  expect(snapshot?.current).toBe(2);
});

test("the current section in the State is the highlighted stroke after leaving the HTML mode", async () => {
  const user = userEvent.setup();
  page.scrolledTo = 1;
  render(<Screen />);
  await waitFor(() => expect(marked()).toBe(1));
  expect(snapshot?.current).toBe(1);

  await user.click(screen.getByRole("button", { name: "HTML" }));
  expect(strip()).toBeNull();

  // Читатель вернулся в визуальный режим: ядро смонтировано заново, прокрутка — другая.
  page.scrolledTo = 3;
  await user.click(screen.getByRole("button", { name: "HTML" }));
  await waitFor(() => expect(marked()).toBe(3));
  expect(snapshot?.current).toBe(3);
});
