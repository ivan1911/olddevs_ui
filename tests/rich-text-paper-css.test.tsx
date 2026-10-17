// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";
import { RichTextView, type RichTextSurface } from "../src/editor/index.js";

/*
  The Paper `surface="paper"` on the REAL cascade (OLDSUI-52): the kit's `styles.css` and
  the Document classes, built by Tailwind from the sources, run in jsdom inside a dark
  app. The test checks what the eye sees: the text color, the Paper background, the marker
  and the code highlight are light, while the same markup without the Paper is dark.

  TWO ADJUSTMENTS FOR jsdom, both without changing the meaning of the rules:
  - `@layer` is unwrapped: jsdom does not apply rules inside layers.
  - Tailwind classes get short aliases (`.c12`). The jsdom selector engine does not find
    a class with `[`, `&` or `:` in its name, neither escaped nor through
    `[class~=…]`, and all of the Document's classes have them (`[&_a]:text-(--rte-link)`).
    The alias is set in both the CSS and the elements, so the matches are the same.

  jsdom does not substitute `var()`: the value is resolved through the chain of custom
  properties on the same element, the way a browser would see it.
*/

const ROOT = resolve(import.meta.dirname, "..");
const tmp = mkdtempSync(join(ROOT, ".tmp-coverage-paper-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));
afterEach(cleanup);

/** The body of `@layer …` blocks, in place of the blocks themselves. */
function unlayer(css: string): string {
  let out = "";
  let from = 0;
  const layer = /@layer[^{;]*\{/g;
  for (let match = layer.exec(css); match; match = layer.exec(css)) {
    let depth = 1;
    let at = match.index + match[0].length;
    const start = at;
    for (; depth > 0; at++) {
      if (css[at] === "{") depth++;
      else if (css[at] === "}") depth--;
    }
    out += css.slice(from, match.index) + unlayer(css.slice(start, at - 1));
    from = at;
    layer.lastIndex = at;
  }
  return out + css.slice(from);
}

const aliases = new Map<string, string>();
const aliasOf = (name: string) => {
  if (!aliases.has(name)) aliases.set(name, `c${aliases.size}`);
  return aliases.get(name)!;
};

let style: HTMLStyleElement;

beforeAll(() => {
  const input = join(tmp, "input.css");
  const output = join(tmp, "output.css");
  writeFileSync(
    input,
    [
      // `source(none)`: only the sources below, without previously built `dist/` and
      // `storybook-static/` (see `tests/class-coverage.test.ts`).
      '@import "tailwindcss" source(none);',
      `@import "${join(ROOT, "styles.css")}";`,
      `@source "${join(ROOT, "src", "editor")}";`,
      "",
    ].join("\n")
  );
  execFileSync("npx", ["@tailwindcss/cli", "-i", input, "-o", output], {
    cwd: ROOT,
    stdio: "pipe",
  });
  const css = unlayer(readFileSync(output, "utf8")).replace(
    /\.((?:\\.|[\w-])+)/g,
    (whole, name: string) =>
      name.includes("\\") ? `.${aliasOf(name.replace(/\\(.)/g, "$1"))}` : whole
  );
  style = document.createElement("style");
  style.textContent = css;
  document.head.append(style);
}, 60_000);

afterAll(() => style.remove());

/** Tailwind class aliases on all the elements inside. */
function alias(root: Element) {
  for (const element of [root, ...root.querySelectorAll("*")]) {
    for (const name of [...element.classList]) {
      if (aliases.has(name)) element.classList.add(aliases.get(name)!);
    }
  }
}

/** The property value with `var()` resolved, as the browser would show it. */
function computed(element: Element, property: string): string {
  const styles = getComputedStyle(element);
  let value = styles.getPropertyValue(property).trim();
  for (let step = 0; step < 10; step++) {
    const reference = value.match(/^var\((--[\w-]+)\)$/);
    if (!reference) return value.toLowerCase();
    value = styles.getPropertyValue(reference[1]!).trim();
  }
  throw new Error(`${property}: var() chain too deep`);
}

const DOCUMENT =
  '<p>Text <a href="https://example.com">link</a> <span data-color="danger">red</span> ' +
  '<mark data-color="yellow">marked</mark></p><blockquote><p>Quote</p></blockquote>' +
  '<pre><code class="language-python"><span class="hljs-keyword">def</span> x</code></pre>';

function renderView(surface: RichTextSurface) {
  const { container } = render(<RichTextView html={DOCUMENT} surface={surface} />);
  const view = container.firstElementChild!;
  alias(view);
  const at = (selector: string) => view.querySelector(selector)!;
  return {
    sheet: computed(view, "background-color"),
    text: computed(at("p"), "color"),
    quote: computed(at("blockquote"), "color"),
    link: computed(at("a"), "color"),
    danger: computed(at("span[data-color]"), "color"),
    marker: computed(at("mark"), "background-color"),
    keyword: computed(at(".hljs-keyword"), "color"),
    code: computed(at("pre"), "background-color"),
    // The code Block header (OLDSUI-50): the background is the highlight theme, the language
    // label and "Copy" (inserted by the Island) use the `--rte-secondary` role.
    header: computed(at("[data-code-header]"), "background-color"),
    language: computed(at("[data-code-header] > span"), "color"),
    copy: computed(at("[data-code-header] button"), "color"),
  };
}

function inApp(attributes: Record<string, string>, run: () => void) {
  const root = document.documentElement;
  for (const [name, value] of Object.entries(attributes)) root.setAttribute(name, value);
  try {
    run();
  } finally {
    for (const name of Object.keys(attributes)) root.removeAttribute(name);
  }
}

/** The kit's light theme: primitive values from `styles.css`, copied by hand. */
const LIGHT_PAPER = {
  sheet: "#ffffff", // --od-cloud-12
  text: "#17212b", // --od-cloud-1 = light --fg-0
  quote: "#45515f", // --od-cloud-2 = light --fg-1
  danger: "#b82d2d", // --od-red-1 = light --danger-strong
  marker: "#ffea80", // --od-marker-yellow: bright, one in every theme
  keyword: "#d73a49", // GitHub Light
  code: "#ffffff", // GitHub Light
  header: "#ffffff", // GitHub Light
  language: "#45515f", // --od-cloud-2 = light --fg-1
  copy: "#45515f",
};

describe("paper resolves light values inside a dark app", () => {
  test.each([
    ["dark", { "data-theme": "dark" }],
    ["dim", { "data-theme": "dim" }],
    ["dark, brand teal", { "data-theme": "dark", "data-brand": "teal" }],
  ])("%s app: the paper document is light", (_label, attributes) => {
    inApp(attributes, () => {
      expect(renderView("paper")).toMatchObject(LIGHT_PAPER);
    });
  });

  test("the link takes the app's accent fill, which holds 4.5:1 on white in every brand", () => {
    inApp({ "data-theme": "dark" }, () => expect(renderView("paper").link).toBe("#1e76da"));
    cleanup();
    inApp({ "data-theme": "dark", "data-brand": "teal" }, () =>
      expect(renderView("paper").link).toBe("#0f766e")
    );
  });

  test("in a light app the paper link is the light theme's own accent-strong", () => {
    inApp({ "data-theme": "light" }, () => expect(renderView("paper").link).toBe("#1c6cc6"));
  });

  test("the same document without paper follows the dark app", () => {
    inApp({ "data-theme": "dark" }, () => {
      expect(renderView("theme")).toMatchObject({
        sheet: "rgba(0, 0, 0, 0)", // the Paper is not painted: the background belongs to the host
        text: "#f4f5f8", // --od-slate-12
        link: "#7fc1ff", // --od-blue-6 = dark --accent-strong
        danger: "#eea8a0", // --od-red-5
        marker: "#ffea80", // --od-marker-yellow: the same bright one in a dark app
        keyword: "#ff7b72", // GitHub Dark
        code: "#0d1117",
        header: "#0d1117",
      });
    });
  });
});

/*
  Wrapper tone (OLDSUI-78): on a colored backdrop the link, the quote, the muted text and
  the hint of an empty label take the higher-contrast `--rte-tone-*` roles (`tokens.ts`);
  their pairs are held by the contrast gate. Outside a Wrapper, and in a Wrapper without a
  tone, the roles stay as before.
*/
const TONED =
  '<div data-block="wrapper" data-tone="warning">' +
  '<p>Text <a href="https://example.com">link</a> <span data-color="muted">gray</span></p>' +
  "<blockquote><p>Quote</p></blockquote>" +
  '<ul data-type="taskList"><li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked><span></span></label><div><p>Done</p></div></li></ul>' +
  '<figure><img src="https://cdn.example.com/a.png" alt=""><figcaption>Caption</figcaption></figure>' +
  "</div>" +
  '<p>Outside <a href="https://example.com">link</a></p>';

function renderToned(surface: RichTextSurface) {
  const { container } = render(<RichTextView html={TONED} surface={surface} />);
  const view = container.firstElementChild!;
  alias(view);
  const wrapper = view.querySelector("[data-tone]")!;
  const at = (selector: string) => wrapper.querySelector(selector)!;
  return {
    text: computed(at("p"), "color"),
    link: computed(at("a"), "color"),
    gray: computed(at("span[data-color]"), "color"),
    quote: computed(at("blockquote"), "color"),
    done: computed(at("li[data-checked] > div"), "color"),
    caption: computed(at("figcaption"), "color"),
    placeholder: computed(wrapper, "--rte-muted-foreground"),
    outsideLink: computed(view.querySelector(":scope > p a")!, "color"),
  };
}

describe("a toned wrapper raises the secondary roles on its fill", () => {
  test("in the dark app every secondary role takes the body text", () => {
    inApp({ "data-theme": "dark" }, () => {
      const fg0 = "#f4f5f8"; // --od-slate-12 = dark --fg-0
      expect(renderToned("theme")).toEqual({
        text: fg0,
        link: fg0,
        gray: fg0,
        quote: fg0,
        done: fg0,
        caption: fg0,
        placeholder: fg0,
        // Outside a Wrapper the link keeps the previous accent.
        outsideLink: "#7fc1ff",
      });
    });
  });

  test("on paper the link and the placeholder go up, the quote and the muted text keep their step", () => {
    inApp({ "data-theme": "dark" }, () => {
      expect(renderToned("paper")).toEqual({
        text: "#17212b", // --od-cloud-1
        link: "#17212b", // --od-cloud-1: the accent does not hold 4.5 on a tone backdrop
        gray: "#545f6e", // --od-cloud-3
        quote: "#45515f", // --od-cloud-2
        done: "#545f6e", // --od-cloud-3
        caption: "#545f6e", // --od-cloud-3
        placeholder: "#545f6e", // --od-cloud-3, not --od-cloud-4
        outsideLink: "#1e76da",
      });
    });
  });
});

/*
  A custom Block in the View (OLDSUI-104, ADR-0058, section 3.2): the kit gives it the same
  vertical rhythm as a paragraph, and nothing more: the rest is the consumer's CSS, keyed
  on `data-block`. Blocks inside a custom container Block keep the Document's rhythm, as in
  a Wrapper; the inline content of a custom Block gets no spacing, even if the consumer's
  CSS makes the atom `inline-block`. The check is against a paragraph of the same
  Document, on both surfaces.
*/
const CUSTOM =
  "<p>Before</p>" +
  '<div data-block="acme_box"><p>Inside</p><h2>Heading</h2><p>Last</p></div>' +
  '<div data-block="acme_card">Card <span data-block="acme_tag" style="display:inline-block">tag</span> text</div>' +
  "<h2>Outside heading</h2><p>After</p>";

function renderCustom(surface: RichTextSurface) {
  const { container } = render(<RichTextView html={CUSTOM} surface={surface} />);
  const view = container.firstElementChild!;
  alias(view);
  const at = (selector: string) => view.querySelector(selector)!;
  return {
    paragraph: computed(at(":scope > p"), "margin-bottom"),
    noMargin: computed(at(":scope > p:last-child"), "margin-bottom"),
    headingTop: computed(at(":scope > h2"), "margin-top"),
    box: computed(at("[data-block=acme_box]"), "margin-bottom"),
    card: computed(at("[data-block=acme_card]"), "margin-bottom"),
    inside: computed(at("[data-block=acme_box] > p"), "margin-bottom"),
    insideHeading: computed(at("[data-block=acme_box] > h2"), "margin-top"),
    insideLast: computed(at("[data-block=acme_box] > p:last-child"), "margin-bottom"),
    inlineAtom: computed(at("[data-block=acme_tag]"), "margin-bottom"),
  };
}

describe("a custom block keeps the paragraph rhythm in the view", () => {
  test.each(["theme", "paper"] as const)("%s surface", (surface) => {
    inApp({ "data-theme": "dark" }, () => {
      const rhythm = renderCustom(surface);
      // Sanity check that the rhythm exists at all: the paragraph has a margin,
      // the last Block does not.
      expect(rhythm.paragraph).not.toBe(rhythm.noMargin);

      expect(rhythm).toEqual({
        paragraph: rhythm.paragraph,
        noMargin: rhythm.noMargin,
        headingTop: rhythm.headingTop,
        box: rhythm.paragraph,
        card: rhythm.paragraph,
        inside: rhythm.paragraph,
        insideHeading: rhythm.headingTop,
        insideLast: rhythm.noMargin,
        inlineAtom: rhythm.noMargin,
      });
    });
  });
});
