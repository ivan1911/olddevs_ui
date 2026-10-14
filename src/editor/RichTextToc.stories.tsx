import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useRef } from "react";
import type { RichTextSurface } from "./styles/surface.js";
import { RichTextToc } from "./RichTextToc.js";
import { RichTextView } from "./RichTextView.js";

/*
  Нейтральный Документ со всеми уровнями заголовков: у H1 нет отступа, у
  каждого следующего уровня штрих короче и пункт глубже.
*/
const paragraph = (topic: string) =>
  `<p>This section describes ${topic}. It has enough text to give the page some height, ` +
  "so that the strip and the headings it points to do not all fit on one screen.</p>";

const ARTICLE =
  "<h1>Palette</h1>" +
  paragraph("the palette as a whole") +
  "<h2>How to read</h2>" +
  paragraph("how a color goes from a primitive to a class") +
  "<h2>Layer 1 — primitives</h2>" +
  paragraph("the primitives") +
  "<h3>Neutrals</h3>" +
  paragraph("the neutral scales") +
  "<h3>Tones</h3>" +
  paragraph("the tone scales") +
  "<h4>Semi-transparent primitives</h4>" +
  paragraph("the semi-transparent primitives") +
  "<h2>Layer 2 — roles by theme</h2>" +
  paragraph("the roles") +
  "<h3>Surfaces</h3>" +
  paragraph("the surfaces") +
  "<h3>Text</h3>" +
  paragraph("the text roles") +
  "<h2>What's next</h2>" +
  paragraph("what comes next");

/** Заголовки в Обёртке идут в Оглавление, в колонках Раскладки — нет. */
const BLOCKS =
  "<h2>Release 2.4</h2>" +
  paragraph("the release") +
  '<div data-block="wrapper" data-tone="warning"><h3>Before you upgrade</h3>' +
  paragraph("the upgrade") +
  "</div>" +
  '<div data-block="layout" data-layout="50-50">' +
  '<div data-block="column"><h3>Left column</h3><p>Not in the table of contents.</p></div>' +
  '<div data-block="column"><h3>Right column</h3><p>Not in the table of contents either.</p></div>' +
  "</div>" +
  "<h3>Known issues</h3>" +
  paragraph("the known issues");

interface ScreenProps {
  html: string;
  surface?: RichTextSurface;
}

/**
 * Экран, как его соберёт потребитель: Оглавление в своей колонке слева, со
 * своим `sticky`, Просмотр — справа. Колонку и липкость задаёт экран, не
 * компонент.
 */
function Screen({ html, surface }: ScreenProps) {
  const view = useRef<HTMLDivElement>(null);
  return (
    <div className="flex items-start gap-6">
      <div className="sticky top-[calc(var(--topbar-h,0px)+16px)] w-10 shrink-0">
        <RichTextToc target={view} />
      </div>
      <RichTextView
        ref={view}
        html={html}
        surface={surface}
        className="max-w-[640px] min-w-0 flex-1"
      />
    </div>
  );
}

const meta = {
  title: "Content/RichTextToc",
  component: Screen,
  parameters: { layout: "padded" },
  args: { html: ARTICLE },
} satisfies Meta<typeof Screen>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Полоса штрихов слева от Просмотра. Нажмите на неё — откроется список заголовков. */
export const Playground: Story = {};

/** На светлом листе `surface="paper"` Оглавление остаётся в теме приложения: оно вне листа. */
export const Paper: Story = { args: { surface: "paper" } };

/** Обёртка и Раскладка: заголовок в Обёртке есть в списке, заголовков колонок нет. */
export const WrapperAndLayout: Story = { args: { html: BLOCKS } };

/** Меньше двух заголовков — Оглавления нет вовсе, колонка экрана пуста. */
export const SingleHeading: Story = {
  args: { html: "<h2>Only heading</h2>" + paragraph("a short note") },
};

/**
 * Липкая шапка экрана публикует свою высоту в `--topbar-h` (ADR-0016), как это
 * делает `TopBar`. Переход ставит заголовок под шапку, а не за неё, и текущим
 * раздел становится, когда его заголовок дошёл до нижнего края шапки.
 */
export const StickyHeader: Story = {
  render: (args) => <WithTopBar {...args} />,
};

function WithTopBar(props: ScreenProps) {
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--topbar-h", "56px");
    return () => {
      root.style.removeProperty("--topbar-h");
    };
  }, []);
  return (
    <div>
      <div className="border-line-soft bg-bg-1 text-fg-2 sticky top-0 z-10 -mx-4 -mt-4 mb-4 flex h-14 items-center border-b px-4 text-[13px] font-semibold">
        Application header
      </div>
      <Screen {...props} />
    </div>
  );
}
