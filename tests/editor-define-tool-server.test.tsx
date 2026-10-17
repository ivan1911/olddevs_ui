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
 * A definition outside the engine (OLDSUI-268): server-side sanitizing, the Schema as data and the Island
 * in `RichTextView` read the rules from the body that `create` returned, with the options
 * of the definition: the same `tools` the Editor uses.
 */

const purify = createDOMPurify(window);

/** The same Block as `testPlayerTool`, but the `test_kind` attribute takes its values from the options. */
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

  // Sanitizing with the same `tools`: a value outside the options list is stripped.
  expect(sanitizeRichText(BLOCK("video"), purify, [player])).toContain('data-test_kind="video"');
  expect(sanitizeRichText(BLOCK("video"), purify, [strict])).not.toContain("data-test_kind");
});

test("a Configured Tool of a built-in tool has no schema and no island", () => {
  const schema = richTextSchema([tool("toc", { levels: [2] }), tool("search")]);
  expect(schema.customBlocks).toEqual({});
});

test("the Configured Tools typography and invisibleCharacters are safe on the server: a schema and a clean paragraph", () => {
  // Tools without a Block (OLDSUI-278, OLDSUI-279): server-side sanitizing knows nothing
  // about them and must change neither the paragraph nor its characters.
  const tools = [
    tool("typography", { quotes: "ru" }),
    tool("invisibleCharacters", { visible: true }),
  ];
  const schema = richTextSchema(tools);
  expect(schema.customBlocks).toEqual({});

  const html = "<p>Plain <strong>text</strong> \u2014 \u00AB\u2026\u00BB and a space</p>";
  expect(sanitizeRichText(html, purify, tools)).toBe(html);
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
 * `create` returns the Island as a closure over the options: the function is new every time. The client
 * parent re-renders `RichTextView` with the same `tools`, and the Island must not
 * unmount: React compares the component type by reference.
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
  // The Island's state survived the parent's re-renders: the component type is the same.
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

  // A different `tool()` entry has different options and its own result; the entry keeps to itself.
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
