// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, test } from "vitest";
import { RichTextView } from "../src/editor/index.js";
import {
  testBadgeTool,
  testCardTool,
  testPlayerCalls,
  testPlayerTool,
} from "./editor-test-tools.js";

afterEach(cleanup);
beforeEach(() => {
  testPlayerCalls.length = 0;
});

/**
 * Остров своего Блока в `RichTextView` (OLDSUI-114, ADR-0058, п. 3.3). Образец —
 * кнопка «Копировать» блока кода (`rich-text-view-code-copy.test.tsx`): просмотр
 * остаётся серверным компонентом, серверный HTML Блока приходит всегда, а
 * клиентский остров оживляет Блок после монтирования — и только если такой Блок
 * есть в Документе.
 */

const player = (src: string, caption: string, kind = "video") =>
  `<div data-block="test_player" data-test_src="${src}" data-test_kind="${kind}">${caption}</div>`;

const ONE = player("https://example.com/a.mp4", "First");
const TWO = player("https://example.com/b.mp3", "Second", "audio");
const DOCUMENT = `<p>Intro</p>${ONE}<p>Between</p>${TWO}`;

test("the server markup carries the block as plain HTML, with no island content", () => {
  const markup = renderToStaticMarkup(<RichTextView html={DOCUMENT} tools={[testPlayerTool]} />);

  const host = document.createElement("div");
  host.innerHTML = markup;
  const blocks = [...host.querySelectorAll("[data-block='test_player']")];
  expect(blocks.map((block) => block.textContent)).toEqual(["First", "Second"]);
  expect(blocks[0]!.getAttribute("data-test_src")).toBe("https://example.com/a.mp4");
  // Без JS остров не работал: ни кнопки, ни вызова компонента.
  expect(host.querySelectorAll("button")).toHaveLength(0);
  expect(testPlayerCalls).toHaveLength(0);
});

test("every occurrence of the block comes alive with its own attributes and text", async () => {
  const { container } = render(<RichTextView html={DOCUMENT} tools={[testPlayerTool]} />);

  const players = await screen.findAllByTestId("player");
  expect(players.map((button) => button.textContent)).toEqual(["Play First 0", "Play Second 0"]);
  expect(players.map((button) => button.dataset.src)).toEqual([
    "https://example.com/a.mp4",
    "https://example.com/b.mp3",
  ]);
  // Остров занял место серверного HTML Блока: текст подписи не дублируется.
  const blocks = [...container.querySelectorAll("[data-block='test_player']")];
  expect(blocks).toHaveLength(2);
  expect(within(blocks[0] as HTMLElement).getByTestId("player")).toBe(players[0]);
  expect(blocks[0]!.textContent).toBe("Play First 0");
  expect(container.querySelector("p")!.textContent).toBe("Intro");
});

test("the island gets only the declared attributes, by their names without the data prefix", async () => {
  render(
    <RichTextView
      html={
        '<div data-block="test_player" data-test_src="https://example.com/a.mp4" ' +
        'data-test_kind="audio" data-other="x" data-test_undeclared="y">Cap</div>'
      }
      tools={[testPlayerTool]}
    />
  );

  const button = await screen.findByTestId("player");
  expect(button.dataset.keys).toBe("test_kind,test_src");
  expect(testPlayerCalls.at(-1)).toEqual({
    block: "test_player",
    attributes: { test_src: "https://example.com/a.mp4", test_kind: "audio" },
    text: "Cap",
  });
});

test("an attribute missing from the block is simply absent", async () => {
  render(<RichTextView html='<div data-block="test_player">Bare</div>' tools={[testPlayerTool]} />);

  const button = await screen.findByTestId("player");
  expect(button.dataset.keys).toBe("");
  expect(button.textContent).toBe("Play Bare 0");
});

test("a document without the block renders no island and never calls the component", async () => {
  const markup = renderToStaticMarkup(
    <RichTextView html="<p>Text</p>" tools={[testPlayerTool]} className="x" />
  );
  expect(markup).not.toContain("<template");
  expect(markup.startsWith('<div class="')).toBe(true);
  expect(markup.endsWith("<p>Text</p></div>")).toBe(true);

  const { container } = render(
    <RichTextView html="<p>Text</p><p>More</p>" tools={[testPlayerTool, testBadgeTool]} />
  );
  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(container.querySelector("template")).toBeNull();
  expect(testPlayerCalls).toHaveLength(0);
  expect(screen.queryByTestId("player")).toBeNull();
});

test("a block of a tool without an island is left as it is", async () => {
  const html = '<div data-block="test_card" data-test_size="m">Card</div>' + ONE;
  const { container } = render(<RichTextView html={html} tools={[testCardTool, testPlayerTool]} />);

  await screen.findByTestId("player");
  expect(container.querySelector("[data-block='test_card']")!.innerHTML).toBe("Card");
});

test("without tools the view behaves as before, even with the block in the document", async () => {
  const markup = renderToStaticMarkup(<RichTextView html={DOCUMENT} />);
  expect(markup).not.toContain("<template");

  const { container } = render(<RichTextView html={DOCUMENT} />);
  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(container.querySelector("template")).toBeNull();
  expect(screen.queryByTestId("player")).toBeNull();
  expect(container.querySelector("[data-block='test_player']")!.textContent).toBe("First");
  expect(testPlayerCalls).toHaveLength(0);
});

