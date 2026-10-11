// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeAll, beforeEach, expect, test, vi } from "vitest";
import { RICH_TEXT_PRESETS, RichTextEditor } from "../src/editor/index.js";
import { resetDevWarnings } from "../src/lib/dev-warn.js";
import { testLazyTool } from "./editor-test-tools.js";
import { loadLazyBuiltins } from "./editor-lazy-builtins.js";

// Ленивые `codeBlock` и `table` (OLDSUI-111): `full` готов в `render` после загрузки чанков.
beforeAll(loadLazyBuiltins);

/**
 * Скелет и безопасность (OLDSUI-110, исправление): до Готовности Скелет
 * показывает Документ, очищенный Схемой кита, и только в браузере — после
 * монтирования. Строка `value` разбирается в инертном документе по Схеме
 * встроенных Инструментов набора, так что обработчики, скрипты и чужие схемы
 * адресов в страницу не попадают и не исполняются. На сервере и до гидратации
 * Скелет — рамка поля и место Панели, без Документа. Через публичный
 * `RichTextEditor`; загрузчик своего Инструмента держит Скелет на экране.
 */

declare global {
  interface Window {
    skeletonSpy?: (source: string) => void;
  }
}

const spy = vi.fn();

beforeEach(() => {
  spy.mockClear();
  window.skeletonSpy = spy;
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  resetDevWarnings();
  delete window.skeletonSpy;
});

const settle = () =>
  act(async () => void (await new Promise((resolve) => setTimeout(resolve, 10))));

/** Документ Скелета: статичный блок поля без ввода, где стоит этот текст. */
function skeletonOf(text: string): HTMLElement {
  const node = screen.getByText(text);
  const skeleton = node.closest<HTMLElement>("[class*='min-h-24']");
  if (!skeleton) throw new Error("no Skeleton around the text");
  expect(skeleton.closest("[contenteditable]")).toBeNull();
  return skeleton;
}

const HOSTILE =
  `<p onclick="window.skeletonSpy('p')">Click me</p>` +
  `<img src="x" onerror="window.skeletonSpy('img')">` +
  `<img src="https://example.com/cat.png" alt="Cat" onerror="window.skeletonSpy('img2')">` +
  `<script>window.skeletonSpy('script')</script>` +
  `<p><a href="javascript:window.skeletonSpy('a')">Bad link</a></p>` +
  `<p><a href="JaVaScRiPt:window.skeletonSpy('A')" onmouseover="window.skeletonSpy('over')">Odd link</a></p>`;

test("the Skeleton does not carry handlers, scripts and javascript: links from value", async () => {
  const lazy = testLazyTool();
  const { container } = render(
    <RichTextEditor
      aria-label="Body"
      value={HOSTILE}
      tools={[...RICH_TEXT_PRESETS.full, lazy.tool]}
    />
  );
  await settle();

  // Движка ещё нет: на экране Скелет.
  expect(screen.queryByRole("textbox")).toBeNull();
  const skeleton = skeletonOf("Click me");

  // Ни обработчиков, ни скриптов, ни `javascript:` — нигде в поле.
  expect(container.querySelector("script")).toBeNull();
  for (const element of container.querySelectorAll("*")) {
    for (const attribute of element.getAttributeNames()) {
      expect(attribute.startsWith("on"), `${element.tagName} ${attribute}`).toBe(false);
    }
  }
  expect(container.innerHTML).not.toMatch(/javascript:/i);
  expect(container.innerHTML).not.toContain("skeletonSpy");

  // Ссылки остались текстом без адреса, картинка с допустимым адресом — без обработчика.
  expect(within(skeleton).getByText("Bad link").closest("a")?.hasAttribute("href") ?? false).toBe(
    false
  );
  const cat = within(skeleton).getByRole("img", { name: "Cat" });
  expect(cat.getAttribute("src")).toBe("https://example.com/cat.png");

  await userEvent.click(screen.getByText("Click me"));
  await userEvent.click(screen.getByText("Bad link"));
  await userEvent.hover(screen.getByText("Odd link"));
  cat.dispatchEvent(new Event("error"));
  expect(spy).not.toHaveBeenCalled();
});

