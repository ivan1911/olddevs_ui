import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { highlightCodeBlocks } from "./features/code/highlight.js";
import { EDITOR_MARKER_NAMES, EDITOR_TEXT_COLOR_NAMES } from "./styles/palette.js";
import { RichTextEditor } from "./RichTextEditor.js";
import { RichTextView } from "./RichTextView.js";

/*
  Нейтральный документ с каждым Блоком и каждой Меткой Схемы — тот же, что в
  историях Редактора: типографику сравнивают на одном тексте.
*/
const SAMPLE =
  "<h2>Release notes</h2>" +
  "<p>This document shows every block the editor supports. Text can be " +
  "<strong>bold</strong>, <em>italic</em>, <s>struck through</s> or <code>inline code</code>.</p>" +
  "<h3>What changed</h3>" +
  "<ul><li><p>First item of a bulleted list</p></li><li><p>Second item</p>" +
  "<ul><li><p>A nested item</p></li></ul></li></ul>" +
  "<ol><li><p>Step one</p></li><li><p>Step two</p></li></ol>" +
  "<h4>A smaller heading</h4>" +
  "<blockquote><p>A quotation stands apart from the surrounding text.</p></blockquote>" +
  "<hr><p>Text after the divider.</p>";

/* Таблица: строка-заголовок из `th`, шесть столбцов — шире узкого экрана. */
const TABLE_HTML =
  "<h2>Roadmap</h2><p>Quarterly plan by area.</p>" +
  "<table><tbody>" +
  "<tr><th><p>Area</p></th><th><p>Owner</p></th><th><p>Status</p></th><th><p>Start</p></th>" +
  "<th><p>Finish</p></th><th><p>Notes</p></th></tr>" +
  "<tr><td><p>Search</p></td><td><p>Alex</p></td><td><p><strong>Done</strong></p></td><td><p>Jan 9</p></td>" +
  "<td><p>Feb 20</p></td><td><p>Shipped to <em>all</em> accounts</p></td></tr>" +
  "<tr><td><p>Billing</p></td><td><p>Sam</p></td><td><p>In progress</p></td><td><p>Feb 1</p></td>" +
  "<td><p>Apr 3</p></td><td><p>Waiting on the <code>invoice</code> format</p></td></tr>" +
  "</tbody></table><p>Text after the table.</p>";

/*
  Слитые ячейки и выравнивание столбца — так их пишет меню «Таблица» Редактора:
  `colspan`, `rowspan` и `data-align` на каждой ячейке столбца.
*/
const MERGED_TABLE_HTML =
  "<table><tbody>" +
  '<tr><th rowspan="2"><p>Area</p></th><th colspan="2" data-align="center"><p>Q1</p></th></tr>' +
  '<tr><th data-align="right"><p>Plan</p></th><th data-align="right"><p>Fact</p></th></tr>' +
  '<tr><td><p>Search</p></td><td data-align="right"><p>1,200</p></td><td data-align="right"><p>1,150</p></td></tr>' +
  '<tr><td><p>Billing</p></td><td colspan="2" data-align="center"><p>moved to Q2</p></td></tr>' +
  "</tbody></table>";

const meta = {
  title: "Content/RichTextView",
  component: RichTextView,
  parameters: { layout: "padded" },
  args: { html: SAMPLE },
  render: (args) => (
    <div className="max-w-[640px]">
      <RichTextView {...args} />
    </div>
  ),
} satisfies Meta<typeof RichTextView>;

export default meta;
type Story = StoryObj<typeof meta>;

/*
  Блоки кода: по одному на каждый язык Редактора и обычный текст.
  В образцах есть ключевые слова, строки, числа, комментарии и теги — чтобы
  тему подсветки было видно целиком и axe мерил контраст каждой роли токена
  во всех трёх темах.
*/
const CODE_SAMPLES = [
  ["python", '# Greets a user\ndef greet(name: str) -> str:\n    return f"Hello, {name}!" * 2'],
  [
    "typescript",
    "// Sum of a list\nexport function sum(values: number[]): number {\n  return values.reduce((a, b) => a + b, 0);\n}",
  ],
  ["javascript", 'const user = { name: "Ada", age: 36 };\nconsole.log(`Hi, ${user.name}`, this);'],
  ["go", 'package main\n\nimport "fmt"\n\nfunc main() {\n\tfmt.Println(len("hi"), true)\n}'],
  [
    "html",
    '<!DOCTYPE html>\n<a href="/docs" class="link">Docs &amp; guides</a>\n<!-- a comment -->',
  ],
  [
    "json",
    '{\n  "id": 4821,\n  "status": "assembling",\n  "paid": true,\n  "tags": ["api", null]\n}',
  ],
  ["yaml", "# Service config\nname: billing\nreplicas: 3\nenabled: true\ntags:\n  - api"],
] as const;

