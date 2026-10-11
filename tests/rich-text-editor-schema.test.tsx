// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, beforeAll, expect, test } from "vitest";
import { RichTextEditor, type RichTextEditorHandle } from "../src/editor/index.js";
import { RICH_TEXT_SCHEMA } from "../src/editor/core/schema.js";
import { loadLazyBuiltins } from "./editor-lazy-builtins.js";

// Ленивые `codeBlock` и `table` (OLDSUI-111): `full` готов в `render` после загрузки чанков.
beforeAll(loadLazyBuiltins);

afterEach(cleanup);

/**
 * Схема — единственный источник допустимой разметки (ADR-0050): что не в ней,
 * отбрасывается и при загрузке `value`, и при вставке. Здесь же сверяется, что
 * белый список ДАННЫМИ (`RICH_TEXT_SCHEMA`) совпадает с тем, что редактор
 * реально отдаёт, — в обе стороны: список, разрешающий лишнее, стал бы плохим
 * конфигом для санитайзера на сервере потребителя.
 */

function load(html: string): string {
  const ref = createRef<RichTextEditorHandle>();
  render(<RichTextEditor ref={ref} aria-label="Body" defaultValue={html} />);
  return ref.current!.editor!.getHTML();
}

function paste(html: string): string {
  const ref = createRef<RichTextEditorHandle>();
  render(<RichTextEditor ref={ref} aria-label="Body" />);
  const editor = ref.current!.editor!;
  // Тот же путь, что у вставки из буфера: разбор HTML схемой и транзакция с
  // меткой `paste`. `ClipboardEvent` в jsdom нет, поэтому событие — обычное.
  act(() => void editor.view.pasteHTML(html, new Event("paste") as ClipboardEvent));
  return editor.getHTML();
}

/** Теги и атрибуты разметки — то, что увидит санитайзер на сервере. */
function inventory(html: string) {
  const root = document.createElement("div");
  root.innerHTML = html;
  const tags = new Set<string>();
  const attributes = new Set<string>();
  for (const element of root.querySelectorAll("*")) {
    const tag = element.tagName.toLowerCase();
    tags.add(tag);
    for (const attribute of element.getAttributeNames()) attributes.add(`${tag}[${attribute}]`);
  }
  return { tags, attributes };
}

const HOSTILE =
  '<p style="color:red" onclick="steal()">Text<script>steal()</script></p>' +
  '<img src="data:image/png;base64,AAAA" onerror="steal()">' +
  '<p><a href="javascript:steal()">link</a> and <span class="x" style="font-size:40px">span</span></p>' +
  "<iframe src='https://example.com'></iframe><table style='width:9px' onclick='steal()'><colgroup><col style='width:1px'></colgroup>" +
  "<tr><td colspan='2' rowspan='2' colwidth='9' style='color:red' align='right' onclick='steal()'>cell</td></tr></table>" +
  "<h1>Top</h1><h5>Deep</h5><font color=red>font</font>" +
  // Флажок и обёртки разрешены только как разметка пункта чек-листа: вне него
  // поле ввода, `label` и `div` не проходят.
  '<p><input type="text" value="x" onfocus="steal()"><label for="a">labelled</label></p>' +
  // `py` — не `js`: полное имя `javascript` совпало бы с `script` в проверке ниже.
  '<pre><code class="evil language-py" data-x="1">code()</code></pre>' +
  // Цвет и выравнивание: имена вне палитры и вне списка не проходят, `style` тоже.
  '<p data-align="justify" data-color="danger"><span data-color="hotpink" style="color:red">c</span>' +
  '<mark style="background:yellow">m</mark><b data-color="danger">b</b></p>' +
  '<p data-align="center"><span data-color="danger">ok</span><mark data-color="green">ok</mark></p>' +
  // Палитры по тегам: имя маркера на `span` и имя цвета текста вне миграции не проходят.
  '<p><span data-color="yellow">x</span><mark data-color="hotpink">y</mark></p>' +
  '<ul data-type="taskList"><li data-type="taskItem" data-checked="true" data-evil="1">' +
  '<label><input type="checkbox" checked onclick="steal()"><span></span></label><div><p>todo</p></div></li></ul>' +
  // Картинка: только `src` (http/https), `alt` и `data-width` из пресетов; ни
  // `style`, ни размеров, ни классов, ни обработчиков — ни на `img`, ни на `figure`.
  '<figure class="wide" style="float:left" data-width="50" src="javascript:steal()">' +
  '<img src="https://cdn.example.com/a.png" alt="ok" width="300" height="200" title="t" ' +
  'class="x" style="width:10px" data-width="33" loading="lazy" onerror="steal()">' +
  '<figcaption style="color:red" class="c">caption</figcaption></figure>' +
  '<img src="blob:https://example.com/0b6b"><img src="/relative.png"><img src=" java\tscript:steal()">';

const ALLOWED_TAGS = new Set<string>([...RICH_TEXT_SCHEMA.blocks, ...RICH_TEXT_SCHEMA.marks]);
const ALLOWED_ATTRIBUTES = new Set(
  Object.entries(RICH_TEXT_SCHEMA.attributes).flatMap(([tag, names]) =>
    names.map((name) => `${tag}[${name}]`)
  )
);