test("the Skeleton keeps the markup of the Schema: headings, lists, links with an allowed address", async () => {
  const lazy = testLazyTool();
  render(
    <RichTextEditor
      aria-label="Body"
      value={
        "<h2>Title</h2>" +
        "<ul><li><p>First item</p></li></ul>" +
        "<ol><li><p>Second item</p></li></ol>" +
        '<p><strong>Bold</strong> and <a href="https://example.com/">a site</a></p>' +
        '<div data-block="test_lazy">Lazy text</div>'
      }
      tools={[...RICH_TEXT_PRESETS.full, lazy.tool]}
    />
  );
  await settle();

  const skeleton = skeletonOf("Title");
  expect(within(skeleton).getByRole("heading", { level: 2, name: "Title" })).toBeTruthy();
  expect(within(skeleton).getAllByRole("listitem")).toHaveLength(2);
  expect(within(skeleton).getByText("Bold").tagName).toBe("STRONG");
  expect(within(skeleton).getByRole("link", { name: "a site" }).getAttribute("href")).toBe(
    "https://example.com/"
  );
  // Блок ещё не загруженного Инструмента — текстом: его обёртку Схема сняла.
  expect(within(skeleton).getByText("Lazy text").closest("[data-block]")).toBeNull();

  lazy.resolve();
  await settle();

  // Движок пришёл со своей Частью: Блок снова Блок, Скелета нет.
  const document = screen.getByRole("textbox", { name: "Body" });
  expect(within(document).getByText("Lazy text").closest("[data-block=test_lazy]")).not.toBeNull();
  expect(screen.getAllByText("Lazy text")).toHaveLength(1);
});

test("the Skeleton follows the Schema of the set: a disabled tool's markup is dropped", async () => {
  const lazy = testLazyTool();
  render(
    <RichTextEditor
      aria-label="Body"
      value='<h2>Title</h2><p><a href="https://example.com/">a site</a></p>'
      tools={["bold", lazy.tool]}
    />
  );
  await settle();

  const skeleton = skeletonOf("Title");
  expect(within(skeleton).queryByRole("heading")).toBeNull();
  expect(within(skeleton).queryByRole("link")).toBeNull();
});

test("the server renders the frame without the Document; after hydration the Skeleton shows the cleaned Document, then the engine", async () => {
  const onRecoverableError = vi.fn();
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  const lazy = testLazyTool();
  const value = `<p>Before</p><p onclick="window.skeletonSpy('p')">Click me</p>`;
  const ui = <RichTextEditor aria-label="Body" value={value} tools={[lazy.tool]} />;

  const html = renderToString(ui);
  expect(html).not.toContain("Before");
  expect(html).not.toContain("Click me");
  expect(html).not.toContain("skeletonSpy");

  const container = document.createElement("div");
  container.innerHTML = html;
  document.body.append(container);
  await act(async () => void hydrateRoot(container, ui, { onRecoverableError }));
  await settle();

  // Гидратация без расхождений; Документ в Скелете — уже очищенный.
  expect(onRecoverableError).not.toHaveBeenCalled();
  expect(error).not.toHaveBeenCalled();
  expect(container.querySelector("[contenteditable]")).toBeNull();
  expect(within(container).getByText("Before")).toBeTruthy();
  expect(container.innerHTML).not.toContain("skeletonSpy");
  await userEvent.click(within(container).getByText("Click me"));
  expect(spy).not.toHaveBeenCalled();

  lazy.resolve();
  await settle();

  expect(container.querySelector("[contenteditable=true]")).not.toBeNull();
  expect(within(container).getAllByText("Before")).toHaveLength(1);
  container.remove();
});
