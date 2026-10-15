import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useRef, useState } from "react";
import { Button } from "../../../components/actions/Button.js";
import type { RichTextSurface } from "../../styles/surface.js";
import { RichTextEditor, type RichTextEditorHandle } from "../../RichTextEditor.js";
import { RichTextToc } from "./RichTextToc.js";
import { RichTextView } from "../../RichTextView.js";

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
  "<h3>Component tokens that a theme overrides for one family of controls</h3>" +
  paragraph("the component tokens") +
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

/** Длинный Документ: сорок заголовков трёх уровней, чтобы полоса упёрлась в высоту окна. */
const LONG =
  "<h1>Handbook</h1>" +
  paragraph("the handbook") +
  Array.from({ length: 13 }, (_, index) => {
    const chapter = index + 1;
    return (
      `<h2>Chapter ${chapter}</h2>` +
      paragraph(`chapter ${chapter}`) +
      `<h3>Chapter ${chapter}, part one</h3>` +
      paragraph(`the first part of chapter ${chapter}`) +
      `<h4>Chapter ${chapter}, notes</h4>` +
      paragraph(`the notes to chapter ${chapter}`)
    );
  }).join("");

interface ScreenProps {
  html: string;
  surface?: RichTextSurface;
  /** Ширина списка Оглавления (`listWidth`). */
  listWidth?: number | string;
}

/**
 * Экран, как его соберёт потребитель: Оглавление в своей колонке слева, со
 * своим `sticky`, Просмотр — справа. Колонку и липкость задаёт экран, не
 * компонент.
 */