const escapeCode = (code: string) =>
  code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const CODE_BLOCKS =
  "<h2>Code blocks</h2>" +
  CODE_SAMPLES.map(
    ([language, code]) => `<pre><code class="language-${language}">${escapeCode(code)}</code></pre>`
  ).join("") +
  "<pre><code>Plain text is never highlighted: if (a) { return b; }</code></pre>";

/**
 * Сохранённый Документ без движка. HTML здесь — константа; в приложении он
 * приходит с сервера уже очищенным: компонент сам ничего не санитизирует.
 */
export const Playground: Story = {};

/** Пустой документ — пустой контейнер, без заглушки: пустое состояние рисует страница. */
export const Empty: Story = {
  args: { html: "" },
};

/**
 * Цвет, маркер и выравнивание в Просмотре: те же имена палитр, что пишет
 * Редактор, и те же классы (`prose.ts`) — без движка и без `style`. Цвет текста
 * — шесть тонов на `span`, маркер — три ярких и шесть прежних цветов Notion на `mark`. Тема
 * переключается тулбаром витрины.
 */
export const ColourAndAlignment: Story = {
  args: {
    html:
      EDITOR_TEXT_COLOR_NAMES.map(
        (name) => `<p><span data-color="${name}">Text in ${name}</span></p>`
      ).join("") +
      EDITOR_MARKER_NAMES.map(
        (name) => `<p><mark data-color="${name}">Highlight in ${name}</mark></p>`
      ).join("") +
      '<p data-align="center">Centred paragraph.</p><p data-align="right">Right-aligned paragraph.</p>',
  },
};

/**
 * Палитра маркера: три ярких цвета — жёлтый, ярко-зелёный,
 * розовый — одинаковы в `dark`, `light` и `dim`, и текст на них тёмный
 * (`--marker-text`, 4.5:1 в каждой теме, `npm run contrast`). Шесть прежних
 * цветов Notion (blue, gray, brown, orange, purple, red) красятся своими
 * значениями темы с основным текстом; их снова предлагает сетка.
 * Тема переключается тулбаром витрины, поэтому история снимается и проверяется
 * axe во всех трёх.
 *
 * Строки: сам маркер на одной строке, маркер под цветным текстом — на другой.
 * Цвет текста на маркере другого имени держит контраст не всегда, и гейт его не
 * меряет: автор выбрал пару сам.
 */
export const MarkerPalette: Story = {
  args: {
    html:
      "<h2>Marker palette</h2>" +
      "<p>" +
      EDITOR_MARKER_NAMES.map((name) => `<mark data-color="${name}">${name}</mark>`).join(" ") +
      "</p>" +
      EDITOR_MARKER_NAMES.map(
        (name) =>
          `<p><mark data-color="${name}">The body text on the ${name} marker keeps 4.5:1 ` +
          "in every theme, and the word is the cue, not the colour alone.</mark></p>"
      ).join(""),
  },
};

/** Заголовки четырёх уровней: H1 той же типографикой, что в Редакторе (`RichTextEditor` › `Heading1`). */
export const Headings: Story = {
  args: {
    html:
      "<h1>Quarterly report</h1>" +
      "<p>The main heading of a document that lives without a page of its own.</p>" +
      "<h2>Summary</h2><p>Text under the second level.</p>" +
      "<h3>Details</h3><p>Text under the third level.</p>" +
      "<h4>Notes</h4><p>Text under the fourth level.</p>",
  },
};

/** Заголовки на светлом листе: H1 в тёмной теме приложения остаётся светлым. */
export const HeadingsPaper: Story = {
  args: { ...Headings.args, surface: "paper" },
};

/** Таблица в Просмотре: те же границы и подложка строки-заголовка, что в Редакторе, на голой `<table>`. */
export const Table: Story = {
  args: { html: TABLE_HTML },
};

