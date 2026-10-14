import { Mark, Node } from "@tiptap/core";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useRef, useState, type RefObject } from "react";
import { Button } from "../components/actions/Button.js";
import { Dialog } from "../components/overlays/Dialog.js";
import { Drawer } from "../components/overlays/Drawer.js";
import { FormField } from "../components/inputs/FormField.js";
import { UiProvider } from "../i18n/UiProvider.js";
import { MentionIcon, PinIcon, SparkleIcon, TagIcon, WrapperIcon } from "../icons.js";
import ru from "../locales/ru.js";
import { EDITOR_MARKER_NAMES, EDITOR_TEXT_COLOR_NAMES } from "./styles/palette.js";
import {
  RichTextEditor,
  type RichTextEditorHandle,
  type RichTextEditorProps,
} from "./RichTextEditor.js";
import { markRange, type CustomTool } from "./core/customTool.js";
import { FLOATING_TOOLBAR_KEY } from "./ui/FloatingToolbar.js";
import { SELECTION_BUBBLE_KEY } from "./ui/SelectionBubble.js";
import { TableSizeGrid as SizeGrid } from "./features/table/TableSizeGrid.js";
import { tool } from "./core/toolOptions.js";
import { RICH_TEXT_PRESETS, TOOLS } from "./core/tools.js";

/*
  Нейтральный документ: заголовки, списки, чек-лист, цитата, блок кода,
  разделитель и все метки — чтобы типографику было видно целиком, без доменных
  данных.
*/
const SAMPLE =
  "<h2>Release notes</h2>" +
  "<p>This document shows every block the editor supports. Text can be " +
  "<strong>bold</strong>, <em>italic</em>, <u>underlined</u>, <s>struck through</s> or " +
  "<code>inline code</code>; formulas need x<sup>2</sup> and H<sub>2</sub>O.</p>" +
  "<h3>What changed</h3>" +
  "<ul><li><p>First item of a bulleted list</p></li><li><p>Second item</p>" +
  "<ul><li><p>A nested item</p></li></ul></li></ul>" +
  "<ol><li><p>Step one</p></li><li><p>Step two</p></li></ol>" +
  '<ul data-type="taskList"><li data-type="taskItem" data-checked="true"><p>A finished task</p></li>' +
  '<li data-type="taskItem" data-checked="false"><p>A task still open</p></li></ul>' +
  '<pre><code class="language-ts">const answer = 42;</code></pre>' +
  "<h4>A smaller heading</h4>" +
  "<blockquote><p>A quotation stands apart from the surrounding text.</p></blockquote>" +
  "<hr><p>Text after the divider.</p>";

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
  [
    "markdown",
    "# Release notes\n\n- **Fixed** a crash on `save`\n- See [the docs](https://example.com)",
  ],
] as const;

const escapeCode = (code: string) =>
  code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const CODE_BLOCKS =
  "<h2>Code blocks</h2>" +
  CODE_SAMPLES.map(
    ([language, code]) => `<pre><code class="language-${language}">${escapeCode(code)}</code></pre>`
  ).join("") +
  "<pre><code>Plain text is never highlighted: if (a) { return b; }</code></pre>";

/*
  Палитры в документе: имена цвета текста — на `span`, имена маркера — на `mark`.
  Списки имён — данные кита (`palette.ts`), поэтому новый цвет попадает в
  историю сам и в её снимки во всех темах (`dark`, `light`, `dim`) тоже.
*/
const COLOURS =
  "<h2>Colour, highlight and alignment</h2>" +
  EDITOR_TEXT_COLOR_NAMES.map(
    (name) => `<p><span data-color="${name}">Text in ${name}</span></p>`
  ).join("") +
  EDITOR_MARKER_NAMES.map(
    (name) => `<p><mark data-color="${name}">Highlight in ${name}</mark></p>`
  ).join("") +
  '<p data-align="center">A paragraph aligned to the centre.</p>' +
  '<p data-align="right">A paragraph aligned to the right.</p>' +
  '<h3 data-align="center">A heading aligned to the centre</h3>' +
  "<p>Text on the default alignment, to the left.</p>";

/*
  Цвет автора: единственный `style` в документе, и только в строгой
  форме. Рядом с палитрой — чтобы разницу видно: палитра следует за темой
  (`dark`, `light`, `dim`), цвет автора остаётся тем же во всех трёх, и на одной
  из тем пара «цвет — фон» может не держать контраст. Так задумано и сказано в
  документации; история снимается во всех темах, чтобы это было видно.
  Текст на любом маркере тёмный (`--marker-text`): и на яркой
  палитре, и на цвете автора; цвет текста автора под маркером им перекрывается.
*/
const CUSTOM_COLOURS =
  "<h2>Custom colour</h2>" +
  '<p><span data-color="danger">Palette red follows the theme</span> · ' +
  '<mark style="background-color:#fee4e2"><span style="color:#b42318">' +
  "custom red stays #b42318</span></mark></p>" +
  '<p><mark data-color="yellow">Palette highlight is bright in every theme</mark> · ' +
  '<mark style="background-color:#ffe066"><span style="color:#3d2c00">' +
  "custom highlight stays #ffe066</span></mark></p>" +
  '<p><mark style="background-color:#b8e6c1">A custom highlight carries the dark marker text</mark> ' +
  "and looks the same in every theme.</p>" +
  "<p>An author colour on its own does not follow the theme and can lose contrast " +
  "when the theme changes; the picker warns against the current theme only. " +
  "This sample pairs every custom text colour with its own highlight, so it reads in all themes.</p>" +
  "<p>Select a word and choose Color › «Custom color…» for the text or the highlight.</p>";

/*
  Таблица: строка-заголовок, текст и метки в ячейках. Шесть столбцов — чтобы на
  узком экране она не помещалась и прокручивалась (`TableNarrow`).
*/
const TABLE_SAMPLE =
  "<h2>Roadmap</h2><p>Quarterly plan by area.</p>" +
  "<table><tbody>" +
  "<tr><th><p>Area</p></th><th><p>Owner</p></th><th><p>Status</p></th><th><p>Start</p></th>" +
  "<th><p>Finish</p></th><th><p>Notes</p></th></tr>" +
  "<tr><td><p>Search</p></td><td><p>Alex</p></td><td><p><strong>Done</strong></p></td><td><p>Jan 9</p></td>" +
  "<td><p>Feb 20</p></td><td><p>Shipped to <em>all</em> accounts</p></td></tr>" +
  "<tr><td><p>Billing</p></td><td><p>Sam</p></td><td><p>In progress</p></td><td><p>Feb 1</p></td>" +
  "<td><p>Apr 3</p></td><td><p>Waiting on the <code>invoice</code> format</p></td></tr>" +
  "<tr><td><p>Reports</p></td><td><p>Kim</p></td><td><p>Planned</p></td><td><p>Apr 6</p></td>" +
  "<td><p>Jun 12</p></td><td><p>Needs a design review</p></td></tr>" +
  "</tbody></table><p>Text after the table.</p>";

/*
  Слитые ячейки: заголовок «Q1» над двумя столбцами (`colspan`) и область,
  растянутая на две строки (`rowspan`), — так приходит таблица из Word или
  Google Docs. Каретка — в обычной ячейке, и «Ячейка › Объединить» доступно
  после выделения нескольких ячеек мышью или Shift со стрелками.
*/
const MERGED_SAMPLE =
  "<h2>Budget</h2>" +
  "<table><tbody>" +
  '<tr><th rowspan="2"><p>Area</p></th><th colspan="2" data-align="center"><p>Q1</p></th>' +
  '<th colspan="2" data-align="center"><p>Q2</p></th></tr>' +
  '<tr><th data-align="right"><p>Plan</p></th><th data-align="right"><p>Fact</p></th>' +
  '<th data-align="right"><p>Plan</p></th><th data-align="right"><p>Fact</p></th></tr>' +
  '<tr><td><p>Search</p></td><td data-align="right"><p>1,200</p></td><td data-align="right"><p>1,150</p></td>' +
  '<td data-align="right"><p>1,300</p></td><td data-align="right"><p>1,410</p></td></tr>' +
  '<tr><td rowspan="2"><p>Billing</p></td><td data-align="right"><p>800</p></td><td data-align="right"><p>760</p></td>' +
  '<td colspan="2" data-align="center"><p>moved to Q3</p></td></tr>' +
  '<tr><td data-align="right"><p>90</p></td><td data-align="right"><p>95</p></td>' +
  '<td data-align="right"><p>100</p></td><td data-align="right"><p>98</p></td></tr>' +
  "</tbody></table><p>Merged cells stay merged in HTML; Markdown keeps the text and loses the merge.</p>";

/*
  Сортировка и выравнивание: числа с разрядами, даты ISO и `ДД.ММ.ГГГГ`, текст.
  Сумма выровнена вправо, статус — по центру (`data-align` на каждой ячейке
  столбца). Строка-заголовок при сортировке остаётся первой.
*/
const SORT_SAMPLE =
  "<h2>Invoices</h2>" +
  "<table><tbody>" +
  '<tr><th><p>Client</p></th><th data-align="right"><p>Amount</p></th><th><p>Due</p></th>' +
  '<th data-align="center"><p>Status</p></th></tr>' +
  '<tr><td><p>Northwind</p></td><td data-align="right"><p>12,400.50</p></td><td><p>2026-11-02</p></td>' +
  '<td data-align="center"><p>sent</p></td></tr>' +
  '<tr><td><p>Contoso</p></td><td data-align="right"><p>980</p></td><td><p>15.10.2026</p></td>' +
  '<td data-align="center"><p>paid</p></td></tr>' +
  '<tr><td><p>Fabrikam</p></td><td data-align="right"><p>-150</p></td><td><p>2026-10-20</p></td>' +
  '<td data-align="center"><p>credit</p></td></tr>' +
  '<tr><td><p>Adventure Works</p></td><td data-align="right"><p>3,000</p></td><td><p>01.12.2026</p></td>' +
  '<td data-align="center"><p>draft</p></td></tr>' +
  "</tbody></table><p>Put the caret in a column and choose Table › Sort.</p>";

const meta = {
  title: "Inputs/RichTextEditor",
  component: RichTextEditor,
  parameters: { layout: "padded" },
  args: { "aria-label": "Document", defaultValue: SAMPLE },
  render: (args) => (
    <div className="max-w-[640px]">
      {/* Набор инструментов читается при создании движка: смена пресета в
          панели управления пересоздаёт поле ключом. */}
      <RichTextEditor key={`${args.preset}-${args.tools?.join()}`} {...args} />
    </div>
  ),
} satisfies Meta<typeof RichTextEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Все Блоки и Метки и фиксированная Панель в пресете `full`. Панель — одна
 * остановка Tab, по кнопкам — стрелки, Home и End; подсказка называет
 * сочетание клавиш. Раскладка — порядок кита: «+», HTML, «¶»,
 * выравнивание ▾ | метки и «…» (в нём и блок кода) | списки ▾ |
 * ссылка, картинка, таблица ▾, эмодзи | отмена и повтор, справочник сочетаний
 * у правого края.
 */
export const Playground: Story = {};

/** Пресет `basic` — для комментариев и коротких описаний. */
export const BasicPreset: Story = {
  args: {
    preset: "basic",
    defaultValue:
      "<p>A short comment with <strong>bold</strong> and a list:</p><ul><li><p>one</p></li></ul>",
  },
};

/**
 * Точный список инструментов: `tools` сильнее пресета. Порядок кнопок задаёт
 * кит, а не список. Заголовков в наборе нет — `<h2>` из значения пришёл
 * абзацем.
 */
export const CustomTools: Story = {
  args: { tools: ["bold", "italic", "taskList", "history"] },
};

/** Без Панели: форматирование остаётся за клавиатурой и markdown-шорткатами. */
export const WithoutToolbar: Story = {
  args: { toolbar: "none" },
};

/**
 * Плавающая Панель: выделите слово — Панель появится над ним. `Alt+F10` из
 * документа переводит в неё фокус, `Shift+Tab` возвращает. На сенсорном
 * экране (`pointer: coarse`) вместо неё — фиксированная.
 */
export const FloatingToolbar: Story = {
  args: {
    toolbar: "floating",
    defaultValue:
      "<p>Select a few words in this paragraph: the formatting toolbar appears right above " +
      "the selection and hides again when the selection collapses.</p>" +
      "<p>From the keyboard: select with Shift and the arrows, then press Alt+F10.</p>",
  },
  render: (args) => (
    // Запас сверху — Панель встаёт над первой строкой.
    <div className="max-w-[640px] pt-16">
      <RichTextEditor {...args} />
    </div>
  ),
};

