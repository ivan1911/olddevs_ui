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
 * Чанк видео ленивый (OLDSUI-281, ADR-0058, п. 11.1): плеер, поле ссылки и узел
 * грузятся Загрузчиком, и только у Редактора с `youtube` или `twitch` в `tools`.
 * `full` и `basic` его не грузят; Редактор с видео показывает Скелет — блок
 * ссылкой, как видит его читатель без JS, — и доходит до Готовности после чанка.
 *
 * Модуль чанка подменён обёрткой, которая только отмечает импорт (как в
 * `rich-text-editor-lazy-builtins.test.tsx`): содержимое чанка — настоящее.
 */
const imported = vi.hoisted(() => [] as string[]);

vi.mock("../src/editor/features/video/videoChunk.js", async (original) => {
  imported.push("video");
  return original();
});

const YT = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
const VALUE =
  "<p>Intro</p>" +
  `<div data-block="video" data-provider="youtube" data-src="${YT}"><a href="${YT}" rel="noopener noreferrer">${YT}</a></div>`;

function renderEditor(props: Partial<RichTextEditorProps>) {
  const ref = createRef<RichTextEditorHandle>();
  const onReady = vi.fn();
  const view = render(<RichTextEditor ref={ref} aria-label="Body" onReady={onReady} {...props} />);
  return { ...view, ref, onReady };
}

const settle = () =>
  act(async () => void (await new Promise((resolve) => setTimeout(resolve, 20))));

// Порядок тестов значим: кэш загрузчика живёт на модуле, и первый Редактор с видео его греет.

test("basic does not load the video chunk", async () => {
  const { onReady } = renderEditor({ preset: "basic", value: "<p>Comment</p>" });
  expect(onReady).toHaveBeenCalledTimes(1);
  await settle();
  expect(imported).toEqual([]);
});

test("full does not load the video chunk, and a video block in its value is a link", async () => {
  const { ref, onReady } = renderEditor({ value: VALUE });
  expect(await screen.findByRole("textbox", { name: "Body" }, { timeout: 10_000 })).toBeTruthy();
  expect(onReady).toHaveBeenCalledTimes(1);
  await settle();
  expect(imported).toEqual([]);
  expect(ref.current?.getHTML()).toBe(
    `<p>Intro</p><p><a href="${YT}" rel="noopener noreferrer">${YT}</a></p>`
  );
});

test("an editor with the video tools shows the link as a Skeleton, then is ready with the block", async () => {
  const { ref, onReady, container } = renderEditor({
    tools: ["youtube", "twitch", "link"],
    value: VALUE,
  });

  // Скелет: блок видим как блок со ссылкой, поля ввода и Готовности ещё нет.
  expect(container.querySelector("[contenteditable]")).toBeNull();
  expect(ref.current?.editor).toBeNull();
  expect(onReady).not.toHaveBeenCalled();
  expect(container.querySelector(`div[data-block="video"] > a[href="${YT}"]`)).not.toBeNull();
  // До щелчка нет и самого плеера: ни `iframe`, ни кнопки.
  expect(container.querySelector("iframe")).toBeNull();

  expect(await screen.findByRole("textbox", { name: "Body" }, { timeout: 10_000 })).toBeTruthy();
  // Оба Инструмента делят один чанк: он грузится один раз.
  expect(imported).toEqual(["video"]);
  expect(onReady).toHaveBeenCalledTimes(1);
  expect(ref.current?.getHTML()).toBe(VALUE);
  expect(screen.getByRole("button", { name: "Play YouTube video" })).toBeTruthy();
});

test("a second editor with the video tools finds the chunk loaded and is ready inside render", () => {
  const { ref, onReady } = renderEditor({ tools: ["twitch"], value: "<p>Comment</p>" });
  expect(ref.current?.editor).not.toBeNull();
  expect(onReady).toHaveBeenCalledTimes(1);
  expect(imported).toEqual(["video"]);
});
