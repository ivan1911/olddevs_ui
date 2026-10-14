// @vitest-environment jsdom
import createDOMPurify from "dompurify";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement, useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, test } from "vitest";
import { defineTool, RichTextView, tool, type CustomIslandProps } from "../src/editor/index.js";
import { richTextSchema, sanitizeRichText } from "../src/editor/schema-entry.js";
import { testPlayerNode, testPlayerTool } from "./editor-test-tools.js";

afterEach(cleanup);

/**
 * Определение вне движка (OLDSUI-268): серверная очистка, Схема данными и Остров
 * в `RichTextView` читают правила из тела, которое отдал `create`, с Опциями
 * определения — теми же `tools`, что у Редактора.
 */

const purify = createDOMPurify(window);

/** Тот же Блок, что у `testPlayerTool`, но атрибут `test_kind` берёт значения из Опций. */
const player = defineTool({
  name: "test_player",
  defaults: { kinds: ["audio", "video"] },
  create: (options) => ({
    ...testPlayerTool,
    engine: [testPlayerNode],
    blocks: {
      test_player: {
        ...testPlayerTool.blocks!.test_player!,
        attributes: { test_kind: { kind: "list", values: options.kinds } },
      },
    },
  }),
});

const BLOCK = (kind: string) => `<div data-block="test_player" data-test_kind="${kind}">x</div>`;

test("richTextSchema reads the rules of a definition from its body, with the defaults", () => {
  const schema = richTextSchema([player]);
  expect(Object.keys(schema.customBlocks)).toEqual(["test_player"]);
  expect(schema.customBlocks.test_player?.attributes).toEqual({
    test_kind: { kind: "list", values: ["audio", "video"] },
  });
});

test("the options of tool() reach the rules the server reads", () => {
  const strict = tool(player, { kinds: ["audio"] });
  expect(richTextSchema([strict]).customBlocks.test_player?.attributes).toEqual({
    test_kind: { kind: "list", values: ["audio"] },
  });

  // Очистка с теми же `tools`: значение вне списка Опций срезается.
  expect(sanitizeRichText(BLOCK("video"), purify, [player])).toContain('data-test_kind="video"');
  expect(sanitizeRichText(BLOCK("video"), purify, [strict])).not.toContain("data-test_kind");
});

test("a Configured Tool of a built-in tool has no schema and no island", () => {
  const schema = richTextSchema([tool("toc", { levels: [2] }), tool("search")]);
  expect(schema.customBlocks).toEqual({});
});

test("the island of a definition comes alive in RichTextView, and the server markup stays plain", async () => {
  const html = `<div data-block="test_player" data-test_src="https://example.com/a.mp4" data-test_kind="video">First</div>`;
  const withIsland = defineTool({
    name: "test_player",
    defaults: {},
    create: () => ({ engine: testPlayerTool.engine, blocks: testPlayerTool.blocks }),
  });

  const markup = renderToStaticMarkup(<RichTextView html={html} tools={[withIsland]} />);
  expect(markup).not.toContain("<button");

  render(<RichTextView html={html} tools={[tool(withIsland)]} />);
  expect((await screen.findByTestId("player")).textContent).toBe("Play First 0");
});

/**
 * `create` отдаёт Остров замыканием над Опциями: функция каждый раз новая. Клиентский
 * родитель перерисовывает `RichTextView` с теми же `tools`, и Остров не должен
 * размонтироваться — React сравнивает тип компонента по ссылке.
 */
function counterDefinition(created: { count: number }) {
  return defineTool({
    name: "test_player",
    defaults: { label: "Count" },
    create: (options) => {
      created.count += 1;
      return {
        engine: testPlayerTool.engine,
        blocks: {
          test_player: {
            kind: "block",
            island: function Counter(_: CustomIslandProps) {
              const [clicks, setClicks] = useState(0);
              return createElement(
                "button",
                { type: "button", "data-testid": "counter", onClick: () => setClicks(clicks + 1) },
                `${options.label} ${clicks}`
              );
            },
          },
        },
      };
    },
  });
}

test("a client parent that re-renders RichTextView with the same tools keeps the island mounted", () => {
  const created = { count: 0 };
  const entry = tool(counterDefinition(created), { label: "Clicks" });
  const html = `<div data-block="test_player">First</div>`;
  let rerender: () => void = () => {};
  function Parent() {
    const [, setTick] = useState(0);
    rerender = () => setTick((tick) => tick + 1);
    return <RichTextView html={html} tools={[entry]} />;
  }

  render(<Parent />);
  fireEvent.click(screen.getByTestId("counter"));
  expect(screen.getByTestId("counter").textContent).toBe("Clicks 1");

  act(() => rerender());
  act(() => rerender());
  // Состояние Острова пережило перерисовки родителя: тип компонента тот же.
  expect(screen.getByTestId("counter").textContent).toBe("Clicks 1");
  expect(created.count).toBe(1);
});

test("a definition without tool() is resolved once too, and each tool() record has its own options", () => {
  const created = { count: 0 };
  const definition = counterDefinition(created);
  const html = `<div data-block="test_player">First</div>`;

  const first = render(<RichTextView html={html} tools={[definition]} />);
  first.rerender(<RichTextView html={html} tools={[definition]} />);
  expect(created.count).toBe(1);
  first.unmount();

  // Другая запись `tool()` — другие Опции и свой результат; запись остаётся при себе.
  const a = tool(definition, { label: "A" });
  const b = tool(definition, { label: "B" });
  const view = render(<RichTextView html={html} tools={[a]} />);
  expect(screen.getByTestId("counter").textContent).toBe("A 0");
  view.rerender(<RichTextView html={html} tools={[b]} />);
  expect(screen.getByTestId("counter").textContent).toBe("B 0");
  view.rerender(<RichTextView html={html} tools={[a]} />);
  expect(screen.getByTestId("counter").textContent).toBe("A 0");
  expect(created.count).toBe(3);
});