/*
  Меню выделения, показанное сразу: фокус в Документ, выделение
  на слове и команда показа — та же, которой плашку зовёт `Alt+F10`. Без
  команды плашка ждала бы задержку показа, и снимок мог бы её не застать.

  Одного `show` мало: плагин `BubbleMenu` сначала считает позицию,
  а потом показывает, а скрытой плашке позицию не считает. Плашка встаёт без
  `top`/`left` — под полем — и уезжает к выделению только по задержке показа,
  через ~250 мс. Снимок, устоявшийся раньше, ловил её под полем. Второй
  командой позиция считается уже у видимой плашки.
*/
function useShownBubble(
  ref: RefObject<RichTextEditorHandle | null>,
  word: string,
  key: string = SELECTION_BUBBLE_KEY
) {
  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const editor = ref.current?.editor;
      if (!editor) {
        frame = requestAnimationFrame(tick);
        return;
      }
      let from = -1;
      editor.state.doc.descendants((node, pos) => {
        const at = node.isText ? (node.text ?? "").indexOf(word) : -1;
        if (from < 0 && at >= 0) from = pos + at;
      });
      if (from < 0) return;
      editor.view.focus();
      editor.commands.setTextSelection({ from, to: from + word.length });
      editor.view.dispatch(editor.state.tr.setMeta(key, "show"));
      editor.view.dispatch(editor.state.tr.setMeta(key, "updatePosition"));
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [ref, word, key]);
}

const BUBBLE_SAMPLE =
  "<h2>Meeting notes</h2>" +
  "<p>Select a few words: a compact <strong>dark</strong> menu appears above them in the " +
  "light theme and a light one in the dark themes.</p>" +
  "<p>From the keyboard: select with Shift and the arrows, then press Alt+F10.</p>";

function ShownBubble({ surface }: { surface?: "paper" }) {
  const ref = useRef<RichTextEditorHandle>(null);
  useShownBubble(ref, "compact");
  return (
    // Запас сверху — плашка встаёт над строкой, а не под ней.
    <div className="max-w-[640px] pt-16">
      <RichTextEditor
        ref={ref}
        aria-label="Document"
        toolbar="bubble"
        surface={surface}
        defaultValue={BUBBLE_SAMPLE}
      />
    </div>
  );
}

/**
 * Меню выделения (`toolbar="bubble"`): компактная плашка на
 * инверсной поверхности — тёмная в светлой теме, светлая в тёмных. Состав
 * задан китом: «¶», «Списки», жирный, курсив, подчёркнутый, «Цвет», «…», ссылка,
 * эмодзи; кнопки выключенных инструментов нет. Показ и позиция — как у плавающей Панели;
 * меню, поповеры и подсказки из плашки — на обычной поверхности. Плашка
 * показана при показе истории.
 */
export const SelectionBubble: Story = {
  render: () => <ShownBubble />,
};

/** Лист `surface="paper"`: светлый Документ, плашка — в теме приложения. */
export const SelectionBubblePaper: Story = {
  render: () => <ShownBubble surface="paper" />,
};

/**
 * Меню выделения в ящике. Плашка лежит в DOM Редактора, поэтому едет вместе
 * с текстом при прокрутке ящика; Escape в открытом из неё меню закрывает
 * только меню.
 */
export const SelectionBubbleInDrawer: Story = {
  render: function Render() {
    const [open, setOpen] = useState(true);
    return (
      <div className="h-[520px]">
        <Button onClick={() => setOpen(true)}>Open the drawer</Button>
        <Drawer open={open} onClose={() => setOpen(false)} title="Edit the note">
          <RichTextEditor aria-label="Document" toolbar="bubble" defaultValue={BUBBLE_SAMPLE} />
        </Drawer>
      </div>
    );
  },
};

/**
 * Меню выделения в контейнере прокрутки. У верхнего края контейнера плашка
 * переворачивается под выделение, у боковых — сдвигается внутрь.
 */
export const SelectionBubbleInScroll: Story = {
  render: () => (
    <div
      data-testid="scroll-container"
      className="border-line h-[260px] max-w-[480px] overflow-auto rounded-md border p-2"
    >
      <RichTextEditor
        aria-label="Document"
        toolbar="bubble"
        defaultValue={
          BUBBLE_SAMPLE +
          Array.from(
            { length: 12 },
            (_, index) => `<p>Paragraph ${index + 1} keeps the container scrolling.</p>`
          ).join("")
        }
      />
    </div>
  ),
};

/*
  Стекло видно только над контрастным фоном: над ровным текстом
  полупрозрачная подложка неотличима от сплошной. Поэтому над выделенной
  строкой — ряд цветных Меток (Панель), под ней — ещё несколько (списки «¶» и
  «…» раскрываются вниз).
*/
const MARKS_ROW =
  '<p><mark data-color="yellow">Pipeline</mark> <mark data-color="orange">forecast</mark> ' +
  '<mark data-color="green">hiring plan</mark> <mark data-color="purple">roadmap</mark> ' +
  '<mark data-color="pink">pricing</mark> <mark data-color="red">risks</mark> ' +
  '<mark data-color="blue">security audit</mark> <mark data-color="brown">budget</mark></p>';

const GLASS_SAMPLE =
  '<h2>Quarterly <mark data-color="yellow">review</mark> notes</h2>' +
  MARKS_ROW +
  "<p>The toolbar floats above this line, and the coloured marks show through it.</p>" +
  "<p><strong>Open ¶ or …</strong>: the menus drop over the rows below and blur them " +
  "the same way.</p>" +
  MARKS_ROW +
  MARKS_ROW +
  MARKS_ROW;

function ShownGlass({ toolbar }: { toolbar: "floating" | "bubble" }) {
  const ref = useRef<RichTextEditorHandle>(null);
  useShownBubble(
    ref,
    "toolbar floats",
    toolbar === "floating" ? FLOATING_TOOLBAR_KEY : SELECTION_BUBBLE_KEY
  );
  return (
    <div className="max-w-[640px] pt-16">
      <RichTextEditor
        ref={ref}
        aria-label="Document"
        toolbar={toolbar}
        defaultValue={GLASS_SAMPLE}
      />
    </div>
  );
}

/**
 * Стекло всплывающих поверхностей: плавающая Панель, меню
 * выделения, списки меню и поповеры Редактора — полупрозрачная подложка своей
 * поверхности (82 %) с размытием фона в 14px, как у тостов. При
 * `prefers-reduced-transparency` и `prefers-contrast: more` подложка сплошная.
 * Панель показана при показе истории; «¶» и «…» раскрываются над цветными
 * строками ниже.
 */
export const GlassFloatingToolbar: Story = {
  render: () => <ShownGlass toolbar="floating" />,
};

/** Меню выделения на стекле: инверсная поверхность, те же 82 % и 14px. */
export const GlassSelectionBubble: Story = {
  render: () => <ShownGlass toolbar="bubble" />,
};

/**
 * Ссылки: кнопка «Ссылка» или `Ctrl/⌘+K` открывают поле адреса у выделения.
 * Enter применяет, Escape отменяет; в существующей ссылке есть «Убрать
 * ссылку». Адрес — только `http`, `https` или `mailto`; адрес, набранный в
 * тексте, становится ссылкой сам.
 */
export const LinkEditing: Story = {
  args: {
    preset: "basic",
    defaultValue:
      '<p>Read the <a href="https://example.com/guide">setup guide</a> or write to ' +
      '<a href="mailto:team@example.com">the team</a>. Put the caret inside a link and press ' +
      "Ctrl+K to change or remove it; select plain text and press Ctrl+K to link it.</p>" +
      "<p>Type an address such as example.com followed by a space.</p>",
  },
};

/**
 * Длинный документ под липкой шапкой приложения. Шапка публикует свою высоту в
 * `--topbar-h` (здесь — вручную, у `TopBar` кита — сама), и Панель липнет
 * вплотную под ней, пока поле на экране.
 */
export const StickyUnderHeader: Story = {
  parameters: { layout: "fullscreen" },
  render: (args) => (
    <div className="h-[520px] overflow-auto [--topbar-h:56px]">
      <header className="bg-bg-1 border-line text-md sticky top-0 z-10 flex h-14 items-center border-b px-6 font-semibold">
        Application header
      </header>
      <div className="mx-auto flex max-w-[640px] flex-col gap-4 px-6 py-6">
        <p className="text-fg-2">Scroll down: the toolbar stays under the header.</p>
        <RichTextEditor {...args} defaultValue={SAMPLE + SAMPLE + SAMPLE} />
        <p className="text-fg-2">The toolbar leaves together with the field.</p>
        <div className="h-[400px]" />
      </div>
    </div>
  ),
};

/**
 * Редактор в окне. Escape в меню «¶» и в поповере ссылки закрывает меню или
 * поповер, а не окно: их слои — в общем стеке оверлеев кита (ADR-0041).
 */
export const InsideDialog: Story = {
  render: function Render(args) {
    const [open, setOpen] = useState(true);
    return (
      <div className="h-[520px]">
        <Button onClick={() => setOpen(true)}>Open the window</Button>
        <Dialog open={open} onClose={() => setOpen(false)} title="Edit the note">
          <div className="w-[560px] max-w-full">
            <RichTextEditor
              {...args}
              defaultValue="<p>Press Escape inside the block type menu, the link popover or after typing a slash.</p><p></p>"
            />
          </div>
        </Dialog>
      </div>
    );
  },
};

/**
 * Редактор в ящике: меню «…» и поповеры цвета
 * выбираются мышью и клавиатурой, Escape закрывает по одному уровню — сначала
 * поповер или меню, и только затем ящик (ADR-0041).
 */
export const InsideDrawer: Story = {
  render: function Render(args) {
    const [open, setOpen] = useState(true);
    return (
      <div className="h-[520px]">
        <Button onClick={() => setOpen(true)}>Open the panel</Button>
        <Drawer open={open} onClose={() => setOpen(false)} title="Edit the note" size="lg">
          <RichTextEditor
            {...args}
            defaultValue="<p>Select a word and open More formatting to mark it.</p><p></p>"
          />
        </Drawer>
      </div>
    );
  },
};

/**
 * Цвет текста, маркер и выравнивание. Выделите слово и выберите
 * цвет в поповере «Цвет» (сетки «Цвет текста» и «Цвет маркера») или кнопкой
 * «Маркер»; выравнивание — меню «Выравнивание ▾». В документе остаются имена палитры (`data-color`, `data-align`), без `style`;
 * конкретный цвет подставляет тема, поэтому история снимается во всех трёх.
 */
export const ColourAndAlignment: Story = {
  args: { defaultValue: COLOURS },
};

/**
 * Свой цвет: «Свой цвет…» у сеток поповера «Цвет» открывает
 * `ColorPicker` в поповере с предупреждением о контрасте против фона ТЕКУЩЕЙ
 * темы. В документе остаётся `style="color:#rrggbb"` на `span` и
 * `style="background-color:#rrggbb"` на `mark`; цвет автора не следует за
 * темой, в отличие от палитры.
 *
 * Каждый свой цвет текста в образце стоит на своём маркере: пара не зависит от
 * темы и держит контраст во всех трёх, поэтому axe-аудит историй проходит, а
 * переключение темы по-прежнему показывает, что свой цвет остаётся на месте.
 * Голый цвет автора на фоне темы контраст во всех темах не удержит — именно
 * об этом предупреждает поповер.
 */
export const CustomColour: Story = {
  args: { defaultValue: CUSTOM_COLOURS },
};

/*
  Документ с заголовками четырёх уровней: тот же образец в Редакторе
  и в Просмотре, чтобы типографику H1 сравнивали на одном тексте.
*/
const HEADING_LEVELS =
  "<h1>Quarterly report</h1>" +
  "<p>The main heading of a document that lives without a page of its own.</p>" +
  "<h2>Summary</h2><p>Text under the second level.</p>" +
  "<h3>Details</h3><p>Text under the third level.</p>" +
  "<h4>Notes</h4><p>Text under the fourth level.</p>";

/**
 * Заголовок первого уровня: с инструментом `heading1` (в `full` он
 * есть) уровни Блока — 1–4. H1 ставится сочетанием `Ctrl/⌘+Alt+1`, набором
 * `# ` или пунктом «Заголовок 1» меню «¶». Тема переключается
 * тулбаром витрины: типографика H1 снимается в `dark`, `light` и `dim`.
 */
export const Heading1: Story = {
  args: { defaultValue: HEADING_LEVELS },
};

/**
 * Тот же документ на листе `surface="paper"`: H1 светлый в любой теме
 * приложения, как остальной текст листа.
 */
export const Heading1Paper: Story = {
  args: { surface: "paper", defaultValue: HEADING_LEVELS },
};

/**
 * Экран, у которого H1 уже стоит над Редактором, выключает `heading1`: в меню
 * «¶» нет пункта «Заголовок 1», а `<h1>` из значения приходит абзацем.
 */
export const WithoutHeading1: Story = {
  args: { tools: TOOLS.filter((tool) => tool !== "heading1"), defaultValue: HEADING_LEVELS },
};

