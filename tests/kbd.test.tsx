// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { Kbd } from "../src/components/content/Kbd.js";

afterEach(cleanup);

/*
  Знаки модификаторов — пропорциональным шрифтом (OLDSUI-117). В моноширинном
  стеке кита (SF Mono, Menlo) знака `⇧` нет, браузер берёт его из запасного
  шрифта, и стрелка выходит тонкой и бледной рядом с `⌘` и буквой.
*/
const glyphs = (container: HTMLElement) =>
  [...container.querySelectorAll("kbd [data-key-symbol]")].map((node) => node.textContent);

test("modifier symbols are set apart from the mono text, the label reads the same", () => {
  const { container } = render(<Kbd>⌘+⌥+⇧+⌃+Z</Kbd>);

  expect(glyphs(container)).toEqual(["⌘", "⌥", "⇧", "⌃"]);
  expect(container.querySelector("[data-key-symbol]")!.className).toContain("font-sans");
  expect(container.firstElementChild!.textContent).toBe("⌘+⌥+⇧+⌃+Z");
});

test("a label without symbols stays plain text", () => {
  const { container } = render(<Kbd>Ctrl+Shift+Z</Kbd>);

  expect(glyphs(container)).toEqual([]);
  expect(container.firstElementChild!.innerHTML).toBe("Ctrl+Shift+Z");
});

test("children other than a string pass through untouched", () => {
  const { container } = render(
    <Kbd>
      <span>⇧</span>
    </Kbd>
  );

  expect(glyphs(container)).toEqual([]);
  expect(container.firstElementChild!.innerHTML).toBe("<span>⇧</span>");
});