function Screen({ html, surface, listWidth }: ScreenProps) {
  const view = useRef<HTMLDivElement>(null);
  return (
    <div className="flex items-start gap-6">
      <div className="sticky top-[calc(var(--topbar-h,0px)+16px)] w-10 shrink-0">
        <RichTextToc target={view} listWidth={listWidth} />
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

interface EditorScreenProps extends ScreenProps {
  /** Редактор только для чтения. По умолчанию `true`: это поддерживаемый режим. */
  readOnly?: boolean;
  toolbar?: "fixed" | "floating" | "bubble" | "none";
  /** Высота поля: Документ прокручивается внутри Редактора, а не страницей. */
  maxHeight?: number | string;
  /** Кнопка над Редактором, которая переключает `readOnly`. */
  toggle?: boolean;
}

/** То же, что `Screen`, но цель — Редактор: его Хэндл, а не элемент Просмотра. */
function EditorScreen({
  html,
  surface,
  listWidth,
  readOnly = true,
  toolbar,
  maxHeight,
  toggle = false,
}: EditorScreenProps) {
  const editor = useRef<RichTextEditorHandle>(null);
  const [locked, setLocked] = useState(readOnly);
  return (
    <div className="flex flex-col gap-3">
      {toggle && (
        <div className="flex items-center gap-3 pl-16">
          <Button size="sm" variant="outline" onClick={() => setLocked((value) => !value)}>
            {locked ? "Edit" : "Done"}
          </Button>
          <span className="text-fg-2 text-[13px]">
            {locked ? "Read only" : "Editing: add or rename a heading and watch the strip"}
          </span>
        </div>
      )}
      <div className="flex items-start gap-6">
        <div className="sticky top-[calc(var(--topbar-h,0px)+16px)] w-10 shrink-0">
          <RichTextToc target={editor} listWidth={listWidth} />
        </div>
        <RichTextEditor
          ref={editor}
          aria-label="Document"
          defaultValue={html}
          readOnly={locked}
          surface={surface}
          toolbar={toolbar}
          maxHeight={maxHeight}
          className="max-w-[640px] min-w-0 flex-1"
        />
      </div>
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

/**
 * Оглавление в поле страницы: колонка текста по центру, полоса — в поле слева
 * от неё. Сузьте окно: когда поле станет уже полосы, Оглавление спрячется само.
 */
export const Margin: Story = {
  render: (args) => <MarginScreen {...args} />,
};

function MarginScreen({ html, surface }: ScreenProps) {
  const view = useRef<HTMLDivElement>(null);
  return (
    <div className="relative mx-auto max-w-[640px]">
      <div className="absolute top-0 right-full mr-8 h-full">
        <div className="sticky top-[calc(var(--topbar-h,0px)+16px)]">
          <RichTextToc target={view} />
        </div>
      </div>
      <RichTextView ref={view} html={html} surface={surface} />
    </div>
  );
}

/** Редактор в `readOnly`: Оглавление берёт заголовки из его Документа, как у Просмотра. */
export const ReadOnlyEditor: Story = {
  render: (args) => <EditorScreen {...args} />,
};

/**
 * Редактор в правке. Добавьте заголовок или переименуйте существующий: полоса и
 * список пересоберутся через мгновение. Переход прокручивает к заголовку, но
 * каретку не трогает. Этот режим работает, но контрактом не обещан.
 */
export const EditableEditor: Story = {
  render: (args) => <EditorScreen {...args} readOnly={false} />,
};

/** Кнопка над Редактором переключает `readOnly`: Оглавление работает в обоих режимах. */
export const EditorReadOnlyToggle: Story = {
  render: (args) => <EditorScreen {...args} toggle />,
};

/** Редактор на светлом Листе: Оглавление остаётся в теме приложения, вне Листа. */
export const EditorPaper: Story = {
  render: (args) => <EditorScreen {...args} surface="paper" />,
};

/**
 * Поле с `maxHeight`: Документ прокручивается внутри Редактора. Подсветка
 * следит за этой прокруткой, переход прокручивает поле, а не страницу.
 */
export const EditorScrollingField: Story = {
  render: (args) => <EditorScreen {...args} readOnly={false} maxHeight={360} />,
};

/** Плавающая Панель: она появляется над выделением и Оглавлению не мешает. */
export const EditorFloatingToolbar: Story = {
  render: (args) => <EditorScreen {...args} readOnly={false} toolbar="floating" />,
};

/** Длинный Документ в Редакторе `readOnly`: штрих на заголовок, список прокручивается. */
export const EditorLongDocument: Story = {
  render: (args) => <EditorScreen {...args} html={LONG} />,
};

/**
 * Длинный Документ: на каждый заголовок свой штрих, полоса не выше окна — при
 * нехватке места шаг между штрихами сжимается. Список прокручивается, текущий
 * пункт держится в его видимой части.
 */
export const LongDocument: Story = { args: { html: LONG } };

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

/**
 * Документ в своей прокручиваемой области, шапки у страницы нет. Переход
 * прокручивает только эту область: страница стоит на месте, а заголовок встаёт
 * к верхнему краю области (`scroll-margin-top`, ADR-0016).
 */
export const ScrollingAreaWithoutHeader: Story = {
  render: (args) => <ScrollingAreaScreen {...args} />,
};

function ScrollingAreaScreen({ html }: ScreenProps) {
  const view = useRef<HTMLDivElement>(null);
  return (
    <div>
      <div className="flex items-start gap-6">
        <div className="sticky top-4 w-10 shrink-0">
          <RichTextToc target={view} />
        </div>
        {/* Прокручиваемая область достижима с клавиатуры, как `ScrollArea` кита (axe `scrollable-region-focusable`). */}
        <div
          data-testid="scroll-area"
          tabIndex={0}
          role="region"
          aria-label="Document"
          className="bg-bg-1 focus-visible:outline-accent-strong max-h-80 min-w-0 flex-1 overflow-y-auto px-4 focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <RichTextView ref={view} html={html} className="max-w-[640px]" />
        </div>
      </div>
      {/* Страница выше окна: ей есть куда прокручиваться, и сдвиг был бы виден. */}
      <p className="text-fg-2 mt-6 h-[900px] text-[13px]">The page continues below the area.</p>
    </div>
  );
}