/*
  Каретка в Блоке и открытое меню Панели, как только движок создан: меню
  открывается нажатием, а не пропом, и история показывает его открытым.
  `button` — начало имени кнопки: «¶», «Выравнивание» или «Списки».
*/
function useOpenBlockMenu(
  ref: RefObject<RichTextEditorHandle | null>,
  text: string,
  button = "Block type"
) {
  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const editor = ref.current?.editor;
      if (!editor) {
        frame = requestAnimationFrame(tick);
        return;
      }
      let end = -1;
      editor.state.doc.descendants((node, pos) => {
        if (end < 0 && node.isText && node.text === text) end = pos + node.nodeSize;
      });
      if (end > 0) editor.commands.setTextSelection(end);
      // В истории одно поле, и кнопка меню на странице одна.
      const trigger = document.querySelector<HTMLElement>(`button[aria-label^="${button}"]`);
      frame = requestAnimationFrame(() => trigger?.click());
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [ref, text, button]);
}

const BLOCK_TYPES_SAMPLE =
  "<h2>Project plan</h2><p>Pick a block type from the pilcrow menu.</p>" +
  "<ul><li><p>A bulleted item keeps its text when it becomes a heading</p></li></ul>";

function OpenBlockMenu({ caret }: { caret: string }) {
  const ref = useRef<RichTextEditorHandle>(null);
  useOpenBlockMenu(ref, caret);
  return (
    <div className="h-[520px] max-w-[640px]">
      <RichTextEditor ref={ref} aria-label="Document" defaultValue={BLOCK_TYPES_SAMPLE} />
    </div>
  );
}

/**
 * Меню «¶» — тип строки: Текст и Заголовок 1–4, у
 * каждого — сочетание; списки — в «Списки ▾», цитата — флажок «…». Каретка в
 * заголовке, поэтому отмечен «Heading 2», и он же — иконка (H2) и имя кнопки.
 * Выбор меняет тип строки с сохранением текста; `Ctrl/⌘+Z` отменяет его одним шагом.
 */
export const BlockTypeMenu: Story = {
  render: () => <OpenBlockMenu caret="Project plan" />,
};

/** Каретка в пункте списка: решает строка — отмечен «Text», иконка «¶». */
export const BlockTypeMenuInList: Story = {
  render: () => <OpenBlockMenu caret="A bulleted item keeps its text when it becomes a heading" />,
};

/*
  Ручка Блока, показанная сразу: фокус в Документ и каретка в
  тексте `text` — ручка видна только у Блока с кареткой при фокусе в Редакторе,
  наведения она не ждёт. С `open` меню ещё и открыто нажатием на ручку, как
  щелчком: ручка появляется кадром позже каретки, поэтому её ждут.
*/
function useShownHandle(
  ref: RefObject<RichTextEditorHandle | null>,
  text: string,
  open: boolean,
  submenu?: string
) {
  useEffect(() => {
    let frame = 0;
    // Подменю — как с клавиатуры, фокус на пункте и `→`: наведение мышью
    // открыло бы его с задержкой, и снимок ловил бы промежуточный кадр.
    const openSubmenu = () => {
      const item = Array.from(
        document.querySelectorAll<HTMLElement>('[role="menuitem"][aria-haspopup]')
      ).find((candidate) => submenu && candidate.textContent?.startsWith(submenu));
      if (!item) {
        frame = requestAnimationFrame(openSubmenu);
        return;
      }
      item.focus();
      item.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    };
    const press = () => {
      const handle = document.querySelector<HTMLElement>('button[aria-label="Block actions"]');
      if (!handle) {
        frame = requestAnimationFrame(press);
        return;
      }
      handle.click();
      if (submenu) frame = requestAnimationFrame(openSubmenu);
    };
    const tick = () => {
      const editor = ref.current?.editor;
      if (!editor) {
        frame = requestAnimationFrame(tick);
        return;
      }
      let end = -1;
      editor.state.doc.descendants((node, pos) => {
        if (end < 0 && node.isText && node.text === text) end = pos + node.nodeSize;
      });
      editor.view.focus();
      if (end > 0) editor.commands.setTextSelection(end);
      if (open) frame = requestAnimationFrame(press);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [ref, text, open, submenu]);
}

const HANDLE_SAMPLE =
  "<h2>Weekly summary</h2>" +
  "<p>Put the caret into any block: the handle appears to the left of its first line.</p>" +
  "<ul><li><p>A list is one block: it moves, copies and changes as a whole</p></li>" +
  "<li><p>Second item of the list</p></li></ul>" +
  "<p>Text after the list.</p>";

function ShownHandle({
  caret,
  open = false,
  submenu,
  document = HANDLE_SAMPLE,
}: {
  caret: string;
  open?: boolean;
  /** Открыть и подменю — пункт, чьё имя начинается с этих слов. */
  submenu?: string;
  document?: string;
}) {
  const ref = useRef<RichTextEditorHandle>(null);
  useShownHandle(ref, caret, open, submenu);
  return (
    <div className="h-[520px] max-w-[640px]">
      <RichTextEditor ref={ref} aria-label="Document" defaultValue={document} />
    </div>
  );
}

/**
 * Ручка Блока «⋮»: у Блока с кареткой, слева от его первой строки,
 * в левом поле Документа. Каретка во втором пункте списка, а ручка — у первой
 * строки списка: Блок — весь список. Наведение ручку не показывает; с
 * клавиатуры меню открывает `Ctrl/⌘+/`.
 */
export const BlockHandle: Story = {
  render: () => <ShownHandle caret="Second item of the list" />,
};

/**
 * Меню ручки: Добавить › (пункты Меню вставки, новый Блок ниже), Формат ›
 * (пункты «¶»), Вверх, Вниз, Дублировать и Удалить — красным. У абзаца
 * верхнего уровня подписаны сочетания: они делают то же, что пункты.
 */
export const BlockHandleMenu: Story = {
  render: () => (
    <ShownHandle
      caret="Put the caret into any block: the handle appears to the left of its first line."
      open
    />
  ),
};

const ALIGN_LISTS_SAMPLE =
  "<h2>Meeting notes</h2>" +
  '<p data-align="center">A centred line under the heading.</p>' +
  "<ol><li><p>Agree on the agenda</p></li><li><p>Share the minutes</p></li></ol>";

function OpenToolbarMenu({ caret, button }: { caret: string; button: string }) {
  const ref = useRef<RichTextEditorHandle>(null);
  useOpenBlockMenu(ref, caret, button);
  return (
    <div className="h-[520px] max-w-[640px]">
      <RichTextEditor ref={ref} aria-label="Document" defaultValue={ALIGN_LISTS_SAMPLE} />
    </div>
  );
}

/**
 * Меню «Выравнивание ▾»: По левому краю, По центру, По правому
 * краю с сочетаниями. Каретка в строке по центру — отмечен «Align center», его
 * иконка стоит на кнопке, а имя кнопки — «Alignment: center». По ширине нет
 * (WCAG 1.4.8). Заодно видна компактная Панель одним рядом в колонке 640 px.
 */
export const AlignmentMenu: Story = {
  render: () => <OpenToolbarMenu caret="A centred line under the heading." button="Alignment" />,
};

/**
 * Меню «Списки ▾»: те же три вида списка, что в «¶». Каретка в
 * нумерованном списке — отмечен «Numbered list», иконка на кнопке — его, имя —
 * «List: numbered». Повторный выбор отмеченного снимает список.
 */
export const ListsMenu: Story = {
  render: () => <OpenToolbarMenu caret="Share the minutes" button="List" />,
};

/*
  Выделение и открытое меню «…» или поповер цвета, как только
  движок создан. `button` — точное имя кнопки или его начало. С `bubble` кнопка
  ищется в меню выделения («Цвет» живёт только там): фокус ставится в
  Документ, и кнопку ждут, пока плашка не встанет над выделением.
*/
function useOpenToolbarPopover(
  ref: RefObject<RichTextEditorHandle | null>,
  text: string,
  button: string,
  bubble = false
) {
  useEffect(() => {
    let frame = 0;
    let tries = 0;
    const later = (step: () => void) => {
      frame = requestAnimationFrame(step);
    };
    const press = () => {
      const scope = bubble
        ? document.querySelector('[role="toolbar"][aria-label="Selection formatting"]')
        : document;
      // Кнопка с таким именем у своего хозяина одна.
      const trigger = scope?.querySelector<HTMLElement>(`button[aria-label^="${button}"]`);
      if (!trigger) {
        if (tries++ < 120) later(press);
        return;
      }
      // Сначала фокус на кнопку, как у щелчка мышью: плашка прячется, когда
      // фокус уходит из Документа куда-то вне неё (в поповер), а с кнопки — нет.
      trigger.focus();
      trigger.click();
    };
    const tick = () => {
      const editor = ref.current?.editor;
      if (!editor) return later(tick);
      let from = -1;
      editor.state.doc.descendants((node, pos) => {
        if (from < 0 && node.isText && node.text === text) from = pos;
      });
      if (bubble) editor.view.focus();
      if (from >= 0) editor.commands.setTextSelection({ from, to: from + text.length });
      later(press);
    };
    later(tick);
    return () => cancelAnimationFrame(frame);
  }, [ref, text, button, bubble]);
}

const MORE_FORMATTING_SAMPLE =
  "<h2>Release notes</h2>" +
  "<p>Rare marks live in the <u>More formatting</u> menu: <code>inline code</code>, " +
  "x<sup>2</sup> and H<sub>2</sub>O.</p>" +
  '<p>Colours have their own buttons: <mark data-color="pink">a pink highlight</mark> and ' +
  '<span data-color="danger">red text</span>, picked from circles.</p>';

function OpenFormatPopover({
  selection,
  button = "More formatting",
  bubble = false,
}: {
  selection: string;
  button?: string;
  bubble?: boolean;
}) {
  const ref = useRef<RichTextEditorHandle>(null);
  useOpenToolbarPopover(ref, selection, button, bubble);
  return (
    <div className="h-[520px] max-w-[640px]">
      <RichTextEditor ref={ref} aria-label="Document" defaultValue={MORE_FORMATTING_SAMPLE} />
    </div>
  );
}

/**
 * Меню «…» — More formatting: Строчный код, Подчёркивание, Верхний
 * и Нижний индекс с сочетаниями, Блок кода, «Очистить стили» (`Ctrl/⌘+\`).
 * Выделено подчёркнутое слово — отмечено «Underline». Рядом с Блоком кода —
 * флажок «Цитата». Цветов здесь нет — у них свои кнопки.
 */
export const MoreFormattingMenu: Story = {
  render: () => <OpenFormatPopover selection="More formatting" />,
};

/**
 * Поповер «Цвет» — в меню выделения: сетки «Цвет
 * текста» (по умолчанию и шесть тонов) и «Цвет маркера» (без маркера и девять
 * цветов), у заголовка каждой — «Свой цвет…». Выделен красный текст — отмечен
 * «Red» в сетке текста.
 */
export const ColorPopover: Story = {
  render: () => <OpenFormatPopover selection="red text" button="Color" bubble />,
  // Плашка встаёт над выделением с задержкой, поповер — за ней: метка велит
  // снимку и axe дождаться тишины, иначе они застают поле без плашки.
  tags: ["network-idle"],
};

/**
 * Поповер «Маркер»: девять маркеров по оттенку и «Убрать маркер».
 * Выделен розовый маркер — отмечен «Pink», имя кнопки — «Highlight: Pink».
 */
export const HighlightPopover: Story = {
  render: () => <OpenFormatPopover selection="a pink highlight" button="Highlight:" />,
};

/** Пустой документ — плейсхолдер из каталога. */
export const Empty: Story = {
  args: { defaultValue: undefined },
};

/**
 * Управляемый режим: HTML уходит наружу не чаще раза в `changeDelay` мс и
 * сразу на `blur`. Курсор не сбивается, когда владелец возвращает тот же HTML.
 */
export const Controlled: Story = {
  render: (args) => {
    const [html, setHtml] = useState("<p>Type here and watch the value below.</p>");
    return (
      <div className="flex max-w-[640px] flex-col gap-3">
        <RichTextEditor {...args} defaultValue={undefined} value={html} onChange={setHtml} />
        <code className="text-fg-2 text-caption break-all">{html}</code>
      </div>
    );
  },
};

const MARKDOWN_SAMPLE = [
  "## Meeting notes",
  "",
  "Agreed on the **next steps** and a *short* timeline.",
  "",
  "- Prepare the draft",
  "- Review it together",
  "",
  "1. Publish on Friday",
  "2. Collect feedback",
  "",
  "> Keep it simple.",
].join("\n");

/**
 * Markdown. Вставьте в поле текст с разметкой (`## Заголовок`, `- пункт`,
 * `**жирный**`) — он станет Блоками и Метками; обычный текст останется
 * абзацами. Кнопки зовут `ref.setMarkdown()` и `ref.getMarkdown()`; в
 * выгрузку не попадают цвет, выравнивание и подчёркивание.
 */
export const PasteMarkdown: Story = {
  args: { defaultValue: undefined },
  render: (args) => {
    const ref = useRef<RichTextEditorHandle>(null);
    const [markdown, setMarkdown] = useState("");
    return (
      <div className="flex max-w-[640px] flex-col gap-3">
        <RichTextEditor {...args} ref={ref} />
        <div className="flex gap-2">
          <Button onClick={() => ref.current?.setMarkdown(MARKDOWN_SAMPLE)}>Load Markdown</Button>
          <Button variant="outline" onClick={() => setMarkdown(ref.current?.getMarkdown() ?? "")}>
            Export Markdown
          </Button>
        </div>
        <pre className="text-fg-2 text-caption break-all whitespace-pre-wrap">{markdown}</pre>
      </div>
    );
  },
};

/**
 * JSON-конверт. «Download JSON» сохраняет Документ файлом через
 * `ref.getJSON()` — без потерь, в отличие от Markdown: цвет, выравнивание и
 * подчёркивание остаются. «Open JSON» читает файл и отдаёт его `ref.setJSON()`;
 * чужой файл отвергается, и экран сам говорит об этом. Кнопки и выбор файла —
 * код экрана, а не Редактора.
 */
export const JsonExportImport: Story = {
  render: (args) => {
    const ref = useRef<RichTextEditorHandle>(null);
    const fileRef = useRef<HTMLInputElement>(null);
    const [status, setStatus] = useState("");
    const download = () => {
      const document = ref.current?.getJSON();
      if (!document) return;
      const blob = new Blob([JSON.stringify(document, null, 2)], { type: "application/json" });
      const link = Object.assign(window.document.createElement("a"), {
        href: URL.createObjectURL(blob),
        download: "document.json",
      });
      link.click();
      // Браузер забирает файл после щелчка, а не в нём: адрес живёт до следующей задачи.
      setTimeout(() => URL.revokeObjectURL(link.href));
      setStatus("Saved document.json");
    };
    const open = async (file: File | undefined) => {
      if (!file) return;
      let parsed: unknown = null;
      try {
        parsed = JSON.parse(await file.text());
      } catch {
        // Не JSON вовсе — `setJSON(null)` отвергнет так же, как чужой формат.
      }
      const accepted = ref.current?.setJSON(parsed) ?? false;
      setStatus(accepted ? `Opened ${file.name}` : `${file.name} is not a rich text document`);
    };
    return (
      <div className="flex max-w-[640px] flex-col gap-3">
        <RichTextEditor {...args} ref={ref} />
        <div className="flex items-center gap-2">
          <Button onClick={download}>Download JSON</Button>
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            Open JSON
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(event) => {
              void open(event.currentTarget.files?.[0]);
              event.currentTarget.value = "";
            }}
          />
          <span role="status" className="text-fg-2 text-caption">
            {status}
          </span>
        </div>
      </div>
    );
  },
};

/** Счётчик остатка появляется у 80 % предела; сверх предела ввод не идёт. */
export const WithMaxLength: Story = {
  args: {
    defaultValue: "<p>A short note that is already close to its limit.</p>",
    maxLength: 60,
  },
};

/** Число слов в HTML документа: теги не считаются, пустой документ — ноль. */
function countWords(html: string): number {
  const text = html.replace(/<[^>]*>/g, " ").trim();
  return text ? text.split(/\s+/).length : 0;
}

/**
 * Высота поля (ADR-0059): `maxHeight` ограничивает область
 * Документа, и длинный Документ прокручивается внутри рамки; Панель над ним и
 * Строка статуса под ним остаются на месте. Ручка Блока и плашка выделения
 * едут вместе с текстом.
 */
export const ScrollingDocument: Story = {
  render: (args) => (
    <div className="max-w-[640px]">
      <RichTextEditor
        {...args}
        defaultValue={SAMPLE + CODE_BLOCKS}
        maxHeight={320}
        status={<span>{countWords(SAMPLE + CODE_BLOCKS)} words</span>}
      />
    </div>
  ),
};

/**
 * `resizable`: ручка высоты — полоса по нижнему краю области Документа, с хватом по центру. `maxHeight` с ним —
 * стартовая высота, а не предел: поле тянется и выше, и ниже, но не уже
 * нескольких строк.
 */
export const ResizableDocument: Story = {
  render: (args) => (
    <div className="max-w-[640px]">
      <RichTextEditor {...args} defaultValue={SAMPLE + CODE_BLOCKS} maxHeight={320} resizable />
    </div>
  ),
};

/**
 * Строка статуса (ADR-0058, раздел 7): «Сохранено» и число слов
 * стоят внутри рамки поля у начала строки счётчика, счётчик `maxLength` — в
 * конце. Кит её не озвучивает: число слов не зачитывается на каждую правку, а
 * «Сохранено» обёрнуто в `role="status"` — рецепт озвучки на стороне экрана.
 * «Сохранение» идёт по таймеру после правки, как автосохранение.
 */
export const StatusLine: Story = {
  render: (args) => {
    const [html, setHtml] = useState("<p>Type here: the line below counts words and saves.</p>");
    const [saved, setSaved] = useState(true);
    const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    useEffect(() => () => clearTimeout(timer.current), []);
    return (
      <div className="max-w-[640px]">
        <RichTextEditor
          {...args}
          defaultValue={undefined}
          value={html}
          maxLength={60}
          onChange={(next) => {
            setHtml(next);
            setSaved(false);
            clearTimeout(timer.current);
            timer.current = setTimeout(() => setSaved(true), 800);
          }}
          status={
            <span className="flex gap-3">
              <span role="status">{saved ? "Saved" : ""}</span>
              <span>{countWords(html)} words</span>
            </span>
          }
        />
      </div>
    );
  },
};

/** Строка статуса видна и при `readOnly`: она часть рамки поля, а не правки. */
export const StatusLineReadOnly: Story = {
  args: {
    readOnly: true,
    defaultValue: "<p>Three words here.</p>",
    status: <span>3 words</span>,
  },
};

/**
 * Сообщение поля: команда движка `showNotice` с тоном и текстом. «Status»
 * только озвучивается (живой регион, глазу ничего не видно), «error» — строка
 * `role="alert"` под полем до следующей правки, нового сообщения или снятия.
 * Тем же каналом идут сообщения о файлах (истории `ImageUpload…`).
 */
export const FieldNotice: Story = {
  render: (args) => {
    const ref = useRef<RichTextEditorHandle>(null);
    const show = (notice: { tone: "status" | "error"; text: string } | null) =>
      ref.current?.editor?.commands.showNotice(notice);
    return (
      <div className="flex max-w-[640px] flex-col gap-3">
        <RichTextEditor
          {...args}
          ref={ref}
          defaultValue="<p>Edit this text to dismiss an error.</p>"
        />
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => show({ tone: "status", text: "Draft restored" })}
          >
            Announce status
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => show({ tone: "error", text: "Could not insert the card. Try again." })}
          >
            Show error
          </Button>
          <Button size="sm" variant="ghost" onClick={() => show(null)}>
            Clear
          </Button>
        </div>
      </div>
    );
  },
};

