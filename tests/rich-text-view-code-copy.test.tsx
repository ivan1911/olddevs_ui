// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, test, vi } from "vitest";
import { RichTextView } from "../src/editor/index.js";
import { highlightCodeBlocks } from "../src/editor/features/code/highlight.js";
import { UiProvider } from "../src/i18n/UiProvider.js";
import { messages as ru } from "../src/locales/ru.js";

afterEach(cleanup);

/**
 * «Копировать» в блоках кода просмотра (OLDSUI-50, ADR-0039). Просмотр —
 * серверный компонент: шапка с подписью языка приходит в HTML, а кнопку вставляет
 * клиентский остров после монтирования.
 */

const PYTHON = "def greet(name):\n    return f'hi {name}' if name < 3 else None";
const SAVED =
  "<p>Intro</p>" +
  `<pre><code class="language-python">${PYTHON.replace("<", "&lt;")}</code></pre>` +
  "<pre><code>plain &amp; simple</code></pre>";

function setupClipboard() {
  const user = userEvent.setup();
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  return { user, writeText };
}

/** Мост: контейнер просмотра — предок `pre`, но не остров. */
function blocksOf(container: HTMLElement) {
  return [...container.querySelectorAll<HTMLElement>("[data-code-block]")];
}

test("the server markup carries the header, the language label and an empty copy slot", () => {
  const markup = renderToStaticMarkup(<RichTextView html={SAVED} />);

  const host = document.createElement("div");
  host.innerHTML = markup;
  const [python, plain] = blocksOf(host);
  expect(python!.querySelector("[data-code-header]")!.firstElementChild!.textContent).toBe(
    "Python"
  );
  expect(plain!.querySelector("[data-code-header]")!.firstElementChild!.textContent).toBe("");
  for (const block of [python!, plain!]) {
    const slot = block.querySelector("[data-code-copy]")!;
    expect(slot.textContent).toBe("");
    expect(slot.getAttribute("data-code-copy")).toBeTruthy();
    // Код под шапкой — как был, шапка не внутри `pre`.
    expect(block.querySelector("pre")!.contains(slot)).toBe(false);
  }
  // Без JS кнопки нет и разметка цела: ни одного `button`.
  expect(host.querySelectorAll("button")).toHaveLength(0);
  expect(host.querySelector("pre code")!.textContent).toBe(PYTHON);
  expect(host.querySelector("p")!.textContent).toBe("Intro");
});

/*
  Без блоков кода острова нет вовсе: ни его метки в разметке, ни эффекта,
  который обошёл бы контейнер в поисках гнёзд.
*/
test("a view without code blocks is untouched and renders no island", () => {
  const markup = renderToStaticMarkup(<RichTextView html="<p>Text</p>" className="x" />);

  expect(markup).not.toContain("data-code");
  expect(markup).not.toContain("<template");
  expect(markup.startsWith('<div class="')).toBe(true);
  expect(markup.endsWith("<p>Text</p></div>")).toBe(true);
});

test("the label comes from the language list, not from the class in the document", () => {
  const markup = renderToStaticMarkup(
    <RichTextView
      html={
        '<pre><code class="language-py">a</code></pre>' +
        '<pre><code class="language-rust">b</code></pre>' +
        '<pre><code class="language-&quot;&gt;&lt;img&gt;">c</code></pre>'
      }
    />
  );

  expect(markup).toContain(">Python</span>");
  expect(markup).not.toContain("Rust");
  expect(markup).not.toContain("<img");
});

test("every pre block gets a copy button once the view is mounted", async () => {
  const { container } = render(<RichTextView html={SAVED} />);

  await waitFor(() => expect(screen.getAllByRole("button", { name: "Copy" })).toHaveLength(2));
  for (const block of blocksOf(container)) {
    const header = block.querySelector("[data-code-header]")!;
    expect(within(header as HTMLElement).getByRole("button", { name: "Copy" })).toBeTruthy();
  }
});

test("copy writes the code text of a block highlighted on the server, without tokens", async () => {
  const { user, writeText } = setupClipboard();
  const highlighted = highlightCodeBlocks(SAVED);
  expect(highlighted).toContain("hljs-");
  render(<RichTextView html={highlighted} />);

  const [first, second] = await screen.findAllByRole("button", { name: "Copy" });
  await user.click(first!);
  expect(writeText).toHaveBeenLastCalledWith(PYTHON);
  await user.click(second!);
  expect(writeText).toHaveBeenLastCalledWith("plain & simple");
});