/** Слитые ячейки и выравнивание столбца в Просмотре: те же классы `prose.ts`, что в Редакторе. */
export const TableMerged: Story = {
  args: { html: MERGED_TABLE_HTML },
};

/**
 * Узкий экран (375 px): таблица прокручивается по горизонтали на самой
 * `<table>` — обёртки в сохранённом HTML нет, и прокрутка должна работать без неё.
 */
export const TableNarrow: Story = {
  tags: ["viewport-phone"],
  args: { html: TABLE_HTML },
};

/**
 * Подсвеченные блоки кода (ADR-0051): HTML прошёл через
 * `highlightCodeBlocks` из `@olddevs/ui/editor/highlight` — в приложении это
 * делает сервер после очистки. `RichTextView` только красит токены темой
 * GitHub Light/Dark классами контейнера; подсветчика в его графе нет.
 *
 * У каждого блока шапка: слева язык (блок без языка — без подписи), справа
 * «Копировать». Подпись приходит в HTML от сервера, кнопку вставляет клиентский
 * остров после монтирования; в буфер уходит текст кода без токенов.
 */
export const CodeBlocks: Story = {
  args: { html: highlightCodeBlocks(CODE_BLOCKS) },
};

/**
 * Светлый лист в любой теме (`surface="paper"`) — для экранов
 * печати, PDF и писем: документ выглядит как в светлой теме, маркеры и
 * подсветка кода — светлые, лист отделён от тёмной страницы рамкой и тенью.
 * Тот же документ в Редакторе — `RichTextEditor` › `PaperSurface`.
 */
export const PaperSurface: Story = {
  args: {
    surface: "paper",
    html:
      SAMPLE.replace(
        "<p>Text after the divider.</p>",
        '<p>Read the <a href="https://example.com/guide">style guide</a> before you print.</p>'
      ) +
      EDITOR_TEXT_COLOR_NAMES.map(
        (name) => `<p><span data-color="${name}">Text in ${name}</span></p>`
      ).join("") +
      "<p>" +
      EDITOR_MARKER_NAMES.map((name) => `<mark data-color="${name}">${name}</mark>`).join(" ") +
      "</p>" +
      MERGED_TABLE_HTML +
      highlightCodeBlocks(CODE_BLOCKS),
  },
};

/**
 * Редактор и Просмотр на одном документе. Правка слева сразу видна справа:
 * типографика совпадает, потому что оба берут классы из одного модуля
 * (`prose.ts`). Тема переключается тулбаром витрины, темы `dark`, `light` и `dim`
 * проверяются снимками.
 */
export const SideBySide: Story = {
  render: (args) => {
    const [html, setHtml] = useState(args.html);
    return (
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <section className="flex flex-col gap-2">
          <p className="text-fg-2 text-caption font-semibold">RichTextEditor</p>
          <RichTextEditor aria-label="Document" value={html} onChange={setHtml} changeDelay={0} />
        </section>
        <section className="flex flex-col gap-2">
          <p className="text-fg-2 text-caption font-semibold">RichTextView</p>
          <div className="border-line rounded-control border px-3 py-2.5">
            <RichTextView html={html} />
          </div>
        </section>
      </div>
    );
  },
};

/*
  Шапка блока кода: Редактор и Просмотр на одном документе рядом.
  Светлая и тёмная темы — переключатель витрины: снимок снимается во всех трёх.
*/
const HEADER_DOC =
  `<pre><code class="language-python">${escapeCode(CODE_SAMPLES[0][1])}</code></pre>` +
  '<pre><code class="language-go">func main() { fmt.Println("hello") }</code></pre>' +
  "<pre><code>Plain text: no label in the view.</code></pre>";

/**
 * Шапка блока кода: полоса над кодом, язык слева и «Копировать» справа, обе
 * части всегда на виду, на десктопе и на касании. Слева — Редактор, справа —
 * Просмотр (его HTML прошёл `highlightCodeBlocks`, как на сервере). Код
 * начинается под полосой, кнопки его не перекрывают. У блока без языка в
 * Редакторе кнопка «Plain text», в Просмотре подписи нет. Тема — переключатель витрины, снимается в `dark`,
 * `light` и `dim`.
 */