/** Подпись, подсказка и ошибка `FormField`; имя полю даёт подпись через `id`. */
export const InFormField: Story = {
  render: () => {
    const [submitted, setSubmitted] = useState<string | null>(null);
    return (
      <form
        className="flex max-w-[640px] flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          setSubmitted(String(new FormData(event.currentTarget).get("description")));
        }}
      >
        <FormField
          label="Description"
          htmlFor="story-description"
          hint="Shown on the overview page"
          required
        >
          <RichTextEditor id="story-description" name="description" required />
        </FormField>
        <FormField label="Summary" htmlFor="story-summary" error="The summary is too short">
          <RichTextEditor id="story-summary" defaultValue="<p>Too short</p>" />
        </FormField>
        <div>
          <Button type="submit">Submit</Button>
        </div>
        {submitted != null && <code className="text-fg-2 text-caption break-all">{submitted}</code>}
      </form>
    );
  },
};

/** Только чтение: текст выделяется и уходит в форму, но не правится. */
export const ReadOnly: Story = {
  args: { readOnly: true },
};

/**
 * Светлый лист в любой теме (`surface="paper"`): документ —
 * текст, ссылка, палитры, таблица, чек-лист, блок кода (GitHub Light) — как в
 * светлой теме, а Панель, меню, поповеры и рамка фокуса поля — в теме
 * приложения. Тема переключается тулбаром витрины; axe мерит историю в
 * `dark`, `light`, `dim` и с брендом.
 */
export const PaperSurface: Story = {
  args: {
    surface: "paper",
    defaultValue:
      SAMPLE.replace(
        "<p>Text after the divider.</p>",
        '<p>Read the <a href="https://example.com/guide">style guide</a> before you print.</p>'
      ) +
      COLOURS +
      TABLE_SAMPLE,
  },
  /*
    Колонка шире общей на поле ручки Блока: у листа своё поле
    справа, и в 640 px шесть столбцов таблицы по 6 rem уже не помещались —
    таблица прокручивалась внутри себя, а axe считает такую область
    недоступной с клавиатуры (каретку в ячейках он не видит, `prose.ts`).
  */
  render: (args) => (
    <div className="max-w-[680px]">
      <RichTextEditor {...args} />
    </div>
  ),
};

/** Выключено, как у прочих полей. */
export const Disabled: Story = {
  args: { disabled: true },
};

/**
 * Блоки кода (ADR-0051): восемь языков (в образце — все, Markdown последним) и обычный текст. В шапке блока
 * слева кнопка языка, справа «Копировать» — текст блока уходит в буфер без
 * токенов подсветки. С клавиатуры — `Alt+F10` из блока на язык, ещё раз — на
 * «Копировать», ещё раз — в Панель; стрелки ходят по шапке, `Escape` обратно в код.
 * Подсветка — декорации: в `onChange` уходит только `class="language-…"`.
 * Тема — GitHub Light в `light`, GitHub Dark в `dark` и `dim`; снимается во
 * всех трёх, и axe мерит контраст токенов на фоне блока.
 */
export const CodeBlocks: Story = {
  args: { defaultValue: CODE_BLOCKS },
};

/**
 * Только чтение: вместо кнопки языка — подпись, менять нечего; «Копировать» остаётся.
 * У блока без языка подписи нет: «Обычный текст» — имя пункта меню, а не языка,
 * и серверный `RichTextView` такой блок тоже не подписывает.
 */
export const CodeBlocksReadOnly: Story = {
  args: { defaultValue: CODE_BLOCKS, readOnly: true },
};

/**
 * Шапка по-русски: «Язык: Python», «Обычный текст», подсказка «Копировать код»
 * — из каталога.
 */
export const CodeBlocksRussian: Story = {
  render: () => (
    <UiProvider locale="ru-RU" messages={ru}>
      <RichTextEditor defaultValue={CODE_BLOCKS} />
    </UiProvider>
  ),
};

/**
 * Русская локаль: имя поля, плейсхолдер, счётчик, Панель и подсказки — из
 * `@olddevs/ui/locales/ru`. Текст документа — данные и остаётся английским.
 */
export const RussianLocale: Story = {
  render: () => (
    <UiProvider locale="ru-RU" messages={ru}>
      <div className="flex max-w-[640px] flex-col gap-4">
        <RichTextEditor />
        <RichTextEditor
          preset="basic"
          maxLength={40}
          defaultValue="<p>Close to the limit of forty symbols.</p>"
        />
      </div>
    </UiProvider>
  ),
};

/**
 * Набрать команду в последний (пустой) абзац, как только движок создан: меню
 * по `/` открывается набором, а не пропом, и история показывает его открытым.
 */
