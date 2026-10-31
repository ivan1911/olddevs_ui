// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { MarkdownView } from "../src/markdown.js";

afterEach(cleanup);

test("read paragraphs, emphasis, lists, quotes and GFM tables through the Markdown entry", () => {
  const { container } = render(
    <MarkdownView
      content={
        "Hello **reader** and *friend*.\n\n- First\n- Second\n\n> Quoted\n\n| Name | Value |\n| --- | --- |\n| A | 1 |"
      }
    />
  );
  expect(container.querySelector("strong")?.textContent).toBe("reader");
  expect(container.querySelector("em")?.textContent).toBe("friend");
  expect(screen.getAllByRole("listitem")).toHaveLength(2);
  expect(container.querySelector("blockquote")?.textContent).toContain("Quoted");
  expect(screen.getByRole("table").textContent).toContain("NameValueA1");
});

test("code copy preserves semantic spaces and blank lines independently of highlight nodes", async () => {
  const user = userEvent.setup();
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  const highlight = vi.fn((code: string, language: string | undefined) => (
    <span>
      {language}: decorative tokens for {code.length} characters
    </span>
  ));
  render(<MarkdownView content={"```html\n  <b>& hello</b>\n\n\n```"} renderCode={highlight} />);
  await user.click(screen.getByRole("button", { name: /Copy/i }));
  expect(writeText).toHaveBeenCalledWith("  <b>& hello</b>\n\n");
  expect(highlight).toHaveBeenCalledWith("  <b>& hello</b>\n\n", "html");
});

test("untrusted HTML, unsafe URLs and image syntax cannot create executable markup or fetch images", () => {
  const { container } = render(
    <MarkdownView
      content={[
        '<script>alert(1)</script>\n\n<img src="https://image.example/raw.png" onerror="alert(1)">',
        "[script](javascript:alert%281%29) [data](data:text/html,evil) [file](file:///tmp/x)",
        "[relative host](//evil.example) [entity](java&#x73;cript:evil) [control](java&#x09;script:evil)",
        "[backslash](https:&#x5c;&#x5c;evil.example) [bad percent](https://example.com/%ZZ)",
        "[web](https://example.com/a%20b) [email](mailto:hello@example.com) [path](/guide) [fragment](#part)",
        "![A remote chart](https://image.example/chart.png) ![](data:image/png;base64,AAAA)",
      ].join("\n\n")}
    />
  );
  expect(
    container.querySelector('script, img, iframe, svg, object, link[rel="preload"]')
  ).toBeNull();
  expect(screen.getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual([
    "https://example.com/a%20b",
    "mailto:hello@example.com",
    "/guide",
    "#part",
  ]);
  expect(container.textContent).toContain("[Image: A remote chart]");
  expect(container.textContent).toContain("[Image]");
  expect(container.textContent).toContain("script");
});

test("streaming code updates keep keyboard focus on its existing copy action", () => {
  const { container, rerender } = render(<MarkdownView content={"```js\nlet value=1"} streaming />);
  const copy = screen.getByRole("button", { name: /Copy/i });
  copy.focus();
  rerender(<MarkdownView content={"```js\nlet value=12"} streaming />);
  expect(document.activeElement).toBe(copy);
  expect(container.querySelector("pre")?.textContent).toBe("let value=12");
});

test.each([false, true])(
  "partial syntax remains readable with streaming=%s and settles on completion",
  (streaming) => {
    const { container, rerender } = render(
      <MarkdownView content={"Read [the docs and **impor"} streaming={streaming} />
    );
    expect(container.textContent).toBe("Read [the docs and **impor");
    expect(screen.queryByRole("link")).toBeNull();
    rerender(<MarkdownView content={"Read [the docs](https://exam"} streaming={streaming} />);
    expect(screen.getByRole("link").getAttribute("href")).toBe("https://exam");
    expect(container.textContent).toBe("Read [the docs](https://exam");
    rerender(<MarkdownView content={"| Name | Value |\n| --"} streaming={streaming} />);
    expect(screen.queryByRole("table")).toBeNull();
    rerender(
      <MarkdownView content={"| Name | Value |\n| --- | --- |\n| A |"} streaming={streaming} />
    );
    expect(screen.getAllByRole("cell").map((cell) => cell.textContent)).toEqual(["A", ""]);
    rerender(<MarkdownView content={"Read [the docs](https://example.com) and **important**"} />);
    expect(screen.getByRole("link").getAttribute("href")).toBe("https://example.com");
    expect(container.querySelector("strong")?.textContent).toBe("important");
  }
);

test("unsupported math and diagrams stay inert text or copyable code, including incomplete fences", () => {
  const { container, rerender } = render(
    <MarkdownView content={"$x^2$\n\n$$x=1$$\n\n```mermaid\ngraph TD; A-->B"} streaming />
  );
  expect(container.textContent).toContain("$x^2$");
  expect(container.textContent).toContain("$$x=1$$");
  expect(container.querySelector("pre")?.textContent).toBe("graph TD; A-->B");
  expect(container.querySelector("pre svg, math, iframe")).toBeNull();
  rerender(<MarkdownView content={"```\nlast line```"} renderCode={() => null} />);
  expect(container.querySelector("pre")?.textContent).toBe("last line```");
});

test("tables offer a named keyboard scrolling region without a token live region", () => {
  const { container } = render(
    <MarkdownView
      content={"| A | B |\n| --- | --- |\n| 1 | 2 |"}
      streaming
      className="consumer-markdown"
    />
  );
  expect(screen.getByRole("region", { name: "Markdown table" }).getAttribute("tabindex")).toBe("0");
  expect(container.querySelector('[aria-live], [role="log"]')).toBeNull();
  expect(container.querySelector(".consumer-markdown")).not.toBeNull();
});