test("the result is announced, and the button name says «Copied»", async () => {
  const { user } = setupClipboard();
  render(<RichTextView html={SAVED} />);

  await user.click((await screen.findAllByRole("button", { name: "Copy" }))[0]!);
  await waitFor(() => expect(screen.getAllByRole("button", { name: "Copied" })).toHaveLength(1));
});

test("when the document changes, the buttons follow the new blocks", async () => {
  const { user, writeText } = setupClipboard();
  const { rerender } = render(<RichTextView html={SAVED} />);
  await screen.findAllByRole("button", { name: "Copy" });

  rerender(<RichTextView html='<pre><code class="language-go">x := 1</code></pre>' />);
  await waitFor(() => expect(screen.getAllByRole("button", { name: "Copy" })).toHaveLength(1));
  await user.click(screen.getByRole("button", { name: "Copy" }));
  expect(writeText).toHaveBeenLastCalledWith("x := 1");

  rerender(<RichTextView html="<p>No code</p>" />);
  await waitFor(() => expect(screen.queryByRole("button", { name: "Copy" })).toBeNull());
});

test("two views on a page do not share copy slots", async () => {
  const { user, writeText } = setupClipboard();
  render(
    <>
      <RichTextView html="<pre><code>one</code></pre>" />
      <RichTextView html="<pre><code>two</code></pre>" />
    </>
  );

  const buttons = await screen.findAllByRole("button", { name: "Copy" });
  expect(buttons).toHaveLength(2);
  await user.click(buttons[1]!);
  expect(writeText).toHaveBeenLastCalledWith("two");
});

/*
  Остров ищет гнёзда от своего места в дереве, а не по глобальному `document`:
  просмотр внутри теневого корня (веб-компонент, изолированный виджет) или в
  `iframe` для `document` не виден, и кнопки бы не появились.
*/
test("a view inside a shadow root gets its copy buttons", async () => {
  const { user, writeText } = setupClipboard();
  const shadowHost = document.createElement("div");
  document.body.append(shadowHost);
  const shadow = shadowHost.attachShadow({ mode: "open" });
  const container = document.createElement("div");
  shadow.append(container);

  try {
    render(<RichTextView html="<pre><code>inside</code></pre>" />, { container });

    const button = await within(container).findByRole("button", { name: "Copy" });
    await user.click(button);
    expect(writeText).toHaveBeenLastCalledWith("inside");
  } finally {
    cleanup();
    shadowHost.remove();
  }
});

/*
  И только в своём просмотре: гнездо с тем же идентификатором вне контейнера
  просмотра (чужой HTML, вставленный рядом) кнопки не получает.
*/
test("the island fills only the slots inside its own view", async () => {
  const stray = document.createElement("div");
  document.body.append(stray);
  const { container } = render(<RichTextView html="<pre><code>own</code></pre>" />);
  const own = container.querySelector<HTMLElement>("[data-code-copy]")!;
  stray.innerHTML = `<span data-code-copy="${own.dataset.codeCopy}"></span>`;

  try {
    // Документ сменился — остров ищет гнёзда заново и видит в `document` оба.
    render(<RichTextView html="<pre><code>own</code></pre><p>changed</p>" />, { container });
    await waitFor(() => expect(within(container).getAllByRole("button")).toHaveLength(1));
    expect(stray.querySelector("button")).toBeNull();
  } finally {
    stray.remove();
  }
});

test("unmounting the view removes its buttons", async () => {
  const { unmount } = render(<RichTextView html={SAVED} />);
  await screen.findAllByRole("button", { name: "Copy" });

  unmount();
  expect(document.querySelectorAll("button")).toHaveLength(0);
});

test("the button speaks Russian with the Russian catalog", async () => {
  render(
    <UiProvider messages={ru}>
      <RichTextView html={SAVED} />
    </UiProvider>
  );

  expect(await screen.findAllByRole("button", { name: ru.copyButton.copy })).toHaveLength(2);
  await act(async () => {});
});