function useTypedCommand(ref: RefObject<RichTextEditorHandle | null>, command: string) {
  useEffect(() => {
    // Пустая команда — поле остаётся нетронутым: его набирают тесты руками.
    if (command === "") return;
    let frame = 0;
    const tick = () => {
      const editor = ref.current?.editor;
      if (!editor) {
        frame = requestAnimationFrame(tick);
        return;
      }
      editor.chain().focus("end").insertContent(command).run();
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [ref, command]);
}

const INSERT_SAMPLE = "<h2>Meeting notes</h2><p>Start a new line with a slash.</p><p></p>";

function TypedCommand({ command }: { command: string }) {
  const ref = useRef<RichTextEditorHandle>(null);
  useTypedCommand(ref, command);
  return (
    <div className="h-[520px] max-w-[640px]">
      <RichTextEditor ref={ref} aria-label="Document" defaultValue={INSERT_SAMPLE} />
    </div>
  );
}

/**
 * Меню вставки по `/`: у курсора, фокус остаётся в поле. Стрелки ходят по
 * пунктам, Enter применяет, Escape закрывает, оставив набранное. Разделы —
 * «Insert» (новый Блок после текущего) и «Turn into» (сменить тип текущего).
 */
export const InsertMenuSlash: Story = {
  render: () => <TypedCommand command="/" />,
};

/** Набранное после `/` фильтрует пункты: по подписи и коротким именам (`h2`, `hr`). */
export const InsertMenuFiltered: Story = {
  render: () => <TypedCommand command="/head" />,
};

/**
 * Те же пункты — кнопкой «+», первой на Панели: меню кита с фокусом на
 * пунктах. Пункт применяется к Блоку под курсором.
 */
export const InsertMenuPlus: Story = {
  args: {
    defaultValue: "<p>Put the caret here and press the plus button on the toolbar.</p>",
  },
};

/** Меню вставки в русской локали: подписи, разделы и «ничего не найдено» — из каталога. */
export const InsertMenuRussian: Story = {
  render: () => (
    <UiProvider locale="ru-RU" messages={ru}>
      <TypedCommand command="/" />
    </UiProvider>
  ),
};

/**
 * Поставить каретку в ячейку, как только движок создан: пункты меню «Таблица»,
 * кроме вставки, доступны только пока каретка в таблице, и история должна
 * показывать их доступными.
 */
function useCaretInCell(ref: RefObject<RichTextEditorHandle | null>, text: string) {
  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const editor = ref.current?.editor;
      if (!editor) {
        frame = requestAnimationFrame(tick);
        return;
      }
      let end = -1;
      editor.state.doc.descendants((node, pos) => {
        if (end < 0 && node.isText && node.text === text) end = pos + node.nodeSize;
      });
      if (end > 0) editor.chain().focus().setTextSelection(end).run();
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [ref, text]);
}

function TableInCell({
  locale,
  document = TABLE_SAMPLE,
  caret = "Billing",
}: {
  locale?: "ru-RU";
  document?: string;
  caret?: string;
}) {
  const ref = useRef<RichTextEditorHandle>(null);
  useCaretInCell(ref, caret);
  const field = (
    <div className="max-w-[640px]">
      <RichTextEditor ref={ref} aria-label="Document" defaultValue={document} />
    </div>
  );
  return locale ? (
    <UiProvider locale={locale} messages={ru}>
      {field}
    </UiProvider>
  ) : (
    field
  );
}

/**
 * Меню «Таблица ▾» на Панели, как у TinyMCE: «Таблица ›» — сетка размера,
 * «Вставить таблицу…» — окно с числами до 20 × 50, затем подменю «Ячейка»,
 * «Строка», «Столбец», «Сортировка» и «Удалить таблицу». Каретка в ячейке
 * «Billing», поэтому доступно всё. С клавиатуры: `Alt+F10` → кнопка → `Enter`,
 * `→` открывает подменю, `←` и `Escape` закрывают. `Tab` в документе — по
 * ячейкам, в последней добавляет строку.
 */
export const TableMenu: Story = {
  render: () => <TableInCell />,
};

/**
 * Слитые ячейки: `colspan` и `rowspan` пишутся в HTML и переживают сохранение.
 * «Ячейка › Разделить» на слитой ячейке возвращает сетку; «Объединить» —
 * после выделения нескольких ячеек. Сортировка в такой таблице недоступна, и
 * подменю говорит почему.
 */
export const TableMerged: Story = {
  render: () => <TableInCell document={MERGED_SAMPLE} caret="Billing" />,
};

/**
 * Сортировка и выравнивание столбца: «Сортировка ›» сравнивает числа как
 * числа (разряды и дробь по локали), даты ISO и `ДД.ММ.ГГГГ` как даты, текст —
 * по алфавиту локали. «Столбец › Выравнивание» пишет `data-align` на каждую
 * ячейку столбца; в Markdown это `:---:` и `---:`.
 */
export const TableSortAndAlign: Story = {
  render: () => <TableInCell document={SORT_SAMPLE} caret="Contoso" />,
};

/** Меню вставки по `/table`: новая таблица 3×3 со строкой-заголовком встаёт после текущего Блока. */
export const TableInsertSlash: Story = {
  render: () => <TypedCommand command="/table" />,
};

/**
 * Меню таблицы в русской локали: «Таблица», «Вставить таблицу…», подменю и
 * пункты — из каталога, размер в сетке — со склонением, сортировка текста —
 * по русскому алфавиту.
 */
export const TableRussian: Story = {
  render: () => <TableInCell locale="ru-RU" document={SORT_SAMPLE} caret="Contoso" />,
};

/**
 * Узкий экран (375 px): таблица из шести столбцов не помещается и прокручивается
 * по горизонтали внутри себя (`display: block; overflow-x: auto`), страницу не
 * раздвигает. Минимальная ширина столбца — 6 rem.
 */
export const TableNarrow: Story = {
  tags: ["viewport-phone"],
  render: () => <TableInCell />,
};

/**
 * Адрес картинки историй: файл витрины (`.storybook/static`). Абсолютный —
 * Документ принимает только `http(s)`, — и от адреса самой витрины: она
 * публикуется и в корне, и в подкаталоге (как на GitHub Pages).
 */
function sampleImage(): string {
  return new URL("editor-sample-landscape.svg", document.baseURI).href;
}

/** Картинки трёх ширин, с подписью и без — так их пишет Редактор. */
function imagesDocument(): string {
  const src = sampleImage();
  return (
    "<h2>Images</h2><p>A figure keeps its caption under the picture.</p>" +
    `<figure><img src="${src}" alt="Mountains under a clear sky" data-width="75">` +
    "<figcaption>Caption under a picture at 75% of the width</figcaption></figure>" +
    `<figure><img src="${src}" alt="" data-width="50"></figure>` +
    "<p>The image above is decorative and has no caption. The next one is full width.</p>" +
    `<figure><img src="${src}" alt="Mountains, full width" data-width="100">` +
    "<figcaption>Full width</figcaption></figure>"
  );
}

/** Хост-заглушка сетки: показывает, что именно выбрано, — для глаз и для браузерных тестов. */
function TableSizeGridDemo({ fields, locale }: { fields?: boolean; locale?: "ru-RU" }) {
  const [picked, setPicked] = useState("nothing picked yet");
  const grid = (
    <div className="flex w-56 flex-col gap-3">
      <SizeGrid
        fields={fields ? { maxCols: 20, maxRows: 50 } : undefined}
        onPick={(cols, rows) => setPicked(`picked ${cols} x ${rows}`)}
        onCancel={() => setPicked("cancelled")}
      />
      <p data-testid="picked" className="text-fg-2 text-caption">
        {picked}
      </p>
    </div>
  );
  return locale ? (
    <UiProvider locale={locale} messages={ru}>
      {grid}
    </UiProvider>
  ) : (
    grid
  );
}

/**
 * Картинки: `<figure>` с `<img>` и необязательной подписью.
 * Щелчок по картинке выделяет её: над ней — панель с пресетами ширины 50, 75
 * и 100 %, «Изменить» и «Убрать», по бокам — ручки ширины для мыши. Enter на
 * выделенной картинке — в подпись. Кнопка «Image» на Панели вставляет картинку
 * по адресу.
 */
export const Images: Story = {
  render: (args) => (
    <div className="max-w-[640px]">
      <RichTextEditor {...args} defaultValue={imagesDocument()} />
    </div>
  ),
};

/** Вставка по адресу: поповер открыт кнопкой «Image» Панели над пустым абзацем. */
export const ImageByAddress: Story = {
  render: function Render(args) {
    const ref = useRef<RichTextEditorHandle>(null);
    useEffect(() => {
      let frame = 0;
      const tick = () => {
        const editor = ref.current?.editor;
        if (!editor) {
          frame = requestAnimationFrame(tick);
          return;
        }
        editor.chain().focus("end").openImageEditor().run();
      };
      frame = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(frame);
    }, []);
    return (
      <div className="h-[520px] max-w-[640px]">
        <RichTextEditor
          {...args}
          ref={ref}
          defaultValue="<p>Paste an image address, for example the one of this showcase.</p><p></p>"
        />
      </div>
    );
  },
};

/** Ненастоящий загрузчик: «грузит» полторы секунды и отдаёт адрес или отказ. */
function fakeUploader(outcome: "success" | "failure") {
  return (file: File) =>
    new Promise<string>((resolve, reject) => {
      window.setTimeout(() => {
        if (outcome === "success") resolve(sampleImage());
        else reject(new Error(`The server refused ${file.name}`));
      }, 1500);
    });
}

/**
 * Загрузка файла: перетащите картинку в поле, вставьте снимок экрана из
 * буфера или выберите файл в поповере («Upload from device»). Полторы секунды
 * на месте картинки плейсхолдер, затем она встаёт на его место — одна отмена
 * её убирает. Загрузчик ненастоящий и всегда отдаёт картинку витрины.
 */
export const ImageUploadSuccess: Story = {
  args: {
    onUploadImage: fakeUploader("success"),
    defaultValue: "<p>Drop or paste an image file here.</p><p></p>",
  },
};

/**
 * Отказ загрузки: плейсхолдер исчезает, Документ не меняется, под полем —
 * сообщение. Без `onUploadImage` (история `Images`) файл из буфера не
 * принимается вовсе — с подсказкой вставить картинку по адресу.
 */
export const ImageUploadFailure: Story = {
  args: {
    onUploadImage: fakeUploader("failure"),
    defaultValue: "<p>Drop or paste an image file here: the upload always fails.</p><p></p>",
  },
};

/** Картинки в русской локали: поповер, панель картинки, подсказка подписи и сообщения о файлах. */
export const ImagesRussian: Story = {
  render: () => (
    <UiProvider locale="ru-RU" messages={ru}>
      <div className="max-w-[640px]">
        <RichTextEditor
          aria-label="Document"
          defaultValue={imagesDocument()}
          onUploadImage={fakeUploader("success")}
        />
      </div>
    </UiProvider>
  ),
};

/**
 * Сетка выбора размера таблицы сама по себе: пять на пять, растёт до десяти на
 * десять вслед за выбором. Стрелки двигают выбор, `Enter` выбирает, `Escape`
 * отменяет; первая строка закрашена как заголовок. На Панели она живёт в
 * подменю «Таблица ›» меню «Таблица» (история `TableMenu`).
 */
export const TableSizeGrid: Story = {
  render: () => <TableSizeGridDemo />,
};

/** Та же сетка с числовыми полями «Столбцы» и «Строки» (до 20 × 50) и кнопкой «Вставить». */
export const TableSizeGridFields: Story = {
  render: () => <TableSizeGridDemo fields />,
};

/** Русская локаль: имя сетки и размер словами со склонением — «3 столбца, 4 строки». */
export const TableSizeGridRussian: Story = {
  render: () => <TableSizeGridDemo fields locale="ru-RU" />,
};

/**
 * Открыть сетку эмодзи кнопкой Панели, как только движок и Панель появились:
 * история показывает поповер открытым — для глаз, снимков и axe.
 */
function useOpenEmoji(ref: RefObject<HTMLDivElement | null>, name: string) {
  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const button = ref.current?.querySelector<HTMLButtonElement>(`button[aria-label="${name}"]`);
      if (!button) {
        frame = requestAnimationFrame(tick);
        return;
      }
      button.click();
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [ref, name]);
}

function EmojiOpen({ locale }: { locale?: "ru-RU" }) {
  const host = useRef<HTMLDivElement>(null);
  useOpenEmoji(host, locale ? ru.editor.emoji : "Emoji");
  const field = (
    <div ref={host} className="h-[480px] max-w-[640px]">
      <RichTextEditor
        aria-label="Document"
        defaultValue="<p>Pick an emoji from the grid: it lands in the text as it is.</p>"
      />
    </div>
  );
  return locale ? (
    <UiProvider locale={locale} messages={ru}>
      {field}
    </UiProvider>
  ) : (
    field
  );
}

/**
 * Кнопка «Emoji» — последняя в ряду Панели, после таблицы и картинки. Она
 * открывает поповер с курированным набором: «Избранное» (20) и шесть категорий
 * по десять эмодзи. Щелчок или `Enter` вставляет эмодзи обычным текстом: в
 * конец выделения, не стирая его, с кареткой за эмодзи и одной правкой на
 * отмену. Стрелки, `Home` и `End` ходят по сетке, `Escape` закрывает поповер и
 * возвращает фокус в Документ. Поповер открыт при показе истории.
 */
export const EmojiGrid: Story = {
  render: () => <EmojiOpen />,
};

/** Русская локаль: названия категорий и имена эмодзи (их читает скринридер) — из каталога. */
export const EmojiGridRussian: Story = {
  render: () => <EmojiOpen locale="ru-RU" />,
};

/** Без `emoji` в `tools` кнопки нет, как и в пресете `basic`. */
export const EmojiDisabled: Story = {
  args: { tools: ["history", "bold", "italic", "link", "table", "image"] },
};

/**
 * Нажать кнопку справочника сочетаний, как только Панель нарисована: поповер
 * открывается щелчком, а не пропом, и история показывает его открытым.
 */
function useOpenedShortcuts(rootRef: RefObject<HTMLDivElement | null>, name: string) {
  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const button = rootRef.current?.querySelector<HTMLButtonElement>(
        `button[aria-label="${name}"]`
      );
      if (!button) {
        frame = requestAnimationFrame(tick);
        return;
      }
      button.click();
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [rootRef, name]);
}

function OpenedShortcuts({ name, preset }: { name: string; preset?: "basic" }) {
  const rootRef = useRef<HTMLDivElement>(null);
  useOpenedShortcuts(rootRef, name);
  return (
    <div ref={rootRef} className="h-[620px] max-w-[640px]">
      <RichTextEditor aria-label="Document" preset={preset} defaultValue="<p>Notes</p>" />
    </div>
  );
}