export const CodeBlockHeader: Story = {
  render: () => (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <section className="flex min-w-0 flex-col gap-2">
        <p className="text-fg-2 text-caption font-semibold">RichTextEditor</p>
        <RichTextEditor aria-label="Document" toolbar="none" defaultValue={HEADER_DOC} />
      </section>
      <section className="flex min-w-0 flex-col gap-2">
        <p className="text-fg-2 text-caption font-semibold">RichTextView</p>
        <div className="border-line rounded-control border px-3 py-2.5">
          <RichTextView html={highlightCodeBlocks(HEADER_DOC)} />
        </div>
      </section>
    </div>
  ),
};

/*
  Раскладка в Просмотре: та же сетка, что в Редакторе, без рамок.
  Образец — тот же, что в истории Редактора `Layouts`.
*/
const layoutColumn = (title: string, text: string) =>
  `<div data-block="column"><h4>${title}</h4><p>${text}</p></div>`;
const layoutBlock = (variant: string, ...columns: string[]) =>
  `<div data-block="layout" data-layout="${variant}">${columns.join("")}</div>`;

const LAYOUTS_HTML =
  "<h2>Layouts</h2><p>Each layout is one block. Its columns read from left to right.</p>" +
  layoutBlock("100", layoutColumn("Single column", "A layout of one column frames its blocks.")) +
  layoutBlock(
    "50-50",
    layoutColumn("Goals", "Ship the new search and keep the old one running until March."),
    layoutColumn("Risks", "The index rebuild may take longer than a night.")
  ) +
  layoutBlock(
    "33-33-33",
    layoutColumn("Plan", "Three steps, one per sprint."),
    layoutColumn("Owner", "Alex"),
    layoutColumn("Status", "On track")
  ) +
  layoutBlock(
    "25-25-25-25",
    layoutColumn("Q1", "Search"),
    layoutColumn("Q2", "Billing"),
    layoutColumn("Q3", "Reports"),
    layoutColumn("Q4", "Review")
  ) +
  layoutBlock(
    "60-40",
    layoutColumn("Summary", "The wide column carries the main text, the narrow one a note."),
    layoutColumn("Note", "60/40")
  ) +
  layoutBlock(
    "40-60",
    layoutColumn("Note", "40/60"),
    layoutColumn("Details", "The narrow column comes first and the wide one follows it.")
  ) +
  "<p>Text after the layouts.</p>";

/**
 * Раскладка в Просмотре: колонки той же сеткой, что в Редакторе, но без
 * пунктира — граница нужна автору, а не читателю. Порядок чтения — колонки
 * слева направо, как в разметке.
 */
export const Layouts: Story = {
  render: () => (
    <div className="max-w-[960px]">
      <RichTextView html={LAYOUTS_HTML} />
    </div>
  ),
};

/** Раскладки на светлом листе `surface="paper"`. */
export const LayoutsPaper: Story = {
  render: () => (
    <div className="max-w-[960px]">
      <RichTextView html={LAYOUTS_HTML} surface="paper" />
    </div>
  ),
};

/**
 * Узкий экран (375 px): колонки столбцом, левая сверху. Порог — ширина самого
 * Документа (контейнерный запрос), поэтому в узкой колонке страницы на широком
 * экране они тоже встают столбцом.
 */
export const LayoutNarrow: Story = {
  tags: ["viewport-phone"],
  args: { html: LAYOUTS_HTML },
};

/*
  Обёртка в Просмотре: рамки нет, отступы между Блоками — как в
  Документе. Образец — тот же, что в истории Редактора `Wrappers`.
*/
const wrapperBlock = (...blocks: string[]) => `<div data-block="wrapper">${blocks.join("")}</div>`;

const WRAPPERS_HTML =
  "<h2>Wrappers</h2><p>A wrapper groups blocks: they move, duplicate and go away together.</p>" +
  wrapperBlock(
    "<h3>Before the release</h3>",
    "<p>Check the access to the repository and the registry.</p>",
    "<ul><li><p>Run the gates</p></li><li><p>Write the changelog</p></li></ul>"
  ) +
  layoutBlock(
    "50-50",
    `<div data-block="column">${wrapperBlock("<h4>Inside a column</h4>", "<p>A wrapper stands in a layout column too.</p>")}</div>`,
    layoutColumn("Next to it", "A plain column without a wrapper.")
  ) +
  "<p>Text after the wrappers.</p>";