for (const [path, run] of [
  ["loading a value", load],
  ["pasting", paste],
] as const) {
  test(`${path} drops everything outside the schema`, () => {
    const html = run(HOSTILE);
    const { tags, attributes } = inventory(html);

    expect([...tags].filter((tag) => !ALLOWED_TAGS.has(tag))).toEqual([]);
    expect([...attributes].filter((name) => !ALLOWED_ATTRIBUTES.has(name))).toEqual([]);
    expect(html).not.toMatch(/script|javascript:|onerror|onclick|style=|base64/i);
    // Текст из неразрешённой обёртки не теряется — теряется сама обёртка.
    expect(html).toContain("link");
    expect(html).toContain("cell");
    expect(html).toContain("labelled");
    // Из классов `<code>` остаётся только язык блока кода — полным именем.
    expect(html).toContain('<code class="language-python">code()</code>');
    expect(html.match(/<input/g)).toHaveLength(1);
    // Картинки вне политики адреса пропадают целиком; та, что в политике, —
    // с `src` и `alt`, без ширины вне пресетов.
    expect(html.match(/<img/g)).toHaveLength(1);
    expect(html).toContain(
      '<figure><img src="https://cdn.example.com/a.png" alt="ok"><figcaption>caption</figcaption></figure>'
    );
    expect(html).not.toMatch(/blob:|relative\.png/);
  });
}

test("the schema names the two palettes by tag and the old marker names", () => {
  const { textColors, markerColors, legacyMarkerColors } = RICH_TEXT_SCHEMA;

  expect([...textColors]).toEqual(["accent", "success", "warning", "danger", "lime", "muted"]);
  // Порядок — сетки «Цвет маркера», по оттенку (OLDSUI-153).
  expect([...markerColors]).toEqual([
    "gray",
    "brown",
    "orange",
    "yellow",
    "green",
    "blue",
    "purple",
    "pink",
    "red",
  ]);
  // Палитры не пересекаются: имя однозначно говорит, чьё оно.
  expect(textColors.filter((name) => (markerColors as readonly string[]).includes(name))).toEqual(
    []
  );
  // Старые имена маркера — ровно имена цвета текста, и все они переводятся.
  expect(Object.keys(legacyMarkerColors).sort()).toEqual([...textColors].sort());
  for (const target of Object.values(legacyMarkerColors)) {
    expect(markerColors as readonly string[]).toContain(target);
  }
});

test("a text colour name on a mark migrates, a marker name on a span is dropped", () => {
  expect(load('<p><mark data-color="danger">a</mark><span data-color="red">b</span></p>')).toBe(
    '<p><mark data-color="red">a</mark>b</p>'
  );
});

test("every tag and attribute the schema lists survives a round trip", () => {
  const sample =
    "<h1>One</h1><h2>Two</h2><h3>Three</h3><h4>Four</h4>" +
    "<p><strong>b</strong> <em>i</em> <u>u</u> <s>s</s> <code>c</code> <sup>2</sup> <sub>1</sub>" +
    '<br>next <a href="https://example.com">link</a></p>' +
    '<p data-align="center"><span data-color="danger">c</span><mark data-color="green">m</mark></p>' +
    '<p><span style="color:#ff0000">c</span><mark style="background-color:#ffee00">m</mark></p>' +
    '<h1 data-align="center">Top</h1><h2 data-align="right">Right</h2><h3 data-align="center">C</h3><h4 data-align="right">R</h4>' +
    '<ul><li><p>u</p></li></ul><ol start="3"><li><p>o</p></li></ol>' +
    '<ul data-type="taskList"><li data-type="taskItem" data-checked="true"><p>done</p></li></ul>' +
    '<pre><code class="language-typescript">const a = 1;</code></pre>' +
    "<blockquote><p>q</p></blockquote><hr>" +
    "<table><tbody>" +
    '<tr><th colspan="2" data-align="center"><p>h</p></th><th rowspan="2"><p>i</p></th></tr>' +
    '<tr><td colspan="2" data-align="right"><p>d</p></td></tr>' +
    '<tr><td rowspan="2"><p>e</p></td><td><p>f</p></td><td><p>g</p></td></tr>' +
    "<tr><td><p>j</p></td><td><p>k</p></td></tr>" +
    "</tbody></table>" +
    '<figure><img src="https://cdn.example.com/a.png" alt="A" data-width="75">' +
    "<figcaption>Caption</figcaption></figure>" +
    '<div data-block="layout" data-layout="60-40"><div data-block="column"><p>l</p></div>' +
    '<div data-block="column"><p>r</p></div></div>' +
    '<div data-block="wrapper" data-tone="warning"><p>w</p></div>';
  const { tags, attributes } = inventory(load(sample));

  expect([...ALLOWED_TAGS].filter((tag) => !tags.has(tag))).toEqual([]);
  expect([...ALLOWED_ATTRIBUTES].filter((name) => !attributes.has(name))).toEqual([]);
});