/**
 * Справочник сочетаний: кнопка с клавиатурой — последняя на Панели,
 * у правого края. Поповер — таблица «Command — Shortcut» только для чтения;
 * строки — из той же таблицы, из которой Панель берёт подсказки. Escape и
 * щелчок снаружи закрывают его и возвращают фокус на кнопку.
 */
export const ShortcutsReference: Story = {
  render: () => <OpenedShortcuts name="Keyboard shortcuts" />,
};

/** Пресет `basic`: в справочнике только команды его инструментов и общие для всех. */
export const ShortcutsReferenceBasic: Story = {
  render: () => <OpenedShortcuts name="Keyboard shortcuts" preset="basic" />,
};

/** Русская локаль: заголовки столбцов и названия команд — из каталога. */
export const ShortcutsReferenceRussian: Story = {
  render: () => (
    <UiProvider locale="ru-RU" messages={ru}>
      <OpenedShortcuts name={ru.editor.shortcuts} />
    </UiProvider>
  ),
};

/*
  Раскладка: все шесть вариантов на нейтральном тексте. Колонки —
  разной высоты, чтобы было видно, что сетка не выравнивает их содержимое, а
  пунктир каждой колонки тянется на высоту ряда.
*/
const layoutColumn = (title: string, text: string) =>
  `<div data-block="column"><h4>${title}</h4><p>${text}</p></div>`;
const layoutBlock = (variant: string, ...columns: string[]) =>
  `<div data-block="layout" data-layout="${variant}">${columns.join("")}</div>`;

const LAYOUTS_SAMPLE =
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

/** Раскладка шире обычной истории: у четырёх колонок своя ширина нужна от 48 rem. */
function WideField(props: Partial<RichTextEditorProps>) {
  return (
    <div className="max-w-[960px]">
      <RichTextEditor aria-label="Document" defaultValue={LAYOUTS_SAMPLE} {...props} />
    </div>
  );
}

/**
 * Раскладка: шесть вариантов — одна, две, три, четыре колонки,
 * 60/40 и 40/60. Колонка — отдельная область с пунктирной рамкой (только в
 * Редакторе), в ней любые Блоки, кроме другой Раскладки. Tab и Shift+Tab — по
 * колонкам, `←`/`→` у края текста — в соседнюю колонку, `↑`/`↓` у верхней и
 * нижней строки — из Раскладки. В HTML — `div[data-block]` и вариант в
 * `data-layout`, без `style`.
 */
export const Layouts: Story = {
  render: () => <WideField />,
};

/** Те же Раскладки на листе `surface="paper"`. */
export const LayoutsPaper: Story = {
  render: () => <WideField surface="paper" />,
};

/** Поставить Раскладку, как только движок создан: пункт Меню вставки «Раскладка». */
function useInsertedLayout(ref: RefObject<RichTextEditorHandle | null>) {
  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const editor = ref.current?.editor;
      if (!editor) {
        frame = requestAnimationFrame(tick);
        return;
      }
      editor.chain().focus("end").insertLayout().run();
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [ref]);
}

function InsertedLayout() {
  const ref = useRef<RichTextEditorHandle>(null);
  useInsertedLayout(ref);
  return (
    <div className="max-w-[640px]">
      <RichTextEditor
        ref={ref}
        aria-label="Document"
        defaultValue="<p>A new layout goes below the current block.</p>"
      />
    </div>
  );
}

/**
 * Только что вставленная Раскладка — две пустые колонки с пунктирной рамкой,
 * каретка в первой (образец владельца). Так её ставит пункт «Раскладка» Меню
 * вставки (`/layout` или «+»).
 */
export const LayoutInserted: Story = {
  render: () => <InsertedLayout />,
};

/** Меню вставки по `/layout`: пункт «Раскладка» с двумя колонками по умолчанию. */
export const LayoutInsertSlash: Story = {
  render: () => <TypedCommand command="/layout" />,
};

/**
 * Узкий экран (375 px): колонки встают столбцом в порядке чтения — левая
 * сверху. Порог — по ширине самого Документа (контейнерный запрос), а не окна.
 */
export const LayoutNarrow: Story = {
  tags: ["viewport-phone"],
  render: () => <WideField />,
};

/**
 * Раскладка в окне: две колонки помещаются в Dialog шириной 560 px
 * и стоят рядом; Tab в Документе ходит по колонкам и не закрывает окно, из
 * последней колонки уходит дальше по окну.
 */
export const LayoutInDialog: Story = {
  render: function Render() {
    const [open, setOpen] = useState(true);
    return (
      <div className="h-[520px]">
        <Button onClick={() => setOpen(true)}>Open the window</Button>
        <Dialog open={open} onClose={() => setOpen(false)} title="Edit the note">
          <div className="w-[560px] max-w-full">
            <RichTextEditor
              aria-label="Document"
              defaultValue={
                "<p>Press Tab to move between the columns.</p>" +
                layoutBlock(
                  "50-50",
                  layoutColumn("Left", "First column."),
                  layoutColumn("Right", "Second column.")
                )
              }
            />
          </div>
        </Dialog>
      </div>
    );
  },
};

const LAYOUT_HANDLE_SAMPLE =
  "<p>The handle of a block in a column stands at the left edge of its column.</p>" +
  layoutBlock(
    "50-50",
    layoutColumn("Left", "First column."),
    layoutColumn("Right", "The caret is in this column.")
  );

/**
 * Ручка Блока в колонке: у левого края своей колонки, на уровне
 * первой строки Блока — у правой колонки она стоит в промежутке между
 * колонками. Блок здесь — ребёнок колонки: «Вверх», «Вниз» и «Добавить ниже»
 * не выходят из неё.
 */
export const LayoutBlockHandle: Story = {
  render: () => (
    <ShownHandle caret="The caret is in this column." document={LAYOUT_HANDLE_SAMPLE} />
  ),
};

/**
 * Меню ручки Блока в колонке: «Формат ›» — тип самого Блока, а «Раскладка ›» —
 * вариант её Раскладки (шесть, с отметкой текущего). В «Добавить ›» Раскладка —
 * подменю тех же шести вариантов; новая встаёт под всей Раскладкой — вложенных
 * нет. У Раскладки, выделенной целиком, «Формат ›» — эти шесть вариантов.
 */
export const LayoutBlockHandleMenu: Story = {
  render: () => (
    <ShownHandle caret="The caret is in this column." document={LAYOUT_HANDLE_SAMPLE} open />
  ),
};

/*
  Обёртка: группа Блоков без своего вида, как Wrapper у Redactor.
  Нейтральный текст: заметка о выпуске, Обёртка на верхнем уровне и в колонке
  Раскладки.
*/
const wrapperBlock = (...blocks: string[]) => `<div data-block="wrapper">${blocks.join("")}</div>`;

const WRAPPERS_SAMPLE =
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
 * Обёртка: серый пунктир и внутренний отступ — только в Редакторе,
 * тем же видом, что колонки Раскладки. Внутри — любые Блоки, кроме другой
 * Обёртки и Раскладки; Обёртка стоит в Документе и в колонке. В HTML —
 * `div[data-block="wrapper"]` без других атрибутов.
 */
export const Wrappers: Story = {
  render: () => (
    <div className="max-w-[960px]">
      <RichTextEditor aria-label="Document" defaultValue={WRAPPERS_SAMPLE} />
    </div>
  ),
};

function InsertedWrapper() {
  const ref = useRef<RichTextEditorHandle>(null);
  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const editor = ref.current?.editor;
      if (!editor) {
        frame = requestAnimationFrame(tick);
        return;
      }
      editor.chain().focus("end").insertWrapper().run();
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <div className="max-w-[640px]">
      <RichTextEditor
        ref={ref}
        aria-label="Document"
        defaultValue="<p>A new wrapper goes below the current block.</p>"
      />
    </div>
  );
}

/**
 * Только что вставленная Обёртка — пустой абзац в пунктирной рамке, каретка
 * внутри. Так её ставят пункт «Обёртка» Меню вставки (`/wrapper` или «+») и
 * «Добавить › Обёртка» у ручки Блока.
 */
export const WrapperInserted: Story = {
  render: () => <InsertedWrapper />,
};

/** Меню вставки по `/wrapper`: пункт «Обёртка». */
export const WrapperInsertSlash: Story = {
  render: () => <TypedCommand command="/wrapper" />,
};

/**
 * Меню ручки Блока в Обёртке: ручка — у левого края Обёртки, действия не
 * выходят из неё, «Тон ›» меняет вид Обёртки, а «Снять обёртку»
 * оставляет Блоки на её месте одной правкой.
 */
export const WrapperBlockHandleMenu: Story = {
  render: () => (
    <ShownHandle
      caret="The caret is in this wrapper."
      document={
        "<p>The handle of a block in a wrapper stands at the left edge of the wrapper.</p>" +
        wrapperBlock("<p>First block of the wrapper.</p>", "<p>The caret is in this wrapper.</p>")
      }
      open
    />
  ),
};

/*
  Тон Обёртки: пять тонов и Обёртка без тона в одном Документе.
  Смысл заметки назван словом в её тексте — тон его только подкрепляет.
*/
const tonedBlock = (tone: string, ...blocks: string[]) =>
  `<div data-block="wrapper" data-tone="${tone}">${blocks.join("")}</div>`;

const WRAPPER_TONES_SAMPLE =
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
  wrapperBlock("<p>A wrapper without a tone keeps only the dashed frame in the editor.</p>") +
  "<p>Text after the wrappers.</p>";

/**
 * Тоны Обёртки: Заметка, Совет, Важно, Внимание, Осторожно и
 * Обёртка без тона. Тон — мягкая подложка и полоса 3 px слева из статусных
 * токенов кита, тот же вид, что у читателя в `RichTextView`; пунктир Редактора
 * остаётся только у Обёртки без тона. В HTML — `data-tone` с именем тона.
 */
export const WrapperTones: Story = {
  render: () => (
    <div className="max-w-[640px]">
      <RichTextEditor aria-label="Document" defaultValue={WRAPPER_TONES_SAMPLE} />
    </div>
  ),
};

/** Тоны Обёртки на светлом листе `surface="paper"`: роли `--rte-tone-*` листа. */
export const WrapperTonesPaper: Story = {
  render: () => (
    <div className="max-w-[640px]">
      <RichTextEditor aria-label="Document" defaultValue={WRAPPER_TONES_SAMPLE} surface="paper" />
    </div>
  ),
};

/**
 * Подменю «Тон ›» у ручки Блока в Обёртке: «Без тона» и пять тонов словами, с
 * образцом подложки и полосы; текущий отмечен, а имя пункта несёт его —
 * «Tone: Warning». Выбор — одна правка, одна отмена.
 */
export const WrapperToneMenu: Story = {
  render: () => (
    <ShownHandle
      caret="Back up the database before the upgrade."
      document={WRAPPER_TONES_SAMPLE}
      open
      submenu="Tone"
    />
  ),
};

/** Открыть HTML-режим, как только Панель появилась: щелчок по кнопке «HTML». */
function OpenedSource(props: Partial<RichTextEditorProps>) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const button = root.current?.querySelector<HTMLButtonElement>('button[aria-label="HTML"]');
      if (!button) {
        frame = requestAnimationFrame(tick);
        return;
      }
      button.click();
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <div ref={root} className="max-w-[640px]">
      <RichTextEditor aria-label="Document" defaultValue={SAMPLE} {...props} />
    </div>
  );
}

/**
 * HTML-режим: кнопка «HTML» на Панели сразу за «+» заменяет
 * Документ полем с его исходным HTML — по Блоку на строку, вложенные Блоки с
 * отступом, содержимое Блока на строке тега. Поле — на поверхности и шрифте
 * Блока кода, не ниже Документа и растёт по содержимому. Остальные кнопки
 * Панели недоступны (`aria-disabled`), ручки Блока и меню выделения нет. Выход
 * той же кнопкой, `blur`, отправка формы и `getHTML()` применяют правку через
 * Схему, как входящий `value`.
 */
export const SourceMode: Story = {
  render: () => <OpenedSource />,
};

/** HTML-режим на листе `surface="paper"`: светлый лист, а поле — тёмное, цветом кита. */
export const SourceModePaper: Story = {
  render: () => <OpenedSource surface="paper" />,
};

const SEARCH_SAMPLE =
  "<h2>Release notes</h2>" +
  "<p>The search panel finds every <strong>match</strong> in the document: a match in a " +
  "heading, a match in a list, a ma<em>tch</em> across marks.</p>" +
  "<ul><li><p>Next match: Enter</p></li><li><p>Previous match: Shift+Enter</p></li></ul>";