test("a tools entry that is a built-in name or has no island changes nothing", async () => {
  const { container } = render(<RichTextView html={ONE} tools={["bold", testCardTool]} />);
  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(container.querySelector("template")).toBeNull();
  expect(container.querySelector("[data-block='test_player']")!.textContent).toBe("First");
});

test("an inline block gets its island inside the text", async () => {
  const { container } = render(
    <RichTextView
      html='<p>Before <span data-block="test_badge"></span> after</p>'
      tools={[testBadgeTool]}
    />
  );

  const badge = await screen.findByTestId("badge");
  expect(badge.textContent).toBe("Badge test_badge");
  expect(container.querySelector("p")!.textContent).toBe("Before Badge test_badge after");
  expect(badge.closest("span[data-block='test_badge']")).not.toBeNull();
});

test("the island keeps its state while the view re-renders with the same document", async () => {
  const user = userEvent.setup();
  const html = ONE;
  const { rerender } = render(<RichTextView html={html} tools={[testPlayerTool]} />);
  await user.click(await screen.findByTestId("player"));
  expect(screen.getByTestId("player").textContent).toBe("Play First 1");

  // Новый массив `tools` с тем же содержимым — как инлайновый литерал у родителя.
  rerender(<RichTextView html={html} tools={[testPlayerTool]} className="y" />);
  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(screen.getByTestId("player").textContent).toBe("Play First 1");
});

test("when the document changes, the islands follow the new blocks", async () => {
  const { rerender } = render(<RichTextView html={DOCUMENT} tools={[testPlayerTool]} />);
  await waitFor(() => expect(screen.getAllByTestId("player")).toHaveLength(2));

  rerender(
    <RichTextView html={player("https://example.com/c.mp4", "Third")} tools={[testPlayerTool]} />
  );
  await waitFor(() => expect(screen.getAllByTestId("player")).toHaveLength(1));
  expect(screen.getByTestId("player").textContent).toBe("Play Third 0");

  rerender(<RichTextView html="<p>No player</p>" tools={[testPlayerTool]} />);
  await waitFor(() => expect(screen.queryByTestId("player")).toBeNull());
});

test("when the tools change, the island goes away and the server HTML comes back", async () => {
  const { container, rerender } = render(<RichTextView html={ONE} tools={[testPlayerTool]} />);
  await screen.findByTestId("player");

  rerender(<RichTextView html={ONE} tools={[]} />);
  await waitFor(() => expect(screen.queryByTestId("player")).toBeNull());
  expect(container.querySelector("[data-block='test_player']")!.textContent).toBe("First");
});

test("two views on a page do not share islands", async () => {
  render(
    <>
      <RichTextView html={player("https://example.com/1.mp4", "One")} tools={[testPlayerTool]} />
      <RichTextView html={player("https://example.com/2.mp4", "Two")} tools={[testPlayerTool]} />
    </>
  );

  const players = await screen.findAllByTestId("player");
  expect(players.map((button) => button.textContent)).toEqual(["Play One 0", "Play Two 0"]);
});

test("a view inside a shadow root gets its islands", async () => {
  const shadowHost = document.createElement("div");
  document.body.append(shadowHost);
  const shadow = shadowHost.attachShadow({ mode: "open" });
  const container = document.createElement("div");
  shadow.append(container);

  try {
    render(<RichTextView html={ONE} tools={[testPlayerTool]} />, { container });
    expect(await within(container).findByTestId("player")).toBeTruthy();
  } finally {
    cleanup();
    shadowHost.remove();
  }
});

test("a block inside an island block is left to the outer island", async () => {
  render(
    <RichTextView
      html={'<div data-block="test_player">Outer <span data-block="test_badge"></span></div>'}
      tools={[testPlayerTool, testBadgeTool]}
    />
  );

  await screen.findByTestId("player");
  expect(screen.queryByTestId("badge")).toBeNull();
});

test("the code copy button and a custom island live in one document", async () => {
  render(<RichTextView html={`${ONE}<pre><code>x = 1</code></pre>`} tools={[testPlayerTool]} />);

  expect(await screen.findByTestId("player")).toBeTruthy();
  expect(await screen.findByRole("button", { name: "Copy" })).toBeTruthy();
});

test("unmounting the view removes its islands", async () => {
  const { unmount } = render(<RichTextView html={DOCUMENT} tools={[testPlayerTool]} />);
  await waitFor(() => expect(screen.getAllByTestId("player")).toHaveLength(2));

  unmount();
  expect(document.querySelectorAll("button")).toHaveLength(0);
});

/*
  Перерисовка родителя с тем же Документом не должна переписывать разметку:
  React сверяет `dangerouslySetInnerHTML` по ссылке, и новый объект стёр бы
  вместе с текстом и порталы островов (кнопку «Копировать» — тоже).
*/
test("a parent re-render with the same document keeps the islands and the copy buttons", async () => {
  const html = `${ONE}<pre><code>x = 1</code></pre>`;
  const { rerender } = render(<RichTextView html={html} tools={[testPlayerTool]} />);
  await screen.findByRole("button", { name: "Copy" });

  rerender(<RichTextView html={html} tools={[testPlayerTool]} className="other" />);
  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(screen.getByTestId("player")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Copy" })).toBeTruthy();
});