/**
 * Обёртка в Просмотре: читатель её не видит — ни рамки, ни отступа, Блоки
 * идут, как в Документе. Пунктир — подсказка автору в Редакторе.
 */
export const Wrappers: Story = {
  render: () => (
    <div className="max-w-[960px]">
      <RichTextView html={WRAPPERS_HTML} />
    </div>
  ),
};

/*
  Сворачиваемый Блок в Просмотре: родной `details` и `summary` — раскрывается без
  JavaScript, с клавиатуры и читается скринридером. Образец — тот же, что в
  истории Редактора `Details`; второй Блок сохранён открытым (`persist`).
*/
const DETAILS_HTML =
  "<h2>Collapsible blocks</h2><p>A block keeps its details under a title. Click the title to open it.</p>" +
  '<details><summary>How to build the package</summary><div data-type="detailsContent">' +
  "<p>Run the gates, then the build.</p>" +
  "<ol><li><p>Install the dependencies</p></li><li><p>Run <code>npm run build</code></p></li></ol>" +
  "</div></details>" +
  '<details open=""><summary>Release checklist</summary><div data-type="detailsContent">' +
  "<ul><li><p>Write the changelog</p></li><li><p>Tag the release</p></li></ul>" +
  '<details><summary>Rolling back</summary><div data-type="detailsContent">' +
  "<p>Revert the tag and publish the previous version.</p></div></details>" +
  "</div></details>" +
  "<p>Text after the blocks.</p>";

/**
 * Сворачиваемый Блок в Просмотре: без движка и без JavaScript — открывает и
 * закрывает сам браузер. Блок, сохранённый с `open`, приходит открытым.
 */
export const Details: Story = {
  render: () => (
    <div className="max-w-[640px]">
      <RichTextView html={DETAILS_HTML} />
    </div>
  ),
};

/** Сворачиваемый Блок на светлом листе `surface="paper"`. */
export const DetailsPaper: Story = {
  render: () => (
    <div className="max-w-[640px]">
      <RichTextView html={DETAILS_HTML} surface="paper" />
    </div>
  ),
};

/*
  Тон Обёртки у читателя: тот же вид, что в Редакторе, — подложка
  и полоса тона; Обёртка без тона по-прежнему невидима. Образец — тот же, что
  в истории Редактора `WrapperTones`.
*/
const tonedBlock = (tone: string, ...blocks: string[]) =>
  `<div data-block="wrapper" data-tone="${tone}">${blocks.join("")}</div>`;

const WRAPPER_TONES_HTML =
  "<h2>Wrapper tones</h2>" +
  "<p>A tone gives a wrapper a soft background and a stripe on the left.</p>" +
  tonedBlock(
    "accent",
    '<p><strong>Note:</strong> the registry moved to <a href="https://example.com">a new address</a>.</p>'
  ) +
  tonedBlock("success", "<p><strong>Tip:</strong> run the gates before you tag a release.</p>") +
  tonedBlock(
    "neutral",
    "<p><strong>Important:</strong> the changelog is written from the change notes.</p>",
    "<blockquote><p>A quotation inside a note.</p></blockquote>"
  ) +
  tonedBlock(
    "warning",
    "<h4>Warning</h4>",
    "<p>Back up the database before the upgrade.</p>",
    "<ul><li><p>Stop the workers</p></li><li><p>Take a snapshot</p></li></ul>"
  ) +
  tonedBlock("danger", "<p><strong>Caution:</strong> a deleted project cannot be restored.</p>") +
  wrapperBlock("<p>A wrapper without a tone stays invisible to the reader.</p>") +
  "<p>Text after the wrappers.</p>";

/**
 * Тоны Обёртки у читателя: мягкая подложка и полоса 3 px слева, текст —
 * обычный текст Документа. Роли и `aria-*` у Обёртки нет — смысл заметки
 * несёт слово в её тексте.
 */
export const WrapperTones: Story = {
  render: () => (
    <div className="max-w-[640px]">
      <RichTextView html={WRAPPER_TONES_HTML} />
    </div>
  ),
};

/** Тоны Обёртки на светлом листе `surface="paper"` — в любой теме приложения. */
export const WrapperTonesPaper: Story = {
  render: () => (
    <div className="max-w-[640px]">
      <RichTextView html={WRAPPER_TONES_HTML} surface="paper" />
    </div>
  ),
};