/** Открыть поиск по первому «match», как только движок готов: оно и станет текущим. */
function OpenedSearch(props: Partial<RichTextEditorProps>) {
  const ref = useRef<RichTextEditorHandle>(null);
  return (
    <div className="max-w-[640px]">
      <RichTextEditor
        ref={ref}
        aria-label="Document"
        defaultValue={SEARCH_SAMPLE}
        onReady={() => {
          const handle = ref.current;
          const editor = handle?.editor;
          if (!handle || !editor) return;
          let from = -1;
          editor.state.doc.descendants((node, pos) => {
            if (from !== -1 || !node.isText) return from === -1;
            const index = node.text!.indexOf("match");
            if (index !== -1) from = pos + index;
            return false;
          });
          editor.commands.setTextSelection({ from, to: from + "match".length });
          handle.openSearch();
        }}
        {...props}
      />
    </div>
  );
}

/**
 * Поиск и замена: кнопка «Поиск» у правого края Панели и `Mod+F`
 * открывают панель под Панелью — счётчик, переходы, поля поиска и замены,
 * «Учитывать регистр», «Слово целиком», «Регулярное выражение», «Заменить» и
 * «Заменить все». Все совпадения подсвечены мягко, текущее — плотнее и с
 * рамкой; «ma*tch*» найдено через границу Метки.
 */
export const Search: Story = {
  render: () => <OpenedSearch />,
  // Панель поиска — ленивый чанк: снимок ждёт, пока он загрузится.
  tags: ["network-idle"],
};

/** Поиск в `basic`: кнопка «Поиск» есть и в коротком наборе. */
export const SearchBasic: Story = {
  render: () => <OpenedSearch preset="basic" />,
  tags: ["network-idle"],
};

/*
  Кнопки своего Инструмента на нейтральных данных: действие с
  сочетанием, Метка-переключатель с флагом Меню выделения и кнопка с поповером.
  Подпись — функция от локали, поэтому русская история переводится сама.
*/
/*
  Подписи по-русски — данные автора Инструмента, а не строки кита, и каталогу они
  не принадлежат (ADR-0058, п. 6.2). Записаны escape-последовательностями: гейт
  i18n ищет русские литералы в компонентах и историях, а здесь они — по делу.
*/
const RU_LABELS = {
  stamp: "\u0428\u0442\u0430\u043c\u043f",
  pin: "\u0417\u0430\u043a\u0440\u0435\u043f\u0438\u0442\u044c",
  symbol: "\u0421\u0438\u043c\u0432\u043e\u043b",
} as const;

const PinMark = Mark.create({ name: "acme_pin" });

const SYMBOLS = ["★", "✓", "→"] as const;

/** Содержимое поповеров-примеров: три символа, выбор зовёт `onPick`. */
function SymbolChoices({ onPick }: { onPick: (symbol: string) => void }) {
  return (
    <div role="group" aria-label="Symbols" className="flex gap-1">
      {SYMBOLS.map((symbol) => (
        <Button key={symbol} size="sm" variant="ghost" onClick={() => onPick(symbol)}>
          {symbol}
        </Button>
      ))}
    </div>
  );
}

const CUSTOM_BUTTON_TOOLS: readonly CustomTool[] = [
  {
    name: "acme_stamp",
    engine: [],
    buttons: [
      {
        id: "stamp",
        label: ({ locale }) => (locale.startsWith("ru") ? RU_LABELS.stamp : "Stamp"),
        icon: SparkleIcon,
        can: (editor) => editor.state.selection.$to.parent.inlineContent,
        run: (editor) => void editor.chain().focus().insertContent("★").run(),
        shortcut: ["mod", "shift", "Y"],
      },
    ],
  },
  {
    name: "acme_pin",
    engine: [PinMark],
    marks: { acme_pin: {} },
    buttons: [
      {
        id: "pin",
        label: ({ locale }) => (locale.startsWith("ru") ? RU_LABELS.pin : "Pin"),
        icon: PinIcon,
        can: (editor) => editor.can().toggleMark("acme_pin"),
        isActive: (editor) => editor.isActive("acme_pin"),
        run: (editor) => void editor.chain().focus().toggleMark("acme_pin").run(),
        selectionMenu: true,
        shortcut: ["mod", "alt", "P"],
      },
    ],
  },
  {
    name: "acme_symbols",
    engine: [],
    buttons: [
      {
        id: "symbols",
        label: ({ locale }) => (locale.startsWith("ru") ? RU_LABELS.symbol : "Symbol"),
        icon: TagIcon,
        can: (editor) => editor.state.selection.$to.parent.inlineContent,
        shortcut: ["mod", "shift", "J"],
        popover: ({ editor, close }) => (
          <SymbolChoices
            onPick={(symbol) => {
              editor.chain().insertContent(symbol).run();
              close();
            }}
          />
        ),
      },
    ],
  },
];

const CUSTOM_BUTTON_SAMPLE =
  "<h2>Own buttons</h2><p>The Stamp, Pin and Symbol buttons stand in one group " +
  "before Undo and Redo. Pin also shows in the selection menu.</p>";

/**
 * Кнопки своего Инструмента: одна группа на Панели перед «Отменить» и
 * «Повторить», в порядке `tools`. «Stamp» — действие с сочетанием
 * `Ctrl/⌘+Shift+Y`, «Pin» — переключатель с `aria-pressed` и местом в Меню
 * выделения, «Symbol» — поповер с содержимым Инструмента. Подсказка называет
 * сочетание, справочник сочетаний даёт им группу без заголовка после групп кита.
 */
export const CustomToolButtons: Story = {
  args: {
    defaultValue: CUSTOM_BUTTON_SAMPLE,
    tools: [...RICH_TEXT_PRESETS.full, ...CUSTOM_BUTTON_TOOLS],
  },
};

/** Поповер своей кнопки открыт: рамка, слой и возврат фокуса — у кита. */
export const CustomToolButtonPopover: Story = {
  render: () => <CustomButtonOpen />,
};

/** Русская локаль: подписи-функции получают `locale: "ru-RU"` и переводят кнопки. */
export const CustomToolButtonsRussian: Story = {
  render: () => (
    <UiProvider locale="ru-RU" messages={ru}>
      <div className="max-w-[640px]">
        <RichTextEditor
          aria-label="Document"
          defaultValue={CUSTOM_BUTTON_SAMPLE}
          tools={[...RICH_TEXT_PRESETS.full, ...CUSTOM_BUTTON_TOOLS]}
        />
      </div>
    </UiProvider>
  ),
};

function CustomButtonOpen() {
  const host = useRef<HTMLDivElement>(null);
  useOpenEmoji(host, "Symbol");
  return (
    <div ref={host} className="h-[320px] max-w-[640px]">
      <RichTextEditor
        aria-label="Document"
        defaultValue={CUSTOM_BUTTON_SAMPLE}
        tools={[...RICH_TEXT_PRESETS.full, ...CUSTOM_BUTTON_TOOLS]}
      />
    </div>
  );
}

/*
  Свой Инструмент с пунктом вставки и Действием над Блоком на
  нейтральных данных: заметка-контейнер. Подпись пункта — функция от
  `{ locale }`, поэтому в русской локали она другая.
*/
const Callout = Node.create({ name: "acme_callout", content: "block+", isolating: true });

const calloutTool: CustomTool = {
  name: "acme_callout",
  engine: [Callout],
  blocks: { acme_callout: { kind: "block", container: true } },
  insertItems: [
    {
      section: "insert",
      label: ({ locale }) => `Callout (${locale})`,
      icon: WrapperIcon,
      aliases: ["note", "tip"],
      shortcut: ["mod", "alt", "N"],
      run: (chain) =>
        chain.insertContent({ type: "acme_callout", content: [{ type: "paragraph" }] }),
    },
  ],
  blockActions: [
    {
      label: "Unwrap callout",
      icon: WrapperIcon,
      blocks: ["acme_callout"],
      run: (editor, pos) =>
        void editor
          .chain()
          .focus()
          .command(({ tr }) => {
            // Позиция — Блок Ручки: сама заметка или Блок прямо в ней.
            const $pos = tr.doc.resolve(pos);
            const from = $pos.parent.type.name === "acme_callout" ? $pos.before($pos.depth) : pos;
            const callout = tr.doc.nodeAt(from);
            if (callout?.type.name === "acme_callout") {
              tr.replaceWith(from, from + callout.nodeSize, callout.content);
            }
            return true;
          })
          .run(),
    },
  ],
};

const CALLOUT_SAMPLE =
  "<p>Type / and pick Callout, or open the block menu of the note below.</p>" +
  '<div data-block="acme_callout"><p>The block menu of this note has its own Unwrap action.</p></div>';

/**
 * Свой пункт Меню вставки («/», «+», «Добавить ›» стоят в конце раздела
 * «Добавить») и своё Действие над Блоком (секция меню Ручки перед «Удалить»,
 * видна у заметки и у Блока в ней). Сочетания — поле записи: `⌘⌥N` вставляет
 * заметку, подсказка и справочник их показывают.
 */
export const CustomInsertItemAndBlockAction: Story = {
  args: { tools: [...RICH_TEXT_PRESETS.full, calloutTool], defaultValue: CALLOUT_SAMPLE },
};

/** То же в русской локали: подпись пункта получает `locale`, каталог — русский. */
export const CustomInsertItemAndBlockActionRussian: Story = {
  args: { tools: [...RICH_TEXT_PRESETS.full, calloutTool], defaultValue: CALLOUT_SAMPLE },
  render: (args) => (
    <UiProvider locale="ru-RU" messages={ru}>
      <div className="max-w-[640px]">
        <RichTextEditor {...args} />
      </div>
    </UiProvider>
  ),
};

/*
  Пункт вставки и Действие над Блоком с поповером (ADR-0058, п. 5.6) на
  нейтральных данных: выбор символа. Рамку держит кит, как у кнопки; поповер
  пункта встаёт у каретки (из «/» — там, где стоял «/»), Действия — у Блока.
*/
const symbolEntriesTool: CustomTool = {
  name: "acme_symbolEntries",
  engine: [],
  insertItems: [
    {
      section: "insert",
      label: "Symbol",
      icon: TagIcon,
      aliases: ["sym", "char"],
      popover: ({ editor, close }) => (
        <SymbolChoices
          onPick={(symbol) => {
            editor.chain().insertContent(symbol).run();
            close();
          }}
        />
      ),
    },
  ],
  blockActions: [
    {
      label: "Append symbol",
      icon: TagIcon,
      blocks: ["paragraph", "heading"],
      // `pos` — Блок Ручки: символ встаёт в конец его текста.
      popover: ({ editor, close, pos }) => (
        <SymbolChoices
          onPick={(symbol) => {
            const block = editor.state.doc.nodeAt(pos);
            if (block)
              editor
                .chain()
                .insertContentAt(pos + block.nodeSize - 1, symbol)
                .run();
            close();
          }}
        />
      ),
    },
  ],
};

const SYMBOL_ENTRIES_SAMPLE =
  "<h2>Popovers of menus</h2><p>Type / and pick Symbol: the picker opens where the slash was.</p>" +
  "<p>Append symbol in the block menu of this paragraph opens its picker at the block.</p>";

/**
 * Поповер пункта вставки и Действия над Блоком: «Symbol» в «/», «+» и
 * «Добавить ›» открывает выбор у каретки, «Append symbol» в меню Ручки — у
 * Блока. Escape закрывает поповер и возвращает каретку в текст.
 */
export const CustomEntryPopovers: Story = {
  args: {
    tools: [...RICH_TEXT_PRESETS.full, symbolEntriesTool],
    defaultValue: SYMBOL_ENTRIES_SAMPLE,
  },
};

/*
  Свой Инструмент с загрузчиком на нейтральных данных: врезка-
  контейнер, Часть для движка которой приходит промисом. Промис решают кнопки
  истории — так Скелет стоит на экране, сколько нужно, и снимок детерминирован.
  «Повторить» зовёт загрузчик заново: кнопки решают уже новый промис.
*/
const Aside = Node.create({ name: "acme_aside", content: "block+", isolating: true });
let settleAside: (fail: boolean) => void = () => {};

const asideTool: CustomTool = {
  name: "acme_aside",
  engine: () =>
    new Promise((resolve, reject) => {
      settleAside = (fail) => (fail ? reject(new Error("offline")) : resolve([Aside]));
    }),
  blocks: { acme_aside: { kind: "block", container: true } },
};

const ASIDE_SAMPLE =
  "<h2>Loading a tool</h2>" +
  "<p>Until the engine part of every tool has loaded, the field shows the Skeleton: " +
  "the frame and this document as static HTML, without input.</p>" +
  '<div data-block="acme_aside"><p>An aside: its block comes from a lazily loaded tool.</p></div>' +
  "<ul><li><p>The height of the field does not jump.</p></li></ul>";

function ToolLoaderStory(args: RichTextEditorProps) {
  return (
    <div className="flex max-w-[640px] flex-col gap-3">
      <div className="flex gap-2">
        <Button size="sm" onClick={() => settleAside(false)}>
          Finish loading
        </Button>
        <Button size="sm" variant="outline" onClick={() => settleAside(true)}>
          Fail loading
        </Button>
      </div>
      <div data-story-field>
        <RichTextEditor {...args} />
      </div>
    </div>
  );
}

