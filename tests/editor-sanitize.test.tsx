// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import createDOMPurify from "dompurify";
import { createRef } from "react";
import { afterEach, beforeAll, expect, test } from "vitest";
import { RichTextEditor, type RichTextEditorHandle } from "../src/editor/index.js";
import {
  RICH_TEXT_SCHEMA,
  richTextSanitizeConfig,
  sanitizeRichText,
  type RichTextPurifier,
} from "../src/editor/schema-entry.js";
import { loadLazyBuiltins } from "./editor-lazy-builtins.js";

// The lazy `codeBlock` and `table` (OLDSUI-111): `full` is ready in `render` after the chunks load.
beforeAll(loadLazyBuiltins);

afterEach(cleanup);

/**
 * Sanitizing the Editor's HTML with a real DOMPurify on jsdom, the way the
 * consumer's server does it (ADR-0050). DOMPurify is not a kit dependency: here it is
 * a dev dependency of the tests, and the helper receives the instance as an argument.
 *
 * Two sides of one promise. The safe path is the default:
 * `sanitizeRichText(html, DOMPurify)` installs the Schema hooks itself, and everything that
 * the Editor does not write is stripped. And nothing extra is lost: what the Editor
 * produced passes sanitizing byte for byte.
 */

/**
 * Its own DOMPurify instance on the `window` of the test jsdom. On the consumer's server
 * it is `new JSDOM("").window`: the same jsdom, a different document.
 */
function serverPurifier() {
  return createDOMPurify(window);
}

// The helper's structural type accepts a real DOMPurify instance without casts:
// `npm run typecheck` checks this, not a runtime assertion.
const purify: RichTextPurifier = serverPurifier();

function load(html: string): string {
  const ref = createRef<RichTextEditorHandle>();
  render(<RichTextEditor ref={ref} aria-label="Body" defaultValue={html} />);
  return ref.current!.editor!.getHTML();
}

/** A Document with everything the Editor can write. */
const EVERYTHING =
  '<h1 data-align="right">Top</h1><h2 data-align="center">Title</h2><h3>Sub</h3><h4 data-align="right">Deep</h4>' +
  '<p data-align="right">Text with <strong>bold</strong>, <em>em</em>, <u>u</u>, <s>s</s>, ' +
  "<code>code</code>, x<sup>2</sup>, H<sub>2</sub>O<br>next line</p>" +
  '<p><span data-color="danger">red text</span> <mark data-color="yellow">marked</mark> ' +
  '<span style="color:#ff0000">own</span> <mark style="background-color:#ffee00">own</mark> ' +
  '<a href="https://example.com/a?b=1">link</a> <a href="mailto:team@example.com">mail</a></p>' +
  '<ul><li><p>One</p></li></ul><ol start="3"><li><p>Three</p></li></ol>' +
  '<ul data-type="taskList"><li data-type="taskItem" data-checked="true">' +
  '<label><input type="checkbox" checked><span></span></label><div><p>done</p></div></li>' +
  '<li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span>' +
  "</label><div><p>todo</p></div></li></ul>" +
  "<blockquote><p>Quote</p></blockquote><hr>" +
  '<pre><code class="language-python">def f():\n    return "&lt;b&gt;"</code></pre>' +
  "<pre><code>plain</code></pre>" +
  "<table><tbody><tr><th><p>H1</p></th><th><p>H2</p></th><th><p>H3</p></th></tr>" +
  '<tr><td colspan="2" data-align="center"><p>merged</p></td><td rowspan="2"><p>tall</p></td></tr>' +
  "<tr><td><p>a</p></td><td><p>b</p></td></tr></tbody></table>" +
  '<figure><img src="https://cdn.example.com/a.png" alt="Diagram" data-width="50">' +
  "<figcaption>Caption</figcaption></figure>" +
  '<figure><img src="https://cdn.example.com/b.png" alt=""></figure>' +
  '<div data-block="layout" data-layout="40-60"><div data-block="column"><p>Left</p></div>' +
  '<div data-block="column"><ul><li><p>Right</p></li></ul></div></div>';

test("everything the editor writes passes the sanitiser byte for byte", () => {
  const saved = load(EVERYTHING);
  // Checks that the document really carries everything it was written for.
  for (const feature of [
    'style="color:#ff0000"',
    'class="language-python"',
    'colspan="2"',
    'type="checkbox"',
    'src="https://cdn.example.com/a.png"',
    'data-color="yellow"',
    'rel="noopener noreferrer"',
    'data-layout="40-60"',
  ]) {
    expect(saved, feature).toContain(feature);
  }

  expect(sanitizeRichText(saved, purify)).toBe(saved);
});