/**
 * Скелет до Готовности: рамка поля, место Панели и Документ статичным HTML с
 * ритмом Просмотра, без ввода. Документ очищен Схемой: врезка, чей загрузчик
 * ещё не отработал, видна текстом. «Finish loading» решает загрузчик — движок
 * встаёт на место Скелета без прыжка высоты; «Fail loading» — ошибка поля с
 * «Повторить», Документ остаётся виден.
 */
export const ToolLoader: Story = {
  args: { tools: [...RICH_TEXT_PRESETS.full, asideTool], defaultValue: ASIDE_SAMPLE },
  render: (args) => <ToolLoaderStory {...args} />,
};

/*
  Карточка у текста (ADR-0058, п. 7.6–7.11) на нейтральных данных:
  замечания к тексту. Метка `acme_comment` и её Карточка — Инструмент потребителя;
  диапазон даёт готовый помощник кита `markRange`, а рамку, якорь под диапазоном,
  переворот у края и Escape держит кит.
*/
const CommentMark = Mark.create({ name: "acme_comment" });

/* Русская подпись — данные автора Инструмента; escape-ами — по гейту i18n, как выше. */
const RU_COMMENT = "\u041a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0439";

const commentTool: CustomTool = {
  name: "acme_comment",
  engine: [CommentMark],
  marks: { acme_comment: {} },
  textCards: [
    {
      label: ({ locale }) => (locale.startsWith("ru") ? RU_COMMENT : "Comment"),
      rangeAt: markRange("acme_comment"),
      render: ({ editor, range, close }) => (
        <div className="flex max-w-xs flex-col gap-2 text-sm">
          <p className="text-fg-1">
            “{editor.state.doc.textBetween(range.from, range.to)}” needs a second look before the
            release.
          </p>
          <div className="flex justify-end">
            <Button size="sm" variant="ghost" onClick={close}>
              Resolve
            </Button>
          </div>
        </div>
      ),
    },
  ],
};

const COMMENT_SAMPLE =
  "<p>The release plan is ready for review. " +
  '<span data-mark="acme_comment">Ship the migration before the freeze</span> ' +
  "so the team can test it early.</p>" +
  '<p>Open questions: <span data-mark="acme_comment">who owns the rollback</span>?</p>';

/** Каретка в первую Метку-замечание, как только движок появился: история показывает Карточку открытой. */
function useCaretInComment(ref: RefObject<RichTextEditorHandle | null>) {
  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const editor = ref.current?.editor;
      if (!editor) {
        frame = requestAnimationFrame(tick);
        return;
      }
      let at = 0;
      editor.state.doc.descendants((node, pos) => {
        if (!at && node.isText && node.marks.some((mark) => mark.type.name === "acme_comment")) {
          at = pos + 3;
        }
      });
      editor.chain().focus().setTextSelection(at).run();
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [ref]);
}

function CommentOpen({ locale }: { locale?: "ru-RU" }) {
  const ref = useRef<RichTextEditorHandle>(null);
  useCaretInComment(ref);
  const field = (
    <div className="h-[360px] max-w-[640px]">
      <RichTextEditor
        ref={ref}
        aria-label="Document"
        defaultValue={COMMENT_SAMPLE}
        tools={[...RICH_TEXT_PRESETS.full, commentTool]}
      />
    </div>
  );
  return locale ? (
    <UiProvider locale={locale} messages={ru}>
      {field}
    </UiProvider>
  ) : (
    field
  );
}

/**
 * Карточка у текста: каретка внутри замечания или щелчок по нему открывает
 * Карточку под диапазоном; наведение — нет. Фокус остаётся в Документе, печать
 * продолжается; `Alt+F10` ведёт в Карточку, Escape возвращает каретку и прячет
 * её до выхода каретки из диапазона. Развёрнутое выделение закрывает Карточку.
 */
export const TextCard: Story = {
  args: { defaultValue: COMMENT_SAMPLE, tools: [...RICH_TEXT_PRESETS.full, commentTool] },
};

/**
 * Карточка открыта — для глаз, снимков и axe: рамка, слой и доступное имя у кита.
 * Карточка — ленивый чанк, и его загрузка стартует только после
 * Готовности движка: метка `network-idle` велит снимку и аудиту дождаться тишины
 * в сети, иначе они застают поле без Карточки.
 */
export const TextCardOpen: Story = {
  tags: ["network-idle"],
  render: () => <CommentOpen />,
};

/** Русская локаль: подпись записи — функция от `{ locale }`, имя рамки и фраза о появлении — каталог. */
export const TextCardRussian: Story = {
  tags: ["network-idle"],
  render: () => <CommentOpen locale="ru-RU" />,
};

/** `readOnly`: Карточки работают — читать замечания можно и без правки текста. */
export const TextCardReadOnly: Story = {
  args: {
    defaultValue: COMMENT_SAMPLE,
    readOnly: true,
    tools: [...RICH_TEXT_PRESETS.full, commentTool],
  },
};

/**
 * Поле у нижнего края окна (прокрутите вниз): последнее замечание стоит там,
 * где под диапазоном места нет, и Карточка переворачивается над ним.
 */
export const TextCardNearEdge: Story = {
  render: () => (
    <div className="max-w-[640px] pt-[120vh]">
      <RichTextEditor
        aria-label="Document"
        defaultValue={COMMENT_SAMPLE}
        tools={[...RICH_TEXT_PRESETS.full, commentTool]}
      />
    </div>
  ),
};

/*
  Свой символ-триггер (ADR-0064) на нейтральных данных: упоминания
  по `@`. Инструмент описывает символ, пункты по запросу и то, что делает выбор
  (заменяет `@запрос` атомом); список — тот же компонент кита, что у «/».
*/
const MENTION_PEOPLE = [
  { id: "ada", name: "Ada Lovelace" },
  { id: "alan", name: "Alan Turing" },
  { id: "grace", name: "Grace Hopper" },
  { id: "margaret", name: "Margaret Hamilton" },
];
const mentionName = (id: unknown) =>
  MENTION_PEOPLE.find((person) => person.id === id)?.name ?? String(id ?? "");

const MentionAtom = Node.create({
  name: "acme_mention",
  atom: true,
  selectable: true,
  addAttributes: () => ({ acme_id: { default: null } }),
  renderText: ({ node }) => `@${mentionName(node.attrs.acme_id)}`,
  addNodeView:
    () =>
    ({ node }) => {
      const dom = document.createElement("span");
      dom.className = "rounded-sm bg-accent-soft px-1 text-accent-strong";
      dom.textContent = `@${mentionName(node.attrs.acme_id)}`;
      return { dom };
    },
});

const mentionTool: CustomTool = {
  name: "acme_mention",
  engine: [MentionAtom],
  blocks: {
    acme_mention: {
      kind: "inline",
      attributes: { acme_id: { kind: "list", values: MENTION_PEOPLE.map((person) => person.id) } },
    },
  },
  trigger: {
    char: "@",
    label: "People",
    items: (query) =>
      MENTION_PEOPLE.filter((person) =>
        person.name.toLowerCase().includes(query.toLowerCase())
      ).map((person) => ({ id: person.id, label: person.name, icon: MentionIcon })),
    onSelect: (item, { editor, range }) =>
      void editor
        .chain()
        .focus()
        .insertContentAt(range, [
          { type: "acme_mention", attrs: { acme_id: item.id } },
          { type: "text", text: " " },
        ])
        .run(),
  },
};

const MENTION_SAMPLE =
  '<p>Thanks <span data-block="acme_mention" data-acme_id="grace"></span> for the review.</p>' +
  "<p>Type @ to mention a teammate; mail@example.com inside a word stays text.</p><p></p>";

function MentionTriggerStory({ command }: { command: string }) {
  const ref = useRef<RichTextEditorHandle>(null);
  useTypedCommand(ref, command);
  return (
    <div className="h-[420px] max-w-[640px]">
      <RichTextEditor
        ref={ref}
        aria-label="Document"
        tools={[...RICH_TEXT_PRESETS.basic, mentionTool]}
        defaultValue={MENTION_SAMPLE}
      />
    </div>
  );
}

/**
 * Свой символ-триггер: набор `@` в начале Блока или после пробела открывает
 * список людей у каретки — тот же, что у «/», с фокусом в поле. Запрос после
 * `@` фильтрует, стрелки и Enter выбирают, Escape закрывает, оставив набранное.
 * Выбор заменяет `@запрос` атомом упоминания. Внутри слова (`mail@example.com`)
 * список молчит.
 */
export const MentionTrigger: Story = {
  render: () => <MentionTriggerStory command="@" />,
};

/** Поле без набранного: клавиатурные проверки в браузере набирают `@` сами. */
export const MentionTriggerIdle: Story = {
  render: () => <MentionTriggerStory command="" />,
};

/** Набранное после `@` фильтрует пункты, их отдаёт `items(query)` Инструмента. */
export const MentionTriggerFiltered: Story = {
  render: () => <MentionTriggerStory command="@gr" />,
};

/** Ничего не нашлось — строка «Nothing found», как у «/». */
export const MentionTriggerNothingFound: Story = {
  render: () => <MentionTriggerStory command="@zzz" />,
};

/* ── Оглавление: Инструмент `toc` (ADR-0068) ──────────────────── */

const tocSection = (topic: string) =>
  `<p>This section describes ${topic}. It has enough text to give the field some height, ` +
  "so that the strip and the headings it points to do not all fit on one screen.</p>";

const TOC_ARTICLE =
  "<h1>Palette</h1>" +
  tocSection("the palette as a whole") +
  "<h2>How to read</h2>" +
  tocSection("how a color goes from a primitive to a class") +
  "<h2>Layer 1 — primitives</h2>" +
  tocSection("the primitives") +
  "<h3>Neutrals</h3>" +
  tocSection("the neutral scales") +
  "<h3>Tones</h3>" +
  tocSection("the tone scales") +
  "<h2>Layer 2 — roles by theme</h2>" +
  tocSection("the roles") +
  "<h3>Surfaces</h3>" +
  tocSection("the surfaces") +
  "<h2>What's next</h2>" +
  tocSection("what comes next");

const TOC_TOOLS = [...RICH_TEXT_PRESETS.full, "toc"] as const;

/**
 * Оглавление в левом поле Редактора: Инструмент `toc` включают именем, в пресеты
 * он не входит. Полоса липнет под Панелью; наведение раскрывает список, клик
 * ставит каретку в конец заголовка. Добавьте или удалите заголовок — список
 * пересоберётся, а с последним заголовком из пары уйдёт и левое поле.
 */
export const TableOfContents: Story = {
  args: { tools: [...TOC_TOOLS], defaultValue: TOC_ARTICLE },
};

/** `readOnly`: Панели нет, полоса липнет к краю окна, переход ставит фокус на заголовок. */
export const TableOfContentsReadOnly: Story = {
  args: { tools: [...TOC_TOOLS], defaultValue: TOC_ARTICLE, readOnly: true },
};

/**
 * Поле с `maxHeight`: Документ прокручивается внутри Редактора, полоса липнет к
 * верху области, подсветка и переход считают от неё.
 */
export const TableOfContentsScrollingField: Story = {
  args: { tools: [...TOC_TOOLS], defaultValue: TOC_ARTICLE, maxHeight: 360 },
};

/** Светлый Лист: Оглавление стоит в поле Редактора слева от Листа, в теме приложения. */
export const TableOfContentsPaper: Story = {
  args: { tools: [...TOC_TOOLS], defaultValue: TOC_ARTICLE, surface: "paper" },
};

/** Плавающая Панель: над полем ничего не липнет, полоса — к краю окна. */
export const TableOfContentsFloatingToolbar: Story = {
  args: { tools: [...TOC_TOOLS], defaultValue: TOC_ARTICLE, toolbar: "floating" },
};

/**
 * Оглавление, настроенное записью `tool("toc", …)`: только уровни H2–H3 и
 * шапка экрана, чья высота лежит в своей переменной `--header-h`, а не в
 * `--topbar-h`. Запись сама включает Инструмент, имя `"toc"` в `tools` не нужно.
 * Прокрутите страницу и нажмите пункт списка: заголовок встанет под шапку, а
 * H1 и H4 в полосе и списке нет.
 */
export const TableOfContentsOptions: Story = {
  args: {
    tools: [...RICH_TEXT_PRESETS.full, tool("toc", { offsetVar: "--header-h", levels: [2, 3] })],
    defaultValue: TOC_ARTICLE,
    toolbar: "floating",
  },
  render: (args) => <WithAppHeader {...args} />,
};

function WithAppHeader(props: RichTextEditorProps) {
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--header-h", "56px");
    return () => {
      root.style.removeProperty("--header-h");
    };
  }, []);
  return (
    <div>
      <div className="border-line-soft bg-bg-1 text-fg-2 sticky top-0 z-10 -mx-4 -mt-4 mb-4 flex h-14 items-center border-b px-4 text-[13px] font-semibold">
        Application header
      </div>
      <RichTextEditor aria-label="Body" {...props} />
    </div>
  );
}