/*
  Forgeries: each one is what a request can bring in bypassing the UI, and what
  the sanitizer turns it into. The text from a stripped wrapper stays.
*/
const ATTACKS: [name: string, input: string, output: string][] = [
  ["Tailwind classes on a block", '<p class="fixed inset-0 z-50">x</p>', "<p>x</p>"],
  ["style on a paragraph", '<p style="position:fixed;inset:0">x</p>', "<p>x</p>"],
  ["style on a span that is not the author colour", '<span style="color:red">x</span>', "x"],
  [
    "style next to data-color",
    '<p><span data-color="danger" style="color:#ff0000">x</span></p>',
    '<p><span data-color="danger">x</span></p>',
  ],
  ["foreign data-color on span", '<p><span data-color="yellow">x</span></p>', "<p>x</p>"],
  ["unknown data-color on mark", '<p><mark data-color="hotpink">x</mark></p>', "<p>x</p>"],
  [
    "legacy marker name is migrated",
    '<p><mark data-color="accent">x</mark></p>',
    '<p><mark data-color="blue">x</mark></p>',
  ],
  ["data-color on a paragraph", '<p data-color="danger">x</p>', "<p>x</p>"],
  ["unknown alignment", '<p data-align="justify">x</p>', "<p>x</p>"],
  ["stray label", "<p><label>x</label></p>", "<p>x</p>"],
  [
    "text input in a task item",
    '<ul data-type="taskList"><li data-type="taskItem"><label><input type="text" value="pw"></label></li></ul>',
    '<ul data-type="taskList"><li data-type="taskItem"><label></label></li></ul>',
  ],
  ["start on ul", '<ul start="3"><li><p>x</p></li></ul>', "<ul><li><p>x</p></li></ul>"],
  [
    "unknown code language and a second class",
    '<pre class="language-python"><code class="language-rust evil">x</code></pre>',
    "<pre><code>x</code></pre>",
  ],
  [
    "highlight tokens are not in the schema",
    '<pre><code class="language-go"><span class="hljs-keyword">func</span></code></pre>',
    '<pre><code class="language-go">func</code></pre>',
  ],
  [
    "colspan beyond the schema limit",
    '<table><tbody><tr><td colspan="10000" rowspan="0"><p>x</p></td></tr></tbody></table>',
    "<table><tbody><tr><td><p>x</p></td></tr></tbody></table>",
  ],
  ["javascript: link", '<p><a href="javascript:alert(1)">x</a></p>', "<p>x</p>"],
  ["relative link", '<p><a href="/admin">x</a></p>', "<p>x</p>"],
  [
    "foreign rel and target",
    '<p><a href="https://e.com" rel="opener" target="_blank">x</a></p>',
    '<p><a href="https://e.com" rel="noopener noreferrer">x</a></p>',
  ],
  ["href on a span", '<p><span href="https://e.com">x</span></p>', "<p>x</p>"],
  ["data: image", '<figure><img src="data:image/png;base64,AAAA" alt=""></figure>', ""],
  ["blob: image", '<figure><img src="blob:https://e.com/1" alt=""></figure>', ""],
  ["image outside figure", '<p><img src="https://e.com/a.png" alt="">x</p>', "<p>x</p>"],
  [
    "unknown image width and a class",
    '<figure><img src="https://e.com/a.png" alt="" data-width="33" class="x"></figure>',
    '<figure><img src="https://e.com/a.png" alt=""></figure>',
  ],
  ["figcaption outside figure", "<figcaption>x</figcaption>", "x"],
  ["script and handlers", '<p onclick="steal()">x<script>steal()</script></p>', "<p>x</p>"],
];

test.each(ATTACKS)("%s", (_name, input, output) => {
  expect(sanitizeRichText(input, purify)).toBe(output);
});

/*
  The language class passes sanitizing by the Schema's list, not by its own copy: a language
  added to `codeLanguages.ts` (JSON — OLDSUI-59) must survive right away until the
  View page, not be stripped by the sanitizer.
*/
test("a block in every schema language keeps its class through the sanitiser", () => {
  for (const language of RICH_TEXT_SCHEMA.codeLanguages) {
    const html = `<pre><code class="language-${language}">x</code></pre>`;
    expect(sanitizeRichText(html, purify), language).toBe(html);
  }
});

/*
  Hooks are installed for the duration of one call and removed afterwards: the DOMPurify instance is
  shared in the consumer's code (comments, emails), and the Schema rules must not
  fire in someone else's sanitizing call. The consumer's own hooks stay in place.
*/
test("the helper leaves the consumer's instance as it found it", () => {
  const own = serverPurifier();
  const seen: string[] = [];
  own.addHook("afterSanitizeAttributes", (node) => void seen.push(node.nodeName));

  expect(sanitizeRichText('<p class="x">a</p>', own)).toBe("<p>a</p>");
  expect(own.sanitize('<p class="x">a</p>', { ALLOWED_ATTR: ["class"] })).toBe(
    '<p class="x">a</p>'
  );
  // The consumer's hook saw both sanitizing calls: ours and its own.
  expect(seen.filter((name) => name === "P")).toHaveLength(2);
});

/*
  A config without hooks is closed by default. Whoever passes it to DOMPurify directly,
  forgetting the hooks, gets less markup, but not foreign CSS, classes, base64 and
  ten thousand empty cells: attributes that are dangerous without a check by tag and value
  are not added to the shared list.
*/
test("the bare config, used without hooks, admits no style, class, data: image or huge span", () => {
  const bare = serverPurifier();
  const html =
    '<p class="fixed inset-0" style="position:fixed">x</p>' +
    '<p><span style="color:red" class="x">y</span></p>' +
    '<figure><img src="data:image/png;base64,AAAA" alt=""></figure>' +
    '<table><tbody><tr><td colspan="10000"><p>z</p></td></tr></tbody></table>' +
    '<p><input type="text" value="password"></p>' +
    '<p><a href="javascript:alert(1)">l</a></p>';

  const out = bare.sanitize(html, richTextSanitizeConfig());

  for (const leak of ["style=", "class=", "data:", "colspan", "<img", "<input", "javascript:"]) {
    expect(out, leak).not.toContain(leak);
  }
  // The text and the safe markup are in place.
  expect(out).toContain("<p>x</p>");
  expect(out).toContain("<td><p>z</p></td>");
});
